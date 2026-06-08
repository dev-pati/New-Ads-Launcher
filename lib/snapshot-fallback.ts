/**
 * Shared snapshot fallback helpers — read from DB when Meta is unavailable.
 */
import { createAdminClient } from "@/lib/supabase/admin"

function ago(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0]
}

// Parse actions array from raw_insights JSONB
function getAct(raw: any, types: string[]): number {
  const actions: any[] = raw?.actions ?? []
  return actions.filter(a => types.includes(a.action_type))
    .reduce((s, a) => s + (parseInt(a.value) || 0), 0)
}
function getActVal(raw: any, types: string[]): number {
  const vals: any[] = raw?.action_values ?? []
  return vals.filter(a => types.includes(a.action_type))
    .reduce((s, a) => s + (parseFloat(a.value) || 0), 0)
}

function parseActionsFromRaw(raw: any, spend: number, impressions: number, clicks: number) {
  const initiateCheckout  = getAct(raw, ["offsite_conversion.fb_pixel_initiate_checkout","initiate_checkout"])
  const addPaymentInfo    = getAct(raw, ["offsite_conversion.fb_pixel_add_payment_info","add_payment_info"])
  const registrations     = getAct(raw, ["complete_registration"])
  const contentViews      = getAct(raw, ["offsite_conversion.fb_pixel_view_content"])
  const appInstalls       = getAct(raw, ["mobile_app_install","app_install"])
  const appActivations    = getAct(raw, ["app_activation"])
  const postEngagements   = getAct(raw, ["post_engagement"])
  const postReactions     = getAct(raw, ["post_reaction"])
  const pageEngagements   = getAct(raw, ["page_engagement"])
  const like              = getAct(raw, ["like"])
  const comment           = getAct(raw, ["comment"])
  const results           = getAct(raw, ["offsite_conversion.fb_pixel_purchase","purchase","lead","complete_registration","link_click","post_engagement"])
  const addToCart         = getAct(raw, ["add_to_cart","offsite_conversion.fb_pixel_add_to_cart"])

  return {
    initiateCheckout, addPaymentInfo, registrations, contentViews,
    appInstalls, appActivations, postEngagements, postReactions,
    pageEngagements, like, comment, results, addToCart,
    // Costs
    costPerInitiateCheckout:  initiateCheckout > 0 ? spend / initiateCheckout : 0,
    costPerAddPaymentInfo:    addPaymentInfo > 0 ? spend / addPaymentInfo : 0,
    costPerRegistration:      registrations > 0 ? spend / registrations : 0,
    costPerContentView:       contentViews > 0 ? spend / contentViews : 0,
    costPerInstall:           appInstalls > 0 ? spend / appInstalls : 0,
    costPerAppActivation:     appActivations > 0 ? spend / appActivations : 0,
    costPerPostEngagement:    postEngagements > 0 ? spend / postEngagements : 0,
    costPerPostReaction:      postReactions > 0 ? spend / postReactions : 0,
    costPerPageEngagement:    pageEngagements > 0 ? spend / pageEngagements : 0,
    costPerLike:              like > 0 ? spend / like : 0,
    costPerComment:           comment > 0 ? spend / comment : 0,
    costPerResult:            results > 0 ? spend / results : 0,
    costPerAddToCart:         addToCart > 0 ? spend / addToCart : 0,
    costPer1000Reached:       0, // requires reach not impressions
    costPerLinkClick:         clicks > 0 ? spend / clicks : 0,
  }
}

function asActId(adAccountId: string) {
  return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
}

