import { cookies } from "next/headers"
import { SignJWT, jwtVerify } from "jose"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/send-email"
import { provisionCompanyAccount } from "@/lib/auth-allowlist"

export type AuthAccount = {
  id: string
  email: string
  full_name?: string | null
  avatar_url?: string | null
  user_metadata?: {
    full_name?: string | null
    avatar_url?: string | null
  }
}

const COOKIE_NAME = "adlauncher_session"
const CLIENT_COOKIE_NAME = "adlauncher_client_token"
const encoder = new TextEncoder()

function authSecret() {
  const secret = process.env.CUSTOM_AUTH_SECRET || process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("CUSTOM_AUTH_SECRET must be set to a secure string >= 32 characters.")
  }
  return encoder.encode(secret)
}

export async function createSession(account: AuthAccount) {
  const token = await new SignJWT({
    email: account.email,
    full_name: account.full_name || undefined,
    avatar_url: account.avatar_url || undefined,
    // Required for Supabase RLS: auth.uid() = sub, auth.role() = "authenticated"
    role: "authenticated",
    aud: "authenticated",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(account.id)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(authSecret())

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
  cookieStore.set(CLIENT_COOKIE_NAME, token, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
  cookieStore.delete(CLIENT_COOKIE_NAME)
}

export async function getSessionAccount(): Promise<AuthAccount | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, authSecret())
    if (!payload.sub || !payload.email) return null
    return {
      id: payload.sub,
      email: String(payload.email),
      full_name: typeof payload.full_name === "string" ? payload.full_name : null,
      avatar_url: typeof payload.avatar_url === "string" ? payload.avatar_url : null,
      user_metadata: {
        full_name: typeof payload.full_name === "string" ? payload.full_name : null,
        avatar_url: typeof payload.avatar_url === "string" ? payload.avatar_url : null,
      },
    }
  } catch {
    return null
  }
}

// SEC-011: In-memory rate limiter for single-instance Docker deployment.
// ponytail: if this app is ever scaled horizontally to multiple instances,
// this MUST be replaced with Upstash Redis or similar shared cache.
const OTP_LIMITS = {
  verify: new Map<string, { count: number; lockedUntil: number }>(),
  send: new Map<string, { count: number; windowStart: number }>(),
}

function hashOtp(otp: string, email: string): string {
  return crypto.createHash("sha256").update(otp.trim() + email.trim().toLowerCase()).digest("hex")
}

