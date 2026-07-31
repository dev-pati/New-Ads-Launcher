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

  // CF Access Service Token — identifier only.
  //
  // The matching CF-Access-Client-Secret is deliberately NOT read here. Anything
  // prefixed `NEXT_PUBLIC_` is inlined into the client bundle at build time, so
  // reading NEXT_PUBLIC_CF_ACCESS_CLIENT_SECRET published a Cloudflare Zero Trust
  // service-token secret to every visitor — a credential that authenticates as the
  // application to any CF Access-protected origin. `.env.example` already instructs
  // operators to leave it empty; this removes the code path that consumed it.
  //
  // The secret belongs to server-side callers only, via the unprefixed
  // CF_ACCESS_CLIENT_SECRET — see lib/supabase/{server,admin}.ts, which do this
  // correctly. If a browser request ever genuinely needs to traverse CF Access,
  // proxy it through a route handler rather than shipping the secret to the client.
  const cfId = process.env.NEXT_PUBLIC_CF_ACCESS_CLIENT_ID
  if (cfId) headers["CF-Access-Client-Id"] = cfId
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
