import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getProductCatalogs } from "@/lib/facebook"
import { getCachedFacebookMetadata } from "../_cache"

const CATALOGS_TTL_MS = 15 * 60 * 1000 // 15 min — catalogs rarely change

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    const adAccountId = request.nextUrl.searchParams.get("ad_account_id") || undefined
    const cacheKey = `fb:catalogs:${ctx.orgId}:${adAccountId || "all"}`

    const { catalogs, debug } = await getCachedFacebookMetadata(
      cacheKey,
      CATALOGS_TTL_MS,
      () => getProductCatalogs(connection.access_token, adAccountId)
    )

    return NextResponse.json({ catalogs, debug })
  } catch (err: any) {
    console.error("[catalogs] error:", err)
    return NextResponse.json({ error: err.message || "Failed to fetch catalogs" }, { status: 500 })
  }
}
