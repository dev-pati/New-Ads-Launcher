"use client"

import Image from "next/image"
import { useCallback, useEffect, useState } from "react"
import { IconAlertTriangle, IconChartBar, IconLoader2, IconNote, IconRefresh, IconRocket } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAdAccount } from "@/lib/ad-account-context"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

type TeamMember = {
  userId: string
  name: string
  batches: number
  fullSuccess: number
  nonSuccess: number
  adsCreated: number
  averageSessionDurationMs: number | null
}

type TrackingSummary = {
  batches: number
  fullSuccess: number
  nonSuccess: number
  adsCreated: number
  successRate: number
  averageSessionDurationMs: number | null
  team: TeamMember[]
}

type TimeSeriesPoint = {
  bucket: string
  batches: number
  fullSuccess: number
  nonSuccess: number
  adsCreated: number
  avgDurationMs: number | null
}

type CreativePerfRow = {
  rank: number
  adId: string
  adName: string
  adsetName: string
  campaignName: string
  spend: number
  results: number
  costPerResult: number
  purchaseValue: number
  roas: number
  impressions: number
  linkClicks: number
  ctr: number
  dateStart: string
  createdTime: string | null
  thumbnail: string | null
  isVideo: boolean
}

type MemberDetail = {
  userId: string
  days: number
  summary: TrackingSummary
  streak: number
  recentBatches: Array<{
    id: string
    status: string
    total_ads: number | null
    failed_ads: number | null
    duration_ms: number | null
    created_at: string | null
    ad_account_name: string | null
  }>
  painpoint: string
}

type TrackingData = {
  days: number
  generatedAt: string
  role: string
  currentUserId: string
  admin?: TrackingSummary
  adminTimeSeries?: TimeSeriesPoint[]
  teamStreaks?: Record<string, number>
  failureReasons?: Array<{ label: string; count: number }>
  mine: TrackingSummary
  myBatches: Array<{
    id: string
    status: string
    total_ads: number | null
    failed_ads: number | null
    duration_ms: number | null
    created_at: string | null
    ad_account_name: string | null
  }>
  myStreak: number
  myFailureReasons: Array<{ label: string; count: number }>
  creative: {
    ready: number
    launched: number
    unlaunched: number
    launchRate: number
  }
  creatorDataStatus: "awaiting_portal"
  painpoint: string
}

