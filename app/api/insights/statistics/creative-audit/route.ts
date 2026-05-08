import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const GRAPH = "https://graph.facebook.com/v25.0"
const PURCHASE_TYPES = ["offsite_conversion.fb_pixel_purchase", "purchase"]

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

function getActionVal(arr: any[], type?: string): number {
  if (!arr?.length) return 0
  if (type) return parseFloat(arr.find((a: any) => a.action_type === type)?.value || "0")
  return parseFloat(arr[0]?.value || "0")
}

async function fetchCreativesForAdIds(adIds: string[], token: string): Promise<Record<string, any>> {
  const map: Record<string, any> = {}
  if (!adIds.length) return map
  const fields = [
    "creative{",
      "image_url,thumbnail_url,video_id,call_to_action_type,body,",
      "object_story_spec{",
        "video_data{image_url,video_id,message},",
        "link_data{picture,call_to_action,message,child_attachments{picture}},",
        "photo_data{url}",
      "}",
    "},",
    "created_time",
  ].join("")

  for (let i = 0; i < adIds.length; i += 50) {
    const chunk = adIds.slice(i, i + 50)
    try {
      const res  = await fetch(`${GRAPH}/?ids=${chunk.join(",")}&fields=${fields}&access_token=${token}`)
      const data = await res.json()
      if (data && !data.error) {
        for (const [adId, obj] of Object.entries(data as Record<string, any>)) {
          map[adId] = obj
        }
      }
    } catch { /* non-critical */ }
  }
  return map
}

async function fetchVideoPictures(videoIds: string[], token: string): Promise<Record<string, string>> {
  const map: Record<string, string> = {}
  if (!videoIds.length) return map
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50)
    try {
      const res  = await fetch(`${GRAPH}/?ids=${chunk.join(",")}&fields=picture&access_token=${token}`)
      const data = await res.json()
      if (data && !data.error) {
        for (const [vid, obj] of Object.entries(data as Record<string, any>)) {
          if ((obj as any)?.picture) map[vid] = (obj as any).picture
        }
      }
    } catch { /* non-critical */ }
  }
  return map
}

function resolveThumb(c: any): string | null {
  return (
    c?.object_story_spec?.video_data?.image_url ||
    c?.image_url ||
    c?.object_story_spec?.link_data?.picture ||
    c?.object_story_spec?.photo_data?.url ||
    c?.object_story_spec?.link_data?.child_attachments?.[0]?.picture ||
    c?.thumbnail_url ||
    null
  )
}

function resolveVideoId(c: any): string | null {
  return c?.video_id || c?.object_story_spec?.video_data?.video_id || null
}

function resolveFormat(c: any): "Video" | "Carousel" | "Image" {
  if (resolveVideoId(c)) return "Video"
  if (c?.object_story_spec?.link_data?.child_attachments?.length > 0) return "Carousel"
  return "Image"
}

function resolveCta(c: any): string {
  return (
    c?.call_to_action_type ||
    c?.object_story_spec?.link_data?.call_to_action?.type ||
    "UNKNOWN"
  )
}

