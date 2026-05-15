"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useAdAccount } from "@/lib/ad-account-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  IconTrophy, IconMoodSad, IconCalendar, IconWorld, IconLayoutColumns,
  IconChevronDown, IconRefresh, IconPlus, IconX, IconSearch, IconSparkles,
  IconArrowDown, IconArrowUp, IconArrowsUpDown, IconFilter, IconPlayerPlay,
  IconPhoto, IconAlertCircle, IconLoader2, IconMoodEmpty, IconRocket,
  IconLayoutGrid, IconTable, IconCheck, IconDotsVertical, IconBookmark,
  IconShare, IconDownload, IconCircle, IconChartBar,
} from "@tabler/icons-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"

// ─── Types ───────────────────────────────────────────────────────────────────

export type ReportSection =
  | "top-creatives"
  | "admanage-ads"
  | "all-active-ads"
  | "vs-mode"
  | "fatigued-ads"
  | "landing-pages"
  | "ads-l90d"

interface ReportAd {
  rank:             number
  adId:             string
  adName:           string
  adsetName:        string
  campaignName:     string
  spend:            number
  results:          number
  costPerResult:    number
  purchaseValue:    number
  roas:             number
  impressions:      number
  linkClicks:       number
  ctr:              number
  frequency:        number
  reach:            number
  cpm:              number
  avgPurchaseValue: number
  purchaseCR:       number
  dateStart?:       string
  createdTime?:     string | null
  landingPageUrl?:  string | null
  thumbnail?:       string | null
  isVideo:          boolean
  effectiveStatus?: string
  thumbstopRate:    number
  holdRate:         number
}

interface ActiveFilter { id: string; field: string; value: string; label: string }
type SortDir  = "asc" | "desc"
type ViewMode = "grid" | "table"

// ─── Metric Definitions ───────────────────────────────────────────────────────

interface MetricDef {
  key:              string
  label:            string
  color:            string
  fmt:              (v: number, raw?: any) => string
  higherIsBetter:   boolean
}

const fmt$ = (v: number, d = 2) =>
  "$" + v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtK = (v: number) =>
  v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1000 ? (v / 1000).toFixed(1) + "K" : String(Math.round(v))
const fmtDate = (v: number, raw?: any): string =>
  raw ? new Date(raw).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—"

const ALL_METRICS: MetricDef[] = [
  { key: "spend",            label: "Amount Spent",             color: "#7c3aed", fmt: (v) => fmt$(v),                       higherIsBetter: true  },
  { key: "results",          label: "Results",                  color: "#ec4899", fmt: (v) => v > 0 ? String(Math.round(v)) : "—", higherIsBetter: true  },
  { key: "costPerResult",    label: "Cost Per Result",          color: "#14b8a6", fmt: (v) => v > 0 ? fmt$(v) : "—",         higherIsBetter: false },
  { key: "impressions",      label: "Impressions",              color: "#f59e0b", fmt: (v) => fmtK(v),                       higherIsBetter: true  },
  { key: "linkClicks",       label: "Clicks",                   color: "#3b82f6", fmt: (v) => fmtK(v),                       higherIsBetter: true  },
  { key: "ctr",              label: "CTR (All clicks)",         color: "#10b981", fmt: (v) => v.toFixed(2) + "%",             higherIsBetter: true  },
  { key: "frequency",        label: "Frequency",                color: "#ef4444", fmt: (v) => v.toFixed(2),                  higherIsBetter: false },
  { key: "reach",            label: "Reach",                    color: "#8b5cf6", fmt: (v) => fmtK(v),                       higherIsBetter: true  },
  { key: "cpm",              label: "CPM",                      color: "#f97316", fmt: (v) => fmt$(v),                       higherIsBetter: false },
  { key: "roas",             label: "ROAS",                     color: "#84cc16", fmt: (v) => v > 0 ? v.toFixed(2) + "x" : "—", higherIsBetter: true  },
  { key: "avgPurchaseValue", label: "Average Purchase Value",   color: "#06b6d4", fmt: (v) => v > 0 ? fmt$(v) : "—",         higherIsBetter: true  },
  { key: "purchaseCR",       label: "Purchase Conversion Rate", color: "#a855f7", fmt: (v) => v.toFixed(2) + "%",             higherIsBetter: true  },
  { key: "createdTime",      label: "Earliest ad created date", color: "#60a5fa", fmt: fmtDate,                              higherIsBetter: true  },
  { key: "holdRate",         label: "Hold Rate",                color: "#0ea5e9", fmt: (v) => v.toFixed(2) + "%",             higherIsBetter: true  },
  { key: "thumbstopRate",    label: "Thumbstop (Hook Rate)",    color: "#d946ef", fmt: (v) => v.toFixed(2) + "%",             higherIsBetter: true  },
]

// ─── Report Configurations ────────────────────────────────────────────────────

interface ReportConfig {
  title:              string
  description:        string
  iconBg:             string
  icon:               any
  defaultMetricKeys:  string[]
  defaultSortKey:     string
  defaultSortDir:     SortDir
  statusFilter?:      string
  frequencyMin?:      number
  groupByLandingPage?: boolean
  createdAfterDays?:  number
  defaultGroupBy:     string
}

const REPORT_CONFIGS: Record<Exclude<ReportSection, "vs-mode" | "admanage-ads">, ReportConfig> = {
  "top-creatives": {
    icon: IconTrophy,
    title: "Top Creatives",
    description: "This report highlights your top-performing creatives, making it easy to spot what's working.",
    iconBg: "from-orange-400 to-pink-500",
    defaultMetricKeys: ["spend", "costPerResult", "ctr"],
    defaultSortKey: "spend", defaultSortDir: "desc",
    defaultGroupBy: "unique",
  },
  "all-active-ads": {
    icon: IconCircle,
    title: "All Active Ads",
    description: "View all currently active ads with key performance metrics.",
    iconBg: "from-green-400 to-emerald-600",
    defaultMetricKeys: ["spend", "impressions", "linkClicks", "ctr"],
    defaultSortKey: "spend", defaultSortDir: "desc",
    statusFilter: "ACTIVE",
    defaultGroupBy: "unique",
  },
  "fatigued-ads": {
    icon: IconMoodSad,
    title: "Fatigued Ads",
    description: "Identify ads with high frequency that may be causing ad fatigue. High frequency means your audience is seeing the same ad too many times, which can decrease performance.",
    iconBg: "from-orange-400 to-red-500",
    defaultMetricKeys: ["frequency", "spend", "impressions", "reach", "ctr"],
    defaultSortKey: "frequency", defaultSortDir: "desc",
    frequencyMin: 1.5,
    defaultGroupBy: "unique",
  },
  "landing-pages": {
    icon: IconWorld,
    title: "Landing Pages",
    description: "This report shows you the performance of your landing pages. This is an amalgamation of all of the creatives driving traffic to each one.",
    iconBg: "from-blue-400 to-cyan-500",
    defaultMetricKeys: ["spend", "avgPurchaseValue", "purchaseCR", "results"],
    defaultSortKey: "spend", defaultSortDir: "desc",
    groupByLandingPage: true,
    defaultGroupBy: "landing_page",
  },
  "ads-l90d": {
    icon: IconCalendar,
    title: "Ads L90D",
    description: "View your top-performing ads created in the last 90 days with key metrics like spend, results, and cost per result.",
    iconBg: "from-blue-500 to-indigo-600",
    defaultMetricKeys: ["spend", "results", "costPerResult", "createdTime"],
    defaultSortKey: "spend", defaultSortDir: "desc",
    createdAfterDays: 90,
    defaultGroupBy: "unique",
  },
}

const DATE_PRESETS = [
  { label: "Last 7 days",  value: "last_7d" },
  { label: "Last 30 days", value: "last_30d" },
  { label: "Last 90 days", value: "last_90d" },
  { label: "This month",   value: "this_month" },
  { label: "Last month",   value: "last_month" },
]

const GROUP_BY_OPTIONS = [
  { key: "none",    label: "None" },
  { key: "unique",  label: "Unique Ad" },
  { key: "campaign",label: "Campaign" },
  { key: "adset",   label: "Adset" },
]

