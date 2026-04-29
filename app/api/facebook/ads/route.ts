import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getAds } from "@/lib/facebook"

export async function GET(request: NextRequest) {
  try {
    const adAccountId = request.nextUrl.searchParams.get("ad_account_id")
    const adSetId = request.nextUrl.searchParams.get("adset_id")
    if (!adAccountId) return NextResponse.json({ error: "ad_account_id is required" }, { status: 400 })

    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection found" }, { status: 401 })

    const ads = await getAds(adAccountId, connection.access_token, adSetId || undefined)
    return NextResponse.json({ ads })
  } catch (err) {
    console.error("Failed to fetch ads:", err)
    return NextResponse.json({ error: "Failed to fetch ads" }, { status: 500 })
  }
}
