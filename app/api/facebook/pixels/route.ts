import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getPixels } from "@/lib/facebook"
import { getCachedFacebookMetadata } from "../_cache"
import { adAccountBelongsToOrg } from "../_utils"

const PIXELS_TTL_MS = 2 * 60 * 1000

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection found" }, { status: 401 })

    const url = new URL(request.url)
    const adAccountId = url.searchParams.get("ad_account_id")
    if (!adAccountId) {
      return NextResponse.json({ error: "Missing ad_account_id parameter" }, { status: 400 })
    }

    const allowed = await adAccountBelongsToOrg(ctx.orgId, adAccountId, connection.access_token)
    if (!allowed) {
      return NextResponse.json({ error: "Ad account not found in workspace" }, { status: 403 })
    }

    const pixels = await getCachedFacebookMetadata(
      `fb:pixels:${ctx.orgId}:${adAccountId}`,
      PIXELS_TTL_MS,
      () => getPixels(adAccountId, connection.access_token)
    )
    return NextResponse.json({ pixels })
  } catch (err) {
    console.error("Failed to fetch pixels:", err)
    return NextResponse.json({ error: "Failed to fetch pixels" }, { status: 500 })
  }
}
