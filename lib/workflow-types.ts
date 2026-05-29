// ─── Workflow types ───────────────────────────────────────────────────────────

export type AppId = "meta" | "notification" | "google_drive" | "tiktok" | "snapchat" | "pinterest" | "slack" | "sheets" | "schedule" | "manual" | "media_library" | "dropbox" | "sharepoint" | "air" | "frameio" | "adscan"

export type TriggerEvent =
  | "performance_monitoring"
  | "campaign_status_change"
  | "best_performing_organic_post"
  | "ad_approved"
  | "spend_threshold"
  | "roas_threshold"
  | "cpa_spike"
  | "drive_new_file_in_folder"
  | "drive_new_folder_in_folder"
  | "schedule"
  | "manual"
  | "media_uploaded"
  | "new_dropbox_file"
  | "new_sharepoint_file"
  | "new_air_asset"
  | "new_frameio_file"
  | "adscan_alert"
  | "sheets_cell_changed"
  | "sheets_new_row_launch"
  | "sheets_new_row_catalog"

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

export type NodeKind = "trigger" | "action" | "condition" | "delay" | "approval"

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
  monitoringLevel?: "account" | "campaign" | "adset" | "ad"
  campaignFilter?: "all" | "specific" | "name_contains" | "name_equals"
  campaignNameFilterValue?: string
  specificCampaignId?: string
  specificCampaignName?: string
  campaignStatusTarget?: "active" | "paused" | "with_issues" | "pending_review" | "archived"
  // Ad Approved trigger
  adSetFilter?: "all" | "name_contains" | "name_equals"
  adSetNameFilterValue?: string
  lookbackWindow?: "1h" | "6h" | "12h" | "24h" | "48h"
  // Performance Threshold
  thresholdAdStatus?: "all" | "active" | "paused"
  thresholdPerformancePeriod?: "lifetime" | "1d" | "3d" | "7d" | "14d" | "30d"
  thresholdIncludeToday?: boolean
  thresholdExcludeRecentDays?: number
  thresholdLookbackPeriod?: "all" | "7d" | "14d" | "30d" | "60d" | "90d"
  thresholdConditionLevel?: "per_ad" | "average" | "mixed" | "adset_avg"
  thresholdConditions?: { metric: string; operator: string; value: number }[]
  thresholdAdSetFilter?: "all" | "name_contains"
  thresholdAdSetFilterValue?: string
  // Best Performing Organic Post
  organicPageId?: string
  organicPageName?: string
  organicRankingMetric?: "engagement" | "reach" | "impressions" | "video_views"
  organicLookbackDays?: number
  organicMinMetricValue?: number
  organicTopPostsCount?: number
  specificCampaignIds?: string[]
  metricConditions?: MetricCondition[]
  comparisonWindow?: "day_over_day" | "week_over_week" | "month_over_month"
  checkFrequency?: "hourly" | "every_6h" | "daily" | "weekly"
  scheduleTime?: string   // "09:00"
  scheduleDays?: string[] // ["mon","tue","wed"]
  // Media Library (Google Drive backed)
  mediaBoard?: "all" | "name_contains" | "name_equals" | "name_does_not_contain" | "name_starts_with" | "name_ends_with" | "specific"
  mediaBoardId?: string    // Google Drive folder ID when board = "specific"
  mediaBoardName?: string  // Display name for the selected folder
  mediaBoardFilter?: string // text value for name_contains/equals/etc. operators
  mediaAssetName?: "all" | "name_contains" | "name_equals" | "name_does_not_contain" | "name_starts_with" | "name_ends_with"
  mediaNameFilter?: string // text value for asset name filter
  mediaType?: "all" | "images" | "videos"
  triggerTiming?: "immediately" | "on_approved"
  assetStatus?: "all" | "approved" | "in_progress" | "archived"
  assetGrouping?: boolean
  // Google Drive trigger
  driveFolderId?: string
  driveFolderName?: string
  driveFolderUrl?: string
  driveBatchStrategy?: "all_as_one" | "one_per_file" | "group_by_type"
  driveFileType?: "all" | "images" | "videos"
  driveUploadAllOnFirstRun?: boolean
  // New Folder in Folder extra fields
  driveFolderNameFilter?: "all" | "name_contains" | "name_does_not_contain" | "name_starts_with" | "name_ends_with" | "name_equals"
  driveFolderNameFilterValue?: string
  driveRecursiveSearch?: boolean
  driveMinFilesRequired?: number
  // Google Sheets
  sheetsSpreadsheetId?: string
  sheetsSheetName?: string
  sheetsWatchMode?: "single_cell" | "entire_column"
  sheetsTriggerCell?: string
  sheetsCondition?: "equals" | "not_equals" | "not_empty" | "is_empty" | "contains" | "starts_with" | "ends_with" | "greater_than" | "less_than" | "gte" | "lte"
  sheetsConditionValue?: string
  sheetsDataMappings?: { label: string; cell: string }[]
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

