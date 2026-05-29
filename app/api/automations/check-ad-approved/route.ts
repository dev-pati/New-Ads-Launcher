import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const GRAPH_API = "https://graph.facebook.com/v21.0"

const LOOKBACK_MS: Record<string, number> = {
  "1h":  1 * 60 * 60 * 1000,
  "6h":  6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "48h": 48 * 60 * 60 * 1000,
}

// GET /api/automations/check-ad-approved?automation_id=xxx
// Polls Meta for recently approved ads matching the automation's trigger config.
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const automationId = request.nextUrl.searchParams.get("automation_id")
    if (!automationId) return NextResponse.json({ error: "automation_id required" }, { status: 400 })

    const db = createAdminClient()

    // Fetch automation
    const { data: automation, error } = await db
      .from("automations")
      .select("*")
      .eq("id", automationId)
      .eq("org_id", ctx.orgId)
      .single()

    if (error || !automation) return NextResponse.json({ error: "Automation not found" }, { status: 404 })

    const triggerConfig = automation.trigger_config as any
    const adAccountId   = triggerConfig?.adAccountIds?.[0]
    const lookback      = triggerConfig?.lookbackWindow ?? "24h"
    const lookbackMs    = LOOKBACK_MS[lookback] ?? LOOKBACK_MS["24h"]
    const sinceEpoch    = Math.floor((Date.now() - lookbackMs) / 1000)

    if (!adAccountId) return NextResponse.json({ error: "No ad account configured" }, { status: 400 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 401 })

    // Fetch ads that became ACTIVE recently (approved)
    const fields = "id,name,status,effective_status,adset_id,campaign_id,adset{name},campaign{name},updated_time,created_time"
    const url = `${GRAPH_API}/${adAccountId}/ads?fields=${encodeURIComponent(fields)}&effective_status=["ACTIVE"]&limit=100&access_token=${connection.access_token}`

    const res  = await fetch(url)
    const data = await res.json()

    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 500 })

    const allAds: any[] = data.data || []

    // Filter: updated_time within lookback window (proxy for recently approved)
    let approvedAds = allAds.filter((ad: any) => {
      const updatedEpoch = ad.updated_time ? Math.floor(new Date(ad.updated_time).getTime() / 1000) : 0
      return updatedEpoch >= sinceEpoch
    })

    // Campaign filter
    const campaignFilter = triggerConfig?.campaignFilter ?? "all"
    const campaignName   = triggerConfig?.campaignNameFilterValue ?? ""
    if (campaignFilter === "name_contains" && campaignName) {
      approvedAds = approvedAds.filter((ad: any) =>
        (ad.campaign?.name ?? "").toLowerCase().includes(campaignName.toLowerCase())
      )
    } else if (campaignFilter === "name_equals" && campaignName) {
      approvedAds = approvedAds.filter((ad: any) =>
        (ad.campaign?.name ?? "").toLowerCase() === campaignName.toLowerCase()
      )
    }

    // Ad Set filter
    const adSetFilter = triggerConfig?.adSetFilter ?? "all"
    const adSetName   = triggerConfig?.adSetNameFilterValue ?? ""
    if (adSetFilter === "name_contains" && adSetName) {
      approvedAds = approvedAds.filter((ad: any) =>
        (ad.adset?.name ?? "").toLowerCase().includes(adSetName.toLowerCase())
      )
    } else if (adSetFilter === "name_equals" && adSetName) {
      approvedAds = approvedAds.filter((ad: any) =>
        (ad.adset?.name ?? "").toLowerCase() === adSetName.toLowerCase()
      )
    }

    return NextResponse.json({
      ok: true,
      count: approvedAds.length,
      lookback,
      ads: approvedAds.map((ad: any) => ({
        id:              ad.id,
        name:            ad.name,
        status:          ad.effective_status,
        campaign_id:     ad.campaign_id,
        campaign_name:   ad.campaign?.name,
        adset_id:        ad.adset_id,
        adset_name:      ad.adset?.name,
        updated_time:    ad.updated_time,
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
