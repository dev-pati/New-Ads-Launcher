import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getDbCachedFacebookMetadata } from "@/app/api/facebook/_db-cache"
import { metaFetch } from "@/app/api/facebook/_meta-fetch"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const GRAPH     = "https://graph.facebook.com/v25.0"
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

function sumAction(actions: any[], types: string[]) {
  return (actions || [])
    .filter(a => types.includes(a.action_type))
    .reduce((s, a) => s + parseFloat(a.value || "0"), 0)
}

function sumActionValue(values: any[], types: string[]) {
  return (values || [])
    .filter(a => types.includes(a.action_type))
    .reduce((s, a) => s + parseFloat(a.value || "0"), 0)
}

const PURCHASE_TYPES = ["offsite_conversion.fb_pixel_purchase", "purchase"]
const LEAD_TYPES     = ["lead", "offsite_conversion.fb_pixel_lead"]

async function fetchAllInsights(url: string): Promise<any[]> {
  const rows: any[] = []
  let nextUrl: string | null = url

  while (nextUrl) {
    const data = await metaFetch(nextUrl, { caller: "insights/metrics" })
    rows.push(...(data.data || []))
    nextUrl = data.paging?.next || null
  }

  return rows
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const sp          = request.nextUrl.searchParams
    const adAccountId = sp.get("adAccountId") || sp.get("ad_account_id") || ""
    const datePreset  = sp.get("datePreset") || "last_30d"
    const since       = sp.get("since") || ""
    const until       = sp.get("until") || ""

    if (!adAccountId) return NextResponse.json({ error: "adAccountId required" }, { status: 400 })

    const accountPath = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const token = connection.access_token

    const dateKey  = since && until ? `tr:${since}_${until}` : `dp:${datePreset}`
    const cacheKey = `insights:metrics:${adAccountId}:${dateKey}`
    const forceRefresh = sp.get("refresh") === "true"

    const result = await getDbCachedFacebookMetadata({
      orgId: ctx.orgId,
      cacheKey,
      ttlMs: CACHE_TTL,
      forceRefresh,
      loader: async () => {
      const fields = [
        "spend", "impressions", "reach",
        "inline_link_clicks", "inline_link_click_ctr",
        "cpm", "actions", "action_values", "cost_per_action_type",
        "frequency", "date_start", "date_stop",
      ].join(",")

      const params = new URLSearchParams({
        fields,
        time_increment: "1",
        limit: "100",
        access_token: token,
      })

      if (since && until) {
        params.set("time_range", JSON.stringify({ since, until }))
      } else {
        params.set("date_preset", datePreset)
      }

      const daily = await fetchAllInsights(`${GRAPH}/${accountPath}/insights?${params}`)

      let totalSpend = 0, totalImpressions = 0, totalLinkClicks = 0
      let totalPurchases = 0, totalPurchaseValue = 0
      let totalLeads = 0

      const dailyStats = daily.map(d => {
        const spend       = parseFloat(d.spend || "0")
        const impressions = parseInt(d.impressions || "0")
        const linkClicks  = parseInt(d.inline_link_clicks || "0")
        const purchases   = sumAction(d.actions, PURCHASE_TYPES)
        const purchaseVal = sumActionValue(d.action_values, PURCHASE_TYPES)
        const leads       = sumAction(d.actions, LEAD_TYPES)
        const cpm         = parseFloat(d.cpm || "0")
        const ctr         = parseFloat(d.inline_link_click_ctr || "0")

        totalSpend        += spend
        totalImpressions  += impressions
        totalLinkClicks   += linkClicks
        totalPurchases    += purchases
        totalPurchaseValue += purchaseVal
        totalLeads        += leads

        return { date: d.date_start, spend, impressions, linkClicks, purchases, purchaseVal, leads, ctr, cpm }
      })

      const avgCTR = totalImpressions > 0 ? (totalLinkClicks / totalImpressions) * 100 : 0
      const avgCPC = totalLinkClicks > 0 ? totalSpend / totalLinkClicks : 0
      const avgCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0
      const avgPurchaseValue = totalPurchases > 0 ? totalPurchaseValue / totalPurchases : 0
      const conversionRate   = totalLinkClicks > 0 ? (totalPurchases / totalLinkClicks) * 100 : 0
      const costPerPurchase  = totalPurchases > 0 ? totalSpend / totalPurchases : 0

      return {
        datePreset,
        totals: {
          spend: totalSpend, impressions: totalImpressions, clicks: totalLinkClicks,
          purchases: totalPurchases, purchaseValue: totalPurchaseValue, leads: totalLeads,
          cpm: avgCPM, cpc: avgCPC, ctr: avgCTR, avgPurchaseValue,
          conversionRate, costPerPurchase,
          roas: totalSpend > 0 ? totalPurchaseValue / totalSpend : 0,
        },
        daily: dailyStats,
      }
      },
    })

    return NextResponse.json({
      ...result.value,
      cached: result.source !== "meta",
      stale: result.stale,
      retryAfterMs: result.retryAfterMs,
    })
  } catch (err: any) {
    console.error("[insights/metrics]", err)
    const isRateLimit = err?.name === "MetaRateLimitError"
    return NextResponse.json(
      { error: isRateLimit ? "Meta API rate limit reached. Please wait a moment." : err.message },
      { status: isRateLimit ? 429 : 500 }
    )
  }
}