export interface DelayConfig {
  unit: "minutes" | "hours" | "days"
  value: number
}

export interface ApprovalConfig {
  approvers: string[]  // email addresses
  message?: string
  timeoutHours?: number  // auto-reject after N hours, 0 = never
}

export interface WorkflowStep {
  id: string
  kind: NodeKind
  status: NodeStatus
  triggerConfig?: TriggerConfig
  actionConfig?: ActionConfig
  delayConfig?: DelayConfig
  approvalConfig?: ApprovalConfig
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
  manual:       { name: "Manual Trigger",color: "#2563eb", bgColor: "#eff6ff" },
  media_library:{ name: "Media Library", color: "#FF7043", bgColor: "#FFF3F0" },
  dropbox:      { name: "Dropbox",       color: "#0061FF", bgColor: "#EFF6FF" },
  sharepoint:   { name: "SharePoint",    color: "#038387", bgColor: "#F0FDFA" },
  air:          { name: "AIR",           color: "#1A1A1A", bgColor: "#F4F4F5" },
  frameio:      { name: "Frame.io",      color: "#4353FF", bgColor: "#EEF2FF" },
  adscan:       { name: "Adscan",        color: "#7C3AED", bgColor: "#F5F3FF" },
}

// ─── Trigger event registry ───────────────────────────────────────────────────

export const TRIGGER_EVENT_REGISTRY: Record<TriggerEvent, {
  label: string; appId: AppId; description: string
}> = {
  performance_monitoring:       { label: "Performance Monitoring",       appId: "meta", description: "Detect when metrics change by a percentage between consecutive time periods. For example: \"Spend increased by 20% AND CPA increased by 15% day over day.\"" },
  campaign_status_change:       { label: "Campaign Status Change",       appId: "meta", description: "Triggers when campaigns match a specific status. Use this to detect when campaigns become active, get paused, or encounter issues." },
  best_performing_organic_post: { label: "Best Performing Organic Post", appId: "meta", description: "Fires when an organic post outperforms your ads — use it to automatically boost top content." },
  ad_approved:                  { label: "Ad Approved",                  appId: "meta", description: "Fires when a Meta ad is approved and moves to active status." },
  spend_threshold:              { label: "Performance Threshold",        appId: "meta", description: "Fires when spend crosses a defined threshold." },
  roas_threshold:               { label: "ROAS Threshold",               appId: "meta", description: "Fires when ROAS moves above or below a target." },
  cpa_spike:                    { label: "CPA Spike",                    appId: "meta", description: "Fires when cost per action spikes beyond threshold." },
  drive_new_file_in_folder:   { label: "New File in Folder",   appId: "google_drive", description: "Fires when a new file is added to a specific Google Drive folder." },
  drive_new_folder_in_folder: { label: "New Folder in Folder", appId: "google_drive", description: "Fires when a new subfolder is created inside a specific Google Drive folder." },
  schedule:               { label: "Schedule",               appId: "schedule", description: "Fires on a recurring schedule (daily, weekly, etc.)." },
  manual:                 { label: "Manual Trigger",         appId: "manual",        description: "Run this automation manually on demand." },
  media_uploaded:         { label: "Media Uploaded",          appId: "media_library", description: "Fires when new media is uploaded to your library." },
  new_dropbox_file:       { label: "New Dropbox File",        appId: "dropbox",       description: "Fires when a new file is added to Dropbox." },
  new_sharepoint_file:    { label: "New SharePoint File",     appId: "sharepoint",    description: "Fires when a new file is added to SharePoint." },
  new_air_asset:          { label: "New AIR Asset",           appId: "air",           description: "Trigger automations from a publicly shared AIR board." },
  new_frameio_file:        { label: "New Frame.io File",       appId: "frameio",       description: "Fires when new files are added in Frame.io." },
  adscan_alert:            { label: "Competitor Ad Alert",     appId: "adscan",        description: "Trigger automations when competitor ad activity is detected." },
  sheets_cell_changed:     { label: "Cell Value Changed",     appId: "sheets",        description: "Fires when a specific cell matches a condition." },
  sheets_new_row_launch:   { label: "New Rows to Launch",     appId: "sheets",        description: "Fires when new rows are added to launch campaigns." },
  sheets_new_row_catalog:  { label: "New Rows to Catalog",    appId: "sheets",        description: "Fires when new rows are added to the catalog sheet." },
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
