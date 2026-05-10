"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useAdAccount } from "@/lib/ad-account-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  IconBolt, IconPlus, IconSearch, IconRefresh, IconLoader2, IconX,
  IconCheck, IconChevronDown, IconExternalLink, IconCalendar,
  IconClock, IconTrash, IconAlertCircle, IconHistory, IconEdit,
  IconSettings, IconChartBar, IconInfoCircle, IconMapPin,
  IconArrowUp, IconArrowDown, IconEqual, IconFilter,
} from "@tabler/icons-react"

// ─── Types ─────────────────────────────────────────────────────────────────────

type RulesTab = "custom" | "history" | "budget"
type ChangeType = "absolute" | "percentage_increase" | "percentage_decrease"

interface FbRule {
  id: string
  name: string
  status: "ENABLED" | "DISABLED" | "DELETED"
  schedule_spec?: { schedule_type: string }
  trigger_subscriptions?: { type: string }[]
  actions?: { type: string; value?: string }[]
  evaluation_spec?: {
    filters?: { field: string; value: string; operator: string }[]
    schedule_spec?: { schedule_type: string }
  }
  created_time?: string
}

interface RuleHistoryEntry {
  id: string
  rule_id: string
  rule_name: string
  rule_status: string
  results?: string
  is_applicable?: boolean
  timestamp_start?: string
  timestamp_stop?: string
  error_code?: number
  num_entity_affected?: number
  num_api_call?: number
}

interface BudgetSchedule {
  id: string
  ad_account_id: string
  adset_id: string
  adset_name?: string
  rule_name: string
  change_type: ChangeType
  new_budget?: number
  percentage?: number
  scheduled_at: string
  timezone: string
  status: "active" | "executed" | "cancelled" | "failed"
  executed_at?: string
  error_message?: string
  created_at: string
}

