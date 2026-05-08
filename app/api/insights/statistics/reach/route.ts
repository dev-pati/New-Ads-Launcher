import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const GRAPH = "https://graph.facebook.com/v25.0"

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

function monthKey(d: string)   { return d.substring(0, 7) }
function monthLabel(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const sp          = request.nextUrl.searchParams
    const adAccountId = sp.get("adAccountId") || ""
    const datePreset  = sp.get("datePreset") || "last_90d"
    const campaignId  = sp.get("campaignId") || ""
    if (!adAccountId) return NextResponse.json({ error: "adAccountId required" }, { status: 400 })

    const accountPath  = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const insightsPath = campaignId || accountPath
    const token        = connection.access_token

    const [monthlyRows, campaignRows] = await Promise.all([
      fetchAllPages(
        `${GRAPH}/${insightsPath}/insights?fields=reach,frequency,impressions,spend&date_preset=${datePreset}&time_increment=monthly&limit=200&access_token=${token}`
      ),
      fetchAllPages(
        `${GRAPH}/${accountPath}/insights?level=campaign&fields=campaign_id,campaign_name,spend&date_preset=${datePreset}&sort=spend_descending&limit=100&access_token=${token}`
      ),
    ])

    // Aggregate by month
    type MonthEntry = {
      key: string; label: string; dateStart: string
      reach: number; impressions: number; spend: number; frequency: number
      cumulativeReach: number
    }
    const mMap: Record<string, Omit<MonthEntry, "cumulativeReach">> = {}
    for (const d of monthlyRows) {
      const k = monthKey(d.date_start)
      if (!mMap[k]) mMap[k] = { key: k, label: monthLabel(d.date_start), dateStart: d.date_start, reach: 0, impressions: 0, spend: 0, frequency: 0 }
      mMap[k].reach       += parseInt(d.reach || "0")
      mMap[k].impressions += parseInt(d.impressions || "0")
      mMap[k].spend       += parseFloat(d.spend || "0")
    }

    const sortedMonths = Object.values(mMap).sort((a, b) => a.dateStart.localeCompare(b.dateStart))

    // Recalculate frequency = impressions / reach (more accurate than raw value)
    // and add cumulative reach
    let cumulative = 0
    const months: MonthEntry[] = sortedMonths.map(m => {
      cumulative += m.reach
      return {
        ...m,
        frequency:       m.reach > 0 ? m.impressions / m.reach : 0,
        cumulativeReach: cumulative,
      }
    })

    // Summary KPIs
    const totalReach       = cumulative
    const totalImpressions = months.reduce((s, m) => s + m.impressions, 0)
    const totalSpend       = months.reduce((s, m) => s + m.spend, 0)
    const avgFrequency     = totalReach > 0 ? totalImpressions / totalReach : 0

    // Month-over-month net new reach (last two months)
    const lastMonth  = months[months.length - 1] || null
    const prevMonth  = months[months.length - 2] || null
    const netNewReach = lastMonth && prevMonth ? lastMonth.reach - prevMonth.reach : null

    // Average % net new reach (excluding first month)
    const avgNetNewPct = months.length >= 2
      ? months.slice(1).reduce((sum, m, i) => {
          const prev = months[i]
          if (!prev || prev.reach === 0) return sum
          return sum + ((m.reach - prev.reach) / prev.reach) * 100
        }, 0) / (months.length - 1)
      : 0

    // Campaign picker
    const campMap: Record<string, { id: string; name: string; spend: number }> = {}
    campaignRows.forEach((r: any) => {
      const k = r.campaign_id
      if (!campMap[k]) campMap[k] = { id: k, name: r.campaign_name, spend: 0 }
      campMap[k].spend += parseFloat(r.spend || "0")
    })
    const campaignList = Object.values(campMap).sort((a, b) => b.spend - a.spend)

    return NextResponse.json({
      months,
      campaignList,
      summary: {
        totalReach,
        totalImpressions,
        totalSpend,
        avgFrequency,
        monthCount:      months.length,
        netNewReach,
        avgNetNewPct,
        lastMonthReach:  lastMonth?.reach || 0,
      },
      datePreset,
      filteredCampaignId: campaignId || null,
    })
  } catch (err: any) {
    console.error("[statistics/reach]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
