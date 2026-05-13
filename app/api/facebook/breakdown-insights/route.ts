import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET ?ad_account_id=&level=campaign|adset|ad&date_preset=|time_range=&breakdowns=|time_increment=
// Calls Meta Insights API with breakdown dimensions, returns flat rows grouped by parent ID.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const adAccountId  = searchParams.get("ad_account_id")
  const level        = searchParams.get("level") || "campaign"
  const datePreset   = searchParams.get("date_preset")
  const timeRange    = searchParams.get("time_range")
  const breakdowns   = searchParams.get("breakdowns")
  const timeIncrement = searchParams.get("time_increment")

  if (!adAccountId) {
    return NextResponse.json({ error: "ad_account_id required" }, { status: 400 })
  }
  if (!breakdowns && !timeIncrement) {
    return NextResponse.json({ error: "breakdowns or time_increment required" }, { status: 400 })
  }

  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const connection = await getFacebookConnection(ctx.orgId)
  if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 401 })

  const idField = level === "campaign" ? "campaign_id" : level === "adset" ? "adset_id" : "ad_id"
  // Breakdown dimension fields (age, country, etc.) must NOT be in `fields` —
  // Meta automatically includes them in the response when `breakdowns` param is set.
  const fields = [
    idField,
    "date_start",
    "date_stop",
    "spend",
    "impressions",
    "clicks",
    "reach",
    "actions",
    "cost_per_action_type",
  ].join(",")

  const params = new URLSearchParams({
    level,
    fields,
    limit: "1000",
    access_token: connection.access_token,
  })

  if (timeRange) params.set("time_range", timeRange)
  else          params.set("date_preset", datePreset || "last_7d")

  if (breakdowns)    params.set("breakdowns", breakdowns)
  if (timeIncrement) params.set("time_increment", timeIncrement)

  try {
    const res  = await fetch(`https://graph.facebook.com/v25.0/${adAccountId}/insights?${params}`)
    const data = await res.json()

    if (data.error) {
      return NextResponse.json({ error: data.error.message || "Meta API error" }, { status: 400 })
    }

    return NextResponse.json({ data: data.data || [], paging: data.paging })
  } catch (err: any) {
    console.error("[breakdown-insights]", err)
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}
