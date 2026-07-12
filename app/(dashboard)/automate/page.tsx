"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAdAccount } from "@/lib/ad-account-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  IconBolt, IconPlus, IconSearch, IconRefresh, IconLoader2, IconX,
  IconCheck, IconChevronDown, IconPlayerPause, IconPlayerPlay,
  IconTrash, IconEdit, IconBell, IconHistory, IconTemplate,
  IconSettings, IconCopy, IconAlertCircle, IconTarget, IconRocket,
  IconMoneybag, IconCalendar, IconBrandTiktok, IconBrandSnapchat,
  IconBrandPinterest, IconFileSpreadsheet, IconChartBar, IconToggleLeft,
  IconStar, IconCircleCheck, IconClockHour4, IconMinus,
  IconBrandMeta, IconBrandSlack, IconBrandGoogleDrive, IconTable,
  IconArrowRight,
} from "@tabler/icons-react"

// ─── Types ─────────────────────────────────────────────────────────────────────

type AutomateTab = "automations" | "templates" | "active" | "approvals" | "notifications" | "history"
type TemplateCategory = "All" | "Scaling" | "Optimization" | "Reporting"

interface Automation {
  id: string
  name: string
  description?: string
  status: "active" | "paused" | "draft"
  trigger_type: string
  trigger_config: Record<string, any>
  conditions: any[]
  actions: any[]
  ad_account_ids: string[]
  requires_approval: boolean
  template_id?: string
  run_count: number
  last_run_at?: string
  created_at: string
}

interface AutomationExecution {
  id: string
  automation_id: string
  automation_name: string
  status: "success" | "failed" | "pending" | "skipped"
  entities_affected: number
  api_calls: number
  action_taken?: string
  executed_at: string
}

interface AutomationApproval {
  id: string
  automation_id: string
  automation_name: string
  status: "pending" | "approved" | "rejected"
  requested_action: string
  details: Record<string, any>
  created_at: string
  automations?: { name: string; trigger_type: string }
}

// ─── Templates ─────────────────────────────────────────────────────────────────

// App chain icon type
type ChainAppId = "meta" | "notification" | "tiktok" | "snapchat" | "pinterest" | "slack" | "sheets" | "schedule" | "google_drive"

