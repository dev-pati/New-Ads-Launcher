"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useAdAccount } from "@/lib/ad-account-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  IconBolt, IconPlus, IconSearch, IconRefresh, IconLoader2, IconX,
  IconCalendar, IconClock, IconTrash,
  IconAlertCircle, IconHistory, IconInfoCircle, IconMapPin,
  IconArrowUp, IconArrowDown, IconEqual, IconBuildingStore, IconChevronDown,
  IconSettings, IconUsers, IconCheckbox, IconTargetArrow,
} from "@tabler/icons-react"
import { ruleToDraft, type RuleDraft } from "@/lib/meta-ad-rules"
import { RuleFormDialog } from "./_components/rule-form-dialog"
import { RulePreviewDialog } from "./_components/rule-preview-dialog"
import { RulesTable, type RuleRow, type RuleSummary } from "./_components/rules-table"
import { DismissibleNotice } from "./_components/dismissible-notice"

// ─── Types ─────────────────────────────────────────────────────────────────────

type RulesTab = "custom" | "history" | "budget"
type ChangeType = "absolute" | "percentage_increase" | "percentage_decrease"

interface RuleHistoryEntry {
  id?: string
  rule_id: string
  rule_name: string
  timestamp?: string
  is_manual?: boolean
  entities: { id: string; name?: string; type?: string }[]
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

type AdAccountOption = {
  id: string
  account_id?: string
  name: string
  owner_business?: { id: string; name?: string }
}

function initials(name?: string) {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?"
}

function AdAccountSelector({
  accounts, value, onChange,
}: {
  accounts: AdAccountOption[]
  value: string
  onChange: (next: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selected = accounts.find(a => a.account_id === value || a.id === value)
  const groups = Array.from(new Map(accounts.map(a => {
    const business = a.owner_business?.name || "Individual accounts"
    return [business, accounts.filter(x => (x.owner_business?.name || "Individual accounts") === business)] as const
  })).entries())
  const [activeGroup, setActiveGroup] = useState(groups[0]?.[0] || "")
  const filtered = (groups.find(([name]) => name === (activeGroup || groups[0]?.[0]))?.[1] || accounts)
    .filter(a => `${a.name} ${a.account_id || a.id} ${a.owner_business?.name || ""}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex max-w-[320px] items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm shadow-sm hover:bg-muted/40"
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
          {initials(selected?.name)}
        </span>
        <span className="min-w-0 truncate">{selected?.name || "Select ad account"}</span>
        <IconChevronDown className="size-4 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-40 w-[640px] max-w-[calc(100vw-2rem)] rounded-xl border bg-background shadow-2xl">
            <div className="border-b p-3">
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search for an ad account"
                  className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <div className="grid max-h-[420px] grid-cols-[240px_1fr] overflow-hidden">
              <div className="border-r bg-muted/30 p-3">
                <p className="mb-2 flex items-center gap-1 text-sm font-semibold">
                  Business portfolios <IconInfoCircle className="size-3.5 text-muted-foreground" />
                </p>
                <div className="space-y-1">
                  {groups.map(([name, list]) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setActiveGroup(name)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-background",
                        (activeGroup || groups[0]?.[0]) === name && "bg-background shadow-sm"
                      )}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-300 text-xs font-bold text-slate-700">
                        {initials(name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{name}</span>
                        <span className="block text-xs text-muted-foreground">{list.length} ad accounts</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-y-auto p-4">
                <p className="mb-3 text-sm font-semibold">{activeGroup || groups[0]?.[0] || "Ad accounts"}</p>
                <div className="space-y-1">
                  {filtered.map(a => {
                    const id = a.account_id || a.id
                    const isSelected = selected?.id === a.id
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => { onChange(id); setOpen(false) }}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted"
                      >
                        <span className={cn("size-4 rounded-full border", isSelected ? "border-primary bg-primary" : "border-muted-foreground/30")} />
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {initials(a.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{a.name}</span>
                          <span className="block text-xs text-muted-foreground">Ad account ID: {id}</span>
                          {a.owner_business?.name && (
                            <span className="mt-0.5 inline-flex rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Owned by {a.owner_business.name}
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                  {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No accounts match.</p>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function AutoApplyDialog({ accountName, accountId, onClose }: { accountName?: string; accountId?: string; onClose: () => void }) {
  const rows = [
    ["Campaign structure", "Ad sets may be combined or ads that are underperforming could be turned off."],
    ["Audience", "Targeting settings may be adjusted to reach more people who might be interested in your ads."],
    ["Creative and format", "Ad creative may be enhanced across media, text, and format."],
    ["Delivery and engagement", "Placements may be added or removed. Settings for outcomes may be adjusted."],
  ] as const
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl border bg-background shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Auto-apply</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ad account: {accountName || accountId || "—"}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><IconX className="size-5" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5 space-y-5">
          <label className="flex items-center gap-2 text-sm">
            <span className="relative h-5 w-9 rounded-full bg-muted-foreground/30"><span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow" /></span>
            Auto-apply
          </label>
          <p className="text-sm text-muted-foreground">
            Automatically apply Meta recommendations when there&apos;s a chance to improve performance.
            AdLauncher does not run a separate engine for this slice; Meta owns execution.
          </p>
          {rows.map(([title, copy]) => (
            <div key={title} className="flex items-center gap-4 border-b pb-4 last:border-b-0">
              <input type="checkbox" className="size-4 accent-primary" />
              <span className="flex size-12 items-center justify-center rounded-full bg-muted text-primary"><IconTargetArrow className="size-6" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground">{copy}</p>
              </div>
              <IconChevronDown className="size-5 text-muted-foreground" />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled>Save</Button>
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
  const [rules, setRules] = useState<RuleRow[]>([])
  const [ruleSummary, setRuleSummary] = useState<Record<string, RuleSummary>>({})
  const [rulesLoading, setRulesLoading] = useState(false)
  const [rulesError, setRulesError] = useState("")
  const [rulesSearch, setRulesSearch] = useState("")
  const [busyRuleId, setBusyRuleId] = useState<string | null>(null)

  // Dialog state — one form serves create and edit; `editing` decides which
  const [formOpen, setFormOpen] = useState(false)
  const [autoApplyOpen, setAutoApplyOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | undefined>()
  const [formInitial, setFormInitial] = useState<Partial<RuleDraft> | null>(null)
  const [previewRule, setPreviewRule] = useState<RuleRow | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<RuleRow | null>(null)

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

  // "Rule results" comes from history, not from the rule object — a separate, slower call,
  // so the table renders first and fills the column in when it lands.
  const fetchRuleSummary = useCallback(async () => {
    if (!accountId) return
    try {
      const res = await fetch(`/api/facebook/rules/history?adAccountId=${normAccountId}`)
      const d = await res.json()
      if (res.ok) setRuleSummary(d.summary || {})
    } catch { /* the column falls back to "Never" */ }
  }, [accountId, normAccountId])

  useEffect(() => {
    if (tab === "custom" && accountId) { fetchRules(); fetchRuleSummary() }
  }, [tab, accountId, fetchRules, fetchRuleSummary])

  const filteredRules = rules.filter(r =>
    !rulesSearch ||
    r.name.toLowerCase().includes(rulesSearch.toLowerCase()) ||
    r.conditionText.toLowerCase().includes(rulesSearch.toLowerCase())
  )

  function openCreate() {
    setEditingId(undefined); setFormInitial(null); setFormOpen(true)
  }
  function openEdit(rule: RuleRow) {
    setEditingId(rule.id); setFormInitial(ruleToDraft(rule.raw ?? rule)); setFormOpen(true)
  }
  function openDuplicate(rule: RuleRow) {
    const draft = ruleToDraft(rule.raw ?? rule)
    setEditingId(undefined)
    setFormInitial({ ...draft, name: `${draft.name} (copy)` })
    setFormOpen(true)
  }

  async function toggleRule(rule: RuleRow, next: boolean) {
    setBusyRuleId(rule.id); setRulesError("")
    try {
      const res = await fetch(`/api/facebook/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adAccountId: normAccountId,
          statusOnly: true,
          status: next ? "ENABLED" : "DISABLED",
        }),
      })
      const d = await res.json()
      if (!res.ok) { setRulesError(d.error || "Failed to change rule status"); return }
      setRules(rs => rs.map(r =>
        r.id === rule.id
          // hasIssues has to be cleared too — Meta answered the status write, so whatever
          // it was complaining about is no longer what this row says.
          ? { ...r, enabled: next, hasIssues: false, status: next ? "ENABLED" : "DISABLED" }
          : r
      ))
    } catch (e: any) { setRulesError(e.message) }
    finally { setBusyRuleId(null) }
  }

  async function deleteRule(rule: RuleRow) {
    setBusyRuleId(rule.id); setRulesError("")
    try {
      const res = await fetch(`/api/facebook/rules/${rule.id}?adAccountId=${normAccountId}`, {
        method: "DELETE",
      })
      const d = await res.json()
      if (!res.ok) { setRulesError(d.error || "Failed to delete rule"); return }
      setRules(rs => rs.filter(r => r.id !== rule.id))
      setConfirmDelete(null)
    } catch (e: any) { setRulesError(e.message) }
    finally { setBusyRuleId(null) }
  }

  // ── Rule History tab ──────────────────────────────────────────────────────────
  const [history, setHistory] = useState<RuleHistoryEntry[]>([])
  const [historyRules, setHistoryRules] = useState<{ id: string; name: string }[]>([])
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
          {adAccounts.length === 0 ? (
            <span className="text-sm text-muted-foreground">No accounts</span>
          ) : (
            <AdAccountSelector accounts={adAccounts} value={accountId} onChange={setAccountId} />
          )}
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
          <div className="p-6 space-y-4">
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => { fetchRules(); fetchRuleSummary() }}
                disabled={rulesLoading}
              >
                <IconRefresh className={cn("size-4", rulesLoading && "animate-spin")} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAutoApplyOpen(true)}>
                <IconSettings className="size-4 mr-1" /> Manage auto-apply
              </Button>
              <Button size="sm" onClick={openCreate}>
                <IconPlus className="size-4 mr-1" /> Create Rule
              </Button>
            </div>

            {/* Explanation, read once — dismissing it is permanent */}
            <DismissibleNotice
              id="meta-owns-these-rules"
              tone="info"
              icon={<IconInfoCircle className="size-4 flex-shrink-0 mt-0.5" />}
            >
              These are Meta&apos;s own automated rules — Meta stores and runs them, so anything
              you change here appears in Ads Manager too. Rule times are Pacific Time on Meta&apos;s side.
            </DismissibleNotice>

            {/* Dead rules are the failure this page exists to make visible (trap T7) */}
            {(() => {
              const broken = filteredRules.filter(r => r.hasIssues).length
              const dead = filteredRules.filter(r => !r.enabled && !r.hasIssues).length
              if (!dead && !broken) return null
              return (
                <DismissibleNotice
                  id="rules-not-running"
                  // Closing this says "I know about these N". If N grows it is news again.
                  level={dead + broken}
                  tone="warn"
                  icon={<IconAlertCircle className="size-4 flex-shrink-0 mt-0.5" />}
                >
                  {/* Built as strings, not JSX text: JSX trims every line of a multi-line
                      literal, which silently eats the space next to an interpolation. */}
                  {[
                    dead > 0 &&
                      `${dead} ${dead === 1 ? "rule is" : "rules are"} turned off and not being checked. A disabled rule protects nothing.`,
                    broken > 0 &&
                      `${broken} ${broken === 1 ? "rule has" : "rules have"} issues on Meta's side — the switch is on but Meta cannot run ${broken === 1 ? "it" : "them"}. Open the rule in Ads Manager to see why.`,
                  ].filter(Boolean).join(" ")}
                </DismissibleNotice>
              )
            })()}

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
              <RulesTable
                rules={filteredRules}
                summary={ruleSummary}
                busyId={busyRuleId}
                accountId={normAccountId}
                onToggle={toggleRule}
                onPreview={setPreviewRule}
                onEdit={openEdit}
                onDuplicate={openDuplicate}
                onDelete={setConfirmDelete}
              />
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
          <div className="p-6 space-y-4">
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
                <table data-table="comfortable" className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 font-medium text-muted-foreground">Rule</th>
                      <th className="text-left px-3 font-medium text-muted-foreground">What it changed</th>
                      <th className="text-right px-3 font-medium text-muted-foreground">Entities</th>
                      <th className="text-left px-3 font-medium text-muted-foreground">Trigger</th>
                      <th className="text-left px-3 font-medium text-muted-foreground">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredHistory.map((h, idx) => (
                      <tr key={`${h.rule_id}-${h.id ?? idx}`} className="hover:bg-muted/30 transition-colors align-top">
                        <td className="px-3">
                          <div className="font-medium">{h.rule_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{h.rule_id}</div>
                        </td>
                        {/* Named entities, so "who turned my ad off?" is answerable here */}
                        <td className="px-3 max-w-[380px]">
                          <div className="space-y-0.5">
                            {h.entities.slice(0, 4).map(e => (
                              <div key={e.id} className="text-xs truncate">
                                <span className="text-muted-foreground">{e.type || "entity"}:</span> {e.name || e.id}
                              </div>
                            ))}
                            {h.entities.length > 4 && (
                              <div className="text-xs text-muted-foreground">
                                +{h.entities.length - 4} more
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 text-right tabular-nums">{h.entities.length}</td>
                        <td className="px-3 text-xs text-muted-foreground">
                          {h.is_manual ? "Run manually" : "Scheduled"}
                        </td>
                        <td className="px-3 text-muted-foreground text-xs">{fmtDate(h.timestamp)}</td>
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

      <RuleFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        adAccountId={normAccountId}
        initial={formInitial}
        ruleId={editingId}
        onSaved={() => { fetchRules(); fetchRuleSummary() }}
      />

      {previewRule && (
        <RulePreviewDialog
          open
          onClose={() => setPreviewRule(null)}
          ruleId={previewRule.id}
          ruleName={previewRule.name}
          actionLabel={previewRule.actionLabel}
          conditionText={previewRule.conditionText}
          adAccountId={normAccountId}
          onExecuted={() => { fetchRules(); fetchRuleSummary() }}
        />
      )}

      {/* Delete confirm — Meta has no undo, so the count is stated before the button */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-background rounded-xl shadow-2xl border w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">Delete rule</h2>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <p>
                Delete <span className="font-medium">{confirmDelete.name}</span> from Meta?
              </p>
              <p className="text-muted-foreground">
                {confirmDelete.actionLabel} — {confirmDelete.conditionText}
              </p>
              <p className="text-muted-foreground">
                This removes the rule in Ads Manager too. Entities it already changed stay as they are.
              </p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deleteRule(confirmDelete)}
                disabled={busyRuleId === confirmDelete.id}
              >
                {busyRuleId === confirmDelete.id
                  ? <IconLoader2 className="size-4 animate-spin mr-1" />
                  : <IconTrash className="size-4 mr-1" />}
                Delete rule
              </Button>
            </div>
          </div>
        </div>
      )}

      {autoApplyOpen && (
        <AutoApplyDialog
          accountName={selectedAccount?.name}
          accountId={normAccountId}
          onClose={() => setAutoApplyOpen(false)}
        />
      )}
    </div>
  )
}
