import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getConnectionForAdAccount } from "@/lib/auth"
import { getAdAccountPages, getBusinessManagers } from "@/lib/facebook"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const adAccountId = searchParams.get("ad_account_id")
    if (!adAccountId) {
      return NextResponse.json({ error: "ad_account_id is required" }, { status: 400 })
    }

    const connection = await getConnectionForAdAccount(ctx.orgId, adAccountId, "read")
    if (!connection) {
      return NextResponse.json({ error: "No Facebook connection found" }, { status: 400 })
    }

    // Fetch pages for this ad account
    const pages = await getAdAccountPages(adAccountId, connection.access_token).catch(() => [])

    // Fetch businesses for the user (or we could fetch the specific business for the ad account, but this works)
    const businesses = await getBusinessManagers(connection.access_token).catch(() => [])

    const advertisers = [
      ...pages.map(p => ({ type: "page" as const, id: p.id, name: p.name })),
      ...businesses.map(b => ({ type: "business" as const, id: b.id, name: b.name }))
    ]

    return NextResponse.json({ advertisers })
  } catch (err: any) {
    console.error("[adset-advertisers] error:", err)
    return NextResponse.json({ error: err.message || "Failed to fetch advertisers" }, { status: 500 })
  }
}
