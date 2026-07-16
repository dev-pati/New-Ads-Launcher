import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

/**
 * User-scoped Supabase client.
 * Passes custom JWT so PostgREST can evaluate RLS via current_account_id()/auth.uid()-style claims.
 * Prefer this over createAdminClient() for request-scoped org data.
 */
export async function createTenantClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / PUBLISHABLE_KEY is not set")
  }

  const cookieStore = await cookies()
  // httpOnly session cookie only — never the client-readable twin (XSS-exfiltratable).
  const token = cookieStore.get("adlauncher_session")?.value

  const cfHeaders: Record<string, string> = {}
  const cfId = process.env.CF_ACCESS_CLIENT_ID
  const cfSecret = process.env.CF_ACCESS_CLIENT_SECRET
  if (cfId) cfHeaders["CF-Access-Client-Id"] = cfId
  if (cfSecret) cfHeaders["CF-Access-Client-Secret"] = cfSecret

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    db: { schema: process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "ads_launcher" },
    global: {
      headers: {
        ...cfHeaders,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  })
}