function toInsight(row: {
  spend?: number | string | null
  impressions?: number | string | null
  clicks?: number | string | null
  reach?: number | string | null
  purchases?: number | string | null
  leads?: number | string | null
  cpa?: number | string | null
  cpc?: number | string | null
  cpm?: number | string | null
  ctr?: number | string | null
}) {
  const spend = parseFloat(String(row.spend ?? "0")) || 0
  const impressions = parseInt(String(row.impressions ?? "0"), 10) || 0
  const clicks = parseInt(String(row.clicks ?? "0"), 10) || 0
  const purchases = parseInt(String(row.purchases ?? "0"), 10) || 0
  const leads = parseInt(String(row.leads ?? "0"), 10) || 0
  const actions = [
    clicks > 0 ? { action_type: "link_click", value: String(clicks) } : null,
    purchases > 0 ? { action_type: "purchase", value: String(purchases) } : null,
    leads > 0 ? { action_type: "lead", value: String(leads) } : null,
  ].filter(Boolean)
  const costPerAction = [
    clicks > 0 ? { action_type: "link_click", value: String(spend / clicks) } : null,
    purchases > 0 ? { action_type: "purchase", value: String(spend / purchases) } : null,
    leads > 0 ? { action_type: "lead", value: String(spend / leads) } : null,
  ].filter(Boolean)

  return {
    spend: String(spend),
    impressions: String(impressions),
    clicks: String(clicks),
    reach: String(parseInt(String(row.reach ?? "0"), 10) || 0),
    cpc: String(row.cpc ?? (clicks > 0 ? spend / clicks : 0)),
    cpm: String(row.cpm ?? (impressions > 0 ? (spend / impressions) * 1000 : 0)),
    ctr: String(row.ctr ?? (impressions > 0 ? (clicks / impressions) * 100 : 0)),
    actions,
    cost_per_action_type: costPerAction,
    date_start: "",
    date_stop: "",
  }
}

export function datePresetToRange(preset: string, sinceP = "", untilP = "") {
  if (sinceP && untilP) return { since: sinceP, until: untilP }
  const now   = new Date()
  const today = now.toISOString().split("T")[0]
  if (preset === "today")      return { since: today, until: today }
  if (preset === "yesterday")  return { since: ago(1), until: ago(1) }
  if (preset === "last_7d")    return { since: ago(7), until: ago(1) }
  if (preset === "last_14d")   return { since: ago(14), until: ago(1) }
  if (preset === "last_28d")   return { since: ago(28), until: ago(1) }
  if (preset === "last_30d")   return { since: ago(30), until: ago(1) }
  if (preset === "last_90d")   return { since: ago(90), until: ago(1) }
  if (preset === "this_month") {
    const m = String(now.getMonth() + 1).padStart(2, "0")
    return { since: `${now.getFullYear()}-${m}-01`, until: today }
  }
  if (preset === "last_month") {
    const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const m = now.getMonth() === 0 ? 12 : now.getMonth()
    const last = new Date(y, m, 0)
    return { since: `${y}-${String(m).padStart(2, "0")}-01`, until: last.toISOString().split("T")[0] }
  }
  return { since: ago(30), until: ago(1) }
}

export async function campaignManagerSnapshotFallback(orgId: string, adAccountId: string, since: string, until: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from("campaign_insights_snapshots")
    .select("fb_campaign_id,campaign_name,campaign_status,effective_status,spend,impressions,clicks,reach,purchases,leads,cpa,cpc,cpm,ctr,date")
    .eq("org_id", orgId)
    .eq("fb_ad_account_id", asActId(adAccountId))
    .gte("date", since)
    .lte("date", until)
    .order("date", { ascending: true })

  if (error || !data?.length) return null

  const byCampaign: Record<string, any> = {}
  for (const row of data) {
    if (!byCampaign[row.fb_campaign_id]) {
      byCampaign[row.fb_campaign_id] = {
        id: row.fb_campaign_id,
        name: row.campaign_name || row.fb_campaign_id,
        status: row.campaign_status || row.effective_status || "UNKNOWN",
        effective_status: row.effective_status || row.campaign_status || "UNKNOWN",
        objective: "UNKNOWN",
        spend: 0,
        impressions: 0,
        clicks: 0,
        reach: 0,
        purchases: 0,
        leads: 0,
      }
    }
    const c = byCampaign[row.fb_campaign_id]
    c.spend += parseFloat(row.spend ?? "0") || 0
    c.impressions += row.impressions ?? 0
    c.clicks += row.clicks ?? 0
    c.reach += row.reach ?? 0
    c.purchases += row.purchases ?? 0
    c.leads += row.leads ?? 0
    c.status = row.campaign_status || c.status
    c.effective_status = row.effective_status || c.effective_status
  }

  const campaigns = Object.values(byCampaign).map((c: any) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    effective_status: c.effective_status,
    objective: c.objective,
    insights: { data: [toInsight(c)] },
  }))

  return { campaigns, fromSnapshot: true, readOnly: true }
}

