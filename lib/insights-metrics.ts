/**
 * Shared metric computation for the Ads Manager report (campaign / adset / ad level).
 * Source of truth for all formulas — kept here so backend + fallback use the same math.
 * Matches the Meta Ads Manager CSV export column semantics.
 */

const PURCHASE_TYPES = ["offsite_conversion.fb_pixel_purchase", "purchase"]

const RESULT_PRIORITY = [
  "offsite_conversion.fb_pixel_purchase",
  "purchase",
  "lead",
  "complete_registration",
  "landing_page_view",
  "link_click",
  "post_engagement",
]

type Actions = { action_type: string; value: string }[] | undefined
type ActionValues = { action_type: string; value: string }[] | undefined

export function pickResult(actions: Actions): number {
  if (!actions?.length) return 0
  for (const type of RESULT_PRIORITY) {
    const found = actions.find(a => a.action_type === type)
    if (found) return parseInt(found.value || "0")
  }
  return 0
}

export function getAct(actions: Actions, type: string): number {
  return parseInt(actions?.find(a => a.action_type === type)?.value || "0")
}

export function sumAction(actions: Actions, types: string[]): number {
  return (actions || []).filter(a => types.includes(a.action_type))
    .reduce((s, a) => s + parseInt(a.value || "0"), 0)
}

export function sumActionValue(values: ActionValues, types: string[]): number {
  return (values || []).filter(a => types.includes(a.action_type))
    .reduce((s, a) => s + parseFloat(a.value || "0"), 0)
}

/** Optional object metadata (creative, status, budget, etc.) merged into a row. */
export interface ObjectMeta {
  creativeId?: string
  objectType?: string
  imageUrl?: string | null
  thumbUrl?: string | null
  sizedThumb?: string | null
  thumbnail?: string | null
  createdTime?: string | null
  effectiveStatus?: string
  landingPageUrl?: string | null
  // dimension / config fields surfaced from object metadata
  bid?: number | null
  bidStrategy?: string | null
  attribution?: string | null
  budget?: number | null
  budgetType?: string | null
  startsAt?: string | null
  endsAt?: string | null
}

const safe = (v: any, def = 0): number => {
  if (v === null || v === undefined || v === "") return def
  return Number(v)
}

/**
 * Compute the full report metric set from one raw Meta insights row.
 * `meta` merges optional object-level metadata (status/creative/budget).
 */
