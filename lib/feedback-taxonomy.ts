// Shared feedback taxonomy — one source of truth for the feedback bubble form,
// the API validation, and the admin inbox filters. Covers 100% of current
// dashboard routes (see components/app-sidebar.tsx + app/(dashboard)/**/page.tsx).

export type FeedbackFunction = {
  value: string
  label: string
  routes: readonly string[]
}

export type FeedbackArea = {
  area: string
  label: string
  functions: readonly FeedbackFunction[]
}

export const FEEDBACK_FEATURES: readonly FeedbackArea[] = [
  { area: "search", label: "Search", functions: [
    { value: "search", label: "Search", routes: ["/search"] },
  ]},
  { area: "launch", label: "Launch", functions: [
    { value: "ad_launcher", label: "Ad Launcher", routes: ["/launch"] },
    { value: "ads_manager", label: "Ads Manager", routes: ["/ads-manager"] },
    { value: "campaigns", label: "Campaigns", routes: ["/campaigns"] },
    { value: "ads", label: "Ads", routes: ["/ads"] },
    { value: "templates", label: "Templates", routes: ["/templates"] },
    { value: "presets", label: "Presets", routes: ["/presets"] },
    { value: "upload_ads", label: "Upload Ads", routes: ["/upload-ads"] },
  ]},
  { area: "assets", label: "Assets", functions: [
    { value: "all_assets", label: "All Assets", routes: ["/assets"] },
  ]},
  { area: "insights", label: "Insights", functions: [
    { value: "reports", label: "Reports / Insights", routes: ["/insights"] },
  ]},
  { area: "page_manager", label: "Page Manager", functions: [
    { value: "page_manager", label: "Page Manager", routes: ["/page-manager"] },
    { value: "pages", label: "Pages", routes: ["/pages"] },
  ]},
  { area: "automate", label: "Automate", functions: [
    { value: "automations", label: "Automations", routes: ["/automate", "/automate/[id]"] },
    { value: "rules", label: "Rules", routes: ["/automate/rules"] },
  ]},
  { area: "connect", label: "Connect", functions: [
    { value: "connect", label: "Connect", routes: ["/connect"] },
    { value: "rate_limit", label: "Rate Limit", routes: ["/rate-limit"] },
    { value: "ad_accounts", label: "Ad Accounts", routes: ["/ad-accounts"] },
  ]},
  { area: "inspo", label: "Inspo", functions: [
    { value: "inspo", label: "Inspo", routes: ["/inspo"] },
  ]},
  { area: "workspace", label: "Workspace", functions: [
    { value: "projects_lobby", label: "Lobby / Projects", routes: ["/projects"] },
    { value: "create_org", label: "Create Organization", routes: ["/create-org"] },
    { value: "organization_settings", label: "Organization Settings", routes: ["/settings/organization"] },
  ]},
  { area: "account", label: "Account", functions: [
    { value: "settings", label: "Settings", routes: ["/settings"] },
    { value: "rewards", label: "Rewards", routes: ["/rewards"] },
  ]},
  { area: "other", label: "Other", functions: [
    { value: "other", label: "Other / unknown route", routes: [] },
  ]},
] as const

export const FEEDBACK_TYPES = [
  { value: "bug", label: "Bug" },
  { value: "output_wrong", label: "Output wrong" },
  { value: "data_mismatch", label: "Data mismatch" },
  { value: "ux_friction", label: "UX friction" },
  { value: "performance", label: "Performance" },
  { value: "missing_feature", label: "Missing feature" },
  { value: "permission_or_connection", label: "Permission / connection" },
  { value: "copy_or_content", label: "Copy / content" },
  { value: "other", label: "Other" },
] as const

export const FEEDBACK_SEVERITIES = [
  { value: "critical", label: "Critical", description: "Blocks launch/report/use" },
  { value: "high", label: "High", description: "Serious wrong output/risk" },
  { value: "medium", label: "Medium", description: "Slows work, workaround exists" },
  { value: "low", label: "Low", description: "Polish / request" },
] as const

export const FEEDBACK_STATUSES = ["open", "doing", "done", "rejected"] as const

export type FeedbackType = (typeof FEEDBACK_TYPES)[number]["value"]
export type FeedbackSeverity = (typeof FEEDBACK_SEVERITIES)[number]["value"]
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]

const FEEDBACK_TYPE_SET = new Set(FEEDBACK_TYPES.map((t) => t.value))
const FEEDBACK_SEVERITY_SET = new Set(FEEDBACK_SEVERITIES.map((s) => s.value))
const FEEDBACK_STATUS_SET = new Set<string>(FEEDBACK_STATUSES)

export function isValidFeedbackType(v: string): v is FeedbackType {
  return FEEDBACK_TYPE_SET.has(v as FeedbackType)
}
export function isValidSeverity(v: string): v is FeedbackSeverity {
  return FEEDBACK_SEVERITY_SET.has(v as FeedbackSeverity)
}
export function isValidStatus(v: string): v is FeedbackStatus {
  return FEEDBACK_STATUS_SET.has(v)
}

/** True when `area` + `function` is a real pair in the taxonomy. */
export function isValidFeaturePair(area: string, fn: string): boolean {
  const a = FEEDBACK_FEATURES.find((x) => x.area === area)
  if (!a) return false
  return a.functions.some((f) => f.value === fn)
}

export function functionsForArea(area: string): readonly FeedbackFunction[] {
  return FEEDBACK_FEATURES.find((x) => x.area === area)?.functions ?? []
}

/**
 * Map a pathname to its { area, function } by longest route-prefix match.
 * Static routes win over dynamic; unknown paths fall to Other / other.
 */
export function resolveFeatureByPath(pathname: string): { area: string; fn: string } {
  const path = pathname.split("?")[0].replace(/\/+$/, "") || "/"
  let best: { area: string; fn: string; len: number } | null = null

  for (const area of FEEDBACK_FEATURES) {
    for (const fn of area.functions) {
      for (const route of fn.routes) {
        // Ignore dynamic segments for matching; compare static prefix.
        const staticRoute = route.replace(/\/\[[^\]]+\]/g, "")
        if (path === staticRoute || path.startsWith(staticRoute + "/")) {
          if (!best || staticRoute.length > best.len) {
            best = { area: area.area, fn: fn.value, len: staticRoute.length }
          }
        }
      }
    }
  }

  return best ? { area: best.area, fn: best.fn } : { area: "other", fn: "other" }
}
