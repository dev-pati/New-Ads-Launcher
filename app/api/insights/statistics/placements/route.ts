import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const GRAPH = "https://graph.facebook.com/v25.0"
const PURCHASE_TYPES = ["offsite_conversion.fb_pixel_purchase", "purchase"]

function sumAction(actions: any[], types: string[]) {
  return (actions || []).filter(a => types.includes(a.action_type))
    .reduce((s, a) => s + parseFloat(a.value || "0"), 0)
}

async function fetchAllPages(url: string): Promise<any[]> {
  const rows: any[] = []
  let nextUrl: string | null = url
  let pages = 0
  while (nextUrl && pages < 10) {
    const res  = await fetch(nextUrl)
    const data: any = await res.json()
    if (data.error) throw new Error(data.error.message)
    rows.push(...(data.data || []))
    nextUrl = data.paging?.next || null
    pages++
  }
  return rows
}

// Normalize platform name
function normalizePlatform(p: string) {
  const m: Record<string, string> = {
    facebook: "Facebook", instagram: "Instagram", audience_network: "Audience Network",
    messenger: "Messenger", an: "Audience Network",
  }
  return m[p?.toLowerCase()] || (p ? p.charAt(0).toUpperCase() + p.slice(1) : "Unknown")
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

    const fields = "spend,impressions,inline_link_clicks,actions,action_values,cpm"

    // Fetch in parallel: placement breakdown + publisher_platform breakdown + daily by publisher
    const [placementRows, platformRows, dailyRows] = await Promise.all([
      fetchAllPages(
        `${GRAPH}/${accountPath}/insights?breakdowns=publisher_platform,platform_position&fields=${fields}&date_preset=${datePreset}&sort=spend_descending&limit=100&access_token=${token}`
      ),
      fetchAllPages(
        `${GRAPH}/${accountPath}/insights?breakdowns=publisher_platform&fields=${fields}&date_preset=${datePreset}&sort=spend_descending&limit=20&access_token=${token}`
      ),
      fetchAllPages(
        `${GRAPH}/${accountPath}/insights?breakdowns=publisher_platform&fields=spend,impressions,inline_link_clicks&date_preset=${datePreset}&time_increment=1&sort=spend_descending&limit=200&access_token=${token}`
      ),
    ])

    // Build placements array
    const placements = placementRows.map((d: any) => {
      const spend       = parseFloat(d.spend || "0")
      const impressions = parseInt(d.impressions || "0")
      const linkClicks  = parseInt(d.inline_link_clicks || "0")
      const purchases   = sumAction(d.actions, PURCHASE_TYPES)
      const cpm         = impressions > 0 ? (spend / impressions) * 1000 : 0
      const ctr         = impressions > 0 ? (linkClicks / impressions) * 100 : 0
      const cpc         = linkClicks > 0 ? spend / linkClicks : 0
      const cpa         = purchases > 0 ? spend / purchases : 0
      return {
        platform:  normalizePlatform(d.publisher_platform),
        position:  d.platform_position || "unknown",
        label:     `${normalizePlatform(d.publisher_platform)} — ${d.platform_position || "unknown"}`,
        spend, impressions, linkClicks, purchases, cpm, ctr, cpc, cpa,
      }
    })

    // Build platform summaries
    const platforms = platformRows.map((d: any) => {
      const spend       = parseFloat(d.spend || "0")
      const impressions = parseInt(d.impressions || "0")
      const linkClicks  = parseInt(d.inline_link_clicks || "0")
      const purchases   = sumAction(d.actions, PURCHASE_TYPES)
      const cpm         = impressions > 0 ? (spend / impressions) * 1000 : 0
      const ctr         = impressions > 0 ? (linkClicks / impressions) * 100 : 0
      const cpc         = linkClicks > 0 ? spend / linkClicks : 0
      const cpa         = purchases > 0 ? spend / purchases : 0
      return {
        platform: normalizePlatform(d.publisher_platform),
        spend, impressions, linkClicks, purchases, cpm, ctr, cpc, cpa,
      }
    })

    // Build daily stacked (one column per platform)
    const platformNames = [...new Set(platforms.map(p => p.platform))]
    const allDates = [...new Set(dailyRows.map((d: any) => d.date_start))].sort()
    const daily = allDates.map(date => {
      const row: Record<string, any> = { date }
      dailyRows
        .filter((d: any) => d.date_start === date)
        .forEach((d: any) => {
          const pName = normalizePlatform(d.publisher_platform)
          row[pName]              = (row[pName] || 0) + parseFloat(d.spend || "0")
          row[pName + "_impr"]    = (row[pName + "_impr"] || 0) + parseInt(d.impressions || "0")
          row[pName + "_clicks"]  = (row[pName + "_clicks"] || 0) + parseInt(d.inline_link_clicks || "0")
        })
      return row
    })

    // Summary
    const totalSpend     = platforms.reduce((s, p) => s + p.spend, 0)
    const totalImpr      = platforms.reduce((s, p) => s + p.impressions, 0)
    const totalClicks    = platforms.reduce((s, p) => s + p.linkClicks, 0)
    const totalPurchases = platforms.reduce((s, p) => s + p.purchases, 0)
    const avgCpa         = totalPurchases > 0 ? totalSpend / totalPurchases : 0
    const avgCtr         = totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0
    const topPlacement   = placements[0] || null
    const bestCpaPlacement = placements
      .filter(p => p.purchases > 0 && p.spend > 5)
      .reduce((best, p) => (!best || p.cpa < best.cpa ? p : best), null as typeof placements[0] | null)

    return NextResponse.json({
      placements,
      platforms,
      platformNames,
      daily,
      summary: {
        topPlacement:    topPlacement ? { label: topPlacement.label, spend: topPlacement.spend } : null,
        bestCpaPlacement: bestCpaPlacement ? { label: bestCpaPlacement.label, cpa: bestCpaPlacement.cpa } : null,
        totalSpend,
        totalPurchases,
        avgCpa,
        avgCtr,
      },
      datePreset,
    })
  } catch (err: any) {
    console.error("[statistics/placements]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
