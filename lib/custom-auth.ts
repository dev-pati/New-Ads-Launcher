import { cookies } from "next/headers"
import { SignJWT, jwtVerify } from "jose"
import bcrypt from "bcryptjs"
import { createAdminClient } from "@/lib/supabase/admin"

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
      user_metadata: {
        full_name: typeof payload.full_name === "string" ? payload.full_name : null,
      },
    }
  } catch {
    return null
  }
}

export async function verifyPassword(email: string, password: string) {
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
