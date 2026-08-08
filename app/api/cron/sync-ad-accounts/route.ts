import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAdAccounts, getLongLivedToken } from "@/lib/facebook"
import { annotateAdAccounts, persistAdAccountMetrics } from "@/lib/sync-ad-accounts"
import { fetchViaProfile, tokenStatusFromError } from "@/lib/via-connections"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

// Vercel Cron — runs every 30 minutes.
// Fetches ad accounts from Meta API for every org with an active Facebook
// connection, saves a metrics snapshot, and refreshes the DB cache so the
// next page load returns fresh data without an extra API call.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createAdminClient()

  // Full sync chỉ chạy trên OAuth — via token (manual_token) không dùng cho sync org-level,
  // chúng chỉ được health-check bên dưới.
  const { data: connections, error: connError } = await db
    .from("facebook_connections")
    .select("id, org_id, access_token, token_expires_at")
    .eq("is_active", true)
    .eq("connection_type", "oauth")

  if (connError) {
    console.error("[cron/sync-ad-accounts] failed to fetch connections:", connError.message)
    return NextResponse.json({ error: connError.message }, { status: 500 })
  }

  const results: { org_id: string; synced?: number; error?: string }[] = []

  for (const conn of connections || []) {
    try {
      // Auto-refresh Meta long-lived user token before 10-day expiry threshold.
      // Exchange is only possible while the token is still valid.
      const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0
      const needsRefresh = expiresAt && (expiresAt - Date.now() < 10 * 24 * 60 * 60 * 1000)

      if (needsRefresh) {
        try {
          const refreshed = await getLongLivedToken(conn.access_token)
          conn.access_token = refreshed.access_token
          const nextExpiry = refreshed.expires_in
            ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
            : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()

          await db
            .from("facebook_connections")
            .update({ access_token: refreshed.access_token, token_expires_at: nextExpiry })
            .eq("id", conn.id)
          console.log(`[cron/sync-ad-accounts] refreshed Meta OAuth token for org=${conn.org_id}`)
        } catch (err) {
          console.warn(`[cron/sync-ad-accounts] refresh failed org=${conn.org_id}:`, err instanceof Error ? err.message : err)
        }
      }

      // Use the first org member as the user_id for snapshot attribution
      const { data: member } = await db
        .from("org_members")
        .select("user_id")
        .eq("org_id", conn.org_id)
        .limit(1)
        .single()

      if (!member?.user_id) {
        results.push({ org_id: conn.org_id, error: "no org member found" })
        continue
      }

      const rawAccounts = await getAdAccounts(conn.access_token)
      const annotated = await annotateAdAccounts(db, conn.org_id, rawAccounts)
      const syncedAt = new Date().toISOString()

      await persistAdAccountMetrics(db, conn.org_id, member.user_id, annotated, syncedAt)

      // Refresh DB cache so next page load returns this fresh data
      await db.from("meta_api_cache").upsert(
        {
          org_id: conn.org_id,
          cache_key: "facebook:ad-accounts",
          payload: annotated,
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          retry_after: null,
          updated_at: syncedAt,
        },
        { onConflict: "org_id,cache_key" }
      )

      results.push({ org_id: conn.org_id, synced: annotated.length })
      console.log(`[cron/sync-ad-accounts] org=${conn.org_id} synced=${annotated.length}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[cron/sync-ad-accounts] org=${conn.org_id} failed:`, msg)
      results.push({ org_id: conn.org_id, error: msg })
    }
  }

  // Health check mọi via đang active: GET /me (skipProof) → cập nhật token_status
  const healthResults: { id: string; token_status: string }[] = []
  const { data: vias } = await db
    .from("facebook_connections")
    .select("id, access_token")
    .eq("is_active", true)
    .eq("connection_type", "manual_token")

  for (const via of vias || []) {
    let tokenStatus: "valid" | "expired" | "invalid" = "valid"
    try {
      await fetchViaProfile(via.access_token)
    } catch (err) {
      tokenStatus = tokenStatusFromError(err)
    }
    await db
      .from("facebook_connections")
      .update({ token_status: tokenStatus, last_checked_at: new Date().toISOString() })
      .eq("id", via.id)
    healthResults.push({ id: via.id, token_status: tokenStatus })
    if (tokenStatus !== "valid") {
      console.warn(`[cron/sync-ad-accounts] via ${via.id} token ${tokenStatus}`)
    }
  }

  return NextResponse.json({ results, viaHealth: healthResults })
}
