"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  IconLoader2,
  IconLock,
  IconRefresh,
  IconCopy,
  IconCheck,
  IconTrash,
  IconAlertTriangle,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"

/**
 * Probation dashboard — private instrument, single user.
 *
 * Answers four questions and nothing else:
 *   1. Am I on track?  2. Which KR is at risk?
 *   3. What evidence supports today's score?  4. What should I fix this week?
 *
 * No charts. Tables, badges and status cards, because every number here has to
 * be defensible in a review conversation, not impressive on a screen.
 */

type TrackStatus = "on_track" | "warning" | "off_track"

type MetricDef = {
  id: string
  kr: "KR1" | "KR2"
  label: string
  points: number
  kind: "boolean" | "defect_count" | "ratio"
  source: "auto" | "auto_confirmed" | "manual"
  budget?: number
  denominator?: number
  howMeasured: string
}

type MetricResult = {
  def: MetricDef
  value: number | null
  earned: number
  possible: number
  excused: boolean
  confirmed?: boolean
  note?: string
  evidence?: string
  explanation: string
}

type KrResult = {
  def: { id: "KR1" | "KR2"; label: string; weight: number }
  metrics: MetricResult[]
  earned: number
  possible: number
  status: TrackStatus
}

type ScoreResult = {
  krs: KrResult[]
  selfScore: number
  possible: number
  status: TrackStatus
  confirmedScore: number | null
  gap: number | null
}

type ExceptionRow = {
  id: string
  date: string
  category: string
  description: string
  evidence: string
  approved: boolean
  metricId?: string
}

type IssueRow = {
  id: string
  issue: string
  owner: string
  deadline: string
  status: "open" | "closed"
}

type WeekRow = {
  weekKey: string
  selfScore: number | null
  confirmedScore: number | null
  confirmedBy?: string
  confirmedNote?: string
  reportSentAt: string | null
  repliedAt: string | null
  reportText?: string
  reportState?: "draft" | "sent"
}

type PersonStatus = {
  metricId: string
  label: string
  matched: string
  launches: number
  ads: number
  failedAds: number
  avgMs: number | null
  totalMs: number
  lastLaunchAt: string | null
  lastLoginAt: string | null
  confirmedUnaided: boolean
}

type Savings = {
  adsThisWeek: number
  appMs: number
  hoursSaved: number
  costSavedVnd: number
  assumption: string
}

type Config = {
  confirmed: boolean
  startDate: string
  endDate: string
  krs: { id: "KR1" | "KR2"; label: string; weight: number }[]
  metrics: MetricDef[]
  thresholds: { onTrack: number; warning: number; pass: number }
  minutesPerAdManual: number
  hourlyCostVnd: number
  exceptionCategories: { id: string; label: string }[]
}

type Overview = {
  config: Config
  weekKey: string
  allWeeks: string[]
  score: ScoreResult
  monthToDate: number
  confirmedMtd: number | null
  launches: { userName: string; batches: number; totalAds: number; lastAt: string }[]
  people: PersonStatus[]
  savings: Savings
  exceptions: ExceptionRow[]
  issues: IssueRow[]
  week: WeekRow | null
  weeks: WeekRow[]
}

const STATUS_LABEL: Record<TrackStatus, string> = {
  on_track: "On Track",
  warning: "Warning",
  off_track: "Off Track",
}

