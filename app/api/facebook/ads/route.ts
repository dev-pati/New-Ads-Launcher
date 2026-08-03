import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getAds, getAdsPage } from "@/lib/facebook"
import { getCachedFacebookMetadata, clearCachedFacebookMetadata, isCachedFacebookMetadataFresh } from "../_cache"
import { adsManagerSnapshotFallback, datePresetToRange, resolveAdsManagerTimeRange } from "@/lib/snapshot-fallback"

const CACHE_TTL = 15 * 60 * 1000 // 15 minutes for P0 optimization
const MAX_MULTI_PARENTS = 20

function parseIds(sp: URLSearchParams, key: string) {
  return Array.from(new Set(
    sp.getAll(key).flatMap(value => value.split(",")).map(value => value.trim()).filter(Boolean)
  )).sort()
}

function multiOffset(after?: string) {
  if (!after?.startsWith("multi:")) return 0
  const parsed = Number.parseInt(after.slice("multi:".length), 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function byNewestAd(a: { created_time?: string; id: string }, b: { created_time?: string; id: string }) {
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
    const adSetId      = sp.get("adset_id")
    const campaignId   = sp.get("campaign_id")
    const adSetIds     = adSetId ? [] : parseIds(sp, "adset_ids")
    const campaignIds  = campaignId ? [] : parseIds(sp, "campaign_ids")
    if ((adSetId || adSetIds.length) && (campaignId || campaignIds.length)) {
      return NextResponse.json({ error: "Filter Ads by Campaigns or Ad sets, not both." }, { status: 400 })
    }
    const parentIds = adSetId ? [adSetId] : campaignId ? [campaignId] : adSetIds.length ? adSetIds : campaignIds
    if (parentIds.length > MAX_MULTI_PARENTS) {
      return NextResponse.json({ error: `Select up to ${MAX_MULTI_PARENTS} parent objects at a time.` }, { status: 400 })
    }
    const parentType = adSetId || adSetIds.length ? "adset" : campaignId || campaignIds.length ? "campaign" : "account"
    const ownerId = adSetId || campaignId || (parentIds.length === 1 ? parentIds[0] : null)
    const multiParentIds = parentIds.length > 1 ? parentIds : []
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
      const snapshotAdSetId = parentType === "adset" && parentIds.length === 1 ? parentIds[0] : null
      const snapshot = since ? await adsManagerSnapshotFallback(ctx.orgId, adAccountId, snapshotAdSetId, since, until) : null
      if (snapshot) {
        const ads = parentType === "campaign" && parentIds.length
          ? snapshot.ads.filter(ad => parentIds.includes(ad.campaign_id))
          : parentType === "adset" && parentIds.length > 1
            ? snapshot.ads.filter(ad => parentIds.includes(ad.adset_id))
            : snapshot.ads
        return NextResponse.json({ ...snapshot, ads, metaUnavailable: true, reason })
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

    if (multiParentIds.length) {
      const multiCacheKey = `ads:v8:${adAccountId}:${parentType}s:${multiParentIds.join(",")}:${dateKey}:active:${activeOnly}`
      if (forceRefresh) clearCachedFacebookMetadata(multiCacheKey)
      const isFresh = isCachedFacebookMetadataFresh(multiCacheKey)
      let allAds: Awaited<ReturnType<typeof getAds>>
      try {
        allAds = await getCachedFacebookMetadata(
          multiCacheKey,
          CACHE_TTL,
          async () => {
            const groups = await Promise.all(multiParentIds.map(id =>
              getAds(adAccountId, connection.access_token, id, datePreset, apiTimeRange || undefined, undefined, activeOnly)
            ))
            return Array.from(new Map(groups.flat().map(ad => [ad.id, ad])).values()).sort(byNewestAd)
          }
        )
      } catch (err) {
        const snapshotRes = await fallback(err instanceof Error ? err.message : "meta_unavailable")
        if (snapshotRes) return snapshotRes
        throw err
      }

      const limit = maxRows || 20
      const offset = multiOffset(after)
      const ads = allAds.slice(offset, offset + limit)
      const nextOffset = offset + ads.length
      const hasNext = nextOffset < allAds.length
      return new NextResponse(JSON.stringify({
        ads,
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

    const cacheKey = `ads:v8:${adAccountId}:${parentType}:${ownerId || "all"}:${dateKey}:limit:${maxRows || "all"}:active:${activeOnly}:after:${after || "first"}`

    if (forceRefresh) clearCachedFacebookMetadata(cacheKey)

    const isFresh = isCachedFacebookMetadataFresh(cacheKey)
    let result: Awaited<ReturnType<typeof getAds>> | Awaited<ReturnType<typeof getAdsPage>>
    try {
      result = await getCachedFacebookMetadata<typeof result>(
        cacheKey,
        CACHE_TTL,
        () => maxRows || after
          ? getAdsPage(adAccountId, connection.access_token, ownerId || undefined, datePreset, apiTimeRange || undefined, maxRows || 20, activeOnly, after)
          : getAds(adAccountId, connection.access_token, ownerId || undefined, datePreset, apiTimeRange || undefined)
      )
    } catch (err) {
      const snapshotRes = await fallback(err instanceof Error ? err.message : "meta_unavailable")
      if (snapshotRes) return snapshotRes
      throw err
    }

    const ads = Array.isArray(result) ? result : result.data
    const paging = Array.isArray(result) ? { hasNext: false, hasPrevious: false } : result.paging
    return new NextResponse(JSON.stringify({ ads, paging }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Cache": isFresh ? "HIT" : "MISS",
        "Cache-Control": `private, max-age=${isFresh ? 900 : 0}, stale-while-revalidate=900`,
      },
    })
  } catch (err: any) {
    console.error("[ads]", err)
    const isRateLimit = err?.name === "MetaRateLimitError"
    return NextResponse.json(
      { error: isRateLimit ? "Meta API rate limit reached. Please wait a moment." : (err.message || "Failed to fetch ads") },
      { status: isRateLimit ? 429 : 500 }
    )
  }
}
