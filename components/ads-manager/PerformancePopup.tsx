"use client"

import { useEffect, useMemo, useState } from "react"
import { IconChevronDown, IconHistory, IconLoader2, IconX } from "@tabler/icons-react"
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts"
import { cn } from "@/lib/utils"
import type { Level, ReportRow } from "./InsightDrawers"

type Tab = "trends" | "breakdowns"

// Fixed categorical palette, max 8 series. Beyond that callers should cap rows.
const SERIES = ["#2a78d6", "#4b9cd3", "#5b0a66", "#2f9e44", "#e67700", "#9c36b5", "#0ca678", "#868e96"]
const GRID = "#e1e0d9"
const MUTED = "#898781"

const METRIC_GROUPS: { group: string; items: { key: string; label: string; fmt: (v: number) => string }[] }[] = [
  {
    group: "Performance",
    items: [
      { key: "spend", label: "Amount spent", fmt: v => fmt$(v) },
      { key: "impressions", label: "Impressions", fmt: fmtN },
      { key: "reach", label: "Reach", fmt: fmtN },
      { key: "frequency", label: "Frequency", fmt: v => fmt(v, 2) },
      { key: "results", label: "Results", fmt: fmtN },
    ],
  },
  {
    group: "Conversions",
    items: [
      { key: "purchases", label: "Website purchases", fmt: fmtN },
      { key: "costPerPurchase", label: "Cost per purchase", fmt: fmt$ },
      { key: "roas", label: "Purchase ROAS", fmt: v => fmt(v, 2) + "x" },
      { key: "purchaseValue", label: "Purchases conversion value", fmt: fmt$ },
      { key: "contentViews", label: "Content views", fmt: fmtN },
      { key: "addToCart", label: "Adds to cart", fmt: fmtN },
      { key: "initiateCheckout", label: "Checkouts initiated", fmt: fmtN },
    ],
  },
  {
    group: "Clicks",
    items: [
      { key: "linkClicks", label: "Link clicks", fmt: fmtN },
      { key: "ctrAll", label: "CTR (all)", fmt: v => fmt(v, 2) + "%" },
      { key: "cpm", label: "CPM", fmt: fmt$ },
    ],
  },
  {
    group: "Video",
    items: [
      { key: "hookRate", label: "Hook rate", fmt: v => fmt(v, 2) + "%" },
      { key: "holdRate", label: "Hold rate", fmt: v => fmt(v, 2) + "%" },
      { key: "avgWatchTime", label: "Avg. watch time", fmt: fmtSec },
    ],
  },
]

const ALL_METRICS = METRIC_GROUPS.flatMap(g => g.items)
const metricLabel = (k: string) => ALL_METRICS.find(m => m.key === k)?.label || k
const metricFmt = (k: string) => ALL_METRICS.find(m => m.key === k)?.fmt || (v => fmtN(v))

const BREAKDOWN_OPTS = [
  { key: "age,gender", label: "Age and gender" },
  { key: "publisher_platform", label: "Platform" },
  { key: "platform_position", label: "Placement" },
  { key: "impression_device", label: "Impression device" },
  { key: "country", label: "Country" },
  { key: "media_type", label: "Media type" },
]

const MAX_ROWS = 8

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

