"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import {
  IconBrandMeta, IconChartBar, IconPlus, IconX, IconChevronDown,
  IconBell, IconBrandGoogleDrive, IconBrandTiktok, IconBrandSnapchat,
  IconBrandPinterest, IconBrandSlack, IconTable, IconCalendar,
  IconHandClick, IconPlayerPlay, IconLoader2, IconRefresh, IconFile,
  IconPhoto, IconBrandDropbox, IconApps, IconWind, IconBrandFramer, IconScan,
  IconSearch, IconCopy, IconCheck,
} from "@tabler/icons-react"
import type { TriggerConfig, MetricCondition, AppId } from "@/lib/workflow-types"

// ─── App icon/color map ───────────────────────────────────────────────────────

const APP_META: Record<AppId, { label: string; Icon: React.ElementType; iconBg: string; iconColor: string }> = {
  meta:         { label: "Meta",           Icon: IconBrandMeta,        iconBg: "#EFF6FF", iconColor: "#1877F2" },
  notification: { label: "Notification",   Icon: IconBell,             iconBg: "#FFFBEB", iconColor: "#F59E0B" },
  google_drive: { label: "Google Drive",   Icon: IconBrandGoogleDrive, iconBg: "#F0FDF4", iconColor: "#34A853" },
  tiktok:       { label: "TikTok Ads",     Icon: IconBrandTiktok,      iconBg: "#F4F4F5", iconColor: "#010101" },
  snapchat:     { label: "Snapchat",       Icon: IconBrandSnapchat,    iconBg: "#FEFCE8", iconColor: "#FFFC00" },
  pinterest:    { label: "Pinterest",      Icon: IconBrandPinterest,   iconBg: "#FFF1F2", iconColor: "#E60023" },
  slack:        { label: "Slack",          Icon: IconBrandSlack,       iconBg: "#FDF4FF", iconColor: "#4A154B" },
  sheets:       { label: "Google Sheets",  Icon: IconTable,            iconBg: "#F0FDF4", iconColor: "#0F9D58" },
  schedule:     { label: "Scheduled",      Icon: IconCalendar,         iconBg: "#EEF2FF", iconColor: "#6366F1" },
  manual:       { label: "Manual Trigger", Icon: IconHandClick,        iconBg: "#EFF6FF", iconColor: "#2563EB" },
  media_library:{ label: "Media Library",  Icon: IconPhoto,            iconBg: "#FFF3F0", iconColor: "#FF7043" },
  dropbox:      { label: "Dropbox",        Icon: IconBrandDropbox,     iconBg: "#EFF6FF", iconColor: "#0061FF" },
  sharepoint:   { label: "SharePoint",     Icon: IconApps,             iconBg: "#F0FDFA", iconColor: "#038387" },
  air:          { label: "AIR",            Icon: IconWind,             iconBg: "#F4F4F5", iconColor: "#1A1A1A" },
  frameio:      { label: "Frame.io",       Icon: IconBrandFramer,      iconBg: "#EEF2FF", iconColor: "#4353FF" },
  adscan:       { label: "Adscan",         Icon: IconScan,             iconBg: "#F5F3FF", iconColor: "#7C3AED" },
}

const EVENT_LABELS: Partial<Record<string, string>> = {
  performance_monitoring:       "Performance Monitoring",
  campaign_status_change:       "Campaign Status Change",
  best_performing_organic_post: "Best Performing Organic Post",
  ad_approved:                  "Ad Approved",
  spend_threshold:              "Performance Threshold",
  roas_threshold:               "ROAS Threshold",
  cpa_spike:                    "CPA Spike",
  drive_new_file_in_folder:   "New File in Folder",
  drive_new_folder_in_folder: "New Folder in Folder",
  schedule:                "Schedule",
  manual:                  "Manual Trigger",
  media_uploaded:          "Media Uploaded to Board",
  new_dropbox_file:        "New Dropbox File",
  new_sharepoint_file:     "New SharePoint File",
  new_air_asset:           "New AIR Asset",
  new_frameio_file:        "New Frame.io File",
  adscan_alert:            "Competitor Ad Alert",
  sheets_cell_changed:     "Cell Value Changed",
  sheets_new_row_launch:   "New Rows to Launch",
  sheets_new_row_catalog:  "New Rows to Catalog",
}

const SHEETS_CONDITIONS = [
  { value: "equals",        label: "Equals" },
  { value: "not_equals",    label: "Does Not Equal" },
  { value: "not_empty",     label: "Is Not Empty" },
  { value: "is_empty",      label: "Is Empty" },
  { value: "contains",      label: "Contains" },
  { value: "starts_with",   label: "Starts With" },
  { value: "ends_with",     label: "Ends With" },
  { value: "greater_than",  label: "Greater Than" },
  { value: "less_than",     label: "Less Than" },
  { value: "gte",           label: "Greater Than or Equal" },
  { value: "lte",           label: "Less Than or Equal" },
]

// ─── Field helpers ────────────────────────────────────────────────────────────

const MONITORING_LEVELS = [
  { value: "account",  label: "Account Level" },
  { value: "campaign", label: "Campaign Level" },
  { value: "adset",    label: "Ad Set Level" },
  { value: "ad",       label: "Ad Level" },
]

const MONITORING_LEVEL_DESC: Record<string, string> = {
  account:  "Compare metrics for the entire account",
  campaign: "Compare metrics per campaign",
  adset:    "Compare metrics per ad set",
  ad:       "Compare metrics per ad",
}

const METRICS = [
  { value: "spend",               label: "Spend" },
  { value: "cpa",                 label: "CPA" },
  { value: "purchase_roas",       label: "Purchase ROAS" },
  { value: "cpm",                 label: "CPM" },
  { value: "cpc",                 label: "CPC" },
  { value: "ctr",                 label: "CTR" },
  { value: "impressions",         label: "Impressions" },
  { value: "conversions",         label: "Conversions" },
  { value: "cost_per_subscriber", label: "Cost per Subscriber" },
]

const THRESHOLD_METRICS: { group: string; value: string; label: string }[] = [
  // Performance
  { group: "Performance", value: "spend",              label: "Spend" },
  { group: "Performance", value: "cost_per_result",    label: "Cost per Result" },
  { group: "Performance", value: "purchase_roas",      label: "Purchase ROAS" },
  { group: "Performance", value: "cpa",                label: "CPA" },
  { group: "Performance", value: "cpm",                label: "CPM" },
  { group: "Performance", value: "cpc",                label: "CPC" },
  { group: "Performance", value: "ctr_all",            label: "CTR (All)" },
  { group: "Performance", value: "link_ctr",           label: "Link CTR" },
  { group: "Performance", value: "frequency",          label: "Frequency" },
  { group: "Performance", value: "impressions",        label: "Impressions" },
  { group: "Performance", value: "reach",              label: "Reach" },
  { group: "Performance", value: "clicks",             label: "Clicks" },
  // Conversion
  { group: "Conversion", value: "conversions",         label: "Conversions" },
  { group: "Conversion", value: "purchases",           label: "Purchases" },
  { group: "Conversion", value: "purchase_value",      label: "Purchase Value" },
  { group: "Conversion", value: "cost_per_purchase",   label: "Cost per Purchase" },
  { group: "Conversion", value: "leads",               label: "Leads" },
  { group: "Conversion", value: "cost_per_lead",       label: "Cost per Lead" },
  { group: "Conversion", value: "add_to_cart",         label: "Add to Cart" },
  { group: "Conversion", value: "cost_per_atc",        label: "Cost per Add to Cart" },
  // Video
  { group: "Video", value: "hook_rate",                label: "Hook Rate" },
  { group: "Video", value: "hold_rate",                label: "Hold Rate" },
  { group: "Video", value: "thruplay_rate",            label: "ThruPlay Rate" },
  { group: "Video", value: "video_views",              label: "Video Views" },
  { group: "Video", value: "thruplays",                label: "ThruPlays" },
  { group: "Video", value: "cost_per_thruplay",        label: "Cost per ThruPlay" },
  // Engagement
  { group: "Engagement", value: "link_clicks",         label: "Link Clicks" },
  { group: "Engagement", value: "cost_per_link_click", label: "Cost per Link Click" },
  { group: "Engagement", value: "landing_page_views",  label: "Landing Page Views" },
  { group: "Engagement", value: "cost_per_lpv",        label: "Cost per LPV" },
]

const THRESHOLD_OPERATORS = [
  { value: ">",  label: ">" },
  { value: "<",  label: "<" },
  { value: ">=", label: ">=" },
  { value: "<=", label: "<=" },
  { value: "=",  label: "=" },
]

const PERFORMANCE_PERIODS = [
  { value: "lifetime", label: "Lifetime (all time)" },
  { value: "1d",       label: "Last 1 day" },
  { value: "3d",       label: "Last 3 days" },
  { value: "7d",       label: "Last 7 days" },
  { value: "14d",      label: "Last 14 days" },
  { value: "30d",      label: "Last 30 days" },
]

const LOOKBACK_PERIODS = [
  { value: "all", label: "All ads (no limit)" },
  { value: "7d",  label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "60d", label: "Last 60 days" },
  { value: "90d", label: "Last 90 days" },
]

const CONDITION_LEVELS = [
  { value: "per_ad",    label: "Per Ad" },
  { value: "average",   label: "Average" },
  { value: "mixed",     label: "Mixed" },
  { value: "adset_avg", label: "Ad Set Avg" },
]

const OPERATORS = [
  { value: "increases_by", label: "Increases by" },
  { value: "decreases_by", label: "Decreases by" },
  { value: "is_above",     label: "Is above" },
  { value: "is_below",     label: "Is below" },
]

const COMPARISON_WINDOWS = [
  { value: "day_over_day",   label: "Day over Day" },
  { value: "week_over_week", label: "Week over Week" },
]

const FREQUENCIES = [
  { value: "hourly",    label: "Hourly" },
  { value: "every_6h", label: "Every 6 hours" },
  { value: "daily",    label: "Daily 9am" },
]

const META_FREQUENCIES = [
  { value: "daily",  label: "Daily" },
  { value: "weekly", label: "Weekly" },
]

// ─── SelectField ──────────────────────────────────────────────────────────────

function SelectField({ label, value, options, onChange, description, required }: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  description?: string
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[12px] font-semibold text-foreground/80">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
      </div>
      {description && <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>}
    </div>
  )
}

// ─── Metric condition row ─────────────────────────────────────────────────────

