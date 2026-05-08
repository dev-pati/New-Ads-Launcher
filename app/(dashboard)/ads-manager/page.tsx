"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAdAccount } from "@/lib/ad-account-context"
import { cn } from "@/lib/utils"
import {
  IconSearch, IconPlus, IconCopy, IconPencil, IconRefresh,
  IconLoader2, IconChevronDown, IconChevronLeft, IconChevronRight,
  IconTrash, IconSettings, IconCalendar, IconArrowsUpDown,
  IconArrowUp, IconArrowDown, IconHistory, IconTable, IconCheck,
  IconChevronRight as IconDrillRight,
} from "@tabler/icons-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

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

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7d", label: "Last 7 days" },
  { value: "last_14d", label: "Last 14 days" },
  { value: "last_28d", label: "Last 28 days" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
]

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
        "relative inline-flex h-[18px] w-8 items-center rounded-full transition-colors shrink-0",
        isActive ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
      )}
      title={isActive ? "Click to pause" : "Click to activate"}
    >
      <span className={cn(
        "inline-block size-3 rounded-full bg-white shadow-sm transition-transform",
        isActive ? "translate-x-[18px]" : "translate-x-0.5"
      )} />
    </button>
  )
}

// ─── Delivery Badge ───────────────────────────────────────────────────────────

