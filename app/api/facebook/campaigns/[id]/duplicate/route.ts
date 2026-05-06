import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

const GRAPH_API_BASE = "https://graph.facebook.com/v25.0"

// POST /api/facebook/campaigns/[id]/duplicate
// Body: { customName, count, dailyBudget, lifetimeBudget, bidStrategy, launchAsActive,
//         adSetConfigs: [{ id, customName, copies, statusActive, startTime, endTime, customAttribution, deepCopy }] }
// Returns: { campaigns: [{ id, name, adSets: [...] }] }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const customName = body.customName || ""
    const count = Math.max(1, Math.min(20, body.count || 1))
    const launchAsActive = !!body.launchAsActive
    const status = launchAsActive ? "ACTIVE" : "PAUSED"
    const adSetConfigs: any[] = Array.isArray(body.adSetConfigs) ? body.adSetConfigs : []

    if (process.env.MOCK_META_API === "true") {
      const campaigns = Array.from({ length: count }, (_, i) => {
        const cid = `cmp_copy_${Date.now()}_${i}`
        const adSets = adSetConfigs.flatMap((cfg, j) => {
          const copies = Math.max(1, cfg.copies || 1)
          return Array.from({ length: copies }, (_, k) => ({
            id: `ads_copy_${Date.now()}_${i}_${j}_${k}`,
            name: (cfg.customName || `Ad Set ${j + 1}`) + (copies > 1 ? ` - ${k + 1}` : ""),
          }))
        })
        if (adSets.length === 0) {
          adSets.push({ id: `ads_copy_${Date.now()}_${i}_default`, name: "New Engagement Ad Set (copy)" })
        }
        return {
          id: cid,
          name: (customName || "Source Campaign - copy") + (count > 1 ? ` - ${i + 1}` : ""),
          adSets,
        }
      })
      return NextResponse.json({ campaigns, mock: true })
    }

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    const results: any[] = []
    for (let i = 0; i < count; i++) {
      const suffix = count > 1 ? ` - ${i + 1}` : ""
      const finalName = (customName || "Copy") + suffix

      // Step 1: Create campaign copy via Meta /copies
      const copyParams = new URLSearchParams({
        access_token: connection.access_token,
        deep_copy: "false", // we'll copy ad sets manually for fine control
        status_option: status,
      })
      const copyRes = await fetch(`${GRAPH_API_BASE}/${id}/copies?${copyParams}`, { method: "POST" })
      const copyData = await copyRes.json()
      if (!copyRes.ok) {
        const msg = copyData.error?.message || "Failed to copy campaign"
        if (/rate limit|#4|request limit/i.test(msg)) {
          return NextResponse.json({ error: "Rate limited", rateLimited: true }, { status: 429 })
        }
        return NextResponse.json({ error: msg, partialResults: results }, { status: 500 })
      }
      const newCampaignId = copyData.copied_campaign_id || copyData.id

      // Apply campaign overrides (name + budget + bid strategy)
      const updates: Record<string, string> = { name: finalName }
      if (body.dailyBudget) updates.daily_budget = String(Math.round(parseFloat(body.dailyBudget) * 100))
      if (body.lifetimeBudget) updates.lifetime_budget = String(Math.round(parseFloat(body.lifetimeBudget) * 100))
      if (body.bidStrategy && body.bidStrategy !== "inherit") updates.bid_strategy = body.bidStrategy
      try {
        const patchRes = await fetch(`${GRAPH_API_BASE}/${newCampaignId}`, {
          method: "POST",
          body: new URLSearchParams({ ...updates, access_token: connection.access_token }),
        })
        if (!patchRes.ok) console.warn("[duplicate campaign] patch warning")
      } catch {}

      // Step 2: Duplicate selected ad sets into new campaign
      const adSets: any[] = []
      for (const cfg of adSetConfigs) {
        const copies = Math.max(1, cfg.copies || 1)
        for (let k = 0; k < copies; k++) {
          const aSuffix = copies > 1 ? ` - ${k + 1}` : ""
          const adsetParams = new URLSearchParams({
            access_token: connection.access_token,
            campaign_id: newCampaignId,
            deep_copy: cfg.deepCopy ? "true" : "false",
            status_option: cfg.statusActive ? "ACTIVE" : "PAUSED",
          })
          const aRes = await fetch(`${GRAPH_API_BASE}/${cfg.id}/copies?${adsetParams}`, { method: "POST" })
          const aData = await aRes.json()
          if (aRes.ok && aData.copied_adset_id) {
            const newAdSetId = aData.copied_adset_id
            // Rename + apply schedule overrides
            const aUpdates: Record<string, string> = {}
            if (cfg.customName) aUpdates.name = cfg.customName + aSuffix
            if (cfg.startTime) aUpdates.start_time = cfg.startTime
            if (cfg.endTime) aUpdates.end_time = cfg.endTime
            if (Object.keys(aUpdates).length > 0) {
              try {
                await fetch(`${GRAPH_API_BASE}/${newAdSetId}`, {
                  method: "POST",
                  body: new URLSearchParams({ ...aUpdates, access_token: connection.access_token }),
                })
              } catch {}
            }
            adSets.push({ id: newAdSetId, name: (cfg.customName || "Ad Set") + aSuffix })
          }
        }
      }

      results.push({ id: newCampaignId, name: finalName, adSets })
    }

    return NextResponse.json({ campaigns: results })
  } catch (err: any) {
    console.error("[duplicate campaign] error:", err)
    return NextResponse.json({ error: err.message || "Failed to duplicate campaign" }, { status: 500 })
  }
}
