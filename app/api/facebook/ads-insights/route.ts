import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

// POST { adAccountId, adIds: string[], datePreset?: string, statusOnly?: boolean }
// Returns live status + insights for a list of ad IDs via Facebook batch request.
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const { adIds, datePreset = "last_30d", statusOnly = false } = await request.json()
    if (!adIds?.length) return NextResponse.json({ insights: [] })

    const token = connection.access_token
    const fields = statusOnly
      ? "id,name,status,effective_status"
      : `id,name,status,effective_status,insights.date_preset(${datePreset}){spend,impressions,clicks,actions,cpc,cpm,ctr,reach}`

    // Facebook batch request: one HTTP call for all ads
    const batch = (adIds as string[]).map((id: string) => ({
      method: "GET",
      relative_url: `${id}?fields=${fields}`,
    }))

    const form = new URLSearchParams()
    form.append("access_token", token)
    form.append("batch", JSON.stringify(batch))

    const res = await fetch("https://graph.facebook.com/v25.0", {
      method: "POST",
      body: form,
    })

    if (!res.ok) {
      return NextResponse.json({ error: "Facebook batch request failed" }, { status: 400 })
    }

    const batchResults: Array<{ code: number; body: string }> = await res.json()

    const insights = batchResults.map((r, i) => {
      const adId = adIds[i]
      if (r.code !== 200) return { adId, name: "", status: "UNKNOWN", effectiveStatus: "UNKNOWN", spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0, reach: 0, actions: 0, costPerAction: 0 }

      const data = JSON.parse(r.body)
      const ins = data.insights?.data?.[0]
      const spend = parseFloat(ins?.spend || "0")
      const impressions = parseInt(ins?.impressions || "0")
      const clicks = parseInt(ins?.clicks || "0")
      const reach = parseInt(ins?.reach || "0")
      const ctr = parseFloat(ins?.ctr || "0")
      const cpc = parseFloat(ins?.cpc || "0")
      const cpm = parseFloat(ins?.cpm || "0")
      const actions = (ins?.actions as Array<{ action_type: string; value: string }> | undefined)
        ?.filter(a => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase")
        .reduce((sum, a) => sum + parseInt(a.value || "0"), 0) || 0
      const costPerAction = actions > 0 ? spend / actions : 0

      return {
        adId,
        name: data.name || "",
        status: data.status || "UNKNOWN",
        effectiveStatus: data.effective_status || "UNKNOWN",
        spend,
        impressions,
        clicks,
        ctr,
        cpc,
        cpm,
        reach,
        actions,
        costPerAction,
      }
    })

    return NextResponse.json({ insights })
  } catch (err: any) {
    console.error("[ads-insights]", err)
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}