export async function adsetManagerSnapshotFallback(orgId: string, adAccountId: string, campaignId: string | null, since: string, until: string) {
  const db = createAdminClient()
  let q = db
    .from("adset_insights_snapshots")
    .select("fb_campaign_id,campaign_name,fb_adset_id,adset_name,spend,impressions,clicks,reach,purchases,leads,cpa,cpc,cpm,ctr,date")
    .eq("org_id", orgId)
    .eq("fb_ad_account_id", asActId(adAccountId))
    .gte("date", since)
    .lte("date", until)
    .order("date", { ascending: true })
  if (campaignId) q = q.eq("fb_campaign_id", campaignId)

  const { data, error } = await q
  if (error || !data?.length) return null

  const byAdset: Record<string, any> = {}
  for (const row of data) {
    if (!byAdset[row.fb_adset_id]) {
      byAdset[row.fb_adset_id] = {
        id: row.fb_adset_id,
        name: row.adset_name || row.fb_adset_id,
        status: "UNKNOWN",
        effective_status: "UNKNOWN",
        campaign_id: row.fb_campaign_id,
        campaign_name: row.campaign_name,
        spend: 0,
        impressions: 0,
        clicks: 0,
        reach: 0,
        purchases: 0,
        leads: 0,
      }
    }
    const a = byAdset[row.fb_adset_id]
    a.spend += parseFloat(row.spend ?? "0") || 0
    a.impressions += row.impressions ?? 0
    a.clicks += row.clicks ?? 0
    a.reach += row.reach ?? 0
    a.purchases += row.purchases ?? 0
    a.leads += row.leads ?? 0
  }

  const adSets = Object.values(byAdset).map((a: any) => ({
    id: a.id,
    name: a.name,
    status: a.status,
    effective_status: a.effective_status,
    campaign_id: a.campaign_id,
    campaign_name: a.campaign_name,
    insights: { data: [toInsight(a)] },
  }))

  return { adSets, fromSnapshot: true, readOnly: true }
}

