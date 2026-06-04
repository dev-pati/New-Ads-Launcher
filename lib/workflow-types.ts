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
  // Meta — pause
  | "pause_ad" | "pause_campaign" | "pause_adset"
  // Meta — enable
  | "enable_ad" | "enable_campaign" | "enable_adset"
  // Meta — duplicate
  | "duplicate_ad" | "duplicate_adset" | "duplicate_campaign"
  // Meta — budget
  | "increase_budget" | "decrease_budget" | "change_budget"
  // Meta — rules & creative
  | "swap_creative" | "create_rule" | "toggle_rule" | "update_rule" | "apply_existing_rule"
  // Meta — spend
  | "set_minimum_spend"
  // Meta — launch
  | "launch_ad"
  // Social
  | "launch_tiktok" | "launch_snapchat" | "launch_pinterest"
  // Comms
  | "send_slack" | "send_email"
  // Sheets
  | "add_sheet_row" | "update_sheet_cell" | "update_sheet_row"
  // Media Library
  | "upload_to_media_library"

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
  // ROAS threshold trigger
  roasTarget?: number       // fire when ROAS drops below this
  // CPA spike trigger
  cpaTarget?: number        // fire when CPA rises above this
  lookbackPeriod?: "1d" | "3d" | "7d" | "14d" | "30d"
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
  scheduleTime?: string      // "09:00"
  scheduleDays?: string[]    // ["mon","tue","wed"] (legacy)
  scheduleFrequency?: "one_time" | "daily" | "weekly" | "monthly"
  scheduleDate?: string      // one-time: "2026-06-01"
  scheduleDayOfWeek?: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"
  scheduleDayOfMonth?: number // 1-31
  scheduleStartDate?: string
  scheduleEndDate?: string
  scheduleTimezone?: string  // "UTC", "Asia/Ho_Chi_Minh", etc.
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
  sheetsHeaderRow?: number
  sheetsDataStartRow?: number
  sheetsCheckFrequency?: "daily" | "weekly"
  sheetsProcessExistingRows?: boolean
  sheetsCatalogSelectionMode?: "single" | "per_row"
  sheetsCatalogId?: string
  sheetsCatalogName?: string
}

export interface NotificationConfig {
  via: "email" | "slack" | "both"
  emailRecipients: string[]
  slackChannel?: string
  slackWebhookUrl?: string
  customMessage?: string
}

