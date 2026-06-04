import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getDbCachedFacebookMetadata } from "@/app/api/facebook/_db-cache"
import { metaFetch } from "@/app/api/facebook/_meta-fetch"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const GRAPH     = "https://graph.facebook.com/v25.0"
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

function datePresetToRange(preset: string, sinceP: string, untilP: string): { since: string; until: string } {
  if (sinceP && untilP) return { since: sinceP, until: untilP }
  const now   = new Date()
  const today = now.toISOString().split("T")[0]
  const ago   = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().split("T")[0]
  if (preset === "today")      return { since: today, until: today }
  if (preset === "yesterday")  return { since: ago(1), until: ago(1) }
  if (preset === "last_7d")    return { since: ago(7), until: ago(1) }
  if (preset === "last_14d")   return { since: ago(14), until: ago(1) }
  if (preset === "last_28d")   return { since: ago(28), until: ago(1) }
  if (preset === "last_30d")   return { since: ago(30), until: ago(1) }
  if (preset === "last_90d")   return { since: ago(90), until: ago(1) }
  if (preset === "this_month") return { since: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`, until: today }
  if (preset === "last_month") {
    const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const m = now.getMonth() === 0 ? 12 : now.getMonth()
    const last = new Date(y, m, 0)
    return { since: `${y}-${String(m).padStart(2,"0")}-01`, until: last.toISOString().split("T")[0] }
  }
  return { since: ago(30), until: ago(1) }
}

async function loadFromSnapshot(orgId: string, adAccountId: string, since: string, until: string) {
  const db    = createAdminClient()
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`

  const { data, error } = await db
    .from("campaign_insights_snapshots")
    .select("date,spend,impressions,clicks,purchases,purchase_value,leads,roas,cpa,ctr,cpm,cpc")
    .eq("org_id", orgId)
    .eq("fb_ad_account_id", actId)
    .gte("date", since)
    .lte("date", until)
    .order("date", { ascending: true })

  if (error || !data?.length) return null

  const byDate: Record<string, any> = {}
  for (const row of data) {
    if (!byDate[row.date]) byDate[row.date] = { date: row.date, spend: 0, impressions: 0, linkClicks: 0, purchases: 0, purchaseVal: 0, leads: 0 }
    const d = byDate[row.date]
    d.spend       += parseFloat(row.spend ?? "0") || 0
    d.impressions += row.impressions ?? 0
    d.linkClicks  += row.clicks ?? 0
    d.purchases   += row.purchases ?? 0
    d.purchaseVal += parseFloat(row.purchase_value ?? "0") || 0
    d.leads       += row.leads ?? 0
  }

  const dailyStats = Object.values(byDate).map((d: any) => ({
    ...d,
    ctr: d.impressions > 0 ? (d.linkClicks / d.impressions) * 100 : 0,
    cpm: d.impressions > 0 ? (d.spend / d.impressions) * 1000 : 0,
  }))

  let totalSpend = 0, totalImpressions = 0, totalClicks = 0
  let totalPurchases = 0, totalPurchaseValue = 0, totalLeads = 0
  for (const d of dailyStats) {
    totalSpend         += d.spend
    totalImpressions   += d.impressions
    totalClicks        += d.linkClicks
    totalPurchases     += d.purchases
    totalPurchaseValue += d.purchaseVal
    totalLeads         += d.leads
  }

  return {
    totals: {
      spend: totalSpend, impressions: totalImpressions, clicks: totalClicks,
      purchases: totalPurchases, purchaseValue: totalPurchaseValue, leads: totalLeads,
      cpm:    totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
      cpc:    totalClicks > 0 ? totalSpend / totalClicks : 0,
      ctr:    totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      roas:   totalSpend > 0 ? totalPurchaseValue / totalSpend : 0,
      avgPurchaseValue:  totalPurchases > 0 ? totalPurchaseValue / totalPurchases : 0,
      conversionRate:    totalClicks > 0 ? (totalPurchases / totalClicks) * 100 : 0,
      costPerPurchase:   totalPurchases > 0 ? totalSpend / totalPurchases : 0,
    },
    daily: dailyStats,
    fromSnapshot: true,
    snapshotDate: data[data.length - 1]?.date ?? null,
  }
}

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

    const sp          = request.nextUrl.searchParams
    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) {
      const { since, until } = datePresetToRange(
        sp.get("datePreset") || "last_30d",
        sp.get("since") || "", sp.get("until") || ""
      )
      const snapshot = await loadFromSnapshot(ctx.orgId, sp.get("adAccountId") || sp.get("ad_account_id") || "", since, until)
      if (snapshot) return NextResponse.json(snapshot)
      return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })
    }
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
    // Fallback to snapshots on any Meta error
    try {
      const sp2         = request.nextUrl.searchParams
      const adAccountId = sp2.get("adAccountId") || sp2.get("ad_account_id") || ""
      const { since, until } = datePresetToRange(sp2.get("datePreset") || "last_30d", sp2.get("since") || "", sp2.get("until") || "")
      const ctx2 = await getAuthContext()
      if (ctx2 && adAccountId) {
        const snapshot = await loadFromSnapshot(ctx2.orgId, adAccountId, since, until)
        if (snapshot) return NextResponse.json(snapshot)
      }
    } catch {}
    const isRateLimit = err?.name === "MetaRateLimitError"
    return NextResponse.json(
      { error: isRateLimit ? "Meta API rate limit reached. Please wait a moment." : err.message },
      { status: isRateLimit ? 429 : 500 }
    )
  }
}