export async function adsManagerSnapshotFallback(orgId: string, adAccountId: string, adSetId: string | null, since: string, until: string) {
  const db = createAdminClient()
  let q = db
    .from("ad_insights_snapshots")
    .select("fb_campaign_id,campaign_name,fb_adset_id,adset_name,fb_ad_id,ad_name,ad_status,effective_status,thumbnail_url,spend,impressions,clicks,reach,purchases,leads,cpa,cpc,cpm,ctr,date")
    .eq("org_id", orgId)
    .eq("fb_ad_account_id", asActId(adAccountId))
    .gte("date", since)
    .lte("date", until)
    .order("date", { ascending: true })
  if (adSetId) q = q.eq("fb_adset_id", adSetId)

  const { data, error } = await q
  if (error || !data?.length) return null

  const byAd: Record<string, any> = {}
  for (const row of data) {
    if (!byAd[row.fb_ad_id]) {
      byAd[row.fb_ad_id] = {
        id: row.fb_ad_id,
        name: row.ad_name || row.fb_ad_id,
        status: row.ad_status || row.effective_status || "UNKNOWN",
        effective_status: row.effective_status || row.ad_status || "UNKNOWN",
        campaign_id: row.fb_campaign_id,
        adset_id: row.fb_adset_id,
        thumbnail_url: row.thumbnail_url,
        spend: 0,
        impressions: 0,
        clicks: 0,
        reach: 0,
        purchases: 0,
        leads: 0,
      }
    }
    const ad = byAd[row.fb_ad_id]
    ad.spend += parseFloat(row.spend ?? "0") || 0
    ad.impressions += row.impressions ?? 0
    ad.clicks += row.clicks ?? 0
    ad.reach += row.reach ?? 0
    ad.purchases += row.purchases ?? 0
    ad.leads += row.leads ?? 0
    ad.status = row.ad_status || ad.status
    ad.effective_status = row.effective_status || ad.effective_status
    ad.thumbnail_url = row.thumbnail_url || ad.thumbnail_url
  }

  const ads = Object.values(byAd).map((ad: any) => ({
    id: ad.id,
    name: ad.name,
    status: ad.status,
    effective_status: ad.effective_status,
    campaign_id: ad.campaign_id,
    adset_id: ad.adset_id,
    creative: ad.thumbnail_url ? { id: ad.id, thumbnail_url: ad.thumbnail_url, image_url: ad.thumbnail_url } : undefined,
    insights: { data: [toInsight(ad)] },
  }))

  return { ads, fromSnapshot: true, readOnly: true }
}