function resolveBody(c: any): string {
  return (
    c?.body ||
    c?.object_story_spec?.link_data?.message ||
    c?.object_story_spec?.video_data?.message ||
    ""
  )
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
    const campaignId  = sp.get("campaignId") || ""
    if (!adAccountId) return NextResponse.json({ error: "adAccountId required" }, { status: 400 })

    const accountPath  = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const insightsPath = campaignId || accountPath
    const token        = connection.access_token

    // video_3_sec_watched_actions was deprecated — 3-sec views come from actions[action_type="video_view"]
    const videoFields = [
      "video_avg_time_watched_actions",
      "video_p25_watched_actions",
      "video_p50_watched_actions",
      "video_p75_watched_actions",
      "video_p100_watched_actions",
    ].join(",")

    const [adRows, campaignRows] = await Promise.all([
      fetchAllPages(
        `${GRAPH}/${insightsPath}/insights?level=ad&fields=ad_id,ad_name,adset_name,campaign_name,spend,impressions,inline_link_clicks,actions,${videoFields}&date_preset=${datePreset}&sort=spend_descending&limit=200&access_token=${token}`
      ),
      fetchAllPages(
        `${GRAPH}/${accountPath}/insights?level=campaign&fields=campaign_id,campaign_name,spend&date_preset=${datePreset}&sort=spend_descending&limit=100&access_token=${token}`
      ),
    ])

    const uniqueAdIds = [...new Set(adRows.map((r: any) => r.ad_id as string))]
    const creativeMap = await fetchCreativesForAdIds(uniqueAdIds, token)

    // Upgrade video thumbnails
    const videoIdToAdId: Record<string, string> = {}
    for (const adId of uniqueAdIds) {
      const c = creativeMap[adId]?.creative || {}
      const vid = resolveVideoId(c)
      if (vid) videoIdToAdId[vid] = adId
    }
    const videoIds = Object.keys(videoIdToAdId)
    const picMap   = videoIds.length > 0 ? await fetchVideoPictures(videoIds, token) : {}

    // Build thumbMap
    const thumbMap: Record<string, string | null> = {}
    const formatMap: Record<string, "Video" | "Carousel" | "Image"> = {}
    const ctaMap:    Record<string, string>                          = {}

    const bodyMap: Record<string, string> = {}
    for (const adId of uniqueAdIds) {
      const c = creativeMap[adId]?.creative || {}
      thumbMap[adId]  = resolveThumb(c)
      formatMap[adId] = resolveFormat(c)
      ctaMap[adId]    = resolveCta(c)
      bodyMap[adId]   = resolveBody(c)
    }
    for (const [vid, picUrl] of Object.entries(picMap)) {
      const adId = videoIdToAdId[vid]
      if (adId && picUrl) thumbMap[adId] = picUrl
    }

    // Build per-ad data
    const ads = adRows.map((d: any) => {
      const adId       = d.ad_id
      const spend      = parseFloat(d.spend || "0")
      const impressions = parseInt(d.impressions || "0")
      const linkClicks  = parseInt(d.inline_link_clicks || "0")
      const purchases   = (d.actions || []).filter((a: any) => PURCHASE_TYPES.includes(a.action_type))
        .reduce((s: number, a: any) => s + parseFloat(a.value || "0"), 0)

      // 3-sec views = actions where action_type is "video_view"
      const sec3Views  = (d.actions || []).filter((a: any) => a.action_type === "video_view")
        .reduce((s: number, a: any) => s + parseFloat(a.value || "0"), 0)
      const avgWatch   = getActionVal(d.video_avg_time_watched_actions)
      const p25        = getActionVal(d.video_p25_watched_actions)
      const p50        = getActionVal(d.video_p50_watched_actions)
      const p75        = getActionVal(d.video_p75_watched_actions)
      const p100       = getActionVal(d.video_p100_watched_actions)

      const hookRate   = impressions > 0 ? (sec3Views / impressions) * 100 : 0
      const ctr        = impressions > 0 ? (linkClicks / impressions) * 100 : 0
      const cpc        = linkClicks > 0 ? spend / linkClicks : 0
      const cpa        = purchases > 0 ? spend / purchases : 0
      const format     = formatMap[adId] || "Image"
      const cta        = ctaMap[adId] || "UNKNOWN"

      return {
        adId, adName: d.ad_name, adsetName: d.adset_name || "", campaignName: d.campaign_name || "",
        spend, impressions, linkClicks, purchases,
        sec3Views, avgWatch, p25, p50, p75, p100,
        hookRate, ctr, cpc, cpa,
        format, cta,
        body: bodyMap[adId] || "",
        thumbnail: thumbMap[adId] ?? null,
        createdTime: creativeMap[adId]?.created_time || "",
      }
    })

    // Format Mix
    const formatCounts: Record<string, { count: number; spend: number; impressions: number; linkClicks: number }> = {}
    for (const ad of ads) {
      if (!formatCounts[ad.format]) formatCounts[ad.format] = { count: 0, spend: 0, impressions: 0, linkClicks: 0 }
      formatCounts[ad.format].count++
      formatCounts[ad.format].spend       += ad.spend
      formatCounts[ad.format].impressions += ad.impressions
      formatCounts[ad.format].linkClicks  += ad.linkClicks
    }
    const formatMix = Object.entries(formatCounts).map(([format, v]) => ({ format, ...v }))
      .sort((a, b) => b.spend - a.spend)

    // CTA breakdown
    const ctaCounts: Record<string, { cta: string; count: number; spend: number }> = {}
    for (const ad of ads) {
      const k = ad.cta || "UNKNOWN"
      if (!ctaCounts[k]) ctaCounts[k] = { cta: k, count: 0, spend: 0 }
      ctaCounts[k].count++
      ctaCounts[k].spend += ad.spend
    }
    const ctaBreakdown = Object.values(ctaCounts).sort((a, b) => b.spend - a.spend)

    // Video-only metrics
    const videoAds = ads.filter(a => a.format === "Video" && a.impressions > 0)
    const avgHookRate = videoAds.length > 0
      ? videoAds.reduce((s, a) => s + a.hookRate, 0) / videoAds.length : 0
    const avgWatchTime = videoAds.length > 0
      ? videoAds.reduce((s, a) => s + a.avgWatch, 0) / videoAds.length : 0

    // ── Daily CTA spend series ─────────────────────────────────────────────────
    const topCtaKeys = ctaBreakdown.slice(0, 5).map(c => c.cta)
    let ctaDaily: any[] = []
    try {
      const dailyAdRows = await fetchAllPages(
        `${GRAPH}/${insightsPath}/insights?level=ad&fields=ad_id,spend&date_preset=${datePreset}&time_increment=1&sort=spend_descending&limit=500&access_token=${token}`
      )
      const ctaDailyMap: Record<string, Record<string, number>> = {}
      for (const d of dailyAdRows) {
        const cta  = ctaMap[d.ad_id] || "UNKNOWN"
        const date = d.date_start
        if (!ctaDailyMap[date]) ctaDailyMap[date] = {}
        ctaDailyMap[date][cta] = (ctaDailyMap[date][cta] || 0) + parseFloat(d.spend || "0")
      }
      ctaDaily = Object.keys(ctaDailyMap).sort().map(date => {
        const row: Record<string, any> = { date }
        for (const cta of topCtaKeys) row[cta] = ctaDailyMap[date]?.[cta] || 0
        return row
      })
    } catch { /* non-critical */ }

    // ── CTA performance cards (CTR, spend, impressions, count per CTA) ─────────
    const ctaPerfMap: Record<string, { cta: string; spend: number; impressions: number; linkClicks: number; count: number }> = {}
    for (const ad of ads) {
      const k = ad.cta || "UNKNOWN"
      if (!ctaPerfMap[k]) ctaPerfMap[k] = { cta: k, spend: 0, impressions: 0, linkClicks: 0, count: 0 }
      ctaPerfMap[k].spend       += ad.spend
      ctaPerfMap[k].impressions += ad.impressions
      ctaPerfMap[k].linkClicks  += ad.linkClicks
      ctaPerfMap[k].count++
    }
    const ctaPerf = Object.values(ctaPerfMap).map(c => ({
      ...c,
      ctr: c.impressions > 0 ? (c.linkClicks / c.impressions) * 100 : 0,
    })).sort((a, b) => b.spend - a.spend)

    // ── Top performing copy (by impressions, must have body text) ─────────────
    const topCopy = [...ads]
      .filter(a => a.body && a.body.trim().length > 10)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 5)
      .map(a => ({ adId: a.adId, adName: a.adName, body: a.body, impressions: a.impressions, spend: a.spend }))

    // Summary
    const totalSpend      = ads.reduce((s, a) => s + a.spend, 0)
    const totalImpr       = ads.reduce((s, a) => s + a.impressions, 0)
    const totalClicks     = ads.reduce((s, a) => s + a.linkClicks, 0)
    const totalPurchases  = ads.reduce((s, a) => s + a.purchases, 0)
    const activeAdCount   = uniqueAdIds.length

    // Campaign picker
    const campMap: Record<string, { id: string; name: string; spend: number }> = {}
    campaignRows.forEach((r: any) => {
      const k = r.campaign_id
      if (!campMap[k]) campMap[k] = { id: k, name: r.campaign_name, spend: 0 }
      campMap[k].spend += parseFloat(r.spend || "0")
    })
    const campaignList = Object.values(campMap).sort((a, b) => b.spend - a.spend)

    return NextResponse.json({
      ads: ads.slice(0, 200),
      top5: ads.slice(0, 5),
      formatMix,
      ctaBreakdown,
      ctaPerf,
      ctaDaily,
      topCtaKeys,
      topCopy,
      campaignList,
      summary: {
        activeAdCount,
        totalSpend, totalImpr, totalClicks, totalPurchases,
        avgHookRate, avgWatchTime,
        videoAdCount:  videoAds.length,
        imageAdCount:  ads.filter(a => a.format === "Image").length,
        carouselCount: ads.filter(a => a.format === "Carousel").length,
      },
      datePreset,
      filteredCampaignId: campaignId || null,
    })
  } catch (err: any) {
    console.error("[statistics/creative-audit]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