const STATUS_STYLE: Record<TrackStatus, string> = {
  on_track: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  off_track: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—"
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export default function ProbationDashboardPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [weekKey, setWeekKey] = useState<string>("")
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(
    async (week?: string) => {
      setError(null)
      try {
        const url = week ? `/api/probation/overview?week=${week}` : "/api/probation/overview"
        const res = await fetch(url)
        if (res.status === 403) {
          setForbidden(true)
          return
        }
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Failed to load")
        setData(json)
        setWeekKey(json.weekKey)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load")
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    void load()
  }, [load])

  const post = useCallback(
    async (path: string, body: unknown, method: string = "POST") => {
      setSaving(path)
      try {
        const res = await fetch(path, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || "Request failed")
        await load(weekKey)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed")
      } finally {
        setSaving(null)
      }
    },
    [load, weekKey]
  )

  if (forbidden) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <IconLock className="size-8 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Private</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            This dashboard belongs to one person and is not part of the product.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{error || "No data"}</p>
      </div>
    )
  }

  const { config, score } = data

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Probation — Tháng 2</h1>
          <p className="text-sm text-muted-foreground">
            {config.startDate} → {config.endDate} · scored by the reviewers, lead has the final call
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={weekKey}
            onValueChange={(v) => {
              setWeekKey(v)
              void load(v)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {data.allWeeks.map((w) => (
                <SelectItem key={w} value={w}>
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void load(weekKey)}>
            <IconRefresh className="size-4" />
          </Button>
        </div>
      </header>

      {!config.confirmed && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              PROPOSED scoring — not confirmed by the reviewers
            </p>
            <p className="text-amber-700 dark:text-amber-300">
              The plan fixes KR1 at {config.krs[0]?.weight}% and KR2 at {config.krs[1]?.weight}%, but{" "}
              <em>Cách tính điểm</em> — the per-metric splits and{" "}
              <em>Ngưỡng quyết định probation</em> — is empty in the plan itself. Every score below
              uses a split that has not been ticked as agreed. Set it in the{" "}
              <strong>Scoring</strong> tab.
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="krs">KR tracking</TabsTrigger>
          <TabsTrigger value="adoption">Adoption</TabsTrigger>
          <TabsTrigger value="exceptions">Exceptions ({data.exceptions.length})</TabsTrigger>
          <TabsTrigger value="issues">
            Issues ({data.issues.filter((i) => i.status === "open").length})
          </TabsTrigger>
          <TabsTrigger value="report">Weekly report</TabsTrigger>
          <TabsTrigger value="scoring">
            Scoring{!data.config.confirmed && " ⚠"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <OverviewTab data={data} onSave={post} saving={saving} />
        </TabsContent>

        <TabsContent value="krs" className="space-y-4 pt-4">
          <KrTab data={data} score={score} onSave={post} saving={saving} />
        </TabsContent>

        <TabsContent value="adoption" className="space-y-4 pt-4">
          <AdoptionTab data={data} onSave={post} saving={saving} />
        </TabsContent>

        <TabsContent value="exceptions" className="space-y-4 pt-4">
          <ExceptionsTab data={data} onSave={post} saving={saving} />
        </TabsContent>

        <TabsContent value="issues" className="space-y-4 pt-4">
          <IssuesTab data={data} onSave={post} saving={saving} />
        </TabsContent>

        <TabsContent value="report" className="space-y-4 pt-4">
          <ReportTab data={data} weekKey={weekKey} onSave={post} saving={saving} />
        </TabsContent>

        <TabsContent value="scoring" className="space-y-4 pt-4">
          <ScoringTab config={data.config} onSave={post} saving={saving} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Overview ─────────────────────────────────────────────────────────────────

function OverviewTab({
  data,
  onSave,
  saving,
}: {
  data: Overview
  onSave: (p: string, b: unknown, m?: string) => Promise<void>
  saving: string | null
}) {
  const { score, week } = data
  const openIssues = data.issues.filter((i) => i.status === "open")
  const pendingExceptions = data.exceptions.filter((e) => !e.approved)
  const lastReported = [...data.weeks]
    .filter((w) => w.reportSentAt)
    .sort((a, b) => (a.reportSentAt! < b.reportSentAt! ? 1 : -1))[0]

  // Rule #4: no reply = no data = fail. An unanswered report is not "pending".
  const awaitingReply =
    lastReported && !lastReported.repliedAt
      ? daysBetween(new Date(lastReported.reportSentAt!), new Date())
      : null

  const [confirmedScore, setConfirmedScore] = useState(
    week?.confirmedScore !== null && week?.confirmedScore !== undefined
      ? String(week.confirmedScore)
      : ""
  )
  const [confirmedBy, setConfirmedBy] = useState(week?.confirmedBy ?? "")
  const [confirmedNote, setConfirmedNote] = useState(week?.confirmedNote ?? "")

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Self-assessed (this week)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">{fmt(score.selfScore)}</span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            <Badge variant="outline" className={cn("mt-2", STATUS_STYLE[score.status])}>
              {STATUS_LABEL[score.status]}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Confirmed by the reviewers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">{fmt(data.confirmedMtd)}</span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {score.gap === null
                ? "Not yet confirmed — this is the number that counts"
                : `Gap vs self: ${score.gap > 0 ? "+" : ""}${fmt(score.gap)}`}
            </p>
          </CardContent>
        </Card>

        {score.krs.map((kr) => (
          <Card key={kr.def.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kr.def.id} — {kr.def.label} ({kr.def.weight}%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold">{fmt(kr.earned)}</span>
                <span className="text-sm text-muted-foreground">/{kr.possible}</span>
              </div>
              <Badge variant="outline" className={cn("mt-2", STATUS_STYLE[kr.status])}>
                {STATUS_LABEL[kr.status]}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Open issues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {openIssues.length === 0 ? (
              <p className="text-muted-foreground">None</p>
            ) : (
              openIssues.slice(0, 5).map((i) => (
                <p key={i.id}>
                  {i.issue} — <span className="text-muted-foreground">{i.owner}</span> ·{" "}
                  {i.deadline}
                </p>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Exceptions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>
              {data.exceptions.filter((e) => e.approved).length} approved ·{" "}
              {pendingExceptions.length} pending
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Only approved exceptions are excluded from KR failures.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Last weekly report</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {!lastReported ? (
              <p className="text-muted-foreground">Not sent yet</p>
            ) : (
              <>
                <p>
                  {lastReported.weekKey} · sent{" "}
                  {new Date(lastReported.reportSentAt!).toLocaleDateString()}
                </p>
                {awaitingReply !== null && (
                  <p
                    className={cn(
                      "mt-1 text-xs",
                      awaitingReply >= 3 ? "text-destructive" : "text-amber-600"
                    )}
                  >
                    No reply for {awaitingReply} day(s) — rule #4: no reply = no data = fail
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Record what the reviewers actually scored</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Evaluation principle #2 — the real score is theirs, not the app&apos;s. Enter it here
            when they reply; the gap above is the early warning.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              type="number"
              placeholder="Confirmed score /100"
              value={confirmedScore}
              onChange={(e) => setConfirmedScore(e.target.value)}
            />
            <Input
              placeholder="Confirmed by (name)"
              value={confirmedBy}
              onChange={(e) => setConfirmedBy(e.target.value)}
            />
            <Input
              placeholder="Their comment (evidence)"
              value={confirmedNote}
              onChange={(e) => setConfirmedNote(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={saving === "/api/probation/weeks"}
              onClick={() =>
                void onSave("/api/probation/weeks", {
                  weekKey: data.weekKey,
                  selfScore: score.selfScore,
                  confirmedScore: confirmedScore === "" ? null : Number(confirmedScore),
                  confirmedBy,
                  confirmedNote,
                  repliedAt: confirmedScore === "" ? null : new Date().toISOString(),
                })
              }
            >
              Save confirmation
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void onSave("/api/probation/weeks", {
                  weekKey: data.weekKey,
                  selfScore: score.selfScore,
                  reportSentAt: new Date().toISOString(),
                })
              }
            >
              Mark report sent today
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── KR tracking ──────────────────────────────────────────────────────────────

function KrTab({
  data,
  score,
  onSave,
  saving,
}: {
  data: Overview
  score: ScoreResult
  onSave: (p: string, b: unknown, m?: string) => Promise<void>
  saving: string | null
}) {
  return (
    <div className="space-y-6">
      {data.launches.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Detected from <code>launch_batches</code> this week:{" "}
          {data.launches.map((l) => `${l.userName} (${l.batches} batch, ${l.totalAds} ads)`).join(" · ")}
        </p>
      )}
      {score.krs.map((kr) => (
        <Card key={kr.def.id}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              {kr.def.id} — {kr.def.label} ({kr.def.weight}%)
              <Badge variant="outline" className={STATUS_STYLE[kr.status]}>
                {fmt(kr.earned)}/{kr.possible}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {kr.metrics.map((m) => (
              <MetricRow
                key={m.def.id}
                metric={m}
                weekKey={data.weekKey}
                onSave={onSave}
                saving={saving}
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function MetricRow({
  metric,
  weekKey,
  onSave,
  saving,
}: {
  metric: MetricResult
  weekKey: string
  onSave: (p: string, b: unknown, m?: string) => Promise<void>
  saving: string | null
}) {
  const [value, setValue] = useState(metric.value === null ? "" : String(metric.value))
  const [note, setNote] = useState(metric.note ?? "")
  const [evidence, setEvidence] = useState(metric.evidence ?? "")
  const isAuto = metric.def.source === "auto_confirmed"

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{metric.def.label}</span>
          {isAuto && (
            <Badge variant="secondary" className="text-[10px]">
              auto
            </Badge>
          )}
          {metric.excused && (
            <Badge variant="outline" className="text-[10px]">
              excused
            </Badge>
          )}
        </div>
        <span className="text-sm tabular-nums">
          {fmt(metric.earned)}/{metric.possible}
        </span>
      </div>

      {/* Every number is explainable — this line is the derivation, not a tooltip. */}
      <p className="mt-1 text-xs text-muted-foreground">{metric.explanation}</p>
      <p className="mt-1 text-xs text-muted-foreground/80">{metric.def.howMeasured}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        {isAuto ? (
          <div className="flex items-center gap-2 text-sm">
            <span className={metric.value ? "text-emerald-600" : "text-muted-foreground"}>
              {metric.value ? "Launch detected" : "No launch detected"}
            </span>
          </div>
        ) : (
          <Input
            type="number"
            min={0}
            placeholder={
              metric.def.kind === "ratio"
                ? `matched of ${metric.def.denominator}`
                : metric.def.kind === "boolean"
                  ? "1 = yes, 0 = no"
                  : "count"
            }
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        <Input placeholder="Log / reason" value={note} onChange={(e) => setNote(e.target.value)} />
        <Input
          placeholder="Evidence (link)"
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
        />
        <div className="flex gap-2">
          {isAuto && (
            <Button
              size="sm"
              variant={metric.confirmed ? "default" : "outline"}
              disabled={!metric.value}
              onClick={() =>
                void onSave("/api/probation/metrics", {
                  metricId: metric.def.id,
                  weekKey,
                  value: metric.value ?? 0,
                  confirmed: !metric.confirmed,
                  note,
                  evidence,
                })
              }
            >
              {metric.confirmed ? "Unaided ✓" : "Mark unaided"}
            </Button>
          )}
          {!isAuto && (
            <Button
              size="sm"
              disabled={saving === "/api/probation/metrics" || value === ""}
              onClick={() =>
                void onSave("/api/probation/metrics", {
                  metricId: metric.def.id,
                  weekKey,
                  value: Number(value),
                  note,
                  evidence,
                })
              }
            >
              Save
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Adoption ─────────────────────────────────────────────────────────────────

/**
 * Who actually used the app this week, from `launch_batches` — no new table.
 *
 * Everything here is observed except one tick. The DB can prove the account
 * launched; it cannot prove nobody sat next to them. So `confirmedUnaided` stays
 * a human call and is labelled as one — that tick is what KR1 scores, not the
 * launch count.
 *
 * Two absences are stated rather than hidden: there is no login *count*
 * (`accounts.last_sign_in_at` is overwritten, not appended), and hours/₫ saved
 * are derived from an assumed manual baseline that has never been measured.
 */
function AdoptionTab({
  data,
  onSave,
  saving,
}: {
  data: Overview
  onSave: (p: string, b: unknown, m?: string) => Promise<void>
  saving: string | null
}) {
  const { people, savings, weekKey } = data

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {people.map((p) => (
          <Card key={p.metricId}>
            <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm">{p.label}</CardTitle>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  p.launches > 0
                    ? STATUS_STYLE.on_track
                    : STATUS_STYLE.off_track
                )}
              >
                {p.launches > 0 ? "Used the app" : "No launch this week"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-4 gap-2 text-center">
                <Stat label="Launches" value={String(p.launches)} />
                <Stat label="Ads" value={String(p.ads)} />
                <Stat
                  label="Failed"
                  value={String(p.failedAds)}
                  tone={p.failedAds > 0 ? "bad" : undefined}
                />
                <Stat label="Avg time" value={p.avgMs === null ? "—" : fmtDuration(p.avgMs)} />
              </div>

              <dl className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between gap-2">
                  <dt>Last launch</dt>
                  <dd className="text-foreground">{fmtDate(p.lastLaunchAt)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Last login</dt>
                  <dd className="text-foreground">{fmtDate(p.lastLoginAt)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Matched account</dt>
                  <dd className="text-foreground">{p.matched || "not matched"}</dd>
                </div>
              </dl>

              <label className="flex items-start gap-2 rounded-md border p-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={p.confirmedUnaided}
                  disabled={p.launches === 0 || saving !== null}
                  onChange={(e) =>
                    void onSave("/api/probation/metrics", {
                      metricId: p.metricId,
                      weekKey,
                      value: p.launches > 0 ? 1 : 0,
                      confirmed: e.target.checked,
                    })
                  }
                />
                <span>
                  Launched unaided
                  <span className="block text-xs text-muted-foreground">
                    {p.launches === 0
                      ? "Nothing to confirm — no launch detected this week."
                      : "Your call — this tick is what KR1 scores. The launch count above is only evidence that the account did it."}
                  </span>
                </span>
              </label>
            </CardContent>
          </Card>
        ))}
        {people.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No auto-detected people configured.
          </p>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Time and money — derived, not measured</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Ads this week" value={String(savings.adsThisWeek)} />
            <Stat label="Time in app" value={fmtDuration(savings.appMs)} />
            <Stat label="Hours saved" value={`${fmt(savings.hoursSaved)}h`} />
            <Stat
              label="₫ saved"
              value={savings.costSavedVnd.toLocaleString("vi-VN")}
            />
          </div>
          <p className="text-xs text-muted-foreground">{savings.assumption}</p>
          <p className="text-xs text-muted-foreground">
            &quot;Time in app&quot; is real — <code>launch_batches.duration_ms</code>. Hours and ₫
            are that number compared against a manual baseline nobody has timed. Quote them with the
            assumption attached or not at all. Change the two constants in the{" "}
            <strong>Scoring</strong> tab.
          </p>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        There is no login <em>count</em> anywhere in the schema — <code>accounts.last_sign_in_at</code>{" "}
        is a single overwritten column. Counting logins would need a new table on a locked project,
        and plan §3.1 rejects activity metrics anyway: it scores whether the app failed them, not
        how often they showed up.
      </p>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "bad"
}) {
  return (
    <div className="rounded-md border p-2">
      <p className={cn("text-lg font-semibold", tone === "bad" && "text-destructive")}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function fmtDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return "—"
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function fmtDate(iso: string | null): string {
  if (!iso) return "never"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ── Exceptions ───────────────────────────────────────────────────────────────

function ExceptionsTab({
  data,
  onSave,
  saving,
}: {
  data: Overview
  onSave: (p: string, b: unknown, m?: string) => Promise<void>
  saving: string | null
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [category, setCategory] = useState(data.config.exceptionCategories[0]?.id ?? "")
  const [description, setDescription] = useState("")
  const [evidence, setEvidence] = useState("")
  const [metricId, setMetricId] = useState("all")

  const catLabel = useMemo(
    () => new Map(data.config.exceptionCategories.map((c) => [c.id, c.label])),
    [data.config.exceptionCategories]
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Log an exception</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Categories are the closed set from the plan — deliberately not free text, so the
            argument the plan settled stays settled. Only <strong>approved</strong> exceptions are
            excluded from KR failures.
          </p>
          <div className="grid gap-2 sm:grid-cols-4">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {data.config.exceptionCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={metricId} onValueChange={setMetricId}>
              <SelectTrigger>
                <SelectValue placeholder="Applies to" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All metrics</SelectItem>
                {data.config.metrics.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Evidence (link)"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
            />
          </div>
          <Textarea
            placeholder="What happened, and why it is not an app failure"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button
            size="sm"
            disabled={saving === "/api/probation/exceptions" || !description}
            onClick={async () => {
              await onSave("/api/probation/exceptions", {
                date,
                category,
                description,
                evidence,
                approved: false,
                metricId: metricId === "all" ? undefined : metricId,
              })
              setDescription("")
              setEvidence("")
            }}
          >
            Add exception
          </Button>
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Evidence</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.exceptions.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                No exceptions logged
              </TableCell>
            </TableRow>
          )}
          {data.exceptions.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="whitespace-nowrap">{e.date}</TableCell>
              <TableCell className="max-w-48 text-xs">{catLabel.get(e.category) ?? e.category}</TableCell>
              <TableCell className="max-w-72 text-xs">{e.description}</TableCell>
              <TableCell className="max-w-40 truncate text-xs">{e.evidence || "—"}</TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={
                    e.approved
                      ? STATUS_STYLE.on_track
                      : "bg-muted text-muted-foreground border-border"
                  }
                >
                  {e.approved ? "Approved" : "Pending"}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void onSave(
                      "/api/probation/exceptions",
                      { id: e.id, approved: !e.approved },
                      "PATCH"
                    )
                  }
                >
                  {e.approved ? "Unapprove" : "Approve"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void onSave(`/api/probation/exceptions?id=${e.id}`, {}, "DELETE")
                  }
                >
                  <IconTrash className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ── Issues ───────────────────────────────────────────────────────────────────

function IssuesTab({
  data,
  onSave,
  saving,
}: {
  data: Overview
  onSave: (p: string, b: unknown, m?: string) => Promise<void>
  saving: string | null
}) {
  const [issue, setIssue] = useState("")
  const [owner, setOwner] = useState("")
  const [deadline, setDeadline] = useState("")

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Open an issue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Escalation: a metric failing mid-month goes here, which triggers the mid-week meeting.
            Fail sớm, fix sớm.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="Issue" value={issue} onChange={(e) => setIssue(e.target.value)} />
            <Input placeholder="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
            <Input
              type="date"
              placeholder="Deadline"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            disabled={saving === "/api/probation/issues" || !issue || !owner || !deadline}
            onClick={async () => {
              await onSave("/api/probation/issues", { issue, owner, deadline })
              setIssue("")
              setOwner("")
              setDeadline("")
            }}
          >
            Add issue
          </Button>
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Issue</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Deadline</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.issues.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                No issues
              </TableCell>
            </TableRow>
          )}
          {data.issues.map((i) => {
            const overdue =
              i.status === "open" && i.deadline && new Date(i.deadline) < new Date()
            return (
              <TableRow key={i.id}>
                <TableCell className="max-w-80 text-sm">{i.issue}</TableCell>
                <TableCell>{i.owner}</TableCell>
                <TableCell className={cn("whitespace-nowrap", overdue && "text-destructive")}>
                  {i.deadline}
                  {overdue && " · overdue"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      i.status === "closed"
                        ? STATUS_STYLE.on_track
                        : "bg-muted text-muted-foreground border-border"
                    }
                  >
                    {i.status}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void onSave(
                        "/api/probation/issues",
                        { id: i.id, status: i.status === "open" ? "closed" : "open" },
                        "PATCH"
                      )
                    }
                  >
                    {i.status === "open" ? "Close" : "Reopen"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void onSave(`/api/probation/issues?id=${i.id}`, {}, "DELETE")}
                  >
                    <IconTrash className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// ── Weekly report ────────────────────────────────────────────────────────────

/**
 * Nothing here is typed. The report is generated from this week's metrics every
 * time the tab opens — including NEXT WEEK, which is derived from the metrics
 * that lost the most points plus the open issues with the nearest deadline.
 *
 * Draft and sent are two different documents. A draft is live: it changes as the
 * numbers change, so there is nothing to keep in sync by hand. The moment you
 * mark it sent the text freezes — what you were scored on is the text they read,
 * and a later edit would make the confirmed score unauditable. Editing is a
 * deliberate override behind a button, not the default path. Sending itself
 * still happens in Lark, by hand.
 */
function ReportTab({
  data,
  weekKey,
  onSave,
  saving,
}: {
  data: Overview
  weekKey: string
  onSave: (p: string, b: unknown, m?: string) => Promise<void>
  saving: string | null
}) {
  const week = data.week
  const sent = week?.reportState === "sent" && !!week?.reportText
  const stored = week?.reportText ?? ""

  const [report, setReport] = useState(stored)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const generate = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/probation/report?week=${weekKey}`)
      const json = await res.json()
      setReport(json.report || json.error || "")
    } finally {
      setLoading(false)
    }
  }, [weekKey])

  // A sent week shows its frozen text. Anything else regenerates from live
  // metrics — a saved draft is a snapshot of numbers that have since moved, so
  // showing it would be showing something stale.
  useEffect(() => {
    setEditing(false)
    if (sent) setReport(stored)
    else void generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey, sent])

  const busy = saving === "/api/probation/weeks"

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn("text-xs", sent ? STATUS_STYLE.on_track : STATUS_STYLE.warning)}
          >
            {sent ? `Sent ${fmtDate(week?.reportSentAt ?? null)}` : "Live — not sent"}
          </Badge>
          {sent && week?.repliedAt && (
            <Badge variant="outline" className={cn("text-xs", STATUS_STYLE.on_track)}>
              Replied {fmtDate(week.repliedAt)}
            </Badge>
          )}
          {sent && !week?.repliedAt && (
            <Badge variant="outline" className={cn("text-xs", STATUS_STYLE.off_track)}>
              No reply yet
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{weekKey}</span>
        </div>

        {editing && !sent ? (
          <Textarea
            className="min-h-96 font-mono text-xs leading-relaxed"
            value={report}
            onChange={(e) => setReport(e.target.value)}
          />
        ) : (
          <pre className="overflow-x-auto rounded-md border bg-muted/40 p-4 text-xs leading-relaxed whitespace-pre">
            {loading ? "…" : report || "—"}
          </pre>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(report)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          {!sent && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (editing) void generate()
                  setEditing(!editing)
                }}
                disabled={loading}
              >
                {loading ? (
                  <IconLoader2 className="size-4 animate-spin" />
                ) : editing ? (
                  "Discard edits"
                ) : (
                  "Edit before sending"
                )}
              </Button>
              <Button
                size="sm"
                disabled={busy || !report}
                onClick={() =>
                  void onSave("/api/probation/weeks", {
                    weekKey,
                    reportText: report,
                    reportSentAt: new Date().toISOString(),
                  })
                }
              >
                Mark sent — freezes the text
              </Button>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Generated from this week&apos;s metrics every time you open the tab — including{" "}
          <strong>NEXT WEEK</strong>, which is the metric losing the most points plus the open issues
          with the nearest deadline. Nothing to fill in. Format is fixed by the plan; paste into
          Lark, nothing is sent from here. Marking sent is one-way: the text freezes so the
          confirmed score always has the exact document it was given.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">All weeks</p>
        <div className="space-y-1">
          {[...data.weeks]
            .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
            .map((w) => (
              <div
                key={w.weekKey}
                className={cn(
                  "rounded-md border p-2 text-xs",
                  w.weekKey === weekKey && "border-primary bg-muted/40"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{w.weekKey}</span>
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5",
                      w.reportState === "sent" ? STATUS_STYLE.on_track : STATUS_STYLE.warning
                    )}
                  >
                    {w.reportState === "sent" ? "Sent" : "Live"}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {w.reportState === "sent"
                    ? w.repliedAt
                      ? `replied ${fmtDate(w.repliedAt)}`
                      : "awaiting reply"
                    : "not sent"}
                  {w.confirmedScore !== null && ` · confirmed ${fmt(w.confirmedScore)}`}
                </p>
              </div>
            ))}
          {data.weeks.length === 0 && (
            <p className="text-xs text-muted-foreground">Nothing saved yet.</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Switch weeks with the selector at the top of the page.
        </p>
      </div>
    </div>
  )
}

// ── Scoring config ───────────────────────────────────────────────────────────

/**
 * The one screen that exists because the plan does not have the numbers.
 *
 * Only the point splits, the thresholds and the confirmed flag are editable —
 * which metrics exist, and how each one is scored, is a code change. Those were
 * derived from the plan's own wording and changing them silently would break the
 * link between a score and the sentence it came from.
 */
function ScoringTab({
  config,
  onSave,
  saving,
}: {
  config: Config
  onSave: (p: string, b: unknown, m?: string) => Promise<void>
  saving: string | null
}) {
  const [points, setPoints] = useState<Record<string, string>>(
    Object.fromEntries(config.metrics.map((m) => [m.id, String(m.points)]))
  )
  const [onTrack, setOnTrack] = useState(String(config.thresholds.onTrack))
  const [warning, setWarning] = useState(String(config.thresholds.warning))
  const [pass, setPass] = useState(String(config.thresholds.pass))
  const [confirmed, setConfirmed] = useState(config.confirmed)
  const [minutesPerAd, setMinutesPerAd] = useState(String(config.minutesPerAdManual))
  const [hourlyCost, setHourlyCost] = useState(String(config.hourlyCostVnd))

  const total = useMemo(
    () => Object.values(points).reduce((s, v) => s + (Number(v) || 0), 0),
    [points]
  )
  const krTotals = useMemo(() => {
    const out: Record<string, number> = {}
    for (const m of config.metrics) out[m.kr] = (out[m.kr] ?? 0) + (Number(points[m.id]) || 0)
    return out
  }, [config.metrics, points])

  const valid = Math.abs(total - 100) < 0.01

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Point splits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {config.confirmed
              ? "Confirmed. Changing a split now changes every score already shown, including weeks already reported — say so in the next report if you do."
              : "Ask the reviewers for two things: how the 80 and the 20 break down per metric, and the pass mark. Until then these are a proposal, not an agreement."}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>KR</TableHead>
                <TableHead>Metric</TableHead>
                <TableHead>How it is measured</TableHead>
                <TableHead className="w-28">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {config.metrics.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap text-xs">{m.kr}</TableCell>
                  <TableCell className="text-sm">{m.label}</TableCell>
                  <TableCell className="max-w-96 text-xs text-muted-foreground">
                    {m.howMeasured}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={points[m.id] ?? ""}
                      onChange={(e) => setPoints({ ...points, [m.id]: e.target.value })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className={cn("text-sm", valid ? "text-muted-foreground" : "text-destructive")}>
            {config.krs
              .map((k) => `${k.id} ${krTotals[k.id] ?? 0} (plan says ${k.weight})`)
              .join(" · ")}{" "}
            · total {fmt(total)}/100
            {!valid && " — must sum to 100"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Thresholds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-xs text-muted-foreground">
              On Track at or above
              <Input
                type="number"
                value={onTrack}
                onChange={(e) => setOnTrack(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Warning at or above (below = Off Track)
              <Input type="number" value={warning} onChange={(e) => setWarning(e.target.value)} />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Pass mark — Ngưỡng quyết định probation
              <Input type="number" value={pass} onChange={(e) => setPass(e.target.value)} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Plan line 115 allows a target to be reset when an external blocker is agreed. Changing a
            threshold mid-month is legitimate — but write the reason in an Issue so the change has a
            paper trail, otherwise it reads as moving the goalposts.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Savings assumptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-muted-foreground">
              Minutes per ad, launched by hand
              <Input
                type="number"
                min={0}
                value={minutesPerAd}
                onChange={(e) => setMinutesPerAd(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Hourly cost (₫)
              <Input
                type="number"
                min={0}
                value={hourlyCost}
                onChange={(e) => setHourlyCost(e.target.value)}
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            These two numbers are the entire basis of the hours-saved and ₫-saved figures on the{" "}
            <strong>Adoption</strong> tab. Neither has been measured — 15 min/ad is copied from the
            constant already hard-coded in the Statistics screen, kept identical so the two screens
            cannot disagree. Time the manual flow once and this stops being a guess.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Confirmation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              The reviewers have confirmed these numbers
              <span className="block text-xs text-muted-foreground">
                Only tick this when he has actually said so. It removes the warning banner from every
                screen, including anything you screenshot into Lark.
              </span>
            </span>
          </label>
          <Button
            size="sm"
            disabled={!valid || saving === "/api/probation/config"}
            onClick={() =>
              void onSave(
                "/api/probation/config",
                {
                  config: {
                    ...config,
                    confirmed,
                    metrics: config.metrics.map((m) => ({
                      ...m,
                      points: Number(points[m.id]) || 0,
                    })),
                    thresholds: {
                      onTrack: Number(onTrack) || 0,
                      warning: Number(warning) || 0,
                      pass: Number(pass) || 0,
                    },
                    minutesPerAdManual: Number(minutesPerAd) || 0,
                    hourlyCostVnd: Number(hourlyCost) || 0,
                  },
                },
                "PUT"
              )
            }
          >
            Save scoring
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