export async function verifyPassword(email: string, password: string): Promise<AuthAccount | null> {
  const db = createAdminClient()
  const { data: account, error } = await db
    .from("accounts")
    .select("id,email,full_name,avatar_url,encrypted_password,disabled_at")
    .ilike("email", email.trim())
    .single()

  if (error || !account?.encrypted_password) return null
  if (account.disabled_at) return null // SEC-011

  const ok = await bcrypt.compare(password, account.encrypted_password)
  if (!ok) return null

  await db
    .from("accounts")
    .update({ last_sign_in_at: new Date().toISOString() })
    .eq("id", account.id)

  return {
    id: account.id,
    email: account.email,
    full_name: account.full_name,
    avatar_url: account.avatar_url,
    user_metadata: {
      full_name: account.full_name,
      avatar_url: account.avatar_url,
    },
  } satisfies AuthAccount
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

export async function generateAndSendOtp(email: string): Promise<{
  ok: boolean
  error?: string
  status?: number
  timings?: { databaseMs: number; emailMs: number; totalMs: number }
}> {
  const startedAt = performance.now()
  const normEmail = email.trim().toLowerCase()

  // Rate limit OTP generation (max 3 per 5 minutes)
  const now = Date.now()
  const sendLimit = OTP_LIMITS.send.get(normEmail) || { count: 0, windowStart: now }
  if (now > sendLimit.windowStart + 5 * 60 * 1000) {
    sendLimit.count = 0
    sendLimit.windowStart = now
  }
  if (sendLimit.count >= 3) {
    return { ok: false, error: "Too many OTP requests. Please wait 5 minutes.", status: 429 }
  }
  sendLimit.count++
  OTP_LIMITS.send.set(normEmail, sendLimit)

  const db = createAdminClient()
  let { data: account, error } = await db
    .from("accounts")
    .select("id, email, disabled_at")
    .ilike("email", normEmail)
    .maybeSingle()

  if (error) {
    return { ok: false, error: "Database error", status: 500 }
  }
  if (!account) {
    await provisionCompanyAccount(normEmail)
    const { data: provisioned } = await db
      .from("accounts")
      .select("id, email, disabled_at")
      .ilike("email", normEmail)
      .maybeSingle()
    if (!provisioned) {
      return { ok: false, error: "Email not registered", status: 404 }
    }
    account = provisioned
  }
  if (account.disabled_at) {
    return { ok: false, error: "Account disabled", status: 403 }
  }

  // Generate 6-digit OTP securely
  const otp = crypto.randomInt(100000, 1000000).toString()
  const hashedOtp = hashOtp(otp, account.email)
  const expiresAt = new Date(now + 10 * 60 * 1000).toISOString() // 10 minutes from now

  const { error: updateError } = await db
    .from("accounts")
    .update({ otp_code: hashedOtp, otp_expires_at: expiresAt })
    .eq("id", account.id)

  if (updateError) {
    return { ok: false, error: "Failed to store verification code", status: 500 }
  }

  const databaseDoneAt = performance.now()
  const subject = `Your AdLauncher login code: ${otp}`
  const text = `Your AdLauncher login code is ${otp}. This code expires in 10 minutes. If you didn't request this, you can ignore this email.`
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Your login code</h2>
      <p style="font-size: 32px; font-weight: 700; letter-spacing: 4px;">${otp}</p>
      <p style="color: #666; font-size: 14px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
    </div>
  `
  const { ok, error: mailError } = await sendEmail({ to: account.email, subject, text, html })
  const emailDoneAt = performance.now()
  if (!ok) {
    return { ok: false, error: mailError || "Failed to send email", status: 500 }
  }

  return {
    ok: true,
    timings: {
      databaseMs: Math.round(databaseDoneAt - startedAt),
      emailMs: Math.round(emailDoneAt - databaseDoneAt),
      totalMs: Math.round(emailDoneAt - startedAt),
    },
  }
}

export async function verifyOtp(email: string, otp: string): Promise<AuthAccount | null> {
  const normEmail = email.trim().toLowerCase()

  // Check lockout (max 5 failed attempts)
  const now = Date.now()
  const verifyLimit = OTP_LIMITS.verify.get(normEmail) || { count: 0, lockedUntil: 0 }
  if (verifyLimit.lockedUntil > now) {
    throw new Error("Account locked due to too many failed attempts. Please request a new OTP.")
  }

  const db = createAdminClient()
  const { data: account, error } = await db
    .from("accounts")
    .select("id, email, full_name, avatar_url, otp_code, otp_expires_at, disabled_at")
    .ilike("email", normEmail)
    .maybeSingle()

  if (error || !account) return null
  if (account.disabled_at) return null
  if (!account.otp_code || !account.otp_expires_at) return null

  // Verify expiration
  const expired = new Date(account.otp_expires_at).getTime() < now
  if (expired) return null

  // Verify code using constant-time comparison on hashes
  const expectedHash = Buffer.from(account.otp_code)
  const actualHash = Buffer.from(hashOtp(otp, account.email))

  const valid = expectedHash.length === actualHash.length && crypto.timingSafeEqual(expectedHash, actualHash)

  if (!valid) {
    verifyLimit.count++
    if (verifyLimit.count >= 5) {
      verifyLimit.lockedUntil = now + 15 * 60 * 1000 // lock for 15m
    }
    OTP_LIMITS.verify.set(normEmail, verifyLimit)
    return null
  }

  // Clear OTP code and update sign in time
  OTP_LIMITS.verify.delete(normEmail)
  await db
    .from("accounts")
    .update({
      otp_code: null,
      otp_expires_at: null,
      last_sign_in_at: new Date().toISOString(),
    })
    .eq("id", account.id)

  return {
    id: account.id,
    email: account.email,
    full_name: account.full_name,
    avatar_url: account.avatar_url,
    user_metadata: {
      full_name: account.full_name,
      avatar_url: account.avatar_url,
    },
  } satisfies AuthAccount
}
