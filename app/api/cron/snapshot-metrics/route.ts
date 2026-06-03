/**
 * GET /api/cron/snapshot-metrics
 * Daily cron — snapshots campaign performance metrics to DB.
 * Purpose: Keep data accessible even when Meta account is locked/banned.
 * Runs daily at 2am UTC (after Meta finalizes yesterday's data).
 * Auth: Bearer CRON_SECRET
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient }         from "@/lib/supabase/admin"
import { buildMetaHeaders }          from "@/lib/meta-secure-fetch"

export const runtime     = "nodejs"
export const dynamic     = "force-dynamic"
export const maxDuration = 300

const GRAPH = "https://graph.facebook.com/v25.0"

async function metaGet(path: string, token: string) {
  const res  = await fetch(`${GRAPH}${path}`, { headers: buildMetaHeaders(token) })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message ?? "Meta API error")
  return data
}

function parseMetric(val: any, defaultVal = 0): number {
  return parseFloat(String(val ?? defaultVal)) || defaultVal
}

function extractAction(actions: any[], type: string): number {
  if (!Array.isArray(actions)) return 0
  return parseInt(actions.find(a => a.action_type === type)?.value ?? "0") || 0
}

function extractActionValue(actionValues: any[], type: string): number {
  if (!Array.isArray(actionValues)) return 0
  return parseFloat(actionValues.find(a => a.action_type === type)?.value ?? "0") || 0
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db  = createAdminClient()
  const now = new Date()
  // Snapshot yesterday's data (Meta finalizes data at ~midnight)
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().split("T")[0]

  const results: { orgId: string; adAccountId: string; campaigns: number; error?: string }[] = []

  // Get all orgs with active Facebook connections
  const { data: connections } = await db
    .from("facebook_connections")
    .select("org_id, access_token")
    .eq("is_active", true)

  if (!connections?.length) {
    return NextResponse.json({ ok: true, message: "No active connections", ranAt: now.toISOString() })
  }

  // Group by org (avoid duplicate orgs)
  const orgTokens = new Map(connections.map(c => [c.org_id, c.access_token]))

  for (const [orgId, token] of orgTokens) {
    // Get all ad accounts for this org
    const { data: adAccounts } = await db
      .from("ad_accounts")
      .select("fb_ad_account_id")
      .eq("org_id", orgId)

    if (!adAccounts?.length) continue

    for (const { fb_ad_account_id } of adAccounts) {
      try {
        const fields = [
          "campaign_id", "campaign_name", "spend", "impressions", "clicks", "reach",
          "actions", "action_values", "purchase_roas", "cpm", "cpc", "ctr",
          "cost_per_action_type",
        ].join(",")

        const data = await metaGet(
          `/${fb_ad_account_id}/insights?fields=${encodeURIComponent(fields)}&time_range={"since":"${yesterday}","until":"${yesterday}"}&level=campaign&limit=100`,
          token
        )

        const insights: any[] = data.data ?? []

        if (insights.length === 0) {
          results.push({ orgId, adAccountId: fb_ad_account_id, campaigns: 0 })
          continue
        }

        // Get campaign statuses
        const campaignIds = insights.map(i => i.campaign_id).filter(Boolean)
        let statusMap: Record<string, { status: string; effective_status: string }> = {}
        if (campaignIds.length > 0) {
          const statusData = await metaGet(
            `/campaigns?ids=${campaignIds.join(",")}&fields=id,status,effective_status`,
            token
          ).catch(() => ({}))
          if (statusData) {
            for (const [id, c] of Object.entries(statusData as any)) {
              statusMap[id] = { status: (c as any).status, effective_status: (c as any).effective_status }
            }
          }
        }

        // Build upsert rows
        const rows = insights.map((ins: any) => {
          const spend        = parseMetric(ins.spend)
          const impressions  = parseInt(ins.impressions ?? "0") || 0
          const clicks       = parseInt(ins.clicks ?? "0") || 0
          const reach        = parseInt(ins.reach ?? "0") || 0
          const purchases    = extractAction(ins.actions, "omni_purchase")
          const purchaseVal  = extractActionValue(ins.action_values, "omni_purchase")
          const leads        = extractAction(ins.actions, "lead")
          const addToCart    = extractAction(ins.actions, "add_to_cart")
          const roas         = parseMetric((ins.purchase_roas ?? [])[0]?.value)
          const cpa          = purchases > 0 ? spend / purchases : null
          const ctr          = parseMetric(ins.ctr)
          const cpm          = parseMetric(ins.cpm)
          const cpc          = parseMetric(ins.cpc)
          const campaignStatus = statusMap[ins.campaign_id]

          return {
            org_id:             orgId,
            fb_ad_account_id,
            fb_campaign_id:     ins.campaign_id,
            campaign_name:      ins.campaign_name,
            date:               yesterday,
            spend, impressions, clicks, reach,
            purchases, purchase_value: purchaseVal,
            leads, add_to_carts: addToCart,
            roas:               roas || null,
            cpa:                cpa || null,
            ctr, cpm, cpc,
            campaign_status:    campaignStatus?.status ?? null,
            effective_status:   campaignStatus?.effective_status ?? null,
            raw_insights:       ins,
            snapped_at:         now.toISOString(),
          }
        })

        // Upsert (update if same campaign + date already exists)
        const { error } = await db
          .from("campaign_insights_snapshots")
          .upsert(rows, { onConflict: "org_id,fb_campaign_id,date" })

        if (error) throw new Error(error.message)

        results.push({ orgId, adAccountId: fb_ad_account_id, campaigns: rows.length })
        console.log(`[snapshot-metrics] ${fb_ad_account_id}: ${rows.length} campaigns snapped for ${yesterday}`)

      } catch (err: any) {
        console.error(`[snapshot-metrics] Error for ${fb_ad_account_id}:`, err.message)
        results.push({ orgId, adAccountId: fb_ad_account_id, campaigns: 0, error: err.message })
      }
    }
  }

  const totalCampaigns = results.reduce((s, r) => s + r.campaigns, 0)
  const errors         = results.filter(r => r.error).length

  return NextResponse.json({
    ok: true,
    date: yesterday,
    totalCampaigns,
    errors,
    results,
    ranAt: now.toISOString(),
  })
}