const METRIC_METHODOLOGY = {
  successRate: "% batches with status = success out of all batches in the period.",
  adsCreated: "Sum of (total_ads − failed_ads) across batches in the period.",
  needsReview: "Batches whose status is not success (partial or failed).",
  avgDuration: "Mean server-side batch duration_ms in the period.",
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null) return "-"
  const seconds = Math.round(durationMs / 1_000)
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`
}

function formatBucket(bucket: string, days: number) {
  const date = new Date(`${bucket}T00:00:00.000Z`)
  if (days >= 90) {
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" })
  }
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", timeZone: "UTC" })
}

function getLabelName(key: string) {
  switch (key) {
    case "fullSuccess": return "Full Success Batches"
    case "adsCreated": return "Ads Created"
    case "nonSuccess": return "Needs Review Batches"
    case "avgDurationMs": return "Average Duration"
    default: return key
  }
}

function TrendChart({ series, dataKey, days, color = "#3987e5" }: { series: TimeSeriesPoint[]; dataKey: keyof TimeSeriesPoint; days: number; color?: string }) {
  if (series.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No data in this period.</p>
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="bucket" tickFormatter={v => formatBucket(String(v), days)} stroke="#898781" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis stroke="#898781" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            contentStyle={{ background: "#1a1a19", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, fontSize: 12, color: "#ffffff" }}
            itemStyle={{ color: "#ffffff" }}
            labelStyle={{ color: "#898781" }}
            labelFormatter={v => formatBucket(String(v), days)}
            formatter={value => (dataKey === "avgDurationMs" ? [formatDuration(Number(value)), "Duration"] : [String(value), getLabelName(String(dataKey))])}
          />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

const DATE_PRESET: Record<7 | 30 | 90, string> = { 7: "last_7d", 30: "last_30d", 90: "last_90d" }

export default function TrackingPage() {
  const { selectedAccount } = useAdAccount()
  const [data, setData] = useState<TrackingData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const isAdminView = data?.role === "admin"
  const [view, setView] = useState<"admin" | "mine" | "creative">("admin")
  const [days, setDays] = useState<7 | 30 | 90>(7)
  const [openMetric, setOpenMetric] = useState<null | "successRate" | "adsCreated" | "needsReview" | "avgDuration">(null)
  const [memberDetail, setMemberDetail] = useState<{ userId: string; name: string } | null>(null)
  const [memberData, setMemberData] = useState<MemberDetail | null>(null)
  const [memberLoading, setMemberLoading] = useState(false)
  const [creativePerf, setCreativePerf] = useState<CreativePerfRow[] | null>(null)
  const [creativeLoading, setCreativeLoading] = useState(false)
  const [painpoint, setPainpoint] = useState("")
  const [painpointSaved, setPainpointSaved] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/tracking?days=${days}`, { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Tracking data is unavailable.")
      setData(body)
      setPainpoint(body.painpoint || "")
      if (body.role !== "admin" && view === "admin") setView("mine")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tracking data is unavailable.")
    } finally {
      setLoading(false)
    }
  }, [days, view])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (view !== "creative") return
    const adAccountId = selectedAccount?.account_id
    if (!adAccountId) { setCreativePerf(null); return }
    if (creativePerf !== null) return
    void (async () => {
      setCreativeLoading(true)
      try {
        const params = new URLSearchParams({ adAccountId, datePreset: DATE_PRESET[days], limit: "20" })
        const res = await fetch(`/api/insights/top-creatives?${params}`, { cache: "no-store" })
        const body = await res.json()
        if (res.ok && Array.isArray(body.ads)) setCreativePerf(body.ads)
        else setCreativePerf([])
      } catch { setCreativePerf([]) }
      finally { setCreativeLoading(false) }
    })()
  }, [view, days, creativePerf, selectedAccount?.account_id])

  useEffect(() => {
    if (!memberDetail) { setMemberData(null); return }
    void (async () => {
      setMemberLoading(true)
      try {
        const res = await fetch(`/api/tracking/member?userId=${memberDetail.userId}&days=${days}`, { cache: "no-store" })
        const body = await res.json()
        if (res.ok) setMemberData(body)
      } catch { /* ignore */ }
      finally { setMemberLoading(false) }
    })()
  }, [memberDetail, days])

  async function savePainpoint() {
    setPainpointSaved(null)
    try {
      const res = await fetch("/api/tracking/painpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: painpoint }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Save failed.")
      setPainpoint(body.note || "")
      setPainpointSaved("saved")
    } catch (cause) {
      setPainpointSaved(cause instanceof Error ? cause.message : "Save failed.")
    }
  }

  const summary = view === "admin" ? data?.admin : data?.mine
  const series = data?.adminTimeSeries || []
  const tabs: Array<["admin" | "mine" | "creative", string]> = isAdminView
    ? [["admin", "Team Delivery"], ["mine", "My Delivery"], ["creative", "Creative"]]
    : [["mine", "My Delivery"], ["creative", "Creative"]]

  const metricConfig = summary ? [
    { key: "successRate" as const, label: "Full-batch success", value: `${summary.successRate}%`, note: `${summary.fullSuccess} / ${summary.batches} batches`, warning: false, dataKey: "fullSuccess" as const, methodology: METRIC_METHODOLOGY.successRate },
    { key: "adsCreated" as const, label: "Ads created", value: summary.adsCreated, note: "Excludes failed ads", warning: false, dataKey: "adsCreated" as const, methodology: METRIC_METHODOLOGY.adsCreated },
    { key: "needsReview" as const, label: "Needs review", value: summary.nonSuccess, note: "Partial or failed batches", warning: summary.nonSuccess > 0, dataKey: "nonSuccess" as const, methodology: METRIC_METHODOLOGY.needsReview },
    { key: "avgDuration" as const, label: "Avg launch duration", value: formatDuration(summary.averageSessionDurationMs), note: "Server-side batch duration", warning: false, dataKey: "avgDurationMs" as const, methodology: METRIC_METHODOLOGY.avgDuration },
  ] : []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Active organization</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Tracking System</h1>
          <p className="mt-2 text-sm text-muted-foreground">Launch and Creative coverage for the selected reporting period.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { setCreativePerf(null); void load() }} disabled={loading}>
            {loading ? <IconLoader2 className="size-4 animate-spin" /> : <IconRefresh className="size-4" />}
            Refresh
          </Button>
        </div>
      </header>

      {error && <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><IconAlertTriangle className="size-4" />{error}</div>}
      {loading && !data && <div className="flex min-h-64 items-center justify-center"><IconLoader2 className="size-6 animate-spin text-muted-foreground" /></div>}

      {data && <>
        <div className="flex w-fit rounded-lg border bg-muted/30 p-1">
          {tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setView(id)} className={`rounded-md px-3 py-1.5 text-sm ${view === id ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}>{label}</button>)}
        </div>
        <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">Reporting period
          <select value={days} onChange={event => { setDays(Number(event.target.value) as 7 | 30 | 90); setCreativePerf(null) }} className="rounded-md border bg-background px-2 py-1 text-foreground">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </label>

        {view !== "creative" && summary && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metricConfig.map(metric => (
              <button key={metric.key} type="button" onClick={() => setOpenMetric(metric.key)} className="rounded-xl border bg-card p-5 text-left shadow-sm transition hover:border-foreground/20">
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className={`mt-2 text-3xl font-semibold tabular-nums ${metric.warning ? "text-amber-600" : ""}`}>{metric.value}</p>
                <p className="mt-2 text-xs text-muted-foreground">{metric.note}</p>
                <p className="mt-3 inline-flex items-center gap-1 text-xs text-primary"><IconChartBar className="size-3" />Trend &amp; definition</p>
              </button>
            ))}
          </div>
        )}

        {view === "admin" && data.admin && (
          <section className="rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b p-5">
              <div><h2 className="font-semibold">Team Delivery</h2><p className="mt-1 text-sm text-muted-foreground">All launch modes recorded in the active organization. Click a member to drill down.</p></div>
              <IconRocket className="size-5 text-muted-foreground" />
            </div>
            {data.admin.team.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">No launch batches in the selected reporting period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table data-table="comfortable" className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-5 font-medium">Member</th>
                      <th className="px-5 text-right font-medium">Batches</th>
                      <th className="px-5 text-right font-medium">Full success</th>
                      <th className="px-5 text-right font-medium">Needs review</th>
                      <th className="px-5 text-right font-medium">Ads created</th>
                      <th className="px-5 text-right font-medium">Streak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.admin.team.map(member => {
                      const isSelf = member.userId === data.currentUserId
                      return (
                        <tr key={member.userId} className={`border-b last:border-0 ${isSelf ? "opacity-60" : "cursor-pointer hover:bg-muted/30"}`} onClick={() => { if (!isSelf) setMemberDetail({ userId: member.userId, name: member.name }) }} title={isSelf ? "See My Delivery tab" : undefined}>
                          <td className="px-5 font-medium">{member.name}{isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</td>
                          <td className="px-5 text-right tabular-nums">{member.batches}</td>
                          <td className="px-5 text-right tabular-nums">{member.fullSuccess}</td>
                          <td className="px-5 text-right tabular-nums">{member.nonSuccess}</td>
                          <td className="px-5 text-right tabular-nums">{member.adsCreated}</td>
                          <td className="px-5 text-right tabular-nums">{(data.teamStreaks || {})[member.userId] || 0}d</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {view === "admin" && data.admin && (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="font-semibold">Launch funnel</h2>
              <p className="mt-1 text-sm text-muted-foreground">Only recorded stages are measured.</p>
              <div className="mt-5 space-y-4 text-sm">
                <div>
                  <div className="flex justify-between"><span>Submitted launch</span><strong>{data.admin.batches}</strong></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full w-full bg-primary" /></div>
                </div>
                <div>
                  <div className="flex justify-between"><span>Full success</span><strong>{data.admin.fullSuccess}</strong></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500" style={{ width: `${data.admin.successRate}%` }} /></div>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Open flow, setup campaign, and setup ad set are unavailable: the app does not record these events.</p>
            </section>
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="font-semibold">Failure reasons</h2>
              <p className="mt-1 text-sm text-muted-foreground">Unclassified stored error messages. Not app-vs-Meta attribution.</p>
              {(data.failureReasons || []).length === 0 ? <p className="mt-5 text-sm text-muted-foreground">No stored failure reasons in this period.</p> : <div className="mt-4 space-y-2">{(data.failureReasons || []).slice(0, 5).map(reason => <div key={reason.label} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-sm"><span className="truncate">{reason.label}</span><strong className="tabular-nums">{reason.count}</strong></div>)}</div>}
            </section>
          </div>
        )}

        {view === "mine" && (
          <section className="rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b p-5">
              <div><h2 className="font-semibold">My Delivery</h2><p className="mt-1 text-sm text-muted-foreground">Your launch batches in the active organization.</p></div>
              <IconRocket className="size-5 text-muted-foreground" />
            </div>
            {data.myBatches.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">You have no launch batches in the selected reporting period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table data-table="comfortable" className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-5 font-medium">Launched</th>
                      <th className="px-5 font-medium">Ad account</th>
                      <th className="px-5 text-right font-medium">Created</th>
                      <th className="px-5 text-right font-medium">Failed</th>
                      <th className="px-5 text-right font-medium">Duration</th>
                      <th className="px-5 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.myBatches.map(batch => (
                      <tr key={batch.id} className="border-b last:border-0">
                        <td className="px-5 text-muted-foreground">{batch.created_at ? new Date(batch.created_at).toLocaleString() : "-"}</td>
                        <td className="px-5 font-medium">{batch.ad_account_name || "Unknown"}</td>
                        <td className="px-5 text-right tabular-nums">{Math.max(0, (batch.total_ads || 0) - (batch.failed_ads || 0))}</td>
                        <td className="px-5 text-right tabular-nums">{batch.failed_ads || 0}</td>
                        <td className="px-5 text-right tabular-nums">{formatDuration(batch.duration_ms)}</td>
                        <td className="px-5 text-right"><span className={batch.status === "success" ? "text-emerald-600" : "text-amber-600"}>{batch.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {view === "mine" && (
          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2"><IconNote className="size-4 text-muted-foreground" /><h2 className="font-semibold">Weekly painpoint</h2></div>
            <p className="mt-1 text-sm text-muted-foreground">What slowed you down in the app this week? Optional. Visible to admins in your member detail.</p>
            <textarea value={painpoint} onChange={event => { setPainpoint(event.target.value); setPainpointSaved(null) }} rows={3} placeholder="E.g. launch table froze when pasting 40 rows…" className="mt-3 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm" />
            <div className="mt-3 flex items-center gap-3">
              <Button size="sm" onClick={() => void savePainpoint()} disabled={painpointSaved === "saving"}>Save</Button>
              {painpointSaved === "saved" && <span className="text-xs text-emerald-600">Saved for this week.</span>}
              {painpointSaved && painpointSaved !== "saved" && <span className="text-xs text-destructive">{painpointSaved}</span>}
            </div>
          </section>
        )}

        {view === "mine" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="font-semibold">My launch funnel</h2>
              <p className="mt-1 text-sm text-muted-foreground">Measured from your submitted batches.</p>
              <div className="mt-5 space-y-4 text-sm">
                <div className="flex justify-between"><span>Submitted launch</span><strong>{data.mine.batches}</strong></div>
                <div className="flex justify-between"><span>Full success</span><strong>{data.mine.fullSuccess}</strong></div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Setup-stage events are unavailable.</p>
            </section>
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="font-semibold">My failure reasons</h2>
              <p className="mt-1 text-sm text-muted-foreground">Unclassified stored error messages.</p>
              {data.myFailureReasons.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">No stored failure reasons in this period.</p> : <div className="mt-4 space-y-2">{data.myFailureReasons.slice(0, 5).map(reason => <div key={reason.label} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-sm"><span className="truncate">{reason.label}</span><strong className="tabular-nums">{reason.count}</strong></div>)}</div>}
            </section>
          </div>
        )}

        {view === "creative" && (
          <section className="rounded-xl border bg-card shadow-sm">
            <div className="border-b p-5">
              <h2 className="font-semibold">Creative performance</h2>
              <p className="mt-1 text-sm text-muted-foreground">Top ads by spend on {selectedAccount?.name || "the selected ad account"}, from Ads Manager insights. Sorted by spend (highest first).</p>
            </div>
            {!selectedAccount ? (
              <p className="p-5 text-sm text-muted-foreground">Select an ad account to see creative performance.</p>
            ) : creativeLoading ? (
              <div className="flex min-h-32 items-center justify-center"><IconLoader2 className="size-5 animate-spin text-muted-foreground" /></div>
            ) : !creativePerf || creativePerf.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">No ad performance in this period for this ad account.</p>
            ) : (
              <div className="overflow-x-auto">
                <table data-table="comfortable" className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-5 font-medium">Ad</th>
                      <th className="px-5 text-right font-medium">Spend</th>
                      <th className="px-5 text-right font-medium">ROAS</th>
                      <th className="px-5 text-right font-medium">Results</th>
                      <th className="px-5 text-right font-medium">CTR</th>
                      <th className="px-5 text-right font-medium">Cost/Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creativePerf.map(row => (
                      <tr key={row.adId} className="border-b last:border-0">
                        <td className="px-5 font-medium">
                          <div className="flex items-center gap-3">
                            {row.thumbnail ? <Image src={row.thumbnail} alt="" width={36} height={36} unoptimized className="size-9 rounded object-cover" /> : <div className="size-9 rounded bg-muted" />}
                            <span className="truncate">{row.adName}</span>
                          </div>
                        </td>
                        <td className="px-5 text-right tabular-nums">{row.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="px-5 text-right tabular-nums">{row.roas ? `${row.roas.toFixed(2)}×` : "-"}</td>
                        <td className="px-5 text-right tabular-nums">{row.results}</td>
                        <td className="px-5 text-right tabular-nums">{row.ctr.toFixed(2)}%</td>
                        <td className="px-5 text-right tabular-nums">{row.costPerResult ? row.costPerResult.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <p className="flex items-center gap-2 text-xs text-muted-foreground"><IconChartBar className="size-3.5" />Updated {new Date(data.generatedAt).toLocaleString()}</p>
      </>}

      <Dialog open={openMetric !== null} onOpenChange={open => { if (!open) setOpenMetric(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{metricConfig.find(m => m.key === openMetric)?.label}</DialogTitle>
            <DialogDescription>{metricConfig.find(m => m.key === openMetric)?.methodology}</DialogDescription>
          </DialogHeader>
          {openMetric && <TrendChart series={series} dataKey={metricConfig.find(m => m.key === openMetric)!.dataKey} days={days} />}
        </DialogContent>
      </Dialog>

      <Dialog open={memberDetail !== null} onOpenChange={open => { if (!open) { setMemberDetail(null); setMemberData(null) } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{memberDetail?.name}</DialogTitle>
            <DialogDescription>Activity performance in the last {days} days.</DialogDescription>
          </DialogHeader>
          {memberLoading ? (
            <div className="flex min-h-32 items-center justify-center"><IconLoader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : memberData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { label: "Batches", value: memberData.summary.batches },
                  { label: "Full success", value: memberData.summary.fullSuccess },
                  { label: "Needs review", value: memberData.summary.nonSuccess },
                  { label: "Ads created", value: memberData.summary.adsCreated },
                  { label: "Streak", value: `${memberData.streak}d` },
                  { label: "Avg duration", value: formatDuration(memberData.summary.averageSessionDurationMs) },
                ].map(stat => (
                  <div key={stat.label} className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">{stat.value}</p>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="text-sm font-medium">Recent batches</h3>
                <div className="mt-2 max-h-48 overflow-y-auto rounded-md border">
                  <table className="w-full text-xs">
                    <tbody>
                      {memberData.recentBatches.map(batch => (
                        <tr key={batch.id} className="border-b last:border-0">
                          <td className="px-3 py-2 text-muted-foreground">{batch.created_at ? new Date(batch.created_at).toLocaleDateString() : "-"}</td>
                          <td className="px-3 py-2">{batch.ad_account_name || "Unknown"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{Math.max(0, (batch.total_ads || 0) - (batch.failed_ads || 0))}</td>
                          <td className="px-3 py-2 text-right"><span className={batch.status === "success" ? "text-emerald-600" : "text-amber-600"}>{batch.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {memberData.painpoint && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Painpoint this week</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{memberData.painpoint}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
