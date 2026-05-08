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

/**
 * Fetch ad creatives for a specific set of ad IDs using the multi-object IDs API.
 * This is the only reliable approach: we fetch EXACTLY the ads we need, regardless
 * of how many total ads exist in the account.
 */
async function fetchCreativesForAdIds(
  adIds: string[],
  token: string
): Promise<Record<string, any>> {
  const map: Record<string, any> = {}
  if (!adIds.length) return map

  const fields = [
    "creative{",
      "image_url,",
      "thumbnail_url,",
      "video_id,",
      "object_story_spec{",
        "video_data{image_url,video_id},",
        "link_data{picture,child_attachments{picture}},",
        "photo_data{url}",
      "}",
    "},",
    "created_time",
  ].join("")

  // Process in chunks of 50 to respect URL length limits
  for (let i = 0; i < adIds.length; i += 50) {
    const chunk = adIds.slice(i, i + 50)
    try {
      const res  = await fetch(`${GRAPH}/?ids=${chunk.join(",")}&fields=${fields}&access_token=${token}`)
      const data = await res.json()
      if (data && !data.error) {
        // Response is { ad_id: { creative: {...}, created_time: "..." }, ... }
        for (const [adId, obj] of Object.entries(data as Record<string, any>)) {
          map[adId] = obj
        }
      }
    } catch {
      // Non-critical: thumbnails degrade gracefully
    }
  }
  return map
}

/**
 * Batch-fetch high-quality video pictures via the multi-object IDs API.
 * Returns { video_id → picture_url }.
 */
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
          if (obj?.picture) map[vid] = obj.picture
        }
      }
    } catch {
      // Fall back to lower-quality thumbnail
    }
  }
  return map
}

/**
 * Resolve the best thumbnail URL from a creative object.
 * Priority (high → low quality):
 *   1. object_story_spec.video_data.image_url  — stored with video creative
 *   2. image_url                               — full-res for image ads
 *   3. object_story_spec.link_data.picture     — OG image for link ads (~1200px)
 *   4. object_story_spec.photo_data.url        — photo ads
 *   5. child_attachments[0].picture            — first carousel card
 *   6. thumbnail_url                           — last resort (usually ~100px)
 */
