/**
 * POST /api/insights/sync-snapshots
 * Manual trigger — snapshot campaign metrics for the last N days.
 * Called from the UI "Sync Now" button.
 * Requires user session (not CRON_SECRET).
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createAdminClient }                     from "@/lib/supabase/admin"
import { buildMetaHeaders }                      from "@/lib/meta-secure-fetch"

export const dynamic     = "force-dynamic"
export const runtime     = "nodejs"
export const maxDuration = 60

const GRAPH = "https://graph.facebook.com/v25.0"

async function metaGet(path: string, token: string) {
  const res  = await fetch(`${GRAPH}${path}`, { headers: buildMetaHeaders(token) })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message ?? "Meta API error")
  return data
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body        = await request.json().catch(() => ({}))
    const days        = Math.min(parseInt(body.days ?? "7"), 90)
    const adAccountId = body.adAccountId

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection?.access_token) {
      return NextResponse.json({ error: "Facebook not connected" }, { status: 401 })
    }

    const db  = createAdminClient()
    const now = new Date()

    // Get ad accounts to sync
    let q = db.from("ad_accounts").select("fb_ad_account_id").eq("org_id", ctx.orgId)
    if (adAccountId) q = q.eq("fb_ad_account_id", adAccountId)
    const { data: adAccounts } = await q

    if (!adAccounts?.length) return NextResponse.json({ error: "No ad accounts found" }, { status: 404 })

    let totalCampaigns = 0
    const errors: string[] = []

    for (const { fb_ad_account_id } of adAccounts) {
      try {
        const since = new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0]
        const until = new Date(Date.now() - 86_400_000).toISOString().split("T")[0] // yesterday

        const fields = [
          "campaign_id", "campaign_name", "spend", "impressions", "clicks", "reach",
          "actions", "action_values", "purchase_roas", "cpm", "cpc", "ctr",
          "date_start",
        ].join(",")

        const data = await metaGet(
          `/${fb_ad_account_id}/insights?fields=${encodeURIComponent(fields)}&time_range={"since":"${since}","until":"${until}"}&level=campaign&time_increment=1&limit=200`,
          connection.access_token
        )

        const insights: any[] = data.data ?? []
        if (!insights.length) continue

        const rows = insights.map((ins: any) => {
          const spend       = parseFloat(ins.spend ?? "0") || 0
          const purchases   = parseInt((ins.actions ?? []).find((a: any) => a.action_type === "omni_purchase")?.value ?? "0") || 0
          const purchaseVal = parseFloat((ins.action_values ?? []).find((a: any) => a.action_type === "omni_purchase")?.value ?? "0") || 0
          const leads       = parseInt((ins.actions ?? []).find((a: any) => a.action_type === "lead")?.value ?? "0") || 0
          const atc         = parseInt((ins.actions ?? []).find((a: any) => a.action_type === "add_to_cart")?.value ?? "0") || 0
          const roas        = parseFloat((ins.purchase_roas ?? [])[0]?.value ?? "0") || null
          const cpa         = purchases > 0 ? spend / purchases : null

          return {
            org_id:           ctx.orgId,
            fb_ad_account_id,
            fb_campaign_id:   ins.campaign_id,
            campaign_name:    ins.campaign_name,
            date:             ins.date_start,
            spend, impressions: parseInt(ins.impressions ?? "0") || 0,
            clicks: parseInt(ins.clicks ?? "0") || 0,
            reach:  parseInt(ins.reach ?? "0") || 0,
            purchases, purchase_value: purchaseVal, leads, add_to_carts: atc,
            roas, cpa,
            ctr: parseFloat(ins.ctr ?? "0") || 0,
            cpm: parseFloat(ins.cpm ?? "0") || 0,
            cpc: parseFloat(ins.cpc ?? "0") || 0,
            raw_insights: ins,
            snapped_at: now.toISOString(),
          }
        })

        await db.from("campaign_insights_snapshots")
          .upsert(rows, { onConflict: "org_id,fb_campaign_id,date" })

        totalCampaigns += rows.length
      } catch (err: any) {
        errors.push(`${fb_ad_account_id}: ${err.message}`)
      }
    }

    return NextResponse.json({
      ok: errors.length === 0,
      totalCampaigns,
      days,
      errors,
      message: `Synced ${totalCampaigns} campaign-day records for last ${days} days`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
