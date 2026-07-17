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
  IconAdjustments, IconDownload,
} from "@tabler/icons-react"
import { type Level, type ReportRow } from "@/components/ads-manager/InsightDrawers"
import { PerformancePopup } from "@/components/ads-manager/PerformancePopup"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CreateCampaignModal } from "@/components/ads-manager/create-flow/CreateCampaignModal"
import { CustomizeColumnsModal } from "@/components/ads-manager/CustomizeColumnsModal"
import { AdsDateRangePicker, getPresetRange } from "@/components/ads-manager/AdsDateRangePicker"
import { COLUMN_DEFS, COLUMN_MAP, DEFAULT_PRESETS, ColumnPreset, CustomMetricConfig, getActivePreset, toColumnDef } from "@/lib/column-config"
import { evalCustomMetric } from "@/lib/custom-metric-eval"
import { BreakdownDropdown } from "@/components/ads-manager/BreakdownDropdown"
import { BREAKDOWN_API_MAP } from "@/lib/breakdown-config"

// ─── Helpers ──────────────────────────────────────────────────────────────────
function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const csv = [
    headers.map(esc).join(","),
    ...rows.map(r => headers.map(h => esc(r[h])).join(","))
  ].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "campaigns" | "adsets" | "ads"
type SortDir = "asc" | "desc"

const STANDARD_ATTR = [
  { key: "1d_click", label: "1-day click", desc: "Conversions counted after an action within 1 day of an ad click." },
  { key: "7d_click", label: "7-day click", desc: "Conversions counted after an action within 7 days of an ad click." },
  { key: "28d_click", label: "28-day click", desc: "Conversions counted after an action within 28 days of an ad click." },
  { key: "1d_view", label: "1-day view", desc: "Conversions counted after an action within 1 day of an ad impression." },
  { key: "1d_ev", label: "1-day engagement", desc: "Counted after an interaction (ad click or video view) within 1 day." },
]
const SKAN_ATTR = [
  { key: "skan_view", label: "View from SKAdNetwork", desc: "Attributed when someone views an ad and installs the app within 24 hours." },
  { key: "skan_click", label: "Click from SKAdNetwork", desc: "Attributed when someone clicks an ad and installs the app within 30 days." },
]

