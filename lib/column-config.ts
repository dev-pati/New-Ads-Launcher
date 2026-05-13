// Config-driven column definitions for the Ads Manager table

export type ColumnTab = "key_metrics" | "tracking" | "ad_settings" | "advanced" | "custom"
export type ColumnSection =
  | "results_spend"
  | "delivery"
  | "distribution"
  | "engagement"
  | "tracking_section"
  | "ad_settings_section"
  | "advanced_section"

export interface ColumnDef {
  id: string
  label: string        // shown in modal checkbox list
  headerLabel: string  // shown in table <th>
  description: string
  tab: ColumnTab
  section: ColumnSection
  sectionLabel: string
  sortKey?: string
}

export const COLUMN_DEFS: ColumnDef[] = [
  // ── Key metrics: Results and spend ────────────────────────────────────────
  { id: "spend",             label: "Amount spent",             headerLabel: "Amount spent",       description: "Show this column in the manage table.", tab: "key_metrics", section: "results_spend",     sectionLabel: "Results and spend", sortKey: "spend"  },
  { id: "results",           label: "Results",                  headerLabel: "Results",            description: "Show this column in the manage table.", tab: "key_metrics", section: "results_spend",     sectionLabel: "Results and spend" },
  { id: "cost_per_result",   label: "Cost per result",          headerLabel: "Cost per result",    description: "Show this column in the manage table.", tab: "key_metrics", section: "results_spend",     sectionLabel: "Results and spend" },
  { id: "budget",            label: "Daily budget",             headerLabel: "Daily budget",       description: "Show this column in the manage table.", tab: "key_metrics", section: "results_spend",     sectionLabel: "Results and spend", sortKey: "budget" },
  { id: "lifetime_budget",   label: "Lifetime Budget",          headerLabel: "Lifetime budget",    description: "Show this column in the manage table.", tab: "key_metrics", section: "results_spend",     sectionLabel: "Results and spend" },
  { id: "purchases",         label: "Purchases",                headerLabel: "Purchases",          description: "Show this column in the manage table.", tab: "key_metrics", section: "results_spend",     sectionLabel: "Results and spend" },
  { id: "purchase_value",    label: "Purchase Value",           headerLabel: "Purchase value",     description: "Show this column in the manage table.", tab: "key_metrics", section: "results_spend",     sectionLabel: "Results and spend" },
  { id: "avg_order_value",   label: "Average Order Value",      headerLabel: "Avg. order value",   description: "Show this column in the manage table.", tab: "key_metrics", section: "results_spend",     sectionLabel: "Results and spend" },
  { id: "roas",              label: "ROAS",                     headerLabel: "ROAS",               description: "Show this column in the manage table.", tab: "key_metrics", section: "results_spend",     sectionLabel: "Results and spend" },
  { id: "cost_per_purchase", label: "Cost Per Purchase",        headerLabel: "Cost/purchase",      description: "Show this column in the manage table.", tab: "key_metrics", section: "results_spend",     sectionLabel: "Results and spend" },
  { id: "cost_per_lead",     label: "Cost Per Lead",            headerLabel: "Cost/lead",          description: "Show this column in the manage table.", tab: "key_metrics", section: "results_spend",     sectionLabel: "Results and spend" },

  // ── Key metrics: Delivery ─────────────────────────────────────────────────
  { id: "delivery",          label: "Delivery",                 headerLabel: "Delivery",           description: "Show this column in the manage table.", tab: "key_metrics", section: "delivery",          sectionLabel: "Delivery" },
  { id: "effective_status",  label: "Effective Status",         headerLabel: "Eff. status",        description: "Show this column in the manage table.", tab: "key_metrics", section: "delivery",          sectionLabel: "Delivery" },

  // ── Key metrics: Distribution ─────────────────────────────────────────────
  { id: "impressions",       label: "Impressions",              headerLabel: "Impressions",        description: "Show this column in the manage table.", tab: "key_metrics", section: "distribution",      sectionLabel: "Distribution" },
  { id: "reach",             label: "Reach",                    headerLabel: "Reach",              description: "Show this column in the manage table.", tab: "key_metrics", section: "distribution",      sectionLabel: "Distribution" },
  { id: "cpm",               label: "CPM",                      headerLabel: "CPM",                description: "Show this column in the manage table.", tab: "key_metrics", section: "distribution",      sectionLabel: "Distribution" },
  { id: "frequency",         label: "Frequency",                headerLabel: "Frequency",          description: "Show this column in the manage table.", tab: "key_metrics", section: "distribution",      sectionLabel: "Distribution" },

  // ── Key metrics: Engagement ───────────────────────────────────────────────
  { id: "clicks",             label: "Clicks",                  headerLabel: "Clicks",             description: "Show this column in the manage table.", tab: "key_metrics", section: "engagement",        sectionLabel: "Engagement" },
  { id: "ctr",                label: "CTR",                     headerLabel: "CTR",                description: "Show this column in the manage table.", tab: "key_metrics", section: "engagement",        sectionLabel: "Engagement" },
  { id: "cpc",                label: "CPC",                     headerLabel: "CPC",                description: "Show this column in the manage table.", tab: "key_metrics", section: "engagement",        sectionLabel: "Engagement" },
  { id: "add_to_cart",        label: "Add to Cart",             headerLabel: "Add to Cart",        description: "Show this column in the manage table.", tab: "key_metrics", section: "engagement",        sectionLabel: "Engagement" },
  { id: "leads",              label: "Leads",                   headerLabel: "Leads",              description: "Show this column in the manage table.", tab: "key_metrics", section: "engagement",        sectionLabel: "Engagement" },
  { id: "purchase_conv_rate", label: "Purchase Conversion Rate",headerLabel: "Purchase conv. %",   description: "Show this column in the manage table.", tab: "key_metrics", section: "engagement",        sectionLabel: "Engagement" },
  { id: "video_100",          label: "Video 100% Watched",      headerLabel: "Video 100%",         description: "Show this column in the manage table.", tab: "key_metrics", section: "engagement",        sectionLabel: "Engagement" },
  { id: "video_25",           label: "Video 25% Watched",       headerLabel: "Video 25%",          description: "Show this column in the manage table.", tab: "key_metrics", section: "engagement",        sectionLabel: "Engagement" },
  { id: "video_50",           label: "Video 50% Watched",       headerLabel: "Video 50%",          description: "Show this column in the manage table.", tab: "key_metrics", section: "engagement",        sectionLabel: "Engagement" },
  { id: "video_75",           label: "Video 75% Watched",       headerLabel: "Video 75%",          description: "Show this column in the manage table.", tab: "key_metrics", section: "engagement",        sectionLabel: "Engagement" },
  { id: "video_views_3s",     label: "Video Views (3s)",        headerLabel: "Video views (3s)",   description: "Show this column in the manage table.", tab: "key_metrics", section: "engagement",        sectionLabel: "Engagement" },

  // ── Tracking ──────────────────────────────────────────────────────────────
  { id: "attribution_setting", label: "Attribution Setting",    headerLabel: "Attribution Setting", description: "Show this column in the manage table.",           tab: "tracking",     section: "tracking_section",    sectionLabel: "Tracking" },
  { id: "schedule_start",      label: "Schedule",               headerLabel: "Schedule",            description: "Start date for the campaign or ad set.",          tab: "tracking",     section: "tracking_section",    sectionLabel: "Tracking" },
  { id: "schedule_end",        label: "Ends",                   headerLabel: "Ends",                description: "End date for the campaign or ad set.",            tab: "tracking",     section: "tracking_section",    sectionLabel: "Tracking" },

  // ── Ad settings ───────────────────────────────────────────────────────────
  { id: "bid_strategy",         label: "Bid Strategy",          headerLabel: "Bid strategy",        description: "How Meta bids for your ads.",                     tab: "ad_settings",  section: "ad_settings_section", sectionLabel: "Ad settings" },
  { id: "boosted_object_id",    label: "Boosted Object ID",     headerLabel: "Boosted Object ID",   description: "Show this column in the manage table.",           tab: "ad_settings",  section: "ad_settings_section", sectionLabel: "Ad settings" },
  { id: "buying_type",          label: "Buying Type",           headerLabel: "Buying Type",         description: "Show this column in the manage table.",           tab: "ad_settings",  section: "ad_settings_section", sectionLabel: "Ad settings" },
  { id: "objective",            label: "Objective",             headerLabel: "Objective",           description: "Campaign objective.",                             tab: "ad_settings",  section: "ad_settings_section", sectionLabel: "Ad settings" },
  { id: "smart_promotion_type", label: "Smart Promotion Type",  headerLabel: "Smart promo type",    description: "Show this column in the manage table.",           tab: "ad_settings",  section: "ad_settings_section", sectionLabel: "Ad settings" },
  { id: "special_ad_category",  label: "Special Ad Category",   headerLabel: "Special ad category", description: "Show this column in the manage table.",           tab: "ad_settings",  section: "ad_settings_section", sectionLabel: "Ad settings" },

  // ── Advanced ──────────────────────────────────────────────────────────────
  { id: "account_id",        label: "Account ID",         headerLabel: "Account ID",        description: "Show this column in the manage table.",           tab: "advanced",     section: "advanced_section",    sectionLabel: "Advanced" },
  { id: "budget_remaining",  label: "Budget Remaining",   headerLabel: "Budget remaining",  description: "Show this column in the manage table.",           tab: "advanced",     section: "advanced_section",    sectionLabel: "Advanced" },
  { id: "date_created",      label: "Date Created",       headerLabel: "Date created",      description: "Show this column in the manage table.",           tab: "advanced",     section: "advanced_section",    sectionLabel: "Advanced" },
  { id: "issues_info",       label: "Issues Info",        headerLabel: "Issues info",       description: "Show this column in the manage table.",           tab: "advanced",     section: "advanced_section",    sectionLabel: "Advanced" },
  { id: "optimization_goal", label: "Optimization Goal",  headerLabel: "Optimization",      description: "The optimization goal for this ad set.",          tab: "advanced",     section: "advanced_section",    sectionLabel: "Advanced" },
  { id: "spend_cap",         label: "Spend Cap",          headerLabel: "Spend cap",         description: "Show this column in the manage table.",           tab: "advanced",     section: "advanced_section",    sectionLabel: "Advanced" },
  { id: "updated_time",      label: "Updated Time",       headerLabel: "Updated time",      description: "Show this column in the manage table.",           tab: "advanced",     section: "advanced_section",    sectionLabel: "Advanced" },
]