interface Series { date: string; label: string; value: number }
interface BreakdownRow { label: string; [key: string]: any }

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

  const [tab, setTab] = useState<Tab>("trends")
  const [metric, setMetric] = useState("spend")
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day")
  const [breakdown, setBreakdown] = useState("age,gender")
  const [metricMenuOpen, setMetricMenuOpen] = useState(false)
  const [activeCard, setActiveCard] = useState<string | null>(null) // metric key when a card is expanded

  const [trendByRow, setTrendByRow] = useState<Record<string, Series[]>>({})
  const [breakdownByRow, setBreakdownByRow] = useState<Record<string, BreakdownRow[]>>({})
  const [metricsByRow, setMetricsByRow] = useState<Record<string, any>>({})
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Charts-only: demographics (age,gender) + platform (placement) for the single object
  const [demoRows, setDemoRows] = useState<BreakdownRow[]>([])
  const [platRows, setPlatRows] = useState<BreakdownRow[]>([])
  const [chartsSub, setChartsSub] = useState<"demographics" | "platform">("demographics")

  const qsBase = useMemo(() => {
    const p = new URLSearchParams({ adAccountId: accountId, level })
    if (since && until) { p.set("since", since); p.set("until", until) }
    else p.set("datePreset", datePreset === "custom" ? "last_30d" : datePreset)
    return p
  }, [accountId, level, since, until, datePreset])

  // ── load trends for all rows (metric-dependent) ────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const load = async () => {
      const results = await Promise.allSettled(capped.map(async row => {
        const res = await fetch(`/api/insights/report-trends?${qsBase}&id=${row.id}&metric=${metric}&granularity=${granularity}`)
        const d = await res.json()
        if (d.error) throw new Error(d.error)
        return { row, series: (d.series || []) as Series[] }
      }))
      if (cancelled) return
      const next: Record<string, Series[]> = {}
      const errs: Record<string, string> = {}
      results.forEach(r => {
        if (r.status === "fulfilled") next[r.value.row.id] = r.value.series
        else { /* per-row error tracked via index */ }
      })
      capped.forEach((row, i) => {
        const r = results[i]
        if (r && r.status === "rejected") errs[row.id] = (r.reason as any)?.message || "Failed"
      })
      setTrendByRow(next)
      setErrors(errs)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [qsBase, metric, granularity, capped.map(r => r.id).join(",")])

  // ── load KPI metrics per row (once, then refresh with date change) ─────────
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const results = await Promise.allSettled(capped.map(async row => {
        const res = await fetch(`/api/insights/report-object?${qsBase}&id=${row.id}`)
        const d = await res.json()
        if (d.error) throw new Error(d.error)
        return { row, metrics: d.metrics || {} }
      }))
      if (cancelled) return
      const next: Record<string, any> = {}
      results.forEach(r => { if (r.status === "fulfilled") next[r.value.row.id] = r.value.metrics })
      setMetricsByRow(next)
    }
    load()
    return () => { cancelled = true }
  }, [qsBase, capped.map(r => r.id).join(",")])

  // ── load breakdowns for all rows (only when breakdown tab active) ──────────
  useEffect(() => {
    if (tab !== "breakdowns") return
    let cancelled = false
    const load = async () => {
      const results = await Promise.allSettled(capped.map(async row => {
        const res = await fetch(`/api/insights/breakdown?${qsBase}&id=${row.id}&breakdown=${encodeURIComponent(breakdown)}`)
        const d = await res.json()
        if (d.error) throw new Error(d.error)
        return { row, rows: (d.rows || []) as BreakdownRow[] }
      }))
      if (cancelled) return
      const next: Record<string, BreakdownRow[]> = {}
      results.forEach(r => { if (r.status === "fulfilled") next[r.value.row.id] = r.value.rows })
      setBreakdownByRow(next)
    }
    load()
    return () => { cancelled = true }
  }, [tab, breakdown, qsBase, capped.map(r => r.id).join(",")])

  // ── activities for active card (single object only for MVP) ────────────────
  useEffect(() => {
    if (!activeCard || capped.length !== 1) { setActivities([]); return }
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
  }, [activeCard, qsBase, capped.map(r => r.id).join(",")])

  // ── Charts mode: demographics + platform for the single object ─────────────
  useEffect(() => {
    if (isCompare || capped.length !== 1) return
    let cancelled = false
    const row = capped[0]
    const load = async () => {
      try {
        const [ageRes, platRes] = await Promise.all([
          fetch(`/api/insights/breakdown?${qsBase}&id=${row.id}&breakdown=age,gender`),
          fetch(`/api/insights/breakdown?${qsBase}&id=${row.id}&breakdown=publisher_platform,platform_position`),
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

  // ── aggregate KPI headline ─────────────────────────────────────────────────
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

  // ── merge trend series into one dataset per date ───────────────────────────
  const trendData = useMemo(() => {
    const byDate: Record<string, any> = {}
    capped.forEach((row, i) => {
      (trendByRow[row.id] || []).forEach(p => {
        if (!byDate[p.date]) byDate[p.date] = { date: p.date, label: p.label }
        byDate[p.date][`row_${i}`] = p.value
      })
    })
    return Object.values(byDate).sort((a: any, b: any) => (a.date < b.date ? -1 : 1))
  }, [trendByRow, capped.map(r => r.id).join(",")])

  // ── merge breakdown rows into grouped bar data ─────────────────────────────
  const breakdownData = useMemo(() => {
    const byLabel: Record<string, any> = {}
    capped.forEach((row, i) => {
      (breakdownByRow[row.id] || []).forEach(r => {
        const label = r.label || r.breakdownValue || "Unknown"
        if (!byLabel[label]) byLabel[label] = { label }
        byLabel[label][`row_${i}`] = Number(r[metric] ?? r.spend ?? 0) || 0
      })
    })
    // total per label across rows, sort desc, cap 8
    return Object.values(byLabel)
      .map((d: any) => ({ ...d, _total: capped.reduce((s, _, i) => s + (Number(d[`row_${i}`]) || 0), 0) }))
      .sort((a: any, b: any) => b._total - a._total)
      .slice(0, 8)
  }, [breakdownByRow, metric, capped.map(r => r.id).join(",")])

  // ── Charts sub-breakdowns (demo/platform) ──────────────────────────────────
  const demoBarData = useMemo(() => {
    return demoRows.map(r => ({
      label: r.label || r.breakdownValue || "Unknown",
      value: Number(r[metric] ?? r.spend ?? 0) || 0
    })).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [demoRows, metric])

  const platBarData = useMemo(() => {
    return platRows.map(r => ({
      label: r.label || r.breakdownValue || "Unknown",
      value: Number(r[metric] ?? r.spend ?? 0) || 0
    })).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [platRows, metric])

  const cards = [
    { key: "purchases", label: "Website purchases", value: fmtN(totals.purchases), desc: "Purchase events attributed to your ads" },
    { key: "costPerPurchase", label: "Per purchase", value: fmt$(totals.costPerPurchase), desc: "Average cost per website purchase" },
    { key: "roas", label: "Purchase ROAS", value: totals.roas ? totals.roas.toFixed(2) + "x" : "—", desc: "Purchases conversion value / spend" },
    { key: "spend", label: "Amount spent", value: fmt$(totals.spend), desc: "Total spent across selected items" },
  ]

  const headerTitle = isCompare
    ? `Compare ${capped.length} ${level}${capped.length > 1 ? "s" : ""}`
    : `Charts · ${capped[0]?.name || ""}`

  // ── Compare: narrow right sidebar, Amount spent only ───────────────────────
  if (isCompare) {
    const spendTotal = Object.values(metricsByRow).reduce((s, m: any) => s + (Number(m.spend) || 0), 0)
    return (
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l bg-background shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Compare · {level}</p>
            <h2 className="font-semibold text-sm truncate" title={headerTitle}>{headerTitle}</h2>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted/50 shrink-0">
            <IconX className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
          <select value={granularity} onChange={e => setGranularity(e.target.value as any)}
            className="h-8 px-2 text-xs rounded-lg border bg-background">
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
          {overCap && (
            <span className="text-[11px] text-amber-600">First {MAX_ROWS} of {rows.length}</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">Amount spent</p>
            <p className="text-2xl font-bold tabular-nums">{fmt$(spendTotal)}</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-2 text-sm text-muted-foreground">
              <IconLoader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} />
                  <YAxis tick={{ fontSize: 10, fill: MUTED }} width={52} tickFormatter={v => fmt$(Number(v))} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: any, name: any) => [fmt$(Number(v)), name]} />
                  {capped.map((row, i) => (
                    <Line key={row.id} type="monotone" dataKey={`row_${i}`} name={row.name}
                      stroke={SERIES[i]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5">
                {capped.map((row, i) => (
                  <div key={row.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="size-2.5 rounded-full shrink-0" style={{ background: SERIES[i] }} />
                      <span className="text-muted-foreground truncate" title={row.name}>{row.name}</span>
                    </div>
                    <span className="tabular-nums font-medium shrink-0">{fmt$(Number(metricsByRow[row.id]?.spend) || 0)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Charts: large popup ────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {isCompare ? "Compare" : "Performance overview"} · {level}
            </p>
            <h2 className="font-semibold text-base truncate" title={headerTitle}>{headerTitle}</h2>
          </div>
          <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted/50 shrink-0">
            <IconX className="size-5" />
          </button>
        </div>

        {/* KPI cards */}
        <div className="px-5 py-3 border-b shrink-0">
          <div className="grid grid-cols-4 gap-3">
            {cards.map(c => (
              <button key={c.key}
                onClick={() => {
                  setMetric(c.key)
                  setActiveCard(activeCard === c.key ? null : c.key)
                  setTab("trends")
                }}
                className={cn(
                  "text-left rounded-xl border p-3 transition-colors hover:bg-muted/30",
                  activeCard === c.key && "ring-2 ring-primary/40 bg-primary/5",
                )}
              >
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-xl font-bold tabular-nums mt-1">{c.value}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1 line-clamp-2">{c.desc}</p>
              </button>
            ))}
          </div>
          {overCap && (
            <p className="text-xs text-amber-600 mt-2">
              Showing first {MAX_ROWS} of {rows.length} selected items to keep Meta API requests safe.
            </p>
          )}
        </div>

        {/* controls row */}
        <div className="flex items-center gap-2 px-5 py-2 border-b shrink-0 flex-wrap">
          {/* tabs */}
          <div className="flex items-center gap-1">
            {(["trends", "breakdowns"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn("h-8 px-3 text-sm rounded-lg capitalize transition-colors",
                  tab === t ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50")}>
                {t}
              </button>
            ))}
          </div>
          <div className="h-5 w-px bg-border mx-1" />
          {/* metric dropdown */}
          <div className="relative">
            <button onClick={() => setMetricMenuOpen(o => !o)}
              className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border bg-background hover:bg-muted/50">
              {metricLabel(metric)} <IconChevronDown className="size-3.5 text-muted-foreground" />
            </button>
            {metricMenuOpen && (
              <div className="absolute top-full mt-1 left-0 z-40 bg-popover border rounded-lg shadow-lg py-1 min-w-[200px] max-h-72 overflow-y-auto">
                {METRIC_GROUPS.map(g => (
                  <div key={g.group}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-3 pt-2 pb-1">{g.group}</p>
                    {g.items.map(m => (
                      <button key={m.key}
                        onClick={() => { setMetric(m.key); setMetricMenuOpen(false) }}
                        className={cn("w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50",
                          metric === m.key && "bg-primary/10 text-primary font-medium")}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          {tab === "trends" ? (
            <select value={granularity} onChange={e => setGranularity(e.target.value as any)}
              className="h-8 px-2 text-xs rounded-lg border bg-background">
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          ) : (
            <select value={breakdown} onChange={e => setBreakdown(e.target.value)}
              className="h-8 px-2 text-xs rounded-lg border bg-background max-w-[200px]">
              {BREAKDOWN_OPTS.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
            </select>
          )}
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && tab === "trends" ? (
            <div className="flex items-center justify-center h-64 gap-2 text-sm text-muted-foreground">
              <IconLoader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : tab === "trends" ? (
            <>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} />
                  <YAxis tick={{ fontSize: 10, fill: MUTED }} width={56}
                    tickFormatter={v => metricFmt(metric)(Number(v))} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: any, name: any) => [metricFmt(metric)(Number(v)), name]} />
                  {capped.length >= 2 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                  {capped.map((row, i) => (
                    <Line key={row.id} type="monotone" dataKey={`row_${i}`}
                      name={row.name} stroke={SERIES[i]} strokeWidth={2}
                      dot={false} activeDot={{ r: 4 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>

              {/* legend list (names can be long) */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                {capped.map((row, i) => (
                  <div key={row.id} className="flex items-center gap-1.5 text-xs">
                    <span className="size-2.5 rounded-full" style={{ background: SERIES[i] }} />
                    <span className="text-muted-foreground truncate max-w-[180px]" title={row.name}>{row.name}</span>
                    {errors[row.id] && <span className="text-destructive">(error)</span>}
                  </div>
                ))}
              </div>

              {/* historical edits when a card is active (single object) */}
              {activeCard && capped.length === 1 && (
                <div className="mt-5 rounded-xl border bg-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <IconHistory className="size-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">Historical edits · {metricLabel(activeCard)}</p>
                  </div>
                  {activities.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No historical edits found for this date range.</p>
                  ) : (
                    <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                      {activities.map((e, i) => (
                        <li key={i} className="flex items-start gap-3 text-xs">
                          <span className="tabular-nums text-muted-foreground w-36 shrink-0">
                            {e.time ? new Date(e.time).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                          </span>
                          <span className="font-medium">{e.summary}</span>
                          {e.actor && <span className="text-muted-foreground">· {e.actor}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          ) : breakdownData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">No breakdown data</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(280, breakdownData.length * 44)}>
              {/* grouped horizontal bars, NOT stacked */}
              <BarChart data={breakdownData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: MUTED }}
                  tickFormatter={v => metricFmt(metric)(Number(v))} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: MUTED }} width={120}
                  interval={0} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: any, name: any) => [metricFmt(metric)(Number(v)), name]} />
                {capped.length >= 2 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                {capped.map((row, i) => (
                  <Bar key={row.id} dataKey={`row_${i}`} name={row.name} fill={SERIES[i]}
                    radius={[3, 3, 3, 3]} maxBarSize={28} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Charts single-object: Demographics + Platform */}
          {!isCompare && capped.length === 1 && (
            <div className="mt-6 border-t pt-5">
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
                  {demoRows.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No demographic data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(240, demoRows.length * 20)}>
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
                  <p className="text-sm font-semibold mb-3">Placement per platform · {metricLabel(metric)}</p>
                  {platRows.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No platform data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(240, platBarData.length * 34)}>
                      <BarChart data={platBarData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: MUTED }} tickFormatter={v => metricFmt(metric)(Number(v))} />
                        <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: MUTED }} width={150} interval={0} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => [metricFmt(metric)(Number(v)), metricLabel(metric)]} />
                        <Bar dataKey="value" fill={SERIES[0]} radius={[3, 3, 3, 3]} maxBarSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
