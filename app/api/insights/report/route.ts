import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const GRAPH = "https://graph.facebook.com/v25.0"

function pickResult(actions?: { action_type: string; value: string }[]) {
  if (!actions?.length) return 0
  const priority = [
    "offsite_conversion.fb_pixel_purchase",
    "purchase",
    "lead",
    "complete_registration",
    "landing_page_view",
    "link_click",
    "post_engagement",
  ]
  for (const type of priority) {
    const found = actions.find(a => a.action_type === type)
    if (found) return parseInt(found.value || "0")
  }
  return 0
}

async function batchFetch(token: string, requests: { method: string; relative_url: string }[]) {
  const form = new URLSearchParams()
  form.append("access_token", token)
  form.append("batch", JSON.stringify(requests))
  const res = await fetch(GRAPH, { method: "POST", body: form })
  return res.json() as Promise<Array<{ code: number; body: string }>>
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const sp = request.nextUrl.searchParams
    const adAccountId      = sp.get("adAccountId") || ""
    const datePreset       = sp.get("datePreset") || "last_90d"
    const limit            = Math.min(parseInt(sp.get("limit") || "50"), 50)
    const statusFilter     = sp.get("statusFilter") || ""
    const groupByLP        = sp.get("groupByLandingPage") === "1"
    const createdAfterDays = parseInt(sp.get("createdAfterDays") || "0")
    const frequencyMin     = parseFloat(sp.get("frequencyMin") || "0")

    if (!adAccountId) return NextResponse.json({ error: "adAccountId required" }, { status: 400 })

    const token       = connection.access_token
    const accountPath = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`

    const insightParams = new URLSearchParams({
      level:        "ad",
      fields:       "ad_id,ad_name,adset_name,campaign_name,spend,impressions,inline_link_clicks,inline_link_click_ctr,frequency,reach,cpm,actions,action_values,video_thruplay_watched_actions,date_start,date_stop",
      date_preset:  datePreset,
      sort:         "spend_descending",
      limit:        String(limit),
      access_token: token,
    })

    if (statusFilter) {
      insightParams.append("filtering", JSON.stringify([{
        field: "ad.effective_status", operator: "IN", value: statusFilter.split(","),
      }]))
    }

    const insightRes  = await fetch(`${GRAPH}/${accountPath}/insights?${insightParams}`)
    const insightData = await insightRes.json()

    if (insightData.error) return NextResponse.json({ error: insightData.error.message }, { status: 400 })

    const rows: any[] = insightData.data || []
    if (rows.length === 0) return NextResponse.json({ ads: [] })

    const adIds = rows.map(r => r.ad_id)

    // Step 2: creative + landing page URL + status
    const step2 = await batchFetch(token, adIds.map(id => ({
      method:       "GET",
      relative_url: `${id}?fields=id,name,created_time,effective_status,creative{id,object_type,image_url,thumbnail_url,object_story_spec{link_data{link},video_data{call_to_action{value{link}}}}}`,
    })))

    type AdInfo = {
      creativeId:      string
      objectType:      string
      imageUrl:        string | null
      thumbUrl:        string | null
      createdTime:     string | null
      effectiveStatus: string
      landingPageUrl:  string | null
    }
    const adInfo: Record<string, AdInfo> = {}

    for (let i = 0; i < step2.length; i++) {
      const item = step2[i]
      if (item.code !== 200) continue
      const parsed   = JSON.parse(item.body)
      const creative = parsed.creative || {}
      const linkData = creative.object_story_spec?.link_data
      const videoData = creative.object_story_spec?.video_data
      let landingPageUrl: string | null = null
      if (linkData?.link)                              landingPageUrl = linkData.link
      else if (videoData?.call_to_action?.value?.link) landingPageUrl = videoData.call_to_action.value.link

      adInfo[adIds[i]] = {
        creativeId:      creative.id || "",
        objectType:      (creative.object_type || "IMAGE").toUpperCase(),
        imageUrl:        creative.image_url    || null,
        thumbUrl:        creative.thumbnail_url || null,
        createdTime:     parsed.created_time   || null,
        effectiveStatus: parsed.effective_status || "UNKNOWN",
        landingPageUrl,
      }
    }

    // Step 3: sized thumbnails
    const creativeIds = Object.values(adInfo).map(a => a.creativeId).filter(Boolean)
    const sizedThumbs: Record<string, string> = {}

    if (creativeIds.length > 0) {
      const step3 = await batchFetch(token, creativeIds.map(cid => ({
        method: "GET",
        relative_url: `${cid}?thumbnail_width=600&thumbnail_height=750&fields=thumbnail_url,image_url`,
      })))
      for (let i = 0; i < step3.length; i++) {
        if (step3[i].code !== 200) continue
        const parsed = JSON.parse(step3[i].body)
        const url = parsed.image_url || parsed.thumbnail_url || null
        if (url) sizedThumbs[creativeIds[i]] = url
      }
    }

    const PURCHASE_TYPES = ["offsite_conversion.fb_pixel_purchase", "purchase"]

    let ads = rows.map(r => {
      const info          = adInfo[r.ad_id]
      const spend         = parseFloat(r.spend || "0")
      const results       = pickResult(r.actions)
      const cpr           = results > 0 ? spend / results : 0
      const purchaseValue = ((r.action_values || []) as { action_type: string; value: string }[])
        .filter(a => PURCHASE_TYPES.includes(a.action_type))
        .reduce((s, a) => s + parseFloat(a.value || "0"), 0)
      const purchases     = ((r.actions || []) as { action_type: string; value: string }[])
        .filter(a => PURCHASE_TYPES.includes(a.action_type))
        .reduce((s, a) => s + parseInt(a.value || "0"), 0)
      const roas          = spend > 0 ? purchaseValue / spend : 0
      const impressions   = parseInt(r.impressions || "0")
      const linkClicks    = parseInt(r.inline_link_clicks || "0")
      const avgPV         = purchases > 0 ? purchaseValue / purchases : 0
      const purchaseCR    = impressions > 0 ? (purchases / impressions) * 100 : 0
      const thumbnail     = (info?.creativeId && sizedThumbs[info.creativeId]) || info?.imageUrl || info?.thumbUrl || null
      const video3sViews  = ((r.actions || []) as { action_type: string; value: string }[])
        .filter(a => a.action_type === "video_view")
        .reduce((s, a) => s + parseInt(a.value || "0"), 0)
      const thruplayViews = ((r.video_thruplay_watched_actions || []) as { action_type: string; value: string }[])
        .reduce((s, a) => s + parseInt(a.value || "0"), 0)
      const thumbstopRate = impressions > 0 ? (video3sViews / impressions) * 100 : 0
      const holdRate      = video3sViews > 0 ? (thruplayViews / video3sViews) * 100 : 0

      return {
        adId:            r.ad_id,
        adName:          r.ad_name,
        adsetName:       r.adset_name  || "",
        campaignName:    r.campaign_name || "",
        spend,
        results,
        costPerResult:   cpr,
        purchaseValue,
        roas,
        impressions,
        linkClicks,
        ctr:             parseFloat(r.inline_link_click_ctr || "0"),
        frequency:       parseFloat(r.frequency || "0"),
        reach:           parseInt(r.reach || "0"),
        cpm:             parseFloat(r.cpm || "0"),
        avgPurchaseValue: avgPV,
        purchaseCR,
        dateStart:       r.date_start,
        createdTime:     info?.createdTime     || null,
        landingPageUrl:  info?.landingPageUrl  || null,
        thumbnail,
        isVideo:         info?.objectType === "VIDEO",
        effectiveStatus: info?.effectiveStatus || "UNKNOWN",
        thumbstopRate,
        holdRate,
      }
    })

    if (frequencyMin > 0)     ads = ads.filter(a => a.frequency >= frequencyMin)
    if (createdAfterDays > 0) {
      const cutoff = Date.now() - createdAfterDays * 86_400_000
      ads = ads.filter(a => a.createdTime && new Date(a.createdTime).getTime() >= cutoff)
    }

    if (groupByLP) {
      const map = new Map<string, any>()
      for (const ad of ads) {
        const key = ad.landingPageUrl || "Unknown"
        if (!map.has(key)) {
          map.set(key, { ...ad, adId: `lp:${key}`, adName: key, _cnt: 1 })
        } else {
          const g = map.get(key)
          g.spend          += ad.spend
          g.results        += ad.results
          g.impressions    += ad.impressions
          g.linkClicks     += ad.linkClicks
          g.purchaseValue  += ad.purchaseValue
          g.reach          += ad.reach
          g._cnt++
          g.costPerResult  = g.results > 0 ? g.spend / g.results : 0
          g.roas           = g.spend > 0 ? g.purchaseValue / g.spend : 0
          g.ctr            = g.impressions > 0 ? (g.linkClicks / g.impressions) * 100 : 0
          g.thumbstopRate  = (g.thumbstopRate * (g._cnt - 1) + ad.thumbstopRate) / g._cnt
          g.holdRate       = (g.holdRate * (g._cnt - 1) + ad.holdRate) / g._cnt
          g.adsetName      = `${g._cnt} ads`
        }
      }
      ads = Array.from(map.values())
    }

    ads.sort((a, b) => b.spend - a.spend)
    const ranked = ads.map((a, i) => ({ ...a, rank: i + 1 }))

    return NextResponse.json({ ads: ranked })
  } catch (err: any) {
    console.error("[insights/report]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
