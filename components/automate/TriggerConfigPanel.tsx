"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { IconPlus, IconX, IconChevronDown, IconPlayerPlay } from "@tabler/icons-react"
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
  { value: "day_over_day",       label: "Day over Day" },
  { value: "week_over_week",     label: "Week over Week" },
  { value: "month_over_month",   label: "Month over Month" },
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
  const level = MONITORING_LEVELS.find(l => l.value === config.monitoringLevel)?.label ?? "Campaign"
  const window = COMPARISON_WINDOWS.find(w => w.value === config.comparisonWindow)?.label ?? "Day over Day"
  const cond = conditions[0]
  const metric = METRICS.find(m => m.value === cond.metric)?.label ?? cond.metric
  const op = OPERATORS.find(o => o.value === cond.operator)?.label?.toLowerCase() ?? cond.operator.replace(/_/g, " ")
  return `When ${metric} ${op} more than ${cond.value}${cond.unit} (${window.toLowerCase()}) per ${level.toLowerCase().replace(" level", "")}, trigger this automation.`
}

// ─── Reusable select ─────────────────────────────────────────────────────────

function SelectField({ label, value, options, onChange }: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full h-9 pl-3 pr-8 text-sm bg-muted/40 border border-border/60 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
      </div>
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
    <div className="flex items-center gap-2">
      {/* Metric */}
      <div className="relative flex-1">
        <select value={cond.metric} onChange={e => onChange({ ...cond, metric: e.target.value })}
          className="w-full h-8 pl-2 pr-6 text-[12px] bg-muted/40 border border-border/60 rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground">
          {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <IconChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
      </div>
      {/* Operator */}
      <div className="relative flex-1">
        <select value={cond.operator} onChange={e => onChange({ ...cond, operator: e.target.value as MetricCondition["operator"] })}
          className="w-full h-8 pl-2 pr-6 text-[12px] bg-muted/40 border border-border/60 rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground">
          {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <IconChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
      </div>
      {/* Value */}
      <input
        type="number"
        value={cond.value}
        onChange={e => onChange({ ...cond, value: parseFloat(e.target.value) || 0 })}
        className="w-16 h-8 px-2 text-[12px] text-center bg-muted/40 border border-border/60 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 tabular-nums"
      />
      {/* Unit */}
      <div className="relative">
        <select value={cond.unit} onChange={e => onChange({ ...cond, unit: e.target.value as MetricCondition["unit"] })}
          className="h-8 pl-2 pr-6 text-[12px] bg-muted/40 border border-border/60 rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-primary/30">
          <option value="%">%</option>
          <option value="$">$</option>
          <option value="x">x</option>
        </select>
        <IconChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
      </div>
      {canRemove && (
        <button onClick={onRemove} className="size-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
          <IconX className="size-3.5" />
        </button>
      )}
    </div>
  )
}

// ─── Setup tab ────────────────────────────────────────────────────────────────

function SetupTab({ config, onChange, adAccountName }: {
  config: TriggerConfig
  onChange: (c: TriggerConfig) => void
  adAccountName?: string
}) {
  const conditions = config.metricConditions ?? [{ metric: "spend", operator: "decreases_by", value: 20, unit: "%" }]

  function updateCondition(i: number, c: MetricCondition) {
    const next = [...conditions]
    next[i] = c
    onChange({ ...config, metricConditions: next })
  }

  function addCondition() {
    onChange({ ...config, metricConditions: [...conditions, { metric: "roas", operator: "decreases_by", value: 10, unit: "%" }] })
  }

  function removeCondition(i: number) {
    onChange({ ...config, metricConditions: conditions.filter((_, j) => j !== i) })
  }

  return (
    <div className="space-y-5 p-5">
      {/* App */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">App</label>
        <div className="flex items-center justify-between h-9 px-3 bg-muted/40 border border-border/60 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="size-5 rounded bg-blue-500 flex items-center justify-center">
              <span className="text-[9px] font-bold text-white">M</span>
            </div>
            <span className="text-sm font-medium">Meta</span>
          </div>
          <button className="text-[11px] text-primary hover:underline">Change</button>
        </div>
      </div>

      {/* Trigger Event */}
      <SelectField
        label="Trigger Event"
        value={config.event}
        options={[{ value: "performance_monitoring", label: "Performance Monitoring" }]}
        onChange={v => onChange({ ...config, event: v as TriggerConfig["event"] })}
      />
      <p className="text-[11px] text-muted-foreground -mt-3 leading-relaxed">
        Detect when metrics change by a percentage between consecutive time periods. For example: "Spend increased by 20% and CPA increased by 15% day-over-day."
      </p>

      {/* Ad Accounts */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Ad Account(s) <span className="text-red-500">*</span></label>
        <div className="flex items-center justify-between h-9 px-3 bg-muted/40 border border-border/60 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="size-4 rounded bg-blue-500/20 flex items-center justify-center">
              <span className="text-[8px] font-bold text-blue-600">M</span>
            </div>
            <span className="text-sm">{adAccountName ?? "Select account..."}</span>
          </div>
          <IconChevronDown className="size-3.5 text-muted-foreground" />
        </div>
      </div>

      {/* Monitoring Level */}
      <SelectField
        label="Monitoring Level"
        value={config.monitoringLevel ?? "campaign"}
        options={MONITORING_LEVELS}
        onChange={v => onChange({ ...config, monitoringLevel: v as TriggerConfig["monitoringLevel"] })}
      />
      <p className="text-[11px] text-muted-foreground -mt-3">Compare metrics per {(config.monitoringLevel ?? "campaign").replace("adset", "ad set")}.</p>

      {/* Campaign Filter */}
      <SelectField
        label="Campaign Filter"
        value={config.campaignFilter ?? "all"}
        options={[{ value: "all", label: "All Campaigns" }, { value: "specific", label: "Specific Campaigns" }]}
        onChange={v => onChange({ ...config, campaignFilter: v as TriggerConfig["campaignFilter"] })}
      />

      {/* Metric Conditions */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Metric Conditions <span className="text-red-500">*</span></label>
        <p className="text-[11px] text-muted-foreground">Define one or more metric conditions.</p>
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
          <IconPlus className="size-3.5" /> Add condition
        </button>
      </div>

      {/* Comparison Window */}
      <SelectField
        label="Comparison Window *"
        value={config.comparisonWindow ?? "day_over_day"}
        options={COMPARISON_WINDOWS}
        onChange={v => onChange({ ...config, comparisonWindow: v as TriggerConfig["comparisonWindow"] })}
      />
      <p className="text-[11px] text-muted-foreground -mt-3">
        {config.comparisonWindow === "day_over_day" ? "Compares yesterday vs the day before." :
         config.comparisonWindow === "week_over_week" ? "Compares this week vs last week." :
         "Compares this month vs last month."}
      </p>

      {/* Check Frequency */}
      <SelectField
        label="Check Frequency *"
        value={config.checkFrequency ?? "daily"}
        options={FREQUENCIES}
        onChange={v => onChange({ ...config, checkFrequency: v as TriggerConfig["checkFrequency"] })}
      />
      <p className="text-[11px] text-muted-foreground -mt-3">How often the system checks for changes.</p>

      {/* Live summary */}
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
  const window = COMPARISON_WINDOWS.find(w => w.value === (config.comparisonWindow ?? "day_over_day"))?.label ?? "Day over Day"
  const conditions = config.metricConditions ?? []

  const today = new Date()
  const yesterday = new Date(today.getTime() - 86400_000)
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" })

  return (
    <div className="p-5 space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">1. Fires when</p>
        <div className="bg-muted/40 rounded-xl p-3 space-y-2">
          <p className="text-[12px] font-medium">Meta · Performance Monitoring</p>
          <div className="flex flex-wrap gap-1.5">
            {conditions.map((c, i) => {
              const metric = METRICS.find(m => m.value === c.metric)?.label ?? c.metric
              const op = c.operator === "decreases_by" ? "drops" : c.operator === "increases_by" ? "spikes" : c.operator === "is_above" ? ">" : "<"
              return (
                <span key={i} className="px-2 py-0.5 rounded-full bg-background border border-border/60 text-[10px] font-medium text-foreground/80">
                  {metric} {op} {c.value}{c.unit}
                </span>
              )
            })}
            <span className="px-2 py-0.5 rounded-full bg-background border border-border/60 text-[10px] font-medium text-foreground/80">
              {(config.campaignFilter === "all" ? "All campaigns" : "Specific campaigns")}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-background border border-border/60 text-[10px] font-medium text-foreground/80">
              {window}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-background border border-border/60 text-[10px] font-medium text-foreground/80">
              {FREQUENCIES.find(f => f.value === (config.checkFrequency ?? "daily"))?.label}
            </span>
          </div>
        </div>
      </div>

      <button className="w-full h-9 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors">
        <IconPlayerPlay className="size-3.5" />
        Check what matches right now
      </button>

      <div className="text-[11px] text-muted-foreground">
        <span className="font-semibold uppercase tracking-wide">Comparing: </span>
        {window.toUpperCase()}
        <br />
        <span className="text-primary/70">{fmt(yesterday)} → {fmt(today)}</span>
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
  onPreview?: () => void
}

export function TriggerConfigPanel({ stepIndex, config, onChange, adAccountName, onPreview }: Props) {
  const [activeTab, setActiveTab] = useState<"setup" | "preview">("setup")

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Panel header */}
      <div className="px-5 py-4 border-b border-border shrink-0">
        <p className="text-[11px] text-muted-foreground font-medium mb-0.5">
          {stepIndex}. Performance Monitoring
        </p>
        <p className="text-[12px] text-muted-foreground/60">When does this step fire?</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border shrink-0">
        {(["setup", "preview"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={cn(
              "flex-1 py-2.5 text-[13px] font-medium transition-colors capitalize",
              activeTab === t
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "setup"
          ? <SetupTab config={config} onChange={onChange} adAccountName={adAccountName} />
          : <PreviewTab config={config} />
        }
      </div>

      {/* Footer */}
      {activeTab === "setup" && (
        <div className="p-5 border-t border-border shrink-0">
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
