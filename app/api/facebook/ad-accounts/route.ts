import { NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getAdAccounts } from "@/lib/facebook"
import { getCachedFacebookMetadata } from "../_cache"

const AD_ACCOUNTS_TTL_MS = 15 * 60 * 1000

export async function GET() {
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

    const adAccounts = await getCachedFacebookMetadata(
      `fb:ad-accounts:${ctx.orgId}`,
      AD_ACCOUNTS_TTL_MS,
      () => getAdAccounts(connection.access_token)
    )
    return NextResponse.json({ adAccounts, connected: true })
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
