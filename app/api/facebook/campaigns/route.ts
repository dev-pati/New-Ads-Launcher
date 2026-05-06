import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getCampaigns } from "@/lib/facebook"

export async function GET(request: NextRequest) {
  try {
    const adAccountId = request.nextUrl.searchParams.get("ad_account_id")
    if (!adAccountId) return NextResponse.json({ error: "ad_account_id is required" }, { status: 400 })

    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (process.env.MOCK_META_API === "true") {
      return NextResponse.json({
        campaigns: [
          { id: "120243770180320221", name: "1. TEST || CBO || Auto Bid || SR || ALL || ROAS 1.5", status: "ACTIVE", effective_status: "ACTIVE", objective: "OUTCOME_SALES", buying_type: "AUCTION", daily_budget: "71692", _adset_count: 7, _spend: 6600 },
          { id: "120238773073880403", name: "[LAB] 1. TEST || CBO || Auto Bid || MNL || Top 4 + EU || ROAS 1.5 - copy", status: "ACTIVE", effective_status: "ACTIVE", objective: "OUTCOME_SALES", buying_type: "AUCTION", _adset_count: 1, _spend: 0 },
          { id: "120238773073880404", name: "[LAB] 1. TEST || CBO || Auto Bid || MNL || Top 4 + EU || ROAS 1.5", status: "ACTIVE", effective_status: "ACTIVE", objective: "OUTCOME_SALES", _adset_count: 1, _spend: 0 },
          { id: "120238773073880405", name: "[Template] 1. TEST || CBO || Auto Bid || MNL || Top 4 + EU || ROAS 1.5", status: "PAUSED", effective_status: "PAUSED", objective: "OUTCOME_SALES", _adset_count: 1, _spend: 0 },
          { id: "120238773073880406", name: "New Engagement Campaign - Copy", status: "ACTIVE", effective_status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT", _adset_count: 1, _spend: 0 },
          { id: "120238773073880407", name: "New Engagement Campaign", status: "ACTIVE", effective_status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT", _adset_count: 1, _spend: 0 },
          { id: "120238773073880408", name: "1. Test || SR || ROAS 1.3", status: "PAUSED", effective_status: "PAUSED", objective: "OUTCOME_SALES", _adset_count: 29, _spend: 0 },
        ],
        mock: true,
      })
    }

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection found" }, { status: 401 })

    const campaigns = await getCampaigns(adAccountId, connection.access_token)
    return NextResponse.json({ campaigns })
  } catch (err) {
    console.error("Failed to fetch campaigns:", err)
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 })
  }
}
