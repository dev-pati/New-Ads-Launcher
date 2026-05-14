import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getCampaigns } from "@/lib/facebook"
import { getCachedFacebookMetadata } from "../_cache"

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const adAccountId = sp.get("ad_account_id")
    const datePreset  = sp.get("date_preset") || "last_7d"
    const timeRange   = sp.get("time_range") || ""

    if (!adAccountId) return NextResponse.json({ error: "ad_account_id is required" }, { status: 400 })

    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection found" }, { status: 401 })

    const dateKey  = timeRange ? `tr:${timeRange}` : `dp:${datePreset}`
    const cacheKey = `campaigns:${adAccountId}:${dateKey}`

    const campaigns = await getCachedFacebookMetadata(
      cacheKey,
      CACHE_TTL,
      () => getCampaigns(adAccountId, connection.access_token, datePreset)
    )

    return NextResponse.json({ campaigns })
  } catch (err: any) {
    console.error("[campaigns]", err)
    const isRateLimit = err?.name === "MetaRateLimitError"
    return NextResponse.json(
      { error: isRateLimit ? "Meta API rate limit reached. Please wait a moment." : (err.message || "Failed to fetch campaigns") },
      { status: isRateLimit ? 429 : 500 }
    )
  }
}
