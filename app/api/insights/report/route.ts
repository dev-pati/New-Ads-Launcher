import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getDbCachedFacebookMetadata } from "../../facebook/_db-cache"
import { adSnapshotFallback, campaignManagerSnapshotFallback, adsetManagerSnapshotFallback, datePresetToRange, clampTimeToToday } from "@/lib/snapshot-fallback"
import { computeInsightMetrics, deliveryLabel, attributionLabel, budgetFromMinor, ObjectMeta } from "@/lib/insights-metrics"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const GRAPH = "https://graph.facebook.com/v25.0"

type Level = "ad" | "adset" | "campaign"

const LEVEL_ID_FIELD: Record<Level, string> = {
  ad: "ad_id",
  adset: "adset_id",
  campaign: "campaign_id",
}
const LEVEL_NAME_FIELD: Record<Level, string> = {
  ad: "ad_name",
  adset: "adset_name",
  campaign: "campaign_name",
}

async function batchFetch(token: string, requests: { method: string; relative_url: string }[]) {
  const results: Array<{ code: number; body: string }> = []
  // Meta batch API caps at 50 requests per call
  for (let i = 0; i < requests.length; i += 50) {
    const chunk = requests.slice(i, i + 50)
    const form = new URLSearchParams()
    form.append("access_token", token)
    form.append("batch", JSON.stringify(chunk))
    const res = await fetch(GRAPH, { method: "POST", body: form })
    const data = await res.json()
    if (Array.isArray(data)) results.push(...data)
  }
  return results
}

function insightFields(level: Level) {
  const common = [
    "spend", "impressions", "reach", "frequency", "cpm", "ctr",
    "clicks", "inline_link_clicks", "inline_link_click_ctr",
    "unique_clicks", "unique_inline_link_clicks", "unique_link_clicks_ctr",
    "outbound_clicks",
    "actions", "action_values", "purchase_roas", "cost_per_action_type",
    "video_thruplay_watched_actions",
    "video_p25_watched_actions", "video_p50_watched_actions", "video_p75_watched_actions",
    "video_p95_watched_actions", "video_p100_watched_actions",
    "video_30_sec_watched_actions", "video_avg_time_watched_actions",
    "date_start", "date_stop",
  ]
  const idName = [LEVEL_ID_FIELD[level], LEVEL_NAME_FIELD[level]]
  if (level === "ad") idName.push("adset_name", "campaign_name")
  if (level === "adset") idName.push("campaign_name")
  return [...idName, ...common].join(",")
}

