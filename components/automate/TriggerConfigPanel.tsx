"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import {
  IconBrandMeta, IconChartBar, IconPlus, IconX, IconChevronDown,
  IconBell, IconBrandGoogleDrive, IconBrandTiktok, IconBrandSnapchat,
  IconBrandPinterest, IconBrandSlack, IconTable, IconCalendar,
  IconHandClick, IconPlayerPlay, IconLoader2, IconRefresh, IconFile,
  IconPhoto, IconBrandDropbox, IconApps, IconWind, IconBrandFramer, IconScan,
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
  performance_monitoring: "Performance Monitoring",
  ad_approved:            "Ad Approved",
  spend_threshold:        "Spend Threshold",
  roas_threshold:         "ROAS Threshold",
  cpa_spike:              "CPA Spike",
  new_drive_folder:       "New Drive Folder",
  schedule:               "Schedule",
  manual:                 "Manual Trigger",
  media_uploaded:         "Media Uploaded to Board",
  new_dropbox_file:       "New Dropbox File",
  new_sharepoint_file:    "New SharePoint File",
  new_air_asset:          "New AIR Asset",
  new_frameio_file:       "New Frame.io File",
  adscan_alert:           "Competitor Ad Alert",
}

// ─── Field helpers ────────────────────────────────────────────────────────────

const MONITORING_LEVELS = [
  { value: "campaign", label: "Campaign Level" },
  { value: "adset",    label: "Ad Set Level" },
  { value: "ad",       label: "Ad Level" },
]

const METRICS = [
  { value: "spend",           label: "Spend" },
  { value: "roas",            label: "ROAS" },
  { value: "cpa",             label: "CPA" },
  { value: "ctr",             label: "CTR" },
  { value: "cpc",             label: "CPC" },
  { value: "impressions",     label: "Impressions" },
  { value: "reach",           label: "Reach" },
  { value: "frequency",       label: "Frequency" },
  { value: "cost_per_result", label: "Cost per Result" },
]

const OPERATORS = [
  { value: "increases_by", label: "Increases by" },
  { value: "decreases_by", label: "Decreases by" },
  { value: "is_above",     label: "Is above" },
  { value: "is_below",     label: "Is below" },
]

const COMPARISON_WINDOWS = [
  { value: "day_over_day",     label: "Day over Day" },
  { value: "week_over_week",   label: "Week over Week" },
  { value: "month_over_month", label: "Month over Month" },
]

