import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getProductCatalogs } from "@/lib/facebook"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    const adAccountId = request.nextUrl.searchParams.get("ad_account_id") || undefined
    const { catalogs, debug } = await getProductCatalogs(connection.access_token, adAccountId)
    console.log("[catalogs] fetch debug:", debug)
    return NextResponse.json({ catalogs, debug })
  } catch (err: any) {
    console.error("[catalogs] error:", err)
    return NextResponse.json({ error: err.message || "Failed to fetch catalogs" }, { status: 500 })
  }
}
