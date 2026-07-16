"use client"

import { useEffect, useMemo, useState } from "react"
import {
  IconChevronDown, IconDownload, IconHistory, IconLoader2, IconPlus, IconCalendar, IconAdjustments,
  IconSettings, IconX,
} from "@tabler/icons-react"
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts"
import { cn } from "@/lib/utils"
import {
  Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Level, ReportRow } from "./InsightDrawers"
import { AdsDateRangePicker } from "./AdsDateRangePicker"

type Tab = "trends" | "breakdowns"

const SERIES = ["#2a78d6", "#4b9cd3", "#5b0a66", "#2f9e44", "#e67700", "#9c36b5", "#0ca678", "#868e96"]
const GRID = "#e1e0d9"
const MUTED = "#898781"

type MetricItem = { key: string; label: string; fmt: (v: number) => string; desc: string }

const METRIC_GROUPS: { group: string; items: MetricItem[] }[] = [
  {
    group: "Performance",
    items: [
      { key: "spend", label: "Amount spent", fmt: v => fmt$(v), desc: "The total amount of money you spent on your campaigns, ad sets or ads during their lifetime." },
      { key: "impressions", label: "Impressions", fmt: fmtN, desc: "The number of times your ads were on screen." },
      { key: "reach", label: "Reach", fmt: fmtN, desc: "The number of people who saw your ads at least once." },
      { key: "frequency", label: "Frequency", fmt: v => fmt(v, 2), desc: "The average number of times each person saw your ad." },
      { key: "results", label: "Results", fmt: fmtN, desc: "The number of times your ad achieved an outcome, based on the objective and settings you selected." },
    ],
  },
  {
    group: "Conversions",
    items: [
      { key: "purchases", label: "Website purchases", fmt: fmtN, desc: "The number of purchase events tracked by the pixel or conversions API on your website and attributed to your ads." },
      { key: "costPerPurchase", label: "Per purchase", fmt: fmt$, desc: "The average cost of each website purchase." },
      { key: "roas", label: "Purchase ROAS", fmt: v => fmt(v, 2) + "x", desc: "Purchase return on ad spend (ROAS), calculated as purchase conversion value divided by total spend." },
      { key: "purchaseValue", label: "Purchases conversion value", fmt: fmt$, desc: "The total value of website purchase conversions attributed to your ads." },
      { key: "contentViews", label: "Content views", fmt: fmtN, desc: "The number of website content view events attributed to your ads." },
      { key: "addToCart", label: "Adds to cart", fmt: fmtN, desc: "The number of add to cart events attributed to your ads." },
      { key: "initiateCheckout", label: "Checkouts initiated", fmt: fmtN, desc: "The number of checkout initiated events attributed to your ads." },
    ],
  },
  {
    group: "Clicks",
    items: [
      { key: "linkClicks", label: "Link clicks", fmt: fmtN, desc: "The number of clicks on links within the ad that led to advertiser-specified destinations." },
      { key: "ctrAll", label: "CTR (all)", fmt: v => fmt(v, 2) + "%", desc: "The percentage of times people saw your ad and performed any click." },
      { key: "cpm", label: "CPM", fmt: fmt$, desc: "The average cost per 1,000 impressions." },
    ],
  },
  {
    group: "Video",
    items: [
      { key: "hookRate", label: "Hook rate", fmt: v => fmt(v, 2) + "%", desc: "The percentage of video views that lasted 3 seconds or more, measuring initial hook strength." },
      { key: "holdRate", label: "Hold rate", fmt: v => fmt(v, 2) + "%", desc: "The percentage of video views that lasted 15 seconds or more, measuring retention." },
      { key: "avgWatchTime", label: "Avg. watch time", fmt: fmtSec, desc: "The average watch time of your video ads." },
    ],
  },
]

const ALL_METRICS = METRIC_GROUPS.flatMap(g => g.items)
const metricItem = (k: string): MetricItem => ALL_METRICS.find(m => m.key === k) || { key: k, label: k, fmt: fmtN, desc: "" }
const metricLabel = (k: string) => metricItem(k).label
const metricFmt = (k: string) => metricItem(k).fmt
const metricDesc = (k: string) => metricItem(k).desc

const BREAKDOWN_OPTS = [
  { key: "age,gender", label: "Age and gender" },
  { key: "publisher_platform", label: "Platform" },
  { key: "platform_position", label: "Placement" },
  { key: "impression_device", label: "Impression device" },
  { key: "country", label: "Country" },
  { key: "media_type", label: "Media type" },
]

const STANDARD_ATTR = [
  { key: "1d_click", label: "1-day click" },
  { key: "7d_click", label: "7-day click" },
  { key: "28d_click", label: "28-day click" },
  { key: "1d_view", label: "1-day view" },
  { key: "1d_ev", label: "1-day engagement" },
]
const SKAN_ATTR = [
  { key: "skan_view", label: "View from SKAdNetwork" },
  { key: "skan_click", label: "Click from SKAdNetwork" },
]

const MAX_ROWS = 8
const MAX_ACTIVE_METRICS = 3

