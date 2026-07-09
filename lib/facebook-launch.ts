import { copyAdSet, createAdSet } from "@/lib/facebook"

export async function fetchAllAds(adSetId: string, token: string): Promise<Record<string, unknown>[]> {
  const ads: Record<string, unknown>[] = []
  let url: string | null =
    `https://graph.facebook.com/v25.0/${adSetId}/ads?fields=id,name,creative{id,name}&limit=100&access_token=${token}`
  while (url) {
    try {
      const res = await fetch(url)
      if (!res.ok) break
      const data = (await res.json()) as Record<string, unknown>
      const dataList = (data.data ?? []) as Record<string, unknown>[]
      ads.push(...dataList)
      url = (data.paging as Record<string, unknown> | undefined)?.next as string | null ?? null
    } catch {
      break
    }
  }
  return ads
}

export async function buildAdset(
  adAccountId: string, token: string, template: any,
  campaignId: string, name: string, dailyBudget?: number, startTime?: string,
  pageId?: string, resolvedObjective?: string,
  pixelId?: string, pixelEvent?: string,
  status = "PAUSED"
): Promise<{ id: string; overrideWarning?: string }> {
  const OBJECTIVE_SAFE_GOAL: Record<string, string> = {
    OUTCOME_ENGAGEMENT: "POST_ENGAGEMENT",
    OUTCOME_AWARENESS: "REACH",
    OUTCOME_TRAFFIC: "LINK_CLICKS",
    OUTCOME_LEADS: "LEAD_GENERATION",
    OUTCOME_SALES: "OFFSITE_CONVERSIONS",
    OUTCOME_APP_PROMOTION: "APP_INSTALLS",
  }
  const OBJECTIVE_VALID_GOALS: Record<string, Set<string>> = {
    OUTCOME_ENGAGEMENT: new Set(["POST_ENGAGEMENT", "PAGE_LIKES", "EVENT_RESPONSES", "REACH"]),
    OUTCOME_AWARENESS: new Set(["REACH", "AD_RECALL_LIFT", "THRU_PLAYS", "IMPRESSIONS"]),
    OUTCOME_TRAFFIC: new Set(["LINK_CLICKS", "LANDING_PAGE_VIEWS", "IMPRESSIONS", "REACH"]),
    OUTCOME_LEADS: new Set(["LEAD_GENERATION", "QUALITY_LEAD", "LINK_CLICKS", "LANDING_PAGE_VIEWS"]),
    OUTCOME_SALES: new Set(["OFFSITE_CONVERSIONS", "LINK_CLICKS", "LANDING_PAGE_VIEWS", "REACH"]),
    OUTCOME_APP_PROMOTION: new Set(["APP_INSTALLS", "LINK_CLICKS", "REACH"]),
  }
  const GOAL_REMAP: Record<string, string> = {
    ENGAGED_USERS: "POST_ENGAGEMENT",
    OFFER_CLAIMS: "POST_ENGAGEMENT",
    VALUE: "OFFSITE_CONVERSIONS",
  }
  const templateAdset = (template.adset || {}) as Record<string, unknown>
  const campaignObjective: string = resolvedObjective || (template.campaign as Record<string, unknown>)?.objective as string || ""
  const rawGoal: string = templateAdset.optimization_goal as string || ""
  const remappedGoal = GOAL_REMAP[rawGoal] ?? rawGoal
  const validForObjective = OBJECTIVE_VALID_GOALS[campaignObjective]
  const optimizationGoal =
    (remappedGoal && validForObjective?.has(remappedGoal))
      ? remappedGoal
      : (OBJECTIVE_SAFE_GOAL[campaignObjective] ?? "POST_ENGAGEMENT")

  const billingEvent = optimizationGoal === "THRU_PLAYS" ? "THRU_PLAYS" : "IMPRESSIONS"
  const destinationType = campaignObjective === "OUTCOME_ENGAGEMENT" ? "ON_POST" : undefined
  const PIXEL_COMPATIBLE_OBJECTIVES = new Set(["OUTCOME_SALES", "OUTCOME_LEADS"])
  const promotedObject = pixelId && PIXEL_COMPATIBLE_OBJECTIVES.has(campaignObjective)
    ? { pixel_id: pixelId, custom_event_type: pixelEvent || "PURCHASE" }
    : (templateAdset.promoted_object || undefined)
  const rawTargeting = (templateAdset.targeting || {}) as Record<string, unknown>
  const safeTargeting: Record<string, unknown> = {}
  if (rawTargeting.geo_locations) {
    const geoRest = { ...(rawTargeting.geo_locations as Record<string, unknown>) }
    delete geoRest.location_types
    safeTargeting.geo_locations = geoRest
  }
  if (rawTargeting.age_min) safeTargeting.age_min = rawTargeting.age_min
  if (rawTargeting.age_max) safeTargeting.age_max = rawTargeting.age_max
  if (rawTargeting.genders) safeTargeting.genders = rawTargeting.genders

  let budgetCents: string | undefined
  if (dailyBudget && dailyBudget > 0) {
    budgetCents = String(Math.round(dailyBudget * 100))
  } else if (templateAdset.daily_budget) {
    budgetCents = templateAdset.daily_budget as string
  }

  if (templateAdset.id) {
    return copyAdSet(token, templateAdset.id as string, {
      campaign_id: campaignId,
      name,
      daily_budget: dailyBudget,
      start_time: startTime,
      status,
    })
  }

  return createAdSet(adAccountId, token, {
    name,
    campaign_id: campaignId,
    targeting: safeTargeting,
    optimization_goal: optimizationGoal,
    billing_event: billingEvent,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    daily_budget: budgetCents,
    status,
    start_time: startTime,
    destination_type: destinationType,
    promoted_object: promotedObject as Record<string, unknown> | undefined,
    attribution_spec: templateAdset.attribution_spec as unknown[] | undefined,
  })
}
