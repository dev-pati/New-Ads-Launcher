"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  IconBrandMeta,
  IconChartBar,
  IconPlus,
  IconX,
  IconChevronDown,
  IconPlayerPlay,
} from "@tabler/icons-react"
import type { TriggerConfig, MetricCondition } from "@/lib/workflow-types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  { value: "daily",    label: "Daily" },
]

// ─── Summary sentence builder ─────────────────────────────────────────────────

function buildSummary(config: TriggerConfig): string {
  const conditions = config.metricConditions ?? []
  if (!conditions.length) return "Configure a metric condition to get started."
  const level  = MONITORING_LEVELS.find(l => l.value === config.monitoringLevel)?.label ?? "Campaign"
  const window = COMPARISON_WINDOWS.find(w => w.value === config.comparisonWindow)?.label ?? "Day over Day"
  const cond   = conditions[0]
  const metric = METRICS.find(m => m.value === cond.metric)?.label ?? cond.metric
  const op     = OPERATORS.find(o => o.value === cond.operator)?.label?.toLowerCase() ?? cond.operator.replace(/_/g, " ")
  return `When ${metric} ${op} more than ${cond.value}${cond.unit} (${window.toLowerCase()}) per ${level.toLowerCase().replace(" level", "")}, trigger this automation.`
}

// ─── Field label ──────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </label>
  )
}

// ─── Reusable select ──────────────────────────────────────────────────────────

function SelectField({
  label,
  value,
  options,
  onChange,
  description,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  description?: string
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full h-9 pl-3 pr-8 text-sm bg-muted/40 border border-border/60 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
      </div>
      {description && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
      )}
    </div>
  )
}

// ─── Metric condition row (2-row layout) ──────────────────────────────────────

