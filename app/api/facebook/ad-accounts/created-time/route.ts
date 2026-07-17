import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getConnectionForAdAccount } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GRAPH = "https://graph.facebook.com/v25.0"

// Returns the ad account's created_time so the date picker's "Maximum" preset
// can span from account creation to today. Cheap single-field Graph read.
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const adAccountId = request.nextUrl.searchParams.get("ad_account_id") || ""
    if (!adAccountId) return NextResponse.json({ error: "ad_account_id required" }, { status: 400 })

    const connection = await getConnectionForAdAccount(ctx.orgId, adAccountId, "read")
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    const actPath = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const res = await fetch(`${GRAPH}/${actPath}?fields=created_time&access_token=${connection.access_token}`)
    const data = await res.json()
    if (data.error) return NextResponse.json({ created_time: null, message: data.error.message })

    return NextResponse.json({ created_time: data.created_time || null })
  } catch (err: any) {
    return NextResponse.json({ created_time: null, message: err?.message || "Failed" }, { status: 200 })
  }
}
