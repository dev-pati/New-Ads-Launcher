import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getCampaigns, getCampaignsPage } from "@/lib/facebook"
import { getCachedFacebookMetadata, clearCachedFacebookMetadata, isCachedFacebookMetadataFresh } from "../_cache"
import { campaignManagerSnapshotFallback, datePresetToRange, resolveAdsManagerTimeRange } from "@/lib/snapshot-fallback"

const CACHE_TTL = 15 * 60 * 1000 // 15 minutes for P0 optimization

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const adAccountId = sp.get("ad_account_id")
    const datePreset  = sp.get("date_preset") || "last_7d"
    const timeRange   = sp.get("time_range") || ""
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
      const snapshot = since ? await campaignManagerSnapshotFallback(ctx.orgId, adAccountId, since, until) : null
      if (snapshot) return NextResponse.json({ ...snapshot, metaUnavailable: true, reason })
      return null
    }

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) {
      const snapshotRes = await fallback("no_facebook_connection")
      if (snapshotRes) return snapshotRes
      return NextResponse.json({ error: "No Facebook connection found" }, { status: 401 })
    }

    const dateKey  = timeRange ? `tr:${timeRange}` : `dp:${datePreset}`
    const cacheKey = `campaigns:v3:${adAccountId}:${dateKey}:limit:${maxRows || "all"}:active:${activeOnly}:after:${after || "first"}`

    if (forceRefresh) clearCachedFacebookMetadata(cacheKey)

    const isFresh = isCachedFacebookMetadataFresh(cacheKey)
    let result: Awaited<ReturnType<typeof getCampaigns>> | Awaited<ReturnType<typeof getCampaignsPage>>
    try {
      result = await getCachedFacebookMetadata<typeof result>(
        cacheKey,
        CACHE_TTL,
        () => maxRows || after
          ? getCampaignsPage(adAccountId, connection.access_token, datePreset, apiTimeRange || undefined, maxRows || 20, activeOnly, after)
          : getCampaigns(adAccountId, connection.access_token, datePreset, apiTimeRange || undefined)
      )
    } catch (err) {
      const snapshotRes = await fallback(err instanceof Error ? err.message : "meta_unavailable")
      if (snapshotRes) return snapshotRes
      throw err
    }

    const campaigns = Array.isArray(result) ? result : result.data
    const paging = Array.isArray(result) ? { hasNext: false, hasPrevious: false } : result.paging
    return new NextResponse(JSON.stringify({ campaigns, paging }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Cache": isFresh ? "HIT" : "MISS",
        "Cache-Control": `private, max-age=${isFresh ? 900 : 0}, stale-while-revalidate=900`,
      },
    })
  } catch (err: any) {
    console.error("[campaigns]", err)
    const isRateLimit = err?.name === "MetaRateLimitError"
    return NextResponse.json(
      { error: isRateLimit ? "Meta API rate limit reached. Please wait a moment." : (err.message || "Failed to fetch campaigns") },
      { status: isRateLimit ? 429 : 500 }
    )
  }
}
