"use client"

/**
 * Ads Manager–style report: Campaigns / Ad sets / Ads table + Charts / Compare drawers.
 * Backend seams: /api/insights/report, report-trends, report-object, breakdown, ad-comments.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAdAccount } from "@/lib/ad-account-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  IconAlertCircle, IconChartBar, IconChevronDown, IconCopy, IconGitCompare,
  IconLoader2, IconMoodEmpty, IconPencil, IconPhoto, IconPlayerPlay,
  IconRefresh, IconX, IconCheck, IconMessageCircle,
} from "@tabler/icons-react"
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts"

// ─── Types ───────────────────────────────────────────────────────────────────

type Level = "campaign" | "adset" | "ad"
type SortDir = "asc" | "desc"
type DrawerMode = "charts" | "compare" | null
type CompareTab = "trends" | "breakdowns"

interface ReportRow {
  id: string
  name: string
  adId?: string | null
  adsetId?: string | null
  campaignId?: string | null
  adName?: string
  adsetName?: string
  campaignName?: string
  delivery?: string
  effectiveStatus?: string
  dateStart?: string
  dateStop?: string
  attributionSetting?: string | null
  budget?: number | null
  budgetType?: string | null
  bid?: number | null
  bidType?: string | null
  startsAt?: string | null
  endsAt?: string | null
  spend: number
  roas: number
  purchaseValue: number
  impressions: number
  frequency: number
  cpm: number
  costPerUniqueClick: number
  uniqueLinkCtr: number
  ctrAll: number
  ctr: number
  costPerLinkClick: number
  uniqueLinkClicks: number
  uniqueClicks: number
  landingPageViews: number
  landingPageViewRate: number
  contentViews: number
  addToCart: number
  costPerAddToCart: number
  initiateCheckout: number
  costPerInitiateCheckout: number
  purchases: number
  costPerPurchase: number
  avgWatchTime: number
  thumbnail?: string | null
  isVideo?: boolean
  [key: string]: any
}

interface MetricCol {
  key: string
  label: string
  fmt: (v: any, row?: ReportRow) => string
  numeric?: boolean
  higherIsBetter?: boolean
}

// ─── Formatters ──────────────────────────────────────────────────────────────

const SERIES_1 = "#2a78d6"
const GRID = "#e1e0d9"
const MUTED = "#898781"

const fmt$ = (v: number, d = 2) =>
  v == null || !Number.isFinite(v) || v === 0
    ? "—"
    : "$" + v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtN = (v: number) => {
  if (v == null || !Number.isFinite(v) || v === 0) return "—"
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M"
  if (v >= 1000) return (v / 1000).toFixed(1) + "K"
  return String(Math.round(v * 100) / 100)
}
const fmtPct = (v: number) => (v == null || !Number.isFinite(v) || v === 0 ? "—" : v.toFixed(2) + "%")
const fmtX = (v: number) => (v == null || !Number.isFinite(v) || v === 0 ? "—" : v.toFixed(2) + "x")
const fmtSec = (v: number) => {
  if (v == null || !Number.isFinite(v) || v <= 0) return "—"
  const s = Math.round(v)
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `0:${String(r).padStart(2, "0")}`
}
const fmtDate = (v?: string | null) => {
  if (!v) return "—"
  const d = new Date(v)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
const fmtEnds = (v?: string | null) => (v ? fmtDate(v) : "Ongoing")
const fmtPending = () => "—"
const fmtText = (v: any) => (v == null || v === "" ? "—" : String(v))
const fmtBudget = (v: any, row?: ReportRow) => {
  if (row?.budgetType === "Using campaign budget") return "Using campaign budget"
  if (v == null || !Number.isFinite(Number(v)) || Number(v) === 0) return "—"
  return fmt$(Number(v), 2)
}

// ─── Column presets ──────────────────────────────────────────────────────────

const LEVEL_TABS: { key: Level; label: string }[] = [
  { key: "campaign", label: "Campaigns" },
  { key: "adset", label: "Ad sets" },
  { key: "ad", label: "Ads" },
]

const DATE_PRESETS = [
  { label: "Last 7 days", value: "last_7d" },
  { label: "Last 30 days", value: "last_30d" },
  { label: "Last 90 days", value: "last_90d" },
  { label: "This month", value: "this_month" },
  { label: "Last month", value: "last_month" },
  { label: "Custom", value: "custom" },
]

const TREND_METRICS = [
  { key: "spend", label: "Amount spent" },
  { key: "purchases", label: "Purchases" },
  { key: "costPerPurchase", label: "Cost per purchase" },
  { key: "roas", label: "Purchase ROAS" },
  { key: "impressions", label: "Impressions" },
  { key: "hookRate", label: "Hook Rate" },
  { key: "avgWatchTime", label: "Avg. watch time" },
  { key: "ctrAll", label: "CTR (all)" },
  { key: "cpm", label: "CPM" },
]

const BREAKDOWN_OPTS = [
  { key: "age", label: "Age" },
  { key: "gender", label: "Gender" },
  { key: "age,gender", label: "Age and gender" },
  { key: "publisher_platform", label: "Platform" },
  { key: "platform_position", label: "Placement" },
  { key: "impression_device", label: "Impression device" },
  { key: "publisher_platform,impression_device", label: "Platform and device" },
  { key: "platform_position,impression_device", label: "Placement and device" },
  { key: "country", label: "Country" },
  { key: "region", label: "Region" },
  { key: "media_type", label: "Media type" },
]

/** ECOM column set matching CSV export. Custom derived metrics stay pending (—). */
function ecomColumns(level: Level): MetricCol[] {
  const nameLabel = level === "campaign" ? "Campaign name" : level === "adset" ? "Ad set name" : "Ad name"
  const cols: MetricCol[] = [
    { key: "dateStart", label: "Reporting starts", fmt: v => fmtDate(v) },
    { key: "dateStop", label: "Reporting ends", fmt: v => fmtDate(v) },
    { key: "name", label: nameLabel, fmt: fmtText },
    { key: "delivery", label: level === "campaign" ? "Campaign delivery" : level === "adset" ? "Ad set delivery" : "Ad delivery", fmt: fmtText },
  ]
  if (level === "adset" || level === "ad") {
    cols.push(
      { key: "startsAt", label: "Starts", fmt: v => fmtDate(v) },
      { key: "endsAt", label: "Ends", fmt: v => fmtEnds(v) },
    )
  }
  cols.push(
    { key: "attributionSetting", label: "Attribution setting", fmt: fmtText },
  )
  if (level === "adset" || level === "ad") {
    cols.push(
      { key: "bid", label: "Bid", fmt: v => fmt$(Number(v) || 0), numeric: true, higherIsBetter: false },
      { key: "bidType", label: "Bid type", fmt: fmtText },
      { key: "budget", label: "Ad set budget", fmt: (v, r) => fmtBudget(v, r), numeric: true },
      { key: "budgetType", label: "Ad set budget type", fmt: fmtText },
    )
  } else {
    cols.push(
      { key: "budget", label: "Budget", fmt: (v, r) => fmtBudget(v, r), numeric: true },
      { key: "budgetType", label: "Budget type", fmt: fmtText },
    )
  }
  cols.push(
    { key: "spend", label: "Amount spent (USD)", fmt: v => fmt$(Number(v) || 0), numeric: true, higherIsBetter: true },
    { key: "roas", label: "Purchase ROAS", fmt: v => fmtX(Number(v) || 0), numeric: true, higherIsBetter: true },
    { key: "purchaseValue", label: "Purchases conversion value", fmt: v => fmt$(Number(v) || 0), numeric: true, higherIsBetter: true },
    { key: "impressions", label: "Impressions", fmt: v => fmtN(Number(v) || 0), numeric: true, higherIsBetter: true },
    { key: "frequency", label: "Frequency", fmt: v => (Number(v) > 0 ? Number(v).toFixed(2) : "—"), numeric: true, higherIsBetter: false },
    { key: "cpm", label: "CPM (USD)", fmt: v => fmt$(Number(v) || 0), numeric: true, higherIsBetter: false },
    { key: "costPerUniqueClick", label: "Cost per unique click (all)", fmt: v => fmt$(Number(v) || 0), numeric: true, higherIsBetter: false },
    { key: "uniqueLinkCtr", label: "Unique CTR (link)", fmt: v => fmtPct(Number(v) || 0), numeric: true, higherIsBetter: true },
    { key: "ctrAll", label: "CTR (all)", fmt: v => fmtPct(Number(v) || 0), numeric: true, higherIsBetter: true },
    { key: "costPerLinkClick", label: "CPC (cost per link click)", fmt: v => fmt$(Number(v) || 0), numeric: true, higherIsBetter: false },
    { key: "uniqueLinkClicks", label: "Unique link clicks", fmt: v => fmtN(Number(v) || 0), numeric: true, higherIsBetter: true },
    { key: "landingPageViewRate", label: "LPV rate per link clicks", fmt: v => fmtPct(Number(v) || 0), numeric: true, higherIsBetter: true },
    { key: "contentViews", label: "Content views", fmt: v => fmtN(Number(v) || 0), numeric: true, higherIsBetter: true },
    { key: "customMetric2550031502084451", label: "Custom metric …4451", fmt: fmtPending },
    { key: "addToCart", label: "Adds to cart", fmt: v => fmtN(Number(v) || 0), numeric: true, higherIsBetter: true },
    { key: "costPerAddToCart", label: "Cost per add to cart", fmt: v => fmt$(Number(v) || 0), numeric: true, higherIsBetter: false },
    { key: "customMetric2550032458751022", label: "Custom metric …1022", fmt: fmtPending },
    { key: "initiateCheckout", label: "Checkouts initiated", fmt: v => fmtN(Number(v) || 0), numeric: true, higherIsBetter: true },
    { key: "costPerInitiateCheckout", label: "Cost per checkout initiated", fmt: v => fmt$(Number(v) || 0), numeric: true, higherIsBetter: false },
    { key: "customMetric2550038808750387", label: "Custom metric …0387", fmt: fmtPending },
    { key: "purchases", label: "Purchases", fmt: v => fmtN(Number(v) || 0), numeric: true, higherIsBetter: true },
    { key: "customMetric2550035778750690", label: "Custom metric …0690", fmt: fmtPending },
    { key: "costPerPurchase", label: "Cost per purchase", fmt: v => fmt$(Number(v) || 0), numeric: true, higherIsBetter: false },
    { key: "customMetric2394794560941480", label: "Custom metric …1480", fmt: fmtPending },
    { key: "avgWatchTime", label: "Video average play time", fmt: v => fmtSec(Number(v) || 0), numeric: true, higherIsBetter: true },
  )
  if (level === "ad") {
    // Parent context columns after name is already present
    cols.splice(3, 0,
      { key: "campaignName", label: "Campaign name", fmt: fmtText },
      { key: "adsetName", label: "Ad set name", fmt: fmtText },
    )
  }
  if (level === "adset") {
    cols.splice(3, 0, { key: "campaignName", label: "Campaign name", fmt: fmtText })
  }
  return cols
}

