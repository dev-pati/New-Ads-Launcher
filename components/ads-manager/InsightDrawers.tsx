"use client"

import { useEffect, useMemo, useState } from "react"
import { IconLoader2, IconMessageCircle, IconPhoto, IconPlayerPlay, IconX } from "@tabler/icons-react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

export type Level = "campaign" | "adset" | "ad"
type CompareTab = "trends" | "breakdowns"

export interface ReportRow {
  id: string
  name: string
  adId?: string | null
  purchases?: number
  costPerPurchase?: number
  spend?: number
  roas?: number
  [key: string]: any
}

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

export function ChartsDrawer({
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

            <div className="grid grid-cols-2 gap-3">
              <BreakdownMini title="Demographics" rows={demo} />
              <BreakdownMini title="Platform" rows={platform} />
            </div>

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

export function CompareDrawer({
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
            className={"h-8 px-3 text-sm rounded-lg capitalize transition-colors " + (tab === t ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50")}>
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
                  activeDot={{ r: 4 }} name={TREND_METRICS.find(t => t.key === metric)?.label || metric} />
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
