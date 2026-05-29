"use client"

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from "react"
import { useRouter } from "next/navigation"
import { useAdAccount } from "@/lib/ad-account-context"
import { cn } from "@/lib/utils"
import {
  IconSearch, IconPlus, IconCopy, IconPencil, IconRefresh,
  IconLoader2, IconChevronDown, IconChevronLeft, IconChevronRight,
  IconTrash, IconSettings, IconCalendar, IconArrowsUpDown,
  IconArrowUp, IconArrowDown, IconHistory, IconTable, IconCheck,
  IconChevronRight as IconDrillRight,
  IconSpeakerphone, IconTarget, IconPhoto, IconExternalLink, IconClipboard, IconX,
} from "@tabler/icons-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CreateCampaignModal } from "@/components/ads-manager/create-flow/CreateCampaignModal"
import { CustomizeColumnsModal } from "@/components/ads-manager/CustomizeColumnsModal"
import { AdsDateRangePicker, getPresetRange } from "@/components/ads-manager/AdsDateRangePicker"
import { COLUMN_MAP, DEFAULT_PRESETS, ColumnPreset, getActivePreset } from "@/lib/column-config"
import { BreakdownDropdown } from "@/components/ads-manager/BreakdownDropdown"
import { BREAKDOWN_API_MAP } from "@/lib/breakdown-config"

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "campaigns" | "adsets" | "ads"
type SortDir = "asc" | "desc"

interface Insight {
  spend: string
  impressions: string
  clicks: string
  reach?: string
  actions?: { action_type: string; value: string }[]
  cost_per_action_type?: { action_type: string; value: string }[]
}

interface Campaign {
  id: string
  name: string
  status: string
  effective_status: string
  objective: string
  daily_budget?: string
  lifetime_budget?: string
  budget_remaining?: string
  start_time?: string
  stop_time?: string
  bid_strategy?: string
  insights?: { data: Insight[] }
}

interface AdSet {
  id: string
  name: string
  status: string
  effective_status: string
  campaign_id: string
  daily_budget?: string
  lifetime_budget?: string
  budget_remaining?: string
  optimization_goal?: string
  billing_event?: string
  bid_strategy?: string
  start_time?: string
  end_time?: string
  insights?: { data: Insight[] }
}

interface Ad {
  id: string
  name: string
  status: string
  effective_status: string
  adset_id: string
  campaign_id: string
  creative?: { id: string; title?: string; body?: string; image_url?: string; thumbnail_url?: string }
  insights?: { data: Insight[] }
}

interface BreakdownRow {
  parentId: string
  breakdownLabel: string
  ins: Insight
}

// ─── Constants ────────────────────────────────────────────────────────────────


const OBJECTIVE_RESULT: Record<string, { type: string; actionType: string }> = {
  OUTCOME_SALES: { type: "Purchases", actionType: "omni_purchase" },
  OUTCOME_LEADS: { type: "Leads", actionType: "lead" },
  OUTCOME_TRAFFIC: { type: "Link clicks", actionType: "link_click" },
  OUTCOME_ENGAGEMENT: { type: "Post engagements", actionType: "post_engagement" },
  OUTCOME_APP_PROMOTION: { type: "App installs", actionType: "mobile_app_install" },
  OUTCOME_AWARENESS: { type: "Reach", actionType: "reach" },
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBreakdownLabel(item: Record<string, string>, selectedIds: string[]): string {
  const allBdsFields: string[] = []
  let tiValue: string | null = null
  for (const id of selectedIds) {
    const param = BREAKDOWN_API_MAP[id]
    if (!param) continue
    const bdsM = param.match(/breakdowns=([^&]+)/)
    const tiM  = param.match(/time_increment=([^&]+)/)
    if (bdsM) allBdsFields.push(...bdsM[1].split(",").map(s => s.trim()))
    if (tiM) tiValue = tiM[1]
  }
  const parts: string[] = []
  if (tiValue && item.date_start) {
    parts.push(new Date(item.date_start + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }))
  }
  allBdsFields
    .map(f => item[f] ?? "")
    .filter(Boolean)
    .map(v => v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()))
    .forEach(v => parts.push(v))
  return parts.join(" / ") || "—"
}

function fmtBudget(cents?: string) {
  if (!cents) return "—"
  return `$${(parseInt(cents) / 100).toFixed(2)}`
}

function fmtDate(iso?: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function getInsight(item: Campaign | AdSet | Ad): Insight | null {
  return item.insights?.data?.[0] || null
}

function getSpend(item: Campaign | AdSet | Ad) {
  const ins = getInsight(item)
  if (!ins?.spend) return 0
  return parseFloat(ins.spend)
}

function getResults(item: Campaign | AdSet | Ad, objective?: string) {
  const ins = getInsight(item)
  if (!ins?.actions) return { count: 0, type: "Results" }
  const obj = OBJECTIVE_RESULT[objective || ""]
  if (!obj) return { count: parseInt(ins.actions[0]?.value || "0"), type: "Actions" }
  const action = ins.actions.find(a => a.action_type === obj.actionType)
  return { count: parseInt(action?.value || "0"), type: obj.type }
}

function getCostPerResult(item: Campaign | AdSet | Ad, objective?: string) {
  const ins = getInsight(item)
  if (!ins?.cost_per_action_type) return null
  const obj = OBJECTIVE_RESULT[objective || ""]
  if (!obj) return null
  const cpa = ins.cost_per_action_type.find(a => a.action_type === obj.actionType)
  if (!cpa) return null
  return `$${parseFloat(cpa.value).toFixed(2)}`
}

// ─── Status Toggle ────────────────────────────────────────────────────────────

function StatusToggle({ id, status, onToggle }: { id: string; status: string; onToggle: (id: string, newStatus: string) => void }) {
  const isActive = status === "ACTIVE"
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle(id, isActive ? "PAUSED" : "ACTIVE") }}
      className={cn(
        "relative inline-flex h-4 w-[30px] items-center rounded-full transition-colors shrink-0",
        isActive ? "bg-[#1877f2]" : "bg-[#bec3c9] dark:bg-gray-600"
      )}
      title={isActive ? "Click to pause" : "Click to activate"}
    >
      <span className={cn(
        "inline-block size-[14px] rounded-full bg-white shadow-sm transition-transform",
        isActive ? "translate-x-[14px]" : "translate-x-px"
      )} />
    </button>
  )
}

// ─── Delivery Badge ───────────────────────────────────────────────────────────