interface Insight {
  spend: string
  impressions: string
  clicks: string
  reach?: string
  frequency?: string
  cpm?: string
  ctr?: string
  inline_link_clicks?: string
  unique_clicks?: string
  unique_inline_link_clicks?: string
  unique_link_clicks_ctr?: string
  actions?: { action_type: string; value: string }[]
  action_values?: { action_type: string; value: string }[]
  cost_per_action_type?: { action_type: string; value: string }[]
  video_avg_time_watched_actions?: { action_type: string; value: string }[]
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

interface LearningStageInfo {
  status?: "LEARNING" | "SUCCESS" | "LEARNING_LIMITED" | string
  conversions?: number
}

interface AttributionSpecEntry {
  event_type?: string
  window_days?: number
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
  attribution_spec?: AttributionSpecEntry[]
  learning_stage_info?: LearningStageInfo
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
  adset?: {
    attribution_spec?: AttributionSpecEntry[]
    bid_strategy?: string
    learning_stage_info?: LearningStageInfo
  }
  creative?: { id: string; title?: string; body?: string; image_url?: string; thumbnail_url?: string }
  creative_variations?: { bodies: string[]; titles: string[]; descriptions: string[] }
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

const ACTION_ALIASES: Record<string, string[]> = {
  omni_purchase: ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase", "onsite_conversion.purchase"],
  purchase: ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase", "onsite_conversion.purchase"],
  lead: ["lead", "omni_lead", "offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped", "onsite_conversion.lead"],
  link_click: ["link_click", "omni_link_click"],
  add_to_cart: ["omni_add_to_cart", "add_to_cart", "offsite_conversion.fb_pixel_add_to_cart", "onsite_conversion.add_to_cart"],
  initiate_checkout: ["omni_initiate_checkout", "initiate_checkout", "offsite_conversion.fb_pixel_initiate_checkout"],
  view_content: ["omni_view_content", "view_content", "offsite_conversion.fb_pixel_view_content"],
  landing_page_view: ["landing_page_view", "omni_landing_page_view"],
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
  return `$${(parseInt(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso?: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatMetaDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getInsight(item: Campaign | AdSet | Ad): Insight | null {
  return item.insights?.data?.[0] || null
}

function getMetricValue(items: { action_type: string; value: string }[] | undefined, actionType: string): number {
  if (!items?.length) return 0
  // Meta returns the same conversion under multiple action_type keys (e.g. a purchase
  // shows as omni_purchase, purchase, AND offsite_conversion.fb_pixel_purchase in the
  // same actions[] array). Summing aliases double/triple-counts. Pick the first alias
  // that exists, in priority order — that matches the Ads Manager UI count.
  const aliases = ACTION_ALIASES[actionType] || [actionType]
  for (const alias of aliases) {
    const item = items.find(entry => entry.action_type === alias)
    if (item) return parseFloat(item.value || "0") || 0
  }
  return 0
}

function getActionCount(ins: Insight | null, actionType: string): number {
  return getMetricValue(ins?.actions, actionType)
}

function getActionValueAmount(ins: Insight | null, actionType: string): number {
  return getMetricValue(ins?.action_values, actionType)
}

function formatMoneyAmount(value: number): string {
  return Number.isFinite(value) && value > 0 ? `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"
}

// Inline money formatter with thousands separators — used in JSX cell renders.
function fmtMoney(v: number): string {
  if (!Number.isFinite(v) || v === 0) return "$0.00"
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Inline percentage formatter with thousands separators for large values.
function fmtPct(v: number): string {
  if (!Number.isFinite(v)) return "0.00%"
  return `${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
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
  return { count: getActionCount(ins, obj.actionType), type: obj.type }
}

// Meta-style stacked Results cell: Total count, Per Action cost, and conversion rate %.
// Video objectives report Average watch time instead of a conversion rate.
function getResultsDetail(item: Campaign | AdSet | Ad, objective?: string) {
  const ins = getInsight(item)
  if (!ins?.actions) return null
  const { count, type } = getResults(item, objective)
  const perAction = getCostPerResult(item, objective) // "$x.xx" | null
  const linkClicks = parseFloat(ins.inline_link_clicks || "0")
  const rate = count > 0 && linkClicks > 0 ? (count / linkClicks) * 100 : null
  // Avg watch time (seconds) for video-style objectives
  const avgWatchRaw = ins.video_avg_time_watched_actions?.find(a => a.action_type === "video_view")?.value
    ?? ins.video_avg_time_watched_actions?.[0]?.value
  const avgWatch = avgWatchRaw ? parseFloat(avgWatchRaw) : null
  return { count, type, perAction, rate, avgWatch }
}

function fmtWatch(sec: number): string {
  const s = Math.round(sec)
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}

function getCostPerResult(item: Campaign | AdSet | Ad, objective?: string) {
  const ins = getInsight(item)
  const spend = getSpend(item)
  const obj = OBJECTIVE_RESULT[objective || ""]
  if (!obj) return null
  const cpa = ins?.cost_per_action_type?.find(a => (ACTION_ALIASES[obj.actionType] || [obj.actionType]).includes(a.action_type))
  if (!cpa) {
    const count = getActionCount(ins, obj.actionType)
    return count > 0 ? fmtMoney((spend / count)) : null
  }
  const value = parseFloat(cpa.value)
  if (Number.isFinite(value)) return fmtMoney(value)
  const count = getActionCount(ins, obj.actionType)
  return count > 0 ? fmtMoney((spend / count)) : null
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

// Meta attribution_spec entries — single-click entries carry event_type+window_days.
const CLICK_WINDOW_LABEL: Record<number, string> = { 1: "1d-click", 7: "7d-click", 28: "28d-click" }
function formatAttributionSpec(spec: AttributionSpecEntry[] | string | undefined | null): string {
  if (!spec) return "All conversions"
  if (typeof spec === "string") {
    const s = spec.trim()
    if (!s) return "All conversions"
    if (s.toLowerCase().includes("incremental")) return "Incremental attribution"
    return s
  }
  if (!Array.isArray(spec) || !spec.length) return "All conversions"
  const parts = spec.map(e => {
    const etRaw = (e.event_type || "").toLowerCase()
    // Meta returns CLICK_THROUGH / VIEW_THROUGH / ENGAGED_VIEW; normalize all spellings.
    const et = etRaw.includes("increment") ? "incremental"
      : etRaw.includes("click") ? "click"
      : etRaw.includes("view") ? "view"
      : etRaw.includes("engag") ? "engagement"
      : etRaw
    const w = e.window_days
    if (et === "incremental") return "Incremental attribution"
    if (et === "click") return (w != null ? CLICK_WINDOW_LABEL[w] : undefined) ?? `${w ?? 0}d-click`
    if (et === "view") return w === 1 ? "1d-view" : `${w ?? 1}d-view`
    if (et === "engagement") return `${w ?? 1}d-engagement`
    return `${et}${w ? `-${w}d` : ""}`
  }).filter(Boolean)
  return parts.length ? Array.from(new Set(parts)).join(", ") : "All conversions"
}

function formatBidStrategy(raw: string | null | undefined): string {
  if (!raw) return "—"
  return raw.replace(/_/g, " ").toLowerCase()
}

function DeliveryBadge({ effective_status, learning }: { effective_status: string; budget_remaining?: string; learning?: LearningStageInfo }) {
  // Campaigns have no learning state here → Active / Off only.
  // Ad sets and ads pass learning_stage_info → keep Meta's Learning state.
  // Budget remaining (including $0.00 remaining) must not turn Active into a warning state.
  const isActive = effective_status === "ACTIVE"
  const learnStatus = isActive ? learning?.status : undefined
  const isLearning = learnStatus === "LEARNING"
  const isLearningLimited = learnStatus === "LEARNING_LIMITED"
  const dot = isLearning || isLearningLimited ? "bg-[#1877f2]" : isActive ? "bg-[#31a24c]" : "bg-[#8a8d91]"
  const label = isLearning ? "Learning" : isLearningLimited ? "Learning limited" : isActive ? "Active" : "Off"
  return (
    <span className="flex items-center gap-1.5 text-sm font-medium text-[#1c2b33] dark:text-gray-300">
      <span className={cn("size-[7px] rounded-full shrink-0", dot)} />
      {label}
      {isLearning && typeof learning?.conversions === "number" && <span className="text-[#65676b]">({learning.conversions}/50)</span>}
    </span>
  )
}

// ─── Sort Header ──────────────────────────────────────────────────────────────

function SortTh({ label, field, sortField, sortDir, onSort, width, onResize, className }: {
  label: string; field: string; sortField: string | null; sortDir: SortDir
  onSort: (f: string) => void; width?: number; onResize?: (w: number) => void; className?: string
}) {
  const active = sortField === field
  const handleDrag = (e: React.MouseEvent) => {
    if (!onResize || !width) return
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    const onMove = (me: MouseEvent) => onResize(Math.max(60, startW + me.clientX - startX))
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp) }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  return (
    <th
      style={{ width: width ? `${width}px` : undefined, minWidth: width ? `${width}px` : undefined, maxWidth: width ? `${width}px` : undefined }}
      className={cn("relative px-3 py-2 text-left text-xs font-bold text-[#1c2b33] dark:text-foreground cursor-pointer select-none whitespace-nowrap hover:bg-black/5 dark:hover:bg-white/5", className)}
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1 overflow-hidden">
        <span className="truncate">{label}</span>
        {active
          ? (sortDir === "asc" ? <IconArrowUp className="size-3 shrink-0 text-[#1877f2]" /> : <IconArrowDown className="size-3 shrink-0 text-[#1877f2]" />)
          : <IconArrowsUpDown className="size-3 shrink-0 opacity-0 group-hover:opacity-50" />
        }
      </span>
      {onResize && (
        <div
          onMouseDown={handleDrag}
          onClick={e => e.stopPropagation()}
          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/50 opacity-0 hover:opacity-100 transition-opacity"
        />
      )}
    </th>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// Per-column header context menu: sort + column management actions (Meta-style).
function HeaderCellMenu({ colId, label, onSortAsc, onSortDesc, onMoveLeft, onMoveRight, onRemove, canMoveLeft, canMoveRight, onOpenAttributionCompare }: {
  colId: string
  label: string
  onSortAsc: () => void
  onSortDesc: () => void
  onMoveLeft: () => void
  onMoveRight: () => void
  onRemove: () => void
  canMoveLeft: boolean
  canMoveRight: boolean
  onOpenAttributionCompare?: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])
  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
        title="Column options"
      >
        <IconChevronDown className="size-3 opacity-50" />
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-50 w-56 bg-background border rounded-lg shadow-xl py-1 text-xs">
          <button onClick={() => { onSortAsc(); setOpen(false) }} className="w-full text-left px-3 py-1.5 hover:bg-muted/50 flex items-center gap-2">
            <IconArrowUp className="size-3.5" /> Sort ascending
          </button>
          <button onClick={() => { onSortDesc(); setOpen(false) }} className="w-full text-left px-3 py-1.5 hover:bg-muted/50 flex items-center gap-2">
            <IconArrowDown className="size-3.5" /> Sort descending
          </button>
          <div className="my-1 border-t" />
          <button onClick={() => { onMoveLeft(); setOpen(false) }} disabled={!canMoveLeft} className="w-full text-left px-3 py-1.5 hover:bg-muted/50 disabled:opacity-40 flex items-center gap-2">
            <IconChevronLeft className="size-3.5" /> Move left
          </button>
          <button onClick={() => { onMoveRight(); setOpen(false) }} disabled={!canMoveRight} className="w-full text-left px-3 py-1.5 hover:bg-muted/50 disabled:opacity-40 flex items-center gap-2">
            <IconChevronRight className="size-3.5" /> Move right
          </button>
          <button onClick={() => { onRemove(); setOpen(false) }} className="w-full text-left px-3 py-1.5 hover:bg-muted/50 text-destructive flex items-center gap-2">
            <IconX className="size-3.5" /> Remove column
          </button>

          {colId === "attribution_setting" && onOpenAttributionCompare && (
            <>
              <div className="my-1 border-t" />
              <button
                onClick={() => { onOpenAttributionCompare(); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 hover:bg-muted/50 flex items-center gap-2"
              >
                <IconAdjustments className="size-3.5" /> Compare attribution settings
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdsManagerPage() {
  const { selectedAccountId, selectedAccount, adAccounts, setSelectedAccountId } = useAdAccount()

  const [tab, setTab] = useState<Tab>("campaigns")
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [adSets, setAdSets] = useState<AdSet[]>([])
  const [ads, setAds] = useState<Ad[]>([])
  const [accountSummary, setAccountSummary] = useState<Insight | null>(null)
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
  const [columnOrder,       setColumnOrder]       = useState<string[]>(DEFAULT_PRESETS[4].columns)
  const [columnWidths,      setColumnWidths]      = useState<Record<string, number>>({})
  const [customPresets,     setCustomPresets]     = useState<ColumnPreset[]>([])
  const [customMetrics,     setCustomMetrics]     = useState<CustomMetricConfig[]>([])
  const [colsOpen,          setColsOpen]          = useState(false)
  const [customizeColsOpen, setCustomizeColsOpen] = useState(false)
  const [attributionWindows, setAttributionWindows] = useState<string[]>([])
  const [attributionCompareOpen, setAttributionCompareOpen] = useState(false)
  const [draftAttribution, setDraftAttribution] = useState<string[]>([])
  const [breakdowns,        setBreakdowns]        = useState<string[]>([])
  const [breakdownRows,     setBreakdownRows]     = useState<BreakdownRow[]>([])
  const [breakdownError,    setBreakdownError]    = useState("")
  const [performancePopup, setPerformancePopup] = useState<{ mode: "charts" | "compare"; rows: ReportRow[] } | null>(null)

  const router = useRouter()
  const level: Level = tab === "campaigns" ? "campaign" : tab === "adsets" ? "adset" : "ad"
  const usesCustomRange = (datePreset === "custom" || datePreset === "maximum") && customDateRange
  const drawerSince = usesCustomRange ? formatMetaDate(customDateRange.start) : ""
  const drawerUntil = usesCustomRange ? formatMetaDate(customDateRange.end) : ""
  const toReportRow = (node: { id: string; name: string }): ReportRow =>
    ({ id: node.id, name: node.name, adId: tab === "ads" ? node.id : undefined })
  const customColumnMap = useMemo(() => ({ ...COLUMN_MAP, ...Object.fromEntries(customMetrics.map(m => [m.id, toColumnDef(m)])) }), [customMetrics])
  const customMetricById = useMemo(() => new Map(customMetrics.map(m => [m.id, m])), [customMetrics])
  const getColWidth = (id: string) => {
    const label = customColumnMap[id]?.headerLabel || ""
    const def = label.length > 34 ? 160 : label.length > 20 ? 135 : 112
    return columnWidths[id] || def
  }
  const isTextCol = (id: string) => [
    "delivery", "effective_status", "attribution_setting", "budget", "lifetime_budget",
    "schedule_start", "schedule_end", "bid_strategy", "boosted_object_id", "buying_type",
    "objective", "smart_promotion_type", "special_ad_category", "account_id", "date_created",
    "issues_info", "optimization_goal", "updated_time",
  ].includes(id)
  const setColWidth = (id: string, width: number) => setColumnWidths(prev => ({ ...prev, [id]: width }))
  const startColResize = (id: string, startWidth: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const onMove = (me: MouseEvent) => setColWidth(id, Math.max(60, startWidth + me.clientX - startX))
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp) }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  // Open the big Meta-style popup. Compare uses the multi-selection when the clicked
  // row is part of it; otherwise falls back to just the clicked row.
  const openCompare = (clicked: { id: string; name: string }) => {
    const rowsById = new Map(currentData.map(r => [r.id, r as { id: string; name: string }]))
    const many = selectedIds.size > 1 && selectedIds.has(clicked.id)
    const rows = many
      ? Array.from(selectedIds).map(id => rowsById.get(id)).filter(Boolean).map(n => toReportRow(n as any))
      : [toReportRow(clicked)]
    setPerformancePopup({ mode: "compare", rows })
  }
  const openCharts = (clicked: { id: string; name: string }) =>
    setPerformancePopup({ mode: "charts", rows: [toReportRow(clicked)] })

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

  const resetAllDefaults = () => {
    setDefaultPrimaryText("")
    setDefaultHeadline("")
    setDefaultCta("SHOP_NOW")
    setDefaultLink("")
  }

  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      const r = await fetch("/api/launch-history?limit=30")
      const d = await r.json()
      setHistoryBatches(d.batches || [])
    } catch {} finally { setHistoryLoading(false) }
  }

  // Load / save column state from localStorage
  useEffect(() => {
    try {
      const rawMetrics = localStorage.getItem("adsmanager_custom_metrics_v1")
      const storedCustomMetrics = rawMetrics ? JSON.parse(rawMetrics) as CustomMetricConfig[] : []
      if (storedCustomMetrics.length) setCustomMetrics(storedCustomMetrics)
      const validIds = new Set([...COLUMN_DEFS.map(c => c.id), ...storedCustomMetrics.map(c => c.id)])
      const raw = localStorage.getItem("adsmanager_col_order_v3")
      if (raw) {
        const parsed = JSON.parse(raw) as string[]
        const valid = parsed.filter(id => validIds.has(id))
        if (valid.length > 0) setColumnOrder(valid)
      }
      const rawPresets = localStorage.getItem("adsmanager_col_presets")
      if (rawPresets) setCustomPresets(JSON.parse(rawPresets))
      const rawWidths = localStorage.getItem("adsmanager_col_widths_v1")
      if (rawWidths) setColumnWidths(JSON.parse(rawWidths))
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem("adsmanager_col_order_v3", JSON.stringify(columnOrder)) } catch {}
  }, [columnOrder])

  useEffect(() => {
    try { localStorage.setItem("adsmanager_col_widths_v1", JSON.stringify(columnWidths)) } catch {}
  }, [columnWidths])

  useEffect(() => {
    try { localStorage.setItem("adsmanager_col_presets", JSON.stringify(customPresets)) } catch {}
  }, [customPresets])

  useEffect(() => {
    try { localStorage.setItem("adsmanager_custom_metrics_v1", JSON.stringify(customMetrics)) } catch {}
  }, [customMetrics])

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
    return (datePreset === "custom" || datePreset === "maximum") && customDateRange
      ? `time_range=${encodeURIComponent(JSON.stringify({
          since: formatMetaDate(customDateRange.start),
          until: formatMetaDate(customDateRange.end),
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
        const [r, ar] = await Promise.all([
          fetch(`/api/facebook/campaigns?ad_account_id=${encodeURIComponent(selectedAccountId)}&${dateParam}${refreshParam}`),
          // Campaigns have no attribution_spec; fetch ad sets too so the column can align to child settings.
          fetch(`/api/facebook/adsets?ad_account_id=${encodeURIComponent(selectedAccountId)}&${dateParam}${refreshParam}`),
        ])
        const [d, ad] = await Promise.all([r.json(), ar.json()])
        if (!r.ok) throw new Error(d.error || "Failed")
        if (!ar.ok) throw new Error(ad.error || "Failed")
        setCampaigns(d.campaigns || [])
        setAdSets(ad.adSets || [])
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
              action_values: item.action_values,
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

  // Account-level summary for footer metrics that Meta dedupes across the whole ad account.
  // Do not derive these by summing campaign/ad set/ad rows; reach/unique users overlap.
  useEffect(() => {
    if (!selectedAccountId) { setAccountSummary(null); return }
    let cancelled = false
    const load = async () => {
      try {
        const params = new URLSearchParams({ adAccountId: selectedAccountId })
        if ((datePreset === "custom" || datePreset === "maximum") && customDateRange) {
          params.set("since", formatMetaDate(customDateRange.start))
          params.set("until", formatMetaDate(customDateRange.end))
        } else {
          params.set("datePreset", datePreset)
        }
        if (attributionWindows.length) params.set("action_attribution_windows", attributionWindows.join(","))
        const r = await fetch(`/api/insights/account-summary?${params}`)
        const d = await r.json()
        if (!cancelled) setAccountSummary(r.ok ? (d.summary || null) : null)
      } catch {
        if (!cancelled) setAccountSummary(null)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedAccountId, datePreset, customDateRange, attributionWindows.join(",")])

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
  const totalResultsCount = useMemo(() => currentData.reduce((sum, item) => {
    const objective = tab === "campaigns"
      ? (item as Campaign).objective
      : campaigns.find(c => c.id === (item as AdSet | Ad).campaign_id)?.objective
    return sum + getResults(item, objective).count
  }, 0), [currentData, tab, campaigns])

  // Aggregate every insight metric across the current rows for the totals footer.
  const agg = useMemo(() => {
    const t = {
      spend: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, uniqueClicks: 0, uniqueLinkClicks: 0,
      purchases: 0, purchaseValue: 0, addToCart: 0, initiateCheckout: 0, leads: 0,
      landingPageViews: 0, contentViews: 0, video3s: 0,
      dailyBudget: 0, lifetimeBudget: 0, watchWeighted: 0, watchImp: 0,
    }
    for (const item of currentData) {
      t.dailyBudget    += parseFloat((item as any).daily_budget || "0") || 0
      t.lifetimeBudget += parseFloat((item as any).lifetime_budget || "0") || 0
      const ins = getInsight(item)
      if (!ins) continue
      const imp = parseFloat(ins.impressions || "0") || 0
      t.spend        += parseFloat(ins.spend || "0") || 0
      t.impressions  += imp
      t.reach        += parseFloat(ins.reach || "0") || 0
      t.clicks       += parseFloat(ins.clicks || "0") || 0
      t.linkClicks   += parseFloat(ins.inline_link_clicks || "0") || 0
      t.uniqueClicks += parseFloat(ins.unique_clicks || "0") || 0
      t.uniqueLinkClicks += parseFloat(ins.unique_inline_link_clicks || "0") || 0
      t.purchases        += getActionCount(ins, "omni_purchase")
      t.purchaseValue    += getActionValueAmount(ins, "omni_purchase")
      t.addToCart        += getActionCount(ins, "add_to_cart")
      t.initiateCheckout += getActionCount(ins, "initiate_checkout")
      t.leads            += getActionCount(ins, "lead")
      t.landingPageViews += getActionCount(ins, "landing_page_view")
      t.contentViews     += getActionCount(ins, "view_content")
      t.video3s          += getActionCount(ins, "video_view")
      const w = parseFloat(ins.video_avg_time_watched_actions?.find(a => a.action_type === "video_view")?.value
        ?? ins.video_avg_time_watched_actions?.[0]?.value ?? "0") || 0
      if (w > 0) { t.watchWeighted += w * (imp || 1); t.watchImp += (imp || 1) }
    }
    return t
  }, [currentData])

  // Footer cell: Total / Average / Per 1,000 Impressions / Per Meta account / Per Action.
  function renderTotalCell(colId: string) {
    const money = (v: number) => fmtMoney(v)
    const num = (v: number) => v > 0 ? Math.round(v).toLocaleString() : "—"
    const cell = (value: string, label: string) => (
      <>
        <span className="text-sm font-semibold tabular-nums">{value}</span>
        <p className="text-xs text-muted-foreground font-normal">{label}</p>
      </>
    )
    const avg = (n: number, d: number, fmt: (x: number) => string) => d > 0 ? fmt(n / d) : "—"
    const acctSpend = parseFloat(accountSummary?.spend || "0") || agg.spend
    const acctImpressions = parseFloat(accountSummary?.impressions || "0") || agg.impressions
    const acctClicks = parseFloat(accountSummary?.clicks || "0") || agg.clicks
    const acctReach = parseFloat(accountSummary?.reach || "0") || agg.reach
    const acctUniqueClicks = parseFloat(accountSummary?.unique_clicks || "0") || agg.uniqueClicks
    const acctUniqueLinkClicks = parseFloat(accountSummary?.unique_inline_link_clicks || "0") || agg.uniqueLinkClicks
    const acctFrequency = parseFloat(accountSummary?.frequency || "0") || (acctReach > 0 ? acctImpressions / acctReach : 0)
    switch (colId) {
      case "spend":              return cell(money(agg.spend), "Total spent")
      case "results":            return cell(totalResultsCount > 0 ? totalResultsCount.toLocaleString() : "—", "Total")
      case "cost_per_result":    return cell(avg(agg.spend, totalResultsCount, money), "Per Action")
      case "budget":             return null
      case "lifetime_budget":    return cell(agg.lifetimeBudget > 0 ? money(agg.lifetimeBudget) : "—", "Total")
      case "purchases":          return cell(num(agg.purchases), "Total")
      case "purchase_value":     return cell(agg.purchaseValue > 0 ? money(agg.purchaseValue) : "—", "Total")
      case "avg_order_value":    return cell(avg(agg.purchaseValue, agg.purchases, money), "Average")
      case "roas":               return cell(agg.spend > 0 ? `${(agg.purchaseValue / agg.spend).toFixed(2)}x` : "—", "Average")
      case "cost_per_purchase":  return cell(avg(agg.spend, agg.purchases, money), "Per Action")
      case "cost_per_lead":      return cell(avg(agg.spend, agg.leads, money), "Per Action")
      case "impressions":        return cell(num(agg.impressions), "Total")
      case "reach":              return cell(num(agg.reach), "Per Meta account")
      case "cpm":                return cell(agg.impressions > 0 ? money(agg.spend / agg.impressions * 1000) : "—", "Per 1,000 Impressions")
      case "frequency":          return cell(acctFrequency > 0 ? acctFrequency.toFixed(2) : "—", "Per Meta account")
      case "clicks":             return cell(num(agg.clicks), "Total")
      case "ctr":                return cell(acctImpressions > 0 ? fmtPct((acctClicks / acctImpressions * 100)) : "—", "Per 1,000 Impressions")
      case "cpc":                return cell(avg(agg.spend, agg.clicks, money), "Average")
      case "link_clicks":        return cell(num(agg.linkClicks), "Total")
      case "unique_clicks":      return cell(num(acctUniqueClicks), "Per Meta account")
      case "unique_link_clicks": return cell(num(acctUniqueLinkClicks), "Per Meta account")
      case "unique_link_ctr":    return cell(acctReach > 0 ? fmtPct((acctUniqueLinkClicks / acctReach * 100)) : "—", "Per Meta account")
      case "cost_per_link_click":return cell(avg(agg.spend, agg.linkClicks, money), "Per Action")
      case "cost_per_unique_click": return cell(avg(acctSpend, acctUniqueClicks, money), "Per Meta account")
      case "landing_page_views": return cell(num(agg.landingPageViews), "Total")
      case "lpv_rate":           return cell(agg.linkClicks > 0 ? fmtPct(Math.min(100, agg.landingPageViews / agg.linkClicks * 100)) : "—", "Average")
      case "content_views":      return cell(num(agg.contentViews), "Total")
      case "add_to_cart":        return cell(num(agg.addToCart), "Total")
      case "cost_per_add_to_cart": return cell(avg(agg.spend, agg.addToCart, money), "Per Action")
      case "initiate_checkout":  return cell(num(agg.initiateCheckout), "Total")
      case "cost_per_initiate_checkout": return cell(avg(agg.spend, agg.initiateCheckout, money), "Per Action")
      case "leads":              return cell(num(agg.leads), "Total")
      case "purchase_conv_rate": return cell(agg.linkClicks > 0 ? fmtPct((agg.purchases / agg.linkClicks * 100)) : "—", "Average")
      case "video_views_3s":     return cell(num(agg.video3s), "Total")
      case "avg_watch_time":     return cell(agg.watchImp > 0 ? fmtWatch(agg.watchWeighted / agg.watchImp) : "—", "Average")
      default:                   return null
    }
  }

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

  function exportTable() {
    const list = selectedIds.size > 0
      ? currentData.filter(item => selectedIds.has(item.id))
      : currentData

    if (list.length === 0) return

    const rows = list.map(item => {
      const ins = getInsight(item)
      const spend = getSpend(item)
      const objective =
        tab === "campaigns" ? (item as Campaign).objective
        : tab === "adsets"  ? campaigns.find(c => c.id === (item as AdSet).campaign_id)?.objective
        :                     campaigns.find(c => c.id === (item as Ad).campaign_id)?.objective

      const row: Record<string, string | number> = {
        "Name": item.name,
        "ID": item.id,
      }

      for (const colId of columnOrder) {
        const colDef = customColumnMap[colId]
        if (!colDef) continue
        const label = colDef.headerLabel

        let val: string | number = "—"
        const customMetric = customMetricById.get(colId)
        if (customMetric) {
          val = formatCustomMetric(evalCustomMetric(customMetric.formula, id => resolveMetricNumber(id, ins, item, objective)), customMetric.format)
          row[label] = val
          continue
        }
        switch (colId) {
          case "spend":
            val = ins ? fmtMoney(spend) : "—"
            break
          case "results": {
            const { count } = getResults(item, objective)
            val = ins ? count : "—"
            break
          }
          case "cost_per_result": {
            const cpr = getCostPerResult(item, objective)
            val = cpr || "—"
            break
          }
          case "budget": {
            const daily = (item as any).daily_budget
            val = daily ? fmtBudget(daily) : "Using ad set budget"
            break
          }
          case "lifetime_budget":
            val = (item as any).lifetime_budget ? fmtBudget((item as any).lifetime_budget) : "—"
            break
          case "delivery":
          case "effective_status":
            val = item.effective_status
            break
          case "impressions":
            val = ins?.impressions ? parseInt(ins.impressions) : "—"
            break
          case "clicks":
            val = ins?.clicks ? parseInt(ins.clicks) : "—"
            break
          case "reach":
            val = ins?.reach ? parseInt(ins.reach) : "—"
            break
          case "cpm":
            if (ins && ins.impressions && parseFloat(ins.impressions) > 0) {
              val = fmtMoney(((parseFloat(ins.spend || "0") / parseFloat(ins.impressions)) * 1000))
            }
            break
          case "frequency":
            if (ins?.frequency) val = parseFloat(ins.frequency).toFixed(2)
            else if (ins?.impressions && ins?.reach) val = (parseFloat(ins.impressions) / parseFloat(ins.reach)).toFixed(2)
            break
          case "ctr":
            if (ins?.ctr) val = fmtPct(parseFloat(ins.ctr))
            else if (ins?.clicks && ins?.impressions && parseFloat(ins.impressions) > 0) val = fmtPct(((parseFloat(ins.clicks) / parseFloat(ins.impressions)) * 100))
            break
          case "cpc":
            if (ins?.clicks && parseFloat(ins.clicks) > 0) val = fmtMoney((spend / parseFloat(ins.clicks)))
            break
          case "link_clicks":
            val = ins?.inline_link_clicks ? parseInt(ins.inline_link_clicks) : "—"
            break
          case "unique_clicks":
            val = ins?.unique_clicks ? parseInt(ins.unique_clicks) : "—"
            break
          case "unique_link_clicks":
            val = ins?.unique_inline_link_clicks ? parseInt(ins.unique_inline_link_clicks) : "—"
            break
          case "unique_link_ctr":
            if (ins?.unique_link_clicks_ctr) val = fmtPct(parseFloat(ins.unique_link_clicks_ctr))
            else if (ins?.unique_inline_link_clicks && ins?.reach && parseFloat(ins.reach) > 0) val = fmtPct(((parseFloat(ins.unique_inline_link_clicks) / parseFloat(ins.reach)) * 100))
            break
          case "cost_per_unique_click":
            if (ins?.unique_clicks && parseFloat(ins.unique_clicks) > 0) val = fmtMoney((spend / parseFloat(ins.unique_clicks)))
            break
          case "cost_per_link_click":
            if (ins?.inline_link_clicks && parseFloat(ins.inline_link_clicks) > 0) val = fmtMoney((spend / parseFloat(ins.inline_link_clicks)))
            break
          case "landing_page_views":
            val = getActionValue(ins, "landing_page_view") || "—"
            break
          case "lpv_rate": {
            const lpv = getActionValue(ins, "landing_page_view")
            const lc = parseFloat(ins?.inline_link_clicks || "0")
            if (lpv && lc > 0) val = fmtPct(((lpv / lc) * 100))
            break
          }
          case "content_views":
            val = getActionValue(ins, "view_content") || "—"
            break
          case "add_to_cart":
            val = getActionValue(ins, "add_to_cart") || "—"
            break
          case "cost_per_add_to_cart": {
            const atc = getActionValue(ins, "add_to_cart")
            if (atc > 0) val = fmtMoney((spend / atc))
            break
          }
          case "initiate_checkout":
            val = getActionValue(ins, "initiate_checkout") || "—"
            break
          case "cost_per_initiate_checkout": {
            const ic = getActionValue(ins, "initiate_checkout")
            if (ic > 0) val = fmtMoney((spend / ic))
            break
          }
          case "leads":
            val = getActionValue(ins, "lead") || "—"
            break
          case "cost_per_lead": {
            const lead = getActionValue(ins, "lead")
            if (lead > 0) val = fmtMoney((spend / lead))
            break
          }
          case "purchases":
            val = getActionValue(ins, "omni_purchase") || "—"
            break
          case "purchase_value":
            val = formatMoneyAmount(getActionValueAmount(ins, "omni_purchase"))
            break
          case "roas": {
            const pVal = getActionValueAmount(ins, "omni_purchase")
            if (spend > 0 && pVal > 0) val = `${(pVal / spend).toFixed(2)}x`
            break
          }
          case "cost_per_purchase": {
            const pur = getActionValue(ins, "omni_purchase")
            if (pur > 0) val = fmtMoney((spend / pur))
            break
          }
          case "avg_order_value": {
            const pur = getActionValue(ins, "omni_purchase")
            const pVal = getActionValueAmount(ins, "omni_purchase")
            if (pur > 0 && pVal > 0) val = fmtMoney((pVal / pur))
            break
          }
          case "purchase_conv_rate": {
            const pur = getActionValue(ins, "omni_purchase")
            const cl = parseFloat(ins?.clicks || "0")
            if (cl > 0) val = fmtPct(((pur / cl) * 100))
            break
          }
          case "avg_watch_time": {
            const sec = parseFloat(ins?.video_avg_time_watched_actions?.[0]?.value || "0")
            if (sec > 0) val = sec.toFixed(1)
            break
          }
          case "video_views_3s":
            val = getActionValue(ins, "video_view") || "—"
            break
          case "video_25":
            val = getActionValue(ins, "video_p25_watched_actions") || "—"
            break
          case "video_50":
            val = getActionValue(ins, "video_p50_watched_actions") || "—"
            break
          case "video_75":
            val = getActionValue(ins, "video_p75_watched_actions") || "—"
            break
          case "video_100":
            val = getActionValue(ins, "video_p100_watched_actions") || "—"
            break
          case "schedule_start":
            val = fmtDate((item as any).start_time)
            break
          case "schedule_end":
            val = fmtDate((item as any).stop_time || (item as any).end_time)
            break
          case "optimization_goal":
            val = (item as AdSet).optimization_goal || "—"
            break
          case "bid_strategy":
            val = (item as any).bid_strategy ?? (item as Ad).adset?.bid_strategy ?? "—"
            break
          case "objective":
            val = objective || "—"
            break
          case "attribution_setting": {
            if (tab === "campaigns") {
              const kids = adSets.filter(a => a.campaign_id === item.id)
              const labels = Array.from(new Set(kids.map(k => formatAttributionSpec(k.attribution_spec))))
              val = labels.length ? labels.join(" · ") : "All conversions"
            } else {
              const spec = (item as any).attribution_spec ?? (item as Ad).adset?.attribution_spec ?? (item as any).attributionSetting ?? (item as any).metrics?.attributionSetting
              val = formatAttributionSpec(spec)
            }
            break
          }
        }
        row[label] = val
      }
      return row
    })

    downloadCsv(`${tab}_export.csv`, rows)
  }

  // ─── Config-driven cell renderer ─────────────────────────────────────────────

  function getActionValue(ins: Insight | null, actionType: string): number {
    return getActionCount(ins, actionType)
  }

  function resolveMetricNumber(metricId: string, ins: Insight | null, row: Campaign | AdSet | Ad, objective?: string): number | null {
    const spend = getSpend(row)
    switch (metricId) {
      case "spend": return spend
      case "results": return getResults(row, objective).count
      case "cost_per_result": { const count = getResults(row, objective).count; return count ? spend / count : null }
      case "budget": return parseFloat((row as any).daily_budget || (row as any).lifetime_budget || "0") / 100
      case "lifetime_budget": return parseFloat((row as any).lifetime_budget || "0") / 100
      case "impressions": return parseFloat(ins?.impressions || "0")
      case "reach": return parseFloat(ins?.reach || "0")
      case "clicks": return parseFloat(ins?.clicks || "0")
      case "link_clicks": return parseFloat(ins?.inline_link_clicks || "0")
      case "unique_clicks": return parseFloat(ins?.unique_clicks || "0")
      case "unique_link_clicks": return parseFloat(ins?.unique_inline_link_clicks || "0")
      case "purchases": return getActionValue(ins, "omni_purchase")
      case "purchase_value": return getActionValueAmount(ins, "omni_purchase")
      case "add_to_cart": return getActionValue(ins, "add_to_cart")
      case "initiate_checkout": return getActionValue(ins, "initiate_checkout")
      case "leads": return getActionValue(ins, "lead")
      case "landing_page_views": return getActionValue(ins, "landing_page_view")
      case "content_views": return getActionValue(ins, "view_content")
      case "video_views_3s": return getActionValue(ins, "video_view")
      case "post_engagements": return getActionValue(ins, "post_engagement")
      default: return null
    }
  }

  const formatCustomMetric = (value: number | null, format: CustomMetricConfig["format"]) => value == null
    ? "—"
    : format === "currency" ? fmtMoney(value)
    : format === "percentage" ? fmtPct(value * 100)
    : value.toLocaleString("en-US", { maximumFractionDigits: 2 })

  function renderCellContent(colId: string, row: Campaign | AdSet | Ad) {
    const ins   = getInsight(row)
    const spend = getSpend(row)
    const objective =
      tab === "campaigns" ? (row as Campaign).objective
      : tab === "adsets"  ? campaigns.find(c => c.id === (row as AdSet).campaign_id)?.objective
      :                     campaigns.find(c => c.id === (row as Ad).campaign_id)?.objective
    const customMetric = customMetricById.get(colId)
    if (customMetric) {
      const value = evalCustomMetric(customMetric.formula, id => resolveMetricNumber(id, ins, row, objective))
      return <span className="text-sm font-medium tabular-nums leading-5">{formatCustomMetric(value, customMetric.format)}</span>
    }

    switch (colId) {
      case "spend":
        return <span className="text-sm font-medium tabular-nums leading-5">{ins ? fmtMoney(spend) : "—"}</span>

      case "results": {
        const { count, type } = getResults(row, objective)
        return <>
          <span className="text-sm font-medium tabular-nums leading-5 font-semibold text-[#1c2b33] dark:text-white">{ins ? count : "—"}</span>
          {ins && count > 0 && <p className="text-xs text-[#65676b]">{type}</p>}
          {(() => {
            const d = getResultsDetail(row, objective)
            if (!d || !d.count) return null
            return (
              <div className="mt-1 space-y-0.5">
                {d.perAction && (
                  <p className="text-xs text-[#65676b]">
                    <span className="tabular-nums text-[#1c2b33] dark:text-white">{d.perAction}</span> Per Action
                  </p>
                )}
                {d.avgWatch != null && d.avgWatch > 0 ? (
                  <p className="text-xs text-[#65676b]">
                    <span className="tabular-nums text-[#1c2b33] dark:text-white">{fmtWatch(d.avgWatch)}</span> Average
                  </p>
                ) : d.rate != null ? (
                  <p className="text-xs text-[#65676b]">
                    <span className="tabular-nums text-[#1c2b33] dark:text-white">{d.rate.toFixed(2)}%</span>
                  </p>
                ) : null}
              </div>
            )
          })()}
        </>
      }

      case "cost_per_result": {
        const { type } = getResults(row, objective)
        const cpr = getCostPerResult(row, objective)
        return <>
          <span className="text-sm font-medium tabular-nums leading-5">{cpr || "—"}</span>
          {cpr && <p className="text-xs text-[#65676b]">Per {type}</p>}
        </>
      }

      case "budget": {
        const daily = (row as any).daily_budget
        if (daily) {
          return (
            <>
              <span className="text-sm font-medium tabular-nums leading-5">{fmtBudget(daily)}</span>
              <p className="text-xs text-[#65676b]">Daily</p>
            </>
          )
        }
        // No object-level daily budget → inherits from parent (campaign CBO / adset-level)
        return <span className="text-xs text-[#65676b]">Using ad set budget</span>
      }

      case "lifetime_budget":
        return <span className="text-sm font-medium tabular-nums leading-5">{(row as any).lifetime_budget ? fmtBudget((row as any).lifetime_budget) : "—"}</span>

      case "delivery": {
        let budgetRemaining: string | undefined = (row as any).budget_remaining
        // Learning is an ad-set-level delivery state; ads inherit it from their parent ad set.
        let learning: LearningStageInfo | undefined
        if (tab === "adsets") {
          const adset = row as AdSet
          learning = adset.learning_stage_info
          // CBO adsets have no budget of their own — inherit from parent campaign
          if (!adset.daily_budget && !adset.lifetime_budget) {
            const parentCampaign = campaigns.find(c => c.id === adset.campaign_id)
            budgetRemaining = parentCampaign?.budget_remaining
          }
        } else if (tab === "ads") {
          // Ads don't show budget status — delivery is based solely on their own effective_status
          budgetRemaining = undefined
          learning = (row as Ad).adset?.learning_stage_info
        }
        return <DeliveryBadge effective_status={row.effective_status} budget_remaining={budgetRemaining} learning={learning} />
      }

      case "effective_status":
        return <span className="text-xs">{row.effective_status.charAt(0) + row.effective_status.slice(1).toLowerCase()}</span>

      case "impressions":
        return <span className="text-sm font-medium tabular-nums leading-5">{ins?.impressions ? parseInt(ins.impressions).toLocaleString() : "—"}</span>

      case "clicks":
        return <span className="text-sm font-medium tabular-nums leading-5">{ins?.clicks ? parseInt(ins.clicks).toLocaleString() : "—"}</span>

      case "reach":
        return <span className="text-sm font-medium tabular-nums leading-5">{ins?.reach ? parseInt(ins.reach).toLocaleString() : "—"}</span>

      case "cpm": {
        if (!ins || !ins.impressions || parseFloat(ins.impressions) === 0) return <span className="text-xs">—</span>
        const cpmVal = (parseFloat(ins.spend || "0") / parseFloat(ins.impressions)) * 1000
        return <span className="text-sm font-medium tabular-nums leading-5">{fmtMoney(cpmVal)}</span>
      }

      case "frequency": {
        if (ins?.frequency != null && ins.frequency !== "") {
          return <span className="text-sm font-medium tabular-nums leading-5">{parseFloat(ins.frequency).toFixed(2)}</span>
        }
        const imp = parseFloat(ins?.impressions || "0")
        const rch = parseFloat(ins?.reach || "0")
        if (!imp || !rch) return <span className="text-xs">—</span>
        return <span className="text-sm font-medium tabular-nums leading-5">{(imp / rch).toFixed(2)}</span>
      }

      case "ctr": {
        if (!ins || !ins.impressions || parseFloat(ins.impressions) === 0) return <span className="text-xs">—</span>
        const ctrVal = ins.ctr != null && ins.ctr !== ""
          ? parseFloat(ins.ctr)
          : (parseFloat(ins.clicks || "0") / parseFloat(ins.impressions)) * 100
        return <span className="text-sm font-medium tabular-nums leading-5">{ctrVal.toFixed(2)}%</span>
      }

      case "cpc": {
        if (!ins || !ins.clicks || parseFloat(ins.clicks) === 0) return <span className="text-xs">—</span>
        return <span className="text-sm font-medium tabular-nums leading-5">{fmtMoney((spend / parseFloat(ins.clicks)))}</span>
      }

      case "link_clicks": {
        const n = parseInt(ins?.inline_link_clicks || "0")
        return <span className="text-sm font-medium tabular-nums leading-5">{n ? n.toLocaleString() : "—"}</span>
      }

      case "unique_clicks": {
        const n = parseInt(ins?.unique_clicks || "0")
        return <span className="text-sm font-medium tabular-nums leading-5">{n ? n.toLocaleString() : "—"}</span>
      }

      case "unique_link_clicks": {
        const n = parseInt(ins?.unique_inline_link_clicks || "0")
        return <span className="text-sm font-medium tabular-nums leading-5">{n ? n.toLocaleString() : "—"}</span>
      }

      case "unique_link_ctr": {
        if (ins?.unique_link_clicks_ctr != null && ins.unique_link_clicks_ctr !== "") {
          return <span className="text-sm font-medium tabular-nums leading-5">{parseFloat(ins.unique_link_clicks_ctr).toFixed(2)}%</span>
        }
        const rch = parseFloat(ins?.reach || "0")
        const ulc = parseFloat(ins?.unique_inline_link_clicks || "0")
        if (!rch || !ulc) return <span className="text-xs">—</span>
        return <span className="text-sm font-medium tabular-nums leading-5">{((ulc / rch) * 100).toFixed(2)}%</span>
      }

      case "cost_per_unique_click": {
        const n = parseFloat(ins?.unique_clicks || "0")
        if (!n) return <span className="text-xs">—</span>
        return <span className="text-sm font-medium tabular-nums leading-5">{fmtMoney((spend / n))}</span>
      }

      case "cost_per_link_click": {
        const n = parseFloat(ins?.inline_link_clicks || "0")
        if (!n) return <span className="text-xs">—</span>
        return <span className="text-sm font-medium tabular-nums leading-5">{fmtMoney((spend / n))}</span>
      }

      case "landing_page_views": {
        const n = getActionValue(ins, "landing_page_view")
        return <span className="text-sm font-medium tabular-nums leading-5">{n || "—"}</span>
      }

      case "lpv_rate": {
        const lpv = getActionValue(ins, "landing_page_view")
        const lc = parseFloat(ins?.inline_link_clicks || "0")
        if (!lpv || !lc) return <span className="text-xs">—</span>
        return <span className="text-sm font-medium tabular-nums leading-5">{((lpv / lc) * 100).toFixed(2)}%</span>
      }

      case "content_views": {
        const n = getActionValue(ins, "view_content")
        return <span className="text-sm font-medium tabular-nums leading-5">{n || "—"}</span>
      }

      case "cost_per_add_to_cart": {
        const n = getActionValue(ins, "add_to_cart")
        if (!n) return <span className="text-xs">—</span>
        return <span className="text-sm font-medium tabular-nums leading-5">{fmtMoney((spend / n))}</span>
      }

      case "initiate_checkout": {
        const n = getActionValue(ins, "initiate_checkout")
        return <span className="text-sm font-medium tabular-nums leading-5">{n || "—"}</span>
      }

      case "cost_per_initiate_checkout": {
        const n = getActionValue(ins, "initiate_checkout")
        if (!n) return <span className="text-xs">—</span>
        return <span className="text-sm font-medium tabular-nums leading-5">{fmtMoney((spend / n))}</span>
      }

      case "avg_watch_time": {
        const arr = ins?.video_avg_time_watched_actions
        const sec = arr?.[0] ? parseFloat(arr[0].value || "0") : 0
        if (!sec) return <span className="text-xs">—</span>
        const s = Math.round(sec)
        const mm = Math.floor(s / 60)
        const rr = s % 60
        return <span className="text-sm font-medium tabular-nums leading-5">{mm > 0 ? `${mm}:${String(rr).padStart(2, "0")}` : `0:${String(rr).padStart(2, "0")}`}</span>
      }

      case "purchases":
        return <span className="text-sm font-medium tabular-nums leading-5">{ins ? getActionValue(ins, "omni_purchase") : "—"}</span>

      case "purchase_value": {
        const value = getActionValueAmount(ins, "omni_purchase")
        return <span className="text-sm font-medium tabular-nums leading-5">{formatMoneyAmount(value)}</span>
      }

      case "avg_order_value": {
        const purchasesN = getActionValue(ins, "omni_purchase")
        const purchaseValue = getActionValueAmount(ins, "omni_purchase")
        if (!ins || purchasesN === 0 || purchaseValue === 0) return <span className="text-xs">—</span>
        return <span className="text-sm font-medium tabular-nums leading-5">{fmtMoney((purchaseValue / purchasesN))}</span>
      }

      case "roas": {
        const purchaseValue = getActionValueAmount(ins, "omni_purchase")
        if (!ins || spend === 0 || purchaseValue === 0) return <span className="text-xs">—</span>
        return <span className="text-sm font-medium tabular-nums leading-5">{(purchaseValue / spend).toFixed(2)}x</span>
      }

      case "cost_per_purchase": {
        const p = getActionValue(ins, "omni_purchase")
        if (!ins || p === 0) return <span className="text-xs">—</span>
        return <span className="text-sm font-medium tabular-nums leading-5">{fmtMoney((spend / p))}</span>
      }

      case "cost_per_lead": {
        const l = getActionValue(ins, "lead")
        if (!ins || l === 0) return <span className="text-xs">—</span>
        return <span className="text-sm font-medium tabular-nums leading-5">{fmtMoney((spend / l))}</span>
      }

      case "shopify_score":
        // ponytail: no Shopify data source wired yet — column exists for CSV-order parity.
        // Upgrade: add /api/shopify/score + join by ad/adset/campaign id.
        return <span className="text-sm font-medium tabular-nums leading-5">{(row as any).shopifyScore ?? (row as any).shopify_score ?? "—"}</span>

      case "leads":
        return <span className="text-sm font-medium tabular-nums leading-5">{ins ? getActionValue(ins, "lead") : "—"}</span>

      case "add_to_cart":
        return <span className="text-sm font-medium tabular-nums leading-5">{ins ? getActionValue(ins, "add_to_cart") : "—"}</span>

      case "purchase_conv_rate": {
        const p = getActionValue(ins, "omni_purchase")
        const cl = ins ? parseInt(ins.clicks || "0") : 0
        if (!ins || cl === 0) return <span className="text-xs">—</span>
        return <span className="text-sm font-medium tabular-nums leading-5">{((p / cl) * 100).toFixed(2)}%</span>
      }

      case "video_views_3s":
        return <span className="text-sm font-medium tabular-nums leading-5">{ins ? getActionValue(ins, "video_view") : "—"}</span>
      case "video_25":
        return <span className="text-sm font-medium tabular-nums leading-5">{ins ? getActionValue(ins, "video_p25_watched_actions") : "—"}</span>
      case "video_50":
        return <span className="text-sm font-medium tabular-nums leading-5">{ins ? getActionValue(ins, "video_p50_watched_actions") : "—"}</span>
      case "video_75":
        return <span className="text-sm font-medium tabular-nums leading-5">{ins ? getActionValue(ins, "video_p75_watched_actions") : "—"}</span>
      case "video_100":
        return <span className="text-sm font-medium tabular-nums leading-5">{ins ? getActionValue(ins, "video_p100_watched_actions") : "—"}</span>

      case "schedule_start":
        return <span className="text-xs text-[#65676b]">{fmtDate((row as any).start_time)}</span>
      case "schedule_end":
        return <span className="text-xs text-[#65676b]">{fmtDate((row as any).stop_time || (row as any).end_time)}</span>
      case "optimization_goal":
        return <span className="text-xs text-[#65676b]">{(row as AdSet).optimization_goal?.replace(/_/g, " ").toLowerCase() || "—"}</span>
      case "bid_strategy": {
        // Ads inherit bid_strategy from their parent ad set (fetched via adset{bid_strategy}).
        const raw = (row as any).bid_strategy
          ?? (row as Ad).adset?.bid_strategy
          ?? null
        return <span className="text-xs text-[#65676b]">{formatBidStrategy(raw)}</span>
      }
      case "objective":
        return <span className="text-xs text-[#65676b]">{(row as Campaign).objective?.replace(/OUTCOME_/g, "").replace(/_/g, " ").toLowerCase() || "—"}</span>

      case "attribution_setting": {
        // Ad sets expose attribution_spec; ads inherit via adset{attribution_spec}.
        // Campaigns have no attribution_spec → derive from ALL child ad sets, join unique labels.
        // Empty / missing → "All conversions" (Meta default). Incremental → "Incremental attribution".
        const anyRow = row as any
        let label: string | null = null
        if (tab === "campaigns") {
          const kids = adSets.filter(a => a.campaign_id === (row as Campaign).id)
          const labels = Array.from(new Set(kids.map(k => formatAttributionSpec(k.attribution_spec))))
          label = labels.length ? labels.join(" · ") : "All conversions"
        } else {
          const spec: AttributionSpecEntry[] | string | undefined =
            anyRow.attribution_spec
            ?? (row as Ad).adset?.attribution_spec
            ?? anyRow.attributionSetting
            ?? anyRow.metrics?.attributionSetting
          label = formatAttributionSpec(spec)
        }
        return <span className="text-xs text-[#65676b]">{label}</span>
      }

      default:
        return <span className="text-xs">—</span>
    }
  }

  function renderBreakdownCell(colId: string, ins: Insight, objective?: string) {
    if (colId === "attribution_setting") return <span className="text-xs">—</span>
    const spend = parseFloat(ins.spend || "0")
    const getVal = (type: string) => getActionCount(ins, type)
    const getValue = (type: string) => getActionValueAmount(ins, type)
    const customMetric = customMetricById.get(colId)
    if (customMetric) {
      const results = OBJECTIVE_RESULT[objective || ""]
      const value = evalCustomMetric(customMetric.formula, id => id === "results" ? (results ? getVal(results.actionType) : null) : resolveMetricNumber(id, ins, {} as any, objective))
      return <span className="text-sm font-medium tabular-nums leading-5">{formatCustomMetric(value, customMetric.format)}</span>
    }
    switch (colId) {
      case "spend":
        return <span className="text-sm font-medium tabular-nums leading-5">{ins.spend ? fmtMoney(spend) : "—"}</span>
      case "results": {
        const obj = OBJECTIVE_RESULT[objective || ""]
        if (!obj) return <span className="text-xs">—</span>
        const count = getVal(obj.actionType)
        const perAction = count > 0 ? fmtMoney((spend / count)) : null
        const linkClicks = parseFloat(ins.inline_link_clicks || "0")
        const rate = count > 0 && linkClicks > 0 ? (count / linkClicks) * 100 : null
        const avgWatchRaw = ins.video_avg_time_watched_actions?.find(a => a.action_type === "video_view")?.value
          ?? ins.video_avg_time_watched_actions?.[0]?.value
        const avgWatch = avgWatchRaw ? parseFloat(avgWatchRaw) : null
        return (
          <>
            <span className="text-sm font-medium tabular-nums leading-5 font-semibold">{count || "—"}</span>
            {count > 0 && <p className="text-xs text-[#65676b]">{obj.type}</p>}
            {count > 0 && (
              <div className="mt-1 space-y-0.5">
                {perAction && (
                  <p className="text-xs text-[#65676b]">
                    <span className="tabular-nums text-[#1c2b33] dark:text-white">{perAction}</span> Per Action
                  </p>
                )}
                {avgWatch != null && avgWatch > 0 ? (
                  <p className="text-xs text-[#65676b]">
                    <span className="tabular-nums text-[#1c2b33] dark:text-white">{fmtWatch(avgWatch)}</span> Average
                  </p>
                ) : rate != null ? (
                  <p className="text-xs text-[#65676b]">
                    <span className="tabular-nums text-[#1c2b33] dark:text-white">{rate.toFixed(2)}%</span>
                  </p>
                ) : null}
              </div>
            )}
          </>
        )
      }
      case "cost_per_result": {
        const obj = OBJECTIVE_RESULT[objective || ""]
        if (!obj) return <span className="text-xs">—</span>
        const cpa = ins.cost_per_action_type?.find(a => (ACTION_ALIASES[obj.actionType] || [obj.actionType]).includes(a.action_type))
        const count = getVal(obj.actionType)
        const value = cpa ? parseFloat(cpa.value) : (count > 0 ? spend / count : NaN)
        if (!Number.isFinite(value)) return <span className="text-xs">—</span>
        return <><span className="text-sm font-medium tabular-nums leading-5">{fmtMoney(value)}</span><p className="text-xs text-[#65676b]">Per {obj.type}</p></>
      }
      case "impressions": return <span className="text-sm font-medium tabular-nums leading-5">{ins.impressions ? parseInt(ins.impressions).toLocaleString() : "—"}</span>
      case "clicks":      return <span className="text-sm font-medium tabular-nums leading-5">{ins.clicks ? parseInt(ins.clicks).toLocaleString() : "—"}</span>
      case "reach":       return <span className="text-sm font-medium tabular-nums leading-5">{ins.reach ? parseInt(ins.reach).toLocaleString() : "—"}</span>
      case "cpm": {
        if (!ins.impressions || parseFloat(ins.impressions) === 0) return <span className="text-xs">—</span>
        return <span className="text-sm font-medium tabular-nums leading-5">{fmtMoney(((spend / parseFloat(ins.impressions)) * 1000))}</span>
      }
      case "ctr": {
        if (!ins.impressions || parseFloat(ins.impressions) === 0) return <span className="text-xs">—</span>
        return <span className="text-sm font-medium tabular-nums leading-5">{((parseFloat(ins.clicks || "0") / parseFloat(ins.impressions)) * 100).toFixed(2)}%</span>
      }
      case "cpc": {
        if (!ins.clicks || parseFloat(ins.clicks) === 0) return <span className="text-xs">—</span>
        return <span className="text-sm font-medium tabular-nums leading-5">{fmtMoney((spend / parseFloat(ins.clicks)))}</span>
      }
      case "link_clicks":      { const n = parseInt(ins.inline_link_clicks || "0"); return <span className="text-sm font-medium tabular-nums leading-5">{n ? n.toLocaleString() : "—"}</span> }
      case "unique_clicks":    { const n = parseInt(ins.unique_clicks || "0"); return <span className="text-sm font-medium tabular-nums leading-5">{n ? n.toLocaleString() : "—"}</span> }
      case "unique_link_clicks": { const n = parseInt(ins.unique_inline_link_clicks || "0"); return <span className="text-sm font-medium tabular-nums leading-5">{n ? n.toLocaleString() : "—"}</span> }
      case "unique_link_ctr":  { const v = parseFloat(ins.unique_link_clicks_ctr || "0"); return <span className="text-sm font-medium tabular-nums leading-5">{v ? fmtPct(v) : "—"}</span> }
      case "cost_per_unique_click": { const n = parseFloat(ins.unique_clicks || "0"); return <span className="text-sm font-medium tabular-nums leading-5">{n ? fmtMoney((spend/n)) : "—"}</span> }
      case "cost_per_link_click": { const n = parseFloat(ins.inline_link_clicks || "0"); return <span className="text-sm font-medium tabular-nums leading-5">{n ? fmtMoney((spend/n)) : "—"}</span> }
      case "landing_page_views": { const n = getVal("landing_page_view"); return <span className="text-sm font-medium tabular-nums leading-5">{n || "—"}</span> }
      case "lpv_rate":         { const lpv = getVal("landing_page_view"); const lc = parseFloat(ins.inline_link_clicks || "0"); return <span className="text-sm font-medium tabular-nums leading-5">{lpv && lc ? fmtPct(((lpv/lc)*100)) : "—"}</span> }
      case "content_views":    { const n = getVal("view_content"); return <span className="text-sm font-medium tabular-nums leading-5">{n || "—"}</span> }
      case "cost_per_add_to_cart": { const n = getVal("add_to_cart"); return <span className="text-sm font-medium tabular-nums leading-5">{n ? fmtMoney((spend/n)) : "—"}</span> }
      case "initiate_checkout": { const n = getVal("initiate_checkout"); return <span className="text-sm font-medium tabular-nums leading-5">{n || "—"}</span> }
      case "cost_per_initiate_checkout": { const n = getVal("initiate_checkout"); return <span className="text-sm font-medium tabular-nums leading-5">{n ? fmtMoney((spend/n)) : "—"}</span> }
      case "avg_watch_time":   { const sec = parseFloat(ins.video_avg_time_watched_actions?.[0]?.value || "0"); const s = Math.round(sec); const mm = Math.floor(s / 60); const rr = s % 60; return <span className="text-sm font-medium tabular-nums leading-5">{s ? (mm > 0 ? `${mm}:${String(rr).padStart(2, "0")}` : `0:${String(rr).padStart(2, "0")}`) : "—"}</span> }
      case "purchases":        { const p = getVal("omni_purchase"); return <span className="text-sm font-medium tabular-nums leading-5">{p || "—"}</span> }
      case "purchase_value":   { const value = getValue("omni_purchase"); return <span className="text-sm font-medium tabular-nums leading-5">{formatMoneyAmount(value)}</span> }
      case "avg_order_value":  { const p = getVal("omni_purchase"); const value = getValue("omni_purchase"); return <span className="text-sm font-medium tabular-nums leading-5">{p && value ? fmtMoney((value / p)) : "—"}</span> }
      case "roas":             { const value = getValue("omni_purchase"); return <span className="text-sm font-medium tabular-nums leading-5">{spend && value ? `${(value / spend).toFixed(2)}x` : "—"}</span> }
      case "cost_per_purchase":{ const p = getVal("omni_purchase"); return <span className="text-sm font-medium tabular-nums leading-5">{p ? fmtMoney((spend/p)) : "—"}</span> }
      case "leads":            { const l = getVal("lead"); return <span className="text-sm font-medium tabular-nums leading-5">{l || "—"}</span> }
      case "cost_per_lead":    { const l = getVal("lead"); return <span className="text-sm font-medium tabular-nums leading-5">{l ? fmtMoney((spend/l)) : "—"}</span> }
      case "shopify_score":    return <span className="text-sm font-medium tabular-nums leading-5">—</span>
      case "add_to_cart":      { const atc = getVal("add_to_cart"); return <span className="text-sm font-medium tabular-nums leading-5">{atc || "—"}</span> }
      case "video_views_3s":   { const v = getVal("video_view"); return <span className="text-sm font-medium tabular-nums leading-5">{v || "—"}</span> }
      case "video_25":         { const v = getVal("video_p25_watched_actions"); return <span className="text-sm font-medium tabular-nums leading-5">{v || "—"}</span> }
      case "video_50":         { const v = getVal("video_p50_watched_actions"); return <span className="text-sm font-medium tabular-nums leading-5">{v || "—"}</span> }
      case "video_75":         { const v = getVal("video_p75_watched_actions"); return <span className="text-sm font-medium tabular-nums leading-5">{v || "—"}</span> }
      case "video_100":        { const v = getVal("video_p100_watched_actions"); return <span className="text-sm font-medium tabular-nums leading-5">{v || "—"}</span> }
      default: return <span className="text-xs">—</span>
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
          <span className="text-xs text-muted-foreground">{selectedAccount.id}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => { setHistoryOpen(true); fetchHistory() }} className="flex items-center gap-1.5 h-7 px-2.5 text-xs border rounded-lg hover:bg-muted/50 transition-colors mr-2">
            <IconHistory className="size-3.5" />History
          </button>

          <span className="text-xs text-muted-foreground">Updated just now</span>
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
                  "flex items-center gap-1.5 px-4 py-2 text-xs transition-colors whitespace-nowrap rounded-t-lg border-t border-l border-r",
                  tab === t
                    ? "bg-white dark:bg-card border-[#e4e6eb] dark:border-gray-800 font-bold text-gray-900 dark:text-gray-100 z-10 -mb-px shadow-[0_-2px_0_0_#1877f2]"
                    : "bg-[#f5f6f7] dark:bg-muted/50 border-transparent border-b-[#e4e6eb] dark:border-b-gray-800 text-[#65676b] dark:text-muted-foreground hover:bg-[#ebedf0] dark:hover:bg-muted font-semibold"
                )}
              >
                {t === "campaigns"
                  ? <span className="size-4 shrink-0 flex items-center justify-center rounded bg-blue-600 text-white text-xs font-bold">A</span>
                  : <IconTable className="size-3.5 shrink-0" />
                }
                <span className="truncate max-w-[110px]">{tabLabel(t)}</span>

                {/* Search/filter match count badge — only when tab has loaded data */}
                {(search || statusFilter !== "all") && tabMatchCounts[t] !== null && (
                  <span className={cn(
                    "px-1.5 py-0.5 text-xs rounded-full font-bold leading-none",
                    tab === t
                      ? "bg-blue-600 text-white"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {tabMatchCounts[t]}
                  </span>
                )}

                {/* Hierarchical filter badge */}
                {!search && statusFilter === "all" && badge && (
                  <span className="flex items-center gap-px px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full font-bold leading-none">
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
            accountId={selectedAccountId}
            customStart={customDateRange?.start}
            customEnd={customDateRange?.end}
            onChange={(p, cs, ce) => {
              setDatePreset(p)
              setCustomDateRange((p === "custom" || p === "maximum") && cs && ce ? { start: cs, end: ce } : null)
            }}
          />
        </div>
      </div>

      {/* ── Action toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0 flex-wrap bg-white dark:bg-background">
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
        <button
          disabled={selectedIds.size === 0}
          onClick={() => {
            const rowsById = new Map(currentData.map(r => [r.id, r as { id: string; name: string }]))
            const rows = Array.from(selectedIds).map(id => rowsById.get(id)).filter(Boolean).map(n => toReportRow(n as any))
            setPerformancePopup({ mode: "compare", rows })
          }}
          className="flex items-center gap-1.5 h-7 px-3 text-xs border border-[#ccd0d5] dark:border-gray-700 rounded bg-[#f5f6f7] dark:bg-muted hover:bg-[#ebedf0] dark:hover:bg-muted/80 transition-colors text-[#4b4f56] dark:text-gray-300 font-semibold shadow-sm disabled:opacity-40"
        >
          Compare{selectedIds.size > 0 && ` (${selectedIds.size})`}
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
              <div className="absolute right-0 top-full mt-1 bg-popover border rounded-xl shadow-lg z-50 w-72 py-2">
                {(() => {
                  const activePreset = getActivePreset(columnOrder, customPresets)
                  const presetButton = (id: string) => {
                    const preset = [...DEFAULT_PRESETS, ...customPresets].find(p => p.id === id)
                    if (!preset) return null
                    const isActive = activePreset?.id === preset.id
                    return (
                      <button
                        key={preset.id}
                        onClick={() => { setColumnOrder(preset.columns); setColsOpen(false) }}
                        className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-muted/50 transition-colors"
                      >
                        <span className={cn("size-3.5 rounded-full border-2 shrink-0", isActive ? "border-[#1877f2] bg-[#1877f2]" : "border-muted-foreground/40")} />
                        <span className="text-xs">{preset.label}</span>
                      </button>
                    )
                  }
                  return (
                    <>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 mb-1">Recently used</p>
                      {presetButton("ecom")}
                      {presetButton("performance")}

                      <div className="border-t my-1.5" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 mb-1">Popular</p>
                      {presetButton("performance_and_clicks")}
                      {presetButton("engagement")}
                      {presetButton("delivery")}

                      <div className="border-t my-1.5" />
                      <button className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 transition-colors text-xs text-left">
                        <span>Discover more column presets</span>
                        <IconDrillRight className="size-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => { setColsOpen(false); setCustomizeColsOpen(true) }}
                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 transition-colors text-xs text-left"
                      >
                        <span>View your column presets</span>
                        <IconDrillRight className="size-3.5 text-muted-foreground" />
                      </button>

                      <div className="border-t my-1.5" />
                      <button
                        onClick={() => { setDraftAttribution(attributionWindows); setAttributionCompareOpen(true); setColsOpen(false) }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 transition-colors text-xs text-left"
                      >
                        <IconAdjustments className="size-3.5 text-muted-foreground" /> Compare attribution settings
                      </button>
                      <button disabled className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left opacity-50 cursor-not-allowed">
                        Conditional formatting
                      </button>
                      <button
                        onClick={() => { setColumnWidths({}); setColsOpen(false) }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 transition-colors text-xs text-left"
                      >
                        Reset column width
                      </button>
                      <button
                        onClick={() => { setColsOpen(false); setCustomizeColsOpen(true) }}
                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 transition-colors"
                      >
                        <span className="flex items-center gap-2 text-xs"><IconTable className="size-3.5 text-muted-foreground" /> Customize columns</span>
                        <IconDrillRight className="size-3.5 text-muted-foreground" />
                      </button>
                    </>
                  )
                })()}
              </div>
            )}
          </div>

          {/* Export */}
          <button
            onClick={exportTable}
            title="Export to CSV"
            className="size-7 flex items-center justify-center border rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground ml-1"
          >
            <IconDownload className="size-3.5 shrink-0" />
          </button>
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
          <table className="w-full text-sm border-collapse" style={{ minWidth: 1100, tableLayout: "fixed" }}>
            <thead className="sticky top-0 z-30 bg-[#f5f6f7] dark:bg-muted/80 border-b border-[#e4e6eb] dark:border-gray-800">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input ref={headerCheckRef} type="checkbox" className="rounded size-3.5 accent-blue-600" checked={allSelected} onChange={toggleAll} />
                </th>
                <th className="w-16 px-2 py-2.5 text-left text-xs font-bold text-[#1c2b33] dark:text-foreground resize-x overflow-auto">Off/On</th>
                <SortTh
                  label={tab === "ads" ? "Ad name" : tab === "adsets" ? "Ad set" : "Campaign"}
                  field="name"
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={handleSort}
                  width={columnWidths.__name || 320}
                  onResize={w => setColWidth("__name", w)}
                />
                {tab === "ads" && (
                  <th className="w-20 px-3 py-2.5 text-left text-xs font-bold text-[#1c2b33] dark:text-foreground resize-x overflow-auto">Preview</th>
                )}
                                {columnOrder.map((colId, i) => {
                  const col = customColumnMap[colId]
                  if (!col) return null
                  const moveLeft = () => setColumnOrder(prev => { const n = [...prev]; [n[i-1], n[i]] = [n[i], n[i-1]]; return n })
                  const moveRight = () => setColumnOrder(prev => { const n = [...prev]; [n[i], n[i+1]] = [n[i+1], n[i]]; return n })
                  const remove = () => setColumnOrder(prev => prev.filter(id => id !== colId))
                  const sortFieldObj = col.sortKey || colId
                  const active = sortField === sortFieldObj
                  const colWidth = getColWidth(colId)

                  return (
                    <th key={colId} style={{ width: colWidth, minWidth: colWidth, maxWidth: colWidth }} className="group/header relative px-2 py-1.5 text-left text-xs font-bold text-[#1c2b33] dark:text-foreground">
                      <div className="flex items-start gap-1">
                        <div className="cursor-pointer hover:text-foreground transition-colors flex items-start gap-0.5 min-w-0" onClick={() => handleSort(sortFieldObj)}>
                          <span className="line-clamp-2 break-words leading-tight">{col.headerLabel}</span>
                          {active
                            ? (sortDir === "asc" ? <IconArrowUp className="size-3 shrink-0 text-primary" /> : <IconArrowDown className="size-3 shrink-0 text-primary" />)
                            : <IconArrowsUpDown className="size-3 shrink-0 opacity-0 group-hover/header:opacity-40" />
                          }
                        </div>
                        <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 w-max max-w-[240px] rounded-xl border bg-popover p-3 text-[11px] font-normal leading-snug text-popover-foreground shadow-xl opacity-0 translate-y-1 transition-all group-hover/header:opacity-100 group-hover/header:translate-y-0">
                          <p className="mb-1 text-sm font-semibold leading-tight">{col.headerLabel}</p>
                          <p className="text-muted-foreground">{col.description}</p>
                        </div>
                        <HeaderCellMenu
                          colId={colId}
                          label={col.headerLabel}
                          onSortAsc={() => { setSortField(sortFieldObj); setSortDir("asc") }}
                          onSortDesc={() => { setSortField(sortFieldObj); setSortDir("desc") }}
                          onMoveLeft={moveLeft}
                          onMoveRight={moveRight}
                          onRemove={remove}
                          canMoveLeft={i > 0}
                          canMoveRight={i < columnOrder.length - 1}
                          onOpenAttributionCompare={() => { setDraftAttribution(attributionWindows); setAttributionCompareOpen(true) }}
                        />
                      </div>
                      <div
                        onMouseDown={e => startColResize(colId, colWidth, e)}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/50 opacity-0 hover:opacity-100 transition-opacity z-10"
                      />
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
                        <td style={{ width: columnWidths.__name || 320, minWidth: columnWidths.__name || 320, maxWidth: columnWidths.__name || 320 }} className={cn("px-3 py-2.5 sticky left-[100px] z-10 bg-white dark:bg-background border-r border-[#e4e6eb] dark:border-gray-800 transition-colors group/cell overflow-hidden", isSel ? "bg-[#e3f0fe] dark:bg-blue-950/30 group-hover/row:bg-[#d8e9fc]" : "group-hover/row:bg-[#f5f6f7]")}>
                          {inlineEditingId === c.id ? (
                            <div className="flex items-center gap-2"><Input value={inlineEditingName} onChange={e => setInlineEditingName(e.target.value)} onBlur={() => saveInlineRename(c.id)} onKeyDown={e => e.key === "Enter" && saveInlineRename(c.id)} className="h-7 text-xs py-1" autoFocus /></div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <button onClick={() => drillToAdSets(c)} className="text-[#1877f2] hover:underline text-xs font-semibold text-left line-clamp-2">{c.name}</button>
                                <button onClick={e => { e.stopPropagation(); setInlineEditingId(c.id); setInlineEditingName(c.name) }} className="opacity-0 group-hover/cell:opacity-100 p-0.5 hover:bg-black/5 rounded transition-opacity"><IconPencil className="size-3 text-[#65676b]" /></button>
                              </div>
                              <div className="flex items-center gap-1.5 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                <button className="text-xs text-[#65676b] font-semibold hover:underline" onClick={() => setEditingNode(c)}>Edit</button>
                                <span className="text-[#ccd0d5]">·</span>
                                <button className="text-xs text-[#65676b] font-semibold hover:underline" onClick={() => { setSelectedIds(new Set([c.id])); setDuplicateDialogOpen(true) }}>Duplicate</button>
                                <span className="text-[#ccd0d5]">·</span>
                                <button className="text-xs text-[#65676b] font-semibold hover:underline" onClick={() => openCharts(c)}>Charts</button>
                                <span className="text-[#ccd0d5]">·</span>
                                <button className="text-xs text-[#65676b] font-semibold hover:underline" onClick={() => openCompare(c)}>Compare</button>
                              </div>
                            </div>
                          )}
                        </td>
                        {columnOrder.map(colId => <td key={colId} style={{ width: getColWidth(colId), maxWidth: getColWidth(colId) }} className={cn("px-2 py-1.5 align-top overflow-hidden", isTextCol(colId) ? "text-right" : "text-left")}>{renderCellContent(colId, c)}</td>)}
                      </tr>
                      {rowBDs.map((br, i) => (
                        <tr key={`bd-${i}`} className="border-b border-[#e4e6eb] dark:border-gray-800 bg-[#f5f6f7] dark:bg-muted/10">
                          <td className="sticky left-0 z-10 bg-[#f5f6f7] dark:bg-muted/10 w-10 px-3 py-2" />
                          <td className="sticky left-10 z-10 bg-[#f5f6f7] dark:bg-muted/10 w-16 px-2 py-2" />
                          <td className="px-3 py-2 sticky left-[100px] z-10 bg-[#f5f6f7] dark:bg-muted/10 border-r border-[#e4e6eb] dark:border-gray-800">
                            <span className="pl-6 text-xs text-[#1c2b33] dark:text-foreground">{br.breakdownLabel}</span>
                          </td>
                          {columnOrder.map(colId => <td key={colId} style={{ width: getColWidth(colId), maxWidth: getColWidth(colId) }} className={cn("px-2 py-1.5 align-top overflow-hidden", isTextCol(colId) ? "text-right" : "text-left")}>{renderBreakdownCell(colId, br.ins, c.objective)}</td>)}
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
                        <td style={{ width: columnWidths.__name || 320, minWidth: columnWidths.__name || 320, maxWidth: columnWidths.__name || 320 }} className={cn("px-3 py-2.5 sticky left-[100px] z-10 bg-white dark:bg-background border-r border-[#e4e6eb] dark:border-gray-800 transition-colors group/cell overflow-hidden", isSel ? "bg-[#e3f0fe] dark:bg-blue-950/30 group-hover/row:bg-[#d8e9fc]" : "group-hover/row:bg-[#f5f6f7]")}>
                          {inlineEditingId === a.id ? (
                            <div className="flex items-center gap-2"><Input value={inlineEditingName} onChange={e => setInlineEditingName(e.target.value)} onBlur={() => saveInlineRename(a.id)} onKeyDown={e => e.key === "Enter" && saveInlineRename(a.id)} className="h-7 text-xs py-1" autoFocus /></div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <button onClick={() => drillToAds(a)} className="text-[#1877f2] hover:underline text-xs font-semibold text-left line-clamp-2">{a.name}</button>
                                <button onClick={e => { e.stopPropagation(); setInlineEditingId(a.id); setInlineEditingName(a.name) }} className="opacity-0 group-hover/cell:opacity-100 p-0.5 hover:bg-black/5 rounded transition-opacity"><IconPencil className="size-3 text-[#65676b]" /></button>
                              </div>
                              <div className="flex items-center gap-1.5 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                <button className="text-xs text-[#65676b] font-semibold hover:underline" onClick={() => setEditingNode(a)}>Edit</button>
                                <span className="text-[#ccd0d5]">·</span>
                                <button className="text-xs text-[#65676b] font-semibold hover:underline" onClick={() => { setSelectedIds(new Set([a.id])); setDuplicateDialogOpen(true) }}>Duplicate</button>
                                <span className="text-[#ccd0d5]">·</span>
                                <button className="text-xs text-[#65676b] font-semibold hover:underline" onClick={() => openCharts(a)}>Charts</button>
                                <span className="text-[#ccd0d5]">·</span>
                                <button className="text-xs text-[#65676b] font-semibold hover:underline" onClick={() => openCompare(a)}>Compare</button>
                              </div>
                            </div>
                          )}
                        </td>
                        {columnOrder.map(colId => <td key={colId} style={{ width: getColWidth(colId), maxWidth: getColWidth(colId) }} className={cn("px-2 py-1.5 align-top overflow-hidden", isTextCol(colId) ? "text-right" : "text-left")}>{renderCellContent(colId, a)}</td>)}
                      </tr>
                      {rowBDs.map((br, i) => (
                        <tr key={`bd-${i}`} className="border-b border-[#e4e6eb] dark:border-gray-800 bg-[#f5f6f7] dark:bg-muted/10">
                          <td className="sticky left-0 z-10 bg-[#f5f6f7] dark:bg-muted/10 w-10 px-3 py-2" />
                          <td className="sticky left-10 z-10 bg-[#f5f6f7] dark:bg-muted/10 w-16 px-2 py-2" />
                          <td className="px-3 py-2 sticky left-[100px] z-10 bg-[#f5f6f7] dark:bg-muted/10 border-r border-[#e4e6eb] dark:border-gray-800">
                            <span className="pl-6 text-xs text-[#1c2b33] dark:text-foreground">{br.breakdownLabel}</span>
                          </td>
                          {columnOrder.map(colId => <td key={colId} style={{ width: getColWidth(colId), maxWidth: getColWidth(colId) }} className={cn("px-2 py-1.5 align-top overflow-hidden", isTextCol(colId) ? "text-right" : "text-left")}>{renderBreakdownCell(colId, br.ins, objective)}</td>)}
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
                        <td style={{ width: columnWidths.__name || 320, minWidth: columnWidths.__name || 320, maxWidth: columnWidths.__name || 320 }} className={cn("px-3 py-2.5 sticky left-[100px] z-10 bg-white dark:bg-background border-r border-[#e4e6eb] dark:border-gray-800 transition-colors group/cell overflow-hidden", isSel ? "bg-[#e3f0fe] dark:bg-blue-950/30 group-hover/row:bg-[#d8e9fc]" : "group-hover/row:bg-[#f5f6f7]")}>
                          {inlineEditingId === a.id ? (
                            <div className="flex items-center gap-2"><Input value={inlineEditingName} onChange={e => setInlineEditingName(e.target.value)} onBlur={() => saveInlineRename(a.id)} onKeyDown={e => e.key === "Enter" && saveInlineRename(a.id)} className="h-7 text-xs py-1" autoFocus /></div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-semibold text-[#1c2b33] dark:text-gray-200 line-clamp-2">{a.name}</p>
                                <button onClick={e => { e.stopPropagation(); setInlineEditingId(a.id); setInlineEditingName(a.name) }} className="opacity-0 group-hover/cell:opacity-100 p-0.5 hover:bg-black/5 rounded transition-opacity"><IconPencil className="size-3 text-[#65676b]" /></button>
                              </div>
                              <div className="flex items-center gap-1.5 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                <button className="text-xs text-[#65676b] font-semibold hover:underline" onClick={() => setEditingNode(a)}>Edit</button>
                                <span className="text-[#ccd0d5]">·</span>
                                <button className="text-xs text-[#65676b] font-semibold hover:underline" onClick={() => { setSelectedIds(new Set([a.id])); setDuplicateDialogOpen(true) }}>Duplicate</button>
                                <span className="text-[#ccd0d5]">·</span>
                                <button className="text-xs text-[#65676b] font-semibold hover:underline" onClick={() => openCharts(a)}>Charts</button>
                                <span className="text-[#ccd0d5]">·</span>
                                <button className="text-xs text-[#65676b] font-semibold hover:underline" onClick={() => openCompare(a)}>Compare</button>
                              </div>
                              {adSet && <p className="text-xs text-[#8a8d91] truncate max-w-[200px]">↳ {adSet.name}</p>}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="relative inline-block">
                            {thumb ? <img src={thumb} alt="" className="size-12 rounded object-cover border" loading="lazy" /> : <div className="size-12 rounded bg-muted border flex items-center justify-center text-xs text-muted-foreground">No img</div>}
                            {a.creative_variations && (
                              <span className="absolute -top-1.5 -right-1.5 bg-[#1877f2] text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none shadow" title="Multiple text options">
                                {(a.creative_variations.bodies.length + a.creative_variations.titles.length + a.creative_variations.descriptions.length)}
                              </span>
                            )}
                          </div>
                        </td>
                        {columnOrder.map(colId => <td key={colId} style={{ width: getColWidth(colId), maxWidth: getColWidth(colId) }} className={cn("px-2 py-1.5 align-top overflow-hidden", isTextCol(colId) ? "text-right" : "text-left")}>{renderCellContent(colId, a)}</td>)}
                      </tr>
                      {rowBDs.map((br, i) => (
                        <tr key={`bd-${i}`} className="border-b border-[#e4e6eb] dark:border-gray-800 bg-[#f5f6f7] dark:bg-muted/10">
                          <td className="sticky left-0 z-10 bg-[#f5f6f7] dark:bg-muted/10 w-10 px-3 py-2" />
                          <td className="sticky left-10 z-10 bg-[#f5f6f7] dark:bg-muted/10 w-16 px-2 py-2" />
                          <td className="px-3 py-2 sticky left-[100px] z-10 bg-[#f5f6f7] dark:bg-muted/10 border-r border-[#e4e6eb] dark:border-gray-800">
                            <span className="pl-6 text-xs text-[#1c2b33] dark:text-foreground">{br.breakdownLabel}</span>
                          </td>
                          <td className="px-3 py-2 bg-[#f5f6f7] dark:bg-muted/10" />
                          {columnOrder.map(colId => <td key={colId} style={{ width: getColWidth(colId), maxWidth: getColWidth(colId) }} className={cn("px-2 py-1.5 align-top overflow-hidden", isTextCol(colId) ? "text-right" : "text-left")}>{renderBreakdownCell(colId, br.ins, objective)}</td>)}
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
                  {columnOrder.map(colId => (
                    <td key={colId} className={cn("px-2 py-1.5 text-xs font-semibold tabular-nums text-[#1c2b33] dark:text-white", isTextCol(colId) ? "text-right" : "text-left")}>
                      {renderTotalCell(colId)}
                    </td>
                  ))}
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
            <SheetDescription>Recent ad launches across this workspace</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {historyLoading && (
              <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                <IconLoader2 className="size-4 animate-spin" /><span className="text-sm">Loading...</span>
              </div>
            )}
            {!historyLoading && historyBatches.length === 0 && (
              <div className="text-center py-10 text-sm text-muted-foreground">No launch history found for this workspace.</div>
            )}
            {!historyLoading && historyBatches.map((b: any) => (
              <div key={b.id} className="border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold",
                      b.status === "success" ? "bg-green-100 text-green-700" :
                      b.status === "partial" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                    )}>● {b.status}</span>
                    <span className="text-xs font-mono text-muted-foreground">{b.id.replace(/-/g, "").slice(-6).toUpperCase()}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div><span className="text-muted-foreground">Ads: </span><span className="font-medium">{b.total_ads} ({b.failed_ads} failed)</span></div>
                  <div><span className="text-muted-foreground">Launcher: </span><span className="font-medium">{b.launcher?.full_name || b.user_name || b.launcher?.email || "Unknown"}</span></div>
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
          <div className="mt-6 space-y-5 px-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Primary Text</label>
              <textarea
                value={defaultPrimaryText}
                onChange={e => setDefaultPrimaryText(e.target.value)}
                rows={3}
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
            <Button variant="ghost" onClick={resetAllDefaults}>Reset All</Button>
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

      {/* ── Compare Attribution Settings Modal ── */}
      <Dialog open={attributionCompareOpen} onOpenChange={setAttributionCompareOpen}>
        <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-3 border-b">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle>Compare attribution settings</DialogTitle>
                <DialogDescription className="mt-1 text-xs leading-relaxed">
                  Compare when and how people take action after engaging with your ads.<br />
                  Selections in this tool are for reporting only and do not change ad optimisation.
                </DialogDescription>
              </div>
              <DialogClose className="rounded p-1 hover:bg-muted/50">×</DialogClose>
            </div>
          </DialogHeader>

          <div className="px-4 py-4 space-y-5 text-sm">
            <div>
              <p className="font-semibold mb-3">Standard attribution</p>
              <div className="space-y-3">
                {STANDARD_ATTR.map(a => (
                  <label key={a.key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="size-5 rounded border-muted-foreground/40"
                      checked={draftAttribution.includes(a.key)}
                      onChange={() => setDraftAttribution(prev => prev.includes(a.key) ? prev.filter(k => k !== a.key) : [...prev, a.key])}
                    />
                    <span>{a.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <button type="button" className="w-full flex items-center justify-between text-left">
                <span>
                  <span className="block">Apple SKAdNetwork</span>
                  <span className="block text-xs text-muted-foreground">App ads only</span>
                </span>
                <IconChevronDown className="size-4" />
              </button>
              <div className="mt-3 space-y-3">
                {SKAN_ATTR.map(a => (
                  <label key={a.key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="size-5 rounded border-muted-foreground/40"
                      checked={draftAttribution.includes(a.key)}
                      onChange={() => setDraftAttribution(prev => prev.includes(a.key) ? prev.filter(k => k !== a.key) : [...prev, a.key])}
                    />
                    <span>{a.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="font-semibold mb-3">Advanced option</p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="size-5 rounded border-muted-foreground/40"
                  checked={draftAttribution.includes("incremental")}
                  onChange={() => setDraftAttribution(prev => prev.includes("incremental") ? prev.filter(k => k !== "incremental") : [...prev, "incremental"])}
                />
                <span>Incremental attribution</span>
              </label>
            </div>
          </div>

          <DialogFooter className="px-4 py-3 border-t bg-muted/10">
            <Button variant="outline" onClick={() => setAttributionCompareOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                setAttributionWindows(draftAttribution)
                setAttributionCompareOpen(false)
              }}
              className="bg-[#1877f2] hover:bg-[#1464d8] text-white"
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Customize Columns Modal ── */}
      <CustomizeColumnsModal
        open={customizeColsOpen}
        columnOrder={columnOrder}
        customMetrics={customMetrics}
        onApply={setColumnOrder}
        onSavePreset={saveCustomPreset}
        onSaveCustomMetric={m => setCustomMetrics(p => [...p, m])}
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
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{typeLabel}</p>
                    <p className="text-sm font-semibold truncate leading-tight">{node.name}</p>
                  </div>
                  <span className={cn(
                    "shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
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
                        { label: "Spend",  value: fmtMoney(getSpend(editingNode)), accent: true },
                        { label: "Results",value: String(getResults(editingNode, node.objective).count) },
                        { label: "Impr.",  value: parseInt(insight.impressions).toLocaleString() },
                        { label: "Clicks", value: parseInt(insight.clicks).toLocaleString() },
                      ].map(s => (
                        <div key={s.label} className="rounded-xl bg-muted/40 border px-2.5 py-2 text-center">
                          <p className="text-xs text-muted-foreground mb-0.5">{s.label}</p>
                          <p className={cn("text-sm font-bold tabular-nums truncate", s.accent && "text-primary")}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Settings section ── */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Settings</p>

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
                            <p className="text-xs text-muted-foreground">
                              Remaining: <span className="font-medium text-foreground">{fmtMoney((parseInt(node.budget_remaining) / 100))}</span>
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
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Strategy</p>
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
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Creative</p>
                      <div className="rounded-2xl border overflow-hidden shadow-sm">
                        {node.creative.thumbnail_url && (
                          <img src={node.creative.thumbnail_url} className="w-full object-cover max-h-52" loading="lazy" />
                        )}
                        {(node.creative.title || node.creative.body) && (
                          <div className="px-3.5 py-3 space-y-3 bg-neutral-50 dark:bg-neutral-900 border-t">
                            <div className="space-y-1">
                              {node.creative.title && (
                                <p className="text-sm font-semibold leading-snug line-clamp-2 text-foreground">{node.creative.title}</p>
                              )}
                              {node.creative.body && (
                                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{node.creative.body}</p>
                              )}
                            </div>

                            {node.creative_variations && (
                              <div className="pt-2 border-t border-dashed space-y-2">
                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Additional Variations</p>

                                {node.creative_variations.titles.length > 1 && (
                                  <div className="space-y-1">
                                    <span className="text-[10px] text-muted-foreground">Headlines:</span>
                                    {node.creative_variations.titles.slice(1).map((t: string, i: number) => (
                                      <p key={i} className="text-xs font-medium text-foreground bg-white dark:bg-black border rounded px-2 py-1 line-clamp-1">{t}</p>
                                    ))}
                                  </div>
                                )}

                                {node.creative_variations.bodies.length > 1 && (
                                  <div className="space-y-1">
                                    <span className="text-[10px] text-muted-foreground">Primary Texts:</span>
                                    {node.creative_variations.bodies.slice(1).map((b: string, i: number) => (
                                      <p key={i} className="text-xs text-muted-foreground bg-white dark:bg-black border rounded px-2 py-1 line-clamp-2">{b}</p>
                                    ))}
                                  </div>
                                )}

                                {node.creative_variations.descriptions.length > 1 && (
                                  <div className="space-y-1">
                                    <span className="text-[10px] text-muted-foreground">Descriptions:</span>
                                    {node.creative_variations.descriptions.slice(1).map((d: string, i: number) => (
                                      <p key={i} className="text-xs text-muted-foreground bg-white dark:bg-black border rounded px-2 py-1 line-clamp-1">{d}</p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Details</p>
                    <div className="rounded-xl border overflow-hidden text-xs">
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

      {performancePopup && selectedAccountId && (
        <PerformancePopup
          mode={performancePopup.mode}
          rows={performancePopup.rows}
          level={level}
          accountId={selectedAccountId}
          datePreset={datePreset === "custom" ? "last_30d" : datePreset}
          since={drawerSince}
          until={drawerUntil}
          onClose={() => setPerformancePopup(null)}
          campaigns={campaigns}
          adSets={adSets}
          ads={ads}
          onDuplicate={(id: string) => { setSelectedIds(new Set([id])); setDuplicateDialogOpen(true) }}
          onDelete={(id: string) => { setSelectedIds(new Set([id])); setDeleteConfirmOpen(true) }}
          onEdit={(id: string) => {
            const node = campaigns.find(x => x.id === id) || adSets.find(x => x.id === id) || ads.find(x => x.id === id) || null
            setEditingNode(node)
          }}
          onViewHistory={(_id: string) => { setHistoryOpen(true); fetchHistory() }}
          attributionWindows={attributionWindows}
        />
      )}

    </div>
  )
}
