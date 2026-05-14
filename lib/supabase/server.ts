import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function buildServerHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`
  const cfId = process.env.CF_ACCESS_CLIENT_ID
  const cfSecret = process.env.CF_ACCESS_CLIENT_SECRET
  if (cfId) headers["CF-Access-Client-Id"] = cfId
  if (cfSecret) headers["CF-Access-Client-Secret"] = cfSecret
  return headers
}

export async function createClient() {
  const cookieStore = await cookies()
  const token = cookieStore.get("adlauncher_client_token")?.value

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      db: { schema: process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "ads_launcher" },
      global: { headers: buildServerHeaders(token) },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