function DeliveryBadge({ effective_status, budget_remaining }: { effective_status: string; budget_remaining?: string }) {
  const isActive = effective_status === "ACTIVE"
  const isOutOfBudget = isActive && budget_remaining !== undefined && budget_remaining === "0"
  const remainingDollars = budget_remaining !== undefined ? (parseInt(budget_remaining) / 100).toFixed(2) : null
  return (
    <span className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1.5 text-[13px] text-[#1c2b33] dark:text-gray-300">
        <span className={cn("size-[7px] rounded-full shrink-0", isOutOfBudget ? "bg-[#f0a500]" : isActive ? "bg-[#31a24c]" : "bg-[#8a8d91]")} />
        {isActive ? "Active" : effective_status === "PAUSED" ? "Off" : effective_status.charAt(0) + effective_status.slice(1).toLowerCase()}
      </span>
      {isOutOfBudget && remainingDollars !== null && (
        <span className="text-[11px] text-[#f0a500] pl-3.5">${remainingDollars} remaining</span>
      )}
    </span>
  )
}

// ─── Sort Header ──────────────────────────────────────────────────────────────

function SortTh({ label, field, sortField, sortDir, onSort, className }: {
  label: string; field: string; sortField: string | null; sortDir: SortDir
  onSort: (f: string) => void; className?: string
}) {
  const active = sortField === field
  return (
    <th
      className={cn("px-3 py-2 text-left text-[13px] font-semibold text-[#65676b] dark:text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:bg-black/5 dark:hover:bg-white/5", className)}
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? (sortDir === "asc" ? <IconArrowUp className="size-3 text-[#1877f2]" /> : <IconArrowDown className="size-3 text-[#1877f2]" />)
          : <IconArrowsUpDown className="size-3 opacity-0 group-hover:opacity-50" />
        }
      </span>
    </th>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdsManagerPage() {
  const { selectedAccountId, selectedAccount, adAccounts, setSelectedAccountId } = useAdAccount()

  const [tab, setTab] = useState<Tab>("campaigns")
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [adSets, setAdSets] = useState<AdSet[]>([])
  const [ads, setAds] = useState<Ad[]>([])
  const [loading, setLoading] = useState(false)
  const [loadedMs, setLoadedMs] = useState<number | null>(null)
  const [error, setError] = useState("")

  // Hierarchical filter: checked campaigns → filters adsets; checked adsets → filters ads
  const [campaignFilter, setCampaignFilter] = useState<Set<string>>(new Set())
  const [adSetFilter, setAdSetFilter] = useState<Set<string>>(new Set())

  // Filters & search
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "ACTIVE" | "PAUSED">("all")
  const [datePreset,     setDatePreset]     = useState("last_7d")
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null)

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(30)
  const pageSizeRef = useRef<HTMLDivElement>(null)
  const [pageSizeOpen, setPageSizeOpen] = useState(false)
  const colsDropRef = useRef<HTMLDivElement>(null)

  // Sort
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Toggling status
  const [toggling, setToggling] = useState<Set<string>>(new Set())

  // Close dropdowns on outside click
  const [editingNode, setEditingNode] = useState<Campaign | AdSet | Ad | null>(null)
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null)
  const [inlineEditingName, setInlineEditingName] = useState("")
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [duplicateCount, setDuplicateCount] = useState(1)
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyBatches, setHistoryBatches] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [defaultsOpen, setDefaultsOpen] = useState(false)
  const [defaultPrimaryText, setDefaultPrimaryText] = useState("")
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [defaultHeadline, setDefaultHeadline] = useState("")
  const [defaultCta, setDefaultCta] = useState("SHOP_NOW")
  const [defaultLink, setDefaultLink] = useState("")
  const [columnOrder,       setColumnOrder]       = useState<string[]>(DEFAULT_PRESETS[1].columns)
  const [customPresets,     setCustomPresets]     = useState<ColumnPreset[]>([])
  const [colsOpen,          setColsOpen]          = useState(false)
  const [customizeColsOpen, setCustomizeColsOpen] = useState(false)
  const [breakdowns,        setBreakdowns]        = useState<string[]>([])
  const [breakdownRows,     setBreakdownRows]     = useState<BreakdownRow[]>([])
  const [breakdownError,    setBreakdownError]    = useState("")

  const router = useRouter()

  const DEFAULTS_KEY = `adsmanager_defaults_${selectedAccountId}`

  useEffect(() => {
    if (!selectedAccountId) return
    try {
      const raw = localStorage.getItem(DEFAULTS_KEY)
      if (raw) {
        const d = JSON.parse(raw)
        setDefaultPrimaryText(d.primaryText || "")
        setDefaultHeadline(d.headline || "")
        setDefaultCta(d.cta || "SHOP_NOW")
        setDefaultLink(d.link || "")
      }
    } catch {}
  }, [selectedAccountId])

  const saveDefaults = () => {
    const d = { primaryText: defaultPrimaryText, headline: defaultHeadline, cta: defaultCta, link: defaultLink }
    try { localStorage.setItem(DEFAULTS_KEY, JSON.stringify(d)) } catch {}
    setDefaultsOpen(false)
  }

  const fetchHistory = async () => {
    if (!selectedAccountId) return
    setHistoryLoading(true)
    try {
      const r = await fetch(`/api/launch-history?account_id=${encodeURIComponent(selectedAccountId)}&limit=30`)
      const d = await r.json()
      setHistoryBatches(d.batches || [])
    } catch {} finally { setHistoryLoading(false) }
  }

  // Load / save column state from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("adsmanager_col_order")
      if (raw) {
        const parsed = JSON.parse(raw) as string[]
        const valid = parsed.filter(id => id in COLUMN_MAP)
        if (valid.length > 0) setColumnOrder(valid)
      }
      const rawPresets = localStorage.getItem("adsmanager_col_presets")
      if (rawPresets) setCustomPresets(JSON.parse(rawPresets))
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem("adsmanager_col_order", JSON.stringify(columnOrder)) } catch {}
  }, [columnOrder])

  useEffect(() => {
    try { localStorage.setItem("adsmanager_col_presets", JSON.stringify(customPresets)) } catch {}
  }, [customPresets])

  const saveCustomPreset = (name: string, cols: string[]) => {
    setCustomPresets(prev => [
      ...prev.filter(p => p.label !== name),
      { id: `custom_${Date.now()}`, label: name, columns: cols },
    ])
  }

  // Close dropdowns on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (pageSizeRef.current && !pageSizeRef.current.contains(e.target as Node)) setPageSizeOpen(false)
      if (colsDropRef.current && !colsDropRef.current.contains(e.target as Node)) setColsOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  // ─── Data fetch (fetch all, filter client-side) ──────────────────────────────

  const buildDateParam = useCallback(() => {
    return datePreset === "custom" && customDateRange
      ? `time_range=${encodeURIComponent(JSON.stringify({
          since: customDateRange.start.toISOString().split("T")[0],
          until: customDateRange.end.toISOString().split("T")[0],
        }))}`
      : `date_preset=${datePreset}`
  }, [datePreset, customDateRange])

  // Fetches campaigns/adsets/ads only — `breakdowns` intentionally excluded from
  // deps so that toggling a breakdown never triggers a redundant main-data refetch.
  const fetchMainData = useCallback(async (forceRefresh = false) => {
    if (!selectedAccountId) return
    setLoading(true)
    setError("")
    const t0 = Date.now()
    const dateParam = buildDateParam()
    const refreshParam = forceRefresh ? "&refresh=true" : ""

    try {
      if (tab === "campaigns") {
        const r = await fetch(`/api/facebook/campaigns?ad_account_id=${encodeURIComponent(selectedAccountId)}&${dateParam}${refreshParam}`)
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || "Failed")
        setCampaigns(d.campaigns || [])
      } else if (tab === "adsets") {
        const r = await fetch(`/api/facebook/adsets?ad_account_id=${encodeURIComponent(selectedAccountId)}&${dateParam}${refreshParam}`)
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || "Failed")
        setAdSets(d.adSets || [])
      } else {
        const r = await fetch(`/api/facebook/ads?ad_account_id=${encodeURIComponent(selectedAccountId)}&${dateParam}${refreshParam}`)
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || "Failed")
        setAds(d.ads || [])
      }
      setLoadedMs(Date.now() - t0)
    } catch (e: any) {
      setError(e.message || "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [selectedAccountId, tab, buildDateParam])

  // Fetches breakdown-insights rows — only when breakdowns are selected.
  // Receives the current breakdown list as an arg so callers can pass the
  // latest value directly (avoids stale-closure issues in the debounce).
  const fetchBreakdownData = useCallback(async (bds: string[]) => {
    setBreakdownRows([])
    setBreakdownError("")
    if (bds.length === 0 || !selectedAccountId) return

    const allBdsFields: string[] = []
    let tiValue: string | null = null
    for (const id of bds) {
      const param = BREAKDOWN_API_MAP[id]
      if (!param) continue
      const bdsM = param.match(/breakdowns=([^&]+)/)
      const tiM  = param.match(/time_increment=([^&]+)/)
      if (bdsM) allBdsFields.push(...bdsM[1].split(",").map(s => s.trim()))
      if (tiM) tiValue = tiM[1]
    }
    if (allBdsFields.length === 0 && !tiValue) return

    const dateParam = buildDateParam()
    const levelMap: Record<string, string> = { campaigns: "campaign", adsets: "adset", ads: "ad" }
    const level = levelMap[tab]
    let insUrl = `/api/facebook/breakdown-insights?ad_account_id=${encodeURIComponent(selectedAccountId)}&level=${level}&${dateParam}`
    if (allBdsFields.length > 0) insUrl += `&breakdowns=${encodeURIComponent(allBdsFields.join(","))}`
    if (tiValue) insUrl += `&time_increment=${encodeURIComponent(tiValue)}`

    try {
      const ir = await fetch(insUrl)
      const id = await ir.json()
      if (!ir.ok) {
        setBreakdownError(id.error || `Breakdown API error (${ir.status})`)
      } else if (Array.isArray(id.data)) {
        const idKey = level === "campaign" ? "campaign_id" : level === "adset" ? "adset_id" : "ad_id"
        const rows = id.data
          .filter((item: any) => item[idKey])
          .map((item: any) => ({
            parentId: item[idKey] as string,
            breakdownLabel: getBreakdownLabel(item as Record<string, string>, bds),
            ins: {
              spend: item.spend || "0",
              impressions: item.impressions || "0",
              clicks: item.clicks || "0",
              reach: item.reach,
              actions: item.actions,
              cost_per_action_type: item.cost_per_action_type,
            } as Insight,
          }))
        setBreakdownRows(rows)
      }
    } catch (err) {
      console.error("[breakdown-insights] fetch error:", err)
      setBreakdownError("Failed to fetch breakdown data")
    }
  }, [selectedAccountId, tab, buildDateParam])

  const breakdownDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Main data: account / tab / date change → immediate refetch
  useEffect(() => { fetchMainData() }, [fetchMainData])

  // Breakdown data: debounced 300ms so rapid multi-select fires only one request
  useEffect(() => {
    if (breakdownDebounceRef.current) clearTimeout(breakdownDebounceRef.current)
    breakdownDebounceRef.current = setTimeout(() => fetchBreakdownData(breakdowns), 300)
    return () => {
      if (breakdownDebounceRef.current) clearTimeout(breakdownDebounceRef.current)
    }
  }, [breakdowns, fetchBreakdownData])

  // Reset page & row selection when tab/search/date/breakdown changes
  useEffect(() => { setPage(1); setSelectedIds(new Set()) }, [tab, search, statusFilter, datePreset, customDateRange, breakdowns])

  // ─── Tab switch: if items checked, capture as filter for the next level ─────
  // Badge appears only on the NEXT tab, not on all 3 at once

  const switchTab = (newTab: Tab) => {
    if (tab === "campaigns" && selectedIds.size > 0) {
      setCampaignFilter(new Set(selectedIds))
      setAdSetFilter(new Set())
    }
    if (tab === "adsets" && selectedIds.size > 0) {
      setAdSetFilter(new Set(selectedIds))
    }
    setSelectedIds(new Set())
    setTab(newTab)
  }

  // ─── Toggle status ───────────────────────────────────────────────────────────

  const toggleStatus = async (id: string, newStatus: string) => {
    setToggling(prev => new Set(prev).add(id))
    try {
      const r = await fetch("/api/facebook/toggle-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, newStatus }),
      })
      if (!r.ok) return
      // Optimistic update
      if (tab === "campaigns") setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: newStatus, effective_status: newStatus } : c))
      else if (tab === "adsets") setAdSets(prev => prev.map(a => a.id === id ? { ...a, status: newStatus, effective_status: newStatus } : a))
      else setAds(prev => prev.map(a => a.id === id ? { ...a, status: newStatus, effective_status: newStatus } : a))
    } finally {
      setToggling(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  // ─── Inline Rename ────────────────────────────────────────────────────────────
  const saveInlineRename = async (id: string) => {
    if (!inlineEditingName.trim() || inlineEditingId !== id) {
      setInlineEditingId(null)
      return
    }
    
    // Optimistic update
    const updateList = (list: any[]) => list.map(x => x.id === id ? { ...x, name: inlineEditingName } : x)
    if (tab === "campaigns") setCampaigns(updateList)
    else if (tab === "adsets") setAdSets(updateList)
    else setAds(updateList)
    
    setInlineEditingId(null)

    try {
      const r = await fetch("/api/facebook/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: inlineEditingName })
      })
      if (!r.ok) throw new Error("Failed to update name")
    } catch (err) {
      console.error(err)
      fetchMainData() // revert on fail
    }
  }

  // ─── Duplicate ────────────────────────────────────────────────────────────────
  const handleDuplicate = async () => {
    if (selectedIds.size === 0) return
    setIsDuplicating(true)
    try {
      const ids = Array.from(selectedIds)
      for (const id of ids) {
        let node: any = campaigns.find(x => x.id === id) || adSets.find(x => x.id === id) || ads.find(x => x.id === id)
        await fetch("/api/facebook/duplicate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            name: node ? `${node.name} - Copy` : undefined,
            deep_copy: tab === "campaigns",
            status_option: "PAUSED",
            copies: duplicateCount
          })
        })
      }
      setDuplicateDialogOpen(false)
      setSelectedIds(new Set())
      await fetchMainData()
    } catch (err) {
      console.error(err)
    } finally {
      setIsDuplicating(false)
    }
  }

  // ─── Save Side Panel Edit ─────────────────────────────────────────────────────
  const saveSidePanelEdit = async (updatedNode: any) => {
    const updateList = (list: any[]) => list.map(x => x.id === updatedNode.id ? { ...x, ...updatedNode } : x)
    if (tab === "campaigns") setCampaigns(updateList)
    else if (tab === "adsets") setAdSets(updateList)
    else setAds(updateList)
    setEditingNode(null)

    try {
      const r = await fetch("/api/facebook/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: updatedNode.id,
          name: updatedNode.name,
          status: updatedNode.status,
          daily_budget: updatedNode.daily_budget ? parseInt(updatedNode.daily_budget) / 100 : undefined,
          lifetime_budget: updatedNode.lifetime_budget ? parseInt(updatedNode.lifetime_budget) / 100 : undefined,
          start_time: updatedNode.start_time || undefined,
          end_time: updatedNode.end_time || undefined,
        })
      })
      if (!r.ok) throw new Error("Failed to update")
    } catch (err) {
      console.error(err)
      fetchMainData() // revert on fail
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (selectedIds.size === 0) return
    setIsDeleting(true)
    try {
      const ids = Array.from(selectedIds)
      const r = await fetch("/api/facebook/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      const d = await r.json()
      if (d.deleted > 0) {
        const deletedSet = new Set(d.results.filter((x: any) => x.success).map((x: any) => x.id))
        if (tab === "campaigns") {
          setCampaigns(prev => prev.filter(c => !deletedSet.has(c.id)))
          setAdSets(prev => prev.filter(a => !deletedSet.has(a.campaign_id)))
          setAds(prev => prev.filter(a => !deletedSet.has(a.campaign_id)))
        } else if (tab === "adsets") {
          setAdSets(prev => prev.filter(a => !deletedSet.has(a.id)))
          setAds(prev => prev.filter(a => !deletedSet.has(a.adset_id)))
        } else {
          setAds(prev => prev.filter(a => !deletedSet.has(a.id)))
        }
        setSelectedIds(new Set())
      }
      setDeleteConfirmOpen(false)
    } catch (err) {
      console.error(err)
    } finally {
      setIsDeleting(false)
    }
  }

  // ─── Sort ────────────────────────────────────────────────────────────────────

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("desc") }
  }

  // ─── Filtered + sorted data ──────────────────────────────────────────────────

  // Lookup maps for cross-level name search
  const campaignNameById = useMemo(() => new Map(campaigns.map(c => [c.id, c.name])), [campaigns])
  const adSetNameById    = useMemo(() => new Map(adSets.map(a => [a.id, a.name])), [adSets])

  // Per-tab match counts — only computed for tabs that have loaded data
  const tabMatchCounts = useMemo(() => {
    const q = search.toLowerCase().trim()
    const matchStatus = (item: { effective_status: string }) =>
      statusFilter === "all" || item.effective_status === statusFilter
    const matchText = (item: { name: string; id: string }, extra = "") =>
      !q || item.name.toLowerCase().includes(q) || item.id.includes(q) || extra.toLowerCase().includes(q)
    return {
      // null = data not loaded yet (tab never visited) → don't show badge
      campaigns: campaigns.length > 0 || tab === "campaigns"
        ? campaigns.filter(c => matchStatus(c) && matchText(c)).length
        : null,
      adsets: adSets.length > 0 || tab === "adsets"
        ? adSets.filter(a => matchStatus(a) && matchText(a, campaignNameById.get(a.campaign_id) ?? "")).length
        : null,
      ads: ads.length > 0 || tab === "ads"
        ? ads.filter(ad => matchStatus(ad) && matchText(ad,
            [campaignNameById.get(ad.campaign_id) ?? "", adSetNameById.get(ad.adset_id) ?? ""].join(" ")
          )).length
        : null,
    }
  }, [campaigns, adSets, ads, tab, search, statusFilter, campaignNameById, adSetNameById])

  const currentData: (Campaign | AdSet | Ad)[] = useMemo(() => {
    let list: (Campaign | AdSet | Ad)[] = tab === "campaigns" ? campaigns : tab === "adsets" ? adSets : ads

    // Hierarchical filter — persists across all tabs
    if (tab === "adsets" && campaignFilter.size > 0) {
      list = (list as AdSet[]).filter(a => campaignFilter.has(a.campaign_id))
    }
    if (tab === "ads" && adSetFilter.size > 0) {
      list = (list as Ad[]).filter(a => adSetFilter.has(a.adset_id))
    }

    // Status filter
    if (statusFilter !== "all") {
      list = list.filter(item => item.effective_status === statusFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      if (tab === "adsets") {
        list = list.filter(item =>
          item.name.toLowerCase().includes(q) || item.id.includes(q) ||
          (campaignNameById.get((item as AdSet).campaign_id) ?? "").toLowerCase().includes(q)
        )
      } else if (tab === "ads") {
        list = list.filter(item =>
          item.name.toLowerCase().includes(q) || item.id.includes(q) ||
          (campaignNameById.get((item as Ad).campaign_id) ?? "").toLowerCase().includes(q) ||
          (adSetNameById.get((item as Ad).adset_id) ?? "").toLowerCase().includes(q)
        )
      } else {
        list = list.filter(item => item.name.toLowerCase().includes(q) || item.id.includes(q))
      }
    }
    if (sortField) {
      list = [...list].sort((a, b) => {
        let av = 0, bv = 0
        if (sortField === "spend") { av = getSpend(a); bv = getSpend(b) }
        else if (sortField === "name") return sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
        else if (sortField === "budget") {
          const getBudget = (x: any) => parseInt(x.daily_budget || x.lifetime_budget || "0")
          av = getBudget(a); bv = getBudget(b)
        }
        return sortDir === "asc" ? av - bv : bv - av
      })
    }
    return list
  }, [tab, campaigns, adSets, ads, campaignFilter, adSetFilter, search, statusFilter, sortField, sortDir, campaignNameById, adSetNameById])

  const totalPages = Math.max(1, Math.ceil(currentData.length / pageSize))
  const pagedData = currentData.slice((page - 1) * pageSize, page * pageSize)

  // Totals
  const totalSpend = currentData.reduce((s, item) => s + getSpend(item), 0)

  const totalResultsCount = useMemo(() => currentData.reduce((sum, item) => {
    const objective = tab === "campaigns"
      ? (item as Campaign).objective
      : campaigns.find(c => c.id === (item as AdSet | Ad).campaign_id)?.objective
    return sum + getResults(item, objective).count
  }, 0), [currentData, tab, campaigns])

  const allSelected = pagedData.length > 0 && pagedData.every(r => selectedIds.has(r.id))
  const someSelected = !allSelected && pagedData.some(r => selectedIds.has(r.id))
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(pagedData.map(r => r.id)))
  }

  // Header checkbox ref for indeterminate state
  const headerCheckRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (headerCheckRef.current) headerCheckRef.current.indeterminate = someSelected
  }, [someSelected])

  // ─── Config-driven cell renderer ─────────────────────────────────────────────

  function getActionValue(ins: Insight | null, actionType: string): number {
    if (!ins?.actions) return 0
    return parseInt(ins.actions.find(a => a.action_type === actionType)?.value || "0")
  }

  function renderCellContent(colId: string, row: Campaign | AdSet | Ad) {
    const ins   = getInsight(row)
    const spend = getSpend(row)
    const objective =
      tab === "campaigns" ? (row as Campaign).objective
      : tab === "adsets"  ? campaigns.find(c => c.id === (row as AdSet).campaign_id)?.objective
      :                     campaigns.find(c => c.id === (row as Ad).campaign_id)?.objective

    switch (colId) {
      case "spend":
        return <span className="text-[13px] tabular-nums">{ins ? `$${spend.toFixed(2)}` : "—"}</span>

      case "results": {
        const { count, type } = getResults(row, objective)
        return <>
          <span className="text-[13px] tabular-nums">{ins ? count : "—"}</span>
          {ins && <p className="text-[11px] text-[#65676b]">{type}</p>}
        </>
      }

      case "cost_per_result": {
        const { type } = getResults(row, objective)
        const cpr = getCostPerResult(row, objective)
        return <>
          <span className="text-[13px] tabular-nums">{cpr || "—"}</span>
          {cpr && <p className="text-[11px] text-[#65676b]">Per {type}</p>}
        </>
      }

      case "budget":
        return <span className="text-[13px] tabular-nums">{(row as any).daily_budget ? fmtBudget((row as any).daily_budget) : "—"}</span>

      case "lifetime_budget":
        return <span className="text-[13px] tabular-nums">{(row as any).lifetime_budget ? fmtBudget((row as any).lifetime_budget) : "—"}</span>

      case "delivery": {
        let budgetRemaining: string | undefined = (row as any).budget_remaining
        if (tab === "adsets") {
          const adset = row as AdSet
          // CBO adsets have no budget of their own — inherit from parent campaign
          if (!adset.daily_budget && !adset.lifetime_budget) {
            const parentCampaign = campaigns.find(c => c.id === adset.campaign_id)
            budgetRemaining = parentCampaign?.budget_remaining
          }
        } else if (tab === "ads") {
          // Ads don't show budget status — delivery is based solely on their own effective_status
          budgetRemaining = undefined
        }
        return <DeliveryBadge effective_status={row.effective_status} budget_remaining={budgetRemaining} />
      }

      case "effective_status":
        return <span className="text-[13px]">{row.effective_status.charAt(0) + row.effective_status.slice(1).toLowerCase()}</span>

      case "impressions":
        return <span className="text-[13px] tabular-nums">{ins?.impressions ? parseInt(ins.impressions).toLocaleString() : "—"}</span>

      case "clicks":
        return <span className="text-[13px] tabular-nums">{ins?.clicks ? parseInt(ins.clicks).toLocaleString() : "—"}</span>

      case "reach":
        return <span className="text-[13px] tabular-nums">{ins?.reach ? parseInt(ins.reach).toLocaleString() : "—"}</span>

      case "cpm": {
        if (!ins || !ins.impressions || parseFloat(ins.impressions) === 0) return <span className="text-[13px]">—</span>
        const cpmVal = (parseFloat(ins.spend || "0") / parseFloat(ins.impressions)) * 1000
        return <span className="text-[13px] tabular-nums">${cpmVal.toFixed(2)}</span>
      }

      case "frequency":
        return <span className="text-[13px]">—</span>

      case "ctr": {
        if (!ins || !ins.impressions || parseFloat(ins.impressions) === 0) return <span className="text-[13px]">—</span>
        const ctrVal = (parseFloat(ins.clicks || "0") / parseFloat(ins.impressions)) * 100
        return <span className="text-[13px] tabular-nums">{ctrVal.toFixed(2)}%</span>
      }

      case "cpc": {
        if (!ins || !ins.clicks || parseFloat(ins.clicks) === 0) return <span className="text-[13px]">—</span>
        return <span className="text-[13px] tabular-nums">${(spend / parseFloat(ins.clicks)).toFixed(2)}</span>
      }

      case "purchases":
        return <span className="text-[13px] tabular-nums">{ins ? getActionValue(ins, "omni_purchase") : "—"}</span>

      case "purchase_value": {
        const val = ins?.actions?.find(a => a.action_type === "omni_purchase_roas" || a.action_type === "purchase_roas")?.value
        return <span className="text-[13px] tabular-nums">{val ? `$${parseFloat(val).toFixed(2)}` : "—"}</span>
      }

      case "avg_order_value": {
        const purchasesN = getActionValue(ins, "omni_purchase")
        const pv = ins?.actions?.find(a => a.action_type === "omni_purchase_roas")
        if (!ins || purchasesN === 0 || !pv) return <span className="text-[13px]">—</span>
        return <span className="text-[13px] tabular-nums">${(parseFloat(pv.value) / purchasesN).toFixed(2)}</span>
      }

      case "roas": {
        const purchasesN = getActionValue(ins, "omni_purchase")
        if (!ins || spend === 0 || purchasesN === 0) return <span className="text-[13px]">—</span>
        return <span className="text-[13px] tabular-nums">{(purchasesN / spend).toFixed(2)}x</span>
      }

      case "cost_per_purchase": {
        const p = getActionValue(ins, "omni_purchase")
        if (!ins || p === 0) return <span className="text-[13px]">—</span>
        return <span className="text-[13px] tabular-nums">${(spend / p).toFixed(2)}</span>
      }

      case "cost_per_lead": {
        const l = getActionValue(ins, "lead")
        if (!ins || l === 0) return <span className="text-[13px]">—</span>
        return <span className="text-[13px] tabular-nums">${(spend / l).toFixed(2)}</span>
      }

      case "leads":
        return <span className="text-[13px] tabular-nums">{ins ? getActionValue(ins, "lead") : "—"}</span>

      case "add_to_cart":
        return <span className="text-[13px] tabular-nums">{ins ? getActionValue(ins, "add_to_cart") : "—"}</span>

      case "purchase_conv_rate": {
        const p = getActionValue(ins, "omni_purchase")
        const cl = ins ? parseInt(ins.clicks || "0") : 0
        if (!ins || cl === 0) return <span className="text-[13px]">—</span>
        return <span className="text-[13px] tabular-nums">{((p / cl) * 100).toFixed(2)}%</span>
      }

      case "video_views_3s":
        return <span className="text-[13px] tabular-nums">{ins ? getActionValue(ins, "video_view") : "—"}</span>
      case "video_25":
        return <span className="text-[13px] tabular-nums">{ins ? getActionValue(ins, "video_p25_watched_actions") : "—"}</span>
      case "video_50":
        return <span className="text-[13px] tabular-nums">{ins ? getActionValue(ins, "video_p50_watched_actions") : "—"}</span>
      case "video_75":
        return <span className="text-[13px] tabular-nums">{ins ? getActionValue(ins, "video_p75_watched_actions") : "—"}</span>
      case "video_100":
        return <span className="text-[13px] tabular-nums">{ins ? getActionValue(ins, "video_p100_watched_actions") : "—"}</span>

      case "schedule_start":
        return <span className="text-[13px] text-[#65676b]">{fmtDate((row as any).start_time)}</span>
      case "schedule_end":
        return <span className="text-[13px] text-[#65676b]">{fmtDate((row as any).stop_time || (row as any).end_time)}</span>
      case "optimization_goal":
        return <span className="text-[13px] text-[#65676b]">{(row as AdSet).optimization_goal?.replace(/_/g, " ").toLowerCase() || "—"}</span>
      case "bid_strategy":
        return <span className="text-[13px] text-[#65676b]">{(row as any).bid_strategy?.replace(/_/g, " ").toLowerCase() || "—"}</span>
      case "objective":
        return <span className="text-[13px] text-[#65676b]">{(row as Campaign).objective?.replace(/OUTCOME_/g, "").replace(/_/g, " ").toLowerCase() || "—"}</span>

      default:
        return <span className="text-[13px]">—</span>
    }
  }

  function renderBreakdownCell(colId: string, ins: Insight, objective?: string) {
    const spend = parseFloat(ins.spend || "0")
    const getVal = (type: string) => parseInt(ins.actions?.find(a => a.action_type === type)?.value || "0")
    switch (colId) {
      case "spend":
        return <span className="text-[13px] tabular-nums">{ins.spend ? `$${spend.toFixed(2)}` : "—"}</span>
      case "results": {
        const obj = OBJECTIVE_RESULT[objective || ""]
        if (!obj) return <span className="text-[13px]">—</span>
        const action = ins.actions?.find(a => a.action_type === obj.actionType)
        const count = parseInt(action?.value || "0")
        return <><span className="text-[13px] tabular-nums">{count || "—"}</span>{count > 0 && <p className="text-[11px] text-[#65676b]">{obj.type}</p>}</>
      }
      case "cost_per_result": {
        const obj = OBJECTIVE_RESULT[objective || ""]
        if (!obj) return <span className="text-[13px]">—</span>
        const cpa = ins.cost_per_action_type?.find(a => a.action_type === obj.actionType)
        if (!cpa) return <span className="text-[13px]">—</span>
        return <><span className="text-[13px] tabular-nums">${parseFloat(cpa.value).toFixed(2)}</span><p className="text-[11px] text-[#65676b]">Per {obj.type}</p></>
      }
      case "impressions": return <span className="text-[13px] tabular-nums">{ins.impressions ? parseInt(ins.impressions).toLocaleString() : "—"}</span>
      case "clicks":      return <span className="text-[13px] tabular-nums">{ins.clicks ? parseInt(ins.clicks).toLocaleString() : "—"}</span>
      case "reach":       return <span className="text-[13px] tabular-nums">{ins.reach ? parseInt(ins.reach).toLocaleString() : "—"}</span>
      case "cpm": {
        if (!ins.impressions || parseFloat(ins.impressions) === 0) return <span className="text-[13px]">—</span>
        return <span className="text-[13px] tabular-nums">${((spend / parseFloat(ins.impressions)) * 1000).toFixed(2)}</span>
      }
      case "ctr": {
        if (!ins.impressions || parseFloat(ins.impressions) === 0) return <span className="text-[13px]">—</span>
        return <span className="text-[13px] tabular-nums">{((parseFloat(ins.clicks || "0") / parseFloat(ins.impressions)) * 100).toFixed(2)}%</span>
      }
      case "cpc": {
        if (!ins.clicks || parseFloat(ins.clicks) === 0) return <span className="text-[13px]">—</span>
        return <span className="text-[13px] tabular-nums">${(spend / parseFloat(ins.clicks)).toFixed(2)}</span>
      }
      case "purchases":        { const p = getVal("omni_purchase"); return <span className="text-[13px] tabular-nums">{p || "—"}</span> }
      case "cost_per_purchase":{ const p = getVal("omni_purchase"); return <span className="text-[13px] tabular-nums">{p ? `$${(spend/p).toFixed(2)}` : "—"}</span> }
      case "leads":            { const l = getVal("lead"); return <span className="text-[13px] tabular-nums">{l || "—"}</span> }
      case "cost_per_lead":    { const l = getVal("lead"); return <span className="text-[13px] tabular-nums">{l ? `$${(spend/l).toFixed(2)}` : "—"}</span> }
      case "add_to_cart":      { const atc = getVal("add_to_cart"); return <span className="text-[13px] tabular-nums">{atc || "—"}</span> }
      case "video_views_3s":   { const v = getVal("video_view"); return <span className="text-[13px] tabular-nums">{v || "—"}</span> }
      case "video_25":         { const v = getVal("video_p25_watched_actions"); return <span className="text-[13px] tabular-nums">{v || "—"}</span> }
      case "video_50":         { const v = getVal("video_p50_watched_actions"); return <span className="text-[13px] tabular-nums">{v || "—"}</span> }
      case "video_75":         { const v = getVal("video_p75_watched_actions"); return <span className="text-[13px] tabular-nums">{v || "—"}</span> }
      case "video_100":        { const v = getVal("video_p100_watched_actions"); return <span className="text-[13px] tabular-nums">{v || "—"}</span> }
      default: return <span className="text-[13px]">—</span>
    }
  }

  // ─── Drill-down helpers (click name → single-item filter) ────────────────────

  const drillToAdSets = (campaign: Campaign) => {
    setCampaignFilter(new Set([campaign.id]))
    setAdSetFilter(new Set())
    setSelectedIds(new Set())
    setTab("adsets")
  }
  const drillToAds = (adSet: AdSet) => {
    setAdSetFilter(new Set([adSet.id]))
    setSelectedIds(new Set())
    setTab("ads")
  }

  // ─── Tab label + badge helpers ────────────────────────────────────────────────
  // Label changes immediately as user selects items (live preview)

  const tabLabel = (t: Tab) => {
    if (t === "campaigns") return "Campaigns"

    if (t === "adsets") {
      // Live: user is on campaigns tab selecting campaigns
      const n = tab === "campaigns" ? selectedIds.size : campaignFilter.size
      if (n > 0) return `Ad sets for ${n} Campaign${n > 1 ? "s" : ""}`
      return "Ad sets"
    }

    // t === "ads"
    const adSetN = tab === "adsets" ? selectedIds.size : adSetFilter.size
    if (adSetN > 0) return `Ads for ${adSetN} Ad set${adSetN > 1 ? "s" : ""}`
    const campaignN = tab === "campaigns" ? selectedIds.size : campaignFilter.size
    if (campaignN > 0) return `Ads for ${campaignN} Campaign${campaignN > 1 ? "s" : ""}`
    return "Ads"
  }

  // Badge logic:
  //   Current tab  → live selectedIds count (clears selection)
  //   Other tabs   → locked filter count (clears that filter)
  const tabBadge = (t: Tab): { count: number; clear: () => void } | null => {
    if (t === tab && selectedIds.size > 0) {
      return { count: selectedIds.size, clear: () => setSelectedIds(new Set()) }
    }
    if (t === "campaigns" && t !== tab && campaignFilter.size > 0) {
      return { count: campaignFilter.size, clear: () => { setCampaignFilter(new Set()); setAdSetFilter(new Set()) } }
    }
    if (t === "adsets" && t !== tab && adSetFilter.size > 0) {
      return { count: adSetFilter.size, clear: () => setAdSetFilter(new Set()) }
    }
    return null
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <CreateCampaignModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} onSuccess={fetchMainData} />

      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        <h1 className="text-base font-bold">Campaigns</h1>
        {/* Account selector */}
        <div className="relative">
          <select
            value={selectedAccountId}
            onChange={e => setSelectedAccountId(e.target.value)}
            className="h-8 pl-2 pr-7 text-xs bg-muted/40 border rounded-lg outline-none appearance-none cursor-pointer focus:ring-1 focus:ring-ring"
          >
            {adAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <IconChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
        </div>
        {selectedAccount && (
          <span className="text-[10px] text-muted-foreground">{selectedAccount.id}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {loadedMs !== null && (
            <span className="text-[10px] text-muted-foreground border rounded px-2 py-1">
              Loaded {loadedMs}ms
            </span>
          )}
          <button onClick={() => { setHistoryOpen(true); fetchHistory() }} className="flex items-center gap-1.5 h-7 px-2.5 text-xs border rounded-lg hover:bg-muted/50 transition-colors">
            <IconHistory className="size-3.5" />History
          </button>
          <button
            onClick={() => fetchMainData(true)}
            disabled={loading}
            className="size-7 flex items-center justify-center border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <IconRefresh className={cn("size-3.5 text-muted-foreground", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* ── Search + Status filter bar ── */}
      <div className="px-4 py-2 border-b shrink-0 flex items-center gap-3 flex-wrap">
        {/* Search input */}
        <div className="relative flex-1 min-w-[220px] max-w-lg">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Escape" && setSearch("")}
            placeholder="Search by name, ID, campaign or ad set..."
            className="w-full pl-9 pr-8 py-1.5 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
            >
              <IconX className="size-3.5" />
            </button>
          )}
        </div>

        {/* Status filter chips */}
        <div className="flex items-center gap-1 shrink-0">
          {(["all", "ACTIVE", "PAUSED"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-full border font-medium transition-colors",
                statusFilter === s
                  ? s === "ACTIVE"
                    ? "bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400"
                    : s === "PAUSED"
                    ? "bg-gray-100 border-gray-300 text-gray-600 dark:bg-gray-800/60 dark:border-gray-700 dark:text-gray-300"
                    : "bg-primary/10 border-primary/30 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/50"
              )}
            >
              {s === "all" ? "All" : s === "ACTIVE" ? "Active" : "Paused"}
            </button>
          ))}
        </div>

        {/* Result count */}
        {(search || statusFilter !== "all") && (
          <span className="text-xs text-muted-foreground shrink-0">
            {currentData.length} result{currentData.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Tabs + Pagination + Date range ── */}
      <div className="flex items-center px-4 border-b shrink-0 bg-background">
        {/* Tabs */}
        <div className="flex items-center">
          {(["campaigns", "adsets", "ads"] as Tab[]).map(t => {
            const badge = tabBadge(t)
            return (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 text-[13px] transition-colors whitespace-nowrap rounded-t-lg border-t border-l border-r",
                  tab === t
                    ? "bg-white dark:bg-card border-[#e4e6eb] dark:border-gray-800 font-bold text-gray-900 dark:text-gray-100 z-10 -mb-px shadow-[0_-2px_0_0_#1877f2]"
                    : "bg-[#f5f6f7] dark:bg-muted/50 border-transparent border-b-[#e4e6eb] dark:border-b-gray-800 text-[#65676b] dark:text-muted-foreground hover:bg-[#ebedf0] dark:hover:bg-muted font-semibold"
                )}
              >
                {t === "campaigns"
                  ? <span className="size-4 shrink-0 flex items-center justify-center rounded bg-blue-600 text-white text-[9px] font-bold">A</span>
                  : <IconTable className="size-3.5 shrink-0" />
                }
                <span className="truncate max-w-[110px]">{tabLabel(t)}</span>

                {/* Search/filter match count badge — only when tab has loaded data */}
                {(search || statusFilter !== "all") && tabMatchCounts[t] !== null && (
                  <span className={cn(
                    "px-1.5 py-0.5 text-[10px] rounded-full font-bold leading-none",
                    tab === t
                      ? "bg-blue-600 text-white"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {tabMatchCounts[t]}
                  </span>
                )}

                {/* Hierarchical filter badge */}
                {!search && statusFilter === "all" && badge && (
                  <span className="flex items-center gap-px px-1.5 py-0.5 bg-blue-600 text-white text-[10px] rounded-full font-bold leading-none">
                    {badge.count}
                    <span
                      role="button"
                      onClick={e => { e.stopPropagation(); badge.clear() }}
                      className="ml-0.5 cursor-pointer hover:text-blue-200 font-normal"
                    >×</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2 py-1.5">
          {/* Pagination count */}
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {currentData.length === 0 ? "0" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, currentData.length)}`} of {currentData.length}
          </span>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="size-6 flex items-center justify-center border rounded hover:bg-muted/50 disabled:opacity-30">
            <IconChevronLeft className="size-3.5" />
          </button>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="size-6 flex items-center justify-center border rounded hover:bg-muted/50 disabled:opacity-30">
            <IconChevronRight className="size-3.5" />
          </button>

          {/* Page size */}
          <div ref={pageSizeRef} className="relative">
            <button onClick={() => setPageSizeOpen(o => !o)} className="flex items-center gap-1 h-6 px-2 text-xs border rounded hover:bg-muted/50">
              {pageSize} / page <IconChevronDown className="size-3" />
            </button>
            {pageSizeOpen && (
              <div className="absolute right-0 top-full mt-1 bg-popover border rounded-lg shadow-lg z-50 py-1 w-24">
                {PAGE_SIZE_OPTIONS.map(n => (
                  <button key={n} onClick={() => { setPageSize(n); setPage(1); setPageSizeOpen(false) }}
                    className={cn("w-full px-3 py-1.5 text-xs text-left hover:bg-accent", pageSize === n && "text-primary font-medium")}>
                    {n} / page
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date range */}
          <AdsDateRangePicker
            preset={datePreset}
            customStart={customDateRange?.start}
            customEnd={customDateRange?.end}
            onChange={(p, cs, ce) => {
              setDatePreset(p)
              setCustomDateRange(p === "custom" && cs && ce ? { start: cs, end: ce } : null)
            }}
          />
        </div>
      </div>

      {/* ── Action toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0 flex-wrap bg-white dark:bg-background">
        <button onClick={() => setDefaultsOpen(true)} className="flex items-center gap-1.5 h-7 px-3 text-xs border border-[#ccd0d5] dark:border-gray-700 rounded bg-[#f5f6f7] dark:bg-muted hover:bg-[#ebedf0] dark:hover:bg-muted/80 transition-colors text-[#4b4f56] dark:text-gray-300 font-semibold shadow-sm">
          <IconSettings className="size-3.5" />Ad defaults
        </button>
        <button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-1.5 h-7 px-3 text-xs rounded bg-[#31a24c] hover:bg-[#2b9244] text-white transition-colors font-semibold shadow-sm">
          <IconPlus className="size-3.5" />Create
        </button>
        <button
          disabled={selectedIds.size === 0}
          onClick={() => setDuplicateDialogOpen(true)}
          className="flex items-center gap-1.5 h-7 px-3 text-xs border border-[#ccd0d5] dark:border-gray-700 rounded bg-[#f5f6f7] dark:bg-muted hover:bg-[#ebedf0] dark:hover:bg-muted/80 transition-colors text-[#4b4f56] dark:text-gray-300 font-semibold shadow-sm disabled:opacity-40"
        >
          <IconCopy className="size-3.5" />
          Duplicate{selectedIds.size > 0 && ` (${selectedIds.size})`}
        </button>
        <button
          disabled={selectedIds.size === 0}
          onClick={() => setEditingNode(currentData.find(x => x.id === Array.from(selectedIds)[0]) || null)}
          className="flex items-center gap-1.5 h-7 px-3 text-xs border border-[#ccd0d5] dark:border-gray-700 rounded bg-[#f5f6f7] dark:bg-muted hover:bg-[#ebedf0] dark:hover:bg-muted/80 transition-colors text-[#4b4f56] dark:text-gray-300 font-semibold shadow-sm disabled:opacity-40"
        >
          <IconPencil className="size-3.5" />
          Edit{selectedIds.size > 0 && ` (${selectedIds.size})`}
        </button>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-1.5 ml-2">
            <button
              onClick={() => Array.from(selectedIds).forEach(id => toggleStatus(id, "ACTIVE"))}
              className="h-7 px-3 text-xs border border-[#ccd0d5] dark:border-gray-700 rounded bg-[#f5f6f7] dark:bg-muted hover:bg-[#ebedf0] dark:hover:bg-muted/80 transition-colors text-[#1877f2] font-semibold shadow-sm"
            >
              Activate
            </button>
            <button
              onClick={() => Array.from(selectedIds).forEach(id => toggleStatus(id, "PAUSED"))}
              className="h-7 px-3 text-xs border border-[#ccd0d5] dark:border-gray-700 rounded bg-[#f5f6f7] dark:bg-muted hover:bg-[#ebedf0] dark:hover:bg-muted/80 transition-colors text-[#4b4f56] dark:text-gray-300 font-semibold shadow-sm"
            >
              Pause
            </button>
          </div>
        )}

        {/* Sync pair */}
        <button onClick={() => fetchMainData(true)} className="size-7 flex items-center justify-center border rounded-lg hover:bg-muted/50 transition-colors" title="Sync">
          <IconRefresh className="size-3.5 text-muted-foreground" />
        </button>
        <button onClick={() => fetchMainData(true)} className="size-7 flex items-center justify-center border rounded-lg hover:bg-muted/50 transition-colors" title="Refresh">
          <IconRefresh className="size-3.5 text-muted-foreground rotate-180" />
        </button>

        {/* Selection indicator — only shown when items selected */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 h-7 border rounded-lg bg-blue-50 dark:bg-blue-950/20 text-xs text-blue-700 dark:text-blue-400 font-medium">
            {selectedIds.size} selected
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-0.5 flex items-center justify-center size-4 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-blue-500"
              title="Clear selection"
            >
              ×
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {/* Open in Meta Ads Manager */}
          <button
            onClick={() => {
              const actId = selectedAccountId?.replace("act_", "")
              const ids = Array.from(selectedIds)
              const base = `https://adsmanager.facebook.com/adsmanager/manage/${tab}?act=${actId}`
              const url = ids.length === 1
                ? `${base}&selected_${tab.slice(0, -1)}_ids=${ids[0]}`
                : base
              window.open(url, "_blank")
            }}
            className="size-7 flex items-center justify-center border rounded-lg hover:bg-muted/50 transition-colors"
            title="View in Meta Ads Manager"
          >
            <svg className="size-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
            </svg>
          </button>
          <button
            disabled={selectedIds.size === 0}
            onClick={() => setDeleteConfirmOpen(true)}
            className="size-7 flex items-center justify-center border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-40"
            title="Delete selected"
          >
            <IconTrash className="size-3.5 text-muted-foreground" />
          </button>
          {/* Breakdown */}
          <BreakdownDropdown selected={breakdowns} onChange={setBreakdowns} />

          {/* Columns preset picker */}
          <div ref={colsDropRef} className="relative">
            <button
              onClick={() => setColsOpen(v => !v)}
              className="flex items-center gap-1.5 h-7 px-2.5 text-xs border rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground"
            >
              <IconTable className="size-3.5 shrink-0" />
              <span className="max-w-[160px] truncate">
                Columns: {getActivePreset(columnOrder, customPresets)?.label || "Custom"}
              </span>
              <IconChevronDown className="size-3 shrink-0" />
            </button>

            {colsOpen && (
              <div className="absolute right-0 top-full mt-1 bg-popover border rounded-xl shadow-lg z-50 w-64 py-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-3 mb-1">POPULAR</p>
                {DEFAULT_PRESETS.map(preset => {
                  const isActive = getActivePreset(columnOrder, customPresets)?.id === preset.id
                  return (
                    <button
                      key={preset.id}
                      onClick={() => { setColumnOrder(preset.columns); setColsOpen(false) }}
                      className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-muted/50 transition-colors"
                    >
                      <span className={cn(
                        "size-3.5 rounded-full border-2 shrink-0 transition-colors",
                        isActive ? "border-[#1877f2] bg-[#1877f2]" : "border-muted-foreground/40"
                      )} />
                      <span className="text-[13px]">{preset.label}</span>
                    </button>
                  )
                })}

                <div className="border-t my-1.5" />
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-3 mb-1">SAVED IN YOUR ORG</p>
                {customPresets.length === 0
                  ? <p className="text-[12px] text-muted-foreground px-3 py-1.5">No saved presets yet.</p>
                  : customPresets.map(preset => {
                      const isActive = getActivePreset(columnOrder, customPresets)?.id === preset.id
                      return (
                        <button
                          key={preset.id}
                          onClick={() => { setColumnOrder(preset.columns); setColsOpen(false) }}
                          className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-muted/50 transition-colors"
                        >
                          <span className={cn(
                            "size-3.5 rounded-full border-2 shrink-0",
                            isActive ? "border-[#1877f2] bg-[#1877f2]" : "border-muted-foreground/40"
                          )} />
                          <span className="text-[13px]">{preset.label}</span>
                        </button>
                      )
                    })
                }

                <div className="border-t my-1.5" />
                <button
                  onClick={() => { setColsOpen(false); setCustomizeColsOpen(true) }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 transition-colors"
                >
                  <span className="flex items-center gap-2 text-[13px]">
                    <IconTable className="size-3.5 text-muted-foreground" />
                    Customize columns
                  </span>
                  <IconDrillRight className="size-3.5 text-muted-foreground" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="m-4 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive">{error}</div>
        )}
        {breakdownError && (
          <div className="mx-4 mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400">
            Breakdown error: {breakdownError}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="w-full text-sm border-collapse" style={{ minWidth: 1100 }}>
            <thead className="sticky top-0 z-30 bg-[#f5f6f7] dark:bg-muted/80 border-b border-[#e4e6eb] dark:border-gray-800">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input ref={headerCheckRef} type="checkbox" className="rounded size-3.5 accent-blue-600" checked={allSelected} onChange={toggleAll} />
                </th>
                <th className="w-16 px-2 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">Off/On</th>
                <SortTh
                  label={tab === "ads" ? "Ad name" : tab === "adsets" ? "Ad set" : "Campaign"}
                  field="name"
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={handleSort}
                  className="min-w-[220px]"
                />
                {tab === "ads" && (
                  <th className="w-20 px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">Preview</th>
                )}
                {columnOrder.map(colId => {
                  const col = COLUMN_MAP[colId]
                  if (!col) return null
                  if (col.sortKey) {
                    return (
                      <SortTh
                        key={colId}
                        label={col.headerLabel}
                        field={col.sortKey}
                        sortField={sortField}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    )
                  }
                  return (
                    <th key={colId} className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                      {col.headerLabel}
                    </th>
                  )
                })}
              </tr>
            </thead>

            <tbody>
              {pagedData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-16">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <span className="text-sm">
                        {search ? `No ${tab === "campaigns" ? "campaigns" : tab === "adsets" ? "ad sets" : "ads"} match "${search}"` : `No ${tab} found`}
                      </span>
                      {/* Suggest switching to another tab if it has matching results */}
                      {search && (
                        <div className="flex items-center gap-2 flex-wrap justify-center">
                          {(["campaigns", "adsets", "ads"] as Tab[]).filter(t => t !== tab && (tabMatchCounts[t] ?? 0) > 0).map(t => (
                            <button
                              key={t}
                              onClick={() => switchTab(t)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors font-medium"
                            >
                              Found {tabMatchCounts[t]} in {t === "campaigns" ? "Campaigns" : t === "adsets" ? "Ad sets" : "Ads"} →
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : tab === "campaigns" ? (
                (pagedData as Campaign[]).map(c => {
                  const isSel = selectedIds.has(c.id)
                  const rowBDs = breakdowns.length > 0 ? breakdownRows.filter(br => br.parentId === c.id) : []
                  return (
                    <Fragment key={c.id}>
                      <tr className={cn("border-b border-[#e4e6eb] dark:border-gray-800 hover:bg-[#f5f6f7] dark:hover:bg-white/5 transition-colors group/row", isSel && "bg-[#e3f0fe] dark:bg-blue-950/30 hover:bg-[#d8e9fc]")}>
                        <td className={cn("px-3 py-2.5 sticky left-0 z-10 bg-white dark:bg-background transition-colors", isSel ? "bg-[#e3f0fe] dark:bg-blue-950/30 group-hover/row:bg-[#d8e9fc]" : "group-hover/row:bg-[#f5f6f7]")}>
                          <input type="checkbox" className="rounded size-[14px] accent-[#1877f2]" checked={isSel}
                            onChange={() => setSelectedIds(prev => { const s = new Set(prev); isSel ? s.delete(c.id) : s.add(c.id); return s })} />
                        </td>
                        <td className={cn("px-2 py-2.5 sticky left-10 z-10 bg-white dark:bg-background transition-colors", isSel ? "bg-[#e3f0fe] dark:bg-blue-950/30 group-hover/row:bg-[#d8e9fc]" : "group-hover/row:bg-[#f5f6f7]")}>
                          {toggling.has(c.id) ? <IconLoader2 className="size-4 animate-spin text-[#65676b]" /> : <StatusToggle id={c.id} status={c.status} onToggle={toggleStatus} />}
                        </td>
                        <td className={cn("px-3 py-2.5 sticky left-[100px] z-10 bg-white dark:bg-background border-r border-[#e4e6eb] dark:border-gray-800 transition-colors group/cell", isSel ? "bg-[#e3f0fe] dark:bg-blue-950/30 group-hover/row:bg-[#d8e9fc]" : "group-hover/row:bg-[#f5f6f7]")}>
                          {inlineEditingId === c.id ? (
                            <div className="flex items-center gap-2"><Input value={inlineEditingName} onChange={e => setInlineEditingName(e.target.value)} onBlur={() => saveInlineRename(c.id)} onKeyDown={e => e.key === "Enter" && saveInlineRename(c.id)} className="h-7 text-[13px] py-1" autoFocus /></div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <button onClick={() => drillToAdSets(c)} className="text-[#1877f2] hover:underline text-[13px] font-semibold text-left line-clamp-2">{c.name}</button>
                                <button onClick={e => { e.stopPropagation(); setInlineEditingId(c.id); setInlineEditingName(c.name) }} className="opacity-0 group-hover/cell:opacity-100 p-0.5 hover:bg-black/5 rounded transition-opacity"><IconPencil className="size-3 text-[#65676b]" /></button>
                              </div>
                              <div className="flex items-center gap-1.5 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                <button className="text-[11px] text-[#65676b] font-semibold hover:underline" onClick={() => setEditingNode(c)}>Edit</button>
                                <span className="text-[#ccd0d5]">·</span>
                                <button className="text-[11px] text-[#65676b] font-semibold hover:underline" onClick={() => { setSelectedIds(new Set([c.id])); setDuplicateDialogOpen(true) }}>Duplicate</button>
                              </div>
                              <p className="text-[11px] text-[#8a8d91] font-mono mt-0.5">{c.id}</p>
                            </div>
                          )}
                        </td>
                        {columnOrder.map(colId => <td key={colId} className="px-3 py-2.5">{renderCellContent(colId, c)}</td>)}
                      </tr>
                      {rowBDs.map((br, i) => (
                        <tr key={`bd-${i}`} className="border-b border-[#e4e6eb] dark:border-gray-800 bg-[#f5f6f7] dark:bg-muted/10">
                          <td className="sticky left-0 z-10 bg-[#f5f6f7] dark:bg-muted/10 w-10 px-3 py-2" />
                          <td className="sticky left-10 z-10 bg-[#f5f6f7] dark:bg-muted/10 w-16 px-2 py-2" />
                          <td className="px-3 py-2 sticky left-[100px] z-10 bg-[#f5f6f7] dark:bg-muted/10 border-r border-[#e4e6eb] dark:border-gray-800">
                            <span className="pl-6 text-[13px] text-[#1c2b33] dark:text-foreground">{br.breakdownLabel}</span>
                          </td>
                          {columnOrder.map(colId => <td key={colId} className="px-3 py-2">{renderBreakdownCell(colId, br.ins, c.objective)}</td>)}
                        </tr>
                      ))}
                    </Fragment>
                  )
                })
              ) : tab === "adsets" ? (
                (pagedData as AdSet[]).map(a => {
                  const isSel = selectedIds.has(a.id)
                  const objective = campaigns.find(c => c.id === a.campaign_id)?.objective
                  const rowBDs = breakdowns.length > 0 ? breakdownRows.filter(br => br.parentId === a.id) : []
                  return (
                    <Fragment key={a.id}>
                      <tr className={cn("border-b border-[#e4e6eb] dark:border-gray-800 hover:bg-[#f5f6f7] dark:hover:bg-white/5 transition-colors group/row", isSel && "bg-[#e3f0fe] dark:bg-blue-950/30 hover:bg-[#d8e9fc]")}>
                        <td className={cn("px-3 py-2.5 sticky left-0 z-10 bg-white dark:bg-background transition-colors", isSel ? "bg-[#e3f0fe] dark:bg-blue-950/30 group-hover/row:bg-[#d8e9fc]" : "group-hover/row:bg-[#f5f6f7]")}>
                          <input type="checkbox" className="rounded size-[14px] accent-[#1877f2]" checked={isSel}
                            onChange={() => setSelectedIds(prev => { const s = new Set(prev); isSel ? s.delete(a.id) : s.add(a.id); return s })} />
                        </td>
                        <td className={cn("px-2 py-2.5 sticky left-10 z-10 bg-white dark:bg-background transition-colors", isSel ? "bg-[#e3f0fe] dark:bg-blue-950/30 group-hover/row:bg-[#d8e9fc]" : "group-hover/row:bg-[#f5f6f7]")}>
                          {toggling.has(a.id) ? <IconLoader2 className="size-4 animate-spin text-[#65676b]" /> : <StatusToggle id={a.id} status={a.status} onToggle={toggleStatus} />}
                        </td>
                        <td className={cn("px-3 py-2.5 sticky left-[100px] z-10 bg-white dark:bg-background border-r border-[#e4e6eb] dark:border-gray-800 transition-colors group/cell", isSel ? "bg-[#e3f0fe] dark:bg-blue-950/30 group-hover/row:bg-[#d8e9fc]" : "group-hover/row:bg-[#f5f6f7]")}>
                          {inlineEditingId === a.id ? (
                            <div className="flex items-center gap-2"><Input value={inlineEditingName} onChange={e => setInlineEditingName(e.target.value)} onBlur={() => saveInlineRename(a.id)} onKeyDown={e => e.key === "Enter" && saveInlineRename(a.id)} className="h-7 text-[13px] py-1" autoFocus /></div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <button onClick={() => drillToAds(a)} className="text-[#1877f2] hover:underline text-[13px] font-semibold text-left line-clamp-2">{a.name}</button>
                                <button onClick={e => { e.stopPropagation(); setInlineEditingId(a.id); setInlineEditingName(a.name) }} className="opacity-0 group-hover/cell:opacity-100 p-0.5 hover:bg-black/5 rounded transition-opacity"><IconPencil className="size-3 text-[#65676b]" /></button>
                              </div>
                              <div className="flex items-center gap-1.5 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                <button className="text-[11px] text-[#65676b] font-semibold hover:underline" onClick={() => setEditingNode(a)}>Edit</button>
                                <span className="text-[#ccd0d5]">·</span>
                                <button className="text-[11px] text-[#65676b] font-semibold hover:underline" onClick={() => { setSelectedIds(new Set([a.id])); setDuplicateDialogOpen(true) }}>Duplicate</button>
                              </div>
                              <p className="text-[11px] text-[#8a8d91] font-mono mt-0.5">{a.id}</p>
                            </div>
                          )}
                        </td>
                        {columnOrder.map(colId => <td key={colId} className="px-3 py-2.5">{renderCellContent(colId, a)}</td>)}
                      </tr>
                      {rowBDs.map((br, i) => (
                        <tr key={`bd-${i}`} className="border-b border-[#e4e6eb] dark:border-gray-800 bg-[#f5f6f7] dark:bg-muted/10">
                          <td className="sticky left-0 z-10 bg-[#f5f6f7] dark:bg-muted/10 w-10 px-3 py-2" />
                          <td className="sticky left-10 z-10 bg-[#f5f6f7] dark:bg-muted/10 w-16 px-2 py-2" />
                          <td className="px-3 py-2 sticky left-[100px] z-10 bg-[#f5f6f7] dark:bg-muted/10 border-r border-[#e4e6eb] dark:border-gray-800">
                            <span className="pl-6 text-[13px] text-[#1c2b33] dark:text-foreground">{br.breakdownLabel}</span>
                          </td>
                          {columnOrder.map(colId => <td key={colId} className="px-3 py-2">{renderBreakdownCell(colId, br.ins, objective)}</td>)}
                        </tr>
                      ))}
                    </Fragment>
                  )
                })
              ) : (
                (pagedData as Ad[]).map(a => {
                  const adSet = adSets.find(s => s.id === a.adset_id)
                  const isSel = selectedIds.has(a.id)
                  const thumb = a.creative?.thumbnail_url || a.creative?.image_url
                  const objective = campaigns.find(c => c.id === a.campaign_id)?.objective
                  const rowBDs = breakdowns.length > 0 ? breakdownRows.filter(br => br.parentId === a.id) : []
                  return (
                    <Fragment key={a.id}>
                      <tr className={cn("border-b border-[#e4e6eb] dark:border-gray-800 hover:bg-[#f5f6f7] dark:hover:bg-white/5 transition-colors group/row", isSel && "bg-[#e3f0fe] dark:bg-blue-950/30 hover:bg-[#d8e9fc]")}>
                        <td className={cn("px-3 py-2.5 sticky left-0 z-10 bg-white dark:bg-background transition-colors", isSel ? "bg-[#e3f0fe] dark:bg-blue-950/30 group-hover/row:bg-[#d8e9fc]" : "group-hover/row:bg-[#f5f6f7]")}>
                          <input type="checkbox" className="rounded size-[14px] accent-[#1877f2]" checked={isSel}
                            onChange={() => setSelectedIds(prev => { const s = new Set(prev); isSel ? s.delete(a.id) : s.add(a.id); return s })} />
                        </td>
                        <td className={cn("px-2 py-2.5 sticky left-10 z-10 bg-white dark:bg-background transition-colors", isSel ? "bg-[#e3f0fe] dark:bg-blue-950/30 group-hover/row:bg-[#d8e9fc]" : "group-hover/row:bg-[#f5f6f7]")}>
                          {toggling.has(a.id) ? <IconLoader2 className="size-4 animate-spin text-[#65676b]" /> : <StatusToggle id={a.id} status={a.status} onToggle={toggleStatus} />}
                        </td>
                        <td className={cn("px-3 py-2.5 sticky left-[100px] z-10 bg-white dark:bg-background border-r border-[#e4e6eb] dark:border-gray-800 transition-colors group/cell", isSel ? "bg-[#e3f0fe] dark:bg-blue-950/30 group-hover/row:bg-[#d8e9fc]" : "group-hover/row:bg-[#f5f6f7]")}>
                          {inlineEditingId === a.id ? (
                            <div className="flex items-center gap-2"><Input value={inlineEditingName} onChange={e => setInlineEditingName(e.target.value)} onBlur={() => saveInlineRename(a.id)} onKeyDown={e => e.key === "Enter" && saveInlineRename(a.id)} className="h-7 text-[13px] py-1" autoFocus /></div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <p className="text-[13px] font-semibold text-[#1c2b33] dark:text-gray-200 line-clamp-2">{a.name}</p>
                                <button onClick={e => { e.stopPropagation(); setInlineEditingId(a.id); setInlineEditingName(a.name) }} className="opacity-0 group-hover/cell:opacity-100 p-0.5 hover:bg-black/5 rounded transition-opacity"><IconPencil className="size-3 text-[#65676b]" /></button>
                              </div>
                              <div className="flex items-center gap-1.5 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                <button className="text-[11px] text-[#65676b] font-semibold hover:underline" onClick={() => setEditingNode(a)}>Edit</button>
                                <span className="text-[#ccd0d5]">·</span>
                                <button className="text-[11px] text-[#65676b] font-semibold hover:underline" onClick={() => { setSelectedIds(new Set([a.id])); setDuplicateDialogOpen(true) }}>Duplicate</button>
                              </div>
                              <p className="text-[11px] text-[#8a8d91] font-mono mt-0.5">{a.id}</p>
                              {adSet && <p className="text-[10px] text-[#8a8d91] truncate max-w-[200px]">↳ {adSet.name}</p>}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {thumb ? <img src={thumb} alt="" className="size-12 rounded object-cover border" loading="lazy" /> : <div className="size-12 rounded bg-muted border flex items-center justify-center text-[10px] text-muted-foreground">No img</div>}
                        </td>
                        {columnOrder.map(colId => <td key={colId} className="px-3 py-2.5">{renderCellContent(colId, a)}</td>)}
                      </tr>
                      {rowBDs.map((br, i) => (
                        <tr key={`bd-${i}`} className="border-b border-[#e4e6eb] dark:border-gray-800 bg-[#f5f6f7] dark:bg-muted/10">
                          <td className="sticky left-0 z-10 bg-[#f5f6f7] dark:bg-muted/10 w-10 px-3 py-2" />
                          <td className="sticky left-10 z-10 bg-[#f5f6f7] dark:bg-muted/10 w-16 px-2 py-2" />
                          <td className="px-3 py-2 sticky left-[100px] z-10 bg-[#f5f6f7] dark:bg-muted/10 border-r border-[#e4e6eb] dark:border-gray-800">
                            <span className="pl-6 text-[13px] text-[#1c2b33] dark:text-foreground">{br.breakdownLabel}</span>
                          </td>
                          <td className="px-3 py-2 bg-[#f5f6f7] dark:bg-muted/10" />
                          {columnOrder.map(colId => <td key={colId} className="px-3 py-2">{renderBreakdownCell(colId, br.ins, objective)}</td>)}
                        </tr>
                      ))}
                    </Fragment>
                  )
                })
              )}
            </tbody>

            {/* ── Totals row ── */}
            {pagedData.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#e4e6eb] dark:border-gray-800 bg-[#f7f8fa] dark:bg-muted/20">
                  <td colSpan={tab === "ads" ? 4 : 3} className="px-3 py-2.5 text-xs text-muted-foreground font-medium">
                    Results from {currentData.length} {tab === "campaigns" ? "campaigns" : tab === "adsets" ? "ad sets" : "ads"}
                  </td>
                  {columnOrder.map(colId => {
                    if (colId === "spend") return (
                      <td key={colId} className="px-3 py-2.5 text-xs font-semibold tabular-nums text-[#1c2b33] dark:text-white">
                        ${totalSpend.toFixed(2)}
                        <p className="text-[11px] text-muted-foreground font-normal">Total spent</p>
                      </td>
                    )
                    if (colId === "results") return (
                      <td key={colId} className="px-3 py-2.5 text-xs font-semibold tabular-nums text-[#1c2b33] dark:text-white">
                        {totalResultsCount > 0 ? totalResultsCount.toLocaleString() : "—"}
                        <p className="text-[11px] text-muted-foreground font-normal">Total</p>
                      </td>
                    )
                    if (colId === "cost_per_result") return (
                      <td key={colId} className="px-3 py-2.5 text-xs font-semibold tabular-nums text-[#1c2b33] dark:text-white">
                        {totalResultsCount > 0 ? `$${(totalSpend / totalResultsCount).toFixed(2)}` : "—"}
                        <p className="text-[11px] text-muted-foreground font-normal">Average</p>
                      </td>
                    )
                    return <td key={colId} />
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      {/* ── Duplicate Dialog ── */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate {tab === "campaigns" ? "Campaign" : tab === "adsets" ? "Ad Set" : "Ad"}</DialogTitle>
            <DialogDescription>
              Choose how many copies you want to create.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Number of copies</Label>
            <Input type="number" min={1} max={20} value={duplicateCount} onChange={e => setDuplicateCount(parseInt(e.target.value) || 1)} className="mt-2" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)} disabled={isDuplicating}>Cancel</Button>
            <Button onClick={handleDuplicate} disabled={isDuplicating}>
              {isDuplicating && <IconLoader2 className="mr-2 size-4 animate-spin" />}
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── History Sheet ── */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent className="w-[480px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Launch History</SheetTitle>
            <SheetDescription>Recent ad launches for this account</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {historyLoading && (
              <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                <IconLoader2 className="size-4 animate-spin" /><span className="text-sm">Loading...</span>
              </div>
            )}
            {!historyLoading && historyBatches.length === 0 && (
              <div className="text-center py-10 text-sm text-muted-foreground">No launch history found for this account.</div>
            )}
            {!historyLoading && historyBatches.map((b: any) => (
              <div key={b.id} className="border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold",
                      b.status === "success" ? "bg-green-100 text-green-700" :
                      b.status === "partial" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                    )}>● {b.status}</span>
                    <span className="text-xs font-mono text-muted-foreground">{b.id.replace(/-/g, "").slice(-6).toUpperCase()}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div><span className="text-muted-foreground">Ads: </span><span className="font-medium">{b.total_ads} ({b.failed_ads} failed)</span></div>
                  {b.ad_account_name && <div><span className="text-muted-foreground">Account: </span><span className="font-medium">{b.ad_account_name}</span></div>}
                  {b.headline && <div className="col-span-2"><span className="text-muted-foreground">Headline: </span><span className="font-medium truncate">{b.headline}</span></div>}
                  {b.cta && <div><span className="text-muted-foreground">CTA: </span><span className="font-medium">{b.cta}</span></div>}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Ad Defaults Sheet ── */}
      <Sheet open={defaultsOpen} onOpenChange={setDefaultsOpen}>
        <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Ad Defaults</SheetTitle>
            <SheetDescription>Default copy applied when launching new ads from this account</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Primary Text</label>
              <textarea
                value={defaultPrimaryText}
                onChange={e => setDefaultPrimaryText(e.target.value)}
                rows={5}
                placeholder="Default primary ad text..."
                className="w-full px-3 py-2.5 text-sm border rounded-lg outline-none focus:ring-1 focus:ring-ring resize-none bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Headline</label>
              <Input placeholder="Default headline..." value={defaultHeadline} onChange={e => setDefaultHeadline(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">CTA</label>
                <select
                  value={defaultCta}
                  onChange={e => setDefaultCta(e.target.value)}
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                >
                  {["SHOP_NOW","LEARN_MORE","SIGN_UP","BOOK_NOW","CONTACT_US","DOWNLOAD","GET_OFFER","ORDER_NOW","SEND_MESSAGE","SUBSCRIBE","APPLY_NOW","BUY_NOW"].map(c => (
                    <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Web Link</label>
                <Input placeholder="https://..." value={defaultLink} onChange={e => setDefaultLink(e.target.value)} />
              </div>
            </div>
          </div>
          <SheetFooter className="mt-8 pt-6 border-t">
            <Button variant="ghost" onClick={() => setDefaultsOpen(false)}>Cancel</Button>
            <Button onClick={saveDefaults} className="bg-blue-600 hover:bg-blue-700 text-white">Save Defaults</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Delete {selectedIds.size} {tab === "campaigns" ? "campaign" : tab === "adsets" ? "ad set" : "ad"}{selectedIds.size > 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription>
              This will permanently delete the selected {tab === "campaigns" ? "campaign(s)" : tab === "adsets" ? "ad set(s)" : "ad(s)"} from Facebook. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <IconLoader2 className="mr-2 size-4 animate-spin" />}
              Delete{selectedIds.size > 1 ? ` (${selectedIds.size})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Customize Columns Modal ── */}
      <CustomizeColumnsModal
        open={customizeColsOpen}
        columnOrder={columnOrder}
        onApply={setColumnOrder}
        onSavePreset={saveCustomPreset}
        onClose={() => setCustomizeColsOpen(false)}
      />

      {/* ── Edit Side Panel ── */}
      <Sheet open={!!editingNode} onOpenChange={(open) => !open && setEditingNode(null)}>
        <SheetContent className="w-full sm:w-[480px] flex flex-col p-0 gap-0 overflow-hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>{tab === "campaigns" ? "Edit Campaign" : tab === "adsets" ? "Edit Ad Set" : "Edit Ad"}</SheetTitle>
            <SheetDescription>Edit settings for this {tab === "campaigns" ? "campaign" : tab === "adsets" ? "ad set" : "ad"}.</SheetDescription>
          </SheetHeader>
          {editingNode && (() => {
            const node = editingNode as any
            const isCampaign = tab === "campaigns"
            const isAdSet    = tab === "adsets"
            const isAd       = tab === "ads"
            const hasDailyBudget    = node.daily_budget != null && node.daily_budget !== ""
            const hasLifetimeBudget = node.lifetime_budget != null && node.lifetime_budget !== ""
            const hasBudget  = hasDailyBudget || hasLifetimeBudget
            const budgetCents = parseInt(node.daily_budget || node.lifetime_budget || "0")
            const insight    = getInsight(editingNode)
            const isActive   = node.status === "ACTIVE"

            const OBJECTIVE_LABEL: Record<string, string> = {
              OUTCOME_SALES: "Sales", OUTCOME_LEADS: "Leads", OUTCOME_TRAFFIC: "Traffic",
              OUTCOME_AWARENESS: "Awareness", OUTCOME_ENGAGEMENT: "Engagement",
              OUTCOME_APP_PROMOTION: "App Promotion", OUTCOME_REACH: "Reach",
              LINK_CLICKS: "Link Clicks", CONVERSIONS: "Conversions",
            }
            const BID_LABEL: Record<string, string> = {
              LOWEST_COST_WITHOUT_CAP: "Lowest cost", LOWEST_COST_WITH_BID_CAP: "Bid cap",
              COST_CAP: "Cost cap", MINIMUM_ROAS: "Min. ROAS",
            }
            const OPT_LABEL: Record<string, string> = {
              LINK_CLICKS: "Link clicks", IMPRESSIONS: "Impressions", REACH: "Reach",
              LANDING_PAGE_VIEWS: "Landing page views", CONVERSIONS: "Conversions",
              OFFSITE_CONVERSIONS: "Offsite conversions", VIDEO_VIEWS: "Video views",
              LEAD_GENERATION: "Lead generation", APP_INSTALLS: "App installs",
            }
            const fmt = (iso?: string) => iso ? iso.slice(0, 16) : ""
            const toIso = (v: string) => v ? new Date(v).toISOString() : ""
            const typeLabel = isCampaign ? "Campaign" : isAdSet ? "Ad Set" : "Ad"
            const TypeIcon  = isCampaign ? IconSpeakerphone : isAdSet ? IconTarget : IconPhoto
            const typeColor = isCampaign ? "bg-blue-500" : isAdSet ? "bg-violet-500" : "bg-emerald-500"

            return (
              <>
                {/* ── Header ── */}
                <div className="flex items-center gap-3 px-5 py-4 border-b shrink-0">
                  <div className={cn("size-9 rounded-xl flex items-center justify-center text-white shrink-0", typeColor)}>
                    <TypeIcon className="size-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{typeLabel}</p>
                    <p className="text-sm font-semibold truncate leading-tight">{node.name}</p>
                  </div>
                  <span className={cn(
                    "shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
                    isActive
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                  )}>
                    <span className={cn("size-1.5 rounded-full", isActive ? "bg-green-500" : "bg-neutral-400")} />
                    {isActive ? "Active" : "Paused"}
                  </span>
                </div>

                {/* ── Scrollable body ── */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                  {/* Performance row */}
                  {insight && (
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Spend",  value: `$${getSpend(editingNode).toFixed(2)}`, accent: true },
                        { label: "Results",value: String(getResults(editingNode, node.objective).count) },
                        { label: "Impr.",  value: parseInt(insight.impressions).toLocaleString() },
                        { label: "Clicks", value: parseInt(insight.clicks).toLocaleString() },
                      ].map(s => (
                        <div key={s.label} className="rounded-xl bg-muted/40 border px-2.5 py-2 text-center">
                          <p className="text-[10px] text-muted-foreground mb-0.5">{s.label}</p>
                          <p className={cn("text-sm font-bold tabular-nums truncate", s.accent && "text-primary")}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Settings section ── */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Settings</p>

                    {/* Name */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <Input
                        value={node.name}
                        onChange={e => setEditingNode({ ...node, name: e.target.value })}
                        className="h-9 text-sm bg-background"
                      />
                    </div>

                    {/* Status toggle */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-muted/50 border">
                        {(["ACTIVE", "PAUSED"] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => setEditingNode({ ...node, status: s })}
                            className={cn(
                              "h-8 rounded-md text-xs font-semibold transition-all",
                              node.status === s
                                ? s === "ACTIVE"
                                  ? "bg-green-500 text-white shadow-sm"
                                  : "bg-background text-foreground shadow-sm border"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {s === "ACTIVE" ? "● Active" : "○ Paused"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Budget */}
                    {(isCampaign || isAdSet) && (
                      hasBudget ? (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">
                            {hasDailyBudget ? "Daily Budget" : "Lifetime Budget"}
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">$</span>
                            <Input
                              type="number" step="0.01" min="0"
                              className="pl-7 h-9 text-sm bg-background"
                              value={budgetCents / 100}
                              onChange={e => {
                                const cents = Math.round((parseFloat(e.target.value) || 0) * 100).toString()
                                setEditingNode(hasDailyBudget ? { ...node, daily_budget: cents } : { ...node, lifetime_budget: cents })
                              }}
                            />
                          </div>
                          {isAdSet && node.budget_remaining != null && (
                            <p className="text-[11px] text-muted-foreground">
                              Remaining: <span className="font-medium text-foreground">${(parseInt(node.budget_remaining) / 100).toFixed(2)}</span>
                            </p>
                          )}
                        </div>
                      ) : isAdSet ? (
                        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 text-xs text-blue-600 dark:text-blue-400">
                          <IconSpeakerphone className="size-3.5 shrink-0" />
                          Budget set at campaign level (CBO)
                        </div>
                      ) : null
                    )}

                    {/* Schedule */}
                    {(isCampaign || isAdSet) && (
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Start</Label>
                          <Input type="datetime-local" className="h-9 text-xs bg-background"
                            value={fmt(node.start_time)}
                            onChange={e => setEditingNode({ ...node, start_time: toIso(e.target.value) })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">End</Label>
                          <Input type="datetime-local" className="h-9 text-xs bg-background"
                            value={fmt(isCampaign ? node.stop_time : node.end_time)}
                            onChange={e => {
                              const iso = toIso(e.target.value)
                              setEditingNode(isCampaign ? { ...node, stop_time: iso } : { ...node, end_time: iso })
                            }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Strategy tags ── */}
                  {((isCampaign && (node.objective || node.bid_strategy)) ||
                    (isAdSet && (node.optimization_goal || node.bid_strategy))) && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Strategy</p>
                      <div className="flex flex-wrap gap-1.5">
                        {isCampaign && node.objective && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-200/70 dark:border-blue-700/40">
                            {OBJECTIVE_LABEL[node.objective] ?? node.objective}
                          </span>
                        )}
                        {isAdSet && node.optimization_goal && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 text-xs font-medium border border-violet-200/70 dark:border-violet-700/40">
                            {OPT_LABEL[node.optimization_goal] ?? node.optimization_goal}
                          </span>
                        )}
                        {node.bid_strategy && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-muted text-muted-foreground text-xs font-medium border">
                            {BID_LABEL[node.bid_strategy] ?? node.bid_strategy}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Creative preview (Ad only) ── */}
                  {isAd && (node.creative?.thumbnail_url || node.creative?.title || node.creative?.body) && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Creative</p>
                      <div className="rounded-2xl border overflow-hidden shadow-sm">
                        {node.creative.thumbnail_url && (
                          <img src={node.creative.thumbnail_url} className="w-full object-cover max-h-52" loading="lazy" />
                        )}
                        {(node.creative.title || node.creative.body) && (
                          <div className="px-3.5 py-3 space-y-1 bg-neutral-50 dark:bg-neutral-900 border-t">
                            {node.creative.title && (
                              <p className="text-sm font-semibold leading-snug line-clamp-2 text-foreground">{node.creative.title}</p>
                            )}
                            {node.creative.body && (
                              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{node.creative.body}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── IDs ── */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Details</p>
                    <div className="rounded-xl border divide-y overflow-hidden text-xs">
                      {[
                        { label: "ID",          value: node.id },
                        ...(isAdSet ? [{ label: "Campaign ID", value: node.campaign_id }] : []),
                        ...(isAd    ? [{ label: "Ad Set ID",   value: node.adset_id }]   : []),
                      ].map(row => (
                        <div key={row.label} className="flex items-center justify-between px-3 py-2 bg-muted/10 hover:bg-muted/30 transition-colors">
                          <span className="text-muted-foreground shrink-0 mr-3">{row.label}</span>
                          <span className="font-mono text-foreground/80 truncate select-all">{row.value}</span>
                        </div>
                      ))}
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors text-left"
                        onClick={() => {
                          const actId = selectedAccountId?.replace("act_", "")
                          const url = `https://adsmanager.facebook.com/adsmanager/manage/${tab}?act=${actId}&selected_${tab.slice(0,-1)}_ids=${node.id}`
                          window.open(url, "_blank")
                        }}
                      >
                        <IconExternalLink className="size-3.5 shrink-0" />
                        View in Meta Ads Manager
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Footer ── */}
                <div className="shrink-0 border-t px-5 py-4 flex items-center justify-end gap-2 bg-background">
                  <Button variant="ghost" size="sm" onClick={() => setEditingNode(null)} className="text-muted-foreground">
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => saveSidePanelEdit(node)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5"
                  >
                    Save changes
                  </Button>
                </div>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>

    </div>
  )
}
