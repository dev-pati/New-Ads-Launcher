/**
 * Meta Trigger Checker
 * Evaluates each Meta automation trigger against live Meta API data.
 * Called by the daily cron job /api/cron/check-meta-triggers.
 */

const GRAPH = "https://graph.facebook.com/v21.0"

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function metaGet(path: string, token: string) {
  const sep = path.includes("?") ? "&" : "?"
  const res = await fetch(`${GRAPH}${path}${sep}access_token=${token}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error.message ?? "Meta API error")
  return data
}

function matchesNameFilter(
  name: string,
  filter: "all" | "name_contains" | "name_equals" | string | undefined,
  value?: string
): boolean {
  if (!filter || filter === "all") return true
  if (!value) return true
  const n = name.toLowerCase()
  const v = value.toLowerCase()
  if (filter === "name_contains") return n.includes(v)
  if (filter === "name_equals")   return n === v
  return true
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600_000).toISOString()
}

function daysAgo(d: number) {
  return new Date(Date.now() - d * 86_400_000).toISOString().split("T")[0]
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TriggerCheckResult {
  fired: boolean
  reason: string
  entityIds?: string[]
  entityNames?: string[]
  metaData?: Record<string, any>
}

// ─── 1. Ad Approved ──────────────────────────────────────────────────────────

export async function checkAdApproved(
  triggerConfig: any,
  token: string
): Promise<TriggerCheckResult> {
  const adAccountId   = triggerConfig.adAccountIds?.[0]
  const lookback      = triggerConfig.lookbackWindow ?? "24h"
  const hoursMap: Record<string, number> = { "1h": 1, "6h": 6, "12h": 12, "24h": 24, "48h": 48 }
  const hours         = hoursMap[lookback] ?? 24
  const since         = Math.floor((Date.now() - hours * 3600_000) / 1000)

  if (!adAccountId) return { fired: false, reason: "No ad account configured" }

  const fields = "id,name,effective_status,adset_id,campaign_id,adset{name},campaign{name},updated_time"
  const data   = await metaGet(
    `/${adAccountId}/ads?fields=${encodeURIComponent(fields)}&effective_status=["ACTIVE"]&limit=200`,
    token
  )

  let ads: any[] = data.data || []

  // Filter by updated_time within lookback
  ads = ads.filter(ad => {
    const updated = ad.updated_time ? Math.floor(new Date(ad.updated_time).getTime() / 1000) : 0
    return updated >= since
  })

  // Campaign filter
  ads = ads.filter(ad => matchesNameFilter(
    ad.campaign?.name ?? "",
    triggerConfig.campaignFilter,
    triggerConfig.campaignNameFilterValue
  ))

  // Ad Set filter
  ads = ads.filter(ad => matchesNameFilter(
    ad.adset?.name ?? "",
    triggerConfig.adSetFilter,
    triggerConfig.adSetNameFilterValue
  ))

  if (ads.length === 0) return { fired: false, reason: `No ads approved in last ${lookback}` }
  return {
    fired: true,
    reason: `${ads.length} ad(s) approved in last ${lookback}`,
    entityIds: ads.map(a => a.id),
    entityNames: ads.map(a => a.name),
    metaData: { ads: ads.map(a => ({ id: a.id, name: a.name, adset: a.adset?.name, campaign: a.campaign?.name })) },
  }
}

// ─── 2. Campaign Status Change ────────────────────────────────────────────────

export async function checkCampaignStatusChange(
  triggerConfig: any,
  token: string
): Promise<TriggerCheckResult> {
  const adAccountId = triggerConfig.adAccountIds?.[0]
  const targetStatus = triggerConfig.campaignStatusTarget ?? "active"

  if (!adAccountId) return { fired: false, reason: "No ad account configured" }

  const statusMap: Record<string, string> = {
    active:         "ACTIVE",
    paused:         "PAUSED",
    with_issues:    "WITH_ISSUES",
    pending_review: "PENDING_REVIEW",
    archived:       "ARCHIVED",
  }
  const effectiveStatus = statusMap[targetStatus] ?? "ACTIVE"

  const data = await metaGet(
    `/${adAccountId}/campaigns?fields=id,name,status,effective_status&effective_status=["${effectiveStatus}"]&limit=200`,
    token
  )

  let campaigns: any[] = data.data || []

  // Campaign filter
  campaigns = campaigns.filter(c => matchesNameFilter(
    c.name,
    triggerConfig.campaignFilter,
    triggerConfig.campaignNameFilterValue
  ))

  if (campaigns.length === 0) return { fired: false, reason: `No campaigns with status ${targetStatus}` }
  return {
    fired: true,
    reason: `${campaigns.length} campaign(s) with status ${targetStatus}`,
    entityIds: campaigns.map(c => c.id),
    entityNames: campaigns.map(c => c.name),
    metaData: { campaigns: campaigns.map(c => ({ id: c.id, name: c.name, status: c.effective_status })) },
  }
}

// ─── 3. Performance Threshold ─────────────────────────────────────────────────

const METRIC_FIELD_MAP: Record<string, string> = {
  spend:              "spend",
  cost_per_result:    "cost_per_action_type",
  purchase_roas:      "purchase_roas",
  cpa:                "cost_per_action_type",
  cpm:                "cpm",
  cpc:                "cpc",
  ctr_all:            "ctr",
  link_ctr:           "outbound_clicks_ctr",
  frequency:          "frequency",
  impressions:        "impressions",
  reach:              "reach",
  clicks:             "clicks",
  conversions:        "actions",
  purchases:          "actions",
  purchase_value:     "action_values",
  cost_per_purchase:  "cost_per_action_type",
  leads:              "actions",
  cost_per_lead:      "cost_per_action_type",
  add_to_cart:        "actions",
  cost_per_atc:       "cost_per_action_type",
  hook_rate:          "video_thruplay_watched_actions",
  hold_rate:          "video_p25_watched_actions",
  thruplay_rate:      "video_thruplay_watched_actions",
  video_views:        "video_30_sec_watched_actions",
  thruplays:          "video_thruplay_watched_actions",
  cost_per_thruplay:  "cost_per_thruplay",
  link_clicks:        "outbound_clicks",
  cost_per_link_click:"cost_per_outbound_click",
  landing_page_views: "landing_page_view",
  cost_per_lpv:       "cost_per_action_type",
}

function extractMetricValue(ins: any, metric: string): number {
  if (!ins) return 0
  switch (metric) {
    case "spend":        return parseFloat(ins.spend || "0")
    case "cpm":          return parseFloat(ins.cpm || "0")
    case "cpc":          return parseFloat(ins.cpc || "0")
    case "ctr_all":      return parseFloat((ins.ctr || [])[0]?.value || ins.ctr || "0")
    case "frequency":    return parseFloat(ins.frequency || "0")
    case "impressions":  return parseInt(ins.impressions || "0")
    case "reach":        return parseInt(ins.reach || "0")
    case "clicks":       return parseInt(ins.clicks || "0")
    case "purchase_roas": {
      const roas = ins.purchase_roas || []
      return parseFloat(roas[0]?.value || "0")
    }
    case "purchases":
    case "conversions":
    case "add_to_cart":
    case "leads": {
      const actionMap: Record<string, string> = {
        purchases: "omni_purchase", conversions: "offsite_conversion.fb_pixel_purchase",
        add_to_cart: "add_to_cart", leads: "lead",
      }
      const at = actionMap[metric] ?? metric
      const actions: any[] = ins.actions || []
      return parseInt(actions.find((a: any) => a.action_type === at)?.value || "0")
    }
    case "purchase_value": {
      const vals: any[] = ins.action_values || []
      return parseFloat(vals.find((v: any) => v.action_type === "omni_purchase")?.value || "0")
    }
    default: return 0
  }
}

function evalCondition(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case ">":  return value > threshold
    case "<":  return value < threshold
    case ">=": return value >= threshold
    case "<=": return value <= threshold
    case "=":  return Math.abs(value - threshold) < 0.001
    default:   return false
  }
}

export async function checkPerformanceThreshold(
  triggerConfig: any,
  token: string
): Promise<TriggerCheckResult> {
  const adAccountId  = triggerConfig.adAccountIds?.[0]
  const conditions   = triggerConfig.thresholdConditions ?? [{ metric: "spend", operator: ">", value: 0 }]
  const period       = triggerConfig.thresholdPerformancePeriod ?? "7d"
  const adStatus     = triggerConfig.thresholdAdStatus ?? "all"

  if (!adAccountId) return { fired: false, reason: "No ad account configured" }
  if (conditions.length === 0) return { fired: false, reason: "No conditions defined" }

  const datePresetMap: Record<string, string> = {
    "lifetime": "lifetime", "1d": "yesterday", "3d": "last_3d",
    "7d": "last_7d", "14d": "last_14d", "30d": "last_30d",
  }
  const datePreset = datePresetMap[period] ?? "last_7d"

  // Get unique Meta field names
  const fields = ["spend", "cpm", "cpc", "ctr", "impressions", "reach", "clicks",
    "frequency", "purchase_roas", "actions", "action_values", "cost_per_action_type",
    "outbound_clicks", "outbound_clicks_ctr", "video_thruplay_watched_actions"].join(",")

  const statusFilter = adStatus === "active" ? `&effective_status=["ACTIVE"]`
    : adStatus === "paused" ? `&effective_status=["PAUSED"]` : ""

  const data = await metaGet(
    `/${adAccountId}/ads?fields=id,name,adset_id,adset{name},campaign_id,campaign{name},effective_status,insights.date_preset(${datePreset}){${fields}}&limit=200${statusFilter}`,
    token
  )

  let ads: any[] = data.data || []

  // Campaign filter
  ads = ads.filter(ad => matchesNameFilter(
    ad.campaign?.name ?? "",
    triggerConfig.campaignFilter,
    triggerConfig.campaignNameFilterValue
  ))

  // Ad Set filter
  if (triggerConfig.thresholdAdSetFilter === "name_contains" && triggerConfig.thresholdAdSetFilterValue) {
    const v = triggerConfig.thresholdAdSetFilterValue.toLowerCase()
    ads = ads.filter(ad => (ad.adset?.name ?? "").toLowerCase().includes(v))
  }

  // Only include ads with spend (default behavior)
  if (adStatus === "all") {
    ads = ads.filter(ad => {
      const ins = ad.insights?.data?.[0]
      return ins && parseFloat(ins.spend || "0") > 0
    })
  }

  // Lookback period filter (ads created within N days)
  if (triggerConfig.thresholdLookbackPeriod && triggerConfig.thresholdLookbackPeriod !== "all") {
    const daysMap: Record<string, number> = { "7d": 7, "14d": 14, "30d": 30, "60d": 60, "90d": 90 }
    const days = daysMap[triggerConfig.thresholdLookbackPeriod]
    if (days) {
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
      ads = ads.filter((ad: any) => (ad.created_time ?? "") >= cutoff)
    }
  }

  // Apply conditions
  const matched = ads.filter(ad => {
    const ins = ad.insights?.data?.[0]
    if (!ins) return false
    return conditions.every((cond: any) => {
      const value = extractMetricValue(ins, cond.metric)
      return evalCondition(value, cond.operator, cond.value)
    })
  })

  if (matched.length === 0) return { fired: false, reason: "No ads match threshold conditions" }

  const conditionDesc = conditions.map((c: any) => `${c.metric} ${c.operator} ${c.value}`).join(" AND ")
  return {
    fired: true,
    reason: `${matched.length} ad(s) match: ${conditionDesc}`,
    entityIds: matched.map((a: any) => a.id),
    entityNames: matched.map((a: any) => a.name),
    metaData: {
      period: datePreset,
      conditions,
      ads: matched.map((a: any) => ({
        id: a.id, name: a.name,
        adset: a.adset?.name, campaign: a.campaign?.name,
        metrics: a.insights?.data?.[0] ?? {},
      })),
    },
  }
}

// ─── 4. Performance Monitoring ────────────────────────────────────────────────

export async function checkPerformanceMonitoring(
  triggerConfig: any,
  token: string
): Promise<TriggerCheckResult> {
  const adAccountId      = triggerConfig.adAccountIds?.[0]
  const monitoringLevel  = triggerConfig.monitoringLevel ?? "account"
  const comparisonWindow = triggerConfig.comparisonWindow ?? "day_over_day"
  const conditions: any[] = triggerConfig.metricConditions ?? []

  if (!adAccountId) return { fired: false, reason: "No ad account configured" }
  if (conditions.length === 0) return { fired: false, reason: "No metric conditions defined" }

  const levelMap: Record<string, string> = { account: "account", campaign: "campaign", adset: "adset", ad: "ad" }
  const level = levelMap[monitoringLevel] ?? "account"

  const metricFields = "spend,cpa,purchase_roas,cpm,cpc,ctr,impressions,conversions,actions,cost_per_action_type"

  // Fetch two periods for comparison
  const [periodA, periodB] = comparisonWindow === "week_over_week"
    ? ["last_7d", "last_14d"]   // approximate: this week vs last week
    : ["yesterday", "last_2d"]  // day over day

  const entityId = level === "account" ? adAccountId : adAccountId

  const [dataA, dataB] = await Promise.all([
    metaGet(`/act_${adAccountId.replace("act_","")}/insights?date_preset=${periodA}&level=${level}&fields=${metricFields}&limit=50`, token),
    metaGet(`/act_${adAccountId.replace("act_","")}/insights?date_preset=${periodB}&level=${level}&fields=${metricFields}&limit=50`, token),
  ])

  const rowA = dataA.data?.[0]
  const rowB = dataB.data?.[0]

  if (!rowA) return { fired: false, reason: "No insights data for current period" }

  // Evaluate conditions
  const failures: string[] = []
  const matches: string[]  = []

  for (const cond of conditions) {
    const metric = cond.metric as string
    const op     = cond.operator as string
    const val    = cond.value as number
    const unit   = cond.unit as string

    const getVal = (row: any): number => {
      switch (metric) {
        case "spend":        return parseFloat(row?.spend || "0")
        case "cpm":          return parseFloat(row?.cpm || "0")
        case "cpc":          return parseFloat(row?.cpc || "0")
        case "ctr":          return parseFloat((row?.ctr || [])[0]?.value || row?.ctr || "0")
        case "impressions":  return parseInt(row?.impressions || "0")
        case "purchase_roas":return parseFloat((row?.purchase_roas || [])[0]?.value || "0")
        case "cpa": {
          const cpa = (row?.cost_per_action_type || []).find((x: any) => x.action_type === "omni_purchase")
          return parseFloat(cpa?.value || "0")
        }
        case "conversions": {
          const conv = (row?.actions || []).find((x: any) => x.action_type === "omni_purchase")
          return parseInt(conv?.value || "0")
        }
        default: return 0
      }
    }

    const valA = getVal(rowA)
    const valB = getVal(rowB)
    if (valB === 0) continue

    const changePct = ((valA - valB) / valB) * 100

    let condMet = false
    if (op === "increases_by") condMet = changePct >= val
    else if (op === "decreases_by") condMet = changePct <= -val
    else if (op === "is_above") condMet = valA > val
    else if (op === "is_below") condMet = valA < val

    const desc = `${metric}: ${valA.toFixed(2)} (${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%)`
    if (condMet) matches.push(desc)
    else failures.push(desc)
  }

  const allMet = failures.length === 0 && matches.length === 0
    ? false
    : failures.length === 0

  if (!allMet) return { fired: false, reason: `Conditions not met: ${failures.join(", ")}` }

  return {
    fired: true,
    reason: `All conditions met: ${matches.join(", ")}`,
    entityIds: [adAccountId],
    metaData: { periodA, periodB, matchedConditions: matches, currentMetrics: rowA },
  }
}

// ─── 5. Best Performing Organic Post ─────────────────────────────────────────

export async function checkBestPerformingOrganicPost(
  triggerConfig: any,
  token: string
): Promise<TriggerCheckResult> {
  const pageId        = triggerConfig.organicPageId
  const rankingMetric = triggerConfig.organicRankingMetric ?? "engagement"
  const lookbackDays  = triggerConfig.organicLookbackDays ?? 7
  const minValue      = triggerConfig.organicMinMetricValue ?? 0
  const topN          = triggerConfig.organicTopPostsCount ?? 1

  if (!pageId) return { fired: false, reason: "No Facebook Page selected" }

  const since = daysAgo(lookbackDays)
  const fields = "id,message,created_time,full_picture,reactions.summary(true),comments.summary(true),shares,insights.metric(post_impressions,post_reach,post_video_views)"

  const data = await metaGet(
    `/${pageId}/posts?fields=${encodeURIComponent(fields)}&since=${since}&limit=50`,
    token
  )

  let posts: any[] = data.data || []

  // Score each post
  const scored = posts.map(post => {
    const reactions  = post.reactions?.summary?.total_count ?? 0
    const comments   = post.comments?.summary?.total_count  ?? 0
    const shares     = post.shares?.count                   ?? 0
    const impressions = (post.insights?.data || []).find((d: any) => d.name === "post_impressions")?.values?.[0]?.value ?? 0
    const reach      = (post.insights?.data || []).find((d: any) => d.name === "post_reach")?.values?.[0]?.value ?? 0
    const videoViews = (post.insights?.data || []).find((d: any) => d.name === "post_video_views")?.values?.[0]?.value ?? 0

    const score =
      rankingMetric === "engagement"   ? reactions + comments + shares :
      rankingMetric === "reach"        ? reach :
      rankingMetric === "impressions"  ? impressions :
      rankingMetric === "video_views"  ? videoViews : 0

    return { post, score, engagement: reactions + comments + shares, reach, impressions, videoViews }
  })

  // Filter by minimum metric value
  const qualifying = scored
    .filter(s => s.score >= minValue)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)

  if (qualifying.length === 0) {
    return { fired: false, reason: `No posts meet minimum ${rankingMetric} threshold of ${minValue}` }
  }

  return {
    fired: true,
    reason: `Top ${qualifying.length} post(s) by ${rankingMetric}: scores ${qualifying.map(q => q.score).join(", ")}`,
    entityIds: qualifying.map(q => q.post.id),
    entityNames: qualifying.map(q => (q.post.message ?? "").slice(0, 60) || q.post.id),
    metaData: {
      rankingMetric,
      posts: qualifying.map(q => ({
        id: q.post.id,
        message: (q.post.message ?? "").slice(0, 120),
        created_time: q.post.created_time,
        picture: q.post.full_picture,
        score: q.score,
        engagement: q.engagement,
        reach: q.reach,
        impressions: q.impressions,
      })),
    },
  }
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export async function checkMetaTrigger(
  triggerConfig: any,
  token: string
): Promise<TriggerCheckResult> {
  const event = triggerConfig.event as string

  switch (event) {
    case "ad_approved":
      return checkAdApproved(triggerConfig, token)
    case "campaign_status_change":
      return checkCampaignStatusChange(triggerConfig, token)
    case "spend_threshold":
      return checkPerformanceThreshold(triggerConfig, token)
    case "performance_monitoring":
      return checkPerformanceMonitoring(triggerConfig, token)
    case "best_performing_organic_post":
      return checkBestPerformingOrganicPost(triggerConfig, token)
    default:
      return { fired: false, reason: `Unknown event type: ${event}` }
  }
}