interface AdSet {
  id: string
  name: string
  daily_budget?: number
  lifetime_budget?: number
  status?: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function ruleBadge(status: string) {
  if (status === "ENABLED") return "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
  if (status === "DISABLED") return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
  return "bg-muted text-muted-foreground"
}

function scheduleBadge(status: string) {
  if (status === "active") return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
  if (status === "executed") return "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
  if (status === "cancelled") return "bg-muted text-muted-foreground"
  if (status === "failed") return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
  return "bg-muted text-muted-foreground"
}

function fmtDate(d?: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function fmtBudget(v?: number) {
  if (v == null) return "—"
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function localTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return "UTC" }
}

// ─── Create Rule Modal ─────────────────────────────────────────────────────────

const FB_RULE_FIELDS = [
  { value: "spent_today", label: "Spend Today ($)" },
  { value: "spend", label: "Total Spend ($)" },
  { value: "cpc", label: "CPC ($)" },
  { value: "cpm", label: "CPM ($)" },
  { value: "ctr", label: "CTR (%)" },
  { value: "roas", label: "ROAS" },
  { value: "impressions", label: "Impressions" },
  { value: "frequency", label: "Frequency" },
  { value: "cost_per_result", label: "Cost per Result ($)" },
  { value: "results", label: "Results" },
]

const FB_OPERATORS = [
  { value: "GREATER_THAN", label: ">" },
  { value: "LESS_THAN", label: "<" },
  { value: "EQUAL", label: "=" },
  { value: "NOT_EQUAL", label: "≠" },
  { value: "GREATER_THAN_OR_EQUAL_TO", label: "≥" },
  { value: "LESS_THAN_OR_EQUAL_TO", label: "≤" },
]

const FB_ACTIONS = [
  { value: "PAUSE_AD", label: "Pause Ad" },
  { value: "PAUSE_ADSET", label: "Pause Ad Set" },
  { value: "PAUSE_CAMPAIGN", label: "Pause Campaign" },
  { value: "TURN_ON_AD", label: "Turn On Ad" },
  { value: "TURN_ON_ADSET", label: "Turn On Ad Set" },
  { value: "TURN_ON_CAMPAIGN", label: "Turn On Campaign" },
  { value: "INCREASE_DAILY_BUDGET", label: "Increase Daily Budget" },
  { value: "DECREASE_DAILY_BUDGET", label: "Decrease Daily Budget" },
  { value: "INCREASE_LIFETIME_BUDGET", label: "Increase Lifetime Budget" },
  { value: "DECREASE_LIFETIME_BUDGET", label: "Decrease Lifetime Budget" },
  { value: "SEND_NOTIFICATION", label: "Send Notification" },
]

const FB_SCHEDULES = [
  { value: "SEMI_HOURLY", label: "Every 30 minutes" },
  { value: "HOURLY", label: "Every hour" },
  { value: "EVERY_12_HOURS", label: "Every 12 hours" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
]

interface Condition { field: string; operator: string; value: string }

function CreateRuleModal({
  open, onClose, adAccountId, token, onCreated,
}: {
  open: boolean
  onClose: () => void
  adAccountId: string
  token?: string
  onCreated: () => void
}) {
  const [name, setName] = useState("")
  const [conditions, setConditions] = useState<Condition[]>([{ field: "cpc", operator: "GREATER_THAN", value: "2" }])
  const [action, setAction] = useState("PAUSE_AD")
  const [actionValue, setActionValue] = useState("")
  const [schedule, setSchedule] = useState("DAILY")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function addCondition() {
    setConditions(c => [...c, { field: "cpc", operator: "GREATER_THAN", value: "1" }])
  }
  function removeCondition(i: number) {
    setConditions(c => c.filter((_, idx) => idx !== i))
  }
  function updateCondition(i: number, key: keyof Condition, val: string) {
    setConditions(c => c.map((item, idx) => idx === i ? { ...item, [key]: val } : item))
  }

  const needsValue = action.includes("BUDGET")

  async function handleCreate() {
    if (!name.trim()) { setError("Rule name required"); return }
    if (!adAccountId) { setError("Select an ad account"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/facebook/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adAccountId,
          name: name.trim(),
          conditions,
          action: { type: action, value: needsValue ? actionValue : undefined },
          schedule: { type: schedule, count: 1 },
        }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error || "Failed"); return }
      onCreated()
      onClose()
      setName(""); setConditions([{ field: "cpc", operator: "GREATER_THAN", value: "2" }])
      setAction("PAUSE_AD"); setActionValue(""); setSchedule("DAILY")
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-xl shadow-2xl border w-full max-w-xl mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-lg">Create Automation Rule</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><IconX className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Rule Name */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Rule Name</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              placeholder="e.g. Pause high CPC ads"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Conditions</label>
              <button onClick={addCondition} className="text-xs text-primary hover:underline flex items-center gap-1">
                <IconPlus className="size-3.5" /> Add condition
              </button>
            </div>
            <div className="space-y-2">
              {conditions.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    className="flex-1 border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                    value={c.field}
                    onChange={e => updateCondition(i, "field", e.target.value)}
                  >
                    {FB_RULE_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <select
                    className="border rounded-lg px-2 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                    value={c.operator}
                    onChange={e => updateCondition(i, "operator", e.target.value)}
                  >
                    {FB_OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input
                    type="number"
                    className="w-24 border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                    value={c.value}
                    onChange={e => updateCondition(i, "value", e.target.value)}
                  />
                  {conditions.length > 1 && (
                    <button onClick={() => removeCondition(i)} className="text-muted-foreground hover:text-red-500">
                      <IconX className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Action</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              value={action}
              onChange={e => setAction(e.target.value)}
            >
              {FB_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
            {needsValue && (
              <div className="mt-2">
                <label className="text-xs text-muted-foreground mb-1 block">Budget change amount (%)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  placeholder="e.g. 20"
                  value={actionValue}
                  onChange={e => setActionValue(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Schedule */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Run Frequency</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              value={schedule}
              onChange={e => setSchedule(e.target.value)}
            >
              {FB_SCHEDULES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
              <IconAlertCircle className="size-4 flex-shrink-0" />{error}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? <IconLoader2 className="size-4 animate-spin mr-1" /> : <IconCheck className="size-4 mr-1" />}
            Create Rule
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function RulesPage() {
  const { adAccounts, selectedAccountId } = useAdAccount()
  const [tab, setTab] = useState<RulesTab>("custom")

  // Account selection
  const [accountId, setAccountId] = useState<string>("")
  useEffect(() => {
    if (!accountId && adAccounts.length > 0) {
      setAccountId(selectedAccountId || adAccounts[0].account_id || "")
    }
  }, [adAccounts, selectedAccountId, accountId])

  const selectedAccount = adAccounts.find(a =>
    a.account_id === accountId || a.id === accountId
  )
  const normAccountId = accountId.startsWith("act_") ? accountId : accountId ? `act_${accountId}` : ""

  // ── Custom Rules tab ──────────────────────────────────────────────────────────
  const [rules, setRules] = useState<FbRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [rulesError, setRulesError] = useState("")
  const [showCreateRule, setShowCreateRule] = useState(false)
  const [rulesSearch, setRulesSearch] = useState("")

  const fetchRules = useCallback(async () => {
    if (!accountId) return
    setRulesLoading(true); setRulesError("")
    try {
      const res = await fetch(`/api/facebook/rules?adAccountId=${normAccountId}`)
      const d = await res.json()
      if (!res.ok) { setRulesError(d.error || "Failed to load rules"); return }
      setRules(d.rules || [])
    } catch (e: any) { setRulesError(e.message) }
    finally { setRulesLoading(false) }
  }, [accountId, normAccountId])

  useEffect(() => { if (tab === "custom" && accountId) fetchRules() }, [tab, accountId, fetchRules])

  const filteredRules = rules.filter(r =>
    !rulesSearch || r.name.toLowerCase().includes(rulesSearch.toLowerCase())
  )

  // ── Rule History tab ──────────────────────────────────────────────────────────
  const [history, setHistory] = useState<RuleHistoryEntry[]>([])
  const [historyRules, setHistoryRules] = useState<FbRule[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState("")
  const [historySearch, setHistorySearch] = useState("")

  const fetchHistory = useCallback(async () => {
    if (!accountId) return
    setHistoryLoading(true); setHistoryError("")
    try {
      const res = await fetch(`/api/facebook/rules/history?adAccountId=${normAccountId}`)
      const d = await res.json()
      if (!res.ok) { setHistoryError(d.error || "Failed to load history"); return }
      setHistory(d.history || [])
      setHistoryRules(d.rules || [])
    } catch (e: any) { setHistoryError(e.message) }
    finally { setHistoryLoading(false) }
  }, [accountId, normAccountId])

  useEffect(() => { if (tab === "history" && accountId) fetchHistory() }, [tab, accountId, fetchHistory])

  const filteredHistory = history.filter(h =>
    !historySearch || h.rule_name?.toLowerCase().includes(historySearch.toLowerCase())
  )

  // ── Budget Scheduling tab ─────────────────────────────────────────────────────
  const [schedules, setSchedules] = useState<BudgetSchedule[]>([])
  const [schedulesLoading, setSchedulesLoading] = useState(false)
  const [schedulesError, setSchedulesError] = useState("")
  const userTz = localTimezone()

  // Form fields
  const [scheduleAccountId, setScheduleAccountId] = useState("")
  const [adsetSearch, setAdsetSearch] = useState("")
  const [adsets, setAdsets] = useState<AdSet[]>([])
  const [adsetsLoading, setAdsetsLoading] = useState(false)
  const [selectedAdset, setSelectedAdset] = useState<AdSet | null>(null)
  const [showAdsetDropdown, setShowAdsetDropdown] = useState(false)
  const [ruleName, setRuleName] = useState("")
  const [changeType, setChangeType] = useState<ChangeType>("absolute")
  const [newBudget, setNewBudget] = useState("")
  const [percentage, setPercentage] = useState("20")
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("09:00")
  const [scheduleTz, setScheduleTz] = useState(userTz)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [scheduleFormError, setScheduleFormError] = useState("")
  const adsetDropdownRef = useRef<HTMLDivElement>(null)

  const fetchSchedules = useCallback(async () => {
    setSchedulesLoading(true); setSchedulesError("")
    try {
      const res = await fetch(`/api/facebook/budget-schedules?adAccountId=${accountId}`)
      const d = await res.json()
      if (!res.ok) { setSchedulesError(d.error || "Failed"); return }
      setSchedules(d.schedules || [])
    } catch (e: any) { setSchedulesError(e.message) }
    finally { setSchedulesLoading(false) }
  }, [accountId])

  useEffect(() => { if (tab === "budget") fetchSchedules() }, [tab, fetchSchedules])

  useEffect(() => {
    if (!scheduleAccountId) setScheduleAccountId(accountId)
  }, [accountId, scheduleAccountId])

  const [allAdsets, setAllAdsets] = useState<AdSet[]>([])
  const [adsetsFetched, setAdsetsFetched] = useState(false)

  // Fetch all adsets for selected account (once per account change)
  useEffect(() => {
    if (!scheduleAccountId) return
    setAdsetsFetched(false)
    setAllAdsets([])
    setAdsetsLoading(true)
    const norm = scheduleAccountId.startsWith("act_") ? scheduleAccountId : `act_${scheduleAccountId}`
    fetch(`/api/facebook/adsets?ad_account_id=${norm}`)
      .then(r => r.json())
      .then(d => { setAllAdsets(d.adSets || []); setAdsetsFetched(true) })
      .catch(() => setAdsetsFetched(true))
      .finally(() => setAdsetsLoading(false))
  }, [scheduleAccountId])

  // Filter adsets by search
  useEffect(() => {
    if (!adsetSearch.trim()) { setAdsets(allAdsets.slice(0, 30)); return }
    const q = adsetSearch.toLowerCase()
    setAdsets(allAdsets.filter(a => a.name.toLowerCase().includes(q)).slice(0, 30))
  }, [adsetSearch, allAdsets])

  // Close adset dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (adsetDropdownRef.current && !adsetDropdownRef.current.contains(e.target as Node)) {
        setShowAdsetDropdown(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  async function handleCreateSchedule() {
    if (!scheduleAccountId) { setScheduleFormError("Select an ad account"); return }
    if (!selectedAdset) { setScheduleFormError("Select an ad set"); return }
    if (!ruleName.trim()) { setScheduleFormError("Rule name required"); return }
    if (!scheduledDate) { setScheduleFormError("Scheduled date required"); return }
    if (changeType === "absolute" && !newBudget) { setScheduleFormError("New budget required"); return }
    if (changeType !== "absolute" && !percentage) { setScheduleFormError("Percentage required"); return }

    setSavingSchedule(true); setScheduleFormError("")
    try {
      const scheduledAt = `${scheduledDate}T${scheduledTime}:00`
      const res = await fetch("/api/facebook/budget-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adAccountId: scheduleAccountId,
          adsetId: selectedAdset.id,
          adsetName: selectedAdset.name,
          ruleName: ruleName.trim(),
          changeType,
          newBudget: changeType === "absolute" ? newBudget : undefined,
          percentage: changeType !== "absolute" ? percentage : undefined,
          scheduledAt,
          timezone: scheduleTz,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setScheduleFormError(d.error || "Failed"); return }
      setSchedules(s => [d.schedule, ...s])
      setSelectedAdset(null); setAdsetSearch(""); setRuleName(""); setNewBudget("")
      setScheduledDate(""); setChangeType("absolute")
    } catch (e: any) { setScheduleFormError(e.message) }
    finally { setSavingSchedule(false) }
  }

  async function cancelSchedule(id: string) {
    try {
      await fetch("/api/facebook/budget-schedules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setSchedules(s => s.map(sc => sc.id === id ? { ...sc, status: "cancelled" } : sc))
    } catch {}
  }

  // ─── Account selector bar ──────────────────────────────────────────────────────
  const tabs: { key: RulesTab; label: string }[] = [
    { key: "custom", label: "Custom Rules" },
    { key: "history", label: "Rule History" },
    { key: "budget", label: "Budget Scheduling" },
  ]

  const metaRulesUrl = normAccountId
    ? `https://www.facebook.com/adsmanager/automation?act=${normAccountId.replace("act_", "")}`
    : "https://www.facebook.com/adsmanager/automation"

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="border-b bg-background/95 backdrop-blur px-6 py-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <IconBolt className="size-5 text-primary flex-shrink-0" />
          <h1 className="text-xl font-semibold">Rules</h1>
        </div>

        {/* Ad account selector */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-muted-foreground">Ad Account:</span>
          <select
            className="border rounded-lg px-3 py-1.5 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none max-w-[260px]"
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
          >
            {adAccounts.length === 0 && <option value="">No accounts</option>}
            {adAccounts.map(a => (
              <option key={a.id} value={a.account_id || a.id}>
                {a.name} ({a.account_id || a.id})
              </option>
            ))}
          </select>
          <a
            href={metaRulesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors border rounded-lg px-3 py-1.5"
          >
            <IconExternalLink className="size-4" /> View in Meta
          </a>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="border-b bg-background px-6 flex gap-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Custom Rules ─────────────────────────────────────────────────────── */}
        {tab === "custom" && (
          <div className="p-6 space-y-4 max-w-6xl">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  placeholder="Search rules..."
                  value={rulesSearch}
                  onChange={e => setRulesSearch(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" onClick={fetchRules} disabled={rulesLoading}>
                <IconRefresh className={cn("size-4", rulesLoading && "animate-spin")} />
              </Button>
              <Button size="sm" onClick={() => setShowCreateRule(true)}>
                <IconPlus className="size-4 mr-1" /> Create Rule
              </Button>
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 text-sm text-blue-700 dark:text-blue-400">
              <IconInfoCircle className="size-4 flex-shrink-0 mt-0.5" />
              <span>Rules are created and managed directly via the Facebook Ads API. Changes here sync with Meta Ads Manager in real time.</span>
            </div>

            {rulesError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
                <IconAlertCircle className="size-4 flex-shrink-0" />{rulesError}
              </div>
            )}

            {rulesLoading ? (
              <div className="flex items-center justify-center py-16">
                <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <IconBolt className="size-6 text-muted-foreground" />
                </div>
                <p className="font-medium">No rules found</p>
                <p className="text-sm text-muted-foreground mt-1">Create your first automation rule to get started.</p>
                {!accountId && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">Select an ad account above to load rules.</p>
                )}
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rule Name</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Schedule</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredRules.map(rule => {
                      const ruleActions = rule.actions || []
                      const schedType = rule.evaluation_spec?.schedule_spec?.schedule_type || rule.schedule_spec?.schedule_type
                      const schedLabel = FB_SCHEDULES.find(s => s.value === schedType)?.label || schedType || "—"
                      const actionLabel = FB_ACTIONS.find(a => a.value === ruleActions[0]?.type)?.label || ruleActions[0]?.type || "—"
                      return (
                        <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium">{rule.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{rule.id}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", ruleBadge(rule.status))}>
                              {rule.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{schedLabel}</td>
                          <td className="px-4 py-3 text-muted-foreground">{actionLabel}</td>
                          <td className="px-4 py-3 text-muted-foreground">{fmtDate(rule.created_time)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Rule count */}
            {filteredRules.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Showing {filteredRules.length} of {rules.length} rules
              </p>
            )}
          </div>
        )}

        {/* ── Rule History ──────────────────────────────────────────────────────── */}
        {tab === "history" && (
          <div className="p-6 space-y-4 max-w-6xl">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  placeholder="Search by rule name..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" onClick={fetchHistory} disabled={historyLoading}>
                <IconRefresh className={cn("size-4", historyLoading && "animate-spin")} />
              </Button>
            </div>

            {historyError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
                <IconAlertCircle className="size-4 flex-shrink-0" />{historyError}
              </div>
            )}

            {historyLoading ? (
              <div className="flex items-center justify-center py-16">
                <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <IconHistory className="size-6 text-muted-foreground" />
                </div>
                <p className="font-medium">No history found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {accountId ? "Rule execution history will appear here once rules have run." : "Select an ad account to view rule history."}
                </p>
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rule</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Entities Affected</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">API Calls</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Result</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Applicable</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Executed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredHistory.map((h, idx) => (
                      <tr key={`${h.rule_id}-${idx}`} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium">{h.rule_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{h.rule_id}</div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{h.num_entity_affected ?? "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{h.num_api_call ?? "—"}</td>
                        <td className="px-4 py-3">
                          {h.error_code ? (
                            <span className="text-red-600 dark:text-red-400 text-xs">Error {h.error_code}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">{h.results || "—"}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {h.is_applicable === true ? (
                            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-xs">
                              <IconCheck className="size-3.5" /> Yes
                            </span>
                          ) : h.is_applicable === false ? (
                            <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                              <IconX className="size-3.5" /> No
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(h.timestamp_stop)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {filteredHistory.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {filteredHistory.length} execution{filteredHistory.length !== 1 ? "s" : ""} across {historyRules.length} rule{historyRules.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        {/* ── Budget Scheduling ─────────────────────────────────────────────────── */}
        {tab === "budget" && (
          <div className="p-6 max-w-6xl space-y-6">
            {/* Timezone notice */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border text-sm text-muted-foreground">
              <IconMapPin className="size-4 flex-shrink-0" />
              <span>Your timezone: <strong className="text-foreground">{userTz}</strong></span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form */}
              <div className="border rounded-xl p-5 space-y-4">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <IconCalendar className="size-4 text-primary" /> Schedule Budget Change
                </h3>

                {/* Ad Account for schedule */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Ad Account</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                    value={scheduleAccountId}
                    onChange={e => { setScheduleAccountId(e.target.value); setSelectedAdset(null); setAdsetSearch("") }}
                  >
                    {adAccounts.map(a => (
                      <option key={a.id} value={a.account_id || a.id}>
                        {a.name} ({a.account_id || a.id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Adset search */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Ad Set</label>
                  <div className="relative" ref={adsetDropdownRef}>
                    {selectedAdset ? (
                      <div className="flex items-center justify-between border rounded-lg px-3 py-2 bg-muted/30">
                        <div>
                          <div className="text-sm font-medium">{selectedAdset.name}</div>
                          {(selectedAdset.daily_budget || selectedAdset.lifetime_budget) && (
                            <div className="text-xs text-muted-foreground">
                              Budget: {fmtBudget((selectedAdset.daily_budget || selectedAdset.lifetime_budget || 0) / 100)}
                            </div>
                          )}
                        </div>
                        <button onClick={() => { setSelectedAdset(null); setAdsetSearch("") }} className="text-muted-foreground hover:text-foreground">
                          <IconX className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <input
                          className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                          placeholder="Search ad sets..."
                          value={adsetSearch}
                          onChange={e => { setAdsetSearch(e.target.value); setShowAdsetDropdown(true) }}
                          onFocus={() => setShowAdsetDropdown(true)}
                        />
                        {adsetsLoading && (
                          <IconLoader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
                        )}
                        {showAdsetDropdown && adsets.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-20 bg-background border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                            {adsets.map(a => (
                              <button
                                key={a.id}
                                className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b last:border-b-0"
                                onClick={() => { setSelectedAdset(a); setShowAdsetDropdown(false); setAdsetSearch("") }}
                              >
                                <div className="text-sm font-medium">{a.name}</div>
                                {(a.daily_budget || a.lifetime_budget) && (
                                  <div className="text-xs text-muted-foreground">
                                    Budget: {fmtBudget((a.daily_budget || a.lifetime_budget || 0) / 100)}
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                        {showAdsetDropdown && adsetSearch.length > 0 && !adsetsLoading && adsets.length === 0 && (
                          <div className="absolute top-full left-0 right-0 z-20 bg-background border rounded-lg shadow-lg mt-1 px-3 py-3 text-sm text-muted-foreground">
                            No ad sets found
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Rule name */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Rule Name</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                    placeholder="e.g. Weekend budget boost"
                    value={ruleName}
                    onChange={e => setRuleName(e.target.value)}
                  />
                </div>

                {/* Change type */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Budget Change Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["absolute", "percentage_increase", "percentage_decrease"] as ChangeType[]).map(ct => {
                      const labels = { absolute: "Set Amount", percentage_increase: "% Increase", percentage_decrease: "% Decrease" }
                      const icons = { absolute: IconEqual, percentage_increase: IconArrowUp, percentage_decrease: IconArrowDown }
                      const Icon = icons[ct]
                      return (
                        <button
                          key={ct}
                          onClick={() => setChangeType(ct)}
                          className={cn(
                            "flex flex-col items-center gap-1 p-3 rounded-lg border text-xs font-medium transition-colors",
                            changeType === ct
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/50"
                          )}
                        >
                          <Icon className="size-4" />
                          {labels[ct]}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Budget value */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    {changeType === "absolute" ? "New Budget ($)" : "Change Percentage (%)"}
                  </label>
                  {changeType === "absolute" ? (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <input
                        type="number"
                        className="w-full pl-7 pr-4 py-2 border rounded-lg text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                        placeholder="e.g. 150.00"
                        value={newBudget}
                        onChange={e => setNewBudget(e.target.value)}
                        min="0"
                        step="0.01"
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="number"
                        className="w-full pr-8 pl-3 py-2 border rounded-lg text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                        placeholder="e.g. 20"
                        value={percentage}
                        onChange={e => setPercentage(e.target.value)}
                        min="1"
                        max="1000"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                    </div>
                  )}
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Scheduled Date</label>
                    <input
                      type="date"
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                      value={scheduledDate}
                      onChange={e => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Time</label>
                    <input
                      type="time"
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                      value={scheduledTime}
                      onChange={e => setScheduledTime(e.target.value)}
                    />
                  </div>
                </div>

                {/* Timezone */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Timezone</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                    value={scheduleTz}
                    onChange={e => setScheduleTz(e.target.value)}
                    placeholder="e.g. America/New_York"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Auto-detected from your browser.</p>
                </div>

                {scheduleFormError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
                    <IconAlertCircle className="size-4 flex-shrink-0" />{scheduleFormError}
                  </div>
                )}

                <Button className="w-full" onClick={handleCreateSchedule} disabled={savingSchedule}>
                  {savingSchedule
                    ? <><IconLoader2 className="size-4 animate-spin mr-2" />Scheduling...</>
                    : <><IconCalendar className="size-4 mr-2" />Schedule Budget Change</>
                  }
                </Button>
              </div>

              {/* Scheduled changes list */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    <IconClock className="size-4 text-primary" /> Scheduled Changes
                  </h3>
                  <Button variant="outline" size="sm" onClick={fetchSchedules} disabled={schedulesLoading}>
                    <IconRefresh className={cn("size-4", schedulesLoading && "animate-spin")} />
                  </Button>
                </div>

                {schedulesError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
                    <IconAlertCircle className="size-4 flex-shrink-0" />{schedulesError}
                  </div>
                )}

                {schedulesLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : schedules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center border rounded-xl bg-muted/20">
                    <IconCalendar className="size-8 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">No scheduled changes</p>
                    <p className="text-xs text-muted-foreground mt-1">Create a budget schedule using the form.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {schedules.map(sc => {
                      const changeLabel = {
                        absolute: `Set to ${fmtBudget(sc.new_budget)}`,
                        percentage_increase: `+${sc.percentage}%`,
                        percentage_decrease: `-${sc.percentage}%`,
                      }[sc.change_type]

                      return (
                        <div key={sc.id} className="border rounded-xl p-4 bg-background hover:shadow-sm transition-shadow">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{sc.rule_name}</span>
                                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", scheduleBadge(sc.status))}>
                                  {sc.status}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {sc.adset_name || sc.adset_id}
                              </p>
                              <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <IconCalendar className="size-3.5" />
                                  {fmtDate(sc.scheduled_at)}
                                </span>
                                <span className="flex items-center gap-1 font-medium text-foreground">
                                  {sc.change_type === "percentage_increase" ? <IconArrowUp className="size-3.5 text-green-500" /> :
                                   sc.change_type === "percentage_decrease" ? <IconArrowDown className="size-3.5 text-red-500" /> :
                                   <IconEqual className="size-3.5 text-blue-500" />}
                                  {changeLabel}
                                </span>
                                <span>{sc.timezone}</span>
                              </div>
                              {sc.error_message && (
                                <p className="text-xs text-red-500 mt-1">{sc.error_message}</p>
                              )}
                            </div>
                            {sc.status === "active" && (
                              <button
                                onClick={() => cancelSchedule(sc.id)}
                                className="text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0"
                                title="Cancel schedule"
                              >
                                <IconX className="size-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Rule Modal */}
      <CreateRuleModal
        open={showCreateRule}
        onClose={() => setShowCreateRule(false)}
        adAccountId={normAccountId}
        onCreated={() => { fetchRules() }}
      />
    </div>
  )
}
