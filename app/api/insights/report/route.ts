import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getDbCachedFacebookMetadata } from "../../facebook/_db-cache"

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
    const adAccountId = sp.get("adAccountId") || ""
    const datePreset  = sp.get("datePreset") || "last_90d"
    const limit       = Math.min(parseInt(sp.get("limit") || "50"), 50)

    if (!adAccountId) return NextResponse.json({ error: "adAccountId required" }, { status: 400 })

    const token       = connection.access_token
    const accountPath = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`

    // ── Cached fetch ── key excludes section-specific params so all sections share one cache entry
    const forceRefresh = sp.get("refresh") === "true"
    const cacheKey = `insights:report:${adAccountId}:${datePreset}:limit:${limit}`
    const result = await getDbCachedFacebookMetadata({
      orgId: ctx.orgId,
      cacheKey,
      ttlMs: 15 * 60_000,
      forceRefresh,
      loader: async () => {
      const insightParams = new URLSearchParams({
        level:        "ad",
        fields:       "ad_id,ad_name,adset_name,campaign_name,spend,impressions,inline_link_clicks,inline_link_click_ctr,outbound_clicks,frequency,reach,cpm,actions,action_values,video_thruplay_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p95_watched_actions,video_p100_watched_actions,video_30_sec_watched_actions,video_avg_time_watched_actions,date_start,date_stop",
        date_preset:  datePreset,
        sort:         "spend_descending",
        limit:        String(limit),
        access_token: token,
      })
      // No statusFilter — all statuses fetched; filtering is done client-side per section

      const insightRes  = await fetch(`${GRAPH}/${accountPath}/insights?${insightParams}`)
      const insightData = await insightRes.json()

      if (insightData.error) throw new Error(insightData.error.message)

      const rows: any[] = insightData.data || []
      if (rows.length === 0) return []

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

    const rawAds = rows.map(r => {
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

      const getAct = (type: string) =>
        parseInt(((r.actions || []) as any[]).find((a: any) => a.action_type === type)?.value || "0")

      const video3sViews  = getAct("video_view")
      const thruplayViews = ((r.video_thruplay_watched_actions || []) as any[])
        .reduce((s: number, a: any) => s + parseInt(a.value || "0"), 0)
      const thumbstopRate = impressions > 0 ? (video3sViews / impressions) * 100 : 0
      const holdRate      = video3sViews > 0 ? (thruplayViews / video3sViews) * 100 : 0

      const videoP25      = parseInt(r.video_p25_watched_actions?.[0]?.value  || "0")
      const videoP50      = parseInt(r.video_p50_watched_actions?.[0]?.value  || "0")
      const videoP75      = parseInt(r.video_p75_watched_actions?.[0]?.value  || "0")
      const videoP95      = parseInt(r.video_p95_watched_actions?.[0]?.value  || "0")
      const videoP100     = parseInt(r.video_p100_watched_actions?.[0]?.value || "0")
      const video30s      = parseInt(r.video_30_sec_watched_actions?.[0]?.value || "0")
      const avgWatchTime  = parseFloat(r.video_avg_time_watched_actions?.[0]?.value || "0")
      const outboundClicks = parseInt(r.outbound_clicks?.[0]?.value || "0")

      const leads             = getAct("lead")
      const registrations     = getAct("complete_registration")
      const contentViews      = getAct("offsite_conversion.fb_pixel_view_content")
      const addToCart         = getAct("offsite_conversion.fb_pixel_add_to_cart")
      const appInstalls       = getAct("mobile_app_install") || getAct("app_install")
      const appActivations    = getAct("app_activation")
      const postEngagements   = getAct("post_engagement")
      const postReactions     = getAct("post_reaction")
      const pageEngagements   = getAct("page_engagement")
      const like              = getAct("like")
      const comment           = getAct("comment")
      const initiateCheckout  = getAct("offsite_conversion.fb_pixel_initiate_checkout") || getAct("initiate_checkout")
      const addPaymentInfo    = getAct("offsite_conversion.fb_pixel_add_payment_info") || getAct("add_payment_info")
      const reach             = parseInt(r.reach || "0")
      const ctr               = parseFloat(r.inline_link_click_ctr || "0")

      return {
        adId:            r.ad_id,
        adName:          r.ad_name,
        adsetName:       r.adset_name  || "",
        campaignName:    r.campaign_name || "",
        spend,
        results,
        costPerResult:   cpr,
        purchaseValue,
        purchases,
        roas,
        impressions,
        linkClicks,
        outboundClicks,
        ctr,
        frequency:       parseFloat(r.frequency || "0"),
        reach,
        cpm:             parseFloat(r.cpm || "0"),
        avgPurchaseValue: avgPV,
        purchaseCR,
        leads,
        registrations,
        contentViews,
        addToCart,
        appInstalls,
        appActivations,
        postEngagements,
        postReactions,
        pageEngagements,
        like,
        comment,
        initiateCheckout,
        addPaymentInfo,
        video3s:         video3sViews,
        thruplay:        thruplayViews,
        videoP25,
        videoP50,
        videoP75,
        videoP95,
        videoP100,
        video30s,
        avgWatchTime,
        // Computed ratio metrics
        costPerLinkClick:        linkClicks > 0 ? spend / linkClicks : 0,
        outboundCostPer:         outboundClicks > 0 ? spend / outboundClicks : 0,
        outboundCtr:             impressions > 0 ? (outboundClicks / impressions) * 100 : 0,
        costPer3s:               video3sViews > 0 ? spend / video3sViews : 0,
        costPerThruplay:         thruplayViews > 0 ? spend / thruplayViews : 0,
        vtr:                     impressions > 0 ? (thruplayViews / impressions) * 100 : 0,
        watchRate25:             video3sViews > 0 ? (videoP25 / video3sViews) * 100 : 0,
        watchRate50:             video3sViews > 0 ? (videoP50 / video3sViews) * 100 : 0,
        watchRate75:             video3sViews > 0 ? (videoP75 / video3sViews) * 100 : 0,
        watchRate95:             video3sViews > 0 ? (videoP95 / video3sViews) * 100 : 0,
        watchRate100:            video3sViews > 0 ? (videoP100 / video3sViews) * 100 : 0,
        costPerVideoP25:         videoP25 > 0 ? spend / videoP25 : 0,
        costPerVideoP50:         videoP50 > 0 ? spend / videoP50 : 0,
        costPerVideoP75:         videoP75 > 0 ? spend / videoP75 : 0,
        costPerVideoP95:         videoP95 > 0 ? spend / videoP95 : 0,
        costPerVideoP100:        videoP100 > 0 ? spend / videoP100 : 0,
        costPer1000Reached:      reach > 0 ? (spend / reach) * 1000 : 0,
        costPerPurchase:         purchases > 0 ? spend / purchases : 0,
        costPerAddToCart:        addToCart > 0 ? spend / addToCart : 0,
        costPerLead:             leads > 0 ? spend / leads : 0,
        costPerInstall:          appInstalls > 0 ? spend / appInstalls : 0,
        costPerAppActivation:    appActivations > 0 ? spend / appActivations : 0,
        costPerRegistration:     registrations > 0 ? spend / registrations : 0,
        costPerContentView:      contentViews > 0 ? spend / contentViews : 0,
        costPerNewCustomer:      purchases > 0 ? spend / purchases : 0,
        costPerPageEngagement:   pageEngagements > 0 ? spend / pageEngagements : 0,
        costPerPostEngagement:   postEngagements > 0 ? spend / postEngagements : 0,
        costPerPostReaction:     postReactions > 0 ? spend / postReactions : 0,
        costPerLike:             like > 0 ? spend / like : 0,
        costPerComment:          comment > 0 ? spend / comment : 0,
        costPerInitiateCheckout: initiateCheckout > 0 ? spend / initiateCheckout : 0,
        costPerAddPaymentInfo:   addPaymentInfo > 0 ? spend / addPaymentInfo : 0,
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

      return rawAds
      },
    }) // end getDbCachedFacebookMetadata

    return NextResponse.json({
      ads: result.value,
      cached: result.source !== "meta",
      stale: result.stale,
      retryAfterMs: result.retryAfterMs,
    })
  } catch (err: any) {
    console.error("[insights/report]", err)
    const isRateLimit = err.message?.includes("too many calls") || err.message?.includes("Rate limited")
    return NextResponse.json({ error: err.message }, { status: isRateLimit ? 429 : 500 })
  }
}