// ── Ad-level fallback (for /api/insights/report) ─────────────────────────────
export async function adSnapshotFallback(orgId: string, adAccountId: string, since: string, until: string) {
  const db    = createAdminClient()
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`

  const { data, error } = await db
    .from("ad_insights_snapshots")
    .select("fb_ad_id,ad_name,fb_campaign_id,campaign_name,fb_adset_id,adset_name,date,spend,impressions,inline_link_clicks,clicks,reach,purchases,purchase_value,leads,outbound_clicks,roas,cpa,ctr,cpm,cpc,video_views_3s,video_views_thruplay,video_p25_watched,video_p50_watched,video_p75_watched,video_p95_watched,video_p100_watched,video_30s_watched,video_avg_watch_pct,frequency,inline_link_click_ctr,thumbnail_url,raw_insights")
    .eq("org_id", orgId).eq("fb_ad_account_id", actId)
    .gte("date", since).lte("date", until)
    .order("spend", { ascending: false }).limit(500)

  if (error || !data?.length) return null

  // Aggregate per ad
  const byAd: Record<string, any> = {}
  for (const row of data) {
    if (!byAd[row.fb_ad_id]) {
      byAd[row.fb_ad_id] = {
        adId: row.fb_ad_id, adName: row.ad_name,
        campaignId: row.fb_campaign_id, campaignName: row.campaign_name,
        adsetId: row.fb_adset_id, adsetName: row.adset_name,
        thumbnailUrl: row.thumbnail_url,
        spend: 0, impressions: 0, clicks: 0, reach: 0,
        purchases: 0, purchaseValue: 0, leads: 0,
        outboundClicks: 0,
        videoViews3s: 0, videoViewsThruplay: 0,
        videoP25: 0, videoP50: 0, videoP75: 0, videoP95: 0, videoP100: 0, video30s: 0,
        frequency: 0, _rawList: [] as any[],
      }
    }
    const a = byAd[row.fb_ad_id]
    a.spend         += parseFloat(row.spend ?? "0") || 0
    a.impressions   += row.impressions ?? 0
    a.clicks        += row.inline_link_clicks ?? row.clicks ?? 0
    a.reach         += row.reach ?? 0
    a.purchases     += row.purchases ?? 0
    a.purchaseValue += parseFloat(row.purchase_value ?? "0") || 0
    a.leads         += row.leads ?? 0
    a.outboundClicks    += row.outbound_clicks ?? 0
    a.videoViews3s      += row.video_views_3s ?? 0
    a.videoViewsThruplay += row.video_views_thruplay ?? 0
    a.videoP25          += row.video_p25_watched ?? 0
    a.videoP50          += row.video_p50_watched ?? 0
    a.videoP75          += row.video_p75_watched ?? 0
    a.videoP95          += row.video_p95_watched ?? 0
    a.videoP100         += row.video_p100_watched ?? 0
    a.video30s          += row.video_30s_watched ?? 0
    a.frequency          = parseFloat(row.frequency ?? "0") || a.frequency
    if (row.raw_insights) a._rawList.push(row.raw_insights)
  }

  const ads = Object.values(byAd).map((a: any) => {
    // Merge actions from all raw_insights rows for this ad
    const mergedRaw = { actions: [] as any[], action_values: [] as any[] }
    for (const r of a._rawList) {
      mergedRaw.actions.push(...(r.actions ?? []))
      mergedRaw.action_values.push(...(r.action_values ?? []))
    }
    const extra = parseActionsFromRaw(mergedRaw, a.spend, a.impressions, a.clicks)

    return {
      adId: a.adId, adName: a.adName,
      campaignId: a.campaignId, campaignName: a.campaignName,
      adsetId: a.adsetId, adsetName: a.adsetName,
      thumbnailUrl: a.thumbnailUrl,
      spend: a.spend, impressions: a.impressions, linkClicks: a.clicks,
      reach: a.reach, frequency: a.frequency,
      purchases: a.purchases, purchaseValue: a.purchaseValue, leads: a.leads,
      outboundClicks: a.outboundClicks,
      roas:  a.spend > 0 ? a.purchaseValue / a.spend : 0,
      cpa:   a.purchases > 0 ? a.spend / a.purchases : 0,
      ctr:   a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
      cpm:   a.impressions > 0 ? (a.spend / a.impressions) * 1000 : 0,
      cpc:   a.clicks > 0 ? a.spend / a.clicks : 0,
      video3s: a.videoViews3s, thruplay: a.videoViewsThruplay,
      videoP25: a.videoP25, videoP50: a.videoP50, videoP75: a.videoP75,
      videoP95: a.videoP95, videoP100: a.videoP100, video30s: a.video30s,
      avgWatchTime: 0,
      ...extra,
    }
  }).sort((a, b) => b.spend - a.spend)

  return { ads, fromSnapshot: true }
}

// ── Breakdown fallback ────────────────────────────────────────────────────────
export async function breakdownSnapshotFallback(
  orgId: string, adAccountId: string,
  since: string, until: string,
  types: string[]
) {
  const db    = createAdminClient()
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`

  const { data, error } = await db
    .from("insights_breakdown_snapshots")
    .select("breakdown_type,breakdown_value,spend,impressions,clicks,purchases,purchase_value,leads,roas,ctr,cpm,cpc,cpa")
    .eq("org_id", orgId).eq("fb_ad_account_id", actId)
    .in("breakdown_type", types)
    .gte("date_start", since)
    .order("spend", { ascending: false })

  if (error || !data?.length) return null

  const grouped: Record<string, any[]> = {}
  for (const row of data) {
    if (!grouped[row.breakdown_type]) grouped[row.breakdown_type] = []
    grouped[row.breakdown_type].push(row)
  }

  return { breakdowns: grouped, fromSnapshot: true }
}