const FREQUENCIES = [
  { value: "hourly",    label: "Hourly" },
  { value: "every_6h", label: "Every 6 hours" },
  { value: "daily",    label: "Daily 9am" },
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
      <div className="relative">
        <select
          value={cond.metric}
          onChange={e => onChange({ ...cond, metric: e.target.value })}
          className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground"
        >
          {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
      </div>

      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <select
            value={cond.operator}
            onChange={e => onChange({ ...cond, operator: e.target.value as MetricCondition["operator"] })}
            className="w-full h-9 pl-2 pr-7 text-[12px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground"
          >
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
        {canRemove && (
          <button onClick={onRemove} className="size-9 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
            <IconX className="size-3.5" />
          </button>
        )}
      </div>

      <button className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium">
        <IconChartBar className="size-3" />
        Preview historical changes
      </button>
    </div>
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
  const isMetaApp = config.appId === "meta"
  const isSchedule = config.appId === "schedule"
  const isManual = config.appId === "manual"
  const isMediaLibrary = config.appId === "media_library"

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
          <>
            {/* Trigger Event */}
            <SelectField
              label="Trigger Event"
              value={config.event}
              options={[
                { value: "performance_monitoring", label: "Performance Monitoring" },
                { value: "roas_threshold",         label: "ROAS Threshold" },
                { value: "ad_approved",            label: "Ad Approved" },
                { value: "spend_threshold",        label: "Spend Threshold" },
                { value: "cpa_spike",              label: "CPA Spike" },
              ]}
              onChange={v => onChange({ ...config, event: v as TriggerConfig["event"] })}
              description="Detect when metrics change by a percentage between consecutive time periods."
            />

            {/* Ad Account(s) */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">
                Ad Account(s) <span className="text-red-500">*</span>
              </label>
              {adAccountName ? (
                <div className="flex items-center justify-between h-9 px-3 bg-background border border-border rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="size-4 rounded bg-[#1877F2]/20 flex items-center justify-center shrink-0">
                      <span className="text-[8px] font-bold text-[#1877F2]">∞</span>
                    </div>
                    <span className="text-[13px] text-foreground">{adAccountName}</span>
                  </div>
                  <IconChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                </div>
              ) : (
                <div className="px-3 py-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                  <p className="text-[12px] text-red-600 dark:text-red-400">
                    No Meta ad accounts connected. Please connect in Settings.
                  </p>
                </div>
              )}
            </div>

            {/* Monitoring Level */}
            <SelectField
              label="Monitoring Level"
              value={config.monitoringLevel ?? "campaign"}
              options={MONITORING_LEVELS}
              onChange={v => onChange({ ...config, monitoringLevel: v as TriggerConfig["monitoringLevel"] })}
              description={`Compare metrics per ${(config.monitoringLevel ?? "campaign") === "adset" ? "ad set" : (config.monitoringLevel ?? "campaign")}.`}
            />

            {/* Campaign Filter */}
            <SelectField
              label="Campaign Filter"
              value={config.campaignFilter ?? "all"}
              options={[
                { value: "all",      label: "All Campaigns" },
                { value: "specific", label: "Specific Campaigns" },
              ]}
              onChange={v => onChange({ ...config, campaignFilter: v as TriggerConfig["campaignFilter"] })}
              description="Triggers for all campaigns."
            />

            {/* Metric Conditions */}
            <div className="space-y-2">
              <div>
                <label className="text-[12px] font-semibold text-foreground/80">
                  Metric Conditions <span className="text-red-500">*</span>
                </label>
                <p className="text-[11px] text-muted-foreground mt-0.5">Define one or more metric conditions.</p>
              </div>
              <div className="space-y-2">
                {conditions.map((cond, i) => (
                  <MetricConditionRow
                    key={i}
                    cond={cond}
                    onChange={c => updateCondition(i, c)}
                    onRemove={() => removeCondition(i)}
                    canRemove={conditions.length > 1}
                  />
                ))}
              </div>
              <button
                onClick={() => onChange({ ...config, metricConditions: [...conditions, { metric: "roas", operator: "decreases_by", value: 10, unit: "%" }] })}
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
              description={
                (config.comparisonWindow ?? "day_over_day") === "day_over_day"   ? "Compares yesterday vs the day before." :
                (config.comparisonWindow ?? "day_over_day") === "week_over_week" ? "Compares this week vs last week." :
                "Compares this month vs last month."
              }
              required
            />

            {/* Check Frequency */}
            <SelectField
              label="Check Frequency"
              value={config.checkFrequency ?? "daily"}
              options={FREQUENCIES}
              onChange={v => onChange({ ...config, checkFrequency: v as TriggerConfig["checkFrequency"] })}
              description="How often the system checks for changes."
              required
            />
          </>
        )}

        {/* SCHEDULE: specific fields */}
        {isSchedule && (
          <>
            <SelectField
              label="Frequency"
              value={config.checkFrequency ?? "daily"}
              options={FREQUENCIES}
              onChange={v => onChange({ ...config, checkFrequency: v as TriggerConfig["checkFrequency"] })}
              description="How often this automation runs."
              required
            />
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">Time</label>
              <input
                type="time"
                value={config.scheduleTime ?? "09:00"}
                onChange={e => onChange({ ...config, scheduleTime: e.target.value })}
                className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-[11px] text-muted-foreground">Time the automation runs each day.</p>
            </div>
          </>
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

        {/* OTHER APPS: generic placeholder */}
        {!isMetaApp && !isSchedule && !isManual && !isMediaLibrary && (
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

function PreviewTab({ config }: { config: TriggerConfig }) {
  const [finding, setFinding] = useState(false)
  const [matches, setMatches] = useState<CreativeMatch[] | null>(null)
  const [findError, setFindError] = useState<string | null>(null)

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
      return [
        config.checkFrequency === "hourly" ? "Hourly" : config.checkFrequency === "every_6h" ? "Every 6h" : "Daily",
        config.scheduleTime ?? "09:00",
      ]
    }
    if (config.appId === "manual") return ["Run on demand"]
    return []
  })()

  const hasChips = firesWhenChips.length > 0

  async function handleFindRecords() {
    setFinding(true)
    setMatches(null)
    setFindError(null)
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
        // Map Drive files to CreativeMatch shape
        const files: CreativeMatch[] = (data.files ?? []).map((f: any) => ({
          id:             f.id,
          file_name:      f.name,
          media_type:     f.mimeType?.includes("video") ? "video" : "image",
          fb_thumbnail_url: f.thumbnailLink ? `${f.thumbnailLink}&sz=80` : null,
          file_url:       null,
          status:         "raw",
          created_at:     f.createdTime ?? f.modifiedTime,
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
          {appMeta.label} · {eventLabel}
        </p>
        {!hasChips ? (
          <p className="text-[12px] text-muted-foreground italic">
            Configure this step in Setup to see what it&apos;ll do.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {firesWhenChips.map((chip, i) => <Chip key={i} label={chip} />)}
          </div>
        )}
      </div>

      {/* Test with live data */}
      <div className="space-y-2">
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
                  const thumb = m.fb_thumbnail_url || m.file_url
                  const name  = m.file_name ?? m.id
                  const type  = m.media_type === "video" ? "Video" : "Image"
                  const date  = m.created_at
                    ? new Date(m.created_at).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })
                    : ""
                  return (
                    <div key={m.id} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-background hover:bg-muted/40 transition-colors cursor-pointer">
                      <div className="size-10 rounded-lg shrink-0 overflow-hidden bg-muted flex items-center justify-center">
                        {thumb
                          ? <img src={thumb} alt={name} className="size-full object-cover" />
                          : <IconFile className="size-4 text-muted-foreground" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-foreground truncate">{name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {type} • {m.status ?? "raw"} • {date}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
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
      </div>

      {/* Comparing window (only for Meta) */}
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
  onClose?: () => void
  onChangeApp?: () => void
}

export function TriggerConfigPanel({ stepIndex, config, onChange, adAccountName, onClose, onChangeApp }: Props) {
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
          : <PreviewTab config={config} />
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