function DeliveryBadge({ effective_status }: { effective_status: string }) {
  const isActive = effective_status === "ACTIVE"
  return (
    <span className={cn("flex items-center gap-1.5 text-xs", isActive ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
      <span className={cn("size-2 rounded-full", isActive ? "bg-green-500" : "bg-gray-400")} />
      {isActive ? "Active" : effective_status === "PAUSED" ? "Off" : effective_status.charAt(0) + effective_status.slice(1).toLowerCase()}
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
      className={cn("px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground group", className)}
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-0.5">
        {label}
        {active
          ? (sortDir === "asc" ? <IconArrowUp className="size-3 text-primary" /> : <IconArrowDown className="size-3 text-primary" />)
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
  const [datePreset, setDatePreset] = useState("last_7d")
  const [dateDropOpen, setDateDropOpen] = useState(false)
  const dateDropRef = useRef<HTMLDivElement>(null)

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(30)
  const pageSizeRef = useRef<HTMLDivElement>(null)
  const [pageSizeOpen, setPageSizeOpen] = useState(false)

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
  const [defaultHeadline, setDefaultHeadline] = useState("")
  const [defaultCta, setDefaultCta] = useState("SHOP_NOW")
  const [defaultLink, setDefaultLink] = useState("")
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(["spend", "budget", "results", "cpr", "schedule", "delivery"]))
  const [colsOpen, setColsOpen] = useState(false)

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

  const toggleCol = (col: string) =>
    setVisibleCols(prev => { const s = new Set(prev); s.has(col) ? s.delete(col) : s.add(col); return s })

  // Close dropdowns on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dateDropRef.current && !dateDropRef.current.contains(e.target as Node)) setDateDropOpen(false)
      if (pageSizeRef.current && !pageSizeRef.current.contains(e.target as Node)) setPageSizeOpen(false)
      setColsOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  // ─── Data fetch (fetch all, filter client-side) ──────────────────────────────

  const fetchData = useCallback(async () => {
    if (!selectedAccountId) return
    setLoading(true)
    setError("")
    const t0 = Date.now()
    try {
      if (tab === "campaigns") {
        const r = await fetch(`/api/facebook/campaigns?ad_account_id=${encodeURIComponent(selectedAccountId)}&date_preset=${datePreset}`)
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || "Failed")
        setCampaigns(d.campaigns || [])
      } else if (tab === "adsets") {
        const r = await fetch(`/api/facebook/adsets?ad_account_id=${encodeURIComponent(selectedAccountId)}&date_preset=${datePreset}`)
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || "Failed")
        setAdSets(d.adSets || [])
      } else {
        const r = await fetch(`/api/facebook/ads?ad_account_id=${encodeURIComponent(selectedAccountId)}&date_preset=${datePreset}`)
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
  }, [selectedAccountId, tab, datePreset])

  useEffect(() => { fetchData() }, [fetchData])

  // Reset page & row selection when tab/search/date changes
  useEffect(() => { setPage(1); setSelectedIds(new Set()) }, [tab, search, datePreset])

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
      fetchData() // revert on fail
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
      await fetchData()
    } catch (err) {
      console.error(err)
    } finally {
      setIsDuplicating(false)
    }
  }

  // ─── Save Side Panel Edit ─────────────────────────────────────────────────────
  const saveSidePanelEdit = async (updatedNode: any) => {
    // Optimistic update
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
        })
      })
      if (!r.ok) throw new Error("Failed to update")
    } catch (err) {
      console.error(err)
      fetchData() // revert on fail
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
        if (tab === "campaigns") setCampaigns(prev => prev.filter(c => !deletedSet.has(c.id)))
        else if (tab === "adsets") setAdSets(prev => prev.filter(a => !deletedSet.has(a.id)))
        else setAds(prev => prev.filter(a => !deletedSet.has(a.id)))
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

  const currentData: (Campaign | AdSet | Ad)[] = useMemo(() => {
    let list: (Campaign | AdSet | Ad)[] = tab === "campaigns" ? campaigns : tab === "adsets" ? adSets : ads

    // Hierarchical filter — persists across all tabs
    if (tab === "adsets" && campaignFilter.size > 0) {
      list = (list as AdSet[]).filter(a => campaignFilter.has(a.campaign_id))
    }
    if (tab === "ads" && adSetFilter.size > 0) {
      list = (list as Ad[]).filter(a => adSetFilter.has(a.adset_id))
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(item => item.name.toLowerCase().includes(q) || item.id.includes(q))
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
  }, [tab, campaigns, adSets, ads, campaignFilter, adSetFilter, search, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(currentData.length / pageSize))
  const pagedData = currentData.slice((page - 1) * pageSize, page * pageSize)

  // Totals
  const totalSpend = currentData.reduce((s, item) => s + getSpend(item), 0)
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

  const dateLabel = DATE_PRESETS.find(d => d.value === datePreset)?.label || datePreset

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
            onClick={fetchData}
            disabled={loading}
            className="size-7 flex items-center justify-center border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <IconRefresh className={cn("size-3.5 text-muted-foreground", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* ── Search bar ── */}
      <div className="px-4 py-2 border-b shrink-0">
        <div className="relative max-w-lg">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search to filter by: name, ID or metrics..."
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
          />
        </div>
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
                  "flex items-center gap-1.5 px-1 py-2.5 mr-5 text-sm border-b-2 transition-colors whitespace-nowrap",
                  tab === t
                    ? "border-blue-600 text-blue-600 font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "campaigns"
                  ? <span className="size-4 shrink-0 flex items-center justify-center rounded bg-blue-600 text-white text-[9px] font-bold">A</span>
                  : <IconTable className="size-3.5 shrink-0" />
                }
                <span className="truncate max-w-[110px]">{tabLabel(t)}</span>

                {/* Filter badge — shows on all 3 tabs when filter is active */}
                {badge && (
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
          <div ref={dateDropRef} className="relative">
            <button onClick={() => setDateDropOpen(o => !o)} className="flex items-center gap-1.5 h-6 px-2 text-xs border rounded hover:bg-muted/50 whitespace-nowrap">
              <IconCalendar className="size-3" />{dateLabel} <IconChevronDown className="size-3" />
            </button>
            {dateDropOpen && (
              <div className="absolute right-0 top-full mt-1 bg-popover border rounded-xl shadow-lg z-50 py-1 w-44">
                {DATE_PRESETS.map(d => (
                  <button key={d.value} onClick={() => { setDatePreset(d.value); setDateDropOpen(false) }}
                    className={cn("w-full px-3 py-1.5 text-xs text-left hover:bg-accent", datePreset === d.value && "text-primary font-medium")}>
                    {d.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Action toolbar ── */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b shrink-0 flex-wrap">
        <button onClick={() => setDefaultsOpen(true)} className="flex items-center gap-1.5 h-7 px-2.5 text-xs border rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground">
          <IconSettings className="size-3.5" />Ad defaults
        </button>
        <button onClick={() => router.push("/launch")} className="flex items-center gap-1.5 h-7 px-3 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors font-medium">
          <IconPlus className="size-3.5" />Create
        </button>
        <button
          disabled={selectedIds.size === 0}
          onClick={() => setDuplicateDialogOpen(true)}
          className="flex items-center gap-1.5 h-7 px-2.5 text-xs border rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground disabled:opacity-40"
        >
          <IconCopy className="size-3.5" />
          Duplicate{selectedIds.size > 0 && ` (${selectedIds.size})`}
        </button>
        <button
          disabled={selectedIds.size === 0}
          onClick={() => setEditingNode(currentData.find(x => x.id === Array.from(selectedIds)[0]) || null)}
          className="flex items-center gap-1.5 h-7 px-2.5 text-xs border rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground disabled:opacity-40"
        >
          <IconPencil className="size-3.5" />
          Edit{selectedIds.size > 0 && ` (${selectedIds.size})`}
        </button>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => Array.from(selectedIds).forEach(id => toggleStatus(id, "ACTIVE"))}
              className="h-7 px-2.5 text-xs border rounded-lg hover:bg-muted/50 transition-colors text-blue-600 font-medium"
            >
              Activate
            </button>
            <button
              onClick={() => Array.from(selectedIds).forEach(id => toggleStatus(id, "PAUSED"))}
              className="h-7 px-2.5 text-xs border rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground"
            >
              Pause
            </button>
          </div>
        )}

        {/* Sync pair */}
        <button onClick={fetchData} className="size-7 flex items-center justify-center border rounded-lg hover:bg-muted/50 transition-colors" title="Sync">
          <IconRefresh className="size-3.5 text-muted-foreground" />
        </button>
        <button className="size-7 flex items-center justify-center border rounded-lg hover:bg-muted/50 transition-colors" title="Refresh">
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
          <div className="relative">
            <button onClick={() => setColsOpen(v => !v)} className="flex items-center gap-1.5 h-7 px-2.5 text-xs border rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground">
              <IconTable className="size-3.5" />Columns <IconChevronDown className="size-3" />
            </button>
            {colsOpen && (
              <div className="absolute right-0 top-full mt-1 bg-popover border rounded-xl shadow-lg z-50 w-52 p-2" onClick={e => e.stopPropagation()}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 mb-1.5">Toggle columns</p>
                {[
                  { key: "spend", label: "Amount Spent" },
                  { key: "budget", label: "Budget" },
                  { key: "results", label: "Results" },
                  { key: "cpr", label: "Cost per Result" },
                  { key: "schedule", label: "Schedule / Ends" },
                  { key: "delivery", label: "Delivery" },
                  { key: "impressions", label: "Impressions" },
                  { key: "clicks", label: "Clicks" },
                  { key: "ctr", label: "CTR" },
                  { key: "cpc", label: "CPC" },
                ].map(col => (
                  <button key={col.key} onClick={() => toggleCol(col.key)}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left">
                    <span className={cn("size-4 rounded border flex items-center justify-center shrink-0 transition-colors", visibleCols.has(col.key) ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                      {visibleCols.has(col.key) && <IconCheck className="size-2.5 text-primary-foreground" />}
                    </span>
                    <span className="text-xs">{col.label}</span>
                  </button>
                ))}
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

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="w-full text-sm border-collapse" style={{ minWidth: 1100 }}>
            <thead className="sticky top-0 z-10 bg-background border-b">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input ref={headerCheckRef} type="checkbox" className="rounded size-3.5 accent-blue-600" checked={allSelected} onChange={toggleAll} />
                </th>
                <th className="w-16 px-2 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">Off/On</th>

                {tab === "campaigns" && <>
                  <SortTh label="Campaign" field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="min-w-[220px]" />
                  {visibleCols.has("spend") && <SortTh label="Amount spent" field="spend" sortField={sortField} sortDir={sortDir} onSort={handleSort} />}
                  {visibleCols.has("budget") && <SortTh label="Daily budget" field="budget" sortField={sortField} sortDir={sortDir} onSort={handleSort} />}
                  {visibleCols.has("results") && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">Results</th>}
                  {visibleCols.has("cpr") && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">Cost per result</th>}
                  {visibleCols.has("schedule") && <>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">Schedule</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">Ends</th>
                  </>}
                  {visibleCols.has("delivery") && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">Delivery</th>}
                </>}

                {tab === "adsets" && <>
                  <SortTh label="Ad set" field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="min-w-[220px]" />
                  {visibleCols.has("spend") && <SortTh label="Amount spent" field="spend" sortField={sortField} sortDir={sortDir} onSort={handleSort} />}
                  {visibleCols.has("budget") && <SortTh label="Budget" field="budget" sortField={sortField} sortDir={sortDir} onSort={handleSort} />}
                  {visibleCols.has("results") && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">Results</th>}
                  {visibleCols.has("cpr") && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">Cost per result</th>}
                  {visibleCols.has("schedule") && <>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">Optimization</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">Schedule</th>
                  </>}
                  {visibleCols.has("delivery") && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">Delivery</th>}
                </>}

                {tab === "ads" && <>
                  <SortTh label="Ad name" field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="min-w-[220px]" />
                  <th className="w-20 px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">Preview</th>
                  {visibleCols.has("spend") && <SortTh label="Amount spent" field="spend" sortField={sortField} sortDir={sortDir} onSort={handleSort} />}
                  {visibleCols.has("results") && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">Results</th>}
                  {visibleCols.has("cpr") && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">Cost per result</th>}
                  {visibleCols.has("delivery") && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">Delivery</th>}
                </>}
              </tr>
            </thead>

            <tbody>
              {pagedData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-16 text-muted-foreground text-sm">
                    {search ? "No results match your search" : `No ${tab} found`}
                  </td>
                </tr>
              ) : tab === "campaigns" ? (
                (pagedData as Campaign[]).map(c => {
                  const ins = getInsight(c)
                  const spend = getSpend(c)
                  const { count: resultCount, type: resultType } = getResults(c, c.objective)
                  const cpr = getCostPerResult(c, c.objective)
                  const isSel = selectedIds.has(c.id)
                  return (
                    <tr key={c.id} className={cn("border-b hover:bg-muted/20 transition-colors group", isSel && "bg-blue-50/40 dark:bg-blue-950/10")}>
                      <td className="px-3 py-2.5">
                        <input type="checkbox" className="rounded size-3.5 accent-blue-600" checked={isSel}
                          onChange={() => setSelectedIds(prev => { const s = new Set(prev); isSel ? s.delete(c.id) : s.add(c.id); return s })} />
                      </td>
                      <td className="px-2 py-2.5">
                        {toggling.has(c.id)
                          ? <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
                          : <StatusToggle id={c.id} status={c.status} onToggle={toggleStatus} />
                        }
                      </td>
                      <td className="px-3 py-2.5">
                        {inlineEditingId === c.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={inlineEditingName}
                              onChange={e => setInlineEditingName(e.target.value)}
                              onBlur={() => saveInlineRename(c.id)}
                              onKeyDown={e => e.key === "Enter" && saveInlineRename(c.id)}
                              className="h-7 text-sm py-1"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <div className="group/name flex items-center gap-2">
                            <button
                              onClick={() => drillToAdSets(c)}
                              className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium text-left line-clamp-2"
                            >
                              {c.name}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setInlineEditingId(c.id);
                                setInlineEditingName(c.name);
                              }}
                              className="opacity-0 group-hover/name:opacity-100 p-1 hover:bg-muted rounded transition-opacity"
                            >
                              <IconPencil className="size-3 text-muted-foreground" />
                            </button>
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground">{c.id}</p>
                      </td>
                      {visibleCols.has("spend") && <td className="px-3 py-2.5 text-sm tabular-nums">{ins ? `$${spend.toFixed(2)}` : "—"}</td>}
                      {visibleCols.has("budget") && <td className="px-3 py-2.5 text-sm tabular-nums">
                        {c.daily_budget ? fmtBudget(c.daily_budget) : c.lifetime_budget ? fmtBudget(c.lifetime_budget) : "—"}
                      </td>}
                      {visibleCols.has("results") && <td className="px-3 py-2.5">
                        <span className="text-sm tabular-nums">{ins ? resultCount : "—"}</span>
                        {ins && <p className="text-[10px] text-muted-foreground">{resultType}</p>}
                      </td>}
                      {visibleCols.has("cpr") && <td className="px-3 py-2.5">
                        <span className="text-sm tabular-nums">{cpr || "—"}</span>
                        {cpr && <p className="text-[10px] text-muted-foreground">Per {resultType}</p>}
                      </td>}
                      {visibleCols.has("schedule") && <>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmtDate(c.start_time)}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmtDate(c.stop_time)}</td>
                      </>}
                      {visibleCols.has("delivery") && <td className="px-3 py-2.5"><DeliveryBadge effective_status={c.effective_status} /></td>}
                    </tr>
                  )
                })
              ) : tab === "adsets" ? (
                (pagedData as AdSet[]).map(a => {
                  const ins = getInsight(a)
                  const spend = getSpend(a)
                  const campaign = campaigns.find(c => c.id === a.campaign_id)
                  const { count: resultCount, type: resultType } = getResults(a, campaign?.objective)
                  const cpr = getCostPerResult(a, campaign?.objective)
                  const isSel = selectedIds.has(a.id)
                  return (
                    <tr key={a.id} className={cn("border-b hover:bg-muted/20 transition-colors group", isSel && "bg-blue-50/40 dark:bg-blue-950/10")}>
                      <td className="px-3 py-2.5">
                        <input type="checkbox" className="rounded size-3.5 accent-blue-600" checked={isSel}
                          onChange={() => setSelectedIds(prev => { const s = new Set(prev); isSel ? s.delete(a.id) : s.add(a.id); return s })} />
                      </td>
                      <td className="px-2 py-2.5">
                        {toggling.has(a.id)
                          ? <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
                          : <StatusToggle id={a.id} status={a.status} onToggle={toggleStatus} />
                        }
                      </td>
                      <td className="px-3 py-2.5">
                        {inlineEditingId === a.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={inlineEditingName}
                              onChange={e => setInlineEditingName(e.target.value)}
                              onBlur={() => saveInlineRename(a.id)}
                              onKeyDown={e => e.key === "Enter" && saveInlineRename(a.id)}
                              className="h-7 text-sm py-1"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <div className="group/name flex items-center gap-2">
                            <button onClick={() => drillToAds(a)} className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium text-left line-clamp-2">
                              {a.name}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setInlineEditingId(a.id);
                                setInlineEditingName(a.name);
                              }}
                              className="opacity-0 group-hover/name:opacity-100 p-1 hover:bg-muted rounded transition-opacity"
                            >
                              <IconPencil className="size-3 text-muted-foreground" />
                            </button>
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground">{a.id}</p>
                      </td>
                      {visibleCols.has("spend") && <td className="px-3 py-2.5 text-sm tabular-nums">{ins ? `$${spend.toFixed(2)}` : "—"}</td>}
                      {visibleCols.has("budget") && <td className="px-3 py-2.5 text-sm tabular-nums">
                        {a.daily_budget ? fmtBudget(a.daily_budget) : a.lifetime_budget ? fmtBudget(a.lifetime_budget) : "—"}
                      </td>}
                      {visibleCols.has("results") && <td className="px-3 py-2.5">
                        <span className="text-sm">{ins ? resultCount : "—"}</span>
                        {ins && <p className="text-[10px] text-muted-foreground">{resultType}</p>}
                      </td>}
                      {visibleCols.has("cpr") && <td className="px-3 py-2.5">
                        <span className="text-sm">{cpr || "—"}</span>
                        {cpr && <p className="text-[10px] text-muted-foreground">Per {resultType}</p>}
                      </td>}
                      {visibleCols.has("schedule") && <>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.optimization_goal?.replace(/_/g, " ").toLowerCase() || "—"}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmtDate(a.start_time)}</td>
                      </>}
                      {visibleCols.has("delivery") && <td className="px-3 py-2.5"><DeliveryBadge effective_status={a.effective_status} /></td>}
                    </tr>
                  )
                })
              ) : (
                (pagedData as Ad[]).map(a => {
                  const ins = getInsight(a)
                  const spend = getSpend(a)
                  const adSet = adSets.find(s => s.id === a.adset_id)
                  const campaign = campaigns.find(c => c.id === a.campaign_id)
                  const { count: resultCount, type: resultType } = getResults(a, campaign?.objective)
                  const cpr = getCostPerResult(a, campaign?.objective)
                  const isSel = selectedIds.has(a.id)
                  const thumb = a.creative?.thumbnail_url || a.creative?.image_url
                  return (
                    <tr key={a.id} className={cn("border-b hover:bg-muted/20 transition-colors group", isSel && "bg-blue-50/40 dark:bg-blue-950/10")}>
                      <td className="px-3 py-2.5">
                        <input type="checkbox" className="rounded size-3.5 accent-blue-600" checked={isSel}
                          onChange={() => setSelectedIds(prev => { const s = new Set(prev); isSel ? s.delete(a.id) : s.add(a.id); return s })} />
                      </td>
                      <td className="px-2 py-2.5">
                        {toggling.has(a.id)
                          ? <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
                          : <StatusToggle id={a.id} status={a.status} onToggle={toggleStatus} />
                        }
                      </td>
                      <td className="px-3 py-2.5">
                        {inlineEditingId === a.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={inlineEditingName}
                              onChange={e => setInlineEditingName(e.target.value)}
                              onBlur={() => saveInlineRename(a.id)}
                              onKeyDown={e => e.key === "Enter" && saveInlineRename(a.id)}
                              className="h-7 text-sm py-1"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <div className="group/name flex items-center gap-2">
                            <p className="text-sm font-medium line-clamp-2">{a.name}</p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setInlineEditingId(a.id);
                                setInlineEditingName(a.name);
                              }}
                              className="opacity-0 group-hover/name:opacity-100 p-1 hover:bg-muted rounded transition-opacity"
                            >
                              <IconPencil className="size-3 text-muted-foreground" />
                            </button>
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground">{a.id}</p>
                        {adSet && <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">↳ {adSet.name}</p>}
                      </td>
                      <td className="px-3 py-2.5">
                        {thumb
                          ? <img src={thumb} alt="" className="size-12 rounded object-cover border" />
                          : <div className="size-12 rounded bg-muted border flex items-center justify-center text-[10px] text-muted-foreground">No img</div>
                        }
                      </td>
                      {visibleCols.has("spend") && <td className="px-3 py-2.5 text-sm tabular-nums">{ins ? `$${spend.toFixed(2)}` : "—"}</td>}
                      {visibleCols.has("results") && <td className="px-3 py-2.5">
                        <span className="text-sm">{ins ? resultCount : "—"}</span>
                        {ins && <p className="text-[10px] text-muted-foreground">{resultType}</p>}
                      </td>}
                      {visibleCols.has("cpr") && <td className="px-3 py-2.5">
                        <span className="text-sm">{cpr || "—"}</span>
                        {cpr && <p className="text-[10px] text-muted-foreground">Per {resultType}</p>}
                      </td>}
                      {visibleCols.has("delivery") && <td className="px-3 py-2.5"><DeliveryBadge effective_status={a.effective_status} /></td>}
                    </tr>
                  )
                })
              )}
            </tbody>

            {/* ── Totals row ── */}
            {pagedData.length > 0 && (
              <tfoot>
                <tr className="border-t bg-muted/10">
                  <td colSpan={3} className="px-3 py-2.5 text-xs text-muted-foreground font-medium">
                    Results from {currentData.length} {tab === "campaigns" ? "campaigns" : tab === "adsets" ? "ad sets" : "ads"}
                  </td>
                  {visibleCols.has("spend") && <td className="px-3 py-2.5 text-xs font-semibold tabular-nums">
                    ${totalSpend.toFixed(2)}
                    <p className="text-muted-foreground font-normal">Total spent</p>
                  </td>}
                  <td colSpan={99} />
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

      {/* ── Edit Side Panel (Sheet) ── */}
      <Sheet open={!!editingNode} onOpenChange={(open) => !open && setEditingNode(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit {tab === "campaigns" ? "Campaign" : tab === "adsets" ? "Ad Set" : "Ad"}</SheetTitle>
            <SheetDescription>Make changes to your settings here.</SheetDescription>
          </SheetHeader>
          {editingNode && (
            <div className="py-6 space-y-8">
              {/* Performance Summary */}
              {getInsight(editingNode) && (
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30 border">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Spend</p>
                    <p className="text-lg font-bold">${getSpend(editingNode).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Results</p>
                    <p className="text-lg font-bold">{getResults(editingNode, (editingNode as any).objective).count}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Impressions</p>
                    <p className="text-sm font-medium">{parseInt(getInsight(editingNode)!.impressions).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Clicks</p>
                    <p className="text-sm font-medium">{parseInt(getInsight(editingNode)!.clicks).toLocaleString()}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Name</Label>
                  <Input value={editingNode.name} onChange={e => setEditingNode({ ...editingNode, name: e.target.value } as any)} />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Status</Label>
                  <select 
                    className="w-full h-10 rounded-lg border bg-background px-3 text-sm shadow-sm focus:ring-1 focus:ring-primary outline-none"
                    value={editingNode.status} 
                    onChange={e => setEditingNode({ ...editingNode, status: e.target.value } as any)}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="PAUSED">Paused</option>
                  </select>
                </div>

                {('daily_budget' in editingNode || 'lifetime_budget' in editingNode) && (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">
                      {('daily_budget' in editingNode) ? 'Daily Budget' : 'Lifetime Budget'} ($)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input 
                        type="number" 
                        step="0.01"
                        className="pl-7"
                        value={((parseInt((editingNode as any).daily_budget || (editingNode as any).lifetime_budget || "0")) / 100)} 
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0
                          const cents = Math.round(val * 100).toString()
                          if ((editingNode as any).daily_budget) setEditingNode({ ...editingNode, daily_budget: cents } as any)
                          else setEditingNode({ ...editingNode, lifetime_budget: cents } as any)
                        }} 
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Drill down info */}
              <div className="pt-4 border-t">
                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2">ID: {editingNode.id}</p>
                {tab === "adsets" && <p className="text-xs text-muted-foreground">Campaign ID: {(editingNode as AdSet).campaign_id}</p>}
                {tab === "ads" && (
                  <>
                    <p className="text-xs text-muted-foreground">Ad Set ID: {(editingNode as Ad).adset_id}</p>
                    { (editingNode as Ad).creative?.thumbnail_url && (
                      <div className="mt-4">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2">Creative Preview</p>
                        <img src={(editingNode as Ad).creative?.thumbnail_url} className="w-full aspect-video rounded-lg object-cover border" />
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="pt-4 border-t">
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-blue-600 text-xs" 
                  onClick={() => {
                    const actId = selectedAccountId?.replace("act_", "")
                    const url = `https://adsmanager.facebook.com/adsmanager/manage/${tab}?act=${actId}&selected_${tab.slice(0,-1)}_ids=${editingNode.id}`
                    window.open(url, "_blank")
                  }}
                >
                  View in Meta Ads Manager ↗
                </Button>
              </div>
            </div>
          )}
          <SheetFooter className="mt-auto pt-6 border-t">
            <Button variant="ghost" onClick={() => setEditingNode(null)}>Cancel</Button>
            <Button onClick={() => editingNode && saveSidePanelEdit(editingNode)} className="bg-blue-600 hover:bg-blue-700 text-white">
              Save Changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

    </div>
  )
}