/** Resolve budget + budget type from campaign/adset object fields, matching CBO/ABO labeling. */
function resolveBudget(obj: any, parentCampaign?: any) {
  const ownDaily = obj?.daily_budget
  const ownLifetime = obj?.lifetime_budget
  if (ownDaily != null || ownLifetime != null) {
    return {
      budget: budgetFromMinor(ownDaily ?? ownLifetime),
      budgetType: ownDaily != null ? "Daily" : "Lifetime",
    }
  }
  const campDaily = parentCampaign?.daily_budget
  const campLifetime = parentCampaign?.lifetime_budget
  if (campDaily != null || campLifetime != null) {
    return {
      budget: budgetFromMinor(campDaily ?? campLifetime),
      budgetType: "Using campaign budget",
    }
  }
  return { budget: null, budgetType: obj ? "Using ad set budget" : null }
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const sp = request.nextUrl.searchParams
    const adAccountId = sp.get("adAccountId") || ""
    const level = (["ad", "adset", "campaign"].includes(sp.get("level") || "") ? sp.get("level") : "ad") as Level
    const datePreset = sp.get("datePreset") || "last_90d"
    let since = sp.get("since") || ""
    let until = sp.get("until") || ""
    ;({ since, until } = clampTimeToToday(since, until))
    const limit = Math.min(parseInt(sp.get("limit") || "50"), 50)

    if (!adAccountId) return NextResponse.json({ error: "adAccountId required" }, { status: 400 })

    const token = connection.access_token
    const accountPath = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`

    const forceRefresh = sp.get("refresh") === "true"
    const dateKey = since && until ? `range:${since}_${until}` : `preset:${datePreset}`
    const cacheKey = `insights:report:${adAccountId}:${level}:${dateKey}:limit:${limit}`

    const result = await getDbCachedFacebookMetadata({
      orgId: ctx.orgId,
      cacheKey,
      ttlMs: 15 * 60_000,
      forceRefresh,
      loader: async () => {
        const insightParams = new URLSearchParams({
          level,
          fields: insightFields(level),
          sort: "spend_descending",
          limit: String(limit),
          access_token: token,
          use_account_attribution_setting: "true",
        })
        if (since && until) insightParams.set("time_range", JSON.stringify({ since, until }))
        else insightParams.set("date_preset", datePreset)

        const insightRes = await fetch(`${GRAPH}/${accountPath}/insights?${insightParams}`)
        const insightData = await insightRes.json()
        if (insightData.error) throw new Error(insightData.error.message)

        const rows: any[] = insightData.data || []
        if (rows.length === 0) return []

        const idField = LEVEL_ID_FIELD[level]
        const ids = [...new Set(rows.map(r => r[idField]).filter(Boolean))] as string[]

        // ── Object metadata per level ──────────────────────────────────────
        const metaById: Record<string, ObjectMeta> = {}

        if (level === "ad") {
          const step2 = await batchFetch(token, ids.map(id => ({
            method: "GET",
            relative_url: `${id}?fields=id,name,created_time,effective_status,bid_amount,creative{id,object_type,image_url,thumbnail_url,object_story_spec{link_data{link},video_data{call_to_action{value{link}}}}},adset{daily_budget,lifetime_budget,bid_strategy,attribution_spec,start_time,end_time},campaign{daily_budget,lifetime_budget}`,
          })))

          const creativeIds: string[] = []
          const creativeOwner: Record<string, string> = {}

          for (let i = 0; i < step2.length; i++) {
            const item = step2[i]
            if (item.code !== 200) continue
            const parsed = JSON.parse(item.body)
            const creative = parsed.creative || {}
            const linkData = creative.object_story_spec?.link_data
            const videoData = creative.object_story_spec?.video_data
            let landingPageUrl: string | null = null
            if (linkData?.link) landingPageUrl = linkData.link
            else if (videoData?.call_to_action?.value?.link) landingPageUrl = videoData.call_to_action.value.link

            const { budget, budgetType } = resolveBudget(parsed.adset, parsed.campaign)

            metaById[ids[i]] = {
              creativeId: creative.id || "",
              objectType: (creative.object_type || "IMAGE").toUpperCase(),
              imageUrl: creative.image_url || null,
              thumbUrl: creative.thumbnail_url || null,
              createdTime: parsed.created_time || null,
              effectiveStatus: parsed.effective_status || "UNKNOWN",
              landingPageUrl,
              bid: parsed.bid_amount != null ? budgetFromMinor(parsed.bid_amount) : null,
              bidStrategy: parsed.adset?.bid_strategy || null,
              attribution: attributionLabel(parsed.adset?.attribution_spec),
              budget, budgetType,
              startsAt: parsed.adset?.start_time || null,
              endsAt: parsed.adset?.end_time || null,
            }
            if (creative.id) { creativeIds.push(creative.id); creativeOwner[creative.id] = ids[i] }
          }

          if (creativeIds.length > 0) {
            const step3 = await batchFetch(token, creativeIds.map(cid => ({
              method: "GET",
              relative_url: `${cid}?thumbnail_width=600&thumbnail_height=750&fields=thumbnail_url,image_url`,
            })))
            for (let i = 0; i < step3.length; i++) {
              if (step3[i].code !== 200) continue
              const parsed = JSON.parse(step3[i].body)
              const url = parsed.image_url || parsed.thumbnail_url || null
              const adId = creativeOwner[creativeIds[i]]
              if (url && adId && metaById[adId]) metaById[adId].sizedThumb = url
            }
          }
        } else if (level === "adset") {
          const step2 = await batchFetch(token, ids.map(id => ({
            method: "GET",
            relative_url: `${id}?fields=id,name,effective_status,start_time,end_time,bid_amount,bid_strategy,daily_budget,lifetime_budget,attribution_spec,campaign{daily_budget,lifetime_budget}`,
          })))
          for (let i = 0; i < step2.length; i++) {
            const item = step2[i]
            if (item.code !== 200) continue
            const parsed = JSON.parse(item.body)
            const { budget, budgetType } = resolveBudget(parsed, parsed.campaign)
            metaById[ids[i]] = {
              effectiveStatus: parsed.effective_status || "UNKNOWN",
              bid: parsed.bid_amount != null ? budgetFromMinor(parsed.bid_amount) : null,
              bidStrategy: parsed.bid_strategy || null,
              attribution: attributionLabel(parsed.attribution_spec),
              budget, budgetType,
              startsAt: parsed.start_time || null,
              endsAt: parsed.end_time || null,
            }
          }
        } else {
          const step2 = await batchFetch(token, ids.map(id => ({
            method: "GET",
            // Campaign has no attribution_spec (adset-only). Asking for it → Meta #100.
            relative_url: `${id}?fields=id,name,effective_status,daily_budget,lifetime_budget,bid_strategy,start_time,stop_time`,
          })))
          for (let i = 0; i < step2.length; i++) {
            const item = step2[i]
            if (item.code !== 200) continue
            const parsed = JSON.parse(item.body)
            const { budget, budgetType } = resolveBudget(parsed)
            metaById[ids[i]] = {
              effectiveStatus: parsed.effective_status || "UNKNOWN",
              bidStrategy: parsed.bid_strategy || null,
              attribution: null,
              budget, budgetType,
              startsAt: parsed.start_time || null,
              endsAt: parsed.stop_time || null,
            }
          }
        }

        // ── Assemble rows ────────────────────────────────────────────────
        const rawItems = rows.map(r => {
          const id = r[idField]
          const meta = metaById[id] || {}
          const computed = computeInsightMetrics(r, meta)
          const base: any = {
            id,
            adId: r.ad_id ?? null,
            adsetId: r.adset_id ?? null,
            campaignId: r.campaign_id ?? null,
            name: r[LEVEL_NAME_FIELD[level]] || id,
            adName: r.ad_name ?? undefined,
            adsetName: r.adset_name ?? undefined,
            campaignName: r.campaign_name ?? undefined,
            ...computed,
            delivery: deliveryLabel(meta.effectiveStatus),
          }
          return base
        })

        return rawItems
      },
    }) // end getDbCachedFacebookMetadata

    return NextResponse.json({
      ads: result.value,
      level,
      cached: result.source !== "meta",
      stale: result.stale,
      retryAfterMs: result.retryAfterMs,
    })
  } catch (err: any) {
    console.error("[insights/report]", err)
    try {
      const sp2 = request.nextUrl.searchParams
      const ctx2 = await getAuthContext()
      const adAccountId = sp2.get("adAccountId") || ""
      const level2 = (["ad", "adset", "campaign"].includes(sp2.get("level") || "") ? sp2.get("level") : "ad") as Level
      if (ctx2 && adAccountId) {
        const { since, until } = datePresetToRange(sp2.get("datePreset") || "last_90d", sp2.get("since") || "", sp2.get("until") || "")
        if (level2 === "ad") {
          const snapshot = await adSnapshotFallback(ctx2.orgId, adAccountId, since, until)
          if (snapshot) return NextResponse.json({ ...snapshot, level: level2 })
        } else if (level2 === "adset") {
          const snapshot = await adsetManagerSnapshotFallback(ctx2.orgId, adAccountId, null, since, until)
          if (snapshot) return NextResponse.json({ ads: snapshot.adSets, level: level2, fromSnapshot: true })
        } else {
          const snapshot = await campaignManagerSnapshotFallback(ctx2.orgId, adAccountId, since, until)
          if (snapshot) return NextResponse.json({ ads: snapshot.campaigns, level: level2, fromSnapshot: true })
        }
      }
    } catch {}
    const isRateLimit = err.message?.includes("too many calls") || err.message?.includes("Rate limited")
    return NextResponse.json({ error: err.message }, { status: isRateLimit ? 429 : 500 })
  }
}