function MetricConditionRow({
  cond,
  onChange,
  onRemove,
  canRemove,
}: {
  cond: MetricCondition
  onChange: (c: MetricCondition) => void
  onRemove: () => void
  canRemove: boolean
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-1.5">
      {/* Row 1: metric dropdown full-width */}
      <div className="relative">
        <select
          value={cond.metric}
          onChange={e => onChange({ ...cond, metric: e.target.value })}
          className="w-full h-9 pl-3 pr-8 text-[13px] bg-muted/40 border border-border/60 rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground"
        >
          {METRICS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
      </div>

      {/* Row 2: operator + value + unit + optional remove */}
      <div className="flex items-center gap-1.5">
        {/* Operator */}
        <div className="relative flex-1">
          <select
            value={cond.operator}
            onChange={e => onChange({ ...cond, operator: e.target.value as MetricCondition["operator"] })}
            className="w-full h-9 pl-2 pr-7 text-[12px] bg-muted/40 border border-border/60 rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground"
          >
            {OPERATORS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <IconChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
        </div>

        {/* Value */}
        <input
          type="number"
          value={cond.value}
          onChange={e => onChange({ ...cond, value: parseFloat(e.target.value) || 0 })}
          className="w-16 h-9 px-2 text-[13px] text-center bg-muted/40 border border-border/60 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 tabular-nums"
        />

        {/* Unit */}
        <div className="relative w-16">
          <select
            value={cond.unit}
            onChange={e => onChange({ ...cond, unit: e.target.value as MetricCondition["unit"] })}
            className="w-full h-9 pl-2 pr-6 text-[12px] bg-muted/40 border border-border/60 rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            <option value="%">%</option>
            <option value="$">$</option>
            <option value="x">x</option>
          </select>
          <IconChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
        </div>

        {canRemove && (
          <button
            onClick={onRemove}
            className="size-9 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
          >
            <IconX className="size-3.5" />
          </button>
        )}
      </div>

      {/* Row 3: preview historical changes link */}
      <button className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium">
        <IconChartBar className="size-3" />
        Preview historical changes
      </button>
    </div>
  )
}

// ─── Setup tab ────────────────────────────────────────────────────────────────

function SetupTab({
  config,
  onChange,
  adAccountName,
}: {
  config: TriggerConfig
  onChange: (c: TriggerConfig) => void
  adAccountName?: string
}) {
  const conditions = config.metricConditions ?? [
    { metric: "spend", operator: "decreases_by", value: 20, unit: "%" },
  ]

  function updateCondition(i: number, c: MetricCondition) {
    const next = [...conditions]
    next[i] = c
    onChange({ ...config, metricConditions: next })
  }

  function addCondition() {
    onChange({
      ...config,
      metricConditions: [
        ...conditions,
        { metric: "roas", operator: "decreases_by", value: 10, unit: "%" },
      ],
    })
  }

  function removeCondition(i: number) {
    onChange({ ...config, metricConditions: conditions.filter((_, j) => j !== i) })
  }

  const comparisonWindow = config.comparisonWindow ?? "day_over_day"
  const checkFrequency   = config.checkFrequency   ?? "daily"
  const monitoringLevel  = config.monitoringLevel  ?? "campaign"

  return (
    <div className="space-y-5 p-5">
      {/* APP */}
      <div className="space-y-1.5">
        <FieldLabel>App</FieldLabel>
        <div className="flex items-center justify-between h-9 px-3 bg-muted/40 border border-border/60 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="size-5 rounded bg-[#1877F2] flex items-center justify-center shrink-0">
              <span className="text-[9px] font-black text-white">∞</span>
            </div>
            <span className="text-sm font-medium">Meta</span>
          </div>
          <button className="text-[11px] text-primary hover:underline font-medium">Change</button>
        </div>
      </div>

      {/* TRIGGER EVENT */}
      <div className="space-y-1.5">
        <SelectField
          label="Trigger Event"
          value={config.event}
          options={[{ value: "performance_monitoring", label: "Performance Monitoring" }]}
          onChange={v => onChange({ ...config, event: v as TriggerConfig["event"] })}
        />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Detect when metrics change by a percentage between consecutive time periods. For example: "Spend increased by 20% and CPA increased by 15% day-over-day."
        </p>
      </div>

      {/* AD ACCOUNT(S) */}
      <div className="space-y-1.5">
        <FieldLabel>
          Ad Account(s) <span className="text-red-500">*</span>
        </FieldLabel>
        {adAccountName ? (
          <div className="flex items-center justify-between h-9 px-3 bg-muted/40 border border-border/60 rounded-lg cursor-pointer hover:border-primary/40 transition-colors">
            <div className="flex items-center gap-2">
              <div className="size-4 rounded bg-[#1877F2]/20 flex items-center justify-center shrink-0">
                <span className="text-[8px] font-bold text-[#1877F2]">∞</span>
              </div>
              <span className="text-sm text-foreground">{adAccountName}</span>
            </div>
            <IconChevronDown className="size-3.5 text-muted-foreground shrink-0" />
          </div>
        ) : (
          <div className="px-3 py-2 bg-muted/40 border border-border/60 rounded-lg">
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              No Meta ad accounts connected. Please connect an account in Settings.
            </p>
          </div>
        )}
      </div>

      {/* MONITORING LEVEL */}
      <SelectField
        label="Monitoring Level"
        value={monitoringLevel}
        options={MONITORING_LEVELS}
        onChange={v => onChange({ ...config, monitoringLevel: v as TriggerConfig["monitoringLevel"] })}
        description={`Compare metrics per ${monitoringLevel === "adset" ? "ad set" : monitoringLevel}.`}
      />

      {/* CAMPAIGN FILTER */}
      <SelectField
        label="Campaign Filter"
        value={config.campaignFilter ?? "all"}
        options={[
          { value: "all",      label: "All Campaigns" },
          { value: "specific", label: "Specific Campaigns" },
        ]}
        onChange={v => onChange({ ...config, campaignFilter: v as TriggerConfig["campaignFilter"] })}
      />

      {/* METRIC CONDITIONS */}
      <div className="space-y-2">
        <div>
          <FieldLabel>
            Metric Conditions <span className="text-red-500">*</span>
          </FieldLabel>
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
          onClick={addCondition}
          className="flex items-center gap-1.5 text-[12px] text-primary hover:underline font-medium mt-1"
        >
          <IconPlus className="size-3.5" />
          Add condition
        </button>
      </div>

      {/* COMPARISON WINDOW */}
      <SelectField
        label="Comparison Window *"
        value={comparisonWindow}
        options={COMPARISON_WINDOWS}
        onChange={v => onChange({ ...config, comparisonWindow: v as TriggerConfig["comparisonWindow"] })}
        description={
          comparisonWindow === "day_over_day"     ? "Compares yesterday vs the day before." :
          comparisonWindow === "week_over_week"   ? "Compares this week vs last week." :
          "Compares this month vs last month."
        }
      />

      {/* CHECK FREQUENCY */}
      <SelectField
        label="Check Frequency *"
        value={checkFrequency}
        options={FREQUENCIES}
        onChange={v => onChange({ ...config, checkFrequency: v as TriggerConfig["checkFrequency"] })}
        description="How often the system checks for changes."
      />

      {/* LIVE SUMMARY */}
      <div className="rounded-xl bg-primary/5 border border-primary/15 p-3">
        <p className="text-[12px] text-primary/80 leading-relaxed italic">
          {buildSummary(config)}
        </p>
      </div>
    </div>
  )
}

// ─── Preview tab ──────────────────────────────────────────────────────────────

function PreviewTab({ config }: { config: TriggerConfig }) {
  const windowLabel  = COMPARISON_WINDOWS.find(w => w.value === (config.comparisonWindow ?? "day_over_day"))?.label ?? "Day over Day"
  const conditions   = config.metricConditions ?? []

  const today     = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  const fmt       = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" })

  return (
    <div className="p-5 space-y-4">
      {/* 1. Fires when */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">
          1. Fires when
        </p>
        <div className="bg-muted/40 rounded-xl p-3 space-y-2">
          <p className="text-[12px] font-medium">Meta · Performance Monitoring</p>
          <div className="flex flex-wrap gap-1.5">
            {conditions.map((c, i) => {
              const metric = METRICS.find(m => m.value === c.metric)?.label ?? c.metric
              const op =
                c.operator === "decreases_by" ? "drops" :
                c.operator === "increases_by" ? "spikes" :
                c.operator === "is_above"     ? ">" : "<"
              return (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full bg-background border border-border/60 text-[10px] font-medium text-foreground/80"
                >
                  {metric} {op} {c.value}{c.unit}
                </span>
              )
            })}
            <span className="px-2 py-0.5 rounded-full bg-background border border-border/60 text-[10px] font-medium text-foreground/80">
              {config.campaignFilter === "all" ? "All campaigns" : "Specific campaigns"}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-background border border-border/60 text-[10px] font-medium text-foreground/80">
              {windowLabel}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-background border border-border/60 text-[10px] font-medium text-foreground/80">
              {FREQUENCIES.find(f => f.value === (config.checkFrequency ?? "daily"))?.label}
            </span>
          </div>
        </div>
      </div>

      {/* Check what matches button */}
      <button className="w-full h-9 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors">
        <IconPlayerPlay className="size-3.5 fill-primary-foreground" />
        Check what matches right now
      </button>

      {/* Comparison info */}
      <div className="space-y-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Comparing &middot; {windowLabel.toUpperCase()}
        </p>
        <p className="text-[13px] text-primary/80 font-medium">
          {fmt(yesterday)} vs {fmt(today)}
        </p>
      </div>
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
}

export function TriggerConfigPanel({
  stepIndex,
  config,
  onChange,
  adAccountName,
  onClose,
}: Props) {
  const [activeTab, setActiveTab] = useState<"setup" | "preview">("setup")

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Meta brand icon */}
          <div className="size-9 rounded-xl bg-[#EFF6FF] flex items-center justify-center shrink-0">
            <IconBrandMeta className="size-5 text-[#1877F2]" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground leading-tight truncate">
              {stepIndex}. Performance Monitoring
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
              activeTab === t
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "setup" ? (
          <SetupTab config={config} onChange={onChange} adAccountName={adAccountName} />
        ) : (
          <PreviewTab config={config} />
        )}
      </div>

      {/* Footer — setup tab only */}
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
