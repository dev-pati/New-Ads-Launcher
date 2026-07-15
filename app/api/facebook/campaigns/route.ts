import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getCampaigns } from "@/lib/facebook"
import { getCachedFacebookMetadata, clearCachedFacebookMetadata } from "../_cache"
import { campaignManagerSnapshotFallback, datePresetToRange } from "@/lib/snapshot-fallback"

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const adAccountId = sp.get("ad_account_id")
    const datePreset  = sp.get("date_preset") || "last_7d"
    const timeRange   = sp.get("time_range") || ""
    const forceRefresh = sp.get("refresh") === "true"

    if (!adAccountId) return NextResponse.json({ error: "ad_account_id is required" }, { status: 400 })

    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { since, until } = datePresetToRange(datePreset)
    const fallback = async (reason: string) => {
      const snapshot = await campaignManagerSnapshotFallback(ctx.orgId, adAccountId, since, until)
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
    const cacheKey = `campaigns:v2:${adAccountId}:${dateKey}`

    if (forceRefresh) clearCachedFacebookMetadata(cacheKey)

    let campaigns
    try {
      campaigns = await getCachedFacebookMetadata(
        cacheKey,
        CACHE_TTL,
        () => getCampaigns(adAccountId, connection.access_token, datePreset, timeRange || undefined)
      )
    } catch (err) {
      const snapshotRes = await fallback(err instanceof Error ? err.message : "meta_unavailable")
      if (snapshotRes) return snapshotRes
      throw err
    }

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
