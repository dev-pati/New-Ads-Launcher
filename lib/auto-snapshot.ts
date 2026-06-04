/**
 * Auto-snapshot: saves campaign metrics to DB in background.
 * Called fire-and-forget from insights/metrics after a successful Meta fetch.
 * Only runs once per account per day (checks last snapped_at before fetching).
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { metaFetch }         from "@/app/api/facebook/_meta-fetch"

const GRAPH = "https://graph.facebook.com/v25.0"

function ago(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0]
}

export async function autoSnapshotIfStale(
  orgId: string,
  adAccountId: string,
  accessToken: string,
  days = 7,
): Promise<void> {
  try {
    const db    = createAdminClient()
    const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const today = new Date().toISOString().split("T")[0]

    // Skip if already snapped today for this account
    const { data: latest } = await db
      .from("campaign_insights_snapshots")
      .select("snapped_at")
      .eq("org_id", orgId)
      .eq("fb_ad_account_id", actId)
      .eq("date", ago(1)) // yesterday's data
      .limit(1)
      .maybeSingle()

    if (latest?.snapped_at) {
      const snappedAt = new Date(latest.snapped_at)
      const hoursSince = (Date.now() - snappedAt.getTime()) / 3_600_000
      if (hoursSince < 23) return // Already snapped recently
    }

    const since = ago(days)
    const until = ago(1) // yesterday

    const fields = [
      "campaign_id", "campaign_name", "spend", "impressions", "clicks", "reach",
      "actions", "action_values", "purchase_roas", "cpm", "cpc", "ctr",
      "date_start",
    ].join(",")

    const params = new URLSearchParams({
      fields,
      time_range: JSON.stringify({ since, until }),
      level: "campaign",
      time_increment: "1",
      limit: "500",
      access_token: accessToken,
    })

    const data = await metaFetch(`${GRAPH}/${actId}/insights?${params}`, {
      caller: "auto-snapshot",
    })

    const insights: any[] = data.data ?? []
    if (!insights.length) return

    const now = new Date().toISOString()
    const rows = insights.map((ins: any) => {
      const spend       = parseFloat(ins.spend ?? "0") || 0
      const purchases   = parseInt((ins.actions ?? []).find((a: any) => a.action_type === "omni_purchase")?.value ?? "0") || 0
      const purchaseVal = parseFloat((ins.action_values ?? []).find((a: any) => a.action_type === "omni_purchase")?.value ?? "0") || 0
      const leads       = parseInt((ins.actions ?? []).find((a: any) => a.action_type === "lead")?.value ?? "0") || 0
      const atc         = parseInt((ins.actions ?? []).find((a: any) => a.action_type === "add_to_cart")?.value ?? "0") || 0
      const roas        = parseFloat((ins.purchase_roas ?? [])[0]?.value ?? "0") || null
      return {
        org_id:           orgId,
        fb_ad_account_id: actId,
        fb_campaign_id:   ins.campaign_id,
        campaign_name:    ins.campaign_name,
        date:             ins.date_start,
        spend,
        impressions:    parseInt(ins.impressions ?? "0") || 0,
        clicks:         parseInt(ins.clicks ?? "0") || 0,
        reach:          parseInt(ins.reach ?? "0") || 0,
        purchases, purchase_value: purchaseVal, leads, add_to_carts: atc,
        roas, cpa: purchases > 0 ? spend / purchases : null,
        ctr: parseFloat(ins.ctr ?? "0") || 0,
        cpm: parseFloat(ins.cpm ?? "0") || 0,
        cpc: parseFloat(ins.cpc ?? "0") || 0,
        raw_insights: ins,
        snapped_at:   now,
      }
    })

    await db
      .from("campaign_insights_snapshots")
      .upsert(rows, { onConflict: "org_id,fb_campaign_id,date" })

    console.log(`[auto-snapshot] Saved ${rows.length} rows for ${actId}`)
  } catch (err) {
    // Silent — never block the main response
    console.warn("[auto-snapshot] Failed silently:", err)
  }
}
