/**
 * POST /api/insights/trigger-snapshot
 * Triggered once per session from layout — snapshots all ad accounts in background.
 * Returns immediately; actual snapshot runs async.
 */
import { NextResponse }                          from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createAdminClient }                     from "@/lib/supabase/admin"
import { autoSnapshotIfStale }                   from "@/lib/auto-snapshot"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection?.access_token) return NextResponse.json({ ok: false, reason: "no_connection" })

    const db = createAdminClient()
    const { data: adAccounts } = await db
      .from("ad_accounts")
      .select("fb_ad_account_id")
      .eq("org_id", ctx.orgId)

    if (!adAccounts?.length) return NextResponse.json({ ok: true, accounts: 0 })

    // Fire all snapshots in background — don't await
    for (const { fb_ad_account_id } of adAccounts) {
      void autoSnapshotIfStale(ctx.orgId, fb_ad_account_id, connection.access_token, 7, ctx.user?.id)
    }

    return NextResponse.json({ ok: true, accounts: adAccounts.length })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
