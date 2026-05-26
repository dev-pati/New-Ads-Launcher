import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getAdAccountPages, getFacebookPages } from "@/lib/facebook"
import { getDbCachedFacebookMetadata } from "../_db-cache"
import { adAccountBelongsToOrg } from "../_utils"
export const dynamic = "force-dynamic"

const PAGES_TTL_MS = 10 * 60 * 1000

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) {
      return NextResponse.json({
        error: "No Facebook connection found. Go to /connect to link Facebook.",
        needsReconnect: true,
      }, { status: 401 })
    }

    try {
      const adAccountId = request.nextUrl.searchParams.get("ad_account_id")
      if (adAccountId) {
        const allowed = await adAccountBelongsToOrg(ctx.orgId, adAccountId, connection.access_token)
        if (!allowed) {
          return NextResponse.json({ error: "Ad account not found in workspace" }, { status: 403 })
        }
      }

      const cacheKey = adAccountId
        ? `facebook:pages:ad-account:${adAccountId}`
        : "facebook:pages:all"

      const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true"
      const result = await getDbCachedFacebookMetadata(
        {
          orgId: ctx.orgId,
          cacheKey,
          ttlMs: PAGES_TTL_MS,
          forceRefresh,
          loader: () => adAccountId
            ? getAdAccountPages(adAccountId, connection.access_token)
            : getFacebookPages(connection.access_token),
        }
      )

      return NextResponse.json({
        pages: result.value,
        cached: result.source !== "meta",
        stale: result.stale,
        retryAfterMs: result.retryAfterMs,
      })
    } catch (metaErr) {
      const msg = metaErr instanceof Error ? metaErr.message : "Meta API error"
      console.error("[pages] Meta API error:", msg)
      const lower = msg.toLowerCase()
      // Rate limit
      if (lower.includes("request limit") || lower.includes("#4") || lower.includes("rate limit") || lower.includes("too many")) {
        return NextResponse.json({
          error: "Facebook API rate limit reached. Wait 5-10 minutes and refresh the page.",
          rateLimited: true,
        }, { status: 429 })
      }
      // Token issues
      if (lower.includes("expired") || lower.includes("invalid") || lower.includes("oauth") || lower.includes("session") || lower.includes("revoked")) {
        return NextResponse.json({
          error: `Facebook token expired or revoked. Please reconnect at /connect. (${msg})`,
          needsReconnect: true,
        }, { status: 401 })
      }
      if (lower.includes("permission") || lower.includes("scope")) {
        return NextResponse.json({
          error: `Missing Facebook permission: ${msg}. Reconnect to grant pages_show_list scope.`,
          needsReconnect: true,
        }, { status: 403 })
      }
      return NextResponse.json({ error: `Meta API: ${msg}` }, { status: 500 })
    }
  } catch (err) {
    console.error("[pages] Server error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    )
  }
}
