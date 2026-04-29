import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getCampaigns } from "@/lib/facebook"

export async function GET(request: NextRequest) {
  try {
    const adAccountId = request.nextUrl.searchParams.get("ad_account_id")
    if (!adAccountId) return NextResponse.json({ error: "ad_account_id is required" }, { status: 400 })

    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection found" }, { status: 401 })

    const campaigns = await getCampaigns(adAccountId, connection.access_token)
    return NextResponse.json({ campaigns })
  } catch (err) {
    console.error("Failed to fetch campaigns:", err)
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 })
  }
}
