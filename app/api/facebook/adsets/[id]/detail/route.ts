import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

const GRAPH_API_BASE = "https://graph.facebook.com/v25.0"

// GET /api/facebook/adsets/[id]/detail
// Returns full ad set info + parent campaign info for the duplicate modal preview
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    // Mock mode
    if (process.env.MOCK_META_API === "true") {
      return NextResponse.json({
        adSet: {
          id,
          name: "SR-EN-GP-LDP-Adv_GhostKitchen || Top15 || 22/01/2026_Seth - Copy",
          status: "ACTIVE",
          effective_status: "ACTIVE",
          daily_budget: "71692",
          start_time: "2026-02-17T00:00:00+0000",
          pacing_type: ["standard"],
          optimization_goal: "OFFSITE_CONVERSIONS",
          billing_event: "IMPRESSIONS",
          destination_type: "UNDEFINED",
          attribution_spec: [{ event_type: "CLICK_THROUGH", window_days: 7 }, { event_type: "VIEW_THROUGH", window_days: 1 }],
          targeting: {
            geo_locations: { countries: ["US", "IE", "IT", "NL", "NO", "CA", "CH", "GB", "BE", "GR", "AU", "AT", "PL", "CZ", "SK", "CY", "FR", "DE"] },
            age_min: 18,
            age_max: 65,
            genders: [],
          },
          ad_count: 3,
        },
        campaign: {
          id: "cmp_mock",
          name: "Mock Campaign",
          objective: "OUTCOME_SALES",
          daily_budget: "71692",
          buying_type: "AUCTION",
          special_ad_categories: [],
          is_cbo: true,
        },
        mock: true,
      })
    }

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    // Fetch ad set with all relevant fields
    const adsetFields = [
      "id", "name", "status", "effective_status",
      "daily_budget", "lifetime_budget",
      "start_time", "end_time",
      "pacing_type",
      "optimization_goal", "billing_event", "bid_strategy",
      "destination_type", "attribution_spec",
      "targeting{geo_locations,age_min,age_max,genders,custom_audiences,excluded_custom_audiences}",
      "campaign_id",
      "ads.summary(true){id}",
    ].join(",")

    const adsetRes = await fetch(`${GRAPH_API_BASE}/${id}?fields=${adsetFields}&access_token=${connection.access_token}`)
    const adsetData = await adsetRes.json()
    if (!adsetRes.ok) {
      const msg = adsetData.error?.message || "Failed to fetch ad set"
      if (/rate limit|#4|request limit/i.test(msg)) {
        return NextResponse.json({ error: "Rate limited", rateLimited: true }, { status: 429 })
      }
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    // Fetch parent campaign
    const campaignFields = ["id", "name", "objective", "daily_budget", "lifetime_budget", "buying_type", "special_ad_categories"].join(",")
    let campaignData: any = null
    if (adsetData.campaign_id) {
      const cRes = await fetch(`${GRAPH_API_BASE}/${adsetData.campaign_id}?fields=${campaignFields}&access_token=${connection.access_token}`)
      if (cRes.ok) {
        campaignData = await cRes.json()
        // Detect CBO: campaign has budget set
        campaignData.is_cbo = !!(campaignData.daily_budget || campaignData.lifetime_budget)
      }
    }

    return NextResponse.json({
      adSet: {
        ...adsetData,
        ad_count: adsetData.ads?.summary?.total_count ?? 0,
      },
      campaign: campaignData,
    })
  } catch (err: any) {
    console.error("[adset detail] error:", err)
    return NextResponse.json({ error: err.message || "Failed to fetch detail" }, { status: 500 })
  }
}
