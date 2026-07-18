import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getDbCachedFacebookMetadata } from "../../facebook/_db-cache"
import { computeInsightMetrics, deliveryLabel, attributionLabel, budgetFromMinor } from "@/lib/insights-metrics"
import { clampTimeToToday } from "@/lib/snapshot-fallback"
import { resolveOrgPageAccessToken } from "@/lib/facebook-page-token"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const GRAPH = "https://graph.facebook.com/v25.0"

type Level = "ad" | "adset" | "campaign"

const INSIGHT_FIELDS = [
  "spend", "impressions", "reach", "frequency", "cpm", "ctr", "clicks",
  "inline_link_clicks", "inline_link_click_ctr", "unique_clicks", "unique_inline_link_clicks",
  "unique_link_clicks_ctr", "outbound_clicks", "actions", "action_values", "purchase_roas",
  "video_thruplay_watched_actions", "video_p25_watched_actions", "video_p50_watched_actions",
  "video_p75_watched_actions", "video_p95_watched_actions", "video_p100_watched_actions",
  "video_30_sec_watched_actions", "video_avg_time_watched_actions", "date_start", "date_stop",
].join(",")

function fmtSecLabel(sec: number) {
  const s = Math.max(0, Math.round(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, "0")}`
}

function retentionFromQuartiles(m: any, videoLength: number | null) {
  const base = m.video3s || 0
  if (base <= 0) return []
  const hasLen = videoLength != null && videoLength > 0
  return [
    { t: 0, label: "0:00", pct: 100 },
    { t: 25, label: "25%", pct: (m.videoP25 / base) * 100 },
    { t: 50, label: "50%", pct: (m.videoP50 / base) * 100 },
    { t: 75, label: "75%", pct: (m.videoP75 / base) * 100 },
    { t: 95, label: "95%", pct: (m.videoP95 / base) * 100 },
    { t: 100, label: "100%", pct: (m.videoP100 / base) * 100 },
  ].map(p => {
    const pct = Number.isFinite(p.pct) ? Math.max(0, Math.min(100, p.pct)) : 0
    const sec = hasLen ? Math.round((p.t / 100) * (videoLength as number)) : p.t
    return { ...p, pct, sec, secLabel: fmtSecLabel(sec) }
  })
}

function resolvePostId(creative: any) {
  const storyId = creative?.effective_object_story_id || creative?.object_story_id || ""
  if (storyId && storyId.includes("_")) {
    const [pageId] = storyId.split("_")
    return { pageId, postId: storyId, objectStoryId: storyId }
  }
  const pageId = creative?.object_story_spec?.page_id || null
  return { pageId, postId: storyId || null, objectStoryId: storyId || null }
}

function landingUrl(creative: any) {
  const linkData = creative?.object_story_spec?.link_data
  const videoData = creative?.object_story_spec?.video_data
  return linkData?.link || videoData?.call_to_action?.value?.link || null
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const sp = request.nextUrl.searchParams
    const id = sp.get("id") || ""
    const adAccountId = sp.get("adAccountId") || ""
    const level = (["ad", "adset", "campaign"].includes(sp.get("level") || "") ? sp.get("level") : "ad") as Level
    const datePreset = sp.get("datePreset") || "last_30d"
    const attributionWindows = sp.get("action_attribution_windows") || ""
    let since = sp.get("since") || ""
    let until = sp.get("until") || ""
    ;({ since, until } = clampTimeToToday(since, until))
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
    if (!adAccountId) return NextResponse.json({ error: "adAccountId required" }, { status: 400 })

    const token = connection.access_token
    const dateKey = since && until ? `range:${since}_${until}` : `preset:${datePreset}`
    // v5 uses Page token to fetch dark-post video source.
    const cacheKey = `insights:report-object:v5:${level}:${id}:${dateKey}:${attributionWindows}`

    const result = await getDbCachedFacebookMetadata({
      orgId: ctx.orgId,
      cacheKey,
      ttlMs: 10 * 60_000,
      loader: async () => {
        const params = new URLSearchParams({ fields: INSIGHT_FIELDS, access_token: token,
          ...(!attributionWindows ? { use_account_attribution_setting: "true" } : { action_attribution_windows: attributionWindows }), })
        if (since && until) params.set("time_range", JSON.stringify({ since, until }))
        else params.set("date_preset", datePreset)

        const [objRes, insightsRes] = await Promise.all([
          fetch(`${GRAPH}/${id}?fields=${encodeURIComponent(objectFields(level))}&access_token=${encodeURIComponent(token)}`),
          fetch(`${GRAPH}/${id}/insights?${params}`),
        ])
        const obj = await objRes.json()
        const insights = await insightsRes.json()
        if (obj.error) throw new Error(obj.error.message)
        if (insights.error) throw new Error(insights.error.message)

        const raw = insights.data?.[0] || {}
        const creative = obj.creative || {}
        const meta = {
          creativeId: creative.id || "",
          objectType: (creative.object_type || "").toUpperCase(),
          imageUrl: creative.image_url || null,
          thumbUrl: creative.thumbnail_url || null,
          thumbnail: creative.thumbnail_url || creative.image_url || null,
          effectiveStatus: obj.effective_status || "UNKNOWN",
          createdTime: obj.created_time || null,
          landingPageUrl: landingUrl(creative),
          bid: obj.bid_amount != null ? budgetFromMinor(obj.bid_amount) : null,
          bidStrategy: obj.bid_strategy || obj.adset?.bid_strategy || null,
          attribution: attributionLabel(obj.attribution_spec || obj.adset?.attribution_spec),
          budget: budgetFromMinor(obj.daily_budget || obj.lifetime_budget || obj.adset?.daily_budget || obj.adset?.lifetime_budget || obj.campaign?.daily_budget || obj.campaign?.lifetime_budget),
          budgetType: obj.daily_budget || obj.adset?.daily_budget || obj.campaign?.daily_budget ? "Daily" : (obj.lifetime_budget || obj.adset?.lifetime_budget || obj.campaign?.lifetime_budget ? "Lifetime" : null),
          startsAt: obj.start_time || obj.adset?.start_time || null,
          endsAt: obj.end_time || obj.stop_time || obj.adset?.end_time || null,
        }
        const metrics = computeInsightMetrics(raw, meta)
        const post = resolvePostId(creative)
        const videoId = creative.video_id || creative.object_story_spec?.video_data?.video_id || null
        const isVideo = metrics.isVideo || !!videoId

        let videoLength: number | null = null
        let videoSource: string | null = null
        let videoThumbnail: string | null = null
        if (isVideo && videoId) {
          // Dark-post videos are owned by the Page; ad-account token often can't
          // read `source`. Prefer a Page access token, fall back to the ad token.
          let videoToken = token
          if (post.pageId) {
            try {
              const supabase = createAdminClient()
              const pageToken = await resolveOrgPageAccessToken(supabase, ctx.orgId, ctx.user.id, post.pageId)
              if (pageToken?.token) videoToken = pageToken.token
            } catch {
              /* keep ad token */
            }
          }
          try {
            const vRes = await fetch(
              `${GRAPH}/${videoId}?fields=length_seconds,source,thumbnails,permalink_url&access_token=${encodeURIComponent(videoToken)}`
            )
            const vJson = await vRes.json()
            if (vJson && typeof vJson.length_seconds === "number" && Number.isFinite(vJson.length_seconds)) {
              videoLength = vJson.length_seconds
            }
            if (vJson && typeof vJson.source === "string" && vJson.source.startsWith("http")) {
              videoSource = vJson.source
            }
            const thumbs = vJson?.thumbnails?.data as any[] | undefined
            if (Array.isArray(thumbs) && thumbs.length > 0) {
              videoThumbnail = thumbs[0].uri || thumbs[0].uri_alt || null
            }
          } catch {
            videoLength = null
          }
        }
        const videoData = creative.object_story_spec?.video_data
        if (!videoThumbnail) videoThumbnail = videoData?.image_url || creative.thumbnail_url || creative.image_url || null

        return {
          id,
          level,
          name: obj.name || raw.ad_name || raw.adset_name || raw.campaign_name || id,
          delivery: deliveryLabel(obj.effective_status),
          effectiveStatus: obj.effective_status || "UNKNOWN",
          metadata: meta,
          metrics,
          creative: level === "ad" ? {
            creativeId: creative.id || null,
            mediaType: isVideo ? "video" : "image",
            thumbnail: videoThumbnail,
            imageUrl: creative.image_url || videoThumbnail,
            videoId,
            objectStoryId: post.objectStoryId,
            pageId: post.pageId,
            postId: post.postId,
            permalink: null,
            videoSource,
            primaryText: creative.object_story_spec?.link_data?.message || creative.object_story_spec?.video_data?.message || null,
            headline: creative.object_story_spec?.link_data?.name || creative.object_story_spec?.video_data?.title || null,
            callToAction: creative.object_story_spec?.link_data?.call_to_action?.type || creative.object_story_spec?.video_data?.call_to_action?.type || null,
            landingPageUrl: landingUrl(creative),
          } : null,
          video: level === "ad" && isVideo ? {
            videoPlays: metrics.video3s,
            avgWatchTime: metrics.avgWatchTime,
            hookRate: metrics.thumbstopRate,
            holdRate: metrics.holdRate,
            videoLength,
            retention: retentionFromQuartiles(metrics, videoLength),
            retentionSource: "quartile_estimate",
          } : null,
        }
      },
    })

    return NextResponse.json({ ...result.value, cached: result.source !== "meta", stale: result.stale })
  } catch (err: any) {
    console.error("[insights/report-object]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function objectFields(level: Level) {
  if (level === "ad") {
    return "id,name,created_time,effective_status,bid_amount,creative{id,name,object_type,image_url,thumbnail_url,video_id,object_story_id,effective_object_story_id,object_story_spec{page_id,link_data{message,name,link,call_to_action,image_hash},video_data{video_id,message,title,image_url,image_hash,call_to_action{type,value{link}}}}},adset{daily_budget,lifetime_budget,bid_strategy,attribution_spec,start_time,end_time},campaign{daily_budget,lifetime_budget}"
  }
  if (level === "adset") {
    return "id,name,effective_status,start_time,end_time,bid_amount,bid_strategy,daily_budget,lifetime_budget,attribution_spec,campaign{daily_budget,lifetime_budget}"
  }
  // Campaign has no attribution_spec (adset-only). Asking for it → Meta #100.
  return "id,name,effective_status,daily_budget,lifetime_budget,bid_strategy,start_time,stop_time"
}
