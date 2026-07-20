import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getAds } from "@/lib/facebook"
import { getCachedFacebookMetadata, clearCachedFacebookMetadata, isCachedFacebookMetadataFresh } from "../_cache"
import { adsManagerSnapshotFallback, datePresetToRange } from "@/lib/snapshot-fallback"

const CACHE_TTL = 15 * 60 * 1000 // 15 minutes for P0 optimization

export async function GET(request: NextRequest) {
  try {
    const sp          = request.nextUrl.searchParams
    const adAccountId  = sp.get("ad_account_id")
    const adSetId      = sp.get("adset_id")
    const datePreset   = sp.get("date_preset") || "last_7d"
    const timeRange    = sp.get("time_range") || ""
    const forceRefresh = sp.get("refresh") === "true"

    if (!adAccountId) return NextResponse.json({ error: "ad_account_id is required" }, { status: 400 })

    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { since, until } = datePresetToRange(datePreset)
    const fallback = async (reason: string) => {
      const snapshot = await adsManagerSnapshotFallback(ctx.orgId, adAccountId, adSetId, since, until)
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
    const cacheKey = `ads:v6:${adAccountId}:${adSetId || "all"}:${dateKey}`

    if (forceRefresh) clearCachedFacebookMetadata(cacheKey)

    const isFresh = isCachedFacebookMetadataFresh(cacheKey)
    let ads
    try {
      ads = await getCachedFacebookMetadata(
        cacheKey,
        CACHE_TTL,
        () => getAds(adAccountId, connection.access_token, adSetId || undefined, datePreset, timeRange || undefined)
      )
    } catch (err) {
      const snapshotRes = await fallback(err instanceof Error ? err.message : "meta_unavailable")
      if (snapshotRes) return snapshotRes
      throw err
    }

    return new NextResponse(JSON.stringify({ ads }), {
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
