"use client"

import { useEffect, useState } from "react"
import { IconAlertTriangle, IconChartBar, IconLoader2, IconRefresh, IconRocket } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"

type TeamMember = {
  userId: string
  name: string
  batches: number
  fullSuccess: number
  nonSuccess: number
  adsCreated: number
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

type TrackingData = {
  days: number
  generatedAt: string
  admin: TrackingSummary
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
  teamStreaks: Record<string, number>
  myStreak: number
  failureReasons: Array<{ label: string; count: number }>
  myFailureReasons: Array<{ label: string; count: number }>
  creative: {
    ready: number
    launched: number
    unlaunched: number
    launchRate: number
  }
  creatorDataStatus: "awaiting_portal"
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null) return "-"
  const seconds = Math.round(durationMs / 1_000)
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`
}

function Metric({ label, value, note, warning }: { label: string; value: string | number; note: string; warning?: boolean }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${warning ? "text-amber-600" : ""}`}>{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </section>
  )
}

export default function TrackingPage() {
  const [data, setData] = useState<TrackingData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<"admin" | "mine" | "creative">("admin")
  const [days, setDays] = useState<7 | 28>(7)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/tracking?days=${days}`, { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Tracking data is unavailable.")
      setData(body)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tracking data is unavailable.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [days])

  const summary = view === "admin" ? data?.admin : data?.mine
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Active organization</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Tracking System</h1>
          <p className="mt-2 text-sm text-muted-foreground">Launch and Creative coverage for the selected reporting period.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <IconLoader2 className="size-4 animate-spin" /> : <IconRefresh className="size-4" />}
            Refresh
          </Button>
        </div>
      </header>

      {error && <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><IconAlertTriangle className="size-4" />{error}</div>}
      {loading && !data && <div className="flex min-h-64 items-center justify-center"><IconLoader2 className="size-6 animate-spin text-muted-foreground" /></div>}

      {data && <>
        <div className="flex w-fit rounded-lg border bg-muted/30 p-1">
          {([ ["admin", "Team Delivery"], ["mine", "My Delivery"], ["creative", "Creative"] ] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setView(id)} className={`rounded-md px-3 py-1.5 text-sm ${view === id ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}>{label}</button>)}
        </div>
        <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">Reporting period
          <select value={days} onChange={event => setDays(Number(event.target.value) as 7 | 28)} className="rounded-md border bg-background px-2 py-1 text-foreground">
            <option value={7}>Last 7 days</option>
            <option value={28}>Last 28 days</option>
          </select>
        </label>

        {view === "creative" ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Launch-ready Creatives" value={data.creative.ready} note="Has a Meta image hash or video ID" />
          <Metric label="Launched" value={data.creative.launched} note="Launched successfully at least once" />
          <Metric label="Not launched" value={data.creative.unlaunched} note="Ready Creative without a successful launch" warning={data.creative.unlaunched > 0} />
          <Metric label="Launch coverage" value={`${data.creative.launchRate}%`} note="Lifetime coverage of launch-ready Creatives" />
        </div> : view === "mine" && summary ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Full-batch success" value={`${summary.successRate}%`} note={`${summary.fullSuccess} / ${summary.batches} batches`} />
          <Metric label="Ads created" value={summary.adsCreated} note="Excludes failed ads" />
          <Metric label="Working-day streak" value={data.myStreak} note="Consecutive weekdays with a launch" />
          <Metric label="Launch session duration" value={formatDuration(summary.averageSessionDurationMs)} note="Average server-side batch duration" />
        </div> : summary && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Full-batch success" value={`${summary.successRate}%`} note={`${summary.fullSuccess} / ${summary.batches} batches`} />
          <Metric label="Ads created" value={summary.adsCreated} note="Excludes failed ads" />
          <Metric label="Needs review" value={summary.nonSuccess} note="Partial or failed batches" warning={summary.nonSuccess > 0} />
          <Metric label="Launch session duration" value={formatDuration(summary.averageSessionDurationMs)} note="Average server-side batch duration" />
        </div>}

        {view === "admin" && <section className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b p-5">
            <div><h2 className="font-semibold">Team Delivery</h2><p className="mt-1 text-sm text-muted-foreground">All launch modes recorded in the active organization.</p></div>
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
                  {data.admin.team.map(member => (
                    <tr key={member.userId} className="border-b last:border-0">
                      <td className="px-5 font-medium">{member.name}</td>
                      <td className="px-5 text-right tabular-nums">{member.batches}</td>
                      <td className="px-5 text-right tabular-nums">{member.fullSuccess}</td>
                      <td className="px-5 text-right tabular-nums">{member.nonSuccess}</td>
                      <td className="px-5 text-right tabular-nums">{member.adsCreated}</td>
                      <td className="px-5 text-right tabular-nums">{data.teamStreaks[member.userId] || 0}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>}

        {view === "admin" && <div className="grid gap-4 lg:grid-cols-2">
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
            {data.failureReasons.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">No stored failure reasons in this period.</p> : <div className="mt-4 space-y-2">{data.failureReasons.slice(0, 5).map(reason => <div key={reason.label} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-sm"><span className="truncate">{reason.label}</span><strong className="tabular-nums">{reason.count}</strong></div>)}</div>}
          </section>
        </div>}

        {view === "mine" && <section className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b p-5">
            <div><h2 className="font-semibold">My Delivery</h2><p className="mt-1 text-sm text-muted-foreground">Only your launch batches in the active organization.</p></div>
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
        </section>}

        {view === "mine" && <div className="grid gap-4 lg:grid-cols-2">
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
        </div>}

        {view === "creative" && <section className="rounded-xl border bg-card shadow-sm">
          <div className="border-b p-5"><h2 className="font-semibold">Creative coverage and Ads performance by Creator</h2><p className="mt-1 text-sm text-muted-foreground">Creator data is awaiting sync from Creative Portal.</p></div>
          <p className="p-5 text-sm text-muted-foreground">Creator ID and name are not available from Creative Portal yet. Coverage and Ads metrics will appear after Portal exposes them.</p>
        </section>}

        <p className="flex items-center gap-2 text-xs text-muted-foreground"><IconChartBar className="size-3.5" />Updated {new Date(data.generatedAt).toLocaleString()}</p>
      </>}
    </div>
  )
}
