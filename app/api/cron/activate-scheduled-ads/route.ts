import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { setAdStatus } from "@/lib/facebook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// Vercel Cron job — runs every minute.
// 1. Activates ads whose scheduled_at has passed (status = pending → ACTIVE)
// 2. Pauses ads whose end_time has passed (status = activated → PAUSED)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createAdminClient()
  const now = new Date().toISOString()
  const activated: string[] = []
  const paused: string[] = []
  const errors: { id: string; error: string }[] = []

  // ── 1. Activate pending ads whose scheduled_at has passed ──────────
  const { data: pending } = await db
    .from("scheduled_activations")
    .select("id, org_id, ad_account_id, ad_ids")
    .eq("status", "pending")
    .lte("scheduled_at", now)

  for (const row of pending || []) {
    try {
      const { data: conn } = await db
        .from("facebook_connections")
        .select("access_token")
        .eq("org_id", row.org_id)
        .eq("is_active", true)
        .single()

      if (!conn?.access_token) throw new Error("No active Facebook connection")

      await Promise.all(
        (row.ad_ids as string[]).map(adId => setAdStatus(adId, conn.access_token, "ACTIVE"))
      )

      await db.from("scheduled_activations").update({ status: "activated" }).eq("id", row.id)
      activated.push(row.id)
    } catch (err: any) {
      await db.from("scheduled_activations").update({ status: "failed", error: err.message }).eq("id", row.id)
      errors.push({ id: row.id, error: err.message })
      console.error(`[cron/activate] row ${row.id} failed:`, err.message)
    }
  }

  // ── 2. Pause activated ads whose end_time has passed ───────────────
  const { data: expiring } = await db
    .from("scheduled_activations")
    .select("id, org_id, ad_ids")
    .eq("status", "activated")
    .not("end_time", "is", null)
    .lte("end_time", now)

  for (const row of expiring || []) {
    try {
      const { data: conn } = await db
        .from("facebook_connections")
        .select("access_token")
        .eq("org_id", row.org_id)
        .eq("is_active", true)
        .single()

      if (!conn?.access_token) throw new Error("No active Facebook connection")

      await Promise.all(
        (row.ad_ids as string[]).map(adId => setAdStatus(adId, conn.access_token, "PAUSED"))
      )

      await db.from("scheduled_activations").update({ status: "paused" }).eq("id", row.id)
      paused.push(row.id)
    } catch (err: any) {
      errors.push({ id: row.id, error: err.message })
      console.error(`[cron/activate] end-pause row ${row.id} failed:`, err.message)
    }
  }

  console.log(`[cron/activate] activated=${activated.length} paused=${paused.length} errors=${errors.length}`)
  return NextResponse.json({ activated, paused, errors })
}
