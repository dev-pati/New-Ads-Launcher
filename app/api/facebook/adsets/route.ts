import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getAdSets, getAdSetsPage } from "@/lib/facebook"
import { getCachedFacebookMetadata, clearCachedFacebookMetadata, isCachedFacebookMetadataFresh } from "../_cache"
import { adsetManagerSnapshotFallback, datePresetToRange } from "@/lib/snapshot-fallback"

const CACHE_TTL = 15 * 60 * 1000 // 15 minutes for P0 optimization

export async function GET(request: NextRequest) {
  try {
    const sp          = request.nextUrl.searchParams
    const adAccountId  = sp.get("ad_account_id")
    const campaignId   = sp.get("campaign_id")
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

    const { since, until } = datePresetToRange(datePreset)
    const fallback = async (reason: string) => {
      const snapshot = await adsetManagerSnapshotFallback(ctx.orgId, adAccountId, campaignId, since, until)
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
    const cacheKey = `adsets:v5:${adAccountId}:${campaignId || "all"}:${dateKey}:limit:${maxRows || "all"}:active:${activeOnly}:after:${after || "first"}`

    if (forceRefresh) clearCachedFacebookMetadata(cacheKey)

    const isFresh = isCachedFacebookMetadataFresh(cacheKey)
    let result: Awaited<ReturnType<typeof getAdSets>> | Awaited<ReturnType<typeof getAdSetsPage>>
    try {
      result = await getCachedFacebookMetadata<typeof result>(
        cacheKey,
        CACHE_TTL,
        () => maxRows || after
          ? getAdSetsPage(adAccountId, connection.access_token, campaignId || undefined, datePreset, timeRange || undefined, maxRows || 20, activeOnly, after)
          : getAdSets(adAccountId, connection.access_token, campaignId || undefined, datePreset, timeRange || undefined)
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
