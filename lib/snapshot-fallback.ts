/**
 * Shared snapshot fallback helpers — read from DB when Meta is unavailable.
 */
import { createAdminClient } from "@/lib/supabase/admin"

function ago(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0]
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

// ── Ad-level fallback (for /api/insights/report) ─────────────────────────────
export async function adSnapshotFallback(orgId: string, adAccountId: string, since: string, until: string) {
  const db    = createAdminClient()
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`

  const { data, error } = await db
    .from("ad_insights_snapshots")
    .select("fb_ad_id,ad_name,fb_campaign_id,campaign_name,fb_adset_id,adset_name,date,spend,impressions,clicks,reach,purchases,purchase_value,leads,roas,cpa,ctr,cpm,cpc,video_views_3s,video_views_thruplay,frequency")
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
        spend: 0, impressions: 0, clicks: 0, reach: 0,
        purchases: 0, purchaseValue: 0, leads: 0,
        videoViews3s: 0, videoViewsThruplay: 0,
      }
    }
    const a = byAd[row.fb_ad_id]
    a.spend         += parseFloat(row.spend ?? "0") || 0
    a.impressions   += row.impressions ?? 0
    a.clicks        += row.clicks ?? 0
    a.reach         += row.reach ?? 0
    a.purchases     += row.purchases ?? 0
    a.purchaseValue += parseFloat(row.purchase_value ?? "0") || 0
    a.leads         += row.leads ?? 0
    a.videoViews3s      += row.video_views_3s ?? 0
    a.videoViewsThruplay += row.video_views_thruplay ?? 0
  }

  const ads = Object.values(byAd).map((a: any) => ({
    ...a,
    roas: a.spend > 0 ? a.purchaseValue / a.spend : 0,
    cpa:  a.purchases > 0 ? a.spend / a.purchases : 0,
    ctr:  a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
    cpm:  a.impressions > 0 ? (a.spend / a.impressions) * 1000 : 0,
    cpc:  a.clicks > 0 ? a.spend / a.clicks : 0,
  })).sort((a, b) => b.spend - a.spend)

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
    .select("fb_ad_id,ad_name,fb_campaign_id,campaign_name,fb_adset_id,adset_name,spend,impressions,clicks,purchases,purchase_value,leads,roas,cpa,ctr,cpm,cpc,video_views_3s,video_views_thruplay,thumbnail_url")
    .eq("org_id", orgId).eq("fb_ad_account_id", actId)
    .gte("date", since).lte("date", until)
    .order("spend", { ascending: false }).limit(500)

  if (error || !data?.length) return null

  const byAd: Record<string, any> = {}
  for (const row of data) {
    if (!byAd[row.fb_ad_id]) {
      byAd[row.fb_ad_id] = { adId: row.fb_ad_id, adName: row.ad_name, campaignName: row.campaign_name, adsetName: row.adset_name, thumbnailUrl: row.thumbnail_url, spend: 0, impressions: 0, clicks: 0, purchases: 0, purchaseValue: 0, leads: 0, videoViews3s: 0, videoViewsThruplay: 0 }
    }
    const a = byAd[row.fb_ad_id]
    a.spend         += parseFloat(row.spend ?? "0") || 0
    a.impressions   += row.impressions ?? 0
    a.clicks        += row.clicks ?? 0
    a.purchases     += row.purchases ?? 0
    a.purchaseValue += parseFloat(row.purchase_value ?? "0") || 0
    a.leads         += row.leads ?? 0
    a.videoViews3s      += row.video_views_3s ?? 0
    a.videoViewsThruplay += row.video_views_thruplay ?? 0
  }

  const ads = Object.values(byAd).map((a: any) => ({
    ...a,
    roas: a.spend > 0 ? a.purchaseValue / a.spend : 0,
    cpa:  a.purchases > 0 ? a.spend / a.purchases : 0,
    ctr:  a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
    cpm:  a.impressions > 0 ? (a.spend / a.impressions) * 1000 : 0,
  })).sort((a, b) => b.spend - a.spend).slice(0, limit)

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
