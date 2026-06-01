import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { secureMetaFetch, delay } from "@/lib/meta-secure-fetch"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const GRAPH = "https://graph.facebook.com/v25.0"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const sp           = request.nextUrl.searchParams
    const rawIds       = (sp.get("adAccountIds") || sp.get("adAccountId") || "").split(",").filter(Boolean)
    const datePreset   = sp.get("datePreset") || "last_30d"

    if (!rawIds.length) return NextResponse.json({ error: "adAccountIds required" }, { status: 400 })

    const token        = connection.access_token
    const accountPaths = rawIds.map(id => (id.startsWith("act_") ? id : `act_${id}`))

    // Fetch accounts sequentially with delay to avoid Meta rate limit burst
    const accountResults: any[] = []
    for (let idx = 0; idx < accountPaths.length; idx++) {
      const accountPath = accountPaths[idx]
      if (idx > 0) await delay(200) // 200ms between accounts
      const result = await (async () => {
        const [nameRes, totalsRes, dailyRes] = await Promise.all([
          secureMetaFetch(`${GRAPH}/${accountPath}?fields=name&access_token=${token}`),
          secureMetaFetch(`${GRAPH}/${accountPath}/insights?fields=spend,impressions,inline_link_clicks,inline_link_click_ctr,cpm&date_preset=${datePreset}&access_token=${token}`),
          secureMetaFetch(`${GRAPH}/${accountPath}/insights?fields=spend,impressions,inline_link_clicks&date_preset=${datePreset}&time_increment=1&limit=90&access_token=${token}`),
        ])
        const [nameData, totalsData, dailyData]: any[] = await Promise.all([
          nameRes.json(), totalsRes.json(), dailyRes.json(),
        ])

        const t    = totalsData.data?.[0] || {}
        const spend       = parseFloat(t.spend || "0")
        const impressions = parseInt(t.impressions || "0")
        const linkClicks  = parseInt(t.inline_link_clicks || "0")
        const ctr         = impressions > 0 ? (linkClicks / impressions) * 100 : 0
        const cpm         = impressions > 0 ? (spend / impressions) * 1000 : 0

        const daily = (dailyData.data || []).map((d: any) => ({
          date:  d.date_start,
          spend: parseFloat(d.spend || "0"),
          impressions: parseInt(d.impressions || "0"),
          linkClicks:  parseInt(d.inline_link_clicks || "0"),
        }))

        return {
          id:         rawIds[idx],
          accountPath,
          name:       nameData.name || rawIds[idx],
          spend, impressions, linkClicks, ctr, cpm, daily,
          colorIdx:   idx,
        }
      })()
      accountResults.push(result)
    }

    // Build stacked daily (one column per account)
    const allDates = [...new Set(accountResults.flatMap(a => a.daily.map((d: any) => d.date)))].sort()
    const daily = allDates.map(date => {
      const row: Record<string, any> = { date }
      accountResults.forEach(acc => {
        const day = acc.daily.find((d: any) => d.date === date)
        row[acc.name]              = day?.spend       || 0
        row[acc.name + "_impr"]    = day?.impressions || 0
        row[acc.name + "_clicks"]  = day?.linkClicks  || 0
      })
      return row
    })

    const totSpend  = accountResults.reduce((s, a) => s + a.spend, 0)
    const totImpr   = accountResults.reduce((s, a) => s + a.impressions, 0)
    const totClicks = accountResults.reduce((s, a) => s + a.linkClicks, 0)

    return NextResponse.json({
      accounts: accountResults.map(a => ({ ...a, daily: undefined })),
      daily,
      totals: {
        spend:      totSpend,
        impressions: totImpr,
        clicks:     totClicks,
        ctr:        totImpr > 0 ? (totClicks / totImpr) * 100 : 0,
        cpm:        totImpr > 0 ? (totSpend / totImpr) * 1000 : 0,
      },
      datePreset,
    })
  } catch (err: any) {
    console.error("[statistics/all-accounts]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
