// ─── Workflow types ───────────────────────────────────────────────────────────

export type AppId = "meta" | "notification" | "google_drive" | "tiktok" | "snapchat" | "pinterest" | "slack" | "sheets" | "schedule"

export type TriggerEvent =
  | "performance_monitoring"
  | "ad_approved"
  | "spend_threshold"
  | "roas_threshold"
  | "cpa_spike"
  | "new_drive_folder"
  | "schedule"

export type ActionEvent =
  | "send_notification"
  | "duplicate_ad"
  | "increase_budget"
  | "decrease_budget"
  | "pause_campaign"
  | "pause_adset"
  | "launch_tiktok"
  | "launch_snapchat"
  | "launch_pinterest"
  | "send_slack"
  | "send_email"
  | "add_sheet_row"

export type NodeKind = "trigger" | "action" | "condition"

export type NodeStatus = "configured" | "incomplete" | "error"

export interface MetricCondition {
  metric: string
  operator: "increases_by" | "decreases_by" | "is_above" | "is_below"
  value: number
  unit: "%" | "$" | "x"
}

export interface TriggerConfig {
  appId: AppId
  event: TriggerEvent
  adAccountIds?: string[]
  monitoringLevel?: "campaign" | "adset" | "ad"
  campaignFilter?: "all" | "specific"
  specificCampaignIds?: string[]
  metricConditions?: MetricCondition[]
  comparisonWindow?: "day_over_day" | "week_over_week" | "month_over_month"
  checkFrequency?: "hourly" | "every_6h" | "daily"
  scheduleTime?: string   // "09:00"
  scheduleDays?: string[] // ["mon","tue","wed"]
}

export interface NotificationConfig {
  via: "email" | "slack" | "both"
  emailRecipients: string[]
  slackChannel?: string
  customMessage?: string
}

export interface ActionConfig {
  appId: AppId
  event: ActionEvent
  notification?: NotificationConfig
  budgetChange?: { type: "increase" | "decrease"; amount: number; unit: "%" | "$" }
  requireApproval?: boolean
}

export interface WorkflowStep {
  id: string
  kind: NodeKind
  status: NodeStatus
  triggerConfig?: TriggerConfig
  actionConfig?: ActionConfig
}

export interface Workflow {
  id: string
  name: string
  adAccountId?: string
  steps: WorkflowStep[]
  createdAt: string
  updatedAt: string
}

// ─── Variable tokens for notification messages ────────────────────────────────

export interface VariableToken {
  key: string
  label: string
  group: "trigger" | "system"
  description?: string
}

export const TRIGGER_VARIABLES: VariableToken[] = [
  { key: "trigger.summary",       label: "Summary (ready-made)",         group: "trigger" },
  { key: "trigger.metric",        label: "Metric (formatted)",           group: "trigger" },
  { key: "trigger.direction",     label: "Direction (past tense)",       group: "trigger" },
  { key: "trigger.threshold",     label: "Threshold %",                  group: "trigger" },
  { key: "trigger.actualChange",  label: "Actual Change %",              group: "trigger" },
  { key: "trigger.currentValue",  label: "Current Value",                group: "trigger" },
  { key: "trigger.previousValue", label: "Previous Value",               group: "trigger" },
  { key: "trigger.entityName",    label: "Entity Name",                  group: "trigger" },
  { key: "trigger.comparisonLabel", label: "Comparison Label",           group: "trigger" },
  { key: "trigger.monitoringLevel", label: "Monitoring Level",           group: "trigger" },
  { key: "trigger.metricRaw",     label: "Metric (raw)",                 group: "trigger" },
  { key: "trigger.directionRaw",  label: "Direction (raw)",              group: "trigger" },
  { key: "trigger.comparisonWindow", label: "Comparison Window",         group: "trigger" },
  { key: "trigger.qualifyingCount", label: "Qualifying Count",           group: "trigger" },
  { key: "trigger.qualifyingEntityIds", label: "Qualifying Entity IDs",  group: "trigger" },
  { key: "trigger.qualifyingEntities", label: "Qualifying Entities (full data)", group: "trigger" },
  { key: "trigger.adsManagerLink", label: "Ads Manager Link (filtered to ads)", group: "trigger" },
]