const FILTER_FIELDS = [
  { key: "ad_name",       label: "Ad name",       type: "text" },
  { key: "adset_name",    label: "Adset name",     type: "dynamic" },
  { key: "campaign_name", label: "Campaign name",  type: "dynamic" },
  { key: "ad_type",       label: "Ad type",        type: "select",
    options: [{ label: "Video", value: "video" }, { label: "Image", value: "image" }] },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRankMedal(rank: number): string {
  if (rank === 1) return "#FFD700"
  if (rank === 2) return "#C0C0C0"
  if (rank === 3) return "#CD7F32"
  return ""
}

function cellBg(value: number, all: number[], higherIsBetter: boolean): string {
  if (all.length < 3) return ""
  const sorted = [...all].filter(v => v > 0).sort((a, b) => a - b)
  if (sorted.length === 0) return ""
  const min = sorted[0], max = sorted[sorted.length - 1]
  if (min === max) return ""
  let norm = (value - min) / (max - min)
  if (!higherIsBetter) norm = 1 - norm
  if (norm >= 0.65) return `rgba(34,197,94,${0.1 + (norm - 0.65) / 0.35 * 0.25})`
  if (norm <= 0.35) return `rgba(239,68,68,${0.1 + (0.35 - norm) / 0.35 * 0.25})`
  return ""
}

function csvDownload(ads: ReportAd[], metricKeys: string[]) {
  const defs = metricKeys.map(k => ALL_METRICS.find(m => m.key === k)!).filter(Boolean)
  const header = ["Rank", "Ad Name", "Campaign", ...defs.map(d => d.label)]
  const rows = ads.map(ad => [
    ad.rank,
    `"${ad.adName.split('"').join("'")}"`,
    `"${(ad.campaignName || "").split('"').join("'")}"`,
    ...defs.map(d => {
      const v = (ad as any)[d.key]
      if (d.key === "createdTime") return ad.createdTime ? new Date(ad.createdTime).toLocaleDateString() : "—"
      return typeof v === "number" ? v.toFixed(2) : (v ?? "—")
    }),
  ])
  const csv = [header, ...rows].map(r => r.join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a"); a.href = url; a.download = "report.csv"; a.click()
  URL.revokeObjectURL(url)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function ReportAdCard({ ad, metricKeys }: { ad: ReportAd; metricKeys: string[] }) {
  const medal = getRankMedal(ad.rank)
  const defs = metricKeys.map(k => ALL_METRICS.find(m => m.key === k)).filter(Boolean) as MetricDef[]
  return (
    <div className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow group">
      <div className="relative aspect-[4/5] bg-muted">
        {ad.thumbnail
          ? <img src={ad.thumbnail} alt={ad.adName} className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center">
              {ad.isVideo
                ? <IconPlayerPlay className="size-8 text-muted-foreground/30" />
                : <IconPhoto       className="size-8 text-muted-foreground/30" />}
            </div>}
        <div className={cn(
          "absolute top-2 left-2 size-7 rounded-full flex items-center justify-center text-xs font-bold shadow",
          medal ? "text-black" : "bg-black/60 text-white"
        )} style={medal ? { backgroundColor: medal } : undefined}>
          #{ad.rank}
        </div>
        {ad.isVideo && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-600 text-white">Video</div>
        )}
        {!ad.isVideo && ad.thumbnail && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white">Image</div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <p className="text-[10px] text-muted-foreground font-medium truncate">{ad.campaignName || "—"}</p>
        <p className="text-xs font-semibold line-clamp-2 leading-tight min-h-[2.4rem]">{ad.adName}</p>
        <div className="space-y-1.5 pt-1.5 border-t">
          {defs.map(m => {
            const raw = (ad as any)[m.key]
            const val = typeof raw === "number" ? m.fmt(raw, raw) : m.fmt(0, raw)
            return (
              <div key={m.key} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                  <span className="text-[10px] text-muted-foreground">{m.label}</span>
                </div>
                <span className="text-[11px] font-semibold">{val}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TableView({
  ads, metricKeys, onSort, sortKey, sortDir,
  selectedIds, onToggle, onToggleAll,
}: {
  ads: ReportAd[]
  metricKeys: string[]
  onSort: (key: string) => void
  sortKey: string
  sortDir: SortDir
  selectedIds?: Set<string>
  onToggle?: (id: string) => void
  onToggleAll?: (ids: string[], allChecked: boolean) => void
}) {
  const selectable  = !!onToggle
  const allChecked  = selectable && ads.length > 0 && ads.every(a => selectedIds!.has(a.adId))
  const someChecked = selectable && ads.some(a => selectedIds!.has(a.adId))
  const headerRef   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = someChecked && !allChecked
  }, [someChecked, allChecked])

  const defs = metricKeys.map(k => ALL_METRICS.find(m => m.key === k)).filter(Boolean) as MetricDef[]

  // Build column value arrays for heatmap
  const colValues = useMemo(() => {
    const map: Record<string, number[]> = {}
    for (const d of defs) {
      map[d.key] = ads.map(a => {
        if (d.key === "createdTime") return a.createdTime ? new Date(a.createdTime).getTime() : 0
        return (a as any)[d.key] ?? 0
      })
    }
    return map
  }, [ads, defs])

  // Totals row
  const totals = useMemo(() => {
    const t: Record<string, number> = {}
    for (const d of defs) {
      if (["spend","results","impressions","linkClicks","reach","purchaseValue"].includes(d.key)) {
        t[d.key] = ads.reduce((s, a) => s + ((a as any)[d.key] ?? 0), 0)
      } else if (d.key === "ctr") {
        const totalImp   = ads.reduce((s, a) => s + a.impressions, 0)
        const totalClicks = ads.reduce((s, a) => s + a.linkClicks, 0)
        t[d.key] = totalImp > 0 ? (totalClicks / totalImp) * 100 : 0
      } else if (d.key === "costPerResult") {
        const totalSpend = ads.reduce((s, a) => s + a.spend, 0)
        const totalRes   = ads.reduce((s, a) => s + a.results, 0)
        t[d.key] = totalRes > 0 ? totalSpend / totalRes : 0
      } else if (d.key === "roas") {
        const totalSpend = ads.reduce((s, a) => s + a.spend, 0)
        const totalPV    = ads.reduce((s, a) => s + a.purchaseValue, 0)
        t[d.key] = totalSpend > 0 ? totalPV / totalSpend : 0
      } else if (d.key === "cpm") {
        const totalSpend = ads.reduce((s, a) => s + a.spend, 0)
        const totalImp   = ads.reduce((s, a) => s + a.impressions, 0)
        t[d.key] = totalImp > 0 ? (totalSpend / totalImp) * 1000 : 0
      } else if (d.key === "frequency") {
        const totalImp   = ads.reduce((s, a) => s + a.impressions, 0)
        const totalReach = ads.reduce((s, a) => s + a.reach, 0)
        t[d.key] = totalReach > 0 ? totalImp / totalReach : 0
      } else {
        t[d.key] = ads.reduce((s, a) => s + ((a as any)[d.key] ?? 0), 0) / (ads.length || 1)
      }
    }
    return t
  }, [ads, defs])

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 font-medium text-muted-foreground w-10">
              {selectable
                ? <input ref={headerRef} type="checkbox" className="size-3.5 rounded cursor-pointer"
                    checked={allChecked}
                    onChange={e => onToggleAll?.(ads.map(a => a.adId), e.target.checked)} />
                : "#"}
            </th>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground min-w-[200px]">Ad Name</th>
            {defs.map((d, i) => (
              <th key={d.key} className="py-2 px-3 font-medium text-muted-foreground whitespace-nowrap cursor-pointer select-none"
                onClick={() => onSort(d.key)}>
                <div className="flex items-center justify-end gap-1">
                  <span className="size-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                    style={{ backgroundColor: d.color }}>{i + 1}</span>
                  <span>{d.label}</span>
                  {sortKey === d.key
                    ? (sortDir === "desc" ? <IconArrowDown className="size-3 text-primary shrink-0" /> : <IconArrowUp className="size-3 text-primary shrink-0" />)
                    : <IconArrowsUpDown className="size-3 text-muted-foreground/40 shrink-0" />}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ads.map(ad => {
            const isSelected = selectedIds?.has(ad.adId) ?? false
            return (
            <tr key={ad.adId}
              className={cn("border-b transition-colors group",
                isSelected ? "bg-blue-50/60 dark:bg-blue-950/20" : "hover:bg-muted/20")}
              onClick={selectable ? () => onToggle?.(ad.adId) : undefined}
              style={selectable ? { cursor: "pointer" } : undefined}>
              <td className="py-2 px-3 text-muted-foreground" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  {selectable
                    ? <input type="checkbox" className="size-3.5 rounded cursor-pointer"
                        checked={isSelected}
                        onChange={() => onToggle?.(ad.adId)} />
                    : null}
                  <span className={selectable ? "ml-1" : ""}>{ad.rank}</span>
                </div>
              </td>
              <td className="py-2 px-3">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded bg-muted shrink-0 overflow-hidden">
                    {ad.thumbnail
                      ? <img src={ad.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                      : <div className="w-full h-full flex items-center justify-center">
                          {ad.isVideo ? <IconPlayerPlay className="size-3 text-muted-foreground/40" /> : <IconPhoto className="size-3 text-muted-foreground/40" />}
                        </div>}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate max-w-[260px]" title={ad.adName}>{ad.adName}</p>
                    <p className="text-muted-foreground/60 text-[10px]">Rank #{ad.rank} · {ad.adsetName ? "1 ad" : "—"}</p>
                  </div>
                </div>
              </td>
              {defs.map(d => {
                const raw = (ad as any)[d.key]
                const num = d.key === "createdTime"
                  ? (ad.createdTime ? new Date(ad.createdTime).getTime() : 0)
                  : (typeof raw === "number" ? raw : 0)
                const bg = cellBg(num, colValues[d.key] || [], d.higherIsBetter)
                const display = d.key === "createdTime"
                  ? (ad.createdTime ? new Date(ad.createdTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")
                  : (typeof raw === "number" ? d.fmt(raw, raw) : "—")
                return (
                  <td key={d.key} className="py-2 px-3 text-right whitespace-nowrap font-medium tabular-nums"
                    style={bg ? { backgroundColor: bg } : undefined}>
                    {display}
                  </td>
                )
              })}
            </tr>
          )})}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/20 font-semibold">
            <td className="py-2 px-3 text-muted-foreground/60">
              {selectable && <span className="size-3.5 inline-block" />}
            </td>
            <td className="py-2 px-3 text-muted-foreground text-[11px]">
              {selectable && someChecked
                ? <span className="text-primary font-semibold">{ads.filter(a => selectedIds!.has(a.adId)).length} of {ads.length} selected</span>
                : `Total: ${ads.length} ads`}
            </td>
            {defs.map(d => {
              const tv = totals[d.key]
              const display = tv !== undefined
                ? (d.key === "createdTime" ? "—" : d.fmt(tv, tv))
                : "—"
              return (
                <td key={d.key} className="py-2 px-3 text-right whitespace-nowrap tabular-nums text-[11px]">
                  {display}
                </td>
              )
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Standard Report View ─────────────────────────────────────────────────────

function StandardReportView({ type }: { type: Exclude<ReportSection, "vs-mode" | "admanage-ads"> }) {
  const { selectedAccountId, adAccounts, setSelectedAccountId } = useAdAccount()
  const config = REPORT_CONFIGS[type]

  const [ads, setAds]           = useState<ReportAd[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState("")
  const [loadTime, setLoadTime] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("grid")

  const [datePreset, setDatePreset] = useState("last_90d")
  const [dateOpen, setDateOpen]     = useState(false)
  const [groupBy, setGroupBy]       = useState(config.defaultGroupBy)
  const [groupOpen, setGroupOpen]   = useState(false)
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([])
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterSearch, setFilterSearch] = useState("")
  const [pendingField, setPendingField] = useState<typeof FILTER_FIELDS[number] | null>(null)
  const [pendingValue, setPendingValue] = useState("")
  const [valueSearch, setValueSearch]   = useState("")

  const [metricKeys, setMetricKeys] = useState<string[]>(config.defaultMetricKeys)
  const [sortKey, setSortKey]       = useState(config.defaultSortKey)
  const [sortDir, setSortDir]       = useState<SortDir>(config.defaultSortDir)
  const [metricOpen, setMetricOpen] = useState(false)
  const [perPage, setPerPage]       = useState(25)

  const [aiLoading, setAiLoading] = useState(false)
  const [aiInsight, setAiInsight] = useState("")
  const [toast, setToast]         = useState("")

  const dateRef   = useRef<HTMLDivElement>(null)
  const groupRef  = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const metricRef = useRef<HTMLDivElement>(null)
  const acctRef   = useRef<HTMLDivElement>(null)
  const [acctOpen, setAcctOpen] = useState(false)

  const accountName = adAccounts?.find((a: any) => a.id === selectedAccountId)?.name || selectedAccountId || "—"

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dateRef.current   && !dateRef.current.contains(e.target as Node))   setDateOpen(false)
      if (groupRef.current  && !groupRef.current.contains(e.target as Node))  setGroupOpen(false)
      if (metricRef.current && !metricRef.current.contains(e.target as Node)) setMetricOpen(false)
      if (acctRef.current   && !acctRef.current.contains(e.target as Node))   setAcctOpen(false)
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false); setPendingField(null); setPendingValue(""); setFilterSearch(""); setValueSearch("")
      }
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(""), 2500); return () => clearTimeout(t) }
  }, [toast])

  const buildUrl = useCallback(() => {
    if (!selectedAccountId) return null
    const params = new URLSearchParams({
      adAccountId: selectedAccountId,
      datePreset,
      limit: "50",
    })
    if (config.statusFilter)      params.set("statusFilter",      config.statusFilter)
    if (config.frequencyMin)      params.set("frequencyMin",      String(config.frequencyMin))
    if (config.groupByLandingPage) params.set("groupByLandingPage", "1")
    if (config.createdAfterDays)  params.set("createdAfterDays", String(config.createdAfterDays))
    return `/api/insights/report?${params}`
  }, [selectedAccountId, datePreset, config])

  const load = useCallback(() => {
    const url = buildUrl()
    if (!url) return
    setLoading(true); setError(""); setAiInsight("")
    const t0 = performance.now()
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setAds(d.ads || [])
        setLoadTime(Math.round((performance.now() - t0) / 100) / 10)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [buildUrl])

  useEffect(() => { load() }, [load])

  const askAI = async () => {
    if (!ads.length) return
    setAiLoading(true); setAiInsight("")
    try {
      const top = ads.slice(0, 10).map(a => ({
        name: a.adName.slice(0, 40), spend: a.spend, ctr: a.ctr, cpr: a.costPerResult, roas: a.roas,
      }))
      const res = await fetch("/api/insights/device/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: top, context: config.title }),
      })
      const d = await res.json()
      if (d.insight) setAiInsight(d.insight)
    } catch {}
    setAiLoading(false)
  }

  // Apply client-side filters + group + sort
  const displayed = useMemo(() => {
    let list = [...ads]
    for (const f of activeFilters) {
      const val = f.value.toLowerCase()
      if      (f.field === "ad_name")       list = list.filter(a => a.adName.toLowerCase().includes(val))
      else if (f.field === "adset_name")    list = list.filter(a => a.adsetName.toLowerCase().includes(val))
      else if (f.field === "campaign_name") list = list.filter(a => a.campaignName.toLowerCase().includes(val))
      else if (f.field === "ad_type")       list = list.filter(a => f.value === "video" ? a.isVideo : !a.isVideo)
    }
    if (groupBy === "unique") {
      const seen = new Set<string>()
      list = list.filter(a => { if (seen.has(a.adName)) return false; seen.add(a.adName); return true })
    }
    list.sort((a, b) => {
      const ak = sortKey === "createdTime" ? (a.createdTime ? new Date(a.createdTime).getTime() : 0) : ((a as any)[sortKey] ?? 0)
      const bk = sortKey === "createdTime" ? (b.createdTime ? new Date(b.createdTime).getTime() : 0) : ((b as any)[sortKey] ?? 0)
      return sortDir === "desc" ? bk - ak : ak - bk
    })
    return list.map((a, i) => ({ ...a, rank: i + 1 }))
  }, [ads, activeFilters, groupBy, sortKey, sortDir])

  const paginated = useMemo(() => displayed.slice(0, perPage), [displayed, perPage])

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc")
    else { setSortKey(key); setSortDir("desc") }
  }

  const dynamicValues = useMemo(() => ({
    campaign_name: [...new Set(ads.map(a => a.campaignName).filter(Boolean))],
    adset_name:    [...new Set(ads.map(a => a.adsetName).filter(Boolean))],
  }), [ads])

  const addFilter = () => {
    if (!pendingField || !pendingValue.trim()) return
    const f = FILTER_FIELDS.find(x => x.key === pendingField.key)
    const lbl = f?.type === "select"
      ? (f as any).options?.find((o: any) => o.value === pendingValue)?.label || pendingValue
      : pendingValue
    setActiveFilters(prev => [...prev, { id: Date.now().toString(), field: pendingField.key, value: pendingValue, label: `${pendingField.label}: ${lbl}` }])
    setPendingField(null); setPendingValue(""); setFilterOpen(false); setFilterSearch(""); setValueSearch("")
  }

  const addFilterDirect = (val: string) => {
    if (!pendingField) return
    setActiveFilters(prev => [...prev, { id: Date.now().toString(), field: pendingField.key, value: val, label: `${pendingField.label}: ${val}` }])
    setPendingField(null); setPendingValue(""); setFilterOpen(false); setFilterSearch(""); setValueSearch("")
  }

  const IconComp = config.icon
  const dateLabel  = DATE_PRESETS.find(p => p.value === datePreset)?.label || datePreset
  const groupLabel = GROUP_BY_OPTIONS.find(g => g.key === groupBy)?.label  || "Unique Ad"
  const filteredFields = FILTER_FIELDS.filter(f => f.label.toLowerCase().includes(filterSearch.toLowerCase()))
  const availableMetrics = ALL_METRICS.filter(m => !metricKeys.includes(m.key))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("size-8 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0", config.iconBg)}>
            <IconComp className="size-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base leading-tight">{config.title}</h1>
            <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-sm">{config.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Account picker */}
          <div className="relative" ref={acctRef}>
            <button onClick={() => setAcctOpen(v => !v)}
              className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border bg-background hover:bg-muted/50 transition-colors">
              <span className="size-2 rounded-full bg-blue-500 shrink-0" />
              <span className="max-w-[140px] truncate">{accountName}</span>
              <IconChevronDown className="size-3.5 text-muted-foreground" />
            </button>
            {acctOpen && adAccounts.length > 0 && (
              <div className="absolute top-full right-0 mt-1 z-50 bg-popover border rounded-xl shadow-xl py-1 min-w-[200px] max-h-60 overflow-y-auto">
                {adAccounts.map((acc: any) => (
                  <button key={acc.id} onClick={() => { setSelectedAccountId(acc.id); setAcctOpen(false) }}
                    className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between gap-2",
                      acc.id === selectedAccountId && "text-primary font-medium")}>
                    <span className="truncate">{acc.name}</span>
                    {acc.id === selectedAccountId && <IconCheck className="size-3.5 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          {loadTime !== null && !loading && (
            <span className="text-xs text-muted-foreground/60 tabular-nums">{loadTime}s</span>
          )}
          <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={load} disabled={loading}>
            <IconRefresh className={cn("size-3.5", loading && "animate-spin")} />
            {!loading && "Refresh"}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={askAI} disabled={aiLoading || !ads.length}>
            <IconSparkles className={cn("size-3.5", aiLoading && "animate-pulse")} />
            Ask AI
          </Button>
          <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={() => setToast("Report saved!")}>
            <IconBookmark className="size-3.5" /> Save as New
          </Button>
          <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={() => setToast("Link copied!")}>
            <IconDownload className="size-3.5" /> Share
          </Button>
          <button className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors">
            <IconDotsVertical className="size-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* ── AI Insight ── */}
      {aiInsight && (
        <div className="mx-6 mt-3 mb-0 p-3 rounded-xl bg-violet-50 border border-violet-200 text-sm text-violet-800 flex items-start gap-2">
          <IconSparkles className="size-4 shrink-0 mt-0.5 text-violet-500" />
          <span>{aiInsight}</span>
          <button className="ml-auto shrink-0" onClick={() => setAiInsight("")}><IconX className="size-3.5" /></button>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-xl bg-foreground text-background text-sm shadow-lg">
          {toast}
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="flex items-center gap-2 px-6 py-2.5 border-b shrink-0 flex-wrap">
        {/* Date */}
        <div className="relative" ref={dateRef}>
          <button onClick={() => setDateOpen(v => !v)}
            className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border bg-background hover:bg-muted/50 transition-colors">
            <IconFilter className="size-3.5 text-muted-foreground" />
            {dateLabel}
            <IconChevronDown className="size-3.5 text-muted-foreground" />
          </button>
          {dateOpen && (
            <div className="absolute top-full left-0 mt-1 z-40 bg-popover border rounded-lg shadow-lg py-1 min-w-[160px]">
              {DATE_PRESETS.map(p => (
                <button key={p.value} onClick={() => { setDatePreset(p.value); setDateOpen(false) }}
                  className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between",
                    datePreset === p.value && "text-primary font-medium")}>
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
            className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border bg-background hover:bg-muted/50 transition-colors">
            Group by <span className="font-semibold">{groupLabel}</span>
            <IconChevronDown className="size-3.5 text-muted-foreground" />
          </button>
          {groupOpen && (
            <div className="absolute top-full left-0 mt-1 z-40 bg-popover border rounded-lg shadow-lg py-1 min-w-[160px]">
              {GROUP_BY_OPTIONS.map(g => (
                <button key={g.key} onClick={() => { setGroupBy(g.key); setGroupOpen(false) }}
                  className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between",
                    groupBy === g.key && "text-primary font-medium")}>
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
              filterOpen ? "border-primary bg-primary/5 text-primary" : "bg-background hover:bg-muted/50")}>
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
                        className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40" />
                    </div>
                  </div>
                  <div className="py-1 max-h-48 overflow-y-auto">
                    {filteredFields.map(f => (
                      <button key={f.key} onClick={() => { setPendingField(f); setPendingValue("") }}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50">{f.label}</button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 p-3 border-b">
                    <button onClick={() => { setPendingField(null); setPendingValue("") }}
                      className="text-muted-foreground hover:text-foreground">
                      <IconArrowsUpDown className="size-3.5 rotate-90" />
                    </button>
                    <span className="text-sm font-medium">{pendingField.label}</span>
                  </div>
                  {pendingField.type === "dynamic" ? (
                    <>
                      <div className="p-2 border-b">
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/40">
                          <IconSearch className="size-3.5 text-muted-foreground/50 shrink-0" />
                          <input value={valueSearch} onChange={e => setValueSearch(e.target.value)}
                            placeholder={`Select ${pendingField.label.toLowerCase()}...`} autoFocus
                            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40" />
                        </div>
                      </div>
                      <div className="py-1 max-h-48 overflow-y-auto">
                        {(dynamicValues[pendingField.key as keyof typeof dynamicValues] || [])
                          .filter((v: string) => v.toLowerCase().includes(valueSearch.toLowerCase()))
                          .map((v: string) => (
                            <button key={v} onClick={() => addFilterDirect(v)}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/60 truncate" title={v}>{v}</button>
                          ))}
                      </div>
                    </>
                  ) : (
                    <div className="p-3 space-y-3">
                      {pendingField.type === "text" && (
                        <input value={pendingValue} onChange={e => setPendingValue(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && addFilter()}
                          placeholder={`Filter by ${pendingField.label.toLowerCase()}...`} autoFocus
                          className="w-full px-3 py-2 text-sm border rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40" />
                      )}
                      {pendingField.type === "select" && (
                        <div className="space-y-1">
                          {(pendingField as any).options?.map((opt: any) => (
                            <button key={opt.value} onClick={() => setPendingValue(opt.value)}
                              className={cn("w-full text-left px-3 py-2 text-sm rounded-lg border transition-colors",
                                pendingValue === opt.value ? "border-primary bg-primary/5 text-primary font-medium" : "border-transparent hover:bg-muted/50")}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 h-8" onClick={addFilter} disabled={!pendingValue.trim()}>Apply</Button>
                        <Button size="sm" variant="outline" className="h-8" onClick={() => { setPendingField(null); setPendingValue("") }}>Back</Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Active filters */}
        {activeFilters.map(f => (
          <div key={f.id} className="flex items-center gap-1 h-8 px-3 rounded-lg border border-primary/30 bg-primary/5 text-xs font-medium text-primary">
            {f.label}
            <button onClick={() => setActiveFilters(p => p.filter(x => x.id !== f.id))} className="ml-0.5 hover:text-destructive">
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

      {/* ── Metric Bar ── */}
      <div className="flex items-center gap-2 px-6 py-2 border-b shrink-0 flex-wrap bg-muted/5">
        {metricKeys.map((key, idx) => {
          const def = ALL_METRICS.find(m => m.key === key)!
          if (!def) return null
          const isActive = sortKey === key
          const SortIcon = isActive ? (sortDir === "desc" ? IconArrowDown : IconArrowUp) : IconArrowsUpDown
          return (
            <div key={key}
              className={cn("flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-medium select-none transition-colors",
                isActive ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted/50")}>
              <span className="size-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                style={{ backgroundColor: def.color }}>{idx + 1}</span>
              <button onClick={() => handleSort(key)} className="flex items-center gap-1">
                {def.label}
                <SortIcon className={cn("size-3", isActive ? "text-primary" : "text-muted-foreground/50")} />
              </button>
              <button onClick={() => { setMetricKeys(p => p.filter(k => k !== key)); if (sortKey === key) setSortKey("spend") }}
                className="ml-0.5 text-muted-foreground hover:text-foreground">
                <IconX className="size-3" />
              </button>
            </div>
          )
        })}

        {/* Add metric */}
        {availableMetrics.length > 0 && (
          <div className="relative" ref={metricRef}>
            <button onClick={() => setMetricOpen(v => !v)}
              className="flex items-center gap-1 h-7 px-2.5 rounded-full border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors bg-background">
              <IconPlus className="size-3" /> Add metric
            </button>
            {metricOpen && (
              <div className="absolute top-full left-0 mt-1 z-30 bg-popover border rounded-lg shadow-md py-1 min-w-[200px] max-h-56 overflow-y-auto">
                {availableMetrics.map(m => (
                  <button key={m.key} onClick={() => { setMetricKeys(p => [...p, m.key]); setMetricOpen(false) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center gap-2">
                    <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* View toggle + Attribution */}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setViewMode("grid")}
            className={cn("h-7 w-7 flex items-center justify-center rounded border transition-colors",
              viewMode === "grid" ? "bg-primary/10 border-primary/40 text-primary" : "border-border hover:bg-muted/50 text-muted-foreground")}>
            <IconLayoutGrid className="size-3.5" />
          </button>
          <button onClick={() => setViewMode("table")}
            className={cn("h-7 w-7 flex items-center justify-center rounded border transition-colors",
              viewMode === "table" ? "bg-primary/10 border-primary/40 text-primary" : "border-border hover:bg-muted/50 text-muted-foreground")}>
            <IconTable className="size-3.5" />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto">
        {!selectedAccountId ? (
          <EmptyState icon={IconAlertCircle} title="No ad account selected" desc="Select an ad account from the sidebar." />
        ) : loading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-sm text-muted-foreground">
            <IconLoader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="size-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <IconAlertCircle className="size-6 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground max-w-sm text-center">{error}</p>
            <Button size="sm" variant="outline" onClick={load}><IconRefresh className="size-3.5" /> Retry</Button>
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState icon={IconMoodEmpty} title="No ads found" desc="Try adjusting your filters or date range" />
        ) : viewMode === "grid" ? (
          <div className="px-6 py-4">
            <p className="text-xs text-muted-foreground mb-4 font-medium">
              {displayed.length}/{ads.length} ads{activeFilters.length > 0 && <span className="ml-1 text-primary">({activeFilters.length} filter{activeFilters.length > 1 ? "s" : ""} active)</span>}
              {activeFilters.length === 0 && " selected"}
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {paginated.map(ad => (
                <ReportAdCard key={ad.adId} ad={ad} metricKeys={metricKeys} />
              ))}
            </div>
            {displayed.length > perPage && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <p className="text-xs text-muted-foreground">Showing {perPage} of {displayed.length} results</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Per page:</span>
                  {[25, 50].map(n => (
                    <button key={n} onClick={() => setPerPage(n)}
                      className={cn("h-7 px-2.5 text-xs rounded border transition-colors",
                        perPage === n ? "bg-primary/10 border-primary/40 text-primary" : "border-border hover:bg-muted/50")}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground font-medium">
                {displayed.length} ads
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                  onClick={() => handleSort("spend")}>
                  Rank <IconArrowUp className="size-3" />
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                  onClick={() => csvDownload(displayed, metricKeys)}>
                  <IconDownload className="size-3" /> Export
                </Button>
                <button className="h-7 px-2.5 text-xs rounded border border-border hover:bg-muted/50 flex items-center gap-1"
                  onClick={() => setMetricOpen(v => !v)}>
                  Edit Columns
                </button>
              </div>
            </div>
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/5">
                <input type="checkbox" className="size-3.5 rounded" />
                <span className="text-xs text-muted-foreground font-medium ml-1">{displayed.length}/{ads.length} {displayed.length} ads selected</span>
              </div>
              <TableView ads={paginated} metricKeys={metricKeys} onSort={handleSort} sortKey={sortKey} sortDir={sortDir} />
            </div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">Showing {Math.min(perPage, displayed.length)} results</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Per page:</span>
                {[25, 50].map(n => (
                  <button key={n} onClick={() => setPerPage(n)}
                    className={cn("h-7 px-2.5 text-xs rounded border transition-colors",
                      perPage === n ? "bg-primary/10 border-primary/40 text-primary" : "border-border hover:bg-muted/50")}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── VS Mode ─────────────────────────────────────────────────────────────────

const VS_FILTER_FIELDS = [
  { key: "ad_name",         label: "Ad",              type: "text" },
  { key: "headline",        label: "Headline",         type: "text" },
  { key: "call_to_action",  label: "Call to action",   type: "text" },
  { key: "ad_status",       label: "Ad status",        type: "select",
    options: [{ label: "Active", value: "ACTIVE" }, { label: "Paused", value: "PAUSED" }, { label: "Archived", value: "ARCHIVED" }] },
  { key: "created_date",    label: "Ad created date",  type: "text" },
  { key: "spend_gte",       label: "Amount Spent ≥",   type: "text" },
  { key: "impressions_gte", label: "Impressions ≥",    type: "text" },
  { key: "active_status",   label: "Active status",    type: "select",
    options: [{ label: "Active", value: "ACTIVE" }, { label: "Inactive", value: "INACTIVE" }] },
  { key: "clicks_gte",      label: "Clicks ≥",         type: "text" },
] as const

type VsFilterField = { key: string; label: string; type: string; options?: Array<{ label: string; value: string }> }

function applyVsFilters(ads: ReportAd[], filters: ActiveFilter[]): ReportAd[] {
  let list = [...ads]
  for (const f of filters) {
    if (f.field === "ad_name" || f.field === "headline" || f.field === "call_to_action") {
      list = list.filter(a => a.adName.toLowerCase().includes(f.value.toLowerCase()))
    } else if (f.field === "ad_status") {
      list = list.filter(a => a.effectiveStatus === f.value)
    } else if (f.field === "active_status") {
      list = f.value === "ACTIVE"
        ? list.filter(a => a.effectiveStatus === "ACTIVE")
        : list.filter(a => a.effectiveStatus !== "ACTIVE")
    } else if (f.field === "spend_gte") {
      const n = parseFloat(f.value); if (!isNaN(n)) list = list.filter(a => a.spend >= n)
    } else if (f.field === "impressions_gte") {
      const n = parseInt(f.value); if (!isNaN(n)) list = list.filter(a => a.impressions >= n)
    } else if (f.field === "clicks_gte") {
      const n = parseInt(f.value); if (!isNaN(n)) list = list.filter(a => a.linkClicks >= n)
    }
  }
  return list
}

function aggregateAds(ads: ReportAd[]) {
  if (!ads.length) return {} as Record<string, number>
  const spend         = ads.reduce((s, a) => s + a.spend, 0)
  const impressions   = ads.reduce((s, a) => s + a.impressions, 0)
  const linkClicks    = ads.reduce((s, a) => s + a.linkClicks, 0)
  const purchaseValue = ads.reduce((s, a) => s + a.purchaseValue, 0)
  const results       = ads.reduce((s, a) => s + a.results, 0)
  const reach         = ads.reduce((s, a) => s + a.reach, 0)
  return {
    spend, impressions, linkClicks, purchaseValue, results, reach,
    ctr:           impressions > 0 ? (linkClicks / impressions) * 100 : 0,
    cpm:           impressions > 0 ? (spend / impressions) * 1000 : 0,
    costPerResult: results > 0 ? spend / results : 0,
    roas:          spend > 0 ? purchaseValue / spend : 0,
    frequency:     ads.reduce((s, a) => s + a.frequency, 0) / ads.length,
    holdRate:      ads.reduce((s, a) => s + (a.holdRate || 0), 0) / ads.length,
    thumbstopRate: ads.reduce((s, a) => s + (a.thumbstopRate || 0), 0) / ads.length,
  }
}

function FilterDropdown({
  open, onToggle, filters, onRemove, onClear, dropRef,
  pendingField, setPendingField, pendingValue, setPendingValue,
  fieldSearch, setFieldSearch, onApply, segColor,
}: {
  open: boolean; onToggle: () => void
  filters: ActiveFilter[]; onRemove: (id: string) => void; onClear: () => void
  dropRef: React.RefObject<HTMLDivElement>
  pendingField: VsFilterField | null; setPendingField: (f: VsFilterField | null) => void
  pendingValue: string; setPendingValue: (v: string) => void
  fieldSearch: string; setFieldSearch: (s: string) => void
  onApply: (field: string, value: string, label: string) => void
  segColor: "blue" | "orange"
}) {
  const chipCls = segColor === "blue"
    ? "border-blue-300/60 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
    : "border-orange-300/60 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300"

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {filters.map(f => (
        <div key={f.id} className={cn("flex items-center gap-1 h-7 px-2.5 rounded-full border text-xs font-medium", chipCls)}>
          {f.label}
          <button onClick={() => onRemove(f.id)} className="ml-0.5 hover:text-destructive"><IconX className="size-3" /></button>
        </div>
      ))}
      <div className="relative" ref={dropRef}>
        <button onClick={onToggle}
          className={cn("flex items-center gap-1 h-7 px-2.5 text-xs rounded-full border transition-colors",
            open ? "border-primary bg-primary/5 text-primary" : "border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary/50 hover:text-primary")}>
          <IconPlus className="size-3" /> Add filter
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-xl shadow-xl w-64">
            {!pendingField ? (
              <>
                <div className="p-2 border-b">
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/40">
                    <IconSearch className="size-3.5 text-muted-foreground/50 shrink-0" />
                    <input value={fieldSearch} onChange={e => setFieldSearch(e.target.value)}
                      placeholder="Search fields..." autoFocus
                      className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40" />
                  </div>
                </div>
                <div className="py-1 max-h-56 overflow-y-auto">
                  {VS_FILTER_FIELDS.filter(f => f.label.toLowerCase().includes(fieldSearch.toLowerCase())).map(f => (
                    <button key={f.key} onClick={() => { setPendingField(f as VsFilterField); setPendingValue("") }}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50">{f.label}</button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 p-3 border-b">
                  <button onClick={() => setPendingField(null)} className="text-muted-foreground hover:text-foreground">
                    <IconArrowsUpDown className="size-3.5 rotate-90" />
                  </button>
                  <span className="text-sm font-medium">{pendingField.label}</span>
                </div>
                {pendingField.type === "select" ? (
                  <div className="py-1">
                    {(pendingField as any).options?.map((opt: any) => (
                      <button key={opt.value} onClick={() => onApply(pendingField.key, opt.value, pendingField.label)}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50">{opt.label}</button>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    <input value={pendingValue} onChange={e => setPendingValue(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && pendingValue.trim()) onApply(pendingField.key, pendingValue.trim(), pendingField.label) }}
                      placeholder="Filter value..." autoFocus
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring" />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 h-8"
                        onClick={() => pendingValue.trim() && onApply(pendingField.key, pendingValue.trim(), pendingField.label)}
                        disabled={!pendingValue.trim()}>Apply</Button>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setPendingField(null)}>Back</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {filters.length > 0 && (
        <button onClick={onClear} className="text-[10px] text-muted-foreground hover:text-destructive px-1">Clear</button>
      )}
    </div>
  )
}

function VSModeView() {
  const { selectedAccountId, adAccounts, setSelectedAccountId } = useAdAccount()

  const [allAds, setAllAds]     = useState<ReportAd[]>([])
  const [loading, setLoading]   = useState(false)
  const [loadTime, setLoadTime] = useState<number | null>(null)
  const [datePreset, setDatePreset] = useState("last_90d")
  const [dateOpen, setDateOpen]     = useState(false)
  const dateRef = useRef<HTMLDivElement>(null)

  const [metricKeys, setMetricKeys] = useState<string[]>([
    "spend", "results", "costPerResult", "createdTime", "cpm", "ctr", "frequency", "holdRate", "thumbstopRate",
  ])
  const [sortKey, setSortKey] = useState("spend")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [metricOpen, setMetricOpen] = useState(false)
  const metricRef = useRef<HTMLDivElement>(null)

  const [sel1, setSel1] = useState<Set<string>>(new Set())
  const [sel2, setSel2] = useState<Set<string>>(new Set())

  const [seg1Filters, setSeg1Filters] = useState<ActiveFilter[]>([])
  const [f1Open, setF1Open]           = useState(false)
  const [p1Field, setP1Field]         = useState<VsFilterField | null>(null)
  const [p1Value, setP1Value]         = useState("")
  const [f1Search, setF1Search]       = useState("")
  const f1Ref = useRef<HTMLDivElement>(null)

  const [seg2Filters, setSeg2Filters] = useState<ActiveFilter[]>([])
  const [f2Open, setF2Open]           = useState(false)
  const [p2Field, setP2Field]         = useState<VsFilterField | null>(null)
  const [p2Value, setP2Value]         = useState("")
  const [f2Search, setF2Search]       = useState("")
  const f2Ref = useRef<HTMLDivElement>(null)

  const acctRef = useRef<HTMLDivElement>(null)
  const [acctOpen, setAcctOpen] = useState(false)
  const accountName = adAccounts?.find((a: any) => a.id === selectedAccountId)?.name || "—"

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dateRef.current   && !dateRef.current.contains(e.target as Node))   setDateOpen(false)
      if (acctRef.current   && !acctRef.current.contains(e.target as Node))   setAcctOpen(false)
      if (metricRef.current && !metricRef.current.contains(e.target as Node)) setMetricOpen(false)
      if (f1Ref.current && !f1Ref.current.contains(e.target as Node)) {
        setF1Open(false); setP1Field(null); setP1Value(""); setF1Search("")
      }
      if (f2Ref.current && !f2Ref.current.contains(e.target as Node)) {
        setF2Open(false); setP2Field(null); setP2Value(""); setF2Search("")
      }
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const load = useCallback(() => {
    if (!selectedAccountId) return
    const t0 = performance.now()
    setLoading(true)
    fetch(`/api/insights/report?adAccountId=${encodeURIComponent(selectedAccountId)}&datePreset=${datePreset}&limit=50`)
      .then(r => r.json())
      .then(d => { setAllAds(d.ads || []); setLoadTime(Math.round((performance.now() - t0) / 100) / 10) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedAccountId, datePreset])

  useEffect(() => { load() }, [load])

  const seg1Ads = useMemo(() => {
    const mid = Math.max(1, Math.ceil(allAds.length / 2))
    return seg1Filters.length ? applyVsFilters(allAds, seg1Filters) : allAds.slice(0, mid)
  }, [allAds, seg1Filters])
  const seg2Ads = useMemo(() => {
    const mid = Math.max(1, Math.ceil(allAds.length / 2))
    return seg2Filters.length ? applyVsFilters(allAds, seg2Filters) : allAds.slice(mid)
  }, [allAds, seg2Filters])

  // Clear selections when segment content changes
  useEffect(() => { setSel1(new Set()) }, [seg1Ads])
  useEffect(() => { setSel2(new Set()) }, [seg2Ads])

  // Effective ads for KPI: selected subset, or all if nothing checked
  const eff1 = useMemo(
    () => sel1.size > 0 ? seg1Ads.filter(a => sel1.has(a.adId)) : seg1Ads,
    [seg1Ads, sel1]
  )
  const eff2 = useMemo(
    () => sel2.size > 0 ? seg2Ads.filter(a => sel2.has(a.adId)) : seg2Ads,
    [seg2Ads, sel2]
  )

  const toggle1     = (id: string) => setSel1(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll1  = (ids: string[], checked: boolean) => setSel1(checked ? new Set(ids) : new Set())
  const toggle2     = (id: string) => setSel2(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll2  = (ids: string[], checked: boolean) => setSel2(checked ? new Set(ids) : new Set())

  const m1   = aggregateAds(eff1)
  const m2   = aggregateAds(eff2)
  const defs = metricKeys.map(k => ALL_METRICS.find(m => m.key === k)).filter(Boolean) as MetricDef[]

  const winner = (key: string) => {
    const v1 = (m1 as any)[key] ?? 0
    const v2 = (m2 as any)[key] ?? 0
    const hib = ALL_METRICS.find(m => m.key === key)?.higherIsBetter ?? true
    if (v1 === v2) return null
    return (hib ? v1 > v2 : v1 < v2) ? 1 : 2
  }

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc")
    else { setSortKey(key); setSortDir("desc") }
  }

  const addF1 = (field: string, value: string, label: string) => {
    setSeg1Filters(p => [...p, { id: Date.now().toString(), field, value, label: `${label} = ${value}` }])
    setF1Open(false); setP1Field(null); setP1Value(""); setF1Search("")
  }
  const addF2 = (field: string, value: string, label: string) => {
    setSeg2Filters(p => [...p, { id: Date.now().toString(), field, value, label: `${label} = ${value}` }])
    setF2Open(false); setP2Field(null); setP2Value(""); setF2Search("")
  }

  const dateLabel    = DATE_PRESETS.find(p => p.value === datePreset)?.label || datePreset
  const availMetrics = ALL_METRICS.filter(m => !metricKeys.includes(m.key))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center shrink-0">
            <IconLayoutColumns className="size-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">VS Mode</h1>
            <p className="text-[11px] text-muted-foreground">Compare two ad segments side by side with independent filter sets.</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative" ref={acctRef}>
            <button onClick={() => setAcctOpen(v => !v)}
              className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border bg-background hover:bg-muted/50 transition-colors">
              <span className="size-2 rounded-full bg-blue-500 shrink-0" />
              <span className="max-w-[140px] truncate">{accountName}</span>
              <IconChevronDown className="size-3.5 text-muted-foreground" />
            </button>
            {acctOpen && adAccounts.length > 0 && (
              <div className="absolute top-full right-0 mt-1 z-50 bg-popover border rounded-xl shadow-xl py-1 min-w-[200px] max-h-60 overflow-y-auto">
                {adAccounts.map((acc: any) => (
                  <button key={acc.id} onClick={() => { setSelectedAccountId(acc.id); setAcctOpen(false) }}
                    className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between gap-2",
                      acc.id === selectedAccountId && "text-primary font-medium")}>
                    <span className="truncate">{acc.name}</span>
                    {acc.id === selectedAccountId && <IconCheck className="size-3.5 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          {loadTime !== null && !loading && <span className="text-xs text-muted-foreground/60">{loadTime}s</span>}
          <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={load} disabled={loading}>
            <IconRefresh className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 gap-1.5"><IconSparkles className="size-3.5" /> Ask AI</Button>
          <Button size="sm" variant="ghost" className="h-8 gap-1.5"><IconBookmark className="size-3.5" /> Save as New</Button>
          <Button size="sm" variant="ghost" className="h-8 gap-1.5"><IconDownload className="size-3.5" /> Share</Button>
        </div>
      </div>

      {/* Date / group bar */}
      <div className="flex items-center gap-2 px-6 py-2.5 border-b shrink-0">
        <div className="relative" ref={dateRef}>
          <button onClick={() => setDateOpen(v => !v)}
            className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border bg-background hover:bg-muted/50 transition-colors">
            <IconFilter className="size-3.5 text-muted-foreground" />{dateLabel}
            <IconChevronDown className="size-3.5 text-muted-foreground" />
          </button>
          {dateOpen && (
            <div className="absolute top-full left-0 mt-1 z-40 bg-popover border rounded-lg shadow-lg py-1 min-w-[160px]">
              {DATE_PRESETS.map(p => (
                <button key={p.value} onClick={() => { setDatePreset(p.value); setDateOpen(false) }}
                  className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between",
                    datePreset === p.value && "text-primary font-medium")}>
                  {p.label}{datePreset === p.value && <span className="size-1.5 rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border bg-background hover:bg-muted/50 transition-colors">
          Group by <span className="font-semibold ml-1">Unique Ad</span>
          <IconChevronDown className="size-3.5 text-muted-foreground ml-1" />
        </button>
      </div>

      {/* Segment filter rows */}
      <div className="grid grid-cols-2 divide-x border-b shrink-0">
        <div className="flex items-start gap-1.5 px-4 py-2.5 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap mt-1">Segment 1</span>
          <div className="h-4 w-px bg-border mx-0.5 mt-1.5" />
          <FilterDropdown
            open={f1Open} onToggle={() => { setF1Open(v => !v); setP1Field(null); setP1Value("") }}
            filters={seg1Filters} onRemove={id => setSeg1Filters(p => p.filter(x => x.id !== id))}
            onClear={() => setSeg1Filters([])} dropRef={f1Ref as React.RefObject<HTMLDivElement>}
            pendingField={p1Field} setPendingField={setP1Field}
            pendingValue={p1Value} setPendingValue={setP1Value}
            fieldSearch={f1Search} setFieldSearch={setF1Search}
            onApply={addF1} segColor="blue"
          />
        </div>
        <div className="flex items-start gap-1.5 px-4 py-2.5 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap mt-1">Segment 2</span>
          <div className="h-4 w-px bg-border mx-0.5 mt-1.5" />
          <FilterDropdown
            open={f2Open} onToggle={() => { setF2Open(v => !v); setP2Field(null); setP2Value("") }}
            filters={seg2Filters} onRemove={id => setSeg2Filters(p => p.filter(x => x.id !== id))}
            onClear={() => setSeg2Filters([])} dropRef={f2Ref as React.RefObject<HTMLDivElement>}
            pendingField={p2Field} setPendingField={setP2Field}
            pendingValue={p2Value} setPendingValue={setP2Value}
            fieldSearch={f2Search} setFieldSearch={setF2Search}
            onApply={addF2} segColor="orange"
          />
        </div>
      </div>

      {/* Metrics bar */}
      <div className="flex items-center gap-2 px-6 py-2 border-b shrink-0 flex-wrap bg-muted/5">
        {metricKeys.map((key, idx) => {
          const def = ALL_METRICS.find(m => m.key === key)!
          if (!def) return null
          const isActive = sortKey === key
          const SortIcon = isActive ? (sortDir === "desc" ? IconArrowDown : IconArrowUp) : IconArrowsUpDown
          return (
            <div key={key}
              className={cn("flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-medium select-none transition-colors",
                isActive ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted/50")}>
              <span className="size-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                style={{ backgroundColor: def.color }}>{idx + 1}</span>
              <button onClick={() => handleSort(key)} className="flex items-center gap-1">
                {def.label}
                <SortIcon className={cn("size-3", isActive ? "text-primary" : "text-muted-foreground/50")} />
              </button>
              <button onClick={() => { setMetricKeys(p => p.filter(k => k !== key)); if (sortKey === key) setSortKey("spend") }}
                className="ml-0.5 text-muted-foreground hover:text-foreground">
                <IconX className="size-3" />
              </button>
            </div>
          )
        })}
        {availMetrics.length > 0 && (
          <div className="relative" ref={metricRef}>
            <button onClick={() => setMetricOpen(v => !v)}
              className="flex items-center gap-1 h-7 px-2.5 rounded-full border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors bg-background">
              <IconPlus className="size-3" /> Add metric
            </button>
            {metricOpen && (
              <div className="absolute top-full left-0 mt-1 z-30 bg-popover border rounded-lg shadow-md py-1 min-w-[200px] max-h-56 overflow-y-auto">
                {availMetrics.map(m => (
                  <button key={m.key} onClick={() => { setMetricKeys(p => [...p, m.key]); setMetricOpen(false) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center gap-2">
                    <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
        {!selectedAccountId ? (
          <EmptyState icon={IconAlertCircle} title="No ad account selected" desc="Select an ad account from the sidebar." />
        ) : loading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-sm text-muted-foreground">
            <IconLoader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-4">
              {([
                { ads: seg1Ads, eff: eff1, sel: sel1, metrics: m1, label: "Segment 1" },
                { ads: seg2Ads, eff: eff2, sel: sel2, metrics: m2, label: "Segment 2" },
              ] as const).map((seg, si) => (
                <div key={si} className="rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-sm">{seg.label}</p>
                      {seg.sel.size > 0
                        ? <p className="text-xs text-primary font-medium">{seg.sel.size} of {seg.ads.length} selected</p>
                        : <p className="text-xs text-muted-foreground">{seg.ads.length} ad{seg.ads.length !== 1 ? "s" : ""}</p>}
                    </div>
                    {si === 1 && (
                      <div className="size-8 rounded-full border-2 border-border flex items-center justify-center text-xs font-bold text-muted-foreground">VS</div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {defs.map(d => {
                      const v = (seg.metrics as any)[d.key] ?? 0
                      const w = winner(d.key)
                      const isWinner = w === si + 1
                      return (
                        <div key={d.key} className={cn("rounded-lg p-2.5 border", isWinner ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20" : "border-border")}>
                          <p className="text-[10px] text-muted-foreground mb-1 line-clamp-1">{d.label}</p>
                          <div className="flex items-center gap-1">
                            {isWinner && <IconArrowUp className="size-3 text-emerald-500 shrink-0" />}
                            <p className={cn("text-sm font-bold tabular-nums", isWinner ? "text-emerald-600" : "")}>
                              {d.key === "createdTime"
                                ? (seg.ads[0]?.createdTime ? new Date(seg.ads[0].createdTime).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—")
                                : d.fmt(v, v)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Thumbnails */}
            <div className="grid grid-cols-2 gap-4">
              {[{ ads: seg1Ads, label: "Segment 1" }, { ads: seg2Ads, label: "Segment 2" }].map((seg, si) => (
                <div key={si}>
                  <p className="text-sm font-semibold mb-2">
                    {seg.label} <span className="text-muted-foreground font-normal text-xs">({seg.ads.length} ads)</span>
                  </p>
                  {seg.ads.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {seg.ads.slice(0, 2).map(ad => (
                        <ReportAdCard key={ad.adId} ad={ad} metricKeys={["spend", "results", "costPerResult"]} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border bg-muted/20 h-32 flex items-center justify-center text-xs text-muted-foreground">
                      No ads in this segment
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Tables */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { ads: seg1Ads, label: "Segment 1", sel: sel1, onToggle: toggle1, onToggleAll: toggleAll1 },
                { ads: seg2Ads, label: "Segment 2", sel: sel2, onToggle: toggle2, onToggleAll: toggleAll2 },
              ].map((seg, si) => (
                <div key={si} className="rounded-xl border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b">
                    <p className="font-semibold text-sm">{seg.label}</p>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                      <IconDownload className="size-3" /> Export
                    </Button>
                  </div>
                  {seg.ads.length > 0
                    ? <TableView
                        ads={seg.ads.slice(0, 10)}
                        metricKeys={metricKeys.slice(0, 4)}
                        onSort={() => {}} sortKey={sortKey} sortDir={sortDir}
                        selectedIds={seg.sel}
                        onToggle={seg.onToggle}
                        onToggleAll={seg.onToggleAll}
                      />
                    : <div className="py-8 text-center text-sm text-muted-foreground">No ads in this segment</div>}
                  <div className="px-4 py-2 border-t bg-muted/5 text-xs text-muted-foreground">
                    Showing {Math.min(seg.ads.length, 10)} of {seg.ads.length}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── AdManage Ads View ────────────────────────────────────────────────────────

const PLATFORMS = ["Facebook", "TikTok", "Google Ads", "Pinterest", "Snapchat", "Axon"]
const PLATFORM_COLORS: Record<string, string> = {
  Facebook: "#1877f2", TikTok: "#000", "Google Ads": "#4285f4",
  Pinterest: "#e60023", Snapchat: "#fffc00", Axon: "#6366f1",
}

function AdManageAdsView() {
  const { selectedAccountId, adAccounts, setSelectedAccountId } = useAdAccount()
  const [creatives, setCreatives] = useState<any[]>([])
  const [loading, setLoading]     = useState(false)
  const [platform, setPlatform]   = useState("Facebook")
  const [datePreset, setDatePreset] = useState("last_30d")
  const [dateOpen, setDateOpen]     = useState(false)
  const [acctOpen, setAcctOpen]     = useState(false)
  const dateRef = useRef<HTMLDivElement>(null)
  const acctRef = useRef<HTMLDivElement>(null)
  const accountName = adAccounts?.find((a: any) => a.id === selectedAccountId)?.name || "—"

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setDateOpen(false)
      if (acctRef.current && !acctRef.current.contains(e.target as Node)) setAcctOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const load = useCallback(() => {
    const url = selectedAccountId
      ? `/api/creatives?ad_account_id=${encodeURIComponent(selectedAccountId)}`
      : "/api/creatives"
    setLoading(true)
    fetch(url)
      .then(r => r.json())
      .then(d => setCreatives(d.creatives || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedAccountId])

  useEffect(() => { load() }, [load])

  // Group by month for chart
  const chartData = useMemo(() => {
    const buckets: Record<string, number> = {}
    const since = new Date()
    if (datePreset === "last_7d")  since.setDate(since.getDate() - 7)
    else if (datePreset === "last_30d") since.setDate(since.getDate() - 30)
    else since.setDate(since.getDate() - 90)

    for (const c of creatives) {
      const d = new Date(c.created_at)
      if (d < since) continue
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      buckets[label] = (buckets[label] || 0) + 1
    }
    return Object.entries(buckets).map(([date, count]) => ({ date, count }))
  }, [creatives, datePreset])

  const total = creatives.length
  const dateLabel = DATE_PRESETS.find(p => p.value === datePreset)?.label || datePreset

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center shrink-0">
            <IconRocket className="size-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">AdManage Ads</h1>
            <p className="text-[11px] text-muted-foreground">Track ads launched through AdManage across all platforms over time</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative" ref={acctRef}>
            <button onClick={() => setAcctOpen(v => !v)}
              className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border bg-background hover:bg-muted/50 transition-colors">
              <span className="size-2 rounded-full bg-blue-500 shrink-0" />
              <span className="max-w-[140px] truncate">{accountName}</span>
              <IconChevronDown className="size-3.5 text-muted-foreground" />
            </button>
            {acctOpen && adAccounts.length > 0 && (
              <div className="absolute top-full right-0 mt-1 z-50 bg-popover border rounded-xl shadow-xl py-1 min-w-[200px] max-h-60 overflow-y-auto">
                {adAccounts.map((acc: any) => (
                  <button key={acc.id} onClick={() => { setSelectedAccountId(acc.id); setAcctOpen(false) }}
                    className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between gap-2",
                      acc.id === selectedAccountId && "text-primary font-medium")}>
                    <span className="truncate">{acc.name}</span>
                    {acc.id === selectedAccountId && <IconCheck className="size-3.5 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative" ref={dateRef}>
            <button onClick={() => setDateOpen(v => !v)}
              className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border bg-background hover:bg-muted/50 transition-colors">
              <IconFilter className="size-3.5 text-muted-foreground" />{dateLabel}
              <IconChevronDown className="size-3.5 text-muted-foreground" />
            </button>
            {dateOpen && (
              <div className="absolute top-full right-0 mt-1 z-40 bg-popover border rounded-lg shadow-lg py-1 min-w-[160px]">
                {DATE_PRESETS.map(p => (
                  <button key={p.value} onClick={() => { setDatePreset(p.value); setDateOpen(false) }}
                    className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between",
                      datePreset === p.value && "text-primary font-medium")}>
                    {p.label}{datePreset === p.value && <span className="size-1.5 rounded-full bg-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button size="sm" variant="ghost" className="h-8" onClick={load} disabled={loading}>
            <IconRefresh className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
        {/* Platform tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-sm text-muted-foreground mr-2 font-medium">Platform:</span>
          {PLATFORMS.map(p => (
            <button key={p} onClick={() => setPlatform(p)}
              className={cn("h-8 px-3 text-sm rounded-lg border transition-colors flex items-center gap-1.5",
                platform === p ? "border-primary bg-primary/5 text-primary font-medium" : "border-border hover:bg-muted/50 text-muted-foreground")}>
              <span className="size-2 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[p] }} />
              {p}
            </button>
          ))}
        </div>

        {/* Ad account */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground font-medium">Ad Account:</span>
          <button className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border bg-background hover:bg-muted/50 transition-colors min-w-[160px]">
            <span className="text-muted-foreground/60">{selectedAccountId ? accountName : "Select ad account..."}</span>
            <IconChevronDown className="size-3.5 text-muted-foreground ml-auto" />
          </button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-7 gap-3">
          {/* Total */}
          <div className="rounded-xl border bg-card p-4 col-span-1">
            <p className="text-xs font-medium text-muted-foreground">Total Ads</p>
            <p className="text-3xl font-bold mt-1">{total}</p>
            <p className="text-xs text-muted-foreground mt-1">All platforms combined</p>
          </div>
          {/* Per platform */}
          {PLATFORMS.map(p => {
            const count = p === "Facebook" ? total : 0
            const pct   = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0"
            return (
              <div key={p} className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: PLATFORM_COLORS[p] }} />
                  <p className="text-xs font-medium">{p}</p>
                </div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground mt-1">{pct}% of total</p>
              </div>
            )
          })}
        </div>

        {/* Chart */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3 mb-4">
            <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg">Chart</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg text-muted-foreground">Table</Button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-48 gap-2 text-sm text-muted-foreground">
              <IconLoader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" name="Ads launched" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function ReportsView({ type }: { type: ReportSection }) {
  if (type === "vs-mode")      return <VSModeView />
  if (type === "admanage-ads") return <AdManageAdsView />
  return <StandardReportView type={type as Exclude<ReportSection, "vs-mode" | "admanage-ads">} />
}