export function computeInsightMetrics(r: any, meta: ObjectMeta = {}) {
  const spend = safe(parseFloat(r.spend || "0"))
  const results = pickResult(r.actions)
  const impressions = safe(parseInt(r.impressions || "0"))
  const linkClicks = safe(parseInt(r.inline_link_clicks || "0"))
  const reach = safe(parseInt(r.reach || "0"))
  const clicksAll = safe(parseInt(r.clicks || "0"))
  const uniqueClicks = safe(parseInt(r.unique_clicks || "0"))
  const uniqueLinkClicks = safe(parseInt(r.unique_inline_link_clicks || "0"))

  const purchaseValue = sumActionValue(r.action_values, PURCHASE_TYPES)
  const purchases = sumAction(r.actions, PURCHASE_TYPES)
  const roasRaw = safe(parseFloat(r.purchase_roas?.[0]?.value || "0"))
  const roas = roasRaw > 0 ? roasRaw : spend > 0 ? purchaseValue / spend : 0

  const video3sViews = getAct(r.actions, "video_view")
  const thruplayViews = (r.video_thruplay_watched_actions || [])
    .reduce((s: number, a: any) => s + parseInt(a.value || "0"), 0)
  const landingPageViews = sumAction(r.actions, ["landing_page_view", "omni_landing_page_view"])
  const contentViews = sumAction(r.actions, ["omni_view_content", "offsite_conversion.fb_pixel_view_content", "offsite_conversion.view_content"])

  const videoP25 = safe(parseInt(r.video_p25_watched_actions?.[0]?.value || "0"))
  const videoP50 = safe(parseInt(r.video_p50_watched_actions?.[0]?.value || "0"))
  const videoP75 = safe(parseInt(r.video_p75_watched_actions?.[0]?.value || "0"))
  const videoP95 = safe(parseInt(r.video_p95_watched_actions?.[0]?.value || "0"))
  const videoP100 = safe(parseInt(r.video_p100_watched_actions?.[0]?.value || "0"))
  const video30s = safe(parseInt(r.video_30_sec_watched_actions?.[0]?.value || "0"))
  const avgWatchTime = safe(parseFloat(r.video_avg_time_watched_actions?.[0]?.value || "0"))

  const outboundClicks = safe(parseInt(r.outbound_clicks?.[0]?.value || "0"))

  const leads = getAct(r.actions, "lead")
  const registrations = getAct(r.actions, "complete_registration")
  const addToCart = sumAction(r.actions, ["add_to_cart", "offsite_conversion.fb_pixel_add_to_cart"])
  const appInstalls = getAct(r.actions, "mobile_app_install") || getAct(r.actions, "app_install")
  const appActivations = getAct(r.actions, "app_activation")
  const postEngagements = getAct(r.actions, "post_engagement")
  const postReactions = getAct(r.actions, "post_reaction")
  const pageEngagements = getAct(r.actions, "page_engagement")
  const like = getAct(r.actions, "like")
  const comment = getAct(r.actions, "comment")
  const initiateCheckout = getAct(r.actions, "offsite_conversion.fb_pixel_initiate_checkout") || getAct(r.actions, "initiate_checkout")
  const addPaymentInfo = getAct(r.actions, "offsite_conversion.fb_pixel_add_payment_info") || getAct(r.actions, "add_payment_info")

  const ctrLink = safe(parseFloat(r.inline_link_click_ctr || "0"))
  const ctrAll = safe(parseFloat(r.ctr || "0")) || (clicksAll > 0 && impressions > 0 ? (clicksAll / impressions) * 100 : 0)
  const uniqueLinkCtr = safe(parseFloat(r.unique_link_clicks_ctr || "0"))
  const cpm = safe(parseFloat(r.cpm || "0"))
  const frequency = safe(parseFloat(r.frequency || "0"))

  const thumbnail = meta.sizedThumb || meta.imageUrl || meta.thumbUrl || meta.thumbnail || null

  return {
    // dimensions (set by caller via meta / row)
    effectiveStatus: meta.effectiveStatus || "UNKNOWN",
    bid: meta.bid ?? null,
    bidType: meta.bidStrategy ?? null,
    attributionSetting: meta.attribution ?? null,
    budget: meta.budget ?? null,
    budgetType: meta.budgetType ?? null,
    startsAt: meta.startsAt ?? null,
    endsAt: meta.endsAt ?? null,

    dateStart: r.date_start,
    dateStop: r.date_stop,
    createdTime: meta.createdTime ?? null,
    landingPageUrl: meta.landingPageUrl ?? null,
    thumbnail,
    isVideo: meta.objectType === "VIDEO",

    // core
    spend,
    impressions,
    reach,
    clicks: clicksAll,
    linkClicks,
    frequency,
    cpm,
    ctr: ctrLink,           // link CTR (existing field semantics)
    ctrAll,                 // CTR all clicks (CSV "CTR (all)")
    uniqueClicks,
    uniqueLinkClicks,
    uniqueLinkCtr,
    uniqueCtr: uniqueLinkCtr,
    costPerUniqueClick: uniqueClicks > 0 ? spend / uniqueClicks : 0,
    costPerLinkClick: linkClicks > 0 ? spend / linkClicks : 0,

    // results / purchases
    results,
    costPerResult: results > 0 ? spend / results : 0,
    purchases,
    purchaseValue,
    roas,
    avgPurchaseValue: purchases > 0 ? purchaseValue / purchases : 0,
    purchaseCR: impressions > 0 ? (purchases / impressions) * 100 : 0,
    costPerPurchase: purchases > 0 ? spend / purchases : 0,

    // funnel
    contentViews,
    costPerContentView: contentViews > 0 ? spend / contentViews : 0,
    landingPageViews,
    landingPageViewRate: linkClicks > 0 ? (landingPageViews / linkClicks) * 100 : 0,
    addToCart,
    costPerAddToCart: addToCart > 0 ? spend / addToCart : 0,
    initiateCheckout,
    costPerInitiateCheckout: initiateCheckout > 0 ? spend / initiateCheckout : 0,
    addPaymentInfo,
    costPerAddPaymentInfo: addPaymentInfo > 0 ? spend / addPaymentInfo : 0,
    leads,
    costPerLead: leads > 0 ? spend / leads : 0,
    registrations,
    costPerRegistration: registrations > 0 ? spend / registrations : 0,
    appInstalls,
    costPerInstall: appInstalls > 0 ? spend / appInstalls : 0,
    appActivations,
    costPerAppActivation: appActivations > 0 ? spend / appActivations : 0,
    costPer1000Reached: reach > 0 ? (spend / reach) * 1000 : 0,

    // engagement
    outboundClicks,
    outboundCostPer: outboundClicks > 0 ? spend / outboundClicks : 0,
    outboundCtr: impressions > 0 ? (outboundClicks / impressions) * 100 : 0,
    like,
    costPerLike: like > 0 ? spend / like : 0,
    comment,
    costPerComment: comment > 0 ? spend / comment : 0,
    pageEngagements,
    costPerPageEngagement: pageEngagements > 0 ? spend / pageEngagements : 0,
    postEngagements,
    costPerPostEngagement: postEngagements > 0 ? spend / postEngagements : 0,
    postReactions,
    costPerPostReaction: postReactions > 0 ? spend / postReactions : 0,
    costPerNewCustomer: purchases > 0 ? spend / purchases : 0,

    // video
    video3s: video3sViews,
    costPer3s: video3sViews > 0 ? spend / video3sViews : 0,
    thruplay: thruplayViews,
    costPerThruplay: thruplayViews > 0 ? spend / thruplayViews : 0,
    vtr: impressions > 0 ? (thruplayViews / impressions) * 100 : 0,
    thumbstopRate: impressions > 0 ? (video3sViews / impressions) * 100 : 0,
    holdRate: video3sViews > 0 ? (thruplayViews / video3sViews) * 100 : 0,
    videoP25, videoP50, videoP75, videoP95, videoP100,
    video30s,
    avgWatchTime,
    watchRate25: video3sViews > 0 ? (videoP25 / video3sViews) * 100 : 0,
    watchRate50: video3sViews > 0 ? (videoP50 / video3sViews) * 100 : 0,
    watchRate75: video3sViews > 0 ? (videoP75 / video3sViews) * 100 : 0,
    watchRate95: video3sViews > 0 ? (videoP95 / video3sViews) * 100 : 0,
    watchRate100: video3sViews > 0 ? (videoP100 / video3sViews) * 100 : 0,
    costPerVideoP25: videoP25 > 0 ? spend / videoP25 : 0,
    costPerVideoP50: videoP50 > 0 ? spend / videoP50 : 0,
    costPerVideoP75: videoP75 > 0 ? spend / videoP75 : 0,
    costPerVideoP95: videoP95 > 0 ? spend / videoP95 : 0,
    costPerVideoP100: videoP100 > 0 ? spend / videoP100 : 0,
  }
}