// ─── Small UI bits ───────────────────────────────────────────────────────────

function Drop({
  open, onToggle, label, children, align = "left",
}: {
  open: boolean; onToggle: () => void; label: React.ReactNode
  children: React.ReactNode; align?: "left" | "right"
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle()
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open, onToggle])
  return (
    <div className="relative" ref={ref}>
      <button onClick={onToggle}
        className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border bg-background hover:bg-muted/50 transition-colors">
        {label}
        <IconChevronDown className="size-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className={cn(
          "absolute top-full mt-1 z-40 bg-popover border rounded-lg shadow-lg py-1 min-w-[180px] max-h-72 overflow-y-auto",
          align === "right" ? "right-0" : "left-0",
        )}>
          {children}
        </div>
      )}
    </div>
  )
}

function StatusPill({ delivery }: { delivery?: string }) {
  const d = (delivery || "").toLowerCase()
  const tone =
    d.includes("active") ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" :
    d.includes("paused") ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" :
    d.includes("archived") || d.includes("rejected") ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300" :
    "bg-muted text-muted-foreground"
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", tone)}>
      {delivery || "—"}
    </span>
  )
}

// ─── Drawers ─────────────────────────────────────────────────────────────────

function ChartsDrawer({
  row, level, accountId, datePreset, since, until, onClose,
}: {
  row: ReportRow; level: Level; accountId: string
  datePreset: string; since: string; until: string; onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [detail, setDetail] = useState<any>(null)
  const [trend, setTrend] = useState<{ date: string; value: number; label: string }[]>([])
  const [demo, setDemo] = useState<any[]>([])
  const [platform, setPlatform] = useState<any[]>([])
  const [comments, setComments] = useState<any>(null)
  const [metric, setMetric] = useState("spend")

  const dateQs = useMemo(() => {
    const p = new URLSearchParams({ adAccountId: accountId, level, id: row.id })
    if (since && until) { p.set("since", since); p.set("until", until) }
    else p.set("datePreset", datePreset === "custom" ? "last_30d" : datePreset)
    return p
  }, [accountId, level, row.id, datePreset, since, until])

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError("")
    const load = async () => {
      try {
        const [objRes, trendRes, ageRes, platRes] = await Promise.all([
          fetch(`/api/insights/report-object?${dateQs}`),
          fetch(`/api/insights/report-trends?${dateQs}&metric=${metric}&granularity=day`),
          fetch(`/api/insights/breakdown?${dateQs}&breakdown=age,gender`),
          fetch(`/api/insights/breakdown?${dateQs}&breakdown=publisher_platform`),
        ])
        const [obj, tr, age, plat] = await Promise.all([objRes.json(), trendRes.json(), ageRes.json(), platRes.json()])
        if (cancelled) return
        if (obj.error) { setError(obj.error); return }
        setDetail(obj)
        setTrend(tr.series || [])
        setDemo((age.rows || []).slice(0, 8))
        setPlatform((plat.rows || []).slice(0, 8))
        if (level === "ad" && (row.adId || row.id)) {
          const cRes = await fetch(`/api/insights/ad-comments?adId=${encodeURIComponent(row.adId || row.id)}`)
          const c = await cRes.json()
          if (!cancelled) setComments(c)
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to load")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [dateQs, metric, level, row.adId, row.id])

  const m = detail?.metrics || row
  const video = detail?.video
  const creative = detail?.creative

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl border-l bg-background shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Charts · {level}</p>
          <h2 className="font-semibold text-sm truncate" title={row.name}>{row.name}</h2>
        </div>
        <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted/50">
          <IconX className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-sm text-muted-foreground">
            <IconLoader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Purchases", value: fmtN(m.purchases) },
                { label: "Per purchase", value: fmt$(m.costPerPurchase) },
                { label: "Spend", value: fmt$(m.spend) },
                { label: "ROAS", value: fmtX(m.roas) },
              ].map(k => (
                <div key={k.label} className="rounded-xl border bg-card p-3">
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-base font-bold tabular-nums mt-0.5">{k.value}</p>
                </div>
              ))}
            </div>

            {/* Performance overview */}
            <section className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">Performance overview</p>
                <select value={metric} onChange={e => setMetric(e.target.value)}
                  className="h-7 px-2 text-xs rounded-lg border bg-background">
                  {TREND_METRICS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              {trend.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No trend data</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} />
                    <YAxis tick={{ fontSize: 10, fill: MUTED }} width={48} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="value" stroke={SERIES_1} strokeWidth={2} dot={false}
                      activeDot={{ r: 4 }} name={TREND_METRICS.find(t => t.key === metric)?.label || metric} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </section>

            {/* Breakdowns */}
            <div className="grid grid-cols-2 gap-3">
              <BreakdownMini title="Demographics" rows={demo} />
              <BreakdownMini title="Platform" rows={platform} />
            </div>

            {/* Ad-only: preview + comments + video */}
            {level === "ad" && (
              <>
                <section className="rounded-xl border bg-card p-4">
                  <p className="text-sm font-semibold mb-3">Ad preview</p>
                  {creative ? (
                    <div className="flex gap-3">
                      <div className="w-24 h-32 rounded-lg bg-muted overflow-hidden shrink-0">
                        {creative.thumbnail || creative.imageUrl
                          ? <img src={creative.thumbnail || creative.imageUrl} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center">
                              {creative.mediaType === "video"
                                ? <IconPlayerPlay className="size-6 text-muted-foreground/40" />
                                : <IconPhoto className="size-6 text-muted-foreground/40" />}
                            </div>}
                      </div>
                      <div className="min-w-0 space-y-1.5 text-xs">
                        <p className="font-medium line-clamp-3">{creative.primaryText || "—"}</p>
                        <p className="text-muted-foreground">{creative.headline || "—"}</p>
                        <p className="text-muted-foreground">CTA: {creative.callToAction || "—"}</p>
                        {creative.landingPageUrl && (
                          <a href={creative.landingPageUrl} target="_blank" rel="noreferrer"
                            className="text-primary hover:underline break-all line-clamp-1">{creative.landingPageUrl}</a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Preview unavailable (dark post or missing creative).</p>
                  )}
                </section>

                <section className="rounded-xl border bg-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <IconMessageCircle className="size-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">Comments by channel</p>
                  </div>
                  {!comments ? (
                    <p className="text-xs text-muted-foreground">Loading comments…</p>
                  ) : !comments.resolved ? (
                    <p className="text-xs text-muted-foreground">{comments.message || "Comments unavailable for this ad."}</p>
                  ) : (comments.channels || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No comments synced yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {comments.channels.map((ch: any) => (
                        <div key={ch.pageId}>
                          <p className="text-xs font-medium mb-1.5">{ch.pageName} · {(ch.comments || []).length}</p>
                          <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                            {(ch.comments || []).slice(0, 20).map((c: any) => (
                              <li key={c.id || c.fb_comment_id} className="text-xs border rounded-lg p-2">
                                <p className="font-medium">{c.from_name || "User"}</p>
                                <p className="text-muted-foreground line-clamp-2">{c.message}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {video && (
                  <section className="rounded-xl border bg-card p-4 space-y-3">
                    <p className="text-sm font-semibold">Video performance</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Video plays", value: fmtN(video.videoPlays) },
                        { label: "Avg play time", value: fmtSec(video.avgWatchTime) },
                        { label: "Hook rate", value: fmtPct(video.hookRate) },
                        { label: "Hold rate", value: fmtPct(video.holdRate) },
                      ].map(k => (
                        <div key={k.label} className="rounded-lg border p-2">
                          <p className="text-xs text-muted-foreground">{k.label}</p>
                          <p className="text-sm font-bold tabular-nums">{k.value}</p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Audience retention
                        {video.retentionSource === "quartile_estimate" ? " (quartile estimate)" : ""}
                      </p>
                      {(video.retention || []).length === 0 ? (
                        <p className="text-xs text-muted-foreground py-4 text-center">No retention data</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={160}>
                          <LineChart data={video.retention} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: MUTED }} width={36}
                              tickFormatter={v => `${v}%`} />
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
                              formatter={(v: any) => [`${Number(v).toFixed(1)}%`, "Retention"]} />
                            <Line type="monotone" dataKey="pct" stroke={SERIES_1} strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function BreakdownMini({ title, rows }: { title: string; rows: any[] }) {
  const max = Math.max(...rows.map(r => r.spend || 0), 1)
  return (
    <section className="rounded-xl border bg-card p-3">
      <p className="text-xs font-semibold mb-2">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No data</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={i} className="text-xs">
              <div className="flex justify-between mb-0.5 gap-2">
                <span className="truncate text-muted-foreground">{r.label || r.breakdownValue}</span>
                <span className="tabular-nums font-medium shrink-0">{fmt$(r.spend)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${((r.spend || 0) / max) * 100}%`, background: SERIES_1 }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function CompareDrawer({
  row, level, accountId, datePreset, since, until, onClose,
}: {
  row: ReportRow; level: Level; accountId: string
  datePreset: string; since: string; until: string; onClose: () => void
}) {
  const [tab, setTab] = useState<CompareTab>("trends")
  const [metric, setMetric] = useState("spend")
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day")
  const [breakdown, setBreakdown] = useState("age")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [series, setSeries] = useState<{ date: string; value: number; label: string }[]>([])
  const [rows, setRows] = useState<any[]>([])

  const baseQs = useMemo(() => {
    const p = new URLSearchParams({ adAccountId: accountId, level, id: row.id })
    if (since && until) { p.set("since", since); p.set("until", until) }
    else p.set("datePreset", datePreset === "custom" ? "last_30d" : datePreset)
    return p
  }, [accountId, level, row.id, datePreset, since, until])

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError("")
    const run = async () => {
      try {
        if (tab === "trends") {
          const res = await fetch(`/api/insights/report-trends?${baseQs}&metric=${metric}&granularity=${granularity}`)
          const d = await res.json()
          if (cancelled) return
          if (d.error) { setError(d.error); return }
          setSeries(d.series || [])
        } else {
          const res = await fetch(`/api/insights/breakdown?${baseQs}&breakdown=${encodeURIComponent(breakdown)}`)
          const d = await res.json()
          if (cancelled) return
          if (d.error) { setError(d.error); return }
          setRows(d.rows || [])
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [tab, metric, granularity, breakdown, baseQs])

  const maxSpend = Math.max(...rows.map(r => Number(r[metric] ?? r.spend ?? 0) || 0), 1)

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl border-l bg-background shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Compare · 1 {level}</p>
          <h2 className="font-semibold text-sm truncate" title={row.name}>{row.name}</h2>
        </div>
        <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted/50">
          <IconX className="size-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 px-4 py-2 border-b shrink-0">
        {(["trends", "breakdowns"] as CompareTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("h-8 px-3 text-sm rounded-lg capitalize transition-colors",
              tab === t ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50")}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0 flex-wrap">
        <select value={metric} onChange={e => setMetric(e.target.value)}
          className="h-8 px-2 text-xs rounded-lg border bg-background">
          {TREND_METRICS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
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

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-sm text-muted-foreground">
            <IconLoader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
        ) : tab === "trends" ? (
          series.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No trend data</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} />
                <YAxis tick={{ fontSize: 10, fill: MUTED }} width={52} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="value" stroke={SERIES_1} strokeWidth={2} dot={false}
                  activeDot={{ r: 4 }}
                  name={TREND_METRICS.find(t => t.key === metric)?.label || metric} />
              </LineChart>
            </ResponsiveContainer>
          )
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No breakdown data</p>
        ) : (
          <div className="space-y-2">
            {rows.slice(0, 25).map((r, i) => {
              const val = Number(r[metric] ?? r.spend ?? 0) || 0
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-36 truncate shrink-0" title={r.label}>{r.label}</span>
                  <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                    <div className="h-full rounded" style={{
                      width: `${(val / maxSpend) * 100}%`,
                      background: SERIES_1,
                      minWidth: val > 0 ? 2 : 0,
                    }} />
                  </div>
                  <span className="text-xs font-medium tabular-nums w-16 text-right shrink-0">
                    {metric.includes("Rate") || metric === "roas" || metric === "ctrAll" || metric === "hookRate" || metric === "holdRate"
                      ? (metric === "roas" ? fmtX(val) : fmtPct(val))
                      : metric.includes("cost") || metric === "spend" || metric === "cpm" || metric === "costPerPurchase"
                        ? fmt$(val)
                        : fmtN(val)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main view ───────────────────────────────────────────────────────────────

export function AdsManagerReportView() {
  const { selectedAccountId, adAccounts, setSelectedAccountId } = useAdAccount()

  const [level, setLevel] = useState<Level>("campaign")
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fromSnapshot, setFromSnapshot] = useState(false)
  const [loadTime, setLoadTime] = useState<number | null>(null)

  const [datePreset, setDatePreset] = useState("last_30d")
  const [since, setSince] = useState("")
  const [until, setUntil] = useState("")
  const [dateOpen, setDateOpen] = useState(false)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState("spend")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const [drawer, setDrawer] = useState<DrawerMode>(null)
  const [focusRow, setFocusRow] = useState<ReportRow | null>(null)

  const [acctOpen, setAcctOpen] = useState(false)
  const acctRef = useRef<HTMLDivElement>(null)
  const headerCbRef = useRef<HTMLInputElement>(null)

  const accountName = adAccounts?.find((a: any) => a.id === selectedAccountId)?.name || selectedAccountId || "—"
  const cols = useMemo(() => ecomColumns(level), [level])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (acctRef.current && !acctRef.current.contains(e.target as Node)) setAcctOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const load = useCallback(() => {
    if (!selectedAccountId) return
    setLoading(true); setError(""); setSelected(new Set()); setDrawer(null); setFocusRow(null)
    const t0 = performance.now()
    const params = new URLSearchParams({
      adAccountId: selectedAccountId,
      level,
      limit: "50",
    })
    if (datePreset === "custom" && since && until) {
      params.set("since", since)
      params.set("until", until)
    } else {
      params.set("datePreset", datePreset === "custom" ? "last_30d" : datePreset)
    }
    fetch(`/api/insights/report?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        const list: ReportRow[] = (d.ads || []).map((a: any, i: number) => ({
          ...a,
          id: a.id || a.adId || a.adsetId || a.campaignId || `row-${i}`,
          name: a.name || a.adName || a.adsetName || a.campaignName || "—",
        }))
        setRows(list)
        setFromSnapshot(!!d.fromSnapshot)
        setLoadTime(Math.round((performance.now() - t0) / 100) / 10)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [selectedAccountId, level, datePreset, since, until])

  useEffect(() => { load() }, [load])

  const displayed = useMemo(() => {
    const list = [...rows]
    list.sort((a, b) => {
      const av = typeof (a as any)[sortKey] === "number" ? (a as any)[sortKey] : String((a as any)[sortKey] ?? "")
      const bv = typeof (b as any)[sortKey] === "number" ? (b as any)[sortKey] : String((b as any)[sortKey] ?? "")
      if (typeof av === "number" && typeof bv === "number") return sortDir === "desc" ? bv - av : av - bv
      return sortDir === "desc"
        ? String(bv).localeCompare(String(av))
        : String(av).localeCompare(String(bv))
    })
    return list
  }, [rows, sortKey, sortDir])

  const allChecked = displayed.length > 0 && displayed.every(r => selected.has(r.id))
  const someChecked = displayed.some(r => selected.has(r.id))
  useEffect(() => {
    if (headerCbRef.current) headerCbRef.current.indeterminate = someChecked && !allChecked
  }, [someChecked, allChecked])

  const toggle = (id: string) => setSelected(p => {
    const n = new Set(p)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })
  const toggleAll = (checked: boolean) => setSelected(checked ? new Set(displayed.map(r => r.id)) : new Set())

  const primarySelected = useMemo(() => {
    if (!selected.size) return null
    const id = [...selected][0]
    return displayed.find(r => r.id === id) || rows.find(r => r.id === id) || null
  }, [selected, displayed, rows])

  const openDrawer = (mode: DrawerMode, row?: ReportRow) => {
    const target = row || primarySelected
    if (!target) return
    setFocusRow(target)
    setDrawer(mode)
  }

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc")
    else { setSortKey(key); setSortDir("desc") }
  }

  const dateLabel = datePreset === "custom" && since && until
    ? `${since} → ${until}`
    : DATE_PRESETS.find(p => p.value === datePreset)?.label || datePreset

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
            <IconChartBar className="size-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base leading-tight">Ads Manager Report</h1>
            <p className="text-xs text-muted-foreground line-clamp-1">Campaign / Ad set / Ad performance · Meta-style table + Charts / Compare</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative" ref={acctRef}>
            <button onClick={() => setAcctOpen(v => !v)}
              className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border bg-background hover:bg-muted/50">
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
          </Button>
        </div>
      </div>

      {/* Level tabs */}
      <div className="flex items-center gap-1 px-6 py-2 border-b shrink-0">
        {LEVEL_TABS.map(t => (
          <button key={t.key} onClick={() => setLevel(t.key)}
            className={cn("h-8 px-3 text-sm rounded-lg transition-colors",
              level === t.key ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted/50")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-6 py-2.5 border-b shrink-0 flex-wrap">
        <Drop open={dateOpen} onToggle={() => setDateOpen(v => !v)} label={<>{dateLabel}</>}>
          {DATE_PRESETS.map(p => (
            <button key={p.value}
              onClick={() => {
                setDatePreset(p.value)
                if (p.value !== "custom") setDateOpen(false)
              }}
              className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between",
                datePreset === p.value && "text-primary font-medium")}>
              {p.label}
              {datePreset === p.value && <span className="size-1.5 rounded-full bg-primary" />}
            </button>
          ))}
          {datePreset === "custom" && (
            <div className="px-3 py-2 space-y-2 border-t">
              <label className="block text-xs text-muted-foreground">Since
                <input type="date" value={since} onChange={e => setSince(e.target.value)}
                  className="mt-1 w-full h-8 px-2 text-sm border rounded-lg bg-background" />
              </label>
              <label className="block text-xs text-muted-foreground">Until
                <input type="date" value={until} onChange={e => setUntil(e.target.value)}
                  className="mt-1 w-full h-8 px-2 text-sm border rounded-lg bg-background" />
              </label>
              <Button size="sm" className="w-full h-8" disabled={!since || !until}
                onClick={() => { setDateOpen(false); /* load via deps */ }}>
                Apply range
              </Button>
            </div>
          )}
        </Drop>

        <span className="h-8 px-3 text-xs rounded-lg border bg-muted/20 flex items-center text-muted-foreground">
          Columns: ECOM
        </span>

        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">{selected.size} selected</span>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
              disabled={!primarySelected}
              onClick={() => openDrawer("charts")}>
              <IconChartBar className="size-3.5" /> Charts
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
              disabled={!primarySelected}
              onClick={() => openDrawer("compare")}>
              <IconGitCompare className="size-3.5" /> Compare
            </Button>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" disabled title="Coming soon">
              <IconPencil className="size-3.5" /> Edit
            </Button>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" disabled title="Coming soon">
              <IconCopy className="size-3.5" /> Duplicate
            </Button>
          </div>
        )}
      </div>

      {fromSnapshot && !loading && (
        <div className="flex items-center gap-2 px-4 py-2 text-sm border-b border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 text-amber-800 dark:text-amber-300">
          <IconAlertCircle className="size-4 shrink-0" />
          <span>Đang hiển thị dữ liệu đã lưu — tài khoản Meta không khả dụng.</span>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {!selectedAccountId ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <IconAlertCircle className="size-8 text-muted-foreground/30" />
            <p className="text-sm font-medium">No ad account selected</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-sm text-muted-foreground">
            <IconLoader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <IconAlertCircle className="size-6 text-destructive" />
            <p className="text-sm text-muted-foreground max-w-sm text-center">{error}</p>
            <Button size="sm" variant="outline" onClick={load}><IconRefresh className="size-3.5" /> Retry</Button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <IconMoodEmpty className="size-8 text-muted-foreground/30" />
            <p className="text-sm font-medium">No rows found</p>
            <p className="text-xs text-muted-foreground">Try another date range or level</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-background border-b">
              <tr>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground w-10">
                  <input ref={headerCbRef} type="checkbox" className="size-3.5 rounded cursor-pointer"
                    checked={allChecked} onChange={e => toggleAll(e.target.checked)} />
                </th>
                {cols.map(c => (
                  <th key={c.key}
                    className={cn(
                      "py-2 px-3 font-medium text-muted-foreground whitespace-nowrap cursor-pointer select-none",
                      c.key === "name" ? "text-left min-w-[200px]" : "text-right",
                    )}
                    onClick={() => handleSort(c.key)}>
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {sortKey === c.key && (
                        <span className="text-primary">{sortDir === "desc" ? "↓" : "↑"}</span>
                      )}
                    </span>
                  </th>
                ))}
                <th className="py-2 px-3 font-medium text-muted-foreground text-right sticky right-0 bg-background">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(row => {
                const isSel = selected.has(row.id)
                return (
                  <tr key={row.id}
                    className={cn("border-b transition-colors",
                      isSel ? "bg-blue-50/60 dark:bg-blue-950/20" : "hover:bg-muted/20")}>
                    <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" className="size-3.5 rounded cursor-pointer"
                        checked={isSel} onChange={() => toggle(row.id)} />
                    </td>
                    {cols.map(c => {
                      const raw = (row as any)[c.key]
                      const display = c.key === "delivery"
                        ? <StatusPill delivery={row.delivery || row.effectiveStatus} />
                        : c.key === "name"
                          ? (
                            <div className="flex items-center gap-2 min-w-0">
                              {level === "ad" && (
                                <div className="size-8 rounded bg-muted shrink-0 overflow-hidden">
                                  {row.thumbnail
                                    ? <img src={row.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                                    : <div className="w-full h-full flex items-center justify-center">
                                        {row.isVideo
                                          ? <IconPlayerPlay className="size-3 text-muted-foreground/40" />
                                          : <IconPhoto className="size-3 text-muted-foreground/40" />}
                                      </div>}
                                </div>
                              )}
                              <span className="font-medium truncate max-w-[240px]" title={row.name}>{row.name}</span>
                            </div>
                          )
                          : c.fmt(raw, row)
                      return (
                        <td key={c.key}
                          className={cn(
                            "py-2 px-3 whitespace-nowrap tabular-nums",
                            c.key === "name" || c.key === "delivery" ? "text-left" : "text-right font-medium",
                          )}>
                          {display}
                        </td>
                      )
                    })}
                    <td className="py-2 px-3 text-right sticky right-0 bg-background">
                      <div className="inline-flex items-center gap-1">
                        <button className="h-7 px-2 rounded border text-xs hover:bg-muted/50"
                          onClick={() => { setSelected(new Set([row.id])); openDrawer("charts", row) }}>
                          Charts
                        </button>
                        <button className="h-7 px-2 rounded border text-xs hover:bg-muted/50"
                          onClick={() => { setSelected(new Set([row.id])); openDrawer("compare", row) }}>
                          Compare
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawers */}
      {drawer && focusRow && selectedAccountId && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setDrawer(null)} />
          {drawer === "charts" ? (
            <ChartsDrawer
              row={focusRow} level={level} accountId={selectedAccountId}
              datePreset={datePreset} since={since} until={until}
              onClose={() => setDrawer(null)}
            />
          ) : (
            <CompareDrawer
              row={focusRow} level={level} accountId={selectedAccountId}
              datePreset={datePreset} since={since} until={until}
              onClose={() => setDrawer(null)}
            />
          )}
        </>
      )}
    </div>
  )
}
