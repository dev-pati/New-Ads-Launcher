import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getAds } from "@/lib/facebook"
import { getCachedFacebookMetadata, clearCachedFacebookMetadata } from "../_cache"

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

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

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection found" }, { status: 401 })

    const dateKey  = timeRange ? `tr:${timeRange}` : `dp:${datePreset}`
    const cacheKey = `ads:${adAccountId}:${adSetId || "all"}:${dateKey}`

    if (forceRefresh) clearCachedFacebookMetadata(cacheKey)

    const ads = await getCachedFacebookMetadata(
      cacheKey,
      CACHE_TTL,
      () => getAds(adAccountId, connection.access_token, adSetId || undefined, datePreset)
    )

    return NextResponse.json({ ads })
  } catch (err: any) {
    console.error("[ads]", err)
    const isRateLimit = err?.name === "MetaRateLimitError"
    return NextResponse.json(
      { error: isRateLimit ? "Meta API rate limit reached. Please wait a moment." : (err.message || "Failed to fetch ads") },
      { status: isRateLimit ? 429 : 500 }
    )
  }
}
