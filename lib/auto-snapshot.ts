/**
 * Auto-snapshot: saves all Meta Ads metrics to DB in background.
 * Called fire-and-forget from insights routes after successful Meta fetch.
 * Runs once per account per day — checks staleness before fetching.
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { metaFetch }         from "@/app/api/facebook/_meta-fetch"

const GRAPH = "https://graph.facebook.com/v25.0"

function ago(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0]
}

function sumAction(actions: any[], types: string[]) {
  return (actions ?? []).filter(a => types.includes(a.action_type))
    .reduce((s, a) => s + (parseInt(a.value) || 0), 0)
}
function sumActionValue(values: any[], types: string[]) {
  return (values ?? []).filter(a => types.includes(a.action_type))
    .reduce((s, a) => s + (parseFloat(a.value) || 0), 0)
}
const PURCHASE_TYPES = ["omni_purchase", "offsite_conversion.fb_pixel_purchase", "purchase"]
const LEAD_TYPES     = ["lead", "offsite_conversion.fb_pixel_lead"]

async function isStale(table: string, orgId: string, fb_ad_account_id: string): Promise<boolean> {
  const db = createAdminClient()
  const { data } = await db.from(table as any)
    .select("snapped_at").eq("org_id", orgId)
    .eq("fb_ad_account_id", fb_ad_account_id)
    .order("snapped_at", { ascending: false }).limit(1).maybeSingle()
  if (!data?.snapped_at) return true
  return (Date.now() - new Date(data.snapped_at).getTime()) > 23 * 3_600_000
}

// ── Campaign-level snapshot ──────────────────────────────────────────────────
async function snapshotCampaigns(orgId: string, actId: string, token: string, days: number) {
  const since = ago(days), until = ago(1)
  const fields = [
    "campaign_id","campaign_name","spend","impressions","clicks","reach",
    "actions","action_values","purchase_roas","cpm","cpc","ctr","date_start",
  ].join(",")
  const data = await metaFetch(
    `${GRAPH}/${actId}/insights?fields=${encodeURIComponent(fields)}&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&level=campaign&time_increment=1&limit=500&access_token=${token}`,
    { caller: "auto-snapshot/campaign" }
  )
  const insights: any[] = data.data ?? []
  if (!insights.length) return
  const now = new Date().toISOString()
  const rows = insights.map((ins: any) => {
    const spend = parseFloat(ins.spend ?? "0") || 0
    const purchases = sumAction(ins.actions, PURCHASE_TYPES)
    const purchaseVal = sumActionValue(ins.action_values, PURCHASE_TYPES)
    return {
      org_id: orgId, fb_ad_account_id: actId,
      fb_campaign_id: ins.campaign_id, campaign_name: ins.campaign_name,
      date: ins.date_start, spend,
      impressions: parseInt(ins.impressions ?? "0") || 0,
      clicks: parseInt(ins.clicks ?? "0") || 0,
      reach: parseInt(ins.reach ?? "0") || 0,
      purchases, purchase_value: purchaseVal,
      leads: sumAction(ins.actions, LEAD_TYPES),
      add_to_carts: sumAction(ins.actions, ["add_to_cart"]),
      roas: parseFloat((ins.purchase_roas ?? [])[0]?.value ?? "0") || null,
      cpa: purchases > 0 ? spend / purchases : null,
      ctr: parseFloat(ins.ctr ?? "0") || 0,
      cpm: parseFloat(ins.cpm ?? "0") || 0,
      cpc: parseFloat(ins.cpc ?? "0") || 0,
      raw_insights: ins, snapped_at: now,
    }
  })
  const db = createAdminClient()
  await db.from("campaign_insights_snapshots")
    .upsert(rows, { onConflict: "org_id,fb_campaign_id,date" })
  console.log(`[auto-snapshot] campaigns: ${rows.length} rows for ${actId}`)
}

// ── Ad-level snapshot ────────────────────────────────────────────────────────
async function snapshotAds(orgId: string, actId: string, token: string, days: number) {
  const since = ago(days), until = ago(1)
  const fields = [
    "ad_id","ad_name","adset_id","adset_name","campaign_id","campaign_name",
    "spend","impressions","clicks","reach","frequency",
    "actions","action_values","purchase_roas","cpm","cpc","ctr",
    "video_3_sec_watched_actions","video_thruplay_watched_actions","video_avg_time_watched_actions",
    "date_start",
  ].join(",")
  const data = await metaFetch(
    `${GRAPH}/${actId}/insights?fields=${encodeURIComponent(fields)}&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&level=ad&time_increment=1&limit=500&access_token=${token}`,
    { caller: "auto-snapshot/ad" }
  )
  const insights: any[] = data.data ?? []
  if (!insights.length) return
  const now = new Date().toISOString()
  const rows = insights.map((ins: any) => {
    const spend = parseFloat(ins.spend ?? "0") || 0
    const purchases = sumAction(ins.actions, PURCHASE_TYPES)
    const purchaseVal = sumActionValue(ins.action_values, PURCHASE_TYPES)
    return {
      org_id: orgId, fb_ad_account_id: actId,
      fb_campaign_id: ins.campaign_id, campaign_name: ins.campaign_name,
      fb_adset_id: ins.adset_id, adset_name: ins.adset_name,
      fb_ad_id: ins.ad_id, ad_name: ins.ad_name,
      date: ins.date_start, spend,
      impressions: parseInt(ins.impressions ?? "0") || 0,
      clicks: parseInt(ins.clicks ?? "0") || 0,
      reach: parseInt(ins.reach ?? "0") || 0,
      frequency: parseFloat(ins.frequency ?? "0") || null,
      purchases, purchase_value: purchaseVal,
      leads: sumAction(ins.actions, LEAD_TYPES),
      add_to_carts: sumAction(ins.actions, ["add_to_cart"]),
      roas: parseFloat((ins.purchase_roas ?? [])[0]?.value ?? "0") || null,
      cpa: purchases > 0 ? spend / purchases : null,
      ctr: parseFloat(ins.ctr ?? "0") || 0,
      cpm: parseFloat(ins.cpm ?? "0") || 0,
      cpc: parseFloat(ins.cpc ?? "0") || 0,
      video_views_3s: parseInt((ins.video_3_sec_watched_actions ?? [])[0]?.value ?? "0") || 0,
      video_views_thruplay: parseInt((ins.video_thruplay_watched_actions ?? [])[0]?.value ?? "0") || 0,
      video_avg_watch_pct: parseFloat((ins.video_avg_time_watched_actions ?? [])[0]?.value ?? "0") || null,
      raw_insights: ins, snapped_at: now,
    }
  })
  const db = createAdminClient()
  await db.from("ad_insights_snapshots")
    .upsert(rows, { onConflict: "org_id,fb_ad_id,date" })
  console.log(`[auto-snapshot] ads: ${rows.length} rows for ${actId}`)
}

// ── Breakdown snapshot (age/gender/country/device) ───────────────────────────
async function snapshotBreakdowns(orgId: string, actId: string, token: string, since: string, until: string) {
  const breakdowns = [
    { type: "age",              field: "age" },
    { type: "gender",           field: "gender" },
    { type: "country",          field: "country" },
    { type: "device",           field: "impression_device" },
    { type: "publisher_platform", field: "publisher_platform" },
  ]
  const db  = createAdminClient()
  const now = new Date().toISOString()
  for (const { type, field } of breakdowns) {
    try {
      const fields = "spend,impressions,clicks,reach,actions,action_values,purchase_roas,cpm,cpc,ctr"
      const data = await metaFetch(
        `${GRAPH}/${actId}/insights?fields=${encodeURIComponent(fields)}&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&breakdowns=${field}&limit=200&access_token=${token}`,
        { caller: `auto-snapshot/breakdown/${type}` }
      )
      const rows = (data.data ?? []).map((ins: any) => {
        const spend = parseFloat(ins.spend ?? "0") || 0
        const purchases = sumAction(ins.actions, PURCHASE_TYPES)
        const purchaseVal = sumActionValue(ins.action_values, PURCHASE_TYPES)
        return {
          org_id: orgId, fb_ad_account_id: actId,
          date_start: since, date_end: until,
          breakdown_type: type,
          breakdown_value: ins[field] ?? "unknown",
          spend, impressions: parseInt(ins.impressions ?? "0") || 0,
          clicks: parseInt(ins.clicks ?? "0") || 0,
          reach: parseInt(ins.reach ?? "0") || 0,
          purchases, purchase_value: purchaseVal,
          leads: sumAction(ins.actions, LEAD_TYPES),
          roas: parseFloat((ins.purchase_roas ?? [])[0]?.value ?? "0") || null,
          cpa: purchases > 0 ? spend / purchases : null,
          ctr: parseFloat(ins.ctr ?? "0") || 0,
          cpm: parseFloat(ins.cpm ?? "0") || 0,
          cpc: parseFloat(ins.cpc ?? "0") || 0,
          raw_data: ins, snapped_at: now,
        }
      })
      if (rows.length) {
        await db.from("insights_breakdown_snapshots")
          .upsert(rows, { onConflict: "org_id,fb_ad_account_id,date_start,date_end,breakdown_type,breakdown_value" })
      }
    } catch (e) {
      console.warn(`[auto-snapshot] breakdown/${type} failed:`, e)
    }
  }
  console.log(`[auto-snapshot] breakdowns done for ${actId}`)
}

// ── Page insights snapshot ───────────────────────────────────────────────────
export async function snapshotPageInsights(
  orgId: string, pageId: string, pageName: string, pageToken: string, days = 30
): Promise<void> {
  try {
    const db    = createAdminClient()
    const since = ago(days), until = ago(1)
    const metrics = [
      "page_fans","page_fan_adds","page_impressions_unique","page_impressions",
      "page_impressions_organic_unique","page_impressions_paid_unique",
      "page_engaged_users","page_post_engagements","page_reactions_total",
      "page_views_total",
    ].join(",")
    const data = await metaFetch(
      `${GRAPH}/${pageId}/insights?metric=${encodeURIComponent(metrics)}&period=day&since=${since}&until=${until}&access_token=${pageToken}`,
      { caller: "auto-snapshot/page" }
    )
    // Page insights returns per-metric arrays — pivot to per-date rows
    const byDate: Record<string, any> = {}
    for (const metricObj of data.data ?? []) {
      for (const val of metricObj.values ?? []) {
        const date = val.end_time?.split("T")[0]
        if (!date) continue
        if (!byDate[date]) byDate[date] = { date }
        byDate[date][metricObj.name] = val.value ?? 0
      }
    }
    const now  = new Date().toISOString()
    const rows = Object.values(byDate).map((d: any) => ({
      org_id: orgId, fb_page_id: pageId, page_name: pageName, date: d.date,
      fans:              d.page_fans ?? 0,
      new_fans:          d.page_fan_adds ?? 0,
      reach:             d.page_impressions_unique ?? 0,
      impressions:       d.page_impressions ?? 0,
      organic_reach:     d.page_impressions_organic_unique ?? 0,
      paid_reach:        d.page_impressions_paid_unique ?? 0,
      engaged_users:     d.page_engaged_users ?? 0,
      post_engagements:  d.page_post_engagements ?? 0,
      reactions:         d.page_reactions_total ?? 0,
      page_views:        d.page_views_total ?? 0,
      raw_insights: d, snapped_at: now,
    }))
    if (rows.length) {
      await db.from("page_insights_snapshots")
        .upsert(rows, { onConflict: "org_id,fb_page_id,date" })
      console.log(`[auto-snapshot] page ${pageId}: ${rows.length} rows`)
    }
  } catch (err) {
    console.warn("[auto-snapshot] page insights failed:", err)
  }
}

// ── Main entry point ─────────────────────────────────────────────────────────
export async function autoSnapshotIfStale(
  orgId: string,
  adAccountId: string,
  accessToken: string,
  days = 7,
): Promise<void> {
  try {
    const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const stale = await isStale("campaign_insights_snapshots", orgId, actId)
    if (!stale) return

    // Run all snapshots in parallel (fire-and-forget per type)
    const since = ago(days), until = ago(1)
    await Promise.allSettled([
      snapshotCampaigns(orgId, actId, accessToken, days),
      snapshotAds(orgId, actId, accessToken, days),
      snapshotBreakdowns(orgId, actId, accessToken, since, until),
    ])
  } catch (err) {
    console.warn("[auto-snapshot] Failed silently:", err)
  }
}
