import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getAdAccounts } from "@/lib/facebook"
import { getDbCachedFacebookMetadata } from "../_db-cache"

const AD_ACCOUNTS_TTL_MS = 15 * 60 * 1000

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) {
      return NextResponse.json({
        adAccounts: [],
        connected: false,
        needsReconnect: true,
      })
    }

    const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true"
    const result = await getDbCachedFacebookMetadata({
      orgId: ctx.orgId,
      cacheKey: "facebook:ad-accounts",
      ttlMs: AD_ACCOUNTS_TTL_MS,
      forceRefresh,
      loader: () => getAdAccounts(connection.access_token),
    })

    return NextResponse.json({
      adAccounts: result.value,
      connected: true,
      cached: result.source !== "meta",
      stale: result.stale,
      retryAfterMs: result.retryAfterMs,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch ad accounts"
    const isRateLimit = msg.includes("too many calls") || msg.includes("Rate limited")
    console.error("Failed to fetch ad accounts:", msg)
    return NextResponse.json(
      { error: msg, rateLimited: isRateLimit },
      { status: isRateLimit ? 429 : 500 }
    )
  }
}
