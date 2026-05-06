import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getAdSets } from "@/lib/facebook"

export async function GET(request: NextRequest) {
  try {
    const adAccountId = request.nextUrl.searchParams.get("ad_account_id")
    const campaignId = request.nextUrl.searchParams.get("campaign_id")
    const datePreset = request.nextUrl.searchParams.get("date_preset") || "last_7d"
    if (!adAccountId) return NextResponse.json({ error: "ad_account_id is required" }, { status: 400 })

    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection found" }, { status: 401 })

    const adSets = await getAdSets(adAccountId, connection.access_token, campaignId || undefined, datePreset)
    return NextResponse.json({ adSets })
  } catch (err: any) {
    console.error("Failed to fetch ad sets:", err)
    return NextResponse.json({ error: err.message || "Failed to fetch ad sets" }, { status: 500 })
  }
}