export const SYSTEM_VARIABLES: VariableToken[] = [
  { key: "system.currentDate",     label: "Current Date",                group: "system" },
  { key: "system.currentDateTime", label: "Current Date & Time",         group: "system" },
]

// ─── App registry ─────────────────────────────────────────────────────────────

export const APP_REGISTRY: Record<AppId, { name: string; color: string; bgColor: string }> = {
  meta:         { name: "Meta",          color: "#1877f2", bgColor: "#eff6ff" },
  notification: { name: "Notification",  color: "#f59e0b", bgColor: "#fffbeb" },
  google_drive: { name: "Google Drive",  color: "#34a853", bgColor: "#f0fdf4" },
  tiktok:       { name: "TikTok",        color: "#000000", bgColor: "#f4f4f5" },
  snapchat:     { name: "Snapchat",      color: "#fffc00", bgColor: "#fefce8" },
  pinterest:    { name: "Pinterest",     color: "#e60023", bgColor: "#fff1f2" },
  slack:        { name: "Slack",         color: "#4a154b", bgColor: "#fdf4ff" },
  sheets:       { name: "Google Sheets", color: "#34a853", bgColor: "#f0fdf4" },
  schedule:     { name: "Schedule",      color: "#6366f1", bgColor: "#eef2ff" },
}

// ─── Trigger event registry ───────────────────────────────────────────────────

export const TRIGGER_EVENT_REGISTRY: Record<TriggerEvent, {
  label: string; appId: AppId; description: string
}> = {
  performance_monitoring: { label: "Performance Monitoring", appId: "meta",     description: "Detect when metrics change by a percentage between consecutive time periods." },
  ad_approved:            { label: "Ad Approved",            appId: "meta",     description: "Fires when a Meta ad is approved and moves to active status." },
  spend_threshold:        { label: "Spend Threshold",        appId: "meta",     description: "Fires when spend crosses a defined threshold." },
  roas_threshold:         { label: "ROAS Threshold",         appId: "meta",     description: "Fires when ROAS moves above or below a target." },
  cpa_spike:              { label: "CPA Spike",              appId: "meta",     description: "Fires when cost per action spikes beyond threshold." },
  new_drive_folder:       { label: "New Drive Folder",       appId: "google_drive", description: "Fires when a new folder is created in Google Drive." },
  schedule:               { label: "Schedule",               appId: "schedule", description: "Fires on a recurring schedule (daily, weekly, etc.)." },
}

export const ACTION_EVENT_REGISTRY: Record<ActionEvent, {
  label: string; appId: AppId; description: string
}> = {
  send_notification: { label: "Send Notification", appId: "notification", description: "Send an email and/or Slack message." },
  duplicate_ad:      { label: "Duplicate Ad",      appId: "meta",        description: "Duplicate the qualifying ad." },
  increase_budget:   { label: "Increase Budget",   appId: "meta",        description: "Increase daily budget by a percentage or fixed amount." },
  decrease_budget:   { label: "Decrease Budget",   appId: "meta",        description: "Decrease daily budget." },
  pause_campaign:    { label: "Pause Campaign",    appId: "meta",        description: "Pause the qualifying campaign." },
  pause_adset:       { label: "Pause Ad Set",      appId: "meta",        description: "Pause the qualifying ad set." },
  launch_tiktok:     { label: "Launch on TikTok",  appId: "tiktok",      description: "Launch the ad creative on TikTok." },
  launch_snapchat:   { label: "Launch on Snapchat",appId: "snapchat",    description: "Launch the ad creative on Snapchat." },
  launch_pinterest:  { label: "Launch on Pinterest",appId: "pinterest",  description: "Launch the ad creative on Pinterest." },
  send_slack:        { label: "Send Slack",         appId: "slack",       description: "Send a Slack message." },
  send_email:        { label: "Send Email",         appId: "notification", description: "Send an email." },
  add_sheet_row:     { label: "Add Sheet Row",      appId: "sheets",      description: "Append a row to a Google Sheet." },
}
