"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useAdAccount } from "@/lib/ad-account-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  IconTrendingUp, IconLayoutDashboard, IconChartBar, IconMessageCircle,
  IconLoader2, IconChevronDown, IconRefresh, IconPlus, IconAlertCircle,
  IconPlayerPlay, IconPhoto, IconFilter, IconX, IconMoodEmpty,
  IconArrowDown, IconArrowUp, IconArrowsUpDown, IconSearch,
  IconGripVertical, IconPencil, IconTrophy, IconFlag, IconBolt,
  IconDeviceAnalytics, IconGauge, IconListNumbers, IconBulb,
  IconLayoutGridAdd, IconCheck,
} from "@tabler/icons-react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart, Bar,
  BarChart,
} from "recharts"
import { AllAccountsView, SpendView, DemographicView, CountryView, AdHistoryView, PlacementsView, DeviceView, ReachView, CreativeAuditView, UploadStatsView, PageInsightsView } from "./_statistics"
import { CommentsView } from "./_comments"
import { ReportsView, ReportSection } from "./_reports"

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopAd {
  rank: number
  adId: string
  adName: string
  adsetName?: string
  campaignName?: string
  spend: number
  results: number
  costPerResult: number
  purchaseValue: number
  roas: number
  impressions: number
  linkClicks: number
  ctr: number
  dateStart?: string
  createdTime?: string
  thumbnail?: string | null
  isVideo: boolean
}

interface DailyMetric {
  date: string
  spend: number
  impressions: number
  linkClicks: number
  purchases: number
  purchaseVal: number
  leads: number
  ctr: number
  cpm: number
}

interface MetricTotals {
  spend: number
  impressions: number
  clicks: number
  purchases: number
  purchaseValue: number
  leads: number
  cpm: number
  cpc: number
  ctr: number
  avgPurchaseValue: number
  conversionRate: number
  costPerPurchase: number
  roas: number
}

interface AdFilter {
  id: string
  field: string
  value: string
  label: string
}

type SortField = "spend" | "results" | "cpr" | "created" | "impressions" | "ctr"
type SortDir   = "asc" | "desc"

// ─── Dashboard widget types ───────────────────────────────────────────────────

type WidgetType =
  | "metric-cards"
  | "spend-revenue-roas"
  | "mtd-chart"
  | "observations"
  | "top5-revenue"
  | "winners"
  | "breakdown"
  | "pacing"

interface DashWidget {
  id: string
  type: WidgetType
  config?: Record<string, any>
}

const WIDGET_DEFS: { type: WidgetType; label: string; desc: string; icon: any }[] = [
  { type: "metric-cards",      label: "Metric cards",          icon: IconLayoutDashboard, desc: "Row of customizable KPI tiles — impressions, CPC, ROAS, purchases and more." },
  { type: "spend-revenue-roas",label: "Spend, revenue, ROAS",  icon: IconChartBar,        desc: "Spend, revenue and ROAS cards with colored backgrounds." },
  { type: "mtd-chart",         label: "MTD performance chart", icon: IconDeviceAnalytics, desc: "Combined bar + line chart tracking daily spend, revenue and ROAS." },
  { type: "observations",      label: "Observations & next steps", icon: IconBulb,        desc: "Smart observations surfacing what's working and suggested next steps." },
  { type: "top5-revenue",      label: "Top 5 ads by revenue",  icon: IconListNumbers,     desc: "Five highest-revenue ads with thumbnails for quick creative review." },
  { type: "winners",           label: "Winners & high potential", icon: IconTrophy,       desc: "Winners and high-potential ads ranked by ROAS — configurable thresholds." },
  { type: "breakdown",         label: "Performance breakdown", icon: IconChartBar,        desc: "Spend split by platform, age, gender or device with selectable metric." },
  { type: "pacing",            label: "Pacing & budget burn",  icon: IconGauge,           desc: "Tracks how much of the period budget has been spent and projects delivery." },
]

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_PRESETS = [
  { label: "Last 7 days",  value: "last_7d" },
  { label: "Last 30 days", value: "last_30d" },
  { label: "Last 90 days", value: "last_90d" },
  { label: "This month",   value: "this_month" },
  { label: "Last month",   value: "last_month" },
]

const GROUP_BY_OPTIONS = [
  { key: "none",     label: "None" },
  { key: "unique",   label: "Unique Ad" },
  { key: "campaign", label: "Campaign" },
  { key: "adset",    label: "Adset" },
]

const FILTER_FIELDS = [
  // Dimension
  { key: "ad_name",        label: "Ad name",          type: "text",    category: "Dimension" },
  { key: "adset_name",     label: "Adset name",        type: "dynamic", category: "Dimension" },
  { key: "campaign_name",  label: "Campaign name",     type: "dynamic", category: "Dimension" },
  { key: "landing_page",   label: "Landing page",      type: "text",    category: "Dimension" },
  { key: "ad_type",        label: "Ad type",           type: "select",  category: "Dimension",
    options: [{ label: "Video", value: "video" }, { label: "Image", value: "image" }] },
  { key: "creative",       label: "Creative",          type: "text",    category: "Dimension" },
  { key: "copy",           label: "Copy",              type: "text",    category: "Dimension" },
  { key: "headline",       label: "Headline",          type: "text",    category: "Dimension" },
  { key: "cta",            label: "Call to action",    type: "select",  category: "Dimension",
    options: [
      { label: "Learn More",  value: "LEARN_MORE" }, { label: "Shop Now",    value: "SHOP_NOW" },
      { label: "Sign Up",     value: "SIGN_UP" },    { label: "Buy Now",     value: "BUY_NOW" },
      { label: "Get Offer",   value: "GET_OFFER" },  { label: "Download",    value: "DOWNLOAD" },
      { label: "Book Now",    value: "BOOK_NOW" },   { label: "Contact Us",  value: "CONTACT_US" },
      { label: "Watch More",  value: "WATCH_MORE" }, { label: "Get Quote",   value: "GET_QUOTE" },
      { label: "Subscribe",   value: "SUBSCRIBE" },  { label: "Apply Now",   value: "APPLY_NOW" },
    ] },
  { key: "ad_status",      label: "Ad status",         type: "select",  category: "Dimension",
    options: [{ label: "Active", value: "ACTIVE" }, { label: "Paused", value: "PAUSED" }, { label: "Archived", value: "ARCHIVED" }] },
  { key: "active_status",  label: "Active status",     type: "select",  category: "Dimension",
    options: [{ label: "Active", value: "active" }, { label: "Inactive", value: "inactive" }] },
  { key: "campaign_objective", label: "Campaign Objective", type: "dynamic", category: "Dimension" },
  { key: "result_type",    label: "Result Type",       type: "dynamic", category: "Dimension" },
  // Performance
  { key: "spend",          label: "Amount Spent",      type: "number", category: "Performance" },
  { key: "impressions",    label: "Impressions",       type: "number", category: "Performance" },
  { key: "clicks",         label: "Clicks",            type: "number", category: "Performance" },
  { key: "outbound_clicks",label: "Outbound Clicks",   type: "number", category: "Performance" },
  { key: "reach",          label: "Reach",             type: "number", category: "Performance" },
  { key: "results",        label: "Results",           type: "number", category: "Performance" },
  { key: "cpr",            label: "Cost Per Result",   type: "number", category: "Performance" },
  { key: "roas",           label: "ROAS",              type: "number", category: "Performance" },
  { key: "purchase_roas",  label: "Purchase ROAS (return on ad spend)", type: "number", category: "Performance" },
  { key: "website_roas",   label: "Website Purchase ROAS (return on ad spend)", type: "number", category: "Performance" },
  { key: "purchases",      label: "Purchases",         type: "number", category: "Performance" },
  { key: "purchase_value", label: "Purchase Value",    type: "number", category: "Performance" },
  { key: "cost_per_purchase", label: "Cost Per Purchase", type: "number", category: "Performance" },
  { key: "avg_purchase_value", label: "Average purchase value", type: "number", category: "Performance" },
  { key: "purchase_cvr",   label: "Purchase Conversion Rate", type: "number", category: "Performance" },
  { key: "leads",          label: "Leads",             type: "number", category: "Performance" },
  { key: "cost_per_lead",  label: "Cost Per Lead",     type: "number", category: "Performance" },
  { key: "link_clicks",    label: "Link Clicks",       type: "number", category: "Performance" },
  { key: "cost_per_link_click", label: "Cost Per Link Click", type: "number", category: "Performance" },
  { key: "landing_page_views", label: "Landing Page Views", type: "number", category: "Performance" },
  { key: "cpm",            label: "CPM (Cost Per Mille)", type: "number", category: "Performance" },
  { key: "cost_per_1000_reached", label: "Cost per 1,000 Accounts Center Accounts Reached", type: "number", category: "Performance" },
  { key: "cpc_all",        label: "CPC (Cost Per Click)", type: "number", category: "Performance" },
  { key: "cpc_outbound",   label: "CPC (Cost Per Outbound Click)", type: "number", category: "Performance" },
  { key: "ctr_all",        label: "CTR (All clicks)",  type: "number", category: "Performance" },
  { key: "ctr_link",       label: "CTR (Link)",        type: "number", category: "Performance" },
  { key: "ctr_outbound",   label: "CTR (Outbound Click Through Rate)", type: "number", category: "Performance" },
  { key: "frequency",      label: "Frequency",         type: "number", category: "Performance" },
  { key: "cost_per_new_customer", label: "Cost per New Customer (CPA)", type: "number", category: "Performance" },
  // Conversions
  { key: "app_installs",   label: "App Installs",      type: "number", category: "Conversions" },
  { key: "cost_per_install", label: "Cost Per Install", type: "number", category: "Conversions" },
  { key: "app_activations", label: "App Activations",  type: "number", category: "Conversions" },
  { key: "cost_per_app_activation", label: "Cost Per App Activation", type: "number", category: "Conversions" },
  { key: "add_to_cart",    label: "Add to Cart",       type: "number", category: "Conversions" },
  { key: "cost_per_add_to_cart", label: "Cost Per Add to Cart", type: "number", category: "Conversions" },
  { key: "registrations",  label: "Registrations",     type: "number", category: "Conversions" },
  { key: "cost_per_registration", label: "Cost Per Registration", type: "number", category: "Conversions" },
  { key: "content_views",  label: "Content Views",     type: "number", category: "Conversions" },
  { key: "cost_per_content_view", label: "Cost Per Content View", type: "number", category: "Conversions" },
  // Engagement
  { key: "page_engagements", label: "Page Engagements", type: "number", category: "Engagement" },
  { key: "cost_per_page_engagement", label: "Cost Per Page Engagement", type: "number", category: "Engagement" },
  { key: "post_engagements", label: "Post Engagements", type: "number", category: "Engagement" },
  { key: "cost_per_post_engagement", label: "Cost Per Post Engagement", type: "number", category: "Engagement" },
  { key: "post_reactions",  label: "Post Reactions",   type: "number", category: "Engagement" },
  { key: "cost_per_post_reaction", label: "Cost Per Post Reaction", type: "number", category: "Engagement" },
  // Video
  { key: "video_3s",       label: "3 second video views", type: "number", category: "Video" },
  { key: "cost_per_3s",    label: "Cost per 3 second video view", type: "number", category: "Video" },
  { key: "thruplay",       label: "Thruplay",          type: "number", category: "Video" },
  { key: "cost_per_thruplay", label: "Cost per thruplay", type: "number", category: "Video" },
  { key: "thruplay_cvr",   label: "Thruplay conversion rate", type: "number", category: "Video" },
  { key: "video_30s",      label: "Video 30s watched", type: "number", category: "Video" },
  { key: "video_p25",      label: "Video 25% watched", type: "number", category: "Video" },
  { key: "video_p50",      label: "Video 50% watched", type: "number", category: "Video" },
  { key: "video_p75",      label: "Video 75% watched", type: "number", category: "Video" },
  { key: "video_p95",      label: "Video 95% watched", type: "number", category: "Video" },
  { key: "video_p100",     label: "Video 100% watched", type: "number", category: "Video" },
  { key: "avg_watch_time", label: "Average Video Watch Time", type: "number", category: "Video" },
  { key: "vtr",            label: "VTR (View Through Rate)", type: "number", category: "Video" },
  { key: "hook_rate",      label: "Hook Rate (Thumbstop)", type: "number", category: "Video" },
  { key: "hold_rate",      label: "Hold rate",         type: "number", category: "Video" },
  { key: "thumbnail_perf", label: "Thumbnail Performance", type: "number", category: "Video" },
  { key: "watch_rate_25",  label: "Video 25% watched rate", type: "number", category: "Video" },
  { key: "cost_per_video_p25", label: "Cost per Video 25 watched", type: "number", category: "Video" },
  { key: "watch_rate_50",  label: "Video 50% watched rate", type: "number", category: "Video" },
  { key: "cost_per_video_p50", label: "Cost per Video 50% watched", type: "number", category: "Video" },
  { key: "watch_rate_75",  label: "Video 75% watched rate", type: "number", category: "Video" },
  { key: "cost_per_video_p75", label: "Cost per Video 75% watched", type: "number", category: "Video" },
  { key: "watch_rate_95",  label: "Video 95% watched rate", type: "number", category: "Video" },
  { key: "cost_per_video_p95", label: "Cost per Video 95% watched", type: "number", category: "Video" },
  { key: "watch_rate_100", label: "Video 100% watched rate", type: "number", category: "Video" },
  { key: "cost_per_video_p100", label: "Cost per Video 100 watched", type: "number", category: "Video" },
  { key: "watch_rate_25b", label: "Watch Rate 25%",    type: "number", category: "Video" },
  { key: "watch_rate_50b", label: "Watch Rate 50%",    type: "number", category: "Video" },
  { key: "watch_rate_75b", label: "Watch Rate 75%",    type: "number", category: "Video" },
]