function resolveThumbUrl(c: any): string | null {
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

function monthLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z")
  return d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
}
function monthKey(dateStr: string) {
  return dateStr.substring(0, 7)
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

    // ── Step 1: Fetch insights + campaign list in parallel ─────────────────
    const [adRows, campaignRows] = await Promise.all([
      fetchAllPages(
        `${GRAPH}/${insightsPath}/insights?level=ad&fields=ad_id,ad_name,adset_name,campaign_name,spend,impressions,inline_link_clicks,inline_link_click_ctr,actions&date_preset=${datePreset}&time_increment=monthly&sort=spend_descending&limit=200&access_token=${token}`
      ),
      fetchAllPages(
        `${GRAPH}/${accountPath}/insights?level=campaign&fields=campaign_id,campaign_name,spend&date_preset=${datePreset}&sort=spend_descending&limit=100&access_token=${token}`
      ),
    ])

    // ── Step 2: Targeted creative fetch — only the ad IDs we actually need ─
    // This is the key fix: instead of fetching ALL ads from the account and
    // hoping the ones we need are within the first N results, we fetch exactly
    // the ad IDs that appear in the insights data. No misses, no account size
    // dependency, no pagination limit surprises.
    const uniqueAdIds = [...new Set(adRows.map((r: any) => r.ad_id as string))]
    const creativeMap = await fetchCreativesForAdIds(uniqueAdIds, token)

    // ── Step 3: Build thumbnail map ────────────────────────────────────────
    const thumbMap:      Record<string, string | null> = {}
    const videoMap:      Record<string, boolean>       = {}
    const createdMap:    Record<string, string>        = {}
    const videoIdToAdId: Record<string, string>        = {}

    for (const adId of uniqueAdIds) {
      const obj = creativeMap[adId] || {}
      const c   = obj.creative || {}
      const vid = resolveVideoId(c)

      thumbMap[adId]   = resolveThumbUrl(c)
      videoMap[adId]   = !!vid
      createdMap[adId] = obj.created_time || ""

      if (vid) videoIdToAdId[vid] = adId
    }

    // ── Step 4: Upgrade video ads with high-res pictures ───────────────────
    // The /{video_id}?fields=picture endpoint gives ~400px CDN thumbnails —
    // significantly better than the ~100px thumbnail_url from creative.
    const videoIds = Object.keys(videoIdToAdId)
    if (videoIds.length > 0) {
      const picMap = await fetchVideoPictures(videoIds, token)
      for (const [vid, picUrl] of Object.entries(picMap)) {
        const adId = videoIdToAdId[vid]
        if (adId && picUrl) thumbMap[adId] = picUrl
      }
    }

    // ── Step 5: Group insights by month ────────────────────────────────────
    type AdEntry = {
      adId: string; adName: string; adsetName: string; campaignName: string
      spend: number; impressions: number; linkClicks: number; ctr: number; cpc: number
      thumbnail: string | null; isVideo: boolean; createdTime: string
    }
    type MonthBucket = {
      monthKey: string; monthLabel: string; dateStart: string
      totalSpend: number; totalImpressions: number; totalClicks: number; ctr: number; cpc: number
      ads: AdEntry[]
    }

    const monthMap: Record<string, MonthBucket> = {}

    for (const d of adRows) {
      const mKey = monthKey(d.date_start)
      if (!monthMap[mKey]) {
        monthMap[mKey] = {
          monthKey: mKey,
          monthLabel: monthLabel(d.date_start),
          dateStart: d.date_start,
          totalSpend: 0, totalImpressions: 0, totalClicks: 0, ctr: 0, cpc: 0,
          ads: [],
        }
      }
      const spend       = parseFloat(d.spend || "0")
      const impressions = parseInt(d.impressions || "0")
      const linkClicks  = parseInt(d.inline_link_clicks || "0")

      monthMap[mKey].totalSpend      += spend
      monthMap[mKey].totalImpressions += impressions
      monthMap[mKey].totalClicks     += linkClicks

      monthMap[mKey].ads.push({
        adId:         d.ad_id,
        adName:       d.ad_name,
        adsetName:    d.adset_name || "",
        campaignName: d.campaign_name || "",
        spend,
        impressions,
        linkClicks,
        ctr:        impressions > 0 ? (linkClicks / impressions) * 100 : 0,
        cpc:        linkClicks  > 0 ? spend / linkClicks : 0,
        thumbnail:  thumbMap[d.ad_id] ?? null,
        isVideo:    videoMap[d.ad_id] ?? false,
        createdTime: createdMap[d.ad_id] || "",
      })
    }

    const months: MonthBucket[] = Object.values(monthMap)
      .sort((a, b) => b.dateStart.localeCompare(a.dateStart))
      .map(m => {
        m.ads.sort((a, b) => b.spend - a.spend)
        m.ctr = m.totalImpressions > 0 ? (m.totalClicks / m.totalImpressions) * 100 : 0
        m.cpc = m.totalClicks > 0 ? m.totalSpend / m.totalClicks : 0
        return m
      })

    // ── Campaign picker list ────────────────────────────────────────────────
    const campMap: Record<string, { id: string; name: string; spend: number }> = {}
    for (const r of campaignRows) {
      const k = r.campaign_id
      if (!campMap[k]) campMap[k] = { id: r.campaign_id, name: r.campaign_name, spend: 0 }
      campMap[k].spend += parseFloat(r.spend || "0")
    }
    const campaignList = Object.values(campMap).sort((a, b) => b.spend - a.spend)

    const totalSpend    = months.reduce((s, m) => s + m.totalSpend, 0)
    const uniqueAdCount = uniqueAdIds.length

    return NextResponse.json({
      months,
      campaignList,
      summary: {
        totalSpend,
        monthCount:        months.length,
        uniqueAdCount,
        avgSpendPerMonth:  months.length > 0 ? totalSpend / months.length : 0,
      },
      datePreset,
      filteredCampaignId: campaignId || null,
    })
  } catch (err: any) {
    console.error("[statistics/ad-history]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