function MetricConditionRow({ cond, onChange, onRemove, canRemove }: {
  cond: MetricCondition
  onChange: (c: MetricCondition) => void
  onRemove: () => void
  canRemove: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <select
            value={cond.metric}
            onChange={e => onChange({ ...cond, metric: e.target.value })}
            className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground"
          >
            <option value="">Select metric</option>
            {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        </div>
        {canRemove && (
          <button onClick={onRemove} className="size-9 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
            <IconX className="size-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <select
            value={cond.operator}
            onChange={e => onChange({ ...cond, operator: e.target.value as MetricCondition["operator"] })}
            className="w-full h-9 pl-2 pr-7 text-[12px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground"
          >
            <option value="">Select direction</option>
            {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <IconChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
        </div>
        <input
          type="number"
          value={cond.value}
          onChange={e => onChange({ ...cond, value: parseFloat(e.target.value) || 0 })}
          className="w-16 h-9 px-2 text-[13px] text-center bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 tabular-nums"
        />
        <div className="relative w-16">
          <select
            value={cond.unit}
            onChange={e => onChange({ ...cond, unit: e.target.value as MetricCondition["unit"] })}
            className="w-full h-9 pl-2 pr-6 text-[12px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            <option value="%">%</option>
            <option value="$">$</option>
            <option value="x">x</option>
          </select>
          <IconChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
        </div>
      </div>
    </div>
  )
}

// ─── Google Drive Trigger Setup ──────────────────────────────────────────────

function GoogleDriveTriggerSetup({ config, onChange }: {
  config: TriggerConfig
  onChange: (c: TriggerConfig) => void
}) {
  const [connected, setConnected]     = useState<boolean | null>(null)
  const [folders, setFolders]         = useState<DriveFolder[]>([])
  const [loadingFolders, setLoadingFolders] = useState(false)
  const [showPaste, setShowPaste]     = useState(false)
  const [browseOpen, setBrowseOpen]   = useState(false)

  useEffect(() => {
    fetch("/api/google/token")
      .then(r => r.json())
      .then(d => setConnected(d.connected === true))
      .catch(() => setConnected(false))
  }, [])

  const loadFolders = () => {
    if (folders.length > 0) { setBrowseOpen(true); return }
    setLoadingFolders(true)
    fetch("/api/google/drive/folders")
      .then(r => r.json())
      .then(d => { setFolders(d.folders ?? []); setBrowseOpen(true) })
      .catch(() => setFolders([]))
      .finally(() => setLoadingFolders(false))
  }

  const handlePasteUrl = (raw: string) => {
    const match = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/)
    const id = match ? match[1] : raw.trim()
    onChange({ ...config, driveFolderId: id, driveFolderUrl: raw, driveFolderName: undefined })
  }

  if (connected === null) return (
    <div className="flex items-center gap-2 text-[12px] text-muted-foreground py-2">
      <IconLoader2 className="size-3.5 animate-spin" /> Checking Google Drive…
    </div>
  )

  if (!connected) return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <IconBrandGoogleDrive className="size-5 text-[#34A853] shrink-0" />
        <div>
          <p className="text-[13px] font-semibold">Connect Google Drive</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Required to use Google Drive trigger</p>
        </div>
      </div>
      <a
        href="/connect"
        className="flex items-center justify-center h-8 w-full rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90 transition-colors"
      >
        Connect Google Drive
      </a>
    </div>
  )

  return (
    <>
      {/* Connected badge */}
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-xl">
        <div className="size-1.5 rounded-full bg-green-500 shrink-0" />
        <p className="text-[12px] text-green-700 dark:text-green-400 font-medium">Google Drive Connected</p>
      </div>

      {/* Trigger Event */}
      <SelectField
        label="Trigger Event"
        value={config.event}
        options={[
          { value: "drive_new_file_in_folder",   label: "New File in Folder" },
          { value: "drive_new_folder_in_folder",  label: "New Folder in Folder" },
        ]}
        onChange={v => onChange({ ...config, event: v as TriggerConfig["event"] })}
        description={
          config.event === "drive_new_file_in_folder"
            ? "Fires when a new file is added to the selected folder."
            : "Fires when a new subfolder is created inside the selected folder."
        }
      />

      {/* Google Drive Folder */}
      <div className="space-y-2">
        <label className="text-[12px] font-semibold text-foreground/80">
          Google Drive Folder <span className="text-red-500">*</span>
        </label>

        {/* Selected folder chip */}
        {config.driveFolderId && config.driveFolderName && (
          <div className="flex items-center gap-2 px-3 py-2 bg-background border border-primary/30 rounded-lg">
            <IconBrandGoogleDrive className="size-4 text-[#34A853] shrink-0" />
            <span className="text-[13px] flex-1 truncate">{config.driveFolderName}</span>
            <button
              onClick={() => onChange({ ...config, driveFolderId: undefined, driveFolderName: undefined })}
              className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
            >
              <IconX className="size-3.5" />
            </button>
          </div>
        )}

        {/* Browse button */}
        {!config.driveFolderId && (
          <button
            onClick={loadFolders}
            disabled={loadingFolders}
            className="w-full flex items-center gap-2 h-9 px-3 border border-dashed border-border rounded-lg text-[13px] text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            {loadingFolders
              ? <><IconLoader2 className="size-4 animate-spin" /> Loading folders…</>
              : <><IconBrandGoogleDrive className="size-4 text-[#34A853]" /> Browse Google Drive…</>
            }
          </button>
        )}

        {/* Browse dropdown */}
        {browseOpen && folders.length > 0 && (
          <div className="rounded-lg border border-border bg-background shadow-sm max-h-48 overflow-y-auto">
            {folders.map(f => (
              <button
                key={f.id}
                onClick={() => {
                  onChange({ ...config, driveFolderId: f.id, driveFolderName: f.name })
                  setBrowseOpen(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:bg-muted/60 transition-colors"
              >
                <IconBrandGoogleDrive className="size-3.5 text-[#34A853] shrink-0" />
                {f.name}
              </button>
            ))}
          </div>
        )}

        {/* Paste URL/ID collapsible */}
        <button
          onClick={() => setShowPaste(v => !v)}
          className="flex items-center gap-1.5 text-[12px] text-primary/80 hover:text-primary transition-colors font-medium"
        >
          <IconChevronDown className={cn("size-3.5 transition-transform", showPaste && "rotate-180")} />
          Or paste folder URL / ID
        </button>
        {showPaste && (
          <div className="space-y-1.5">
            <input
              type="text"
              placeholder="https://drive.google.com/drive/folders/..."
              value={config.driveFolderUrl ?? config.driveFolderId ?? ""}
              onChange={e => handlePasteUrl(e.target.value)}
              className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
            />
            <p className="text-[11px] text-muted-foreground">
              Paste the full URL or just the folder ID
            </p>
          </div>
        )}
      </div>

      {/* ── New File in Folder extra fields ── */}
      {config.event === "drive_new_file_in_folder" && (
        <>
          <SelectField
            label="File Type"
            value={config.driveFileType ?? "all"}
            options={[
              { value: "all",    label: "All Media" },
              { value: "images", label: "Images Only" },
              { value: "videos", label: "Videos Only" },
            ]}
            onChange={v => onChange({ ...config, driveFileType: v as TriggerConfig["driveFileType"] })}
          />

          {/* Upload all on first run toggle */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-foreground/80">Upload all files on first run</label>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground leading-snug">
                {config.driveUploadAllOnFirstRun
                  ? "All existing files in the folder will be processed on the first run."
                  : "Only new files added after this automation is activated will be processed."}
              </p>
              <button
                type="button"
                onClick={() => onChange({ ...config, driveUploadAllOnFirstRun: !config.driveUploadAllOnFirstRun })}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none",
                  config.driveUploadAllOnFirstRun ? "bg-primary" : "bg-muted-foreground/30"
                )}
              >
                <span className={cn(
                  "pointer-events-none inline-block size-4 rounded-full bg-white shadow transform transition-transform duration-200",
                  config.driveUploadAllOnFirstRun ? "translate-x-4" : "translate-x-0"
                )} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── New Folder in Folder extra fields ── */}
      {config.event === "drive_new_folder_in_folder" && (
        <>
          {/* Folder Name Filter */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-foreground/80">Folder Name Filter</label>
            <div className="relative">
              <select
                value={config.driveFolderNameFilter ?? "all"}
                onChange={e => onChange({ ...config, driveFolderNameFilter: e.target.value as TriggerConfig["driveFolderNameFilter"], driveFolderNameFilterValue: undefined })}
                className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
              >
                <option value="all">All Folders</option>
                <option value="name_contains">Name Contains</option>
                <option value="name_does_not_contain">Name Does Not Contain</option>
                <option value="name_starts_with">Name Starts With</option>
                <option value="name_ends_with">Name Ends With</option>
                <option value="name_equals">Name Equals</option>
              </select>
              <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            </div>
            {config.driveFolderNameFilter && config.driveFolderNameFilter !== "all" && (
              <input
                type="text"
                placeholder="Enter folder name…"
                value={config.driveFolderNameFilterValue ?? ""}
                onChange={e => onChange({ ...config, driveFolderNameFilterValue: e.target.value })}
                className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
              />
            )}
          </div>

          {/* Enable Recursive Search toggle */}
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <label className="text-[12px] font-semibold text-foreground/80">Enable Recursive Search</label>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  Search for new folders within all subfolders, not just the top level. Only triggers when a new folder containing files is found — adding files to existing folders will not trigger.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChange({ ...config, driveRecursiveSearch: !config.driveRecursiveSearch })}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none mt-0.5",
                  config.driveRecursiveSearch ? "bg-primary" : "bg-muted-foreground/30"
                )}
              >
                <span className={cn(
                  "pointer-events-none inline-block size-4 rounded-full bg-white shadow transform transition-transform duration-200",
                  config.driveRecursiveSearch ? "translate-x-4" : "translate-x-0"
                )} />
              </button>
            </div>
          </div>

          {/* Minimum Files Required */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-foreground/80">Minimum Files Required</label>
            <input
              type="number"
              min={0}
              placeholder="e.g., 1"
              value={config.driveMinFilesRequired ?? ""}
              onChange={e => onChange({ ...config, driveMinFilesRequired: parseInt(e.target.value) || 0 })}
              className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
            />
            <p className="text-[11px] text-muted-foreground">
              Only trigger when the folder contains at least this many files (0 = no minimum)
            </p>
          </div>
        </>
      )}

      {/* Batch Strategy — both events */}
      <SelectField
        label="Batch Strategy"
        value={config.driveBatchStrategy ?? "all_as_one"}
        options={[
          { value: "all_as_one",    label: "All files as one ad batch" },
          { value: "one_per_file",  label: "One ad per file" },
          { value: "group_by_type", label: "Group by file type" },
        ]}
        onChange={v => onChange({ ...config, driveBatchStrategy: v as TriggerConfig["driveBatchStrategy"] })}
        description="How to organize files inside each new subfolder into ads"
      />

      {/* Multi-placement note when all_as_one */}
      {(config.driveBatchStrategy ?? "all_as_one") !== "one_per_file" && (
        <div className="px-3 py-2.5 bg-primary/5 border border-primary/15 rounded-xl">
          <p className="text-[11px] text-primary/80 leading-relaxed">
            <span className="font-semibold">Multi-Placement:</span> Files sharing the same base name with dimension suffixes (e.g. creative_1x1.mp4 + creative_9x16.mp4) are auto-grouped into a single multi-placement ad. Works with videos and images. Disabled when Batch Strategy is &quot;One ad per file&quot;.
          </p>
        </div>
      )}

      {/* Check Frequency */}
      <SelectField
        label="Check Frequency"
        value={config.checkFrequency ?? "daily"}
        options={[
          { value: "hourly", label: "Hourly" },
          { value: "daily",  label: "Daily" },
        ]}
        onChange={v => onChange({ ...config, checkFrequency: v as TriggerConfig["checkFrequency"] })}
      />

      {/* Note */}
      <div className="px-3 py-2.5 bg-primary/5 border border-primary/15 rounded-xl">
        <p className="text-[11px] text-primary/80 leading-relaxed">
          <span className="font-semibold">Note:</span>{" "}
          {config.event === "drive_new_folder_in_folder"
            ? "This parent folder will be checked once per day for new subfolders. Folders that have already been processed will not be processed again."
            : "This folder will be checked for new files at the selected frequency. Files that have already been processed will not be processed again."
          }
        </p>
      </div>
    </>
  )
}

// ─── Media Library Setup (Google Drive) ──────────────────────────────────────

interface DriveFolder { id: string; name: string }

function MediaLibrarySetup({ config, onChange }: {
  config: TriggerConfig
  onChange: (c: TriggerConfig) => void
}) {
  const [connected, setConnected]   = useState<boolean | null>(null)
  const [folders, setFolders]       = useState<DriveFolder[]>([])
  const [loadingFolders, setLoadingFolders] = useState(false)

  // Check Google Drive connection on mount
  useEffect(() => {
    fetch("/api/google/token")
      .then(r => r.json())
      .then(d => setConnected(d.connected === true))
      .catch(() => setConnected(false))
  }, [])

  // Load folders when "specific" board is selected
  useEffect(() => {
    if (config.mediaBoard !== "specific") return
    setLoadingFolders(true)
    fetch("/api/google/drive/folders")
      .then(r => r.json())
      .then(d => setFolders(d.folders ?? []))
      .catch(() => setFolders([]))
      .finally(() => setLoadingFolders(false))
  }, [config.mediaBoard])

  if (connected === null) return (
    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
      <IconLoader2 className="size-3.5 animate-spin" /> Checking Google Drive…
    </div>
  )

  if (!connected) return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <IconBrandGoogleDrive className="size-5 text-[#34A853] shrink-0" />
        <div>
          <p className="text-[13px] font-semibold">Connect Google Drive</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Required to use Media Library trigger</p>
        </div>
      </div>
      <a
        href="/connect"
        className="flex items-center justify-center h-8 w-full rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90 transition-colors"
      >
        Connect Google Drive
      </a>
    </div>
  )

  const boardOp = config.mediaBoard ?? "all"
  const nameFilterOps = ["name_contains","name_equals","name_does_not_contain","name_starts_with","name_ends_with"]

  return (
    <>
      {/* Board */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-foreground/80">Board</label>
        <div className="relative">
          <select
            value={boardOp}
            onChange={e => onChange({ ...config, mediaBoard: e.target.value as TriggerConfig["mediaBoard"], mediaBoardId: undefined, mediaBoardName: undefined })}
            className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
          >
            <option value="all">All Boards</option>
            <option value="name_contains">Name contains</option>
            <option value="name_equals">Name equals</option>
            <option value="name_does_not_contain">Name does not contain</option>
            <option value="name_starts_with">Name starts with</option>
            <option value="name_ends_with">Name ends with</option>
            <option value="specific">Select specific board</option>
          </select>
          <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        </div>
        {boardOp === "all" && (
          <p className="text-[11px] text-muted-foreground">Triggers for uploads to any board</p>
        )}

        {/* Name filter text input */}
        {nameFilterOps.includes(boardOp) && (
          <input
            type="text"
            placeholder="Enter folder name…"
            value={config.mediaBoardFilter ?? ""}
            onChange={e => onChange({ ...config, mediaBoardFilter: e.target.value })}
            className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
          />
        )}

        {/* Specific folder picker */}
        {boardOp === "specific" && (
          <div className="relative">
            <select
              value={config.mediaBoardId ?? ""}
              onChange={e => {
                const folder = folders.find(f => f.id === e.target.value)
                onChange({ ...config, mediaBoardId: folder?.id, mediaBoardName: folder?.name })
              }}
              className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
              disabled={loadingFolders}
            >
              <option value="">{loadingFolders ? "Loading folders…" : "Select a folder"}</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          </div>
        )}
      </div>

      {/* Asset Name */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-foreground/80">Asset Name</label>
        <div className="relative">
          <select
            value={config.mediaAssetName ?? "all"}
            onChange={e => onChange({ ...config, mediaAssetName: e.target.value as TriggerConfig["mediaAssetName"], mediaNameFilter: undefined })}
            className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
          >
            <option value="all">All Names</option>
            <option value="name_contains">Name contains</option>
            <option value="name_equals">Name equals</option>
            <option value="name_does_not_contain">Name does not contain</option>
            <option value="name_starts_with">Name starts with</option>
            <option value="name_ends_with">Name ends with</option>
          </select>
          <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        </div>
        {(config.mediaAssetName && config.mediaAssetName !== "all") && (
          <input
            type="text"
            placeholder="Enter asset name…"
            value={config.mediaNameFilter ?? ""}
            onChange={e => onChange({ ...config, mediaNameFilter: e.target.value })}
            className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
          />
        )}
        {(!config.mediaAssetName || config.mediaAssetName === "all") && (
          <p className="text-[11px] text-muted-foreground">Triggers for assets with any name</p>
        )}
      </div>

      {/* Media Type */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-foreground/80">Media Type</label>
        <div className="relative">
          <select
            value={config.mediaType ?? "all"}
            onChange={e => onChange({ ...config, mediaType: e.target.value as TriggerConfig["mediaType"] })}
            className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
          >
            <option value="all">All Media</option>
            <option value="images">Images Only</option>
            <option value="videos">Videos Only</option>
          </select>
          <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Trigger Timing */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-foreground/80">Trigger Timing</label>
        <div className="relative">
          <select
            value={config.triggerTiming ?? "immediately"}
            onChange={e => onChange({ ...config, triggerTiming: e.target.value as TriggerConfig["triggerTiming"] })}
            className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
          >
            <option value="immediately">Immediately on Upload</option>
            <option value="on_approved">When Media is Approved</option>
          </select>
          <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {config.triggerTiming === "on_approved"
            ? "Automation will run when media is approved."
            : "Automation will run immediately when media is added to the board"}
        </p>
      </div>

      {/* Asset Status */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-foreground/80">Asset Status</label>
        <div className="relative">
          <select
            value={config.assetStatus ?? "all"}
            onChange={e => onChange({ ...config, assetStatus: e.target.value as TriggerConfig["assetStatus"] })}
            className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
          >
            <option value="all">All Status</option>
            <option value="approved">Approved</option>
            <option value="in_progress">In Progress</option>
            <option value="archived">Archived</option>
          </select>
          <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        </div>
        <p className="text-[11px] text-muted-foreground">Filter by asset approval status (default: all)</p>
      </div>

      {/* Asset Grouping toggle */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-foreground/80">Asset Grouping</label>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground leading-snug">
            {config.assetGrouping
              ? "Enabled — uploads are grouped before triggering"
              : "Disabled — each upload triggers actions immediately"}
          </p>
          <button
            type="button"
            onClick={() => onChange({ ...config, assetGrouping: !config.assetGrouping })}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none",
              config.assetGrouping ? "bg-primary" : "bg-muted-foreground/30"
            )}
          >
            <span className={cn(
              "pointer-events-none inline-block size-4 rounded-full bg-white shadow transform transition-transform duration-200",
              config.assetGrouping ? "translate-x-4" : "translate-x-0"
            )} />
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Data Mapping (Google Sheets) ────────────────────────────────────────────

function DataMappingSection({ config, onChange }: {
  config: TriggerConfig
  onChange: (c: TriggerConfig) => void
}) {
  const mappings = config.sheetsDataMappings ?? [{ label: "", cell: "" }, { label: "", cell: "" }, { label: "", cell: "" }]

  const update = (i: number, field: "label" | "cell", value: string) => {
    const next = [...mappings]; next[i] = { ...next[i], [field]: value }
    onChange({ ...config, sheetsDataMappings: next })
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-[12px] font-semibold text-foreground/80">Data Mapping</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">Map cells to data fields (optional)</p>
      </div>
      <div className="space-y-2">
        {mappings.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              placeholder="Label"
              value={m.label}
              onChange={e => update(i, "label", e.target.value)}
              className="flex-1 h-8 px-2.5 text-[12px] bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40"
            />
            <input
              placeholder="Cell"
              value={m.cell}
              onChange={e => update(i, "cell", e.target.value)}
              className="w-20 h-8 px-2.5 text-[12px] bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40"
            />
            <button
              onClick={() => onChange({ ...config, sheetsDataMappings: mappings.filter((_, j) => j !== i) })}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors shrink-0"
            >
              <IconX className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => onChange({ ...config, sheetsDataMappings: [...mappings, { label: "", cell: "" }] })}
        className="flex items-center gap-1.5 text-[12px] text-primary hover:underline font-medium"
      >
        <IconPlus className="size-3.5" />
        Add Mapping
      </button>
    </div>
  )
}

// ─── Google Sheets trigger setup ──────────────────────────────────────────────

const SHEETS_SERVICE_ACCOUNT =
  process.env.NEXT_PUBLIC_SHEETS_SERVICE_ACCOUNT ?? "adlauncher-sheets@adlauncher-app.iam.gserviceaccount.com"

function GoogleSheetsTriggerSetup({ config, onChange }: {
  config: TriggerConfig
  onChange: (c: TriggerConfig) => void
}) {
  const [copied, setCopied] = useState(false)

  const copyEmail = () => {
    navigator.clipboard.writeText(SHEETS_SERVICE_ACCOUNT).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSpreadsheetInput = (raw: string) => {
    const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
    onChange({ ...config, sheetsSpreadsheetId: match ? match[1] : raw })
  }

  const event     = config.event
  const watchMode = config.sheetsWatchMode ?? "single_cell"
  const condition = config.sheetsCondition ?? "equals"
  const needsValue = condition !== "is_empty" && condition !== "not_empty"
  const showDataMapping = watchMode === "entire_column"
    || event === "sheets_new_row_launch"
    || event === "sheets_new_row_catalog"

  return (
    <>
      {/* Trigger Event */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
          Trigger Event
        </label>
        <div className="relative">
          <select
            value={event}
            onChange={e => onChange({ ...config, event: e.target.value as TriggerConfig["event"] })}
            className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
          >
            <option value="">Choose an event</option>
            <option value="sheets_cell_changed">Cell Value Changed</option>
            <option value="sheets_new_row_launch">New Rows to Launch</option>
            <option value="sheets_new_row_catalog">New Rows to Catalog</option>
          </select>
          <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      <div className="pt-1 border-t border-border/60 space-y-4">
        <p className="text-[13px] font-semibold text-foreground/90">Configure Google Sheets Trigger</p>

        {/* Service Account Access */}
        <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2.5">
          <p className="text-[12px] font-semibold text-foreground/80">Service Account Access</p>
          <div className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg">
            <code className="flex-1 text-[11px] text-foreground/70 truncate font-mono select-all">
              {SHEETS_SERVICE_ACCOUNT}
            </code>
            <button
              onClick={copyEmail}
              className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
              title="Copy email"
            >
              {copied
                ? <IconCheck className="size-3.5 text-green-500" />
                : <IconCopy className="size-3.5" />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Share your spreadsheet with this email and grant <span className="font-semibold">Viewer</span> access to allow reading sheet data.
          </p>
        </div>

        {/* Spreadsheet ID or URL */}
        <div className="space-y-1.5">
          <label className="text-[12px] font-semibold text-foreground/80">
            Spreadsheet ID or URL <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Paste spreadsheet URL or ID"
            value={config.sheetsSpreadsheetId ?? ""}
            onChange={e => handleSpreadsheetInput(e.target.value)}
            className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
          />
          <p className="text-[11px] text-muted-foreground">
            Paste the full URL or just the ID from docs.google.com/spreadsheets/d/<strong>[ID]</strong>/edit
          </p>
        </div>

        {/* Sheet Name */}
        <div className="space-y-1.5">
          <label className="text-[12px] font-semibold text-foreground/80">Sheet Name</label>
          <input
            type="text"
            placeholder="Sheet1"
            value={config.sheetsSheetName ?? "Sheet1"}
            onChange={e => onChange({ ...config, sheetsSheetName: e.target.value })}
            className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-[11px] text-muted-foreground">The name of the sheet tab (default: Sheet1)</p>
        </div>

        {/* Watch Mode — Cell Value Changed only */}
        {event === "sheets_cell_changed" && (
          <SelectField
            label="Watch Mode"
            value={watchMode}
            options={[
              { value: "single_cell",   label: "Single Cell" },
              { value: "entire_column", label: "Entire Column" },
            ]}
            onChange={v => onChange({ ...config, sheetsWatchMode: v as TriggerConfig["sheetsWatchMode"] })}
            description={watchMode === "single_cell" ? "Watch a single cell for changes" : "Watch an entire column for new values"}
          />
        )}

        {/* Trigger Condition — Single Cell only */}
        {event === "sheets_cell_changed" && watchMode === "single_cell" && (
          <div className="p-3.5 border border-border rounded-xl space-y-3 bg-muted/20">
            <div>
              <p className="text-[12px] font-semibold text-foreground/80">Trigger Condition</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Automation runs when this cell matches the condition</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">
                Trigger Cell <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="C5"
                value={config.sheetsTriggerCell ?? ""}
                onChange={e => onChange({ ...config, sheetsTriggerCell: e.target.value })}
                className="w-28 h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
              />
              <p className="text-[11px] text-muted-foreground">Cell reference to watch (e.g., C5, D10, AA1)</p>
            </div>
            <SelectField
              label="Condition"
              value={condition}
              options={SHEETS_CONDITIONS}
              onChange={v => onChange({ ...config, sheetsCondition: v as TriggerConfig["sheetsCondition"] })}
            />
            {needsValue && (
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-foreground/80">
                  Value <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="TRUE"
                  value={config.sheetsConditionValue ?? ""}
                  onChange={e => onChange({ ...config, sheetsConditionValue: e.target.value })}
                  className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
                />
                <p className="text-[11px] text-muted-foreground">Trigger when cell equals this value</p>
              </div>
            )}
          </div>
        )}

        {/* New Rows to Launch — extra fields */}
        {event === "sheets_new_row_launch" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-foreground/80">Header Row</label>
                <input
                  type="number" min={1}
                  value={config.sheetsHeaderRow ?? 1}
                  onChange={e => onChange({ ...config, sheetsHeaderRow: parseInt(e.target.value) || 1 })}
                  className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-center"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-foreground/80">Data Start Row</label>
                <input
                  type="number" min={1}
                  value={config.sheetsDataStartRow ?? 2}
                  onChange={e => onChange({ ...config, sheetsDataStartRow: parseInt(e.target.value) || 2 })}
                  className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-center"
                />
              </div>
            </div>

            <SelectField
              label="Check Frequency"
              value={config.sheetsCheckFrequency ?? "daily"}
              options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]}
              onChange={v => onChange({ ...config, sheetsCheckFrequency: v as any })}
              description="How often to check for new rows in the sheet"
              required
            />

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-semibold text-foreground/80">Process existing rows on first run</p>
                </div>
                <button
                  type="button"
                  onClick={() => onChange({ ...config, sheetsProcessExistingRows: !(config.sheetsProcessExistingRows ?? false) })}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none",
                    config.sheetsProcessExistingRows ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                >
                  <span className={cn(
                    "pointer-events-none inline-block size-4 rounded-full bg-white shadow transform transition-transform duration-200",
                    config.sheetsProcessExistingRows ? "translate-x-4" : "translate-x-0"
                  )} />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">Existing rows will be recorded but not processed on the first run. Only new rows added after the first run will trigger actions.</p>
            </div>
          </>
        )}

        {/* New Rows to Catalog — extra fields */}
        {event === "sheets_new_row_catalog" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-foreground/80">Header Row</label>
                <input
                  type="number" min={1}
                  value={config.sheetsHeaderRow ?? 1}
                  onChange={e => onChange({ ...config, sheetsHeaderRow: parseInt(e.target.value) || 1 })}
                  className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-center"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-foreground/80">Data Start Row</label>
                <input
                  type="number" min={1}
                  value={config.sheetsDataStartRow ?? 2}
                  onChange={e => onChange({ ...config, sheetsDataStartRow: parseInt(e.target.value) || 2 })}
                  className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-center"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">Catalog Selection Mode <span className="text-red-500">*</span></label>
              <div className="relative">
                <select
                  value={config.sheetsCatalogSelectionMode ?? "single"}
                  onChange={e => onChange({ ...config, sheetsCatalogSelectionMode: e.target.value as any })}
                  className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                >
                  <option value="single">Single Catalog (all products go to one catalog)</option>
                  <option value="per_row">Per Row (catalog ID from a sheet column)</option>
                </select>
                <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              </div>
              <p className="text-[11px] text-muted-foreground">Select a catalog below — all products from the sheet will be added to this catalog.</p>
            </div>

            {config.sheetsCatalogSelectionMode !== "per_row" && (
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-foreground/80">Catalog <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="Catalog ID"
                  value={config.sheetsCatalogId ?? ""}
                  onChange={e => onChange({ ...config, sheetsCatalogId: e.target.value })}
                  className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
                />
                <p className="text-[11px] text-muted-foreground">Enter your Meta Catalog ID</p>
              </div>
            )}

            <SelectField
              label="Check Frequency"
              value={config.sheetsCheckFrequency ?? "daily"}
              options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]}
              onChange={v => onChange({ ...config, sheetsCheckFrequency: v as any })}
              description="How often to check for new rows in the sheet"
              required
            />

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold text-foreground/80">Process existing rows on first run</p>
                <button
                  type="button"
                  onClick={() => onChange({ ...config, sheetsProcessExistingRows: !(config.sheetsProcessExistingRows ?? false) })}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none",
                    config.sheetsProcessExistingRows ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                >
                  <span className={cn(
                    "pointer-events-none inline-block size-4 rounded-full bg-white shadow transform transition-transform duration-200",
                    config.sheetsProcessExistingRows ? "translate-x-4" : "translate-x-0"
                  )} />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">Only new rows added after the first run will trigger product creation.</p>
            </div>
          </>
        )}

        {/* Load Columns (New Rows triggers) */}
        {(event === "sheets_new_row_launch" || event === "sheets_new_row_catalog") && (
          <button
            disabled={!config.sheetsSpreadsheetId}
            className="w-full h-9 flex items-center justify-center gap-2 text-[13px] border border-border rounded-lg text-muted-foreground hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <IconRefresh className="size-3.5" />
            Load Columns
          </button>
        )}

        {/* Data Mapping */}
        {showDataMapping && <DataMappingSection config={config} onChange={onChange} />}

        {/* Note */}
        <div className="px-3 py-2.5 bg-primary/5 border border-primary/15 rounded-xl">
          <p className="text-[11px] text-primary/80">
            <span className="font-semibold">Note:</span> This cell will be checked daily at midnight UTC.
          </p>
        </div>
      </div>
    </>
  )
}

// ─── Schedule Trigger Setup ───────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  { value: "monday",    label: "Monday" },
  { value: "tuesday",   label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday",  label: "Thursday" },
  { value: "friday",    label: "Friday" },
  { value: "saturday",  label: "Saturday" },
  { value: "sunday",    label: "Sunday" },
]

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}))

function ScheduleTriggerSetup({ config, onChange }: {
  config: TriggerConfig
  onChange: (c: TriggerConfig) => void
}) {
  const freq = config.scheduleFrequency ?? "daily"

  const timeDesc =
    freq === "daily"   ? "Runs every day at this time." :
    freq === "weekly"  ? "Runs every week at this time." :
    freq === "monthly" ? "Runs on the selected day of each month." :
    "The automation will run once at this time."

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] font-semibold text-foreground">Schedule Configuration</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">Set when and how often this automation should run.</p>
      </div>

      {/* Frequency */}
      <SelectField
        label="Frequency" value={freq} required
        options={[
          { value: "one_time", label: "One-time" },
          { value: "daily",    label: "Daily"    },
          { value: "weekly",   label: "Weekly"   },
          { value: "monthly",  label: "Monthly"  },
        ]}
        onChange={v => onChange({ ...config, scheduleFrequency: v as TriggerConfig["scheduleFrequency"] })}
      />

      {/* One-time: Scheduled Date + Time */}
      {freq === "one_time" && (
        <>
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-foreground/80">Scheduled Date <span className="text-red-500">*</span></label>
            <input type="date"
              value={config.scheduleDate ?? ""}
              onChange={e => onChange({ ...config, scheduleDate: e.target.value })}
              className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-foreground/80">Time <span className="text-red-500">*</span></label>
            <input type="time"
              value={config.scheduleTime ?? "09:00"}
              onChange={e => onChange({ ...config, scheduleTime: e.target.value })}
              className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-foreground/80">Timezone</label>
            <select
              value={config.scheduleTimezone ?? "UTC"}
              onChange={e => onChange({ ...config, scheduleTimezone: e.target.value })}
              className="w-full h-9 px-2 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="UTC">UTC</option>
              <option value="Asia/Ho_Chi_Minh">Vietnam (UTC+7)</option>
              <option value="Asia/Bangkok">Bangkok (UTC+7)</option>
              <option value="Asia/Singapore">Singapore (UTC+8)</option>
              <option value="Asia/Tokyo">Tokyo (UTC+9)</option>
              <option value="America/New_York">New York (UTC-5/-4)</option>
              <option value="America/Los_Angeles">Los Angeles (UTC-8/-7)</option>
              <option value="Europe/London">London (UTC+0/+1)</option>
            </select>
            <p className="text-[11px] text-muted-foreground">Giờ hiện tại là UTC. Chọn timezone để cron chạy đúng giờ địa phương.</p>
          </div>
        </>
      )}

      {/* Weekly: Day of Week */}
      {freq === "weekly" && (
        <SelectField
          label="Day of Week" value={config.scheduleDayOfWeek ?? ""}
          options={[{ value: "", label: "Select day" }, ...DAYS_OF_WEEK]}
          onChange={v => onChange({ ...config, scheduleDayOfWeek: v as TriggerConfig["scheduleDayOfWeek"] })}
          required
        />
      )}

      {/* Monthly: Day of Month */}
      {freq === "monthly" && (
        <SelectField
          label="Day of Month" value={config.scheduleDayOfMonth ? String(config.scheduleDayOfMonth) : ""}
          options={[{ value: "", label: "Select day" }, ...DAYS_OF_MONTH]}
          onChange={v => onChange({ ...config, scheduleDayOfMonth: v ? parseInt(v) : undefined })}
          required
        />
      )}

      {/* Time — for daily/weekly/monthly */}
      {freq !== "one_time" && (
        <div className="space-y-1.5">
          <label className="text-[12px] font-semibold text-foreground/80">Time <span className="text-red-500">*</span></label>
          <input type="time"
            value={config.scheduleTime ?? "09:00"}
            onChange={e => onChange({ ...config, scheduleTime: e.target.value })}
            className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-[11px] text-muted-foreground">{timeDesc}</p>
        </div>
      )}

      {/* Start Date — for daily/weekly/monthly */}
      {freq !== "one_time" && (
        <div className="space-y-1.5">
          <label className="text-[12px] font-semibold text-foreground/80">Start Date <span className="text-red-500">*</span></label>
          <input type="date"
            value={config.scheduleStartDate ?? ""}
            onChange={e => onChange({ ...config, scheduleStartDate: e.target.value })}
            className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-[11px] text-muted-foreground">The automation will start running from this date.</p>
        </div>
      )}

      {/* End Date — optional for daily/weekly/monthly */}
      {freq !== "one_time" && (
        <div className="space-y-1.5">
          <label className="text-[12px] font-semibold text-foreground/80">End Date <span className="text-muted-foreground font-normal">(optional)</span></label>
          <input type="date"
            value={config.scheduleEndDate ?? ""}
            onChange={e => onChange({ ...config, scheduleEndDate: e.target.value || undefined })}
            className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-[11px] text-muted-foreground">Leave empty to run indefinitely.</p>
        </div>
      )}
    </div>
  )
}