// ── Page insights fallback ────────────────────────────────────────────────────
export async function pageSnapshotFallback(orgId: string, pageId: string, days = 30) {
  const db    = createAdminClient()
  const since = ago(days)

  const { data, error } = await db
    .from("page_insights_snapshots")
    .select("date,fans,new_fans,reach,impressions,organic_reach,paid_reach,engaged_users,post_engagements,reactions,page_views,page_name")
    .eq("org_id", orgId).eq("fb_page_id", pageId)
    .gte("date", since).order("date", { ascending: true })

  if (error || !data?.length) return null

  const latest = data[data.length - 1]
  const totals = data.reduce((acc, d) => ({
    reach:           acc.reach + (d.reach ?? 0),
    impressions:     acc.impressions + (d.impressions ?? 0),
    engaged_users:   acc.engaged_users + (d.engaged_users ?? 0),
    post_engagements: acc.post_engagements + (d.post_engagements ?? 0),
    new_fans:        acc.new_fans + (d.new_fans ?? 0),
  }), { reach: 0, impressions: 0, engaged_users: 0, post_engagements: 0, new_fans: 0 })

  return {
    pageId, pageName: latest.page_name,
    fans: latest.fans,
    daily: data,
    totals,
    fromSnapshot: true,
    snapshotDate: latest.date,
  }
}

// ── Adset-level fallback (for /api/insights/statistics/spend) ─────────────────
export async function adsetSnapshotFallback(orgId: string, adAccountId: string, since: string, until: string) {
  const db    = createAdminClient()
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`

  const { data, error } = await db
    .from("adset_insights_snapshots")
    .select("fb_campaign_id,campaign_name,fb_adset_id,adset_name,date,spend,impressions,clicks,purchases,purchase_value,leads,roas,cpa,ctr,cpm,cpc")
    .eq("org_id", orgId).eq("fb_ad_account_id", actId)
    .gte("date", since).lte("date", until)
    .order("date", { ascending: true })

  if (error || !data?.length) return null

  // Group by campaign → adsets
  const byCampaign: Record<string, any> = {}
  const dailySpend: Record<string, number> = {}

  for (const row of data) {
    if (!byCampaign[row.fb_campaign_id]) {
      byCampaign[row.fb_campaign_id] = { campaignId: row.fb_campaign_id, campaignName: row.campaign_name, spend: 0, adsets: {} }
    }
    const c = byCampaign[row.fb_campaign_id]
    c.spend += parseFloat(row.spend ?? "0") || 0
    if (!c.adsets[row.fb_adset_id]) {
      c.adsets[row.fb_adset_id] = { adsetId: row.fb_adset_id, adsetName: row.adset_name, spend: 0, daily: [] }
    }
    c.adsets[row.fb_adset_id].spend += parseFloat(row.spend ?? "0") || 0
    c.adsets[row.fb_adset_id].daily.push(row)
    dailySpend[row.date] = (dailySpend[row.date] ?? 0) + (parseFloat(row.spend ?? "0") || 0)
  }

  const campaigns = Object.values(byCampaign).map((c: any) => ({
    ...c, adsets: Object.values(c.adsets)
  })).sort((a: any, b: any) => b.spend - a.spend)

  const daily = Object.entries(dailySpend).sort(([a], [b]) => a.localeCompare(b))
    .map(([date, spend]) => ({ date, spend }))

  return { campaigns, daily, fromSnapshot: true }
}

// ── Reach fallback (for /api/insights/statistics/reach) ──────────────────────
export async function reachSnapshotFallback(orgId: string, adAccountId: string, since: string, until: string) {
  const db    = createAdminClient()
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`

  const { data, error } = await db
    .from("campaign_insights_snapshots")
    .select("date,reach,impressions,spend,clicks")
    .eq("org_id", orgId).eq("fb_ad_account_id", actId)
    .gte("date", since).lte("date", until)
    .order("date", { ascending: true })

  if (error || !data?.length) return null

  const byDate: Record<string, any> = {}
  for (const row of data) {
    if (!byDate[row.date]) byDate[row.date] = { date: row.date, reach: 0, impressions: 0, spend: 0 }
    byDate[row.date].reach       += row.reach ?? 0
    byDate[row.date].impressions += row.impressions ?? 0
    byDate[row.date].spend       += parseFloat(row.spend ?? "0") || 0
  }
  const daily = Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date))
  const totalReach = daily.reduce((s, d) => s + d.reach, 0)
  const totalImpr  = daily.reduce((s, d) => s + d.impressions, 0)
  const avgFreq    = totalReach > 0 ? totalImpr / totalReach : 0

  return { daily, totalReach, totalImpressions: totalImpr, avgFrequency: avgFreq, fromSnapshot: true }
}

