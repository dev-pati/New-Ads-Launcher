import { createBrowserClient } from '@supabase/ssr'
import { assertSupabaseBoundary, resolveSchema } from './boundary'

function getClientToken() {
  if (typeof document === "undefined") return undefined
  return document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("adlauncher_client_token="))
    ?.split("=")[1]
}

// Decode user ID from the custom auth JWT stored in cookie (client-side only)
export function getUserIdFromClientToken(): string | null {
  const token = getClientToken()
  if (!token) return null
  try {
    const payload = token.split(".")[1]
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
    return decoded.sub || null
  } catch {
    return null
  }
}

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`
  // CF Access Service Token — allows browser requests through Cloudflare Zero Trust
  const cfId = process.env.NEXT_PUBLIC_CF_ACCESS_CLIENT_ID
  const cfSecret = process.env.NEXT_PUBLIC_CF_ACCESS_CLIENT_SECRET
  if (cfId) headers["CF-Access-Client-Id"] = cfId
  if (cfSecret) headers["CF-Access-Client-Secret"] = cfSecret
  return headers
}

export function createClient() {
  const token = getClientToken()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  const schema = resolveSchema()

  assertSupabaseBoundary(url, schema)

  return createBrowserClient(
    url,
    key,
    {
      db: { schema },
      global: { headers: buildHeaders(token) },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  )
}