// ─── Meta Trigger Setup ───────────────────────────────────────────────────────

interface MetaAdAccount {
  id: string
  fb_ad_account_id: string
  name: string
  currency?: string
  account_status?: number
  is_active?: boolean
}

function MetaTriggerSetup({ config, onChange, conditions, updateCondition, removeCondition }: {
  config: TriggerConfig
  onChange: (c: TriggerConfig) => void
  conditions: MetricCondition[]
  updateCondition: (i: number, c: MetricCondition) => void
  removeCondition: (i: number) => void
}) {
  const [showCampaignPicker, setShowCampaignPicker] = useState(false)
  const [adAccounts, setAdAccounts]                 = useState<MetaAdAccount[]>([])
  const [loadingAccounts, setLoadingAccounts]       = useState(true)
  const [metaConnected, setMetaConnected]           = useState<boolean | null>(null)
  const [openAccountPicker, setOpenAccountPicker]   = useState(false)
  const [searchAccount, setSearchAccount]           = useState("")

  useEffect(() => {
    fetch("/api/facebook/ad-accounts")
      .then(r => r.json())
      .then(d => {
        const accounts = (d.adAccounts ?? []).map((a: any) => ({
          id:                a.id,
          fb_ad_account_id:  a.id,
          name:              a.name,
          currency:          a.currency,
          account_status:    a.account_status,
          is_active:         a.account_status === 1,
        }))
        setAdAccounts(accounts)
        setMetaConnected(d.connected !== false)
      })
      .catch(() => { setAdAccounts([]); setMetaConnected(false) })
      .finally(() => setLoadingAccounts(false))
  }, [])

  const selectedAccountId = config.adAccountIds?.[0] ?? ""
  const selectedAccount   = adAccounts.find(a => a.fb_ad_account_id === selectedAccountId || a.id === selectedAccountId)

  const event           = config.event
  const monitoringLevel = config.monitoringLevel ?? "account"
  const campaignFilter  = config.campaignFilter ?? "all"
  const showCampaignFilter = event === "performance_monitoring" && monitoringLevel !== "account"

  return (
    <>
      {/* Trigger Event */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-foreground/80">Trigger Event</label>
        <div className="relative">
          <select
            value={event}
            onChange={e => onChange({ ...config, event: e.target.value as TriggerConfig["event"], campaignFilter: "all", specificCampaignId: undefined, specificCampaignName: undefined, campaignNameFilterValue: undefined })}
            className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
          >
            <option value="">Choose an event</option>
            <option value="ad_approved">Ad Approved</option>
            <option value="campaign_status_change">Campaign Status Change</option>
            <option value="performance_monitoring">Performance Monitoring</option>
            <option value="spend_threshold">Performance Threshold</option>
            <option value="best_performing_organic_post">Best Performing Organic Post</option>
          </select>
          <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        </div>
        {event && (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {event === "performance_monitoring" && "Detect when metrics change by a percentage between consecutive time periods. For example: \"Spend increased by 20% AND CPA increased by 15% day over day.\""}
            {event === "campaign_status_change"  && "Triggers when campaigns match a specific status. Use this to detect when campaigns become active, get paused, or encounter issues."}
            {event === "ad_approved"             && "Fires when a Meta ad is approved and moves to active status."}
            {event === "spend_threshold"         && "Fires when spend crosses a defined threshold."}
            {event === "best_performing_organic_post" && "Fires when an organic post outperforms your ads — use it to automatically boost top content."}
          </p>
        )}
      </div>

      {/* Ad Account(s) */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-foreground/80">
          Ad Account <span className="text-red-500">*</span>
        </label>
        {loadingAccounts ? (
          <div className="flex items-center gap-2 h-9 px-3 border border-border rounded-lg text-[13px] text-muted-foreground">
            <IconLoader2 className="size-3.5 animate-spin shrink-0" /> Loading accounts…
          </div>
        ) : metaConnected === false ? (
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2.5">
              <IconBrandMeta className="size-5 text-[#1877F2] shrink-0" />
              <div>
                <p className="text-[13px] font-semibold">Connect Meta</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Required to use Meta trigger</p>
              </div>
            </div>
            <a
              href="/connect"
              className="flex items-center justify-center h-8 w-full rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90 transition-colors"
            >
              Connect Meta
            </a>
          </div>
        ) : adAccounts.length === 0 ? (
          <div className="px-3 py-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-[12px] text-amber-700 dark:text-amber-400">No ad accounts found in your Meta account. Make sure you have access to at least one ad account.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Trigger button */}
            <button
              type="button"
              onClick={() => setOpenAccountPicker(v => !v)}
              className="w-full flex items-center gap-2 h-9 px-3 border border-border rounded-lg bg-background text-[13px] text-left hover:border-primary/50 transition-colors"
            >
              <div className="size-5 rounded-full bg-[#0064E0]/10 flex items-center justify-center shrink-0">
                <IconBrandMeta className="size-3 text-[#0064E0]" />
              </div>
              <span className={cn("flex-1 truncate", !selectedAccount && "text-muted-foreground")}>
                {selectedAccount
                  ? selectedAccount.name.replace(/\s*\(GMT[+-]\d+\)/gi, "").trim()
                  : "Select an ad account…"}
              </span>
              <IconChevronDown className="size-3.5 text-muted-foreground shrink-0" />
            </button>

            {/* Dropdown */}
            {openAccountPicker && (
              <div className="absolute top-full left-0 mt-1 w-full bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                {/* Search */}
                <div className="px-3 pt-3 pb-2">
                  <div className="relative">
                    <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50 pointer-events-none" />
                    <input
                      autoFocus
                      value={searchAccount}
                      onChange={e => setSearchAccount(e.target.value)}
                      placeholder="Search account…"
                      className="w-full pl-8 pr-3 py-1.5 text-[13px] bg-muted/40 border border-border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                    />
                  </div>
                </div>
                {/* List */}
                <div className="max-h-52 overflow-y-auto">
                  {adAccounts
                    .filter(a => !searchAccount || a.name.toLowerCase().includes(searchAccount.toLowerCase()))
                    .map(a => {
                      const actId   = a.fb_ad_account_id ?? a.id
                      const isSelected = actId === selectedAccountId || a.id === selectedAccountId
                      const displayName = a.name.replace(/\s*\(GMT[+-]\d+\)/gi, "").trim()
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            onChange({ ...config, adAccountIds: [actId] })
                            setOpenAccountPicker(false)
                            setSearchAccount("")
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left",
                            isSelected && "bg-primary/5"
                          )}
                        >
                          <div className="size-4 shrink-0">
                            {isSelected && <IconCheck className="size-4 text-primary" />}
                          </div>
                          <div className="size-5 rounded-full bg-[#0064E0]/10 flex items-center justify-center shrink-0">
                            <IconBrandMeta className="size-3 text-[#0064E0]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium truncate">{displayName}</p>
                            <p className="text-[11px] text-muted-foreground">{actId}</p>
                          </div>
                        </button>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Performance Monitoring ═══ */}
      {event === "performance_monitoring" && (
        <>
          {/* Monitoring Level */}
          <SelectField
            label="Monitoring Level"
            value={monitoringLevel}
            options={MONITORING_LEVELS}
            onChange={v => onChange({ ...config, monitoringLevel: v as TriggerConfig["monitoringLevel"], campaignFilter: "all", specificCampaignId: undefined, specificCampaignName: undefined })}
            description={MONITORING_LEVEL_DESC[monitoringLevel] ?? ""}
          />

          {/* Campaign Filter — only when not Account Level */}
          {showCampaignFilter && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-foreground/80">Campaign Filter</label>
                <div className="relative">
                  <select
                    value={campaignFilter}
                    onChange={e => onChange({ ...config, campaignFilter: e.target.value as TriggerConfig["campaignFilter"], specificCampaignId: undefined, specificCampaignName: undefined, campaignNameFilterValue: undefined })}
                    className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                  >
                    <option value="all">All Campaigns</option>
                    <option value="specific">Select Specific Campaign</option>
                    <option value="name_contains">Name Contains</option>
                    <option value="name_equals">Name Equals</option>
                  </select>
                  <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Select specific campaign */}
              {campaignFilter === "specific" && (
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-foreground/80">Campaign <span className="text-red-500">*</span></label>
                  {config.specificCampaignId && config.specificCampaignName ? (
                    <div className="flex items-center gap-2 h-9 px-3 bg-background border border-primary/30 rounded-lg">
                      <div className="size-2 rounded-full bg-green-500 shrink-0" />
                      <span className="flex-1 text-[13px] truncate">{config.specificCampaignName}</span>
                      <button onClick={() => onChange({ ...config, specificCampaignId: undefined, specificCampaignName: undefined })} className="text-muted-foreground hover:text-destructive shrink-0"><IconX className="size-3.5" /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCampaignPicker(true)}
                      className="w-full flex items-center justify-between h-9 px-3 border border-dashed border-border rounded-lg text-[13px] text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                    >
                      <span>Select a campaign…</span>
                      <IconChevronDown className="size-3.5 shrink-0" />
                    </button>
                  )}
                </div>
              )}

              {/* Name filter input */}
              {(campaignFilter === "name_contains" || campaignFilter === "name_equals") && (
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-foreground/80">Campaign Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Scaling, Prospecting"
                    value={config.campaignNameFilterValue ?? ""}
                    onChange={e => onChange({ ...config, campaignNameFilterValue: e.target.value })}
                    className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
                  />
                </div>
              )}
            </div>
          )}

          {/* Metric Conditions */}
          <div className="space-y-2">
            <div>
              <label className="text-[12px] font-semibold text-foreground/80">
                Metric Conditions <span className="text-red-500">*</span>
              </label>
              <p className="text-[11px] text-muted-foreground mt-0.5">Define one or more metric conditions. Using AND logic between conditions.</p>
            </div>
            <div className="space-y-1.5">
              {conditions.map((cond, i) => (
                <div key={i}>
                  {i > 0 && (
                    <div className="flex items-center gap-2 my-1.5">
                      <div className="h-px flex-1 bg-border/60" />
                      <div className="px-2 py-0.5 rounded border border-border text-[10px] font-semibold text-muted-foreground">
                        AND
                      </div>
                      <div className="h-px flex-1 bg-border/60" />
                    </div>
                  )}
                  <MetricConditionRow
                    cond={cond}
                    onChange={c => updateCondition(i, c)}
                    onRemove={() => removeCondition(i)}
                    canRemove={conditions.length > 1}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={() => onChange({ ...config, metricConditions: [...conditions, { metric: "", operator: "decreases_by", value: 20, unit: "%" }] })}
              className="flex items-center gap-1.5 text-[12px] text-primary hover:underline font-medium mt-1"
            >
              <IconPlus className="size-3.5" />
              Add condition
            </button>
          </div>

          {/* Comparison Window */}
          <SelectField
            label="Comparison Window"
            value={config.comparisonWindow ?? "day_over_day"}
            options={COMPARISON_WINDOWS}
            onChange={v => onChange({ ...config, comparisonWindow: v as TriggerConfig["comparisonWindow"] })}
            description={(config.comparisonWindow ?? "day_over_day") === "day_over_day" ? "Compares yesterday vs the day before" : "Compares this week vs last week"}
            required
          />

          {/* Check Frequency */}
          <SelectField
            label="Check Frequency"
            value={config.checkFrequency ?? "daily"}
            options={META_FREQUENCIES}
            onChange={v => onChange({ ...config, checkFrequency: v as TriggerConfig["checkFrequency"] })}
            description="How often the system checks for changes."
            required
          />
        </>
      )}

      {/* ═══ Ad Approved ═══ */}
      {event === "ad_approved" && (
        <div className="pt-1 border-t border-border/60 space-y-4">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Ad Approved Trigger</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              Triggers when ads transition from review to active (approved). Checks for recently approved ads based on the lookback window.
            </p>
          </div>

          {/* Campaign Filter */}
          <div className="space-y-2">
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">Campaign Filter</label>
              <div className="relative">
                <select
                  value={config.campaignFilter ?? "all"}
                  onChange={e => onChange({ ...config, campaignFilter: e.target.value as TriggerConfig["campaignFilter"], campaignNameFilterValue: undefined })}
                  className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                >
                  <option value="all">All Campaigns</option>
                  <option value="name_contains">Name Contains</option>
                  <option value="name_equals">Name Equals</option>
                </select>
                <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            {(config.campaignFilter === "name_contains" || config.campaignFilter === "name_equals") && (
              <input
                type="text"
                placeholder="e.g., Scaling, Prospecting"
                value={config.campaignNameFilterValue ?? ""}
                onChange={e => onChange({ ...config, campaignNameFilterValue: e.target.value })}
                className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
              />
            )}
          </div>

          {/* Ad Set Filter */}
          <div className="space-y-2">
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">Ad Set Filter</label>
              <div className="relative">
                <select
                  value={config.adSetFilter ?? "all"}
                  onChange={e => onChange({ ...config, adSetFilter: e.target.value as TriggerConfig["adSetFilter"], adSetNameFilterValue: undefined })}
                  className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                >
                  <option value="all">All Ad Sets</option>
                  <option value="name_contains">Name Contains</option>
                  <option value="name_equals">Name Equals</option>
                </select>
                <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            {(config.adSetFilter === "name_contains" || config.adSetFilter === "name_equals") && (
              <input
                type="text"
                placeholder="e.g., US || Broad, Retargeting"
                value={config.adSetNameFilterValue ?? ""}
                onChange={e => onChange({ ...config, adSetNameFilterValue: e.target.value })}
                className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
              />
            )}
          </div>

          {/* Lookback Window */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-foreground/80">
              Lookback Window <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={config.lookbackWindow ?? "24h"}
                onChange={e => onChange({ ...config, lookbackWindow: e.target.value as TriggerConfig["lookbackWindow"] })}
                className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
              >
                <option value="1h">Last 1 hour</option>
                <option value="6h">Last 6 hours</option>
                <option value="12h">Last 12 hours</option>
                <option value="24h">Last 24 hours</option>
                <option value="48h">Last 48 hours</option>
              </select>
              <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            </div>
            <p className="text-[11px] text-muted-foreground">How far back to look for recently approved ads</p>
          </div>
        </div>
      )}

      {/* ═══ Campaign Status Change ═══ */}
      {event === "campaign_status_change" && (
        <div className="pt-1 border-t border-border/60 space-y-4">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Campaign Status Change Trigger</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">Triggers when campaigns match a specific status. Use this to detect when campaigns become active, get paused, or encounter issues.</p>
          </div>

          {/* Campaign Filter */}
          <div className="space-y-2">
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">Campaign Filter</label>
              <div className="relative">
                <select
                  value={campaignFilter}
                  onChange={e => onChange({ ...config, campaignFilter: e.target.value as TriggerConfig["campaignFilter"], campaignNameFilterValue: undefined, specificCampaignId: undefined, specificCampaignName: undefined })}
                  className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                >
                  <option value="all">All Campaigns</option>
                  <option value="name_contains">Name Contains</option>
                  <option value="name_equals">Name Equals</option>
                </select>
                <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Name filter */}
            {(campaignFilter === "name_contains" || campaignFilter === "name_equals") && (
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-foreground/80">Campaign Name</label>
                <input
                  type="text"
                  placeholder="e.g., Scaling, Prospecting"
                  value={config.campaignNameFilterValue ?? ""}
                  onChange={e => onChange({ ...config, campaignNameFilterValue: e.target.value })}
                  className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
                />
              </div>
            )}
          </div>

          {/* Target Status */}
          <SelectField
            label="Target Status"
            value={config.campaignStatusTarget ?? "active"}
            options={[
              { value: "active",         label: "Active" },
              { value: "paused",         label: "Paused" },
              { value: "with_issues",    label: "With Issues" },
              { value: "pending_review", label: "Pending Review" },
              { value: "archived",       label: "Archived" },
            ]}
            onChange={v => onChange({ ...config, campaignStatusTarget: v as TriggerConfig["campaignStatusTarget"] })}
            description="Find campaigns with this effective status"
            required
          />
        </div>
      )}

      {/* ═══ Performance Threshold ═══ */}
      {event === "spend_threshold" && (
        <div className="pt-1 border-t border-border/60 space-y-4">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Performance Threshold</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              Finds ads matching performance criteria and triggers an action. Define conditions like ROAS &gt; 2 AND Spend &gt; $200.
            </p>
          </div>

          {/* Check Frequency */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-foreground/80">Check Frequency <span className="text-red-500">*</span></label>
            <div className="h-9 px-3 flex items-center border border-border rounded-lg bg-muted/30 text-[13px] text-muted-foreground">Daily</div>
            <p className="text-[11px] text-muted-foreground">This automation will automatically run once per day.</p>
          </div>

          {/* Campaign Filter */}
          <div className="space-y-2">
            <label className="text-[12px] font-semibold text-foreground/80">Campaign Filter</label>
            <p className="text-[11px] text-muted-foreground -mt-1">Optionally filter by campaign name</p>
            <div className="relative">
              <select
                value={config.campaignFilter ?? "all"}
                onChange={e => onChange({ ...config, campaignFilter: e.target.value as any, campaignNameFilterValue: undefined })}
                className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
              >
                <option value="all">All Campaigns</option>
                <option value="name_contains">Name Contains</option>
              </select>
              <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            </div>
            {config.campaignFilter === "name_contains" && (
              <input type="text" placeholder="e.g., Scaling, LAB" value={config.campaignNameFilterValue ?? ""}
                onChange={e => onChange({ ...config, campaignNameFilterValue: e.target.value })}
                className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60" />
            )}
          </div>

          {/* Ad Set Filter */}
          <div className="space-y-2">
            <label className="text-[12px] font-semibold text-foreground/80">Ad Set Filter</label>
            <p className="text-[11px] text-muted-foreground -mt-1">Find ads in ad sets matching your filter</p>
            <div className="relative">
              <select
                value={config.thresholdAdSetFilter ?? "all"}
                onChange={e => onChange({ ...config, thresholdAdSetFilter: e.target.value as any, thresholdAdSetFilterValue: undefined })}
                className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
              >
                <option value="all">All Ad Sets</option>
                <option value="name_contains">Ad set name contains...</option>
              </select>
              <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            </div>
            {config.thresholdAdSetFilter === "name_contains" && (
              <input type="text" placeholder="e.g., US || Broad" value={config.thresholdAdSetFilterValue ?? ""}
                onChange={e => onChange({ ...config, thresholdAdSetFilterValue: e.target.value })}
                className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60" />
            )}
          </div>

          {/* Ad Status */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-foreground/80">Ad Status</label>
            <div className="relative">
              <select
                value={config.thresholdAdStatus ?? "all"}
                onChange={e => onChange({ ...config, thresholdAdStatus: e.target.value as any })}
                className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
              >
                <option value="all">All (with spend)</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
              <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Performance Criteria */}
          <div className="pt-2 border-t border-border/40 space-y-4">
            <div>
              <p className="text-[13px] font-semibold text-foreground">Performance Criteria</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Define conditions that must be met (e.g., ROAS &gt; 2 AND Spend &gt; $200)</p>
            </div>

            {/* Performance Period */}
            <SelectField
              label="Performance Period"
              value={config.thresholdPerformancePeriod ?? "7d"}
              options={PERFORMANCE_PERIODS}
              onChange={v => onChange({ ...config, thresholdPerformancePeriod: v as any })}
              description="Time window used to evaluate ad performance metrics"
              required
            />

            {/* Include today + Exclude Recent Days */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.thresholdIncludeToday ?? false}
                  onChange={e => onChange({ ...config, thresholdIncludeToday: e.target.checked })}
                  className="size-3.5 rounded accent-primary"
                />
                <span className="text-[12px] font-medium text-foreground">Include today&apos;s partial data</span>
              </label>
              <p className="text-[11px] text-muted-foreground pl-5">Use live Meta insights through today, even though conversions and CPA may still change.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">Exclude Recent Days</label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={30}
                  value={config.thresholdExcludeRecentDays ?? 0}
                  onChange={e => onChange({ ...config, thresholdExcludeRecentDays: parseInt(e.target.value) || 0 })}
                  className="w-20 h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-center"
                />
                <span className="text-[13px] text-muted-foreground">days</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Skip the most recent days from performance data</p>
            </div>

            {/* Lookback Period */}
            <SelectField
              label="Lookback Period"
              value={config.thresholdLookbackPeriod ?? "all"}
              options={LOOKBACK_PERIODS}
              onChange={v => onChange({ ...config, thresholdLookbackPeriod: v as any })}
              description="Only check ads created within this time window"
            />

            {/* Conditions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-semibold text-foreground/80">Conditions <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    value={config.thresholdConditionLevel ?? "per_ad"}
                    onChange={e => onChange({ ...config, thresholdConditionLevel: e.target.value as any })}
                    className="h-7 pl-2 pr-6 text-[11px] bg-background border border-border rounded-md appearance-none focus:outline-none text-foreground"
                  >
                    {CONDITION_LEVELS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <IconChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {(config.thresholdConditions ?? [{ metric: "spend", operator: ">", value: 0 }]).map((cond, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <select
                      value={cond.metric}
                      onChange={e => {
                        const updated = [...(config.thresholdConditions ?? [{ metric: "spend", operator: ">", value: 0 }])]
                        updated[i] = { ...cond, metric: e.target.value }
                        onChange({ ...config, thresholdConditions: updated })
                      }}
                      className="w-full h-8 pl-2 pr-6 text-[12px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                    >
                      {(() => {
                        const groups = [...new Set(THRESHOLD_METRICS.map(m => m.group))]
                        return groups.map(g => (
                          <optgroup key={g} label={g}>
                            {THRESHOLD_METRICS.filter(m => m.group === g).map(m => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </optgroup>
                        ))
                      })()}
                    </select>
                    <IconChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
                  </div>
                  <div className="relative w-14">
                    <select
                      value={cond.operator}
                      onChange={e => {
                        const updated = [...(config.thresholdConditions ?? [{ metric: "spend", operator: ">", value: 0 }])]
                        updated[i] = { ...cond, operator: e.target.value }
                        onChange({ ...config, thresholdConditions: updated })
                      }}
                      className="w-full h-8 pl-2 pr-5 text-[12px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground font-mono text-center"
                    >
                      {THRESHOLD_OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <IconChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 size-2.5 text-muted-foreground pointer-events-none" />
                  </div>
                  <input
                    type="number" min={0}
                    value={cond.value}
                    onChange={e => {
                      const updated = [...(config.thresholdConditions ?? [{ metric: "spend", operator: ">", value: 0 }])]
                      updated[i] = { ...cond, value: parseFloat(e.target.value) || 0 }
                      onChange({ ...config, thresholdConditions: updated })
                    }}
                    className="w-20 h-8 px-2 text-[12px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-center"
                  />
                  {(config.thresholdConditions ?? []).length > 1 && (
                    <button onClick={() => {
                      const updated = (config.thresholdConditions ?? []).filter((_, idx) => idx !== i)
                      onChange({ ...config, thresholdConditions: updated })
                    }} className="text-muted-foreground hover:text-destructive shrink-0">
                      <IconX className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {(config.thresholdConditions ?? []).length > 1 && (
                <div className="flex items-center gap-2 my-1">
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="text-[10px] font-semibold text-muted-foreground border border-border px-2 py-0.5 rounded">AND</span>
                  <div className="h-px flex-1 bg-border/60" />
                </div>
              )}

              <button
                onClick={() => {
                  const existing = config.thresholdConditions ?? [{ metric: "spend", operator: ">", value: 0 }]
                  onChange({ ...config, thresholdConditions: [...existing, { metric: "spend", operator: ">", value: 0 }] })
                }}
                className="flex items-center gap-1.5 text-[12px] text-primary hover:underline font-medium"
              >
                <IconPlus className="size-3.5" />
                Add Condition
              </button>
            </div>

            {/* Rule summary */}
            <div className="rounded-lg bg-muted/30 border border-border px-3 py-2 text-[11px] text-muted-foreground">
              Rule: Find ads where{" "}
              {(config.thresholdConditions ?? [{ metric: "spend", operator: ">", value: 0 }]).map((c, i) => (
                <span key={i}>
                  {i > 0 && <span className="font-semibold text-foreground"> AND </span>}
                  <span className="font-medium text-foreground">{THRESHOLD_METRICS.find(m => m.value === c.metric)?.label ?? c.metric} {c.operator} {c.value}</span>
                </span>
              ))}{" "}
              over {PERFORMANCE_PERIODS.find(p => p.value === (config.thresholdPerformancePeriod ?? "7d"))?.label ?? "last 7 days"}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Best Performing Organic Post ═══ */}
      {event === "best_performing_organic_post" && (
        <div className="pt-1 border-t border-border/60 space-y-4">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Best Performing Organic Post Trigger</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              Picks the best-performing organic post from a Facebook Page on each run, then emits it as the trigger output. Pair with a Launch Ad action to auto-promote the winner.
            </p>
          </div>

          {/* Facebook Page */}
          <OrganicPagePicker
            adAccountId={selectedAccountId}
            config={config}
            onChange={onChange}
          />

          {/* Ranking Metric */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-foreground/80">Ranking Metric <span className="text-red-500">*</span></label>
            <div className="relative">
              <select
                value={config.organicRankingMetric ?? "engagement"}
                onChange={e => onChange({ ...config, organicRankingMetric: e.target.value as any })}
                className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
              >
                <option value="engagement">Engagement (reactions + comments + shares)</option>
                <option value="reach">Reach</option>
                <option value="impressions">Impressions</option>
                <option value="video_views">Video Views</option>
              </select>
              <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            </div>
            <p className="text-[11px] text-muted-foreground">Engagement works for FB and IG. Reach, impressions, and video views are FB-only.</p>
          </div>

          {/* Lookback Window (days) */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-foreground/80">Lookback Window (days)</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min={1} max={90}
                value={config.organicLookbackDays ?? 7}
                onChange={e => onChange({ ...config, organicLookbackDays: parseInt(e.target.value) || 7 })}
                className="w-20 h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-center"
              />
              <span className="text-[13px] text-muted-foreground">days</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Only consider posts from the last N days. Default: 7.</p>
          </div>

          {/* Minimum Metric Value */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-foreground/80">Minimum Metric Value</label>
            <input
              type="number" min={0}
              value={config.organicMinMetricValue ?? 0}
              onChange={e => onChange({ ...config, organicMinMetricValue: parseInt(e.target.value) || 0 })}
              className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-[11px] text-muted-foreground">Skip promotion when the top post falls below this. 0 disables the floor.</p>
          </div>

          {/* Number of Top Posts */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-foreground/80">Number of Top Posts to Promote</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min={1} max={10}
                value={config.organicTopPostsCount ?? 1}
                onChange={e => onChange({ ...config, organicTopPostsCount: parseInt(e.target.value) || 1 })}
                className="w-20 h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-center"
              />
              <span className="text-[13px] text-muted-foreground">posts</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Each run, promote up to N highest-ranking posts.</p>
          </div>

          {/* Check Frequency */}
          <SelectField
            label="Check Frequency"
            value={config.checkFrequency ?? "daily"}
            options={META_FREQUENCIES}
            onChange={v => onChange({ ...config, checkFrequency: v as any })}
            description="How often the system checks for new top-performing posts."
            required
          />
        </div>
      )}

      {/* Campaign Picker Modal */}
      {showCampaignPicker && (
        <CampaignPickerModal
          adAccountId={selectedAccountId || undefined}
          onSelect={(id, name) => { onChange({ ...config, specificCampaignId: id, specificCampaignName: name }); setShowCampaignPicker(false) }}
          onClose={() => setShowCampaignPicker(false)}
        />
      )}
    </>
  )
}

// ─── Organic Page Picker ──────────────────────────────────────────────────────

function OrganicPagePicker({ adAccountId, config, onChange }: {
  adAccountId: string
  config: TriggerConfig
  onChange: (c: TriggerConfig) => void
}) {
  const [pages, setPages]       = useState<{ id: string; name: string; picture_url?: string }[]>([])
  const [loading, setLoading]   = useState(false)
  const [open, setOpen]         = useState(false)

  useEffect(() => {
    if (!adAccountId) return
    setLoading(true)
    fetch(`/api/facebook/pages?ad_account_id=${encodeURIComponent(adAccountId)}`)
      .then(r => r.json())
      .then(d => setPages(d.pages || []))
      .catch(() => setPages([]))
      .finally(() => setLoading(false))
  }, [adAccountId])

  const selected = pages.find(p => p.id === config.organicPageId)

  return (
    <div className="space-y-1.5">
      <label className="text-[12px] font-semibold text-foreground/80">Facebook Page <span className="text-red-500">*</span></label>
      {!adAccountId ? (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">Select an ad account above first.</p>
      ) : loading ? (
        <div className="flex items-center gap-2 h-9 px-3 border border-border rounded-lg text-[13px] text-muted-foreground">
          <IconLoader2 className="size-3.5 animate-spin shrink-0" /> Loading pages…
        </div>
      ) : (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="w-full flex items-center gap-2 h-9 px-3 border border-border rounded-lg bg-background text-[13px] text-left hover:border-primary/50 transition-colors"
          >
            {selected ? (
              <>
                {selected.picture_url && <img src={selected.picture_url} className="size-5 rounded-full shrink-0 object-cover" alt="" />}
                <span className="flex-1 truncate">{selected.name}</span>
              </>
            ) : (
              <span className="flex-1 text-muted-foreground/60">Select a Facebook page…</span>
            )}
            <IconChevronDown className="size-3.5 text-muted-foreground shrink-0" />
          </button>
          {open && pages.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border rounded-xl shadow-xl py-1 max-h-56 overflow-y-auto">
              {pages.map(p => (
                <button
                  key={p.id}
                  onClick={() => { onChange({ ...config, organicPageId: p.id, organicPageName: p.name }); setOpen(false) }}
                  className={cn("w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-muted/50 transition-colors",
                    p.id === config.organicPageId && "text-primary font-medium")}
                >
                  {p.picture_url && <img src={p.picture_url} className="size-5 rounded-full shrink-0 object-cover" alt="" />}
                  <span className="flex-1 truncate text-left">{p.name}</span>
                  {p.id === config.organicPageId && <IconCheck className="size-3.5 shrink-0" />}
                </button>
              ))}
            </div>
          )}
          {open && pages.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border rounded-xl shadow-xl p-3 text-[12px] text-muted-foreground text-center">
              No pages found for this ad account.
            </div>
          )}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Determines which page's organic posts will be ranked.</p>
    </div>
  )
}

// ─── Campaign Picker Modal ────────────────────────────────────────────────────

interface MetaCampaign {
  id: string
  name: string
  status: string
  spend?: string
  ads_count?: number
  objective?: string
}

function CampaignPickerModal({ adAccountId, onSelect, onClose }: {
  adAccountId?: string
  onSelect: (id: string, name: string) => void
  onClose: () => void
}) {
  const [search, setSearch]         = useState("")
  const [campaigns, setCampaigns]   = useState<MetaCampaign[]>([])
  const [loading, setLoading]       = useState(true)
  const [total, setTotal]           = useState(0)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: "50" })
    if (adAccountId) params.set("ad_account_id", adAccountId)
    fetch(`/api/meta/campaigns?${params}`)
      .then(r => r.json())
      .then(d => {
        const list = d.campaigns ?? d.data ?? []
        setCampaigns(list)
        setTotal(d.total ?? list.length)
      })
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false))
  }, [adAccountId])

  const filtered = search
    ? campaigns.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()))
    : campaigns

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-background rounded-2xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <p className="text-[15px] font-semibold text-foreground">
            Select Campaign{total > 0 ? <span className="text-muted-foreground font-normal text-[13px] ml-1.5">({total} total)</span> : ""}
          </p>
          <button onClick={onClose} className="size-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <IconX className="size-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border shrink-0 flex items-center gap-2">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              autoFocus
              placeholder="Search campaigns by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-[13px] bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
            />
          </div>
          <button
            onClick={() => { setCampaigns([]); setLoading(true); fetch(`/api/meta/campaigns?limit=50${adAccountId ? `&ad_account_id=${adAccountId}` : ""}`).then(r=>r.json()).then(d=>{setCampaigns(d.campaigns??d.data??[]);setTotal(d.total??(d.campaigns??d.data??[]).length)}).catch(()=>setCampaigns([])).finally(()=>setLoading(false)) }}
            className="h-9 px-3 flex items-center gap-1.5 text-[12px] border border-border rounded-lg hover:bg-muted transition-colors shrink-0"
          >
            <IconRefresh className="size-3.5" /> Refresh
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-[13px]">
              <IconLoader2 className="size-4 animate-spin" /> Loading campaigns…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground text-[13px]">
              <p>No campaigns found</p>
              {search && <button onClick={() => setSearch("")} className="text-primary hover:underline text-[12px]">Clear search</button>}
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-muted/70 backdrop-blur-sm">
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2.5 font-semibold text-foreground/70">Name</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-foreground/70">Ads</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-foreground/70">Spend</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-foreground/70">Status</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground/70">Objective</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => { onSelect(c.id, c.name); onClose() }}
                    className="border-b border-border/50 hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("size-2 rounded-full shrink-0 mt-px",
                          c.status === "ACTIVE" ? "bg-green-500" : "bg-amber-400"
                        )} />
                        <span className="font-medium truncate max-w-[230px]">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{c.ads_count ?? "—"}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">
                      {c.spend ? `$${Number(c.spend).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold",
                        c.status === "ACTIVE"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      )}>
                        {c.status === "ACTIVE" ? "Active" : c.status === "PAUSED" ? "Paused" : c.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{c.objective?.replace(/_/g, " ") ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] font-semibold text-foreground/90">{children}</p>
  )
}

// ─── Setup tab ────────────────────────────────────────────────────────────────

function SetupTab({ config, onChange, adAccountName, onChangeApp }: {
  config: TriggerConfig
  onChange: (c: TriggerConfig) => void
  adAccountName?: string
  onChangeApp?: () => void
}) {
  const appMeta  = APP_META[config.appId] ?? APP_META["meta"]
  const AppIcon  = appMeta.Icon
  const isMetaApp      = config.appId === "meta"
  const isSchedule     = config.appId === "schedule"
  const isManual       = config.appId === "manual"
  const isMediaLibrary = config.appId === "media_library"
  const isSheets       = config.appId === "sheets"
  const isDrive        = config.appId === "google_drive"

  const conditions = config.metricConditions ?? [{ metric: "spend", operator: "decreases_by" as const, value: 20, unit: "%" as const }]

  function updateCondition(i: number, c: MetricCondition) {
    const next = [...conditions]; next[i] = c
    onChange({ ...config, metricConditions: next })
  }
  function removeCondition(i: number) {
    onChange({ ...config, metricConditions: conditions.filter((_, j) => j !== i) })
  }

  return (
    <div className="space-y-5 p-5">
      {/* APP */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-foreground/80">App</label>
        <div className="flex items-center justify-between h-9 px-3 bg-background border border-border rounded-lg">
          <div className="flex items-center gap-2">
            <div
              className="size-5 rounded flex items-center justify-center shrink-0"
              style={{ backgroundColor: appMeta.iconBg }}
            >
              <AppIcon className="size-3.5" style={{ color: appMeta.iconColor }} />
            </div>
            <span className="text-[13px] font-medium">{appMeta.label}</span>
          </div>
          <button
            onClick={onChangeApp}
            className="text-[11px] text-primary hover:underline font-medium"
          >
            Change
          </button>
        </div>
      </div>

      {/* ── Configure Trigger section ── */}
      <div className="space-y-4 pt-1">
        <SectionHeader>Configure Trigger</SectionHeader>

        {/* META: specific fields */}
        {isMetaApp && (
          <MetaTriggerSetup
            config={config}
            onChange={onChange}
            conditions={conditions}
            updateCondition={updateCondition}
            removeCondition={removeCondition}
          />
        )}

        {/* SCHEDULE: specific fields */}
        {isSchedule && (
          <ScheduleTriggerSetup config={config} onChange={onChange} />
        )}

        {/* MANUAL: no config */}
        {isManual && (
          <div className="flex items-center gap-3 p-4 bg-muted/40 border border-border rounded-xl">
            <IconHandClick className="size-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[13px] font-medium">No configuration required</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">This automation runs when you click Run manually.</p>
            </div>
          </div>
        )}

        {/* MEDIA LIBRARY: Google Drive backed */}
        {isMediaLibrary && (
          <MediaLibrarySetup config={config} onChange={onChange} />
        )}

        {/* GOOGLE DRIVE */}
        {isDrive && (
          <GoogleDriveTriggerSetup config={config} onChange={onChange} />
        )}

        {/* GOOGLE SHEETS */}
        {isSheets && (
          <GoogleSheetsTriggerSetup config={config} onChange={onChange} />
        )}

        {/* OTHER APPS: generic placeholder */}
        {!isMetaApp && !isSchedule && !isManual && !isMediaLibrary && !isDrive && !isSheets && (
          <div className="flex items-center gap-3 p-4 bg-muted/40 border border-border rounded-xl">
            <AppIcon className="size-5 text-muted-foreground shrink-0" style={{ color: appMeta.iconColor }} />
            <div>
              <p className="text-[13px] font-medium">{appMeta.label} trigger configured</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Trigger is ready. Add an action step below.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Chip helper ─────────────────────────────────────────────────────────────

function Chip({ label }: { label: string }) {
  return (
    <span className="px-2 py-0.5 rounded-full bg-muted border border-border/60 text-[10px] font-medium text-foreground/80">
      {label}
    </span>
  )
}

// ─── Preview tab ──────────────────────────────────────────────────────────────

const MEDIA_BOARD_LABELS: Record<string, string> = {
  all: "All Boards", name_contains: "Board name contains", name_equals: "Board name equals",
  name_does_not_contain: "Board name does not contain", name_starts_with: "Board name starts with",
  name_ends_with: "Board name ends with", specific: "Specific board",
}
const MEDIA_TYPE_LABELS: Record<string, string> = { all: "All Media", images: "Images Only", videos: "Videos Only" }
const TRIGGER_TIMING_LABELS: Record<string, string> = { immediately: "Immediately on Upload", on_approved: "When Media is Approved" }
const ASSET_STATUS_LABELS: Record<string, string> = { all: "All Status", approved: "Approved", in_progress: "In Progress", archived: "Archived" }

// ─── Creative result type ─────────────────────────────────────────────────────

interface CreativeMatch {
  id: string
  file_name?: string | null
  media_type: "image" | "video"
  file_url?: string | null
  fb_thumbnail_url?: string | null
  status?: string | null
  created_at?: string | null
}

function PreviewTab({ config, automationId }: { config: TriggerConfig; automationId?: string }) {
  const [finding, setFinding]       = useState(false)
  const [matches, setMatches]       = useState<CreativeMatch[] | null>(null)
  const [findError, setFindError]   = useState<string | null>(null)
  const [testLog, setTestLog]       = useState<string[] | null>(null)
  const [testSuccess, setTestSuccess] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<CreativeMatch | null>(null)
  const [testing, setTesting]       = useState(false)
  const isSheets = config.appId === "sheets"
  const isDrive  = config.appId === "google_drive"

  const appMeta    = APP_META[config.appId] ?? APP_META["meta"]
  const eventLabel = EVENT_LABELS[config.event] ?? config.event?.replace(/_/g, " ")
  const conditions = config.metricConditions ?? []
  const windowLabel = COMPARISON_WINDOWS.find(w => w.value === (config.comparisonWindow ?? "day_over_day"))?.label ?? "Day over Day"

  const today     = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" })

  // Compute "fires when" chips per app type
  const firesWhenChips: string[] = (() => {
    if (config.appId === "meta" && conditions.length > 0) {
      const metricChips = conditions.map(c => {
        const metric = METRICS.find(m => m.value === c.metric)?.label ?? c.metric
        const op = c.operator === "decreases_by" ? "drops" : c.operator === "increases_by" ? "spikes" : c.operator === "is_above" ? ">" : "<"
        return `${metric} ${op} ${c.value}${c.unit}`
      })
      return [
        ...metricChips,
        windowLabel,
        FREQUENCIES.find(f => f.value === (config.checkFrequency ?? "daily"))?.label ?? "Daily 9am",
      ]
    }
    if (config.appId === "media_library") {
      return [
        MEDIA_BOARD_LABELS[config.mediaBoard ?? "all"],
        config.mediaType && config.mediaType !== "all" ? MEDIA_TYPE_LABELS[config.mediaType] : null,
        TRIGGER_TIMING_LABELS[config.triggerTiming ?? "immediately"],
        config.assetStatus && config.assetStatus !== "all" ? ASSET_STATUS_LABELS[config.assetStatus] : null,
        config.assetGrouping ? "Asset Grouping on" : null,
      ].filter(Boolean) as string[]
    }
    if (config.appId === "schedule") {
      const freq = config.scheduleFrequency ?? "daily"
      const time = config.scheduleTime ?? "09:00"
      const parts: string[] = []
      if (freq === "one_time")  parts.push("One-time", config.scheduleDate ?? "No date set", time)
      if (freq === "daily")     parts.push("Daily", time)
      if (freq === "weekly") {
        const day = config.scheduleDayOfWeek
          ? config.scheduleDayOfWeek.charAt(0).toUpperCase() + config.scheduleDayOfWeek.slice(1, 3)
          : "?"
        parts.push(`Weekly ${day}`, time)
      }
      if (freq === "monthly")   parts.push(`Monthly day ${config.scheduleDayOfMonth ?? "?"}`, time)
      if (config.scheduleStartDate) parts.push(`From ${config.scheduleStartDate}`)
      if (config.scheduleEndDate)   parts.push(`Until ${config.scheduleEndDate}`)
      return parts
    }
    if (config.appId === "manual") return ["Run on demand"]
    if (config.appId === "google_drive") {
      const ev = EVENT_LABELS[config.event] ?? config.event
      const chips: string[] = [ev]
      if (config.driveFolderName) chips.push(`Folder: ${config.driveFolderName}`)
      else if (config.driveFolderId) chips.push(`ID: ${config.driveFolderId.slice(0, 10)}…`)
      if (config.event === "drive_new_file_in_folder") {
        const bs = config.driveBatchStrategy ?? "one_per_file"
        chips.push(bs === "all_as_one" ? "All as one batch" : bs === "group_by_type" ? "Group by type" : "One per file")
        const ft = config.driveFileType ?? "all"
        if (ft !== "all") chips.push(ft === "images" ? "Images Only" : "Videos Only")
      }
      chips.push(config.checkFrequency === "hourly" ? "Hourly" : "Daily")
      return chips
    }
    if (config.appId === "sheets") {
      const ev = EVENT_LABELS[config.event] ?? config.event
      const chips: string[] = [ev]
      if (config.sheetsSpreadsheetId) chips.push(`ID: ${config.sheetsSpreadsheetId.slice(0, 10)}…`)
      if (config.sheetsSheetName) chips.push(`Sheet: ${config.sheetsSheetName}`)
      if (config.event === "sheets_cell_changed" && config.sheetsTriggerCell) chips.push(`Cell: ${config.sheetsTriggerCell}`)
      return chips
    }
    return []
  })()

  const hasChips = firesWhenChips.length > 0

  async function handleDriveTestNode() {
    setFinding(true)
    setTestLog(null)
    setFindError(null)
    setTestSuccess(false)
    const ts = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })
    const logs: string[] = [`[${ts()}] Starting test…`]
    try {
      const folderId = config.driveFolderId
      if (!folderId) throw new Error("No folder selected")
      logs.push(`[${ts()}] Authenticating with Google Drive via OAuth…`)
      const params = new URLSearchParams({ folder_id: folderId })
      if (config.driveFileType && config.driveFileType !== "all") {
        params.set("file_type", config.driveFileType)
      }
      const res = await fetch(`/api/google/drive/test?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Drive API error")
      logs.push(`[${ts()}] Folder: "${data.folderName ?? folderId}"`)
      logs.push(`[${ts()}] Files found: ${data.fileCount ?? 0}`)
      logs.push(`[${ts()}] Test successful.`)
      setTestSuccess(true)
      setTestLog(logs)
    } catch (e: any) {
      logs.push(`[${ts()}] ERROR: ${e.message}`)
      setTestLog(logs)
      setFindError(e.message)
    } finally {
      setFinding(false)
    }
  }

  async function handleTestNode() {
    setFinding(true)
    setTestLog(null)
    setFindError(null)
    setTestSuccess(false)
    const ts = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })
    const logs: string[] = [`[${ts()}] Starting test...`]
    try {
      if (!config.sheetsSpreadsheetId) throw new Error("Missing service or event configuration")
      logs.push(`[${ts()}] Connecting to Google Sheets via OAuth…`)
      const params = new URLSearchParams({
        spreadsheet_id: config.sheetsSpreadsheetId,
        sheet_name:     config.sheetsSheetName ?? "Sheet1",
      })
      if (config.sheetsTriggerCell) params.set("cell", config.sheetsTriggerCell)
      const res = await fetch(`/api/google/sheets/test?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Sheets API error")
      logs.push(`[${ts()}] Cell ${config.sheetsTriggerCell ?? ""} = "${data.value ?? ""}"`)
      logs.push(`[${ts()}] Test complete.`)
      setTestLog(logs)
    } catch (e: any) {
      logs.push(`[${ts()}] ERROR: ${e.message}`)
      setTestLog(logs)
      setFindError(e.message)
    } finally {
      setFinding(false)
    }
  }

  async function handleTestWithMatch(match: CreativeMatch) {
    setTesting(true)
    setTestLog(null)
    setFindError(null)
    setTestSuccess(false)
    const ts = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })
    const logs: string[] = [`[${ts()}] Starting test with "${match.file_name ?? match.id}"…`]

    if (!automationId) {
      logs.push(`[${ts()}] Automation not saved yet — save the automation first to run a real test.`)
      setTestLog(logs)
      setTesting(false)
      return
    }

    try {
      logs.push(`[${ts()}] Sending to automation engine…`)
      setTestLog([...logs])

      const res = await fetch(`/api/automations/${automationId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_id:       match.id,
          file_name:     match.file_name,
          file_url:      match.file_url,
          mime_type:     match.media_type === "video" ? "video/mp4" : "image/jpeg",
          thumbnail_url: match.fb_thumbnail_url,
          is_test:       true,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Run failed")

      // Append server-side logs
      const serverLogs: { ts: string; msg: string; level: string }[] = data.logs ?? []
      serverLogs.forEach(l => logs.push(`[${new Date(l.ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}] ${l.msg}`))

      if (data.status === "success") {
        setTestSuccess(true)
        logs.push(`[${ts()}] ✓ Test complete — ${data.durationMs}ms`)
      } else if (data.status === "skipped") {
        logs.push(`[${ts()}] ⚠ Completed with skipped actions (no actions configured yet?)`)
        setTestSuccess(true)
      } else {
        logs.push(`[${ts()}] ✗ Some actions failed — check logs above`)
      }

      setTestLog([...logs])
    } catch (e: any) {
      logs.push(`[${ts()}] ERROR: ${e.message}`)
      setTestLog([...logs])
      setFindError(e.message)
    } finally {
      setTesting(false)
    }
  }

  async function handleFindRecords() {
    setFinding(true)
    setMatches(null)
    setFindError(null)
    setSelectedMatch(null)
    setTestLog(null)
    setTestSuccess(false)
    try {
      if (config.appId === "media_library") {
        // Query Google Drive API
        const params = new URLSearchParams({ limit: "5" })
        if (config.mediaType === "images")       params.set("media_type", "image")
        else if (config.mediaType === "videos")  params.set("media_type", "video")
        if (config.mediaBoard === "specific" && config.mediaBoardId) {
          params.set("folder_id", config.mediaBoardId)
        }
        if (config.mediaAssetName && config.mediaAssetName !== "all" && config.mediaNameFilter) {
          params.set("name_op", config.mediaAssetName)
          params.set("name_val", config.mediaNameFilter)
        }
        const res = await fetch(`/api/google/drive/files?${params}`)
        if (!res.ok) throw new Error("Drive API error")
        const data = await res.json()
        if (data.connected === false) throw new Error("Google Drive not connected")
        // Map Drive files to CreativeMatch shape — proxy thumbnails through our API
        const files: CreativeMatch[] = (data.files ?? []).map((f: any) => ({
          id:               f.id,
          file_name:        f.name,
          media_type:       f.mimeType?.includes("video") ? "video" : "image",
          fb_thumbnail_url: `/api/google/drive/thumbnail?file_id=${f.id}&size=120`,
          file_url:         null,
          status:           "raw",
          created_at:       f.createdTime ?? f.modifiedTime,
        }))
        setMatches(files)
      } else {
        // Fallback: query internal creatives DB
        const params = new URLSearchParams({ limit: "5" })
        const res = await fetch(`/api/creatives?${params}`)
        if (!res.ok) throw new Error("Failed to fetch")
        const data = await res.json()
        setMatches(data.creatives ?? [])
      }
    } catch (e: any) {
      setFindError(e.message ?? "Could not load matching records.")
    } finally {
      setFinding(false)
    }
  }

  return (
    <div className="p-5 space-y-5">
      {/* 1. Fires when */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          1. Fires when
        </p>
        <p className="text-[12px] font-medium text-foreground">
          {appMeta.label} · {eventLabel || "—"}
        </p>
        {!hasChips && (
          <div className="border border-border rounded-lg px-3 py-2 mt-1">
            <p className="text-[12px] text-muted-foreground">
              Configure this step in Setup to see what it&apos;ll do.
            </p>
          </div>
        )}
        {hasChips && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {firesWhenChips.map((chip, i) => <Chip key={i} label={chip} />)}
          </div>
        )}
      </div>

      {/* Google Drive: Test Node UI */}
      {isDrive && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-500">
            Test with live data
          </p>

          {testLog ? (
            <div className="rounded-xl bg-zinc-900 p-3 space-y-0.5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-zinc-400 font-semibold">Debug Logs</p>
                <button
                  onClick={() => navigator.clipboard.writeText(testLog.join("\n")).catch(() => {})}
                  className="text-[11px] text-zinc-400 hover:text-white transition-colors"
                >
                  Copy
                </button>
              </div>
              {testSuccess && (
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-700">
                  <div className="size-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                    <svg className="size-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-[12px] text-green-400 font-semibold">Test Successful!</p>
                </div>
              )}
              {testLog.map((line, i) => (
                <p key={i} className={cn("text-[11px] font-mono", line.includes("ERROR") ? "text-red-400" : "text-emerald-400")}>
                  {line}
                </p>
              ))}
            </div>
          ) : (
            <div className="border border-border rounded-xl px-4 py-6 text-center">
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Test your node configuration to ensure it works correctly.
              </p>
            </div>
          )}

          <button
            onClick={handleDriveTestNode}
            disabled={finding}
            className="w-full h-10 bg-primary text-primary-foreground rounded-xl text-[13px] font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {finding ? <><IconLoader2 className="size-3.5 animate-spin" /> Testing…</> : "Test Node"}
          </button>
        </div>
      )}

      {/* Google Sheets: Test Node UI */}
      {isSheets && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-500">
            Test with live data
          </p>

          {/* Info / result box */}
          {testLog ? (
            <div className="rounded-xl bg-zinc-900 p-3 space-y-0.5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-zinc-400 font-semibold">Debug Logs</p>
                <button
                  onClick={() => navigator.clipboard.writeText(testLog.join("\n")).catch(() => {})}
                  className="text-[11px] text-zinc-400 hover:text-white transition-colors"
                >
                  Copy
                </button>
              </div>
              {testLog.map((line, i) => (
                <p key={i} className={cn("text-[11px] font-mono", line.includes("ERROR") ? "text-red-400" : "text-emerald-400")}>
                  {line}
                </p>
              ))}
            </div>
          ) : (
            <div className="border border-border rounded-xl px-4 py-6 text-center">
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Test your node configuration to ensure it works correctly.
              </p>
            </div>
          )}

          <button
            onClick={handleTestNode}
            disabled={finding}
            className="w-full h-10 bg-primary text-primary-foreground rounded-xl text-[13px] font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {finding ? <><IconLoader2 className="size-3.5 animate-spin" /> Testing…</> : "Test Node"}
          </button>
        </div>
      )}

      {/* Test with live data — not for Sheets/Drive (they have their own UI above) */}
      {!isSheets && !isDrive && <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Test with live data
        </p>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          Preview which {config.appId === "media_library" ? "assets" : "records"} match your trigger configuration. Use the{" "}
          <span className="font-medium text-foreground">Run</span> button in the header to execute with the latest match.
        </p>

        {/* Error */}
        {findError && (
          <p className="text-[12px] text-red-500">{findError}</p>
        )}

        {/* Results */}
        {matches && (
          <div className="space-y-2 pt-1">
            <p className="text-[12px] font-semibold text-foreground">
              Recent matches ({matches.length}):
            </p>
            {config.appId === "media_library" && (
              <p className="text-[11px] text-primary/80">
                {config.mediaBoard === "specific" && config.mediaBoardName
                  ? `Files from folder: ${config.mediaBoardName}`
                  : "Files from your Google Drive"}
              </p>
            )}
            {matches.length === 0 ? (
              <p className="text-[12px] text-muted-foreground italic">No matching records found.</p>
            ) : (
              <div className="space-y-1.5">
                {matches.map(m => {
                  const thumb     = m.fb_thumbnail_url || m.file_url
                  const name      = m.file_name ?? m.id
                  const type      = m.media_type === "video" ? "Video" : "Image"
                  const date      = m.created_at
                    ? new Date(m.created_at).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })
                    : ""
                  const isSelected = selectedMatch?.id === m.id
                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMatch(isSelected ? null : m)}
                      className={cn(
                        "flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors cursor-pointer",
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border bg-background hover:bg-muted/40"
                      )}
                    >
                      <div className="size-10 rounded-lg shrink-0 overflow-hidden bg-muted flex items-center justify-center">
                        {thumb
                          ? <img src={thumb} alt={name} className="size-full object-cover" />
                          : <IconFile className="size-4 text-muted-foreground" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-[12px] font-medium truncate", isSelected ? "text-primary" : "text-foreground")}>{name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {type} • {m.status ?? "raw"} • {date}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="shrink-0 size-4 rounded-full bg-primary flex items-center justify-center">
                          <svg className="size-2.5 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Test log after "Test with" */}
            {testLog && (
              <div className="rounded-xl bg-zinc-900 p-3 space-y-0.5 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-zinc-400 font-semibold">Debug Logs</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(testLog.join("\n")).catch(() => {})}
                    className="text-[11px] text-zinc-400 hover:text-white transition-colors"
                  >
                    Copy
                  </button>
                </div>
                {testSuccess && (
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-700">
                    <div className="size-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                      <svg className="size-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="text-[12px] text-green-400 font-semibold">Test Successful!</p>
                  </div>
                )}
                {testLog.map((line, i) => (
                  <p key={i} className={cn("text-[11px] font-mono", line.includes("ERROR") ? "text-red-400" : "text-emerald-400")}>
                    {line}
                  </p>
                ))}
              </div>
            )}

            {/* "Test with [filename]" button */}
            {selectedMatch && (
              <button
                onClick={() => handleTestWithMatch(selectedMatch)}
                disabled={testing}
                className="w-full h-9 bg-primary text-primary-foreground rounded-xl text-[13px] font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 mt-1"
              >
                {testing
                  ? <><IconLoader2 className="size-3.5 animate-spin" /> Testing…</>
                  : <><IconPlayerPlay className="size-3.5 fill-primary-foreground" /> Test with &ldquo;{(selectedMatch.file_name ?? selectedMatch.id).slice(0, 28)}{(selectedMatch.file_name ?? selectedMatch.id).length > 28 ? "…" : ""}&rdquo;</>
                }
              </button>
            )}
          </div>
        )}

        {/* Action button */}
        {matches ? (
          <button
            onClick={handleFindRecords}
            disabled={finding}
            className="w-full h-9 bg-background border border-border text-foreground rounded-xl text-[13px] font-semibold hover:bg-muted/60 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {finding
              ? <><IconLoader2 className="size-3.5 animate-spin" /> Refreshing…</>
              : <><IconRefresh className="size-3.5" /> Refresh</>
            }
          </button>
        ) : (
          <button
            onClick={handleFindRecords}
            disabled={finding}
            className="w-full h-9 bg-primary text-primary-foreground rounded-xl text-[13px] font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {finding
              ? <><IconLoader2 className="size-3.5 animate-spin" /> Searching…</>
              : <><IconPlayerPlay className="size-3.5 fill-primary-foreground" /> Find Matching Records</>
            }
          </button>
        )}
      </div>}

      {/* Comparing window — Meta only */}
      {config.appId === "meta" && (
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Comparing · {windowLabel.toUpperCase()}
          </p>
          <p className="text-[13px] text-primary/80 font-medium">
            {fmt(yesterday)} vs {fmt(today)}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  stepIndex: number
  config: TriggerConfig
  onChange: (c: TriggerConfig) => void
  adAccountName?: string
  automationId?: string
  onClose?: () => void
  onChangeApp?: () => void
}

export function TriggerConfigPanel({ stepIndex, config, onChange, adAccountName, automationId, onClose, onChangeApp }: Props) {
  const [activeTab, setActiveTab] = useState<"setup" | "preview">("setup")
  const appMeta  = APP_META[config.appId] ?? APP_META["meta"]
  const AppIcon  = appMeta.Icon
  const eventLabel = EVENT_LABELS[config.event] ?? config.event?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Panel header — dynamic */}
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="size-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: appMeta.iconBg }}
          >
            <AppIcon className="size-5" style={{ color: appMeta.iconColor }} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground leading-tight truncate">
              {stepIndex}. {eventLabel ?? "Trigger"}
            </p>
            <p className="text-[11px] text-muted-foreground/70 leading-tight mt-0.5">
              When does this step fire?
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
          >
            <IconX className="size-4" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border shrink-0">
        {(["setup", "preview"] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              "flex-1 py-2.5 text-[13px] font-medium transition-colors capitalize",
              activeTab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "setup"
          ? <SetupTab config={config} onChange={onChange} adAccountName={adAccountName} onChangeApp={onChangeApp} />
          : <PreviewTab config={config} automationId={automationId} />
        }
      </div>

      {/* Footer */}
      {activeTab === "setup" && (
        <div className="p-4 border-t border-border shrink-0">
          <button
            onClick={() => setActiveTab("preview")}
            className="w-full h-9 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Preview →
          </button>
        </div>
      )}
    </div>
  )
}