/** Map a Meta effective_status to a human delivery label like the CSV export. */
export function deliveryLabel(status?: string): string {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE": return "Active"
    case "PAUSED": return "Paused"
    case "ARCHIVED":
    case "DELETED": return "Archived"
    case "DISAPPROVED": return "Rejected"
    case "PENDING_REVIEW":
    case "IN_PROCESS": return "In review"
    case "WITH_ISSUES": return "Not delivering"
    case "CAMPAIGN_PAUSED":
    case "ADSET_PAUSED": return "Paused (parent)"
    default: return status ? status : "Unknown"
  }
}

/** Convert attribution_spec → readable label. Best-effort; falls back to raw. */
export function attributionLabel(spec: any): string | null {
  if (!spec) return null
  try {
    const arr = Array.isArray(spec) ? spec : [spec]
    const parts = arr.map((s: any) => {
      const w = s.event_sources ? "" : ""
      const cap = s.value && Array.isArray(s.value) ? s.value.join(" & ") : (s.value ?? "")
      return `${cap}${w}`.trim()
    }).filter(Boolean)
    return parts.length ? parts.join(", ") : JSON.stringify(spec)
  } catch {
    return null
  }
}

/** Minor units (cents) → currency number, if Meta returned an integer-looking budget. */
export function budgetFromMinor(v: any): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  // Meta budgets are integers in account currency's minor units when stringified as e.g. "5000" => $50
  return Number.isInteger(n) && n > 100 ? n / 100 : n
}
