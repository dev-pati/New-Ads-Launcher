import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { breakdownSnapshotFallback, datePresetToRange } from "@/lib/snapshot-fallback"

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

function deviceLabel(d: string) {
  const map: Record<string, string> = {
    desktop:            "Desktop",
    mobile_app:         "Mobile App",
    mobile_web:         "Mobile Web",
    tablet:             "Tablet",
    connected_tv:       "Connected TV",
    unknown:            "Unknown",
    iphone:             "iPhone",
    ipad:               "iPad",
    ipod:               "iPod",
    android_smartphone: "Android Smartphone",
    android_tablet:     "Android Tablet",
    other:              "Other",
  }
  return map[d?.toLowerCase()] || (d ? d.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Unknown")
}

function deviceIcon(d: string) {
  const map: Record<string, string> = {
    desktop: "monitor", mobile_app: "smartphone", mobile_web: "smartphone",
    tablet: "tablet", connected_tv: "tv", unknown: "help-circle",
  }
  return map[d?.toLowerCase()] || "device"
}

function getPreviousPeriodRange(datePreset: string): { since: string; until: string } | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let days = 0
  if      (datePreset === "last_7d")  days = 7
  else if (datePreset === "last_30d") days = 30
  else if (datePreset === "last_90d") days = 90
  else return null

  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  // Previous period: [today - 2*days, today - days - 1]
  const prevUntil = new Date(today)
  prevUntil.setDate(prevUntil.getDate() - days - 1)
  const prevSince = new Date(today)
  prevSince.setDate(prevSince.getDate() - 2 * days)
  return { since: fmt(prevSince), until: fmt(prevUntil) }
}

function aggregateByDevice(rows: any[]) {
  const map: Record<string, { spend: number; impressions: number; linkClicks: number; purchases: number }> = {}
  for (const d of rows) {
    const key = d.impression_device || "unknown"
    if (!map[key]) map[key] = { spend: 0, impressions: 0, linkClicks: 0, purchases: 0 }
    map[key].spend       += parseFloat(d.spend || "0")
    map[key].impressions += parseInt(d.impressions || "0")
    map[key].linkClicks  += parseInt(d.inline_link_clicks || "0")
    map[key].purchases   += sumAction(d.actions, PURCHASE_TYPES)
  }
  return map
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
    const fields      = "spend,impressions,inline_link_clicks,actions"

    const prevRange = getPreviousPeriodRange(datePreset)
    const prevUrl   = prevRange
      ? `${GRAPH}/${accountPath}/insights?breakdowns=impression_device&fields=${fields}&time_range=${encodeURIComponent(JSON.stringify(prevRange))}&limit=100&access_token=${token}`
      : null

    const [currentRows, prevRows] = await Promise.all([
      fetchAllPages(`${GRAPH}/${accountPath}/insights?breakdowns=impression_device&fields=${fields}&date_preset=${datePreset}&limit=100&access_token=${token}`),
      prevUrl ? fetchAllPages(prevUrl).catch(() => []) : Promise.resolve([]),
    ])

    const currMap = aggregateByDevice(currentRows)
    const prevMap = aggregateByDevice(prevRows)

    const devices = Object.entries(currMap).map(([key, c]) => {
      const prev      = prevMap[key] || { spend: 0, impressions: 0, linkClicks: 0, purchases: 0 }
      const ctr       = c.impressions > 0 ? (c.linkClicks / c.impressions) * 100 : 0
      const cpc       = c.linkClicks  > 0 ? c.spend / c.linkClicks : 0
      const cpa       = c.purchases   > 0 ? c.spend / c.purchases : 0
      const cpm       = c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0
      const spendDelta = prev.spend > 0 ? ((c.spend - prev.spend) / prev.spend) * 100 : null
      return {
        device: key, label: deviceLabel(key), icon: deviceIcon(key),
        ...c, ctr, cpc, cpa, cpm,
        prevSpend: prev.spend, prevImpressions: prev.impressions,
        spendDelta,
      }
    }).sort((a, b) => b.spend - a.spend)

    const totalSpend     = devices.reduce((s, d) => s + d.spend, 0)
    const totalImpr      = devices.reduce((s, d) => s + d.impressions, 0)
    const totalClicks    = devices.reduce((s, d) => s + d.linkClicks, 0)
    const totalPurchases = devices.reduce((s, d) => s + d.purchases, 0)
    const avgCpa         = totalPurchases > 0 ? totalSpend / totalPurchases : 0
    const topDevice      = devices[0] || null

    // Build daily spend by device for trend chart
    const [dailyRows] = await Promise.all([
      fetchAllPages(`${GRAPH}/${accountPath}/insights?breakdowns=impression_device&fields=spend,impressions&date_preset=${datePreset}&time_increment=1&limit=500&access_token=${token}`).catch(() => []),
    ])
    const allDates   = [...new Set(dailyRows.map((d: any) => d.date_start))].sort()
    const deviceKeys = Object.keys(currMap)
    const daily = allDates.map(date => {
      const row: Record<string, any> = { date }
      dailyRows.filter((d: any) => d.date_start === date).forEach((d: any) => {
        const k = d.impression_device || "unknown"
        row[deviceLabel(k)] = (row[deviceLabel(k)] || 0) + parseFloat(d.spend || "0")
      })
      return row
    })

    return NextResponse.json({
      devices,
      daily,
      deviceKeys: deviceKeys.map(k => ({ key: k, label: deviceLabel(k) })),
      summary: {
        totalSpend, totalImpr, totalClicks, totalPurchases, avgCpa,
        topDevice: topDevice
          ? { label: topDevice.label, spend: topDevice.spend, pct: totalSpend > 0 ? (topDevice.spend / totalSpend) * 100 : 0 }
          : null,
      },
      datePreset,
      hasPrevious: prevRange !== null,
    })
  } catch (err: any) {
    console.error("[statistics/device]", err)
    try {
      const sp2 = request.nextUrl.searchParams
      const ctx2 = await getAuthContext()
      const adAccountId = sp2.get("adAccountId") || ""
      if (ctx2 && adAccountId) {
        const { since, until } = datePresetToRange(sp2.get("datePreset") || "last_30d")
        const snapshot = await breakdownSnapshotFallback(ctx2.orgId, adAccountId, since, until, ["device", "publisher_platform"])
        if (snapshot) return NextResponse.json(snapshot)
      }
    } catch {}
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