const TEMPLATES = [
  {
    id: "performance_monitoring",
    name: "Performance Monitoring",
    category: "Optimization" as TemplateCategory,
    featured: true,
    fbLive: true,
    fbAction: "SEND_NOTIFICATION",
    fbActionLabel: "Send Notification",
    icon: IconChartBar,
    iconColor: "text-violet-500",
    iconBg: "bg-violet-50 dark:bg-violet-950/30",
    description: "Track key metric changes across your ad accounts. Get alerted when spend, CPA, or ROAS shifts significantly day-over-day or week-over-week so you can act fast.",
    steps: 2,
    appChain: ["meta", "notification"] as ChainAppId[],
    trigger: { type: "metric_threshold", config: { metric: "roas", operator: "LESS_THAN", value: 1.5 } },
    actions: [{ type: "SEND_NOTIFICATION", config: {} }],
  },
  {
    id: "scale_top_performers",
    name: "Scale Top Performers",
    category: "Scaling" as TemplateCategory,
    comingSoon: true,
    icon: IconRocket,
    iconColor: "text-pink-500",
    iconBg: "bg-pink-50 dark:bg-pink-950/30",
    description: "Automatically duplicate ads that exceed a ROAS threshold so you can scale winners quickly.",
    steps: 2,
    appChain: ["meta", "meta"] as ChainAppId[],
    trigger: { type: "metric_threshold", config: { metric: "roas", operator: "GREATER_THAN", value: 2 } },
    actions: [{ type: "duplicate_ad", config: {} }],
  },
  {
    id: "budget_boost_winners",
    name: "Budget Boost for Winners",
    category: "Scaling" as TemplateCategory,
    fbLive: true,
    fbAction: "INCREASE_DAILY_BUDGET",
    fbActionLabel: "Increase Daily Budget",
    icon: IconMoneybag,
    iconColor: "text-amber-500",
    iconBg: "bg-amber-50 dark:bg-amber-950/30",
    description: "Increase budget by 20% for ad sets with ROAS above 2 to capitalize on high-performing spend.",
    steps: 2,
    appChain: ["meta", "meta"] as ChainAppId[],
    trigger: { type: "metric_threshold", config: { metric: "roas", operator: "GREATER_THAN", value: 2 } },
    actions: [{ type: "INCREASE_DAILY_BUDGET", config: { percentage: 20 } }],
  },
  {
    id: "post_approval_scaling",
    name: "Post-Approval Scaling",
    category: "Scaling" as TemplateCategory,
    comingSoon: true,
    icon: IconCircleCheck,
    iconColor: "text-green-500",
    iconBg: "bg-green-50 dark:bg-green-950/30",
    description: "Once an ad is approved by Meta, automatically duplicate it into additional ad sets for broader reach.",
    steps: 2,
    appChain: ["meta", "meta"] as ChainAppId[],
    trigger: { type: "status_change", config: { from: "IN_PROCESS", to: "ACTIVE" } },
    actions: [{ type: "duplicate_ad", config: { into_adsets: true } }],
  },
  {
    id: "launch_winners_tiktok",
    name: "Launch Winners on TikTok",
    category: "Scaling" as TemplateCategory,
    comingSoon: true,
    icon: IconBrandTiktok,
    iconColor: "text-slate-800 dark:text-slate-200",
    iconBg: "bg-slate-100 dark:bg-slate-800/50",
    description: "Find Facebook ads with ROAS above 2 and automatically launch them on TikTok to expand reach.",
    steps: 2,
    appChain: ["meta", "tiktok"] as ChainAppId[],
    trigger: { type: "metric_threshold", config: { metric: "roas", operator: "GREATER_THAN", value: 2 } },
    actions: [{ type: "cross_launch", config: { platform: "tiktok" } }],
  },
  {
    id: "launch_winners_snapchat",
    name: "Launch Winners on Snapchat",
    category: "Scaling" as TemplateCategory,
    comingSoon: true,
    icon: IconBrandSnapchat,
    iconColor: "text-yellow-500",
    iconBg: "bg-yellow-50 dark:bg-yellow-950/30",
    description: "Find Facebook ads with ROAS above 2 and automatically launch them on Snapchat.",
    steps: 2,
    appChain: ["meta", "snapchat"] as ChainAppId[],
    trigger: { type: "metric_threshold", config: { metric: "roas", operator: "GREATER_THAN", value: 2 } },
    actions: [{ type: "cross_launch", config: { platform: "snapchat" } }],
  },
  {
    id: "launch_winners_pinterest",
    name: "Launch Winners on Pinterest",
    category: "Scaling" as TemplateCategory,
    comingSoon: true,
    icon: IconBrandPinterest,
    iconColor: "text-red-500",
    iconBg: "bg-red-50 dark:bg-red-950/30",
    description: "Find Facebook ads with ROAS above 2 and automatically launch them on Pinterest.",
    steps: 2,
    appChain: ["meta", "pinterest"] as ChainAppId[],
    trigger: { type: "metric_threshold", config: { metric: "roas", operator: "GREATER_THAN", value: 2 } },
    actions: [{ type: "cross_launch", config: { platform: "pinterest" } }],
  },
  {
    id: "pause_underperformers",
    name: "Pause Underperformers",
    category: "Optimization" as TemplateCategory,
    fbLive: true,
    fbAction: "PAUSE_ADSET",
    fbActionLabel: "Pause Ad Set",
    icon: IconPlayerPause,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-50 dark:bg-blue-950/30",
    description: "Automatically pause ad sets with ROAS below 1 to stop wasting budget on low-performing creatives.",
    steps: 2,
    appChain: ["meta", "meta"] as ChainAppId[],
    trigger: { type: "metric_threshold", config: { metric: "roas", operator: "LESS_THAN", value: 1 } },
    actions: [{ type: "PAUSE_ADSET", config: {} }],
  },
  {
    id: "daily_budget_toggle",
    name: "Daily Budget Rule Toggle",
    category: "Optimization" as TemplateCategory,
    comingSoon: true,
    icon: IconToggleLeft,
    iconColor: "text-indigo-500",
    iconBg: "bg-indigo-50 dark:bg-indigo-950/30",
    description: "Run a scheduled check every day and toggle an existing automation rule on or off based on the day.",
    steps: 2,
    appChain: ["schedule", "meta"] as ChainAppId[],
    trigger: { type: "schedule", config: { frequency: "daily", time: "09:00" } },
    actions: [{ type: "toggle_rule", config: {} }],
  },
  {
    id: "log_ad_launches_sheets",
    name: "Log Ad Launches to Sheets",
    category: "Reporting" as TemplateCategory,
    comingSoon: true,
    icon: IconFileSpreadsheet,
    iconColor: "text-green-600",
    iconBg: "bg-green-50 dark:bg-green-950/30",
    description: "Every time an ad is launched via AdLauncher, automatically log the details to a Google Sheet for tracking.",
    steps: 2,
    appChain: ["meta", "sheets"] as ChainAppId[],
    trigger: { type: "event", config: { event: "ad_launched" } },
    actions: [{ type: "log_to_sheets", config: {} }],
  },
]

// ─── App chain icon renderer ──────────────────────────────────────────────────

const CHAIN_ICON_MAP: Record<ChainAppId, { icon: React.ElementType; color: string; bg: string }> = {
  meta:         { icon: IconBrandMeta,        color: "text-[#1877F2]",    bg: "bg-[#EFF6FF]" },
  notification: { icon: IconBell,             color: "text-amber-500",    bg: "bg-amber-50 dark:bg-amber-950/30" },
  tiktok:       { icon: IconBrandTiktok,      color: "text-zinc-800 dark:text-zinc-200", bg: "bg-zinc-100 dark:bg-zinc-800" },
  snapchat:     { icon: IconBrandSnapchat,    color: "text-yellow-500",   bg: "bg-yellow-50 dark:bg-yellow-950/20" },
  pinterest:    { icon: IconBrandPinterest,   color: "text-red-500",      bg: "bg-red-50 dark:bg-red-950/20" },
  slack:        { icon: IconBrandSlack,       color: "text-purple-600",   bg: "bg-purple-50 dark:bg-purple-950/20" },
  sheets:       { icon: IconTable,            color: "text-green-600",    bg: "bg-green-50 dark:bg-green-950/20" },
  schedule:     { icon: IconCalendar,         color: "text-indigo-500",   bg: "bg-indigo-50 dark:bg-indigo-950/20" },
  google_drive: { icon: IconBrandGoogleDrive, color: "text-green-500",    bg: "bg-green-50 dark:bg-green-950/20" },
}

