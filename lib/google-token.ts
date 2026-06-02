/**
 * Server-side Google OAuth token getter with auto-refresh.
 * Used by cron jobs that need Drive/Sheets access without a user session.
 */
import { createAdminClient } from "@/lib/supabase/admin"

export async function getGoogleTokenForOrg(orgId: string, opts: { forceRefresh?: boolean } = {}): Promise<string | null> {
  const db = createAdminClient()

  const { data: conn } = await db
    .from("google_connections")
    .select("access_token, refresh_token, expiry_at")
    .eq("org_id", orgId)
    .maybeSingle()

  if (!conn?.refresh_token) return null

  const expired = opts.forceRefresh || !conn.expiry_at || new Date(conn.expiry_at).getTime() < Date.now() + 60_000
  if (!expired) return conn.access_token

  // Refresh the token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: conn.refresh_token,
      client_id:     process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type:    "refresh_token",
    }),
  })
  const refreshed = await res.json()

  if (!res.ok || refreshed.error) {
    await db.from("google_connections").delete().eq("org_id", orgId)
    return null
  }

  const newExpiry = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString()
  await db.from("google_connections")
    .update({ access_token: refreshed.access_token, expiry_at: newExpiry })
    .eq("org_id", orgId)

  return refreshed.access_token
}
