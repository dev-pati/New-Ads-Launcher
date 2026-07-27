import { cookies } from "next/headers"
import { SignJWT, jwtVerify } from "jose"
import bcrypt from "bcryptjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendOtpEmail } from "@/lib/smtp-email"

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
  const secret =
    process.env.CUSTOM_AUTH_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("CUSTOM_AUTH_SECRET is not set")
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

export async function verifyPassword(email: string, password: string): Promise<AuthAccount | null> {
  const db = createAdminClient()
  const { data: account, error } = await db
    .from("accounts")
    .select("id,email,full_name,avatar_url,encrypted_password")
    .ilike("email", email.trim())
    .single()

  if (error || !account?.encrypted_password) return null

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

export async function generateAndSendOtp(email: string): Promise<{ ok: boolean; error?: string; status?: number }> {
  const db = createAdminClient()
  const { data: account, error } = await db
    .from("accounts")
    .select("id, email")
    .ilike("email", email.trim())
    .maybeSingle()

  if (error) {
    return { ok: false, error: "Database error", status: 500 }
  }
  if (!account) {
    return { ok: false, error: "Email not registered", status: 404 }
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes from now

  const { error: updateError } = await db
    .from("accounts")
    .update({ otp_code: otp, otp_expires_at: expiresAt })
    .eq("id", account.id)

  if (updateError) {
    return { ok: false, error: "Failed to store verification code", status: 500 }
  }

  const { ok, error: mailError } = await sendOtpEmail(account.email, otp)
  if (!ok) {
    return { ok: false, error: mailError || "Failed to send email", status: 500 }
  }

  return { ok: true }
}

export async function verifyOtp(email: string, otp: string): Promise<AuthAccount | null> {
  const db = createAdminClient()
  const { data: account, error } = await db
    .from("accounts")
    .select("id, email, full_name, avatar_url, otp_code, otp_expires_at")
    .ilike("email", email.trim())
    .maybeSingle()

  if (error || !account) return null
  if (!account.otp_code || !account.otp_expires_at) return null

  // Verify expiration
  const expired = new Date(account.otp_expires_at).getTime() < Date.now()
  if (expired) return null

  // Verify code
  if (account.otp_code !== otp.trim()) return null

  // Clear OTP code and update sign in time
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
