import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { adsetSnapshotFallback, datePresetToRange } from "@/lib/snapshot-fallback"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const GRAPH = "https://graph.facebook.com/v25.0"
const PURCHASE_TYPES = ["offsite_conversion.fb_pixel_purchase", "purchase"]
const LEAD_TYPES     = ["lead", "offsite_conversion.fb_pixel_lead"]
const RESULT_TYPES   = [...PURCHASE_TYPES, ...LEAD_TYPES, "complete_registration", "landing_page_view"]

function pickResults(actions: any[]) {
  if (!actions?.length) return 0
  for (const t of RESULT_TYPES) {
    const f = actions.find((a: any) => a.action_type === t)
    if (f) return Math.round(parseFloat(f.value || "0"))
  }
  return 0
}

async function fetchAllPages(url: string): Promise<any[]> {
  const rows: any[] = []
  let nextUrl: string | null = url
  while (nextUrl) {
    const res  = await fetch(nextUrl)
    const data: any = await res.json()
    if (data.error) throw new Error(data.error.message)
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
    const adAccountId = sp.get("adAccountId") || ""
    const datePreset  = sp.get("datePreset") || "last_30d"
    if (!adAccountId) return NextResponse.json({ error: "adAccountId required" }, { status: 400 })

    const accountPath = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const token       = connection.access_token

    // Parallel: campaign insights + adset insights + campaign structure + daily per campaign
    const [campRows, adsetRows, campStructRows, dailyRows] = await Promise.all([
      // Campaign-level totals
      fetchAllPages(`${GRAPH}/${accountPath}/insights?level=campaign&fields=campaign_id,campaign_name,objective,spend,impressions,inline_link_clicks,inline_link_click_ctr,actions,cost_per_action_type&date_preset=${datePreset}&sort=spend_descending&limit=50&access_token=${token}`),
      // Adset-level for tree
      fetchAllPages(`${GRAPH}/${accountPath}/insights?level=adset&fields=campaign_id,adset_id,adset_name,spend,impressions,inline_link_clicks,actions&date_preset=${datePreset}&sort=spend_descending&limit=100&access_token=${token}`),
      // Campaign structure (status)
      fetchAllPages(`${GRAPH}/${accountPath}/campaigns?fields=id,name,objective,effective_status&limit=100&access_token=${token}`),
      // Daily per campaign for chart
      fetchAllPages(`${GRAPH}/${accountPath}/insights?level=campaign&fields=campaign_id,campaign_name,spend&date_preset=${datePreset}&time_increment=1&sort=spend_descending&limit=90&access_token=${token}`),
    ])

    // Build campaign status map
    const campStatusMap: Record<string, string> = {}
    campStructRows.forEach((c: any) => { campStatusMap[c.id] = c.effective_status })

    // Build adset map grouped by campaign_id
    const adsetByCamp: Record<string, any[]> = {}
    adsetRows.forEach((a: any) => {
      if (!adsetByCamp[a.campaign_id]) adsetByCamp[a.campaign_id] = []
      adsetByCamp[a.campaign_id].push({
        id:         a.adset_id,
        name:       a.adset_name,
        spend:      parseFloat(a.spend || "0"),
        impressions: parseInt(a.impressions || "0"),
        linkClicks: parseInt(a.inline_link_clicks || "0"),
        results:    pickResults(a.actions),
      })
    })

    // Build campaigns array
    const campaigns = campRows.map((c: any) => {
      const spend      = parseFloat(c.spend || "0")
      const impressions = parseInt(c.impressions || "0")
      const linkClicks = parseInt(c.inline_link_clicks || "0")
      const results    = pickResults(c.actions)
      const cpa        = results > 0 ? spend / results : 0
      const ctr        = parseFloat(c.inline_link_click_ctr || "0")
      const adsets     = adsetByCamp[c.campaign_id] || []
      return {
        id:         c.campaign_id,
        name:       c.campaign_name,
        objective:  c.objective || "—",
        status:     campStatusMap[c.campaign_id] || "unknown",
        spend, impressions, linkClicks, ctr, results, cpa,
        adsets,
      }
    })

    // Stacked daily chart (top 5 campaigns by spend to avoid chart clutter)
    const topCampaignNames = campaigns.slice(0, 5).map(c => c.name)
    const allDates = [...new Set(dailyRows.map((d: any) => d.date_start))].sort()
    const daily = allDates.map(date => {
      const row: Record<string, any> = { date }
      dailyRows
        .filter((d: any) => d.date_start === date && topCampaignNames.includes(d.campaign_name))
        .forEach((d: any) => { row[d.campaign_name] = parseFloat(d.spend || "0") })
      return row
    })

    const totalSpend   = campaigns.reduce((s, c) => s + c.spend, 0)
    const totalResults = campaigns.reduce((s, c) => s + c.results, 0)
    const noResults    = campaigns.filter(c => c.results === 0).length

    return NextResponse.json({
      campaigns,
      daily,
      topCampaignNames,
      totals: {
        campaigns:    campaigns.length,
        adsets:       Object.values(adsetByCamp).flat().length,
        spend:        totalSpend,
        results:      totalResults,
        noResults,
        avgCpa:       totalResults > 0 ? totalSpend / totalResults : 0,
      },
      datePreset,
    })
  } catch (err: any) {
    console.error("[statistics/spend]", err)
    try {
      const sp2 = request.nextUrl.searchParams
      const ctx2 = await getAuthContext()
      const adAccountId = sp2.get("adAccountId") || ""
      if (ctx2 && adAccountId) {
        const { since, until } = datePresetToRange(sp2.get("datePreset") || "last_30d")
        const snapshot = await adsetSnapshotFallback(ctx2.orgId, adAccountId, since, until)
        if (snapshot) return NextResponse.json(snapshot)
      }
    } catch {}
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
