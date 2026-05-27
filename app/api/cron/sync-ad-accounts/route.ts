import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAdAccounts } from "@/lib/facebook"
import { annotateAdAccounts, persistAdAccountMetrics } from "@/lib/sync-ad-accounts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

// Vercel Cron — runs every 30 minutes.
// Fetches ad accounts from Meta API for every org with an active Facebook
// connection, saves a metrics snapshot, and refreshes the DB cache so the
// next page load returns fresh data without an extra API call.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createAdminClient()

  const { data: connections, error: connError } = await db
    .from("facebook_connections")
    .select("org_id, access_token")
    .eq("is_active", true)

  if (connError) {
    console.error("[cron/sync-ad-accounts] failed to fetch connections:", connError.message)
    return NextResponse.json({ error: connError.message }, { status: 500 })
  }

  const results: { org_id: string; synced?: number; error?: string }[] = []

  for (const conn of connections || []) {
    try {
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

  return NextResponse.json({ results })
}
