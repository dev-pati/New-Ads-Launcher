import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getConnectionForAdAccount, getFacebookConnection } from "@/lib/auth"
import { adAccountBelongsToOrg, normalizeAdAccountId } from "../../_utils"

const GRAPH_API = "https://graph.facebook.com/v25.0"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const adAccountId = request.nextUrl.searchParams.get("ad_account_id")
    if (!adAccountId) return NextResponse.json({ error: "ad_account_id is required" }, { status: 400 })

    const connection = await getConnectionForAdAccount(ctx.orgId, adAccountId, "read")
    if (!connection) return NextResponse.json({ error: "No Facebook read connection found" }, { status: 503 })

    if (!(await adAccountBelongsToOrg(ctx.orgId, adAccountId, connection.access_token))) {
      return NextResponse.json({ error: "Ad account not in your workspace" }, { status: 403 })
    }

    const fields = [
      "id", "account_id", "name", "status", "effective_status",
      "objective", "buying_type", "special_ad_categories",
      "daily_budget", "lifetime_budget", "bid_strategy",
      "start_time", "stop_time", "created_time", "updated_time",
    ].join(",")
    const response = await fetch(`${GRAPH_API}/${id}?fields=${fields}&access_token=${connection.access_token}`)
    const campaign = await response.json()
    if (!response.ok || campaign.error) {
      const message = campaign.error?.message || "Failed to fetch campaign"
      const rateLimited = /rate limit|request limit|#4/i.test(message)
      return NextResponse.json({ error: rateLimited ? "Meta API rate limit reached" : message, rateLimited }, { status: rateLimited ? 429 : 502 })
    }

    if (campaign.account_id && normalizeAdAccountId(campaign.account_id) !== normalizeAdAccountId(adAccountId)) {
      return NextResponse.json({ error: "Campaign does not belong to this ad account" }, { status: 403 })
    }

    return NextResponse.json({ campaign })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch campaign"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const res = await fetch(`${GRAPH_API}/${id}`, {
      method: "DELETE",
      body: new URLSearchParams({ access_token: connection.access_token }),
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      const msg = data.error?.message || "Failed to delete campaign"
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete campaign" }, { status: 500 })
  }
}