// ── Top creatives fallback (for /api/insights/top-creatives) ─────────────────
export async function topCreativesSnapshotFallback(orgId: string, adAccountId: string, since: string, until: string, limit = 50) {
  const db    = createAdminClient()
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`

  const { data, error } = await db
    .from("ad_insights_snapshots")
    .select("fb_ad_id,ad_name,fb_campaign_id,campaign_name,fb_adset_id,adset_name,spend,impressions,inline_link_clicks,clicks,reach,purchases,purchase_value,leads,outbound_clicks,roas,cpa,ctr,cpm,cpc,video_views_3s,video_views_thruplay,video_p25_watched,video_p50_watched,video_p75_watched,video_p95_watched,video_p100_watched,video_30s_watched,video_avg_watch_pct,frequency,thumbnail_url,raw_insights")
    .eq("org_id", orgId).eq("fb_ad_account_id", actId)
    .gte("date", since).lte("date", until)
    .order("spend", { ascending: false }).limit(500)

  if (error || !data?.length) return null

  const byAd: Record<string, any> = {}
  for (const row of data) {
    if (!byAd[row.fb_ad_id]) {
      byAd[row.fb_ad_id] = {
        adId: row.fb_ad_id, adName: row.ad_name,
        campaignName: row.campaign_name, adsetName: row.adset_name,
        thumbnailUrl: row.thumbnail_url,
        spend: 0, impressions: 0, clicks: 0, reach: 0,
        purchases: 0, purchaseValue: 0, leads: 0, outboundClicks: 0,
        videoViews3s: 0, videoViewsThruplay: 0,
        videoP25: 0, videoP50: 0, videoP75: 0, videoP95: 0, videoP100: 0, video30s: 0,
        frequency: 0, _rawList: [] as any[],
      }
    }
    const a = byAd[row.fb_ad_id]
    a.spend         += parseFloat(row.spend ?? "0") || 0
    a.impressions   += row.impressions ?? 0
    a.clicks        += row.inline_link_clicks ?? row.clicks ?? 0
    a.reach         += row.reach ?? 0
    a.purchases     += row.purchases ?? 0
    a.purchaseValue += parseFloat(row.purchase_value ?? "0") || 0
    a.leads         += row.leads ?? 0
    a.outboundClicks    += row.outbound_clicks ?? 0
    a.videoViews3s      += row.video_views_3s ?? 0
    a.videoViewsThruplay += row.video_views_thruplay ?? 0
    a.videoP25          += row.video_p25_watched ?? 0
    a.videoP50          += row.video_p50_watched ?? 0
    a.videoP75          += row.video_p75_watched ?? 0
    a.videoP95          += row.video_p95_watched ?? 0
    a.videoP100         += row.video_p100_watched ?? 0
    a.video30s          += row.video_30s_watched ?? 0
    a.frequency          = parseFloat(row.frequency ?? "0") || a.frequency
    if (row.raw_insights) a._rawList.push(row.raw_insights)
  }

  const ads = Object.values(byAd).map((a: any) => {
    const mergedRaw = { actions: [] as any[], action_values: [] as any[] }
    for (const r of a._rawList) {
      mergedRaw.actions.push(...(r.actions ?? []))
      mergedRaw.action_values.push(...(r.action_values ?? []))
    }
    const extra = parseActionsFromRaw(mergedRaw, a.spend, a.impressions, a.clicks)
    return {
      adId: a.adId, adName: a.adName,
      campaignName: a.campaignName, adsetName: a.adsetName,
      thumbnailUrl: a.thumbnailUrl,
      spend: a.spend, impressions: a.impressions, linkClicks: a.clicks,
      reach: a.reach, frequency: a.frequency,
      purchases: a.purchases, purchaseValue: a.purchaseValue, leads: a.leads,
      outboundClicks: a.outboundClicks,
      roas:  a.spend > 0 ? a.purchaseValue / a.spend : 0,
      cpa:   a.purchases > 0 ? a.spend / a.purchases : 0,
      ctr:   a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
      cpm:   a.impressions > 0 ? (a.spend / a.impressions) * 1000 : 0,
      cpc:   a.clicks > 0 ? a.spend / a.clicks : 0,
      video3s: a.videoViews3s, thruplay: a.videoViewsThruplay,
      videoP25: a.videoP25, videoP50: a.videoP50, videoP75: a.videoP75,
      videoP95: a.videoP95, videoP100: a.videoP100, video30s: a.video30s,
      avgWatchTime: 0,
      ...extra,
    }
  }).sort((a, b) => b.spend - a.spend).slice(0, limit)

  return { ads, fromSnapshot: true }
}

// ── Pacing fallback (for /api/insights/pacing) ────────────────────────────────
export async function pacingSnapshotFallback(orgId: string, adAccountId: string) {
  const db    = createAdminClient()
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
  const now   = new Date()
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`

  const { data, error } = await db
    .from("campaign_insights_snapshots")
    .select("date,spend")
    .eq("org_id", orgId).eq("fb_ad_account_id", actId)
    .gte("date", firstOfMonth)
    .order("date", { ascending: true })

  if (error || !data?.length) return null

  const totalSpend = data.reduce((s, r) => s + (parseFloat(r.spend ?? "0") || 0), 0)
  const daysElapsed = data.length
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dailyAvg    = daysElapsed > 0 ? totalSpend / daysElapsed : 0
  const projected   = dailyAvg * daysInMonth

  return {
    totalSpend, dailyAvg, projected, daysElapsed, daysInMonth,
    daily: data.map(r => ({ date: r.date, spend: parseFloat(r.spend ?? "0") || 0 })),
    fromSnapshot: true,
  }
}