// ─── formatters ──────────────────────────────────────────────────────────────
function fmt(v: number, d = 2) {
  if (v == null || !Number.isFinite(v)) return "—"
  return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })
}
function fmt$(v: number) {
  if (v == null || !Number.isFinite(v) || v === 0) return "—"
  return "$" + fmt(v, 2)
}
function fmtN(v: number) {
  if (v == null || !Number.isFinite(v) || v === 0) return "—"
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M"
  if (v >= 1000) return (v / 1000).toFixed(1) + "K"
  return String(Math.round(v * 100) / 100)
}
function fmtSec(v: number) {
  if (v == null || !Number.isFinite(v) || v <= 0) return "—"
  const s = Math.round(v)
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `0:${String(r).padStart(2, "0")}`
}

function downloadCsv(filename: string, rows: { label: string; value: number | string }[]) {
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const csv = ["Label,Value", ...rows.map(r => `${esc(r.label)},${esc(r.value)}`)].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

interface Series { date: string; label: string; value: number }
interface BreakdownRow { label: string; [key: string]: any }

// KPI cards per level (Charts single-object)
function cardsForLevel(level: Level) {
  const base = [
    { key: "purchases", label: "Website purchases" },
    { key: "costPerPurchase", label: "Per purchase" },
  ]
  if (level === "campaign") return [...base, { key: "spend", label: "Amount spent" }]
  return [...base, { key: "roas", label: "Purchase ROAS" }] // adset + ad default
}

export function PerformancePopup({
  mode, level, accountId, rows, datePreset, since, until, onClose,
}: {
  mode: "charts" | "compare"
  level: Level
  accountId: string
  rows: ReportRow[]
  datePreset: string
  since: string
  until: string
  onClose: () => void
}) {
  const capped = rows.slice(0, MAX_ROWS)
  const overCap = rows.length > MAX_ROWS
  const isCompare = mode === "compare"

  // ── States ────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>("trends")
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day")

  const [attributionWindows, setAttributionWindows] = useState<string[]>([])
  const [calOpen, setCalOpen] = useState(false)
  const [attributionOpen, setAttributionOpen] = useState(false)
  const [sinceOverride, setSinceOverride] = useState(since)
  const [untilOverride, setUntilOverride] = useState(until)
  const [presetOverride, setPresetOverride] = useState(datePreset)

  // Charts mode active metric
  const [metric, setMetric] = useState("spend")
  const [activeCard, setActiveCard] = useState<string | null>(null)

  // Compare mode charts list
  const [compareCharts, setCompareCharts] = useState<string[]>(["spend"])
  const [compareBreakdown, setCompareBreakdown] = useState("age,gender")
  const [addChartOpen, setAddChartOpen] = useState(false)

  // Filters for Charts mode
  const [activityFilter, setActivityFilter] = useState("all")
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["spend", "purchases", "costPerPurchase"])
  const [prefBenchmark, setPrefBenchmark] = useState(true)
  const [prefSimilar, setPrefSimilar] = useState(true)
  const [customizeTab, setCustomizeTab] = useState<"metrics" | "preferences">("metrics")

  // Platform Section filters
  const [platMetric1, setPlatMetric1] = useState("reach")
  const [platMetric2, setPlatMetric2] = useState("results")
  const [deviceFilter, setDeviceFilter] = useState<"both" | "mobile" | "desktop">("both")

  // Data storage
  // Key: rowId + ":" + metric
  const [trendDataStore, setTrendDataStore] = useState<Record<string, Series[]>>({})
  const [breakdownDataStore, setBreakdownDataStore] = useState<Record<string, BreakdownRow[]>>({})

  const [metricsByRow, setMetricsByRow] = useState<Record<string, any>>({})
  const [creativeByRow, setCreativeByRow] = useState<Record<string, any>>({})
  const [videoByRow, setVideoByRow] = useState<Record<string, any>>({})
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Demographics + Platform sections
  const [demoRows, setDemoRows] = useState<BreakdownRow[]>([])
  const [platRows, setPlatRows] = useState<BreakdownRow[]>([])
  const [chartsSub, setChartsSub] = useState<"demographics" | "platform">("demographics")

  const qsBase = useMemo(() => {
    const p = new URLSearchParams({ adAccountId: accountId, level })
    if (sinceOverride && untilOverride) { p.set("since", sinceOverride); p.set("until", untilOverride) }
    else if (since && until) { p.set("since", since); p.set("until", until) }
    else p.set("datePreset", presetOverride === "custom" ? "last_30d" : presetOverride)
    if (attributionWindows.length > 0) p.set("action_attribution_windows", attributionWindows.join(","))
    return p
  }, [accountId, level, since, until, sinceOverride, untilOverride, presetOverride, attributionWindows])

  // Determine active metrics list based on mode
  const activeMetrics = useMemo(() => {
    return isCompare ? compareCharts : [metric]
  }, [isCompare, compareCharts, metric])

  // ── Fetch Trends (metric & row dependent) ──────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const load = async () => {
      // Find what needs to be loaded
      const queue: { row: ReportRow; metricKey: string }[] = []
      capped.forEach(row => {
        activeMetrics.forEach(m => {
          const cacheKey = `${row.id}:${m}`
          if (!trendDataStore[cacheKey]) {
            queue.push({ row, metricKey: m })
          }
        })
      })

      if (queue.length === 0) {
        setLoading(false)
        return
      }

      const results = await Promise.allSettled(queue.map(async item => {
        const res = await fetch(`/api/insights/report-trends?${qsBase}&id=${item.row.id}&metric=${item.metricKey}&granularity=${granularity}`)
        const d = await res.json()
        if (d.error) throw new Error(d.error)
        return { key: `${item.row.id}:${item.metricKey}`, series: (d.series || []) as Series[] }
      }))

      if (cancelled) return

      const nextTrend = { ...trendDataStore }
      const errs: Record<string, string> = {}
      results.forEach((r, idx) => {
        const q = queue[idx]
        if (r.status === "fulfilled") {
          nextTrend[r.value.key] = r.value.series
        } else {
          errs[q.row.id] = (r.reason as any)?.message || "Failed"
        }
      })

      setTrendDataStore(nextTrend)
      setErrors(errs)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [qsBase, activeMetrics.join(","), granularity, capped.map(r => r.id).join(",")])

  // ── Fetch KPI metrics (Charts mode initialization) ───────────────────────
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const results = await Promise.allSettled(capped.map(async row => {
        const res = await fetch(`/api/insights/report-object?${qsBase}&id=${row.id}`)
        const d = await res.json()
        if (d.error) throw new Error(d.error)
        return { row, metrics: d.metrics || {}, creative: d.creative || {}, video: d.video || {} }
      }))
      if (cancelled) return
      const nextM: Record<string, any> = {}
      const nextC: Record<string, any> = {}
      const nextV: Record<string, any> = {}
      results.forEach(r => {
        if (r.status === "fulfilled") {
          nextM[r.value.row.id] = r.value.metrics
          nextC[r.value.row.id] = r.value.creative
          nextV[r.value.row.id] = r.value.video
        }
      })
      setMetricsByRow(nextM)
      setCreativeByRow(nextC)
      setVideoByRow(nextV)
    }
    load()
    return () => { cancelled = true }
  }, [qsBase, capped.map(r => r.id).join(",")])

  // ── Fetch Breakdowns (Compare Breakdown mode) ─────────────────────────────
  useEffect(() => {
    if (!isCompare || tab !== "breakdowns") return
    let cancelled = false
    const load = async () => {
      const queue: { row: ReportRow; metricKey: string }[] = []
      capped.forEach(row => {
        compareCharts.forEach(m => {
          const cacheKey = `${row.id}:${m}:${compareBreakdown}`
          if (!breakdownDataStore[cacheKey]) {
            queue.push({ row, metricKey: m })
          }
        })
      })

      if (queue.length === 0) return

      const results = await Promise.allSettled(queue.map(async item => {
        const res = await fetch(`/api/insights/breakdown?${qsBase}&id=${item.row.id}&breakdown=${encodeURIComponent(compareBreakdown)}`)
        const d = await res.json()
        if (d.error) throw new Error(d.error)
        return { key: `${item.row.id}:${item.metricKey}:${compareBreakdown}`, rows: (d.rows || []) as BreakdownRow[] }
      }))

      if (cancelled) return

      const nextBreakdown = { ...breakdownDataStore }
      results.forEach((r, idx) => {
        if (r.status === "fulfilled") {
          nextBreakdown[r.value.key] = r.value.rows
        }
      })
      setBreakdownDataStore(nextBreakdown)
    }
    load()
    return () => { cancelled = true }
  }, [isCompare, tab, compareBreakdown, compareCharts.join(","), qsBase, capped.map(r => r.id).join(",")])

  // ── Activities for active card (single object only) ────────────────────────
  useEffect(() => {
    if (isCompare || capped.length !== 1) { setActivities([]); return }
    let cancelled = false
    const row = capped[0]
    const load = async () => {
      try {
        const res = await fetch(`/api/insights/activities?${qsBase}&id=${row.id}`)
        const d = await res.json()
        if (!cancelled) setActivities(d.events || [])
      } catch { if (!cancelled) setActivities([]) }
    }
    load()
    return () => { cancelled = true }
  }, [isCompare, qsBase, capped.map(r => r.id).join(",")])

  // ── Demographics + Platform load (Charts single object) ───────────────────
  useEffect(() => {
    if (isCompare || capped.length !== 1) return
    let cancelled = false
    const row = capped[0]
    const load = async () => {
      try {
        const [ageRes, platRes] = await Promise.all([
          fetch(`/api/insights/breakdown?${qsBase}&id=${row.id}&breakdown=age,gender`),
          fetch(`/api/insights/breakdown?${qsBase}&id=${row.id}&breakdown=publisher_platform,platform_position,impression_device`),
        ])
        const [age, plat] = await Promise.all([ageRes.json(), platRes.json()])
        if (cancelled) return
        setDemoRows(age.rows || [])
        setPlatRows(plat.rows || [])
      } catch { if (!cancelled) { setDemoRows([]); setPlatRows([]) } }
    }
    load()
    return () => { cancelled = true }
  }, [isCompare, qsBase, capped.map(r => r.id).join(",")])

  // ── Compute KPIs ──────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let spend = 0, purchases = 0, purchaseValue = 0
    Object.values(metricsByRow).forEach((m: any) => {
      spend += Number(m.spend) || 0
      purchases += Number(m.purchases) || 0
      purchaseValue += Number(m.purchaseValue) || 0
    })
    return {
      spend,
      purchases,
      costPerPurchase: purchases > 0 ? spend / purchases : 0,
      roas: spend > 0 ? purchaseValue / spend : 0,
    }
  }, [metricsByRow])

  // Get trend series data helper for a specific metric
  const getTrendDataForMetric = (mKey: string) => {
    const byDate: Record<string, any> = {}
    capped.forEach((row, i) => {
      const cacheKey = `${row.id}:${mKey}`
      const series = trendDataStore[cacheKey] || []
      series.forEach(p => {
        if (!byDate[p.date]) byDate[p.date] = { date: p.date, label: p.label }
        byDate[p.date][`row_${i}`] = p.value
      })
    })
    return Object.values(byDate).sort((a: any, b: any) => (a.date < b.date ? -1 : 1))
  }

  // Get breakdown data helper for a specific metric
  const getBreakdownDataForMetric = (mKey: string) => {
    const byLabel: Record<string, any> = {}
    capped.forEach((row, i) => {
      const cacheKey = `${row.id}:${mKey}:${compareBreakdown}`
      const rows = breakdownDataStore[cacheKey] || []
      rows.forEach(r => {
        const label = r.label || r.breakdownValue || "Unknown"
        if (!byLabel[label]) byLabel[label] = { label }
        byLabel[label][`row_${i}`] = Number(r[mKey] ?? r.spend ?? 0) || 0
      })
    })
    return Object.values(byLabel)
      .map((d: any) => ({ ...d, _total: capped.reduce((s, _, i) => s + (Number(d[`row_${i}`]) || 0), 0) }))
      .sort((a: any, b: any) => b._total - a._total)
      .slice(0, 10)
  }

  const demoBarData = useMemo(() => {
    return demoRows.map(r => ({
      label: r.label || r.breakdownValue || "Unknown",
      value: Number(r[metric] ?? r.spend ?? 0) || 0
    })).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [demoRows, metric])

  // Platform bar data: apply device type filters client-side
  const platBarData = useMemo(() => {
    // Group placement results
    const filtered = platRows.filter(r => {
      if (deviceFilter === "mobile") return String(r.impression_device || "").toLowerCase().includes("mobile")
      if (deviceFilter === "desktop") return String(r.impression_device || "").toLowerCase().includes("desktop")
      return true
    })

    // Aggregate by publisher_platform + platform_position
    const grouped: Record<string, { label: string; metric1Val: number; metric2Val: number }> = {}
    filtered.forEach(r => {
      const label = `${r.publisher_platform || "Unknown"} - ${r.platform_position || "Unknown"}`
      if (!grouped[label]) {
        grouped[label] = { label, metric1Val: 0, metric2Val: 0 }
      }
      grouped[label].metric1Val += Number(r[platMetric1] || 0)
      grouped[label].metric2Val += Number(r[platMetric2] || 0)
    })

    return Object.values(grouped)
      .map(g => ({
        label: g.label,
        metric1: g.metric1Val,
        metric2: g.metric2Val
      }))
      .sort((a, b) => b.metric1 + b.metric2 - (a.metric1 + a.metric2))
      .slice(0, 10)
  }, [platRows, platMetric1, platMetric2, deviceFilter])

  // Activities filtered by Activity History dropdown
  const filteredActivities = useMemo(() => {
    if (activityFilter === "all") return activities
    return activities.filter(e => {
      const type = String(e.type || "").toLowerCase()
      if (activityFilter === "budget") return type.includes("budget") || type.includes("bid")
      if (activityFilter === "status") return type.includes("status") || type.includes("pause") || type.includes("resume")
      return true
    })
  }, [activities, activityFilter])

  // Generate activities markers for Chart Mode Recharts line
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props
    // Check if there is an activity on this date
    const hasEvent = activities.some(e => {
      if (!e.time) return false
      const eDate = new Date(e.time).toISOString().split("T")[0]
      return eDate === payload.date
    })

    if (hasEvent) {
      return (
        <svg x={cx - 6} y={cy - 6} width="12" height="12" viewBox="0 0 24 24" className="cursor-pointer text-destructive fill-destructive">
          <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
        </svg>
      )
    }

    return null
  }

  const headerTitle = isCompare
    ? `Compare ${capped.length} ${level}${capped.length > 1 ? "s" : ""}`
    : `Charts · ${capped[0]?.name || ""}`

  const currentCards = cardsForLevel(level)

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPARE MODE — SIDEBAR DRAWER
  // ═══════════════════════════════════════════════════════════════════════════
  if (isCompare) {
    const availableToAdd = ALL_METRICS.filter(m => !compareCharts.includes(m.key))

    return (
      <TooltipProvider>
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl border-l bg-background shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Compare</p>
              <h2 className="font-semibold text-sm truncate" title={headerTitle}>{headerTitle}</h2>
            </div>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted/50 shrink-0">
              <IconX className="size-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
            {(["trends", "breakdowns"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn("h-8 px-3 text-sm rounded-lg capitalize transition-colors",
                  tab === t ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50")}>
                {t === "trends" ? "Trends" : "Breakdown"}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              {tab === "trends" ? (
                <select value={granularity} onChange={e => setGranularity(e.target.value as any)}
                  className="h-8 px-2 text-xs rounded-lg border bg-background">
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
              ) : (
                <select value={compareBreakdown} onChange={e => setCompareBreakdown(e.target.value)}
                  className="h-8 px-2 text-xs rounded-lg border bg-background max-w-[180px]">
                  {BREAKDOWN_OPTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Charts list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {overCap && (
              <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Showing first {MAX_ROWS} of {rows.length} items to keep Meta API requests safe.
              </div>
            )}

            {compareCharts.map((mKey, chartIdx) => {
              const data = tab === "trends"
                ? getTrendDataForMetric(mKey)
                : getBreakdownDataForMetric(mKey)
              const hasError = capped.some(r => errors[r.id])

              return (
                <div key={mKey + chartIdx} className="border rounded-xl p-3 bg-card">
                  {/* Chart header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm font-semibold cursor-help">{metricLabel(mKey)}</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">{metricDesc(mKey)}</TooltipContent>
                      </UITooltip>
                    </div>
                    {compareCharts.length > 1 && (
                      <button
                        onClick={() => setCompareCharts(prev => prev.filter((_, i) => i !== chartIdx))}
                        className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted/50 text-muted-foreground"
                        title="Remove chart"
                      >
                        <IconX className="size-3.5" />
                      </button>
                    )}
                  </div>

                                    {/* Compare Stat Cards */}
                  {data.length > 0 && tab === "trends" && (() => {
                    const allVals = data.flatMap(p => capped.map((_, i) => Number(p["row_" + i] || 0))).filter(v => v > 0)
                    const sum = allVals.reduce((a, b) => a + b, 0)
                    const mean = allVals.length ? sum / allVals.length : 0
                    const variance = allVals.length ? allVals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / allVals.length : 0
                    const stdDev = Math.sqrt(variance)
                    const volatility = mean > 0 ? (stdDev / mean) * 100 : 0
                    return (
                      <div className="flex items-center gap-3 mb-3">
                        <div className="border rounded px-2.5 py-1.5 bg-background">
                          <p className="text-[10px] text-muted-foreground uppercase">Sum / Avg</p>
                          <p className="text-sm font-semibold tabular-nums">{metricFmt(mKey)(mean)} <span className="text-[10px] font-normal text-muted-foreground ml-1">(avg)</span></p>
                        </div>
                        <div className="border rounded px-2.5 py-1.5 bg-background">
                          <div className="flex items-center gap-1"><p className="text-[10px] text-muted-foreground uppercase">Volatility</p></div>
                          <p className="text-sm font-semibold tabular-nums">{volatility.toFixed(1)}%</p>
                        </div>
                      </div>
                    )
                  })()}
                  
                  {/* Chart body */}
                  {hasError ? (
                    <div className="h-40 flex items-center justify-center text-xs text-destructive">
                      Failed to load chart data.
                    </div>
                  ) : data.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
                      No data available.
                    </div>
                  ) : tab === "trends" ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} />
                        <YAxis tick={{ fontSize: 10, fill: MUTED }} width={52} tickFormatter={v => metricFmt(mKey)(Number(v))} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any, name: any) => [metricFmt(mKey)(Number(v)), name]} />
                        {capped.length >= 2 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                        {capped.map((row, i) => (
                          <Line key={row.id} type="monotone" dataKey={`row_${i}`} name={row.name}
                            stroke={SERIES[i]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 24)}>
                      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: MUTED }} tickFormatter={v => metricFmt(mKey)(Number(v))} />
                        <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: MUTED }} width={120} interval={0} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any, name: any) => [metricFmt(mKey)(Number(v)), name]} />
                        {capped.length >= 2 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                        {capped.map((row, i) => (
                          <Bar key={row.id} dataKey={`row_${i}`} name={row.name}
                            fill={SERIES[i]} radius={[3, 3, 3, 3]} maxBarSize={18} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )
            })}

            {/* Add chart button */}
            <div className="relative">
              <button
                onClick={() => setAddChartOpen(o => !o)}
                disabled={availableToAdd.length === 0}
                className="w-full h-10 flex items-center justify-center gap-2 text-sm border border-dashed rounded-xl hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <IconPlus className="size-4" /> Add chart
              </button>
              {addChartOpen && availableToAdd.length > 0 && (
                <div className="absolute bottom-12 left-0 right-0 z-10 bg-background border rounded-xl shadow-xl max-h-72 overflow-y-auto">
                  {METRIC_GROUPS.map(g => (
                    <div key={g.group}>
                      <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground sticky top-0 bg-background">{g.group}</p>
                      {g.items.filter(m => availableToAdd.includes(m as any)).map(m => (
                        <button key={m.key}
                          onClick={() => {
                            setCompareCharts(prev => [...prev, m.key])
                            setAddChartOpen(false)
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between">
                          <span>{m.label}</span>
                          <IconPlus className="size-3.5 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </TooltipProvider>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHARTS MODE — LARGE POPUP (SINGLE OBJECT)
  // ═══════════════════════════════════════════════════════════════════════════
  const trendData = getTrendDataForMetric(metric)
  const spendTotal = totals.spend

  return (
    <TooltipProvider>
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-background rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Charts</p>
              <h2 className="font-semibold text-base truncate" title={headerTitle}>{headerTitle}</h2>
            </div>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted/50">
              <IconX className="size-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* KPI Cards (level-based) */}
            <div className="grid grid-cols-3 gap-3">
              {currentCards.map(c => {
                const value = totals[c.key as keyof typeof totals] ?? 0
                return (
                  <button key={c.key}
                    onClick={() => { setActiveCard(c.key); setMetric(c.key) }}
                    className={cn("text-left rounded-xl border p-3 hover:bg-muted/30 transition-colors",
                      activeCard === c.key ? "border-primary bg-primary/5" : "bg-card")}>
                    <div className="flex items-center gap-1 mb-1">
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[11px] text-muted-foreground cursor-help">{c.label}</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">{metricDesc(c.key)}</TooltipContent>
                      </UITooltip>
                    </div>
                    <p className="text-xl font-bold tabular-nums">{metricFmt(c.key)(value)}</p>
                  </button>
                )
              })}
            </div>

            {/* Filter Row */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Time filter */}
              <select value={granularity} onChange={e => setGranularity(e.target.value as any)}
                className="h-9 px-3 text-sm rounded-lg border bg-background">
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>

              {/* Activity History */}
              <select value={activityFilter} onChange={e => setActivityFilter(e.target.value)}
                className="h-9 px-3 text-sm rounded-lg border bg-background">
                <option value="all">All activity</option>
                <option value="budget">Budget/Bid changes</option>
                <option value="status">Status changes</option>
              </select>

              {/* Calendar / date range */}
              <div className="relative">
                <button
                  onClick={() => setCalOpen(o => !o)}
                  className="h-9 px-3 text-sm rounded-lg border bg-background flex items-center gap-1.5 hover:bg-muted/50"
                  title="Custom date range"
                >
                  <IconCalendar className="size-4" />
                  <span className="hidden sm:inline">{since && until ? `${since} → ${until}` : "Custom range"}</span>
                </button>
                {calOpen && (
                  <div className="absolute right-0 top-10 z-20 bg-background border rounded-xl shadow-xl p-3">
                    <AdsDateRangePicker
                      preset={since && until ? "custom" : (datePreset === "custom" ? "last_30d" : datePreset)}
                      onChange={(p, s, e) => {
                        if (p === "custom" && s && e) {
                          setSinceOverride(s.toISOString().split("T")[0])
                          setUntilOverride(e.toISOString().split("T")[0])
                        } else {
                          setSinceOverride(""); setUntilOverride("")
                          // preset handled by parent; map common presets to datePreset
                          setPresetOverride(p)
                        }
                        setCalOpen(false)
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Attribution settings */}
              <div className="relative ml-auto">
                <button onClick={() => setAttributionOpen(o => !o)}
                  className="h-9 px-3 text-sm rounded-lg border bg-background flex items-center gap-1.5 hover:bg-muted/50">
                  <IconAdjustments className="size-4" />
                  Attribution
                  <IconChevronDown className="size-3.5" />
                </button>
                {attributionOpen && (
                  <div className="absolute right-0 top-10 z-10 w-80 bg-background border rounded-xl shadow-xl">
                    <div className="p-3 border-b">
                      <p className="text-sm font-semibold">Compare attribution settings</p>
                      <p className="text-[11px] text-muted-foreground">Compare when and how people take action after engaging with your ads. Selections in this tool are for reporting only and do not change ad optimisation.</p>
                    </div>
                    <div className="p-3 max-h-80 overflow-y-auto space-y-3 text-sm">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Standard attribution</p>
                        {STANDARD_ATTR.map(a => (
                          <label key={a.key} className="flex items-center gap-2 py-1 cursor-pointer">
                            <input type="checkbox" checked={attributionWindows.includes(a.key)}
                              onChange={() => setAttributionWindows(prev => prev.includes(a.key) ? prev.filter(k => k !== a.key) : [...prev, a.key])} />
                            <span>{a.label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="pt-2 border-t">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Apple SKAdNetwork <span className="normal-case font-normal">(app ads only)</span></p>
                        {SKAN_ATTR.map(a => (
                          <label key={a.key} className="flex items-center gap-2 py-1">
                            <input type="checkbox" disabled />
                            <span className="opacity-60">{a.label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="pt-2 border-t">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Advanced option</p>
                        <label className="flex items-center gap-2 py-1">
                          <input type="checkbox" disabled />
                          <span className="opacity-60">Incremental attribution</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Customize */}
              <div className="relative">
                <button onClick={() => setCustomizeOpen(o => !o)}
                  className="h-9 px-3 text-sm rounded-lg border bg-background flex items-center gap-1.5 hover:bg-muted/50">
                  <IconSettings className="size-4" /> Customise
                  <IconChevronDown className="size-3.5" />
                </button>
                {customizeOpen && (
                  <div className="absolute right-0 top-10 z-10 w-72 bg-background border rounded-xl shadow-xl">
                    {/* Tabs */}
                    <div className="flex border-b">
                      {(["metrics", "preferences"] as const).map(t => (
                        <button key={t} onClick={() => setCustomizeTab(t)}
                          className={cn("flex-1 h-9 text-sm capitalize border-b-2",
                            customizeTab === t ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground")}>
                          {t}
                        </button>
                      ))}
                    </div>

                    {customizeTab === "metrics" ? (
                      <div className="p-3 max-h-80 overflow-y-auto">
                        <p className="text-[11px] text-muted-foreground mb-2">{selectedMetrics.length} of {MAX_ACTIVE_METRICS} metrics selected</p>
                        {METRIC_GROUPS.map(g => (
                          <div key={g.group} className="mb-2">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{g.group}</p>
                            {g.items.map(m => {
                              const checked = selectedMetrics.includes(m.key)
                              const disabled = !checked && selectedMetrics.length >= MAX_ACTIVE_METRICS
                              return (
                                <label key={m.key} className={cn("flex items-center gap-2 py-1 text-sm", disabled ? "opacity-50" : "cursor-pointer")}>
                                  <input type="checkbox" checked={checked} disabled={disabled}
                                    onChange={() => {
                                      setSelectedMetrics(prev =>
                                        checked ? prev.filter(k => k !== m.key) : [...prev, m.key]
                                      )
                                    }} />
                                  <span>{m.label}</span>
                                </label>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 space-y-3">
                        <label className="flex items-center justify-between text-sm">
                          <div>
                            <p>Your similar ad sets</p>
                            <p className="text-[11px] text-muted-foreground">Show benchmarks for similar ad sets</p>
                          </div>
                          <input type="checkbox" checked={prefSimilar} onChange={e => setPrefSimilar(e.target.checked)} />
                        </label>
                        <label className="flex items-center justify-between text-sm">
                          <div>
                            <p>Businesses like yours</p>
                            <p className="text-[11px] text-muted-foreground">Show benchmarks for similar businesses</p>
                          </div>
                          <input type="checkbox" checked={prefBenchmark} onChange={e => setPrefBenchmark(e.target.checked)} />
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Trendline chart with historical edit markers */}
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm font-semibold mb-3">{metricLabel(metric)} over time</p>
              {trendData.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">No trend data</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: MUTED }} />
                    <YAxis tick={{ fontSize: 11, fill: MUTED }} width={56} tickFormatter={v => metricFmt(metric)(Number(v))} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => [metricFmt(metric)(Number(v)), metricLabel(metric)]} />
                    <Line type="monotone" dataKey="row_0" name={capped[0]?.name}
                      stroke={SERIES[0]} strokeWidth={2} dot={<CustomDot />} activeDot={{ r: 5 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              )}

              {/* Historical edits panel */}
              {filteredActivities.length > 0 && (
                <div className="mt-3 border-t pt-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <IconHistory className="size-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium">Historical edits ({filteredActivities.length})</p>
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {filteredActivities.slice(0, 20).map((e, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px]">
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          {e.time ? new Date(e.time).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "2-digit" }) : ""}
                        </span>
                        <span className="text-foreground">{e.summary}{e.actor ? ` · ${e.actor}` : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Demographics + Platform sections */}
            <div className="border-t pt-5">
              {capped.length === 1 && metricsByRow[capped[0].id]?.isVideo && (
                <section className="rounded-xl border bg-card p-4 mb-5">
                  <p className="text-sm font-semibold mb-3">Video performance</p>

                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {[
                      { key: "videoPlays", label: "Video plays", link: "https://www.facebook.com/business/help/592054664510127" },
                      { key: "avgWatchTime", label: "Avg. play time", link: "https://www.facebook.com/business/help/1794520550789165" },
                      { key: "hookRate", label: "Hook rate", link: "https://www.facebook.com/business/help/1591938568393543" },
                      { key: "holdRate", label: "Hold rate", link: "https://www.facebook.com/business/help/1216404939613119" }
                    ].map(c => {
                      const v = videoByRow[capped[0].id]?.[c.key]
                      const isPct = c.key.includes("Rate")
                      const formatted = c.key === "avgWatchTime" ? fmtSec(v) : (isPct ? (v ? fmt(v, 2) + "%" : "—") : fmtN(v))
                      return (
                        <div key={c.key} className="border rounded-xl p-3 bg-background flex flex-col justify-between">
                          <a href={c.link} target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground hover:underline hover:text-primary mb-1 inline-flex w-fit">
                            {c.label}
                          </a>
                          <p className="text-xl font-bold tabular-nums">{formatted}</p>
                        </div>
                      )
                    })}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1 border rounded-lg bg-background p-2 aspect-[4/5] flex items-center justify-center bg-muted relative overflow-hidden group">
                      {creativeByRow[capped[0].id]?.thumbnail ? (
                        <>
                          <img src={creativeByRow[capped[0].id].thumbnail} alt="Video thumbnail" className="w-full h-full object-cover rounded" />
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            {creativeByRow[capped[0].id]?.videoId && (
                              <a href={`https://facebook.com/${creativeByRow[capped[0].id].videoId}`} target="_blank" rel="noopener noreferrer" className="bg-white/90 text-black px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-white transition-colors">
                                Play video
                              </a>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">No preview</span>
                      )}
                    </div>

                    <div className="col-span-2 flex flex-col justify-center">
                      <p className="text-sm font-semibold mb-1">Time watched</p>
                      <p className="text-[11px] text-muted-foreground mb-4">
                        Analyse your video performance by time watched to uncover creative optimisation opportunities. Though a decrease in video play time is normal as the video elapses, significant drops may indicate a lack of engagement.
                      </p>

                      <div className="h-40 w-full">
                        {videoByRow[capped[0].id]?.retention?.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={videoByRow[capped[0].id].retention} margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} tickFormatter={v => v + "%"} domain={[0, 100]} />
                              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => [fmt(Number(v), 1) + "%", "Retention"]} />
                              <Line type="monotone" dataKey="pct" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3, strokeWidth: 2 }} activeDot={{ r: 5 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-xs text-muted-foreground border rounded bg-background">No retention data</div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <div className="flex items-center gap-1 mb-3">
                {(["demographics", "platform"] as const).map(s => (
                  <button key={s} onClick={() => setChartsSub(s)}
                    className={cn("h-8 px-3 text-sm rounded-lg capitalize transition-colors",
                      chartsSub === s ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50")}>
                    {s === "demographics" ? "Demographics" : "Platform"}
                  </button>
                ))}
              </div>

              {chartsSub === "demographics" ? (
                <section className="rounded-xl border bg-card p-4">
                  <p className="text-sm font-semibold mb-3">Age and gender distribution · {metricLabel(metric)}</p>
                  {demoBarData.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No demographic data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(240, demoBarData.length * 24)}>
                      <BarChart data={demoBarData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: MUTED }} tickFormatter={v => metricFmt(metric)(Number(v))} />
                        <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: MUTED }} width={110} interval={0} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => [metricFmt(metric)(Number(v)), metricLabel(metric)]} />
                        <Bar dataKey="value" fill={SERIES[0]} radius={[3, 3, 3, 3]} maxBarSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </section>
              ) : (
                <section className="rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                    <p className="text-sm font-semibold">Placement per platform</p>
                    {/* Device filter */}
                    <select value={deviceFilter} onChange={e => setDeviceFilter(e.target.value as any)}
                      className="h-8 px-2 text-xs rounded-lg border bg-background">
                      <option value="both">Mobile and desktop</option>
                      <option value="mobile">Mobile</option>
                      <option value="desktop">Desktop</option>
                    </select>
                  </div>

                  {/* Dual metric filters */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <select value={platMetric1} onChange={e => setPlatMetric1(e.target.value)}
                      className="h-8 px-2 text-xs rounded-lg border bg-background">
                      <option value="reach">Reach</option>
                      <option value="impressions">Impressions</option>
                    </select>
                    <select value={platMetric2} onChange={e => setPlatMetric2(e.target.value)}
                      className="h-8 px-2 text-xs rounded-lg border bg-background">
                      <option value="results">Results</option>
                      <option value="spend">Amount spent</option>
                      <option value="purchases">Website purchases</option>
                    </select>
                  </div>

                  <p className="text-[11px] text-muted-foreground mb-3">
                    About placement results — Ad delivery is optimised to allocate your budget to the placements likely to perform best with your audience, based on your targeting and bid amount.
                  </p>

                  {platBarData.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No platform data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(240, platBarData.length * 34)}>
                      <BarChart data={platBarData} margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: MUTED }} interval={0} angle={-15} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 10, fill: MUTED }} tickFormatter={v => fmtN(Number(v))} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="metric1" name={metricLabel(platMetric1)} fill={SERIES[0]} radius={[3, 3, 0, 0]} maxBarSize={32} />
                        <Bar dataKey="metric2" name={metricLabel(platMetric2)} fill={SERIES[3]} radius={[3, 3, 0, 0]} maxBarSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </section>
              )}
            </div>

            {/* Download Reports Block */}
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold mb-1">See where your ads appeared</p>
                  <p className="text-[11px] text-muted-foreground">
                    Download delivery reports to see where your ads appeared. Reports show the last 30 days of available data for Audience Network, Facebook in-stream reels and Ads on Facebook Reels. Recent data may be delayed by a few days. Learn more
                  </p>
                </div>
                <button
                  onClick={() => {
                    const csvRows = platBarData.map(r => ({ label: r.label, value: `${metricLabel(platMetric1)}: ${r.metric1}, ${metricLabel(platMetric2)}: ${r.metric2}` }))
                    if (csvRows.length === 0) {
                      const demoRows = demoBarData.map(r => ({ label: r.label, value: r.value }))
                      downloadCsv("placement_report.csv", demoRows)
                    } else {
                      downloadCsv("placement_report.csv", csvRows)
                    }
                  }}
                  className="h-9 px-3 text-sm rounded-lg border bg-background flex items-center gap-1.5 hover:bg-muted/50 shrink-0"
                >
                  <IconDownload className="size-4" /> Download reports
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