export interface ActionConfig {
  appId: AppId
  event: ActionEvent
  notification?: NotificationConfig
  requireApproval?: boolean
  // Meta — shared
  actionAdAccountId?: string
  // Meta — target filter for pause/enable/duplicate/budget
  targetLevel?: "ad" | "adset" | "campaign"
  targetFilter?: "specific" | "all" | "name_contains"
  targetFilterValue?: string
  targetIds?: string[]        // specific IDs when targetFilter = "specific"
  // Meta — budget
  budgetChange?: { type: "increase" | "decrease"; amount: number; unit: "%" | "$" }
  budgetOperation?: "increase" | "decrease" | "set"
  budgetAmount?: number
  budgetAmountType?: "percentage" | "absolute"
  budgetType?: "daily" | "lifetime"
  // Meta — target expression (template variable from trigger, e.g. {{trigger.qualifyingAdIds}})
  actionTargetExpression?: string
  // Meta — duplicate
  duplicateCopies?: number
  duplicateStatus?: "PAUSED" | "ACTIVE" | "INHERITED_FROM_SOURCE"
  duplicatePauseOriginal?: boolean
  duplicateCooldownEnabled?: boolean
  duplicateAutoSplit?: boolean
  duplicateNameTemplate?: string
  duplicateTargetAdsets?: string[]
  duplicateTargetCampaignId?: string
  // Meta — rules
  actionRuleId?: string
  actionRuleName?: string
  actionTargetAdsetId?: string
  ruleId?: string
  ruleName?: string
  enable?: boolean
  // Meta — swap creative
  newCreativeId?: string
  // Meta — set minimum spend
  minSpendType?: "fixed" | "percentage"
  minSpendAmount?: number
  // Meta — launch ad
  launchAdAccountId?: string
  launchCampaignFilter?: string
  launchTargetAdsets?: string[]
  launchMode?: "immediately" | "draft"
  launchAdCopyTemplateId?: string
  launchAdNameTemplate?: string
  launchHeadline?: string
  launchPrimaryText?: string
  launchDescription?: string
  launchLinkUrl?: string
  launchCta?: string
  launchInitialStatus?: "PAUSED" | "ACTIVE"
  launchCooldownEnabled?: boolean
  // Google Sheets action
  actionSheetsSpreadsheetId?: string
  actionSheetsSheetName?: string
  actionSheetsColumnMappings?: { column: string; value: string }[]
  actionSheetsCellRef?: string
  actionSheetsCellValue?: string
  // Media Library action
  actionMediaBoardId?: string
  actionMediaBoardName?: string
  actionMediaNamingTemplate?: string
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
  send_notification:   { label: "Send Notification",            appId: "notification", description: "Send an email and/or Slack message." },
  // Meta — pause
  pause_ad:            { label: "Pause Ad",                     appId: "meta",         description: "Pause the qualifying ads." },
  pause_campaign:      { label: "Pause Campaign",               appId: "meta",         description: "Pause the qualifying campaigns." },
  pause_adset:         { label: "Pause Ad Set",                 appId: "meta",         description: "Pause the qualifying ad sets." },
  // Meta — enable
  enable_ad:           { label: "Enable Ad",                    appId: "meta",         description: "Enable (activate) the qualifying ads." },
  enable_campaign:     { label: "Enable Campaign",              appId: "meta",         description: "Enable the qualifying campaigns." },
  enable_adset:        { label: "Enable Ad Set",                appId: "meta",         description: "Enable the qualifying ad sets." },
  // Meta — duplicate
  duplicate_ad:        { label: "Duplicate Ad",                 appId: "meta",         description: "Duplicate the qualifying ads into a target ad set." },
  duplicate_adset:     { label: "Duplicate Ad Set",             appId: "meta",         description: "Duplicate a specific ad set." },
  duplicate_campaign:  { label: "Duplicate Campaign",           appId: "meta",         description: "Duplicate a specific campaign." },
  // Meta — budget
  increase_budget:     { label: "Increase Budget",              appId: "meta",         description: "Increase daily budget by a percentage or fixed amount." },
  decrease_budget:     { label: "Decrease Budget",              appId: "meta",         description: "Decrease daily budget." },
  change_budget:       { label: "Change Budget",                appId: "meta",         description: "Increase, decrease, or set budget on ad sets or campaigns." },
  // Meta — rules & creative
  swap_creative:       { label: "Swap Creative from Shortlist", appId: "meta",         description: "Replace the ad creative with one from your shortlist." },
  create_rule:         { label: "Create Rule",                  appId: "meta",         description: "Create a Meta automated rule for an ad set." },
  toggle_rule:         { label: "Toggle Rule",                  appId: "meta",         description: "Enable or disable a Meta automated rule." },
  update_rule:         { label: "Update Rule",                  appId: "meta",         description: "Update an existing Meta automated rule." },
  apply_existing_rule: { label: "Apply Existing Rule",          appId: "meta",         description: "Apply a saved Meta rule to ads in this automation." },
  set_minimum_spend:   { label: "Set Minimum Spend",            appId: "meta",         description: "Set minimum daily spend target for CBO ad sets." },
  // Meta — launch
  launch_ad:           { label: "Launch Ad",                    appId: "meta",         description: "Create and launch a new ad." },
  // Social
  launch_tiktok:       { label: "Launch on TikTok",             appId: "tiktok",       description: "Launch the ad creative on TikTok." },
  launch_snapchat:     { label: "Launch on Snapchat",           appId: "snapchat",     description: "Launch the ad creative on Snapchat." },
  launch_pinterest:    { label: "Launch on Pinterest",          appId: "pinterest",    description: "Launch the ad creative on Pinterest." },
  // Comms
  send_slack:          { label: "Send Slack",                   appId: "slack",        description: "Send a Slack message." },
  send_email:          { label: "Send Email",                   appId: "notification", description: "Send an email." },
  // Sheets
  add_sheet_row:       { label: "Add Row",                      appId: "sheets",       description: "Append a row to a Google Sheet." },
  update_sheet_cell:   { label: "Update Cell",                  appId: "sheets",       description: "Update a specific cell in a Google Sheet." },
  update_sheet_row:    { label: "Update Row",                   appId: "sheets",       description: "Update a row in a Google Sheet." },
  // Media Library
  upload_to_media_library: { label: "Upload to Media Library", appId: "media_library", description: "Upload the trigger file to your Media Library." },
}
