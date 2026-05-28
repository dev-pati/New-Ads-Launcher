"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  IconBrandMeta, IconChartBar, IconPlus, IconX, IconChevronDown,
  IconBell, IconBrandGoogleDrive, IconBrandTiktok, IconBrandSnapchat,
  IconBrandPinterest, IconBrandSlack, IconTable, IconCalendar,
  IconHandClick, IconPlayerPlay,
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

        {/* OTHER APPS: generic placeholder */}
        {!isMetaApp && !isSchedule && !isManual && (
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

// ─── Preview tab ──────────────────────────────────────────────────────────────

function PreviewTab({ config }: { config: TriggerConfig }) {
  const appMeta    = APP_META[config.appId] ?? APP_META["meta"]
  const eventLabel = EVENT_LABELS[config.event] ?? config.event?.replace(/_/g, " ")
  const conditions = config.metricConditions ?? []
  const windowLabel = COMPARISON_WINDOWS.find(w => w.value === (config.comparisonWindow ?? "day_over_day"))?.label ?? "Day over Day"

  const today     = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" })

  const hasConditions = conditions.length > 0

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
        {!hasConditions ? (
          <p className="text-[12px] text-muted-foreground italic">
            Configure this step in Setup to see what it&apos;ll do.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {conditions.map((c, i) => {
              const metric = METRICS.find(m => m.value === c.metric)?.label ?? c.metric
              const op = c.operator === "decreases_by" ? "drops" : c.operator === "increases_by" ? "spikes" : c.operator === "is_above" ? ">" : "<"
              return (
                <span key={i} className="px-2 py-0.5 rounded-full bg-muted border border-border/60 text-[10px] font-medium text-foreground/80">
                  {metric} {op} {c.value}{c.unit}
                </span>
              )
            })}
            <span className="px-2 py-0.5 rounded-full bg-muted border border-border/60 text-[10px] font-medium text-foreground/80">
              {windowLabel}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-muted border border-border/60 text-[10px] font-medium text-foreground/80">
              {FREQUENCIES.find(f => f.value === (config.checkFrequency ?? "daily"))?.label}
            </span>
          </div>
        )}
      </div>

      {/* Test with live data */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Test with live data
        </p>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          Preview which records match your trigger configuration. Use the{" "}
          <span className="font-medium text-foreground">Run</span> button in the header to execute with the latest match.
        </p>
        <button className="w-full h-9 bg-primary text-primary-foreground rounded-xl text-[13px] font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
          <IconPlayerPlay className="size-3.5 fill-primary-foreground" />
          Find Matching Records
        </button>
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