export const COLUMN_MAP: Record<string, ColumnDef> = Object.fromEntries(
  COLUMN_DEFS.map(c => [c.id, c])
)

export interface ColumnPreset {
  id: string
  label: string
  columns: string[]
  isDefault?: boolean
}

export const DEFAULT_PRESETS: ColumnPreset[] = [
  {
    id: "performance",
    label: "Performance",
    isDefault: true,
    columns: ["spend", "results", "cost_per_result", "budget", "delivery"],
  },
  {
    id: "performance_and_clicks",
    label: "Performance and clicks",
    isDefault: true,
    columns: ["spend", "results", "cost_per_result", "budget", "schedule_start", "schedule_end", "delivery", "impressions", "clicks", "ctr", "cpc"],
  },
  {
    id: "engagement",
    label: "Engagement",
    isDefault: true,
    columns: ["spend", "results", "cost_per_result", "impressions", "clicks", "ctr", "add_to_cart", "video_views_3s"],
  },
  {
    id: "delivery",
    label: "Delivery",
    isDefault: true,
    columns: ["spend", "delivery", "impressions", "reach", "frequency", "cpm"],
  },
]

export function getActivePreset(
  cols: string[],
  customPresets: ColumnPreset[] = []
): ColumnPreset | null {
  return [...DEFAULT_PRESETS, ...customPresets].find(
    p => p.columns.length === cols.length && p.columns.every((c, i) => c === cols[i])
  ) || null
}