const METRIC_DEFS: { key: SortField; label: string; color: string }[] = [
  { key: "spend",   label: "Amount Spent",    color: "#3b82f6" },
  { key: "results", label: "Results",          color: "#ec4899" },
  { key: "cpr",     label: "Cost Per Result",  color: "#14b8a6" },
  { key: "created", label: "Earliest created", color: "#60a5fa" },
]

const DEFAULT_WIDGETS: DashWidget[] = [
  { id: "w-spend", type: "spend-revenue-roas" },
  { id: "w-mtd",   type: "mtd-chart" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt$ = (v: number, digits = 2) =>
  "$" + v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })

const fmtK = (v: number) =>
  v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + "M" :
  v >= 1000 ? (v / 1000).toFixed(1) + "K" : String(Math.round(v))

const fmtDate = (s?: string | null) => {
  if (!s) return "—"
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const fmtDay = (s: string) => {
  const d = new Date(s)
  return `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })}`
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  if (!data?.length || data.every(v => v === 0)) {
    return <div className="h-12 flex items-center justify-center text-xs text-muted-foreground/30">No data</div>
  }
  const max = Math.max(...data), min = Math.min(...data)
  const range = max - min || 1
  const W = 200, H = 48, pad = 2
  const pts = data.map((v, i) => {
    const x = pad + (i / Math.max(data.length - 1, 1)) * (W - pad * 2)
    const y = H - pad - ((v - min) / range) * (H - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-12">
      <polyline points={pts} fill="none" stroke="#3b82f6" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function MetricCard({ label, value, sparkData }: { label: string; value: string; sparkData: number[] }) {
  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-1 hover:shadow-sm transition-shadow">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <div className="mt-1"><Sparkline data={sparkData} /></div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Section = "dashboard" | "statistics" | "comments" | ReportSection
type StatTab = "all-accounts" | "spend" | "demographic" | "country" | "ad-history" | "placements" | "device" | "reach" | "creative-audit" | "upload-stats" | "page-insights"

export default function InsightsPage() {
  const { selectedAccountId, adAccounts, setSelectedAccountId } = useAdAccount()
  const [section, setSection] = useState<Section>("top-creatives")
  const [statTab, setStatTab] = useState<StatTab>("all-accounts")
  const [visitedStatTabs, setVisitedStatTabs] = useState<Set<StatTab>>(() => new Set<StatTab>(["all-accounts"]))

  // ── Top Creatives state ───────────────────────────────────────────────
  const [topAds, setTopAds]         = useState<TopAd[]>([])
  const [loadingTop, setLoadingTop] = useState(false)
  const [loadingMoreTop, setLoadingMoreTop] = useState(false)
  const [topError, setTopError]     = useState("")
  const [topCursor, setTopCursor]   = useState<string | null>(null)
  const [topHasMore, setTopHasMore] = useState(false)

  const [datePreset, setDatePreset] = useState("last_90d")
  const [dateOpen, setDateOpen]     = useState(false)
  const dateRef = useRef<HTMLDivElement>(null)

  const [groupBy, setGroupBy]   = useState("unique")
  const [groupOpen, setGroupOpen] = useState(false)
  const groupRef = useRef<HTMLDivElement>(null)

  const [sortField, setSortField] = useState<SortField>("spend")
  const [sortDir, setSortDir]     = useState<SortDir>("desc")
  const [visibleMetrics, setVisibleMetrics] = useState<SortField[]>(["spend", "results", "cpr", "created"])

  const [activeFilters, setActiveFilters] = useState<AdFilter[]>([])
  const [filterOpen, setFilterOpen]       = useState(false)
  const [filterSearch, setFilterSearch]   = useState("")
  const [pendingField, setPendingField]   = useState<typeof FILTER_FIELDS[number] | null>(null)
  const [pendingValue, setPendingValue]   = useState("")
  const [pendingOperator, setPendingOperator] = useState<">=" | "<=" | ">" | "<" | "=">(">=")
  const [valueSearch, setValueSearch]     = useState("")
  const filterRef = useRef<HTMLDivElement>(null)

  // ── Account picker ────────────────────────────────────────────────────
  const [accountPickerOpen, setAccountPickerOpen] = useState(false)
  const accountPickerRef = useRef<HTMLDivElement>(null)

  // ── Custom Dashboard state ────────────────────────────────────────────
  const [metrics, setMetrics]       = useState<MetricTotals | null>(null)
  const [daily, setDaily]           = useState<DailyMetric[]>([])
  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [metricsError, setMetricsError]     = useState("")
  const [metricsFromSnapshot, setMetricsFromSnapshot] = useState(false)
  const [snapshotDate, setSnapshotDate]               = useState<string | null>(null)
  const [dashDatePreset, setDashDatePreset] = useState("last_30d")
  const [dashDateOpen, setDashDateOpen]     = useState(false)
  const dashDateRef = useRef<HTMLDivElement>(null)

  // Dashboard top ads (for Top5 + Winners widgets)
  const [dashTopAds, setDashTopAds]           = useState<TopAd[]>([])
  const [loadingDashTop, setLoadingDashTop]   = useState(false)

  // Widget system
  const [widgets, setWidgets]           = useState<DashWidget[]>(DEFAULT_WIDGETS)
  const [addWidgetOpen, setAddWidgetOpen] = useState(false)
  const [dragging, setDragging]         = useState<string | null>(null)
  const [dragOver, setDragOver]         = useState<string | null>(null)

  const accountName = adAccounts?.find((a: any) => a.id === selectedAccountId)?.name || selectedAccountId || "—"

  // ── Close dropdowns on outside click ─────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setDateOpen(false)
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) setGroupOpen(false)
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false); setPendingField(null); setPendingValue(""); setFilterSearch(""); setValueSearch("")
      }
      if (dashDateRef.current && !dashDateRef.current.contains(e.target as Node)) setDashDateOpen(false)
      if (accountPickerRef.current && !accountPickerRef.current.contains(e.target as Node)) setAccountPickerOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // ── Load top creatives ────────────────────────────────────────────────
  const loadTop = useCallback((after?: string) => {
    if (!selectedAccountId) return
    const isLoadMore = !!after
    if (isLoadMore) setLoadingMoreTop(true); else { setLoadingTop(true); setTopError("") }
    const params = new URLSearchParams({ adAccountId: selectedAccountId, datePreset, limit: "20" })
    if (after) params.set("after", after)
    fetch(`/api/insights/top-creatives?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setTopError(d.error); return }
        setTopAds(prev => isLoadMore ? [...prev, ...(d.ads || [])] : (d.ads || []))
        setTopCursor(d.nextCursor || null)
        setTopHasMore(d.hasMore ?? false)
      })
      .catch(e => setTopError(e.message))
      .finally(() => { setLoadingTop(false); setLoadingMoreTop(false) })
  }, [selectedAccountId, datePreset])

  // ── Load dashboard metrics ────────────────────────────────────────────
  const loadMetrics = useCallback(() => {
    if (!selectedAccountId) return
    setLoadingMetrics(true); setMetricsError("")
    fetch(`/api/insights/metrics?adAccountId=${encodeURIComponent(selectedAccountId)}&datePreset=${dashDatePreset}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setMetricsError(d.error); return }; setMetrics(d.totals || null); setDaily(d.daily || []); setMetricsFromSnapshot(!!d.fromSnapshot); setSnapshotDate(d.snapshotDate ?? null) })
      .catch(e => setMetricsError(e.message))
      .finally(() => setLoadingMetrics(false))
  }, [selectedAccountId, dashDatePreset])

  // ── Load dashboard top ads (for Top5, Winners) ────────────────────────
  const loadDashTopAds = useCallback(() => {
    if (!selectedAccountId) return
    setLoadingDashTop(true)
    fetch(`/api/insights/top-creatives?adAccountId=${encodeURIComponent(selectedAccountId)}&datePreset=${dashDatePreset}&limit=20`)
      .then(r => r.json())
      .then(d => { setDashTopAds(d.ads || []) })
      .catch(() => {})
      .finally(() => setLoadingDashTop(false))
  }, [selectedAccountId, dashDatePreset])

  useEffect(() => { if (section === "top-creatives") loadTop() }, [section, loadTop])
  useEffect(() => {
    if (section === "dashboard") { loadMetrics(); loadDashTopAds() }
  }, [section, loadMetrics, loadDashTopAds])

  // ── Number filter helper ──────────────────────────────────────────────
  const applyNumberFilter = (adVal: number | undefined, filterVal: string): boolean => {
    const sep = filterVal.indexOf(":")
    if (sep < 0) return true
    const op = filterVal.slice(0, sep)
    const num = parseFloat(filterVal.slice(sep + 1))
    if (isNaN(num) || adVal === undefined) return true
    if (op === ">")  return adVal > num
    if (op === "<")  return adVal < num
    if (op === ">=") return adVal >= num
    if (op === "<=") return adVal <= num
    if (op === "=")  return Math.abs(adVal - num) < 0.001
    return true
  }

  // ── Computed: filtered + grouped + sorted ads ─────────────────────────
  const displayedAds = useMemo(() => {
    let list = [...topAds]

    for (const f of activeFilters) {
      const val = f.value.toLowerCase()
      // Dimension filters
      if      (f.field === "ad_name")       list = list.filter(a => a.adName.toLowerCase().includes(val))
      else if (f.field === "adset_name")    list = list.filter(a => (a.adsetName || "").toLowerCase().includes(val))
      else if (f.field === "campaign_name") list = list.filter(a => (a.campaignName || "").toLowerCase().includes(val))
      else if (f.field === "ad_type")       list = list.filter(a => f.value === "video" ? a.isVideo : !a.isVideo)
      // Numeric metric filters (data available in TopAd)
      else if (f.field === "spend")         list = list.filter(a => applyNumberFilter(a.spend, f.value))
      else if (f.field === "impressions")   list = list.filter(a => applyNumberFilter(a.impressions, f.value))
      else if (f.field === "link_clicks")   list = list.filter(a => applyNumberFilter(a.linkClicks, f.value))
      else if (f.field === "results")       list = list.filter(a => applyNumberFilter(a.results, f.value))
      else if (f.field === "cpr")           list = list.filter(a => applyNumberFilter(a.costPerResult, f.value))
      else if (f.field === "roas" || f.field === "purchase_roas" || f.field === "website_roas")
                                            list = list.filter(a => applyNumberFilter(a.roas, f.value))
      else if (f.field === "purchase_value") list = list.filter(a => applyNumberFilter(a.purchaseValue, f.value))
      else if (f.field === "ctr_all")       list = list.filter(a => applyNumberFilter(a.ctr, f.value))
      // Other numeric filters: pass-through until API returns those fields
    }

    if (groupBy === "unique") {
      const seen = new Set<string>()
      list = list.filter(a => { if (seen.has(a.adName)) return false; seen.add(a.adName); return true })
    } else if (groupBy === "campaign") {
      const seen = new Set<string>()
      list = list.filter(a => { const k = a.campaignName || ""; if (seen.has(k)) return false; seen.add(k); return true })
    }

    list.sort((a, b) => {
      let av = 0, bv = 0
      if      (sortField === "spend")       { av = a.spend;          bv = b.spend }
      else if (sortField === "results")     { av = a.results;        bv = b.results }
      else if (sortField === "cpr")         { av = a.costPerResult;  bv = b.costPerResult }
      else if (sortField === "impressions") { av = a.impressions;    bv = b.impressions }
      else if (sortField === "ctr")         { av = a.ctr;            bv = b.ctr }
      else if (sortField === "created") {
        av = a.createdTime ? new Date(a.createdTime).getTime() : 0
        bv = b.createdTime ? new Date(b.createdTime).getTime() : 0
      }
      return sortDir === "desc" ? bv - av : av - bv
    })

    return list.map((a, i) => ({ ...a, rank: i + 1 }))
  }, [topAds, activeFilters, groupBy, sortField, sortDir])

  // ── Derive unique values for dynamic filter fields ────────────────────
  const dynamicValues = useMemo(() => ({
    campaign_name: [...new Set(topAds.map(a => a.campaignName).filter(Boolean))] as string[],
    adset_name:    [...new Set(topAds.map(a => a.adsetName).filter(Boolean))]    as string[],
  }), [topAds])

  // ── Filter helpers ────────────────────────────────────────────────────
  const addFilter = () => {
    if (!pendingField || !pendingValue.trim()) return
    const fieldDef = FILTER_FIELDS.find(f => f.key === pendingField.key)
    let encodedValue = pendingValue
    let displayLabel = pendingValue
    if (fieldDef?.type === "number") {
      encodedValue = `${pendingOperator}:${pendingValue}`
      displayLabel = `${pendingOperator} ${pendingValue}`
    } else if (fieldDef?.type === "select") {
      displayLabel = (fieldDef as any).options?.find((o: any) => o.value === pendingValue)?.label || pendingValue
    }
    setActiveFilters(prev => [...prev, { id: Date.now().toString(), field: pendingField.key, value: encodedValue, label: `${pendingField.label} ${fieldDef?.type === "number" ? displayLabel : ": " + displayLabel}` }])
    setPendingField(null); setPendingValue(""); setFilterOpen(false); setFilterSearch(""); setValueSearch("")
  }

  const addFilterWithValue = (val: string) => {
    if (!pendingField) return
    setActiveFilters(prev => [...prev, { id: Date.now().toString(), field: pendingField.key, value: val, label: `${pendingField.label}: ${val}` }])
    setPendingField(null); setPendingValue(""); setFilterOpen(false); setFilterSearch(""); setValueSearch("")
  }

  const removeFilter   = (id: string) => setActiveFilters(prev => prev.filter(f => f.id !== id))
  const handleSortPill = (key: SortField) => {
    if (sortField === key) setSortDir(d => d === "desc" ? "asc" : "desc")
    else { setSortField(key); setSortDir("desc") }
  }
  const removeMetric = (key: SortField) => {
    setVisibleMetrics(prev => prev.filter(k => k !== key))
    if (sortField === key) setSortField("spend")
  }

  // ── Widget drag-and-drop ──────────────────────────────────────────────
  const handleDragStart = (id: string) => setDragging(id)
  const handleDragOver  = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOver(id) }
  const handleDrop      = (id: string) => {
    if (!dragging || dragging === id) { setDragging(null); setDragOver(null); return }
    const from = widgets.findIndex(w => w.id === dragging)
    const to   = widgets.findIndex(w => w.id === id)
    const next = [...widgets]; const [item] = next.splice(from, 1); next.splice(to, 0, item)
    setWidgets(next); setDragging(null); setDragOver(null)
  }
  const removeWidget = (id: string) => setWidgets(prev => prev.filter(w => w.id !== id))
  const addWidget    = (type: WidgetType) => {
    setWidgets(prev => [...prev, { id: `w-${Date.now()}`, type }])
    setAddWidgetOpen(false)
  }

  const currentDateLabel  = DATE_PRESETS.find(p => p.value === datePreset)?.label || datePreset
  const dashDateLabel     = DATE_PRESETS.find(p => p.value === dashDatePreset)?.label || dashDatePreset
  const currentGroupLabel = GROUP_BY_OPTIONS.find(g => g.key === groupBy)?.label || "Unique Ad"
  const sparkline = (key: keyof DailyMetric) => daily.map(d => d[key] as number)
  const filteredFields = FILTER_FIELDS.filter(f => f.label.toLowerCase().includes(filterSearch.toLowerCase()))

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Inner Left Sidebar ──────────────────────────────────────── */}
      <aside className="w-52 border-r flex flex-col shrink-0 overflow-y-auto bg-sidebar">
        <div className="p-3 space-y-0.5">

          {/* Top Creatives */}
          <button onClick={() => setSection("top-creatives")}
            className={cn("flex items-center gap-2.5 w-full px-2.5 py-2 text-sm rounded-md transition-colors",
              section === "top-creatives" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}>
            <IconTrophy className="size-4 shrink-0" />
            <span className="flex-1 text-left">Top Creatives</span>
          </button>

          {/* Custom Dashboard */}
          <button onClick={() => setSection("dashboard")}
            className={cn("flex items-center gap-2.5 w-full px-2.5 py-2 text-sm rounded-md transition-colors",
              section === "dashboard" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}>
            <IconLayoutDashboard className="size-4 shrink-0" />
            <span className="flex-1 text-left">Custom Dashboard</span>
          </button>

          {/* Statistics */}
          <div>
            <button onClick={() => setSection("statistics")}
              className={cn("flex items-center gap-2.5 w-full px-2.5 py-2 text-sm rounded-md transition-colors",
                section === "statistics" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}>
              <IconChartBar className="size-4 shrink-0" />
              <span className="flex-1 text-left">Statistics</span>
              <IconChevronDown className={cn("size-3.5 transition-transform", section === "statistics" && "rotate-180")} />
            </button>
            {section === "statistics" && (
              <div className="ml-3 mt-0.5 mb-1 space-y-0.5">
                {([
                  { id: "all-accounts"   as StatTab, label: "All Accounts" },
                  { id: "spend"          as StatTab, label: "Spend" },
                  { id: "demographic"    as StatTab, label: "Demographic" },
                  { id: "country"        as StatTab, label: "Country" },
                  { id: "ad-history"     as StatTab, label: "Ad History" },
                  { id: "placements"     as StatTab, label: "Placements" },
                  { id: "upload-stats"   as StatTab, label: "Upload Stats" },
                  { id: "creative-audit" as StatTab, label: "Creative Audit" },
                  { id: "reach"          as StatTab, label: "Reach" },
                  { id: "device"         as StatTab, label: "Device" },
                  { id: "page-insights"  as StatTab, label: "Page Insights" },
                ]).map(sub => (
                  <button key={sub.id} onClick={() => { setStatTab(sub.id); setVisitedStatTabs(prev => new Set([...prev, sub.id])) }}
                    className={cn("flex items-center h-7 px-2.5 rounded-md text-xs w-full transition-colors",
                      statTab === sub.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}>
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Comments */}
          <div>
            <button onClick={() => setSection("comments")}
              className={cn("flex items-center gap-2.5 w-full px-2.5 py-2 text-sm rounded-md transition-colors",
                section === "comments" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}>
              <IconMessageCircle className="size-4 shrink-0" />
              <span className="flex-1 text-left">Comments</span>
              <IconChevronDown className={cn("size-3.5 transition-transform", section === "comments" && "rotate-180")} />
            </button>
            {section === "comments" && (
              <div className="ml-3 mt-0.5 mb-1 space-y-0.5">
                {([
                  { label: "All",        dot: "#94a3b8" },
                  { label: "Unreplied",  dot: "#3b82f6" },
                  { label: "Positive",   dot: "#22c55e" },
                  { label: "Neutral",    dot: "#94a3b8" },
                  { label: "Negative",   dot: "#ef4444" },
                  { label: "Analytics",  dot: null },
                  { label: "Automation", dot: null },
                  { label: "History",    dot: null },
                ]).map(sub => (
                  <div key={sub.label}
                    className="flex items-center h-7 px-2.5 rounded-md text-xs w-full text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-default">
                    {sub.dot
                      ? <span className="size-2 rounded-full mr-2 shrink-0" style={{ backgroundColor: sub.dot }} />
                      : <span className="size-2 mr-2 shrink-0" />}
                    {sub.label}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* FOLDERS section */}
        <div className="px-3 mt-3">
          <p className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider px-2 mb-1.5">Folders</p>

          {/* REPORTS sub-folder */}
          <div className="mb-2">
            <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider px-2.5 py-1">Reports</p>
            <div className="space-y-0.5">
              {([
                { id: "top-creatives" as ReportSection, label: "Top Creatives",  dot: "🏆" },
                { id: "admanage-ads"  as ReportSection, label: "AdManage Ads",   dot: "📊" },
                { id: "all-active-ads"as ReportSection, label: "All Active Ads", dot: "🟢" },
                { id: "vs-mode"       as ReportSection, label: "VS Mode",        dot: "✕" },
                { id: "fatigued-ads"  as ReportSection, label: "Fatigued Ads",   dot: "😤" },
                { id: "landing-pages" as ReportSection, label: "Landing Pages",  dot: "🏞" },
                { id: "ads-l90d"      as ReportSection, label: "Ads L90D",       dot: "📅" },
              ]).map(item => (
                <button key={item.id} onClick={() => setSection(item.id)}
                  className={cn("flex items-center gap-2 w-full px-2.5 py-1.5 text-xs rounded-md transition-colors",
                    section === item.id ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}>
                  <span className="text-xs shrink-0 w-4 text-center">{item.dot}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* SAVED REPORTS */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider px-2.5 py-1">Saved Reports</p>
            <p className="text-xs text-muted-foreground/40 px-2.5 py-1 italic">No saved reports yet.</p>
          </div>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ════════════════ REPORT SECTIONS ═══════════════════════════ */}

        {(section === "top-creatives" || section === "admanage-ads" || section === "all-active-ads" ||
          section === "vs-mode" || section === "fatigued-ads" || section === "landing-pages" || section === "ads-l90d") && (
          <ReportsView type={section as ReportSection} />
        )}

        {/* ════════════════ TOP CREATIVES (removed, handled by ReportsView) */}
        {false && false && (
          <>
            <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center shrink-0">
                  <IconChartBar className="size-4 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-base leading-tight">Top Ads</h1>
                  <p className="text-xs text-muted-foreground line-clamp-1 max-w-sm">
                    Highest-spending ads ranked by spend with key performance metrics.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative" ref={accountPickerRef}>
                  <button onClick={() => setAccountPickerOpen(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium hover:bg-muted/50 transition-colors">
                    <span className="size-2 rounded-full bg-blue-500 shrink-0" />
                    <span className="max-w-[160px] truncate">{accountName}</span>
                    <IconChevronDown className="size-3.5 text-muted-foreground" />
                  </button>
                  {accountPickerOpen && adAccounts.length > 0 && (
                    <div className="absolute top-full right-0 mt-1 z-50 bg-popover border rounded-xl shadow-xl py-1 min-w-[220px] max-h-72 overflow-y-auto">
                      <p className="px-3 pt-1.5 pb-1 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Ad Accounts</p>
                      {adAccounts.map((acc: any) => (
                        <button key={acc.id} onClick={() => { setSelectedAccountId(acc.id); setAccountPickerOpen(false) }}
                          className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between gap-2 transition-colors",
                            acc.id === selectedAccountId && "text-primary font-medium"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={cn("size-2 rounded-full shrink-0", acc.id === selectedAccountId ? "bg-primary" : "bg-muted-foreground/30")} />
                            <span className="truncate">{acc.name}</span>
                          </div>
                          {acc.id === selectedAccountId && <IconCheck className="size-3.5 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => loadTop()} disabled={loadingTop}>
                  <IconRefresh className={cn("size-3.5", loadingTop && "animate-spin")} />
                </Button>
              </div>
            </div>

            {/* Row 1: Date | Group by | Add filter | Active filters */}
            <div className="flex items-center gap-2 px-6 py-2.5 border-b shrink-0 flex-wrap">
              {/* Date preset */}
              <div className="relative" ref={dateRef}>
                <button onClick={() => setDateOpen(v => !v)}
                  className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                >
                  <IconFilter className="size-3.5 text-muted-foreground" />
                  {currentDateLabel}
                  <IconChevronDown className="size-3.5 text-muted-foreground" />
                </button>
                {dateOpen && (
                  <div className="absolute top-full left-0 mt-1 z-40 bg-popover border rounded-lg shadow-lg py-1 min-w-[160px]">
                    {DATE_PRESETS.map(p => (
                      <button key={p.value} onClick={() => { setDatePreset(p.value); setDateOpen(false) }}
                        className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between",
                          datePreset === p.value && "text-primary font-medium")}
                      >
                        {p.label}
                        {datePreset === p.value && <span className="size-1.5 rounded-full bg-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Group by */}
              <div className="relative" ref={groupRef}>
                <button onClick={() => setGroupOpen(v => !v)}
                  className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                >
                  Group by <span className="font-semibold">{currentGroupLabel}</span>
                  <IconChevronDown className="size-3.5 text-muted-foreground" />
                </button>
                {groupOpen && (
                  <div className="absolute top-full left-0 mt-1 z-40 bg-popover border rounded-lg shadow-lg py-1 min-w-[160px]">
                    {GROUP_BY_OPTIONS.map(g => (
                      <button key={g.key} onClick={() => { setGroupBy(g.key); setGroupOpen(false) }}
                        className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between",
                          groupBy === g.key && "text-primary font-medium")}
                      >
                        {g.label}
                        {groupBy === g.key && <span className="size-1.5 rounded-full bg-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Add filter */}
              <div className="relative" ref={filterRef}>
                <button onClick={() => { setFilterOpen(v => !v); setPendingField(null); setPendingValue("") }}
                  className={cn("flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border transition-colors",
                    filterOpen ? "border-primary bg-primary/5 text-primary" : "bg-background hover:bg-muted/50"
                  )}
                >
                  <IconPlus className="size-3.5" /> Add filter
                </button>

                {filterOpen && (
                  <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-xl shadow-xl w-64">
                    {!pendingField ? (
                      <>
                        <div className="p-2 border-b">
                          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/40">
                            <IconSearch className="size-3.5 text-muted-foreground/50 shrink-0" />
                            <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
                              placeholder="Search fields..." autoFocus
                              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40"
                            />
                          </div>
                        </div>
                        <div className="py-1 max-h-[300px] overflow-y-auto">
                          {filteredFields.length === 0 && (
                            <p className="px-3 py-4 text-sm text-muted-foreground/50 text-center">No fields found</p>
                          )}
                          {(() => {
                            let lastCat = ""
                            return filteredFields.map(f => {
                              const cat = (f as any).category || ""
                              const showHeader = cat && cat !== lastCat && !filterSearch.trim()
                              lastCat = cat
                              return (
                                <div key={f.key}>
                                  {showHeader && (
                                    <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider">
                                      {cat}
                                    </p>
                                  )}
                                  <button onClick={() => { setPendingField(f); setPendingValue(""); setPendingOperator(">=") }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors">
                                    {f.label}
                                  </button>
                                </div>
                              )
                            })
                          })()}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 p-3 border-b">
                          <button onClick={() => { setPendingField(null); setPendingValue(""); setValueSearch("") }}
                            className="text-muted-foreground hover:text-foreground">
                            <IconArrowsUpDown className="size-3.5 rotate-90" />
                          </button>
                          <span className="text-sm font-medium">{pendingField!.label}</span>
                        </div>

                        {pendingField!.type === "dynamic" ? (
                          <>
                            <div className="p-2 border-b">
                              <p className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider mb-1.5 px-1">Values</p>
                              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/40">
                                <IconSearch className="size-3.5 text-muted-foreground/50 shrink-0" />
                                <input value={valueSearch} onChange={e => setValueSearch(e.target.value)}
                                  placeholder={`Select ${pendingField!.label.toLowerCase()}...`} autoFocus
                                  className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40"
                                />
                              </div>
                            </div>
                            <div className="py-1 max-h-56 overflow-y-auto">
                              {(dynamicValues[pendingField!.key as keyof typeof dynamicValues] || [])
                                .filter(v => v.toLowerCase().includes(valueSearch.toLowerCase()))
                                .map(v => (
                                  <button key={v}
                                    onClick={() => { setPendingValue(v); setValueSearch(""); addFilterWithValue(v) }}
                                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors truncate"
                                    title={v}>{v}
                                  </button>
                                ))
                              }
                              {(dynamicValues[pendingField!.key as keyof typeof dynamicValues] || []).filter(v => v.toLowerCase().includes(valueSearch.toLowerCase())).length === 0 && (
                                <p className="px-3 py-4 text-sm text-muted-foreground/50 text-center">No values found</p>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="p-3 space-y-3">
                            {pendingField!.type === "text" && (
                              <input value={pendingValue} onChange={e => setPendingValue(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && addFilter()}
                                placeholder={`Filter by ${pendingField!.label.toLowerCase()}...`} autoFocus
                                className="w-full px-3 py-2 text-sm border rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40"
                              />
                            )}
                            {pendingField!.type === "number" && (
                              <div className="space-y-2">
                                <div className="grid grid-cols-5 gap-1">
                                  {([">=" , "<=", ">", "<", "="] as const).map(op => (
                                    <button key={op} onClick={() => setPendingOperator(op)}
                                      className={cn("py-1.5 text-sm rounded-lg border font-mono transition-colors",
                                        pendingOperator === op ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:bg-muted/50"
                                      )}>{op}
                                    </button>
                                  ))}
                                </div>
                                <input type="number" value={pendingValue} onChange={e => setPendingValue(e.target.value)}
                                  onKeyDown={e => e.key === "Enter" && addFilter()}
                                  placeholder="Enter value..." autoFocus
                                  className="w-full px-3 py-2 text-sm border rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40"
                                />
                              </div>
                            )}
                            {pendingField!.type === "select" && (
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {(pendingField as any).options?.map((opt: any) => (
                                  <button key={opt.value} onClick={() => setPendingValue(opt.value)}
                                    className={cn("w-full text-left px-3 py-2 text-sm rounded-lg border transition-colors",
                                      pendingValue === opt.value ? "border-primary bg-primary/5 text-primary font-medium" : "border-transparent hover:bg-muted/50"
                                    )}>{opt.label}
                                  </button>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Button size="sm" className="flex-1 h-8" onClick={addFilter} disabled={!pendingValue.trim()}>Apply</Button>
                              <Button size="sm" variant="outline" className="h-8" onClick={() => { setPendingField(null); setPendingValue(""); setValueSearch("") }}>Back</Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Active filter pills */}
              {activeFilters.map(f => (
                <div key={f.id}
                  className="flex items-center gap-1 h-8 px-3 rounded-lg border border-primary/30 bg-primary/5 text-xs font-medium text-primary">
                  {f.label}
                  <button onClick={() => removeFilter(f.id)} className="ml-0.5 hover:text-destructive">
                    <IconX className="size-3" />
                  </button>
                </div>
              ))}
              {activeFilters.length > 0 && (
                <button onClick={() => setActiveFilters([])}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 border rounded-lg hover:border-destructive/30 transition-colors">
                  <IconX className="size-3" /> Clear all
                </button>
              )}
            </div>

            {/* Row 2: Sortable metric pills */}
            <div className="flex items-center gap-2 px-6 py-2 border-b shrink-0 flex-wrap bg-muted/10">
              {visibleMetrics.map((key, idx) => {
                const def = METRIC_DEFS.find(m => m.key === key)!
                const isActive = sortField === key
                const SortIcon = isActive ? (sortDir === "desc" ? IconArrowDown : IconArrowUp) : IconArrowsUpDown
                return (
                  <div key={key}
                    className={cn("flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-medium cursor-pointer select-none transition-colors",
                      isActive ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted/50"
                    )}
                  >
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: def.color }}>{idx + 1}</span>
                    <button onClick={() => handleSortPill(key)} className="flex items-center gap-1">
                      {def.label}
                      <SortIcon className={cn("size-3", isActive ? "text-primary" : "text-muted-foreground/50")} />
                    </button>
                    <button onClick={() => removeMetric(key)} className="ml-0.5 text-muted-foreground hover:text-foreground">
                      <IconX className="size-3" />
                    </button>
                  </div>
                )
              })}
              {visibleMetrics.length < METRIC_DEFS.length && (
                <div className="relative group">
                  <button className="flex items-center gap-1 h-7 px-2.5 rounded-full border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors bg-background">
                    <IconPlus className="size-3" /> Add metric
                  </button>
                  <div className="absolute top-full left-0 mt-1 z-30 bg-popover border rounded-lg shadow-md py-1 min-w-[160px] hidden group-hover:block">
                    {METRIC_DEFS.filter(m => !visibleMetrics.includes(m.key)).map(m => (
                      <button key={m.key} onClick={() => setVisibleMetrics(prev => [...prev, m.key])}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ backgroundColor: m.color }} />
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-auto px-6 py-4">
              {!selectedAccountId ? (
                <EmptyState icon={IconAlertCircle} title="No ad account selected" desc="Select an ad account from the sidebar." />
              ) : loadingTop ? (
                <LoadingGrid />
              ) : topError ? (
                <ErrorState message={topError} onRetry={loadTop} />
              ) : topAds.length === 0 ? (
                <EmptyState icon={IconMoodEmpty} title="No ad data yet" desc={`No ads found (${currentDateLabel}).`} />
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-4 font-medium">
                    {displayedAds.length}/{topAds.length} ads
                    {activeFilters.length > 0 && <span className="ml-1 text-primary">({activeFilters.length} filter{activeFilters.length > 1 ? "s" : ""} active)</span>}
                  </p>
                  {displayedAds.length === 0 ? (
                    <EmptyState icon={IconMoodEmpty} title="No ads match current filters" desc="Try removing some filters." />
                  ) : (
                    <>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {displayedAds.map(ad => (
                          <TopAdCard key={ad.adId} ad={ad} visibleMetrics={visibleMetrics} />
                        ))}
                      </div>
                      {topHasMore && (
                        <div className="flex justify-center mt-6">
                          <Button variant="outline" size="sm" onClick={() => loadTop(topCursor ?? undefined)} disabled={loadingMoreTop} className="gap-2 min-w-[160px]">
                            {loadingMoreTop ? <><IconLoader2 className="size-3.5 animate-spin" />Loading…</> : `Load More (${topAds.length} loaded)`}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}
        {/* ─────────────────────────────────────────────────────────── */}

        {/* ════════════════ CUSTOM DASHBOARD ══════════════════════════ */}
        {section === "dashboard" && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
              <div>
                <h1 className="font-bold text-base">Custom Dashboard</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Drag widgets to reorder · click × to remove</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative" ref={accountPickerRef}>
                  <button onClick={() => setAccountPickerOpen(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium hover:bg-muted/50 transition-colors">
                    <span className="size-2 rounded-full bg-blue-500 shrink-0" />
                    <span className="max-w-[160px] truncate">{accountName}</span>
                    <IconChevronDown className="size-3.5 text-muted-foreground" />
                  </button>
                  {accountPickerOpen && adAccounts.length > 0 && (
                    <div className="absolute top-full right-0 mt-1 z-50 bg-popover border rounded-xl shadow-xl py-1 min-w-[220px] max-h-72 overflow-y-auto">
                      <p className="px-3 pt-1.5 pb-1 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Ad Accounts</p>
                      {adAccounts.map((acc: any) => (
                        <button key={acc.id} onClick={() => { setSelectedAccountId(acc.id); setAccountPickerOpen(false) }}
                          className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between gap-2 transition-colors",
                            acc.id === selectedAccountId && "text-primary font-medium"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={cn("size-2 rounded-full shrink-0", acc.id === selectedAccountId ? "bg-primary" : "bg-muted-foreground/30")} />
                            <span className="truncate">{acc.name}</span>
                          </div>
                          {acc.id === selectedAccountId && <IconCheck className="size-3.5 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Date preset */}
                <div className="relative" ref={dashDateRef}>
                  <button onClick={() => setDashDateOpen(v => !v)}
                    className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                  >
                    <IconFilter className="size-3.5 text-muted-foreground" />
                    {dashDateLabel}
                    <IconChevronDown className="size-3.5 text-muted-foreground" />
                  </button>
                  {dashDateOpen && (
                    <div className="absolute top-full right-0 mt-1 z-30 bg-popover border rounded-lg shadow-lg py-1 min-w-[160px]">
                      {DATE_PRESETS.map(p => (
                        <button key={p.value} onClick={() => { setDashDatePreset(p.value); setDashDateOpen(false) }}
                          className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between",
                            dashDatePreset === p.value && "text-primary font-medium")}>
                          {p.label}
                          {dashDatePreset === p.value && <span className="size-1.5 rounded-full bg-primary" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => { loadMetrics(); loadDashTopAds() }} disabled={loadingMetrics}>
                  <IconRefresh className={cn("size-3.5", loadingMetrics && "animate-spin")} />
                </Button>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 px-6 py-2 border-b shrink-0 bg-muted/5">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                onClick={() => setAddWidgetOpen(true)}>
                <IconLayoutGridAdd className="size-3.5" /> Add widget
              </Button>
            </div>

            {/* Widget canvas */}
            {!selectedAccountId ? (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState icon={IconAlertCircle} title="No ad account selected" desc="Select an ad account from the sidebar to view your dashboard." />
              </div>
            ) : (
              <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
                {loadingMetrics && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                    <IconLoader2 className="size-4 animate-spin" /> Loading dashboard data…
                  </div>
                )}
                {metricsFromSnapshot && !loadingMetrics && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                    <IconAlertCircle className="size-4 shrink-0" />
                    <span>
                      Đang hiển thị dữ liệu đã lưu — tài khoản Meta không khả dụng.
                      {snapshotDate && <span className="ml-1 opacity-70">Dữ liệu đến ngày {snapshotDate}.</span>}
                    </span>
                  </div>
                )}
                {metricsError && <ErrorState message={metricsError} onRetry={loadMetrics} />}

                {!loadingMetrics && !metricsError && widgets.map(w => (
                  <div key={w.id}
                    draggable
                    onDragStart={() => handleDragStart(w.id)}
                    onDragOver={e => handleDragOver(e, w.id)}
                    onDrop={() => handleDrop(w.id)}
                    onDragEnd={() => { setDragging(null); setDragOver(null) }}
                    className={cn(
                      "rounded-xl border bg-card transition-all",
                      dragging === w.id && "opacity-40",
                      dragOver === w.id && dragging !== w.id && "ring-2 ring-primary/40",
                    )}
                  >
                    {/* Widget title bar */}
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b">
                      <IconGripVertical className="size-4 text-muted-foreground/40 cursor-grab shrink-0" />
                      <span className="flex-1 text-sm font-medium">{WIDGET_DEFS.find(d => d.type === w.type)?.label || w.type}</span>
                      <button className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                        <IconPencil className="size-3.5" />
                      </button>
                      <button onClick={() => removeWidget(w.id)} className="text-muted-foreground/40 hover:text-destructive transition-colors">
                        <IconX className="size-3.5" />
                      </button>
                    </div>

                    {/* Widget content */}
                    <div className="p-4">
                      {w.type === "spend-revenue-roas" && (
                        <SpendRevenueRoasWidget metrics={metrics} />
                      )}
                      {w.type === "mtd-chart" && (
                        <MTDChartWidget daily={daily} />
                      )}
                      {w.type === "metric-cards" && (
                        <MetricCardsWidget metrics={metrics} daily={daily} sparkline={sparkline} />
                      )}
                      {w.type === "observations" && (
                        <ObservationsWidget metrics={metrics} daily={daily} topAds={dashTopAds} />
                      )}
                      {w.type === "top5-revenue" && (
                        <Top5RevenueWidget topAds={dashTopAds} loading={loadingDashTop} />
                      )}
                      {w.type === "winners" && (
                        <WinnersWidget topAds={dashTopAds} loading={loadingDashTop} />
                      )}
                      {w.type === "breakdown" && (
                        <BreakdownWidget accountId={selectedAccountId} datePreset={dashDatePreset} />
                      )}
                      {w.type === "pacing" && (
                        <PacingWidget accountId={selectedAccountId} />
                      )}
                    </div>
                  </div>
                ))}

                {!loadingMetrics && widgets.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="size-16 rounded-2xl bg-muted/40 flex items-center justify-center">
                      <IconLayoutGridAdd className="size-8 text-muted-foreground/30" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-sm">No widgets yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Click "Add widget" to build your dashboard.</p>
                    </div>
                    <Button size="sm" onClick={() => setAddWidgetOpen(true)}>
                      <IconPlus className="size-3.5" /> Add widget
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {section === "statistics" && (
          <div className="flex-1 overflow-auto px-6 py-4">
            {/* Tabs that don't need an account — always keep mounted */}
            <div className={statTab !== "all-accounts" ? "hidden" : ""}>
              <AllAccountsView adAccounts={adAccounts || []} />
            </div>
            <div className={statTab !== "upload-stats" ? "hidden" : ""}>
              <UploadStatsView />
            </div>

            {/* No account guard for account-dependent tabs */}
            {!selectedAccountId && statTab !== "all-accounts" && statTab !== "upload-stats" && (
              <EmptyState icon={IconAlertCircle} title="No ad account selected" desc="Select an ad account from the sidebar." />
            )}

            {/* Account-required tabs: mount once on first visit, stay alive via CSS */}
            {visitedStatTabs.has("spend") && selectedAccountId && (
              <div className={statTab !== "spend" ? "hidden" : ""}><SpendView /></div>
            )}
            {visitedStatTabs.has("demographic") && selectedAccountId && (
              <div className={statTab !== "demographic" ? "hidden" : ""}><DemographicView /></div>
            )}
            {visitedStatTabs.has("country") && selectedAccountId && (
              <div className={statTab !== "country" ? "hidden" : ""}><CountryView /></div>
            )}
            {visitedStatTabs.has("ad-history") && selectedAccountId && (
              <div className={statTab !== "ad-history" ? "hidden" : ""}><AdHistoryView /></div>
            )}
            {visitedStatTabs.has("placements") && selectedAccountId && (
              <div className={statTab !== "placements" ? "hidden" : ""}><PlacementsView /></div>
            )}
            {visitedStatTabs.has("device") && selectedAccountId && (
              <div className={statTab !== "device" ? "hidden" : ""}><DeviceView /></div>
            )}
            {visitedStatTabs.has("reach") && selectedAccountId && (
              <div className={statTab !== "reach" ? "hidden" : ""}><ReachView /></div>
            )}
            {visitedStatTabs.has("creative-audit") && selectedAccountId && (
              <div className={statTab !== "creative-audit" ? "hidden" : ""}><CreativeAuditView /></div>
            )}
            {/* Page Insights — no account required */}
            <div className={statTab !== "page-insights" ? "hidden" : ""}>
              <PageInsightsView />
            </div>
          </div>
        )}

        {section === "comments" && (
          <CommentsView />
        )}
      </div>

      {/* ── Add Widget Modal ──────────────────────────────────────────── */}
      {addWidgetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAddWidgetOpen(false)}>
          <div className="bg-background rounded-2xl shadow-2xl w-[640px] max-h-[80vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="font-bold text-lg">Add widget</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Choose a widget to add to your dashboard. You can resize and rearrange it after adding.</p>
              </div>
              <button onClick={() => setAddWidgetOpen(false)} className="text-muted-foreground hover:text-foreground">
                <IconX className="size-5" />
              </button>
            </div>
            <div className="overflow-auto p-6">
              <div className="grid grid-cols-2 gap-3">
                {WIDGET_DEFS.map(def => {
                  const Icon = def.icon
                  const alreadyAdded = widgets.some(w => w.type === def.type)
                  return (
                    <button key={def.type}
                      onClick={() => !alreadyAdded && addWidget(def.type)}
                      className={cn(
                        "text-left p-4 rounded-xl border transition-all",
                        alreadyAdded
                          ? "opacity-50 cursor-not-allowed bg-muted/20"
                          : "hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm cursor-pointer"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Widget preview thumbnail */}
                        <div className="w-16 h-12 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 border">
                          <Icon className="size-6 text-muted-foreground/40" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold">{def.label}</p>
                            {alreadyAdded && <IconCheck className="size-3.5 text-primary shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{def.desc}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Widget Components ────────────────────────────────────────────────────────

function SpendRevenueRoasWidget({ metrics }: { metrics: MetricTotals | null }) {
  if (!metrics) return <WidgetEmpty />
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-xl p-5 bg-zinc-900 text-white">
        <p className="text-sm font-medium opacity-70">Spend</p>
        <p className="text-2xl font-bold mt-1">{fmt$(metrics.spend, 0)}</p>
      </div>
      <div className="rounded-xl p-5 bg-blue-600 text-white">
        <p className="text-sm font-medium opacity-80">Revenue</p>
        <p className="text-2xl font-bold mt-1">{metrics.purchaseValue > 0 ? fmt$(metrics.purchaseValue, 0) : "—"}</p>
      </div>
      <div className="rounded-xl p-5 bg-emerald-600 text-white">
        <p className="text-sm font-medium opacity-80">ROAS</p>
        <p className="text-2xl font-bold mt-1">{metrics.roas > 0 ? metrics.roas.toFixed(2) : "—"}</p>
      </div>
    </div>
  )
}

function MTDChartWidget({ daily }: { daily: DailyMetric[] }) {
  if (!daily.length) return <WidgetEmpty />
  const data = daily.map(d => ({
    date: d.date,
    spend: d.spend,
    revenue: d.purchaseVal,
    roas: d.spend > 0 ? d.purchaseVal / d.spend : 0,
  }))
  return (
    <div>
      <p className="text-sm font-semibold mb-0.5">MTD performance</p>
      <p className="text-xs text-muted-foreground mb-4">Daily spend (bars), ROAS and revenue (lines)</p>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={fmtDay} />
          <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => v.toFixed(1)} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(value: any, name: any) =>
              name === "ROAS" ? [Number(value).toFixed(2)+"x", name] : [fmt$(Number(value)), name]}
            labelFormatter={l => fmtDay(l)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar  yAxisId="left"  dataKey="spend"   name="Spend"   fill="#3b82f6" opacity={0.85} radius={[2,2,0,0]} />
          <Line yAxisId="right" type="monotone" dataKey="roas"    name="ROAS"    stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
          <Line yAxisId="left"  type="monotone" dataKey="revenue" name="Revenue" stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function MetricCardsWidget({ metrics, daily, sparkline }: {
  metrics: MetricTotals | null
  daily: DailyMetric[]
  sparkline: (key: keyof DailyMetric) => number[]
}) {
  if (!metrics) return <WidgetEmpty />
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard label="Impressions"         value={fmtK(metrics.impressions)} sparkData={sparkline("impressions")} />
      <MetricCard label="CPM"                 value={fmt$(metrics.cpm)} sparkData={sparkline("cpm")} />
      <MetricCard label="CPC (Link Click)"    value={metrics.cpc > 0 ? fmt$(metrics.cpc) : "—"} sparkData={daily.map(d => d.linkClicks > 0 ? d.spend / d.linkClicks : 0)} />
      <MetricCard label="CTR (Link)"          value={metrics.ctr.toFixed(2) + "%"} sparkData={sparkline("ctr")} />
      <MetricCard label="Purchases"           value={String(Math.round(metrics.purchases))} sparkData={sparkline("purchases")} />
      <MetricCard label="Cost Per Purchase"   value={metrics.costPerPurchase > 0 ? fmt$(metrics.costPerPurchase) : "—"} sparkData={daily.map(d => d.purchases > 0 ? d.spend / d.purchases : 0)} />
      <MetricCard label="Avg Purchase Value"  value={metrics.avgPurchaseValue > 0 ? fmt$(metrics.avgPurchaseValue) : "—"} sparkData={daily.map(d => d.purchaseVal)} />
      <MetricCard label="ROAS"                value={metrics.roas > 0 ? metrics.roas.toFixed(2) + "x" : "—"} sparkData={daily.map(d => d.spend > 0 ? d.purchaseVal / d.spend : 0)} />
    </div>
  )
}

function ObservationsWidget({ metrics, daily, topAds }: {
  metrics: MetricTotals | null; daily: DailyMetric[]; topAds: TopAd[]
}) {
  if (!metrics) return <WidgetEmpty />

  const observations: string[] = []
  const actions: string[]      = []
  const nextSteps: string[]    = []

  if (metrics.roas > 0 && metrics.roas < 1) {
    observations.push(`ROAS is ${metrics.roas.toFixed(2)}x — spend exceeds recovered revenue. Review your top spenders.`)
  } else if (metrics.roas >= 1 && metrics.roas < 2) {
    observations.push(`ROAS at ${metrics.roas.toFixed(2)}x — above break-even, room to improve. Test new creatives.`)
  } else if (metrics.roas >= 2) {
    observations.push(`Strong ROAS of ${metrics.roas.toFixed(2)}x — consider scaling best-performing ads.`)
  }
  if (metrics.ctr < 1 && metrics.impressions > 0) {
    observations.push(`Link CTR of ${metrics.ctr.toFixed(2)}% is below the 1% benchmark — creative refresh may help.`)
  } else if (metrics.ctr >= 2) {
    observations.push(`Excellent CTR of ${metrics.ctr.toFixed(2)}% — creatives are resonating with the audience.`)
  }
  if (daily.length >= 6) {
    const recentAvg  = daily.slice(-3).reduce((s, d) => s + d.spend, 0) / 3
    const earlierAvg = daily.slice(0, 3).reduce((s, d) => s + d.spend, 0) / 3
    if (recentAvg > earlierAvg * 1.2) {
      observations.push(`Daily spend trending up (+${(((recentAvg - earlierAvg) / earlierAvg) * 100).toFixed(0)}%) over the period.`)
    } else if (recentAvg < earlierAvg * 0.8) {
      observations.push(`Daily spend declining (−${(((earlierAvg - recentAvg) / earlierAvg) * 100).toFixed(0)}%) — check for budget or delivery issues.`)
    }
  }
  if (topAds.length > 0 && metrics.spend > 0) {
    const top1Pct = (topAds[0].spend / metrics.spend) * 100
    if (top1Pct > 40) {
      observations.push(`Top ad accounts for ${top1Pct.toFixed(0)}% of spend — high concentration. Diversify creative testing.`)
    }
  }
  if (observations.length === 0) observations.push("Compare the MTD chart to spot day-level spend and efficiency swings.")
  observations.push("Use the Top Ads table to double-check which creatives are driving revenue.")

  actions.push("Document launches and major edits from this period for the weekly recap.")
  actions.push("Align creative tests with the best-performing hooks in Top Ads.")

  if (metrics.roas < 1.5) nextSteps.push("Revisit targeting and creative strategy for underperforming campaigns.")
  nextSteps.push("Schedule a creative refresh for any ad past 14 days of consistent spend.")
  nextSteps.push(metrics.purchaseValue === 0
    ? "Verify purchase event tracking is firing correctly in Events Manager."
    : "Revisit attribution settings if purchase counts look misaligned.")

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-3">
        <p className="font-semibold text-sm">Last period observations</p>
        <ul className="space-y-2">
          {observations.map((o, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="size-1.5 rounded-full bg-muted-foreground/40 mt-2 shrink-0" />
              {o}
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border p-4 space-y-2">
          <p className="font-semibold text-sm">Actions taken</p>
          <ul className="space-y-1.5">
            {actions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="size-1.5 rounded-full bg-muted-foreground/40 mt-2 shrink-0" />{a}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border p-4 space-y-2">
          <p className="font-semibold text-sm">Next steps</p>
          <ul className="space-y-1.5">
            {nextSteps.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="size-1.5 rounded-full bg-muted-foreground/40 mt-2 shrink-0" />{s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function Top5RevenueWidget({ topAds, loading }: { topAds: TopAd[]; loading: boolean }) {
  if (loading) return <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><IconLoader2 className="size-4 animate-spin" />Loading…</div>

  // Sort by purchaseValue (revenue), fall back to results if no pixel tracking
  const sorted = [...topAds]
    .sort((a, b) => (b.purchaseValue || 0) - (a.purchaseValue || 0))
    .slice(0, 5)

  if (sorted.length === 0) return <WidgetEmpty />

  return (
    <div className="divide-y">
      {sorted.map((ad, i) => (
        <div key={ad.adId} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          {/* Thumbnail */}
          <div className="size-10 rounded-lg bg-muted overflow-hidden shrink-0">
            {ad.thumbnail
              ? <img src={ad.thumbnail} alt={ad.adName} className="w-full h-full object-cover" loading="lazy" />
              : <div className="w-full h-full flex items-center justify-center">
                  {ad.isVideo ? <IconPlayerPlay className="size-4 text-muted-foreground/30" /> : <IconPhoto className="size-4 text-muted-foreground/30" />}
                </div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{ad.adName}</p>
            <p className="text-xs text-muted-foreground truncate">{ad.campaignName || "—"}</p>
          </div>
          <div className="text-right shrink-0 space-y-0.5">
            <p className="text-xs font-semibold">{ad.purchaseValue > 0 ? fmt$(ad.purchaseValue, 0) : "—"}</p>
            <p className="text-xs text-muted-foreground">{ad.roas > 0 ? ad.roas.toFixed(2)+"x" : "—"} ROAS</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function WinnersWidget({ topAds, loading }: { topAds: TopAd[]; loading: boolean }) {
  if (loading) return <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><IconLoader2 className="size-4 animate-spin" />Loading…</div>

  const winners      = topAds.filter(a => a.roas >= 1.5 && a.spend >= 20)
  const highPotential = topAds.filter(a => a.spend < 50 && a.spend > 5 && a.results > 0 && a.roas < 1.5)

  const ThumbStrip = ({ ads, max = 4 }: { ads: TopAd[]; max?: number }) => (
    <div className="flex -space-x-1">
      {ads.slice(0, max).map(a => (
        <div key={a.adId} className="size-9 rounded-md border-2 border-background bg-muted overflow-hidden shrink-0">
          {a.thumbnail
            ? <img src={a.thumbnail} alt={a.adName} className="w-full h-full object-cover" loading="lazy" />
            : <div className="w-full h-full flex items-center justify-center">
                <IconPhoto className="size-3 text-muted-foreground/30" />
              </div>
          }
        </div>
      ))}
      {ads.length > max && (
        <div className="size-9 rounded-md border-2 border-background bg-muted/60 flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
          +{ads.length - max}
        </div>
      )}
    </div>
  )

  return (
    <div className="flex items-center gap-8">
      <div className="flex items-center gap-3">
        <IconTrophy className="size-5 text-amber-500 shrink-0" />
        <span className="text-sm font-semibold">{winners.length} Winners</span>
        {winners.length > 0 ? <ThumbStrip ads={winners} /> : (
          <div className="flex -space-x-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="size-9 rounded-md border-2 border-background bg-muted border-dashed" />
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <IconFlag className="size-5 text-rose-500 shrink-0" />
        <span className="text-sm font-semibold">{highPotential.length} High potential</span>
        {highPotential.length > 0 ? <ThumbStrip ads={highPotential} /> : (
          <div className="flex -space-x-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="size-9 rounded-md border-2 border-background bg-muted border-dashed" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const BREAKDOWN_OPTIONS = [
  { value: "publisher_platform", label: "Platform" },
  { value: "age",                label: "Age" },
  { value: "gender",             label: "Gender" },
  { value: "impression_device",  label: "Device" },
]

const BREAKDOWN_METRICS = [
  { value: "spend",  label: "Spend" },
  { value: "roas",   label: "ROAS" },
  { value: "ctr",    label: "CTR" },
  { value: "cpc",    label: "CPC" },
]

interface BreakdownRow { label: string; spend: number; roas: number; ctr: number; cpc: number; purchaseValue: number; purchases: number; impressions: number; linkClicks: number; cpm: number }

function BreakdownWidget({ accountId, datePreset }: { accountId: string; datePreset: string }) {
  const [breakdown, setBreakdown] = useState("publisher_platform")
  const [metric, setMetric]       = useState("spend")
  const [rows, setRows]           = useState<BreakdownRow[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState("")

  useEffect(() => {
    if (!accountId) return
    setLoading(true); setError("")
    fetch(`/api/insights/breakdown?adAccountId=${encodeURIComponent(accountId)}&datePreset=${datePreset}&breakdown=${breakdown}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); return }; setRows(d.rows || []) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [accountId, datePreset, breakdown])

  const maxVal = rows.length ? Math.max(...rows.map(r => (r as any)[metric] || 0)) : 1

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex rounded-lg border overflow-hidden text-xs">
          {BREAKDOWN_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setBreakdown(o.value)}
              className={cn("px-3 py-1.5 transition-colors",
                breakdown === o.value ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted/50")}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border overflow-hidden text-xs ml-auto">
          {BREAKDOWN_METRICS.map(o => (
            <button key={o.value} onClick={() => setMetric(o.value)}
              className={cn("px-3 py-1.5 transition-colors",
                metric === o.value ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted/50")}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground justify-center">
          <IconLoader2 className="size-4 animate-spin" />Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive py-4">{error}</p>
      ) : rows.length === 0 ? (
        <WidgetEmpty />
      ) : (
        <div className="space-y-2">
          {rows.map(row => {
            const val    = (row as any)[metric] || 0
            const pct    = maxVal > 0 ? (val / maxVal) * 100 : 0
            const fmtVal = metric === "spend" || metric === "cpc"
              ? fmt$(val)
              : metric === "roas" ? val.toFixed(2) + "x"
              : val.toFixed(2) + "%"
            return (
              <div key={row.label} className="flex items-center gap-3">
                <span className="text-xs w-28 shrink-0 capitalize">{row.label}</span>
                <div className="flex-1 h-6 bg-muted/40 rounded-md overflow-hidden">
                  <div className="h-full bg-blue-500/80 rounded-md transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-semibold w-16 text-right shrink-0">{fmtVal}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface PacingData {
  thisMonthSpend: number; lastMonthSpend: number; totalDailyBudget: number
  projectedMonthlyBudget: number; projectedMonthSpend: number; pacePercent: number
  avgDailySpend: number; daysElapsed: number; daysInMonth: number; daysRemaining: number
  campaigns: { id: string; name: string; dailyBudget: number | null }[]
}

function PacingWidget({ accountId }: { accountId: string }) {
  const [data, setData]     = useState<PacingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState("")

  useEffect(() => {
    if (!accountId) return
    setLoading(true); setError("")
    fetch(`/api/insights/pacing?adAccountId=${encodeURIComponent(accountId)}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); return }; setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [accountId])

  if (loading) return <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground justify-center"><IconLoader2 className="size-4 animate-spin" />Loading…</div>
  if (error) return <p className="text-sm text-destructive py-4">{error}</p>
  if (!data) return <WidgetEmpty />

  const p     = Math.min(Math.max(data.pacePercent, 0), 100)
  const color = p > 90 ? "#ef4444" : p > 70 ? "#f59e0b" : "#3b82f6"

  // SVG gauge: semicircle opening downward, cx=80, cy=76, r=60
  const gaugeArc = (percent: number) => {
    const frac = Math.min(Math.max(percent / 100, 0), 1)
    const ex   = 80 - 60 * Math.cos(frac * Math.PI)
    const ey   = 76 - 60 * Math.sin(frac * Math.PI)
    const la   = frac >= 0.5 ? 1 : 0
    return `M 20 76 A 60 60 0 ${la} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`
  }

  return (
    <div className="flex gap-6">
      {/* Gauge */}
      <div className="flex flex-col items-center shrink-0">
        <svg viewBox="0 0 160 82" className="w-44">
          <path d="M 20 76 A 60 60 0 0 1 140 76" fill="none" stroke="#e5e7eb" strokeWidth="10" strokeLinecap="round" />
          {p > 0 && (
            <path d={gaugeArc(p)} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
          )}
          <text x="80" y="62" textAnchor="middle" fontSize="20" fontWeight="bold" fill="currentColor">{p.toFixed(0)}%</text>
          <text x="80" y="75" textAnchor="middle" fontSize="9" fill="#9ca3af">of budget</text>
        </svg>
        <p className="text-xs text-muted-foreground -mt-1">
          {data.daysElapsed} of {data.daysInMonth} days elapsed
        </p>
      </div>

      {/* Stats */}
      <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-3 content-start">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Spent this month</p>
          <p className="text-base font-bold">{fmt$(data.thisMonthSpend)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Daily budget</p>
          <p className="text-base font-bold">{data.totalDailyBudget > 0 ? fmt$(data.totalDailyBudget) : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg daily spend</p>
          <p className="text-base font-bold">{fmt$(data.avgDailySpend)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Projected month</p>
          <p className={cn("text-base font-bold", data.projectedMonthSpend > data.projectedMonthlyBudget && data.projectedMonthlyBudget > 0 ? "text-destructive" : "")}>
            {fmt$(data.projectedMonthSpend)}
          </p>
        </div>
        {data.lastMonthSpend > 0 && (
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Last month spend</p>
            <div className="flex items-center gap-2">
              <p className="text-base font-bold">{fmt$(data.lastMonthSpend)}</p>
              {data.thisMonthSpend > 0 && (
                <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded",
                  data.thisMonthSpend > data.lastMonthSpend ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                  {data.thisMonthSpend > data.lastMonthSpend ? "+" : ""}
                  {(((data.thisMonthSpend - data.lastMonthSpend) / data.lastMonthSpend) * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WidgetEmpty() {
  return (
    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground/50">
      No data available for this period.
    </div>
  )
}

function TopAdCard({ ad, visibleMetrics }: { ad: TopAd; visibleMetrics: SortField[] }) {
  const rankColors = ["#FFD700", "#C0C0C0", "#CD7F32"]
  const rankColor  = rankColors[ad.rank - 1]
  const METRIC_MAP: Record<SortField, { color: string; label: string; value: string }> = {
    spend:   { color: "#3b82f6", label: "Spend",    value: fmt$(ad.spend) },
    results: { color: "#ec4899", label: "Results",  value: String(ad.results) },
    cpr:     { color: "#14b8a6", label: "Cost / Result", value: ad.results > 0 ? fmt$(ad.costPerResult) : "—" },
    created: { color: "#60a5fa", label: "Created",  value: fmtDate(ad.createdTime) },
    impressions: { color: "#8b5cf6", label: "Impressions", value: fmtK(ad.impressions) },
    ctr:     { color: "#f59e0b", label: "CTR",      value: ad.ctr.toFixed(2) + "%" },
  }
  return (
    <div className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative aspect-[4/5] bg-muted">
        {ad.thumbnail
          ? <img src={ad.thumbnail} alt={ad.adName} className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center">
              {ad.isVideo ? <IconPlayerPlay className="size-8 text-muted-foreground/30" /> : <IconPhoto className="size-8 text-muted-foreground/30" />}
            </div>
        }
        <div className={cn("absolute top-2 left-2 size-7 rounded-full flex items-center justify-center text-xs font-bold shadow",
          rankColor ? "text-black" : "bg-black/60 text-white"
        )} style={rankColor ? { backgroundColor: rankColor } : undefined}>
          #{ad.rank}
        </div>
        {ad.isVideo && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-xs font-bold bg-violet-600 text-white">Video</div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <p className="text-xs text-muted-foreground font-medium truncate">{ad.campaignName || "—"}</p>
        <p className="text-xs font-semibold line-clamp-2 leading-tight min-h-[2.4rem]">{ad.adName}</p>
        <div className="space-y-1.5 pt-1.5 border-t">
          {visibleMetrics.map(key => {
            const m = METRIC_MAP[key]
            if (!m) return null
            return (
              <div key={key} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </div>
                <span className="text-xs font-semibold">{m.value}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center py-12">
      <div className="size-16 rounded-2xl bg-muted/40 flex items-center justify-center">
        <Icon className="size-8 text-muted-foreground/30" />
      </div>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">{desc}</p>
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <div className="size-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle className="size-7 text-destructive" />
      </div>
      <div>
        <p className="font-medium text-sm">Failed to load data</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">{message}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <IconRefresh className="size-3.5" /> Retry
      </Button>
    </div>
  )
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="rounded-xl border bg-card overflow-hidden">
          <div className="aspect-[4/5] bg-muted animate-pulse" />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
            <div className="h-4 bg-muted rounded animate-pulse" />
            <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