function AppChain({ chain, steps }: { chain: ChainAppId[]; steps: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {chain.map((appId, i) => {
        const { icon: Icon, color, bg } = CHAIN_ICON_MAP[appId]
        return (
          <div key={i} className="flex items-center gap-1.5">
            {i > 0 && <IconArrowRight className="size-3 text-muted-foreground/50" />}
            <div className={cn("size-6 rounded-lg flex items-center justify-center", bg)}>
              <Icon className={cn("size-3.5", color)} />
            </div>
          </div>
        )
      })}
      <span className="text-xs text-muted-foreground ml-1">{steps} steps</span>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  metric_threshold: "Metric Threshold",
  schedule: "Schedule",
  status_change: "Status Change",
  event: "Event",
  manual: "Manual",
}

const ACTION_LABELS: Record<string, string> = {
  send_notification: "Send Notification",
  pause_ad: "Pause Ad",
  resume_ad: "Resume Ad",
  pause_adset: "Pause Ad Set",
  adjust_budget: "Adjust Budget",
  duplicate_ad: "Duplicate Ad",
  require_approval: "Require Approval",
  cross_launch: "Cross-Platform Launch",
  toggle_rule: "Toggle Rule",
  log_to_sheets: "Log to Sheets",
}

const METRIC_OPTIONS = [
  { value: "roas", label: "ROAS" },
  { value: "spend", label: "Spend ($)" },
  { value: "cpc", label: "CPC ($)" },
  { value: "cpm", label: "CPM ($)" },
  { value: "ctr", label: "CTR (%)" },
  { value: "impressions", label: "Impressions" },
  { value: "results", label: "Results" },
  { value: "cost_per_result", label: "Cost per Result ($)" },
  { value: "frequency", label: "Frequency" },
]

const ACTION_OPTIONS = [
  { value: "send_notification", label: "Send Notification" },
  { value: "pause_ad", label: "Pause Ad" },
  { value: "resume_ad", label: "Resume Ad" },
  { value: "adjust_budget", label: "Adjust Budget" },
  { value: "duplicate_ad", label: "Duplicate Ad" },
  { value: "require_approval", label: "Require Approval" },
]

function statusBadge(status: string) {
  if (status === "active") return "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
  if (status === "paused") return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
  return "bg-muted text-muted-foreground"
}

function execStatusBadge(status: string) {
  if (status === "success") return "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
  if (status === "failed") return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
  if (status === "pending") return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
  return "bg-muted text-muted-foreground"
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

// ─── Create Facebook Rule Modal (live on Meta) ────────────────────────────────

const FB_METRIC_OPTIONS = [
  { value: "roas", label: "Purchase ROAS" },
  { value: "spend", label: "Spend ($)" },
  { value: "cpc", label: "CPC ($)" },
  { value: "cpm", label: "CPM ($)" },
  { value: "ctr", label: "CTR (%)" },
  { value: "impressions", label: "Impressions" },
  { value: "reach", label: "Reach" },
  { value: "frequency", label: "Frequency" },
  { value: "cost_per_result", label: "Cost per Purchase ($)" },
  { value: "results", label: "Purchases" },
]

const FB_OPERATOR_OPTIONS = [
  { value: "GREATER_THAN", label: "is greater than (>)" },
  { value: "LESS_THAN", label: "is less than (<)" },
  { value: "GREATER_THAN_OR_EQUAL_TO", label: "is ≥" },
  { value: "LESS_THAN_OR_EQUAL_TO", label: "is ≤" },
]

const FB_SCHEDULE_OPTIONS = [
  { value: "SEMI_HOURLY", label: "Every 30 minutes" },
  { value: "HOURLY", label: "Every hour" },
  { value: "EVERY_12_HOURS", label: "Every 12 hours" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
]

function CreateFbRuleModal({
  open, onClose, template, adAccounts,
}: {
  open: boolean
  onClose: () => void
  template: typeof TEMPLATES[0] | null
  adAccounts: { id: string; name: string; account_id: string }[]
}) {
  const tc = template?.trigger?.config as any
  const [accountId, setAccountId] = useState(adAccounts[0]?.account_id || "")
  const [name, setName] = useState(template?.name || "")
  const [metric, setMetric] = useState(tc?.metric || "roas")
  const [operator, setOperator] = useState(tc?.operator || "GREATER_THAN")
  const [value, setValue] = useState(String(tc?.value ?? "2"))
  const [budgetPct, setBudgetPct] = useState("20")
  const [schedule, setSchedule] = useState("DAILY")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [createdRuleId, setCreatedRuleId] = useState("")

  useEffect(() => {
    if (open && template) {
      const tc2 = template.trigger?.config as any
      setName(template.name)
      setMetric(tc2?.metric || "roas")
      setOperator(tc2?.operator || "GREATER_THAN")
      setValue(String(tc2?.value ?? "2"))
      setBudgetPct("20")
      setSchedule("DAILY")
      setError("")
      setSuccess(false)
      setCreatedRuleId("")
      if (adAccounts.length > 0) setAccountId(adAccounts[0].account_id || adAccounts[0].id)
    }
  }, [open, template, adAccounts])

  const fbAction = template?.fbAction || "SEND_NOTIFICATION"
  const needsBudgetPct = fbAction === "INCREASE_DAILY_BUDGET" || fbAction === "DECREASE_DAILY_BUDGET" ||
    fbAction === "INCREASE_LIFETIME_BUDGET" || fbAction === "DECREASE_LIFETIME_BUDGET"

  async function handleCreate() {
    if (!accountId) { setError("Please select an ad account"); return }
    if (!name.trim()) { setError("Rule name is required"); return }
    if (!value || isNaN(parseFloat(value))) { setError("Threshold value must be a number"); return }
    if (needsBudgetPct && (!budgetPct || isNaN(parseFloat(budgetPct)))) {
      setError("Budget percentage is required"); return
    }
    setSaving(true); setError("")
    try {
      const norm = accountId.startsWith("act_") ? accountId : `act_${accountId}`
      const res = await fetch("/api/facebook/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adAccountId: norm,
          name: name.trim(),
          conditions: [{ field: metric, operator, value: parseFloat(value) }],
          action: {
            type: fbAction,
            value: needsBudgetPct ? budgetPct : undefined,
          },
          schedule: { type: schedule, count: 1 },
        }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error || "Failed to create rule"); return }
      setCreatedRuleId(d.rule?.id || "")
      setSuccess(true)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (!open || !template) return null

  const metricLabel = FB_METRIC_OPTIONS.find(m => m.value === metric)?.label || metric
  const operatorLabel = FB_OPERATOR_OPTIONS.find(o => o.value === operator)?.label || operator

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-2xl shadow-2xl border w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className={cn("size-9 rounded-lg flex items-center justify-center shrink-0", template.iconBg)}>
              <template.icon className={cn("size-5", template.iconColor)} />
            </div>
            <div>
              <h2 className="font-semibold text-base">{template.name}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="size-1.5 rounded-full bg-green-500 inline-block" />
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">Live on Meta · Creates real Facebook rule</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <IconX className="size-5" />
          </button>
        </div>

        {success ? (
          /* Success state */
          <div className="flex flex-col items-center justify-center p-10 text-center gap-4">
            <div className="size-16 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
              <IconCheck className="size-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Rule Created!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your rule is now live on Meta and will run <strong>{FB_SCHEDULE_OPTIONS.find(s => s.value === schedule)?.label?.toLowerCase()}</strong>.
              </p>
              {createdRuleId && (
                <p className="text-xs text-muted-foreground mt-1 font-mono">Rule ID: {createdRuleId}</p>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button asChild>
                <a href="/automate/rules" onClick={onClose}>View in Rules</a>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed">{template.description}</p>

              {/* Ad Account */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Ad Account</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                >
                  {adAccounts.map(a => (
                    <option key={a.id} value={a.account_id || a.id}>
                      {a.name} ({a.account_id || a.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Rule name */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Rule Name</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              {/* Condition */}
              <div>
                <label className="text-sm font-medium mb-2 block">Condition — when this is true</label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    className="border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                    value={metric}
                    onChange={e => setMetric(e.target.value)}
                  >
                    {FB_METRIC_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <select
                    className="border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                    value={operator}
                    onChange={e => setOperator(e.target.value)}
                  >
                    {FB_OPERATOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input
                    type="number"
                    className="border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    step="0.1"
                    min="0"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  → When <strong>{metricLabel}</strong> {operatorLabel} <strong>{value}</strong>
                </p>
              </div>

              {/* Action */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Action — then do this</label>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border text-sm">
                  <IconBolt className="size-4 text-primary shrink-0" />
                  <span className="font-medium">{template.fbActionLabel}</span>
                  {needsBudgetPct && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-muted-foreground text-xs">by</span>
                      <input
                        type="number"
                        className="w-16 border rounded-md px-2 py-1 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none text-center"
                        value={budgetPct}
                        onChange={e => setBudgetPct(e.target.value)}
                        min="1"
                        max="1000"
                      />
                      <span className="text-muted-foreground text-xs">%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Schedule */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Run Frequency</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  value={schedule}
                  onChange={e => setSchedule(e.target.value)}
                >
                  {FB_SCHEDULE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              {/* Summary */}
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                <strong>Summary:</strong> {FB_SCHEDULE_OPTIONS.find(s => s.value === schedule)?.label}, when <strong>{metricLabel}</strong> {operatorLabel} <strong>{value}</strong> → <strong>{template.fbActionLabel}</strong>{needsBudgetPct ? ` by ${budgetPct}%` : ""}. Rule runs on Meta's servers automatically.
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
                  <IconAlertCircle className="size-4 shrink-0" />{error}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving
                  ? <><IconLoader2 className="size-4 animate-spin mr-1.5" />Creating...</>
                  : <><IconBolt className="size-4 mr-1.5" />Create Live Rule on Meta</>
                }
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Create Automation Modal ───────────────────────────────────────────────────

function CreateAutomationModal({
  open, onClose, onCreated, adAccounts, template,
}: {
  open: boolean
  onClose: () => void
  onCreated: (a: Automation) => void
  adAccounts: { id: string; name: string; account_id: string }[]
  template?: typeof TEMPLATES[0] | null
}) {
  const [name, setName] = useState(template?.name || "")
  const [description, setDescription] = useState(template?.description || "")
  const [triggerType, setTriggerType] = useState(template?.trigger?.type || "metric_threshold")
  const [metric, setMetric] = useState((template?.trigger?.config as any)?.metric || "roas")
  const [operator, setOperator] = useState((template?.trigger?.config as any)?.operator || "GREATER_THAN")
  const [value, setValue] = useState(String((template?.trigger?.config as any)?.value || "2"))
  const [scheduleFreq, setScheduleFreq] = useState("daily")
  const [scheduleTime, setScheduleTime] = useState("09:00")
  const [actionType, setActionType] = useState(
    (template?.actions?.[0] as any)?.type || "send_notification"
  )
  const [budgetChange, setBudgetChange] = useState("20")
  const [budgetChangeType, setBudgetChangeType] = useState("percentage_increase")
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(adAccounts.map(a => a.id))
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open && template) {
      setName(template.name)
      setDescription(template.description)
      setTriggerType(template.trigger?.type || "metric_threshold")
      const tc = template.trigger?.config as any
      if (tc) { setMetric(tc.metric || "roas"); setOperator(tc.operator || "GREATER_THAN"); setValue(String(tc.value || "2")) }
      const ac = template.actions?.[0] as any
      if (ac) { setActionType(ac.type || "send_notification") }
    }
  }, [open, template])

  const buildConditions = () => {
    if (triggerType === "metric_threshold") {
      return [{ field: metric, operator, value: parseFloat(value) }]
    }
    return []
  }

  const buildActions = () => {
    if (actionType === "adjust_budget") {
      return [{ type: actionType, config: { change_type: budgetChangeType, percentage: parseFloat(budgetChange) } }]
    }
    return [{ type: actionType, config: {} }]
  }

  const buildTriggerConfig = () => {
    if (triggerType === "schedule") return { frequency: scheduleFreq, time: scheduleTime }
    if (triggerType === "metric_threshold") return { metric, operator, value: parseFloat(value) }
    return {}
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Automation name is required"); return }
    setError(""); setSaving(true)
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description,
          trigger_type: triggerType,
          trigger_config: buildTriggerConfig(),
          conditions: buildConditions(),
          actions: buildActions(),
          ad_account_ids: selectedAccounts,
          requires_approval: requiresApproval,
          template_id: template?.id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Failed to create"); return }
      onCreated(data.automation)
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background border rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="font-semibold text-base">
              {template ? `Use Template: ${template.name}` : "Create Automation"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure trigger, conditions, and actions
            </p>
          </div>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted/50 flex items-center justify-center">
            <IconX className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Automation Name *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Pause low ROAS ads"
              className="w-full px-3 py-2 text-sm border rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring" />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={2} placeholder="Describe what this automation does..."
              className="w-full px-3 py-2 text-sm border rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring resize-none" />
          </div>

          {/* Trigger */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Trigger Type</label>
            <select value={triggerType} onChange={e => setTriggerType(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring">
              <option value="metric_threshold">Metric Threshold</option>
              <option value="schedule">Schedule</option>
              <option value="status_change">Status Change</option>
              <option value="event">Event</option>
            </select>
          </div>

          {/* Metric conditions */}
          {triggerType === "metric_threshold" && (
            <div className="bg-muted/30 rounded-xl p-3 space-y-3 border">
              <p className="text-xs font-medium">Condition</p>
              <div className="grid grid-cols-3 gap-2">
                <select value={metric} onChange={e => setMetric(e.target.value)}
                  className="px-2 py-1.5 text-sm border rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring">
                  {METRIC_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <select value={operator} onChange={e => setOperator(e.target.value)}
                  className="px-2 py-1.5 text-sm border rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring">
                  <option value="GREATER_THAN">{">"}</option>
                  <option value="LESS_THAN">{"<"}</option>
                  <option value="GREATER_THAN_OR_EQUAL">{">="}</option>
                  <option value="LESS_THAN_OR_EQUAL">{"<="}</option>
                  <option value="EQUAL">{"="}</option>
                </select>
                <input type="number" value={value} onChange={e => setValue(e.target.value)}
                  className="px-2 py-1.5 text-sm border rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring" />
              </div>
            </div>
          )}

          {/* Schedule */}
          {triggerType === "schedule" && (
            <div className="bg-muted/30 rounded-xl p-3 space-y-3 border">
              <p className="text-xs font-medium">Schedule</p>
              <div className="grid grid-cols-2 gap-2">
                <select value={scheduleFreq} onChange={e => setScheduleFreq(e.target.value)}
                  className="px-2 py-1.5 text-sm border rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring">
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
                <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                  className="px-2 py-1.5 text-sm border rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring" />
              </div>
            </div>
          )}

          {/* Action */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Action</label>
            <select value={actionType} onChange={e => setActionType(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring">
              {ACTION_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>

          {/* Budget config */}
          {actionType === "adjust_budget" && (
            <div className="bg-muted/30 rounded-xl p-3 space-y-3 border">
              <p className="text-xs font-medium">Budget Adjustment</p>
              <div className="grid grid-cols-2 gap-2">
                <select value={budgetChangeType} onChange={e => setBudgetChangeType(e.target.value)}
                  className="px-2 py-1.5 text-sm border rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring">
                  <option value="percentage_increase">Increase %</option>
                  <option value="percentage_decrease">Decrease %</option>
                  <option value="absolute">Set to $</option>
                </select>
                <input type="number" value={budgetChange} onChange={e => setBudgetChange(e.target.value)}
                  placeholder={budgetChangeType === "absolute" ? "Amount $" : "Percentage"}
                  className="px-2 py-1.5 text-sm border rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring" />
              </div>
            </div>
          )}

          {/* Ad Accounts */}
          {adAccounts.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Apply to Ad Accounts</label>
              <div className="flex flex-wrap gap-1.5">
                {adAccounts.map(a => {
                  const sel = selectedAccounts.includes(a.id)
                  return (
                    <button key={a.id}
                      onClick={() => setSelectedAccounts(prev => sel ? prev.filter(x => x !== a.id) : [...prev, a.id])}
                      className={cn("text-xs px-2.5 py-1 rounded-lg border transition-colors",
                        sel ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted/30")}>
                      {a.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Approval toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => setRequiresApproval(p => !p)}
              className={cn("w-9 h-5 rounded-full relative transition-colors",
                requiresApproval ? "bg-primary" : "bg-muted")}>
              <div className={cn("absolute top-0.5 size-4 bg-white rounded-full shadow transition-transform",
                requiresApproval ? "translate-x-4" : "translate-x-0.5")} />
            </div>
            <span className="text-sm">Require approval before executing</span>
          </label>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/5 px-3 py-2 rounded-lg">
              <IconAlertCircle className="size-4 shrink-0" />{error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
            {saving ? <IconLoader2 className="size-4 animate-spin" /> : <IconCheck className="size-4" />}
            {saving ? "Creating..." : "Create Automation"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AutomatePage() {
  const { adAccounts, selectedAccountId } = useAdAccount()
  const router = useRouter()
  const [tab, setTab] = useState<AutomateTab>("automations")
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory>("All")
  const [search, setSearch] = useState("")
  const [histSearch, setHistSearch] = useState("")
  const [notifSearch, setNotifSearch] = useState("")

  const [automations, setAutomations] = useState<Automation[]>([])
  const [execHistory, setExecHistory] = useState<AutomationExecution[]>([])
  const [approvals, setApprovals] = useState<AutomationApproval[]>([])

  const [loading, setLoading] = useState(false)
  const [histLoading, setHistLoading] = useState(false)
  const [approvalsLoading, setApprovalsLoading] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<typeof TEMPLATES[0] | null>(null)
  const [fbRuleOpen, setFbRuleOpen] = useState(false)
  const [fbRuleTemplate, setFbRuleTemplate] = useState<typeof TEMPLATES[0] | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Fetch automations
  const fetchAutomations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/automations")
      const d = await res.json()
      setAutomations(d.automations || [])
    } catch {} finally { setLoading(false) }
  }, [])

  const fetchHistory = useCallback(async () => {
    setHistLoading(true)
    try {
      const res = await fetch(`/api/automations/history?search=${encodeURIComponent(histSearch)}`)
      const d = await res.json()
      setExecHistory(d.history || [])
    } catch {} finally { setHistLoading(false) }
  }, [histSearch])

  const fetchApprovals = useCallback(async () => {
    setApprovalsLoading(true)
    try {
      const res = await fetch("/api/automations/approvals")
      const d = await res.json()
      setApprovals(d.approvals || [])
    } catch {} finally { setApprovalsLoading(false) }
  }, [])

  useEffect(() => { fetchAutomations() }, [fetchAutomations])
  useEffect(() => { if (tab === "history") fetchHistory() }, [tab, fetchHistory])
  useEffect(() => { if (tab === "approvals") fetchApprovals() }, [tab, fetchApprovals])

  const toggleStatus = async (a: Automation) => {
    setTogglingId(a.id)
    const newStatus = a.status === "active" ? "paused" : "active"
    try {
      const res = await fetch(`/api/automations/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const d = await res.json()
      if (res.ok) setAutomations(prev => prev.map(x => x.id === a.id ? d.automation : x))
    } catch {} finally { setTogglingId(null) }
  }

  const deleteAutomation = async (id: string) => {
    if (!confirm("Delete this automation? This cannot be undone.")) return
    setDeletingId(id)
    try {
      await fetch(`/api/automations/${id}`, { method: "DELETE" })
      setAutomations(prev => prev.filter(x => x.id !== id))
    } catch {} finally { setDeletingId(null) }
  }

  const handleApprove = async (id: string, action: "approved" | "rejected") => {
    try {
      const res = await fetch("/api/automations/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      })
      if (res.ok) setApprovals(prev => prev.filter(x => x.id !== id))
    } catch {}
  }

  const useTemplate = (tpl: typeof TEMPLATES[0]) => {
    router.push(`/automate/new?template=${tpl.id}`)
  }

  const filtered = automations.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase())
  )
  const activeAutos = automations.filter(a => a.status === "active")
  const filteredTemplates = templateCategory === "All"
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === templateCategory)

  const TABS: { id: AutomateTab; label: string }[] = [
    { id: "automations", label: "My Automations" },
    { id: "templates", label: "Templates" },
    { id: "active", label: "Active" },
    { id: "approvals", label: `Approvals${approvals.length > 0 ? ` (${approvals.length})` : ""}` },
    { id: "notifications", label: "Notifications" },
    { id: "history", label: "History" },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center px-6 border-b shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              "px-0 py-3.5 mr-6 text-sm border-b-2 transition-colors whitespace-nowrap shrink-0",
              tab === t.id ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">

        {/* ── My Automations ─────────────────────────────────────────── */}
        {tab === "automations" && (
          <div className="p-6 space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, account, user..."
                  className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigator.clipboard?.writeText(JSON.stringify(automations, null, 2))}>
                  <IconCopy className="size-3.5" />Copy JSON
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <IconSettings className="size-3.5" />View settings
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => router.push("/automate/new")}>
                  <IconPlus className="size-3.5" />Create
                </Button>
              </div>
            </div>

            {/* List */}
            {loading ? (
              <div className="flex items-center justify-center h-60">
                <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 text-center">
                <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <IconBolt className="size-8 text-primary" />
                </div>
                <h2 className="text-base font-semibold">No automations yet</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                  Create your first automation to schedule Meta actions automatically.
                </p>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => setTab("templates")}>
                    <IconTemplate className="size-4 mr-1.5" />Browse templates
                  </Button>
                  <Button size="sm" className="gap-1.5" onClick={() => router.push("/automate/new")}>
                    <IconPlus className="size-4" />Create Automation
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(a => (
                  <div key={a.id} className="flex items-center gap-4 px-4 py-3.5 border rounded-xl bg-card hover:bg-muted/20 transition-colors">
                    <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <IconBolt className="size-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{a.name}</span>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium capitalize", statusBadge(a.status))}>
                          {a.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span>{TRIGGER_LABELS[a.trigger_type] || a.trigger_type}</span>
                        <span>→</span>
                        <span>{a.actions.map((ac: any) => ACTION_LABELS[ac.type] || ac.type).join(", ")}</span>
                        {a.run_count > 0 && <span>· {a.run_count} runs</span>}
                        {a.last_run_at && <span>· Last: {new Date(a.last_run_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => router.push(`/automate/${a.id}`)}
                        className="size-8 rounded-lg hover:bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit">
                        <IconEdit className="size-4" />
                      </button>
                      <button onClick={() => toggleStatus(a)} disabled={togglingId === a.id}
                        className="size-8 rounded-lg hover:bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        title={a.status === "active" ? "Pause" : "Resume"}>
                        {togglingId === a.id
                          ? <IconLoader2 className="size-4 animate-spin" />
                          : a.status === "active"
                          ? <IconPlayerPause className="size-4" />
                          : <IconPlayerPlay className="size-4" />
                        }
                      </button>
                      <button onClick={() => deleteAutomation(a.id)} disabled={deletingId === a.id}
                        className="size-8 rounded-lg hover:bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                        {deletingId === a.id
                          ? <IconLoader2 className="size-4 animate-spin" />
                          : <IconTrash className="size-4" />
                        }
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Templates ─────────────────────────────────────────────── */}
        {tab === "templates" && (
          <div className="p-6 space-y-5">
            {/* Category filter */}
            <div className="flex items-center gap-2">
              {(["All", "Scaling", "Optimization", "Reporting"] as TemplateCategory[]).map(c => (
                <button key={c} onClick={() => setTemplateCategory(c)}
                  className={cn(
                    "px-4 py-1.5 text-sm rounded-full font-medium transition-colors",
                    templateCategory === c
                      ? "bg-foreground text-background"
                      : "hover:bg-muted/50 text-muted-foreground"
                  )}>
                  {c}
                </button>
              ))}
            </div>

            {/* Featured template */}
            {templateCategory === "All" && (() => {
              const featured = TEMPLATES.find(t => t.featured)
              if (!featured) return null
              const Icon = featured.icon
              return (
                <div className="relative border-2 border-violet-400 rounded-2xl p-5 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/10">
                  <div className="absolute top-3 left-5 flex items-center gap-1 text-xs font-bold text-violet-600 uppercase tracking-wide">
                    <IconStar className="size-3 fill-current" />FEATURED
                  </div>
                  <div className="mt-4 flex items-start gap-4">
                    <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0", featured.iconBg)}>
                      <Icon className={cn("size-5", featured.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{featured.name}</h3>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 font-medium">
                          {featured.category}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{featured.description}</p>
                      <div className="flex items-center gap-3 mt-3">
                        <AppChain chain={(featured as any).appChain ?? ["meta", "notification"]} steps={featured.steps} />
                        {(featured as any).fbLive && (
                          <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 font-medium">
                            <span className="size-1.5 rounded-full bg-green-500 inline-block" />Live on Meta
                          </span>
                        )}
                        <Button size="sm" onClick={() => useTemplate(featured)} className="ml-auto h-7 text-xs">
                          Use Template
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Template grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTemplates.filter(t => !t.featured || templateCategory !== "All").map(t => {
                const Icon = t.icon
                const isLive = !!(t as any).fbLive
                const isSoon = !!(t as any).comingSoon
                return (
                  <div key={t.id} className="border rounded-xl p-4 bg-card hover:shadow-sm transition-shadow relative cursor-pointer" onClick={() => useTemplate(t)}>
                    <div className="flex items-start gap-3 mb-3">
                      <div className={cn("size-9 rounded-lg flex items-center justify-center shrink-0", t.iconBg)}>
                        <Icon className={cn("size-4.5", t.iconColor)} />
                      </div>
                      <div className="min-w-0 pr-20">
                        <h3 className="text-sm font-medium leading-tight">{t.name}</h3>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium mt-1 inline-block",
                          t.category === "Scaling" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" :
                          t.category === "Optimization" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" :
                          "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400")}>
                          {t.category}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">{t.description}</p>
                    <div className="flex items-center justify-between">
                      <AppChain chain={(t as any).appChain ?? ["meta", "meta"]} steps={t.steps} />
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={e => { e.stopPropagation(); useTemplate(t) }}>
                        Use
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Active ────────────────────────────────────────────────── */}
        {tab === "active" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <IconBolt className="size-5 text-green-500" />Active Automations
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Recurring rules and pending delayed executions</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchAutomations}>
                <IconRefresh className={cn("size-3.5", loading && "animate-spin")} />Refresh
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-40">
                <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeAutos.length === 0 ? (
              <div className="border rounded-2xl p-12 flex flex-col items-center text-center">
                <div className="size-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <IconClockHour4 className="size-7 text-muted-foreground/50" />
                </div>
                <h3 className="font-medium">No Active Automations</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  Recurring automations and pending delayed executions will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeAutos.map(a => (
                  <div key={a.id} className="flex items-center gap-4 px-4 py-3 border rounded-xl bg-card">
                    <div className="size-2 rounded-full bg-green-500 shrink-0 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{a.name}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {TRIGGER_LABELS[a.trigger_type]} · {a.run_count} runs
                        {a.last_run_at && ` · Last run ${fmtDate(a.last_run_at)}`}
                      </p>
                    </div>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 font-medium">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Approvals ─────────────────────────────────────────────── */}
        {tab === "approvals" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <IconCircleCheck className="size-5 text-amber-500" />Pending Approvals
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Review and approve automation requests before they execute</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchApprovals}>
                <IconRefresh className={cn("size-3.5", approvalsLoading && "animate-spin")} />Refresh
              </Button>
            </div>

            {approvalsLoading ? (
              <div className="flex items-center justify-center h-40">
                <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : approvals.length === 0 ? (
              <div className="border rounded-2xl p-12 flex flex-col items-center text-center">
                <div className="size-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <IconClockHour4 className="size-7 text-muted-foreground/50" />
                </div>
                <h3 className="font-medium">No Pending Approvals</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  When automations with approval steps are triggered, they will appear here for review.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {approvals.map(ap => (
                  <div key={ap.id} className="border rounded-xl p-4 bg-card">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">{ap.automation_name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{ap.requested_action}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(ap.created_at)}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                          onClick={() => handleApprove(ap.id, "rejected")}>
                          <IconX className="size-3" />Reject
                        </Button>
                        <Button size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprove(ap.id, "approved")}>
                          <IconCheck className="size-3" />Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Notifications ─────────────────────────────────────────── */}
        {tab === "notifications" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <IconBell className="size-5 text-blue-500" />Notifications & Approvals
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                  <input value={notifSearch} onChange={e => setNotifSearch(e.target.value)}
                    placeholder="Search by name, event, recipient..."
                    className="pl-9 pr-3 py-1.5 text-sm border rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <IconRefresh className="size-3.5" />Refresh
                </Button>
              </div>
            </div>
            <div className="border rounded-2xl p-12 flex flex-col items-center text-center">
              <div className="size-14 rounded-2xl bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center mb-4">
                <IconBell className="size-7 text-blue-400" />
              </div>
              <h3 className="font-medium">No notification history</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Notification deliveries and approval events will appear here.
              </p>
            </div>
          </div>
        )}

        {/* ── History ───────────────────────────────────────────────── */}
        {tab === "history" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <IconHistory className="size-5 text-muted-foreground" />Execution History
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                  <input value={histSearch} onChange={e => setHistSearch(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && fetchHistory()}
                    placeholder="Search by name, action, ID..."
                    className="pl-9 pr-3 py-1.5 text-sm border rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchHistory}>
                  <IconRefresh className={cn("size-3.5", histLoading && "animate-spin")} />Refresh
                </Button>
              </div>
            </div>

            {histLoading ? (
              <div className="flex items-center justify-center h-40">
                <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : execHistory.length === 0 ? (
              <div className="border rounded-2xl p-12 flex flex-col items-center text-center">
                <div className="size-14 rounded-2xl bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center mb-4">
                  <IconHistory className="size-7 text-amber-400" />
                </div>
                <h3 className="font-medium">No execution history</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  Automations that have been executed will appear here.
                </p>
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <div className="grid text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 bg-muted/30 px-4 py-2 border-b"
                  style={{ gridTemplateColumns: "1fr 80px 80px 1fr 160px" }}>
                  <span>Automation</span>
                  <span>Entities</span>
                  <span>API Calls</span>
                  <span>Action Taken</span>
                  <span>Executed</span>
                </div>
                {execHistory.map(h => (
                  <div key={h.id} className="grid items-center px-4 py-3 border-b last:border-0 hover:bg-muted/20 transition-colors"
                    style={{ gridTemplateColumns: "1fr 80px 80px 1fr 160px" }}>
                    <div>
                      <p className="text-sm font-medium truncate">{h.automation_name}</p>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium capitalize", execStatusBadge(h.status))}>
                        {h.status}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">{h.entities_affected}</span>
                    <span className="text-sm text-muted-foreground">{h.api_calls}</span>
                    <span className="text-xs text-muted-foreground truncate pr-2">{h.action_taken || "—"}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(h.executed_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create automation modal (DB) */}
      <CreateAutomationModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setSelectedTemplate(null) }}
        onCreated={a => setAutomations(prev => [a, ...prev])}
        adAccounts={adAccounts}
        template={selectedTemplate}
      />

      {/* Create Facebook live rule modal */}
      <CreateFbRuleModal
        open={fbRuleOpen}
        onClose={() => { setFbRuleOpen(false); setFbRuleTemplate(null) }}
        template={fbRuleTemplate}
        adAccounts={adAccounts}
      />
    </div>
  )
}
