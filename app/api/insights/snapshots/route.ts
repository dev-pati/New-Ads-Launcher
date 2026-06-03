/**
 * GET /api/insights/snapshots
 * Returns campaign performance snapshots from DB (no Meta API call needed).
 * Works even when Meta account is locked/banned.
 * ?ad_account_id=act_xxx&days=30
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthContext }            from "@/lib/auth"
import { createAdminClient }         from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp           = request.nextUrl.searchParams
    const adAccountId  = sp.get("ad_account_id")
    const days         = Math.min(parseInt(sp.get("days") ?? "30"), 365)
    const campaignId   = sp.get("campaign_id")

    const db = createAdminClient()
    const since = new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0]

    let q = db
      .from("campaign_insights_snapshots")
      .select("fb_campaign_id, campaign_name, date, spend, impressions, clicks, purchases, purchase_value, roas, cpa, ctr, cpm, campaign_status, effective_status")
      .eq("org_id", ctx.orgId)
      .gte("date", since)
      .order("date", { ascending: false })
      .limit(1000)

    if (adAccountId) q = q.eq("fb_ad_account_id", adAccountId)
    if (campaignId)  q = q.eq("fb_campaign_id", campaignId)

    const { data, error } = await q
    if (error) throw error

    // Aggregate by campaign
    const byCampaign: Record<string, any> = {}
    for (const row of data ?? []) {
      if (!byCampaign[row.fb_campaign_id]) {
        byCampaign[row.fb_campaign_id] = {
          campaignId:   row.fb_campaign_id,
          campaignName: row.campaign_name,
          status:       row.campaign_status,
          dailyData:    [],
          totals: { spend: 0, impressions: 0, clicks: 0, purchases: 0, purchaseValue: 0 }
        }
      }
      const c = byCampaign[row.fb_campaign_id]
      c.dailyData.push(row)
      c.totals.spend         += parseFloat(row.spend ?? "0") || 0
      c.totals.impressions   += row.impressions ?? 0
      c.totals.clicks        += row.clicks      ?? 0
      c.totals.purchases     += row.purchases   ?? 0
      c.totals.purchaseValue += parseFloat(row.purchase_value ?? "0") || 0
    }

    // Calculate aggregate ROAS/CPA
    for (const c of Object.values(byCampaign) as any[]) {
      c.totals.roas = c.totals.spend > 0 ? c.totals.purchaseValue / c.totals.spend : null
      c.totals.cpa  = c.totals.purchases > 0 ? c.totals.spend / c.totals.purchases : null
    }

    return NextResponse.json({
      campaigns:   Object.values(byCampaign),
      totalRows:   data?.length ?? 0,
      since,
      fromSnapshot: true,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