// ── All accounts fallback (for /api/insights/statistics/all-accounts) ─────────
export async function allAccountsSnapshotFallback(orgId: string, adAccountIds: string[], since: string, until: string) {
  const db = createAdminClient()
  const actIds = adAccountIds.map(id => id.startsWith("act_") ? id : `act_${id}`)

  const { data, error } = await db
    .from("campaign_insights_snapshots")
    .select("fb_ad_account_id,date,spend,impressions,clicks,purchases,purchase_value,leads,roas")
    .eq("org_id", orgId)
    .in("fb_ad_account_id", actIds)
    .gte("date", since).lte("date", until)

  if (error || !data?.length) return null

  const byAccount: Record<string, any> = {}
  for (const row of data) {
    if (!byAccount[row.fb_ad_account_id]) {
      byAccount[row.fb_ad_account_id] = { accountId: row.fb_ad_account_id, spend: 0, impressions: 0, clicks: 0, purchases: 0, purchaseValue: 0, leads: 0 }
    }
    const a = byAccount[row.fb_ad_account_id]
    a.spend         += parseFloat(row.spend ?? "0") || 0
    a.impressions   += row.impressions ?? 0
    a.clicks        += row.clicks ?? 0
    a.purchases     += row.purchases ?? 0
    a.purchaseValue += parseFloat(row.purchase_value ?? "0") || 0
    a.leads         += row.leads ?? 0
  }

  const accounts = Object.values(byAccount).map((a: any) => ({
    ...a,
    roas: a.spend > 0 ? a.purchaseValue / a.spend : 0,
    cpa:  a.purchases > 0 ? a.spend / a.purchases : 0,
  })).sort((a: any, b: any) => b.spend - a.spend)

  return { accounts, fromSnapshot: true }
}
