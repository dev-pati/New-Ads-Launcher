import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getAdSets, getAdSetsPage } from "@/lib/facebook"
import { getCachedFacebookMetadata, clearCachedFacebookMetadata, isCachedFacebookMetadataFresh } from "../_cache"
import { adsetManagerSnapshotFallback, datePresetToRange, resolveAdsManagerTimeRange } from "@/lib/snapshot-fallback"

const CACHE_TTL = 15 * 60 * 1000 // 15 minutes for P0 optimization
const MAX_MULTI_CAMPAIGNS = 20

function multiOffset(after?: string) {
  if (!after?.startsWith("multi:")) return 0
  const parsed = Number.parseInt(after.slice("multi:".length), 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function byNewestAdSet(a: { created_time?: string; id: string }, b: { created_time?: string; id: string }) {
  const at = a.created_time ? Date.parse(a.created_time) : Number.NaN
  const bt = b.created_time ? Date.parse(b.created_time) : Number.NaN
  if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at
  if (Number.isFinite(at) !== Number.isFinite(bt)) return Number.isFinite(at) ? -1 : 1
  return b.id.localeCompare(a.id, undefined, { numeric: true })
}

export async function GET(request: NextRequest) {
  try {
    const sp          = request.nextUrl.searchParams
    const adAccountId  = sp.get("ad_account_id")
    const requestedCampaignId = sp.get("campaign_id")
    const campaignIds = Array.from(new Set(
      sp.getAll("campaign_ids").flatMap(value => value.split(",")).map(value => value.trim()).filter(Boolean)
    )).sort()
    if (campaignIds.length > MAX_MULTI_CAMPAIGNS) {
      return NextResponse.json({ error: `Select up to ${MAX_MULTI_CAMPAIGNS} campaigns at a time.` }, { status: 400 })
    }
    const multiCampaignIds = requestedCampaignId ? [] : campaignIds.length > 1 ? campaignIds : []
    const campaignId = requestedCampaignId || (campaignIds.length === 1 ? campaignIds[0] : null)
    const datePreset   = sp.get("date_preset") || "last_7d"
    const timeRange    = sp.get("time_range") || ""
    const forceRefresh = sp.get("refresh") === "true"
    const requestedLimit = Number.parseInt(sp.get("limit") || "", 10)
    const maxRows = Number.isFinite(requestedLimit) ? Math.min(20, Math.max(1, requestedLimit)) : undefined
    const activeOnly = sp.get("active_only") === "true"
    const after = sp.get("after") || undefined

    if (!adAccountId) return NextResponse.json({ error: "ad_account_id is required" }, { status: 400 })

    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const apiTimeRange = resolveAdsManagerTimeRange(datePreset, timeRange)
    const parsedTimeRange = apiTimeRange ? JSON.parse(apiTimeRange) : { since: "", until: "" }
    const { since, until } = datePresetToRange(datePreset, parsedTimeRange.since, parsedTimeRange.until)
    const fallback = async (reason: string) => {
      const snapshot = since ? await adsetManagerSnapshotFallback(ctx.orgId, adAccountId, campaignId, since, until) : null
      if (snapshot) {
        const adSets = multiCampaignIds.length
          ? snapshot.adSets.filter(adSet => multiCampaignIds.includes(adSet.campaign_id))
          : snapshot.adSets
        return NextResponse.json({ ...snapshot, adSets, metaUnavailable: true, reason })
      }
      return null
    }

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) {
      const snapshotRes = await fallback("no_facebook_connection")
      if (snapshotRes) return snapshotRes
      return NextResponse.json({ error: "No Facebook connection found" }, { status: 401 })
    }

    const dateKey  = timeRange ? `tr:${timeRange}` : `dp:${datePreset}`

    if (multiCampaignIds.length) {
      const multiCacheKey = `adsets:v6:${adAccountId}:campaigns:${multiCampaignIds.join(",")}:${dateKey}:active:${activeOnly}`
      if (forceRefresh) clearCachedFacebookMetadata(multiCacheKey)
      const isFresh = isCachedFacebookMetadataFresh(multiCacheKey)
      let allAdSets: Awaited<ReturnType<typeof getAdSets>>
      try {
        allAdSets = await getCachedFacebookMetadata(
          multiCacheKey,
          CACHE_TTL,
          async () => {
            const groups = await Promise.all(multiCampaignIds.map(id =>
              getAdSets(adAccountId, connection.access_token, id, datePreset, apiTimeRange || undefined, undefined, activeOnly)
            ))
            return Array.from(new Map(groups.flat().map(adSet => [adSet.id, adSet])).values()).sort(byNewestAdSet)
          }
        )
      } catch (err) {
        const snapshotRes = await fallback(err instanceof Error ? err.message : "meta_unavailable")
        if (snapshotRes) return snapshotRes
        throw err
      }

      const limit = maxRows || 20
      const offset = multiOffset(after)
      const adSets = allAdSets.slice(offset, offset + limit)
      const nextOffset = offset + adSets.length
      const hasNext = nextOffset < allAdSets.length
      return new NextResponse(JSON.stringify({
        adSets,
        paging: {
          after: hasNext ? `multi:${nextOffset}` : undefined,
          hasNext,
          hasPrevious: offset > 0,
        },
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Cache": isFresh ? "HIT" : "MISS",
          "Cache-Control": `private, max-age=${isFresh ? 900 : 0}, stale-while-revalidate=900`,
        },
      })
    }

    const cacheKey = `adsets:v5:${adAccountId}:${campaignId || "all"}:${dateKey}:limit:${maxRows || "all"}:active:${activeOnly}:after:${after || "first"}`

    if (forceRefresh) clearCachedFacebookMetadata(cacheKey)

    const isFresh = isCachedFacebookMetadataFresh(cacheKey)
    let result: Awaited<ReturnType<typeof getAdSets>> | Awaited<ReturnType<typeof getAdSetsPage>>
    try {
      result = await getCachedFacebookMetadata<typeof result>(
        cacheKey,
        CACHE_TTL,
        () => maxRows || after
          ? getAdSetsPage(adAccountId, connection.access_token, campaignId || undefined, datePreset, apiTimeRange || undefined, maxRows || 20, activeOnly, after)
          : getAdSets(adAccountId, connection.access_token, campaignId || undefined, datePreset, apiTimeRange || undefined)
      )
    } catch (err) {
      const snapshotRes = await fallback(err instanceof Error ? err.message : "meta_unavailable")
      if (snapshotRes) return snapshotRes
      throw err
    }

    const adSets = Array.isArray(result) ? result : result.data
    const paging = Array.isArray(result) ? { hasNext: false, hasPrevious: false } : result.paging
    return new NextResponse(JSON.stringify({ adSets, paging }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Cache": isFresh ? "HIT" : "MISS",
        "Cache-Control": `private, max-age=${isFresh ? 900 : 0}, stale-while-revalidate=900`,
      },
    })
  } catch (err: any) {
    console.error("[adsets]", err)
    const isRateLimit = err?.name === "MetaRateLimitError"
    return NextResponse.json(
      { error: isRateLimit ? "Meta API rate limit reached. Please wait a moment." : (err.message || "Failed to fetch ad sets") },
      { status: isRateLimit ? 429 : 500 }
    )
  }
}
