"use client"

import { useCallback, useEffect, useState } from "react"
import { IconAlertTriangle, IconChartBar, IconCheck, IconChevronRight, IconCopy, IconInfoCircle, IconLoader2, IconMinus, IconNote, IconPlus, IconRefresh, IconRocket } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CLASS_DESCRIPTION, CLASS_LABEL, CLASS_ORDER, type ActivityClass } from "@/lib/tracking/activity-catalog"
import { mergeUsageRows } from "@/lib/tracking/activity"
import { FALLBACK_HINT, FALLBACK_LABEL, FALLBACK_REASONS, type FallbackReason } from "@/lib/tracking/fallback"
import { readWeek, totalCount, writeWeek, type LocalFallbackWeek } from "@/lib/tracking/fallback-local"
import type { FallbackKind } from "@/lib/tracking/fallback"
import { buildProbationReport, scoreProbationWeek, type ProbationScore } from "@/lib/tracking/probation"
import { buildTrackingReport } from "@/lib/tracking/report"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

type TeamMember = {
  userId: string
  name: string
  avatarUrl?: string | null
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



type MemberDetail = {
  userId: string
  avatarUrl?: string | null
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
  activity?: ActivityBlock & { available: boolean; unavailableReason: string | null }
  timeline?: Array<{ at: string; label: string; class: ActivityClass; detail: string }>
}

type ActivityTypeCount = {
  key: string
  label: string
  class: ActivityClass
  status: "live" | "pending_emit" | "not_instrumented"
  /** Which shipped screen the action happens on — the class drill-down reads this. */
  surface: string
  count: number
}

type ActivityMember = {
  userId: string
  name: string
  actions: number
  activeDays: number
  breadth: number
  byClass: Record<ActivityClass, number>
}

type ActivityBlock = {
  total: number
  byClass: Record<ActivityClass, number>
  byType: ActivityTypeCount[]
  byMember: ActivityMember[]
  activeMembers: number
  activeDays: number
  unused: ActivityTypeCount[]
  notInstrumented: ActivityTypeCount[]
  leverageRatio: number | null
  estimatedHoursSaved: number
}

type ActivityPayload = {
  available: boolean
  instrumentedSince: string | null
  unavailableReason: string | null
  truncated: boolean
  automationRuns: number
  automationCoverage: number | null
  mine: ActivityBlock
  team?: ActivityBlock
}

type PreviousPayload = {
  batches: number
  adsCreated: number
  successRate: number
  deltaBatches: number | null
  deltaAdsCreated: number | null
  deltaSuccessRate: number
  deltaActivity: number | null
  deltaActiveMembers: number | null
  deltaAutomationRuns: number | null
}

type TrackingData = {
  days: number
  generatedAt: string
  role: string
  currentUserId: string
  activity: ActivityPayload
  previous: PreviousPayload
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

function TrackingMemberAvatar({ name, avatarUrl, size = "sm" }: { name?: string | null; avatarUrl?: string | null; size?: "sm" | "default" | "lg" }) {
  return (
    <Avatar size={size}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name || ""} />}
      <AvatarFallback>{name?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback>
    </Avatar>
  )
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


const CLASS_BAR: Record<ActivityClass, string> = {
  produce: "bg-primary",
  reuse: "bg-emerald-500",
  govern: "bg-amber-500",
  collaborate: "bg-violet-500",
}

/** A period-over-period change. Renders nothing when there is no comparable base — an unknown is not 0%. */
function DeltaBadge({ value, unit = "%" }: { value: number | null | undefined; unit?: string }) {
  if (value === null || value === undefined) return <span className="text-xs font-normal text-muted-foreground">no prior data</span>
  if (value === 0) return <span className="text-xs font-normal text-muted-foreground">flat vs previous</span>
  return (
    <span className={`text-xs font-normal tabular-nums ${value > 0 ? "text-emerald-600" : "text-amber-600"}`}>
      {value > 0 ? "+" : ""}{value}{unit} vs previous
    </span>
  )
}

/**
 * The App Activity half of Usage: what people did in the app beyond pressing Launch.
 *
 * Three honesty rules are visible in the markup, not just in the data layer:
 *   - an activity nobody could record renders as "not instrumented", never as 0,
 *   - anything derived from a stated assumption carries the word "estimated",
 *   - a period with no comparable base says so instead of showing +0%.
 */
function ActivityPanel({
  payload,
  block,
  scope,
  deltaActions,
  deltaMembers,
}: {
  payload: ActivityPayload
  block: ActivityBlock
  scope: "team" | "mine"
  deltaActions?: number | null
  deltaMembers?: number | null
}) {
  const used = block.byType.filter(type => type.count > 0)
  const maxClass = Math.max(1, ...CLASS_ORDER.map(key => block.byClass[key]))
  /** Which class the reader opened, to answer "Produce counts actions on what, exactly?" */
  const [openClass, setOpenClass] = useState<ActivityClass | null>(null)
  const classRows = openClass
    ? block.byType.filter(type => type.class === openClass).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    : []

  const tiles = [
    {
      label: "Valuable actions",
      value: block.total,
      note: scope === "team" ? "All members, launches included" : "Yours, launches included",
      delta: scope === "team" ? deltaActions : undefined,
    },
    scope === "team"
      ? { label: "Active members", value: block.activeMembers, note: "At least one valuable action", delta: deltaMembers }
      : { label: "Active days", value: block.activeDays, note: `Days you did something, of the period`, delta: undefined },
    {
      label: "Automation coverage",
      value: payload.automationCoverage === null ? "—" : `${payload.automationCoverage}%`,
      note: payload.automationCoverage === null ? "No automation runs and no manual govern actions" : `${payload.automationRuns} runs, org-wide`,
      delta: undefined,
    },
    {
      label: "Est. hours saved",
      value: `~${block.estimatedHoursSaved}h`,
      note: "Estimated from stated assumptions — not measured",
      delta: undefined,
    },
  ]

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
        <div>
          <h2 className="font-semibold">App activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The work that makes launches possible or cheaper. Page views, logins and filters are deliberately excluded — only actions a person decided on that left a durable record count.
          </p>
        </div>
        <IconChartBar className="size-5 text-muted-foreground" />
      </div>

      {!payload.available && (
        <div className="flex items-start gap-2 border-b bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-500">
          <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{payload.unavailableReason} Everything below counts launches only — it is not evidence that nothing else happened.</span>
        </div>
      )}
      {payload.truncated && (
        <div className="border-b bg-muted/40 p-4 text-xs text-muted-foreground">
          Row cap reached for this period — counts are a floor, not a total. Narrow the reporting period for exact numbers.
        </div>
      )}

      <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(tile => (
          <div key={tile.label} className="rounded-xl border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">{tile.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{tile.value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{tile.note}</p>
            {tile.delta !== undefined && <p className="mt-1"><DeltaBadge value={tile.delta} /></p>}
          </div>
        ))}
      </div>

      <details className="border-t">
        <summary className="cursor-pointer list-none p-5 text-sm text-muted-foreground transition hover:text-foreground">
          <span className="inline-flex items-center gap-1.5">
            <IconChevronRight className="size-3.5 transition-transform [details[open]_&]:rotate-90" />
            Breakdown — what those actions were, and what the app still cannot see
          </span>
        </summary>

        <div className="grid gap-5 border-t p-5 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium">Where the work goes</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Four kinds of value. A team that only produces is a team with no leverage. Click a class to see exactly which actions, on which screens, are counted into it.
          </p>
          <div className="mt-4 space-y-3">
            {CLASS_ORDER.map(key => (
              <button
                key={key}
                type="button"
                onClick={() => setOpenClass(key)}
                className="block w-full rounded-lg p-2 text-left transition hover:bg-muted/50"
              >
                <div className="flex items-baseline justify-between text-sm">
                  <span className="inline-flex items-center gap-1">
                    {CLASS_LABEL[key]}
                    <IconChevronRight className="size-3.5 text-muted-foreground" />
                  </span>
                  <strong className="tabular-nums">{block.byClass[key]}</strong>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${CLASS_BAR[key]}`} style={{ width: `${Math.round((block.byClass[key] / maxClass) * 100)}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{CLASS_DESCRIPTION[key]}</p>
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Reuse per launch: <strong className="tabular-nums">{block.leverageRatio === null ? "—" : block.leverageRatio}</strong>
            {" "}— a ratio, not a rate. The share of launches that reused a template needs template.applied, which nothing records yet.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium">Most used this period</h3>
          {used.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nothing recorded in this period.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {used.slice(0, 8).map(type => (
                <div key={type.key} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`size-1.5 shrink-0 rounded-full ${CLASS_BAR[type.class]}`} />
                    <span className="truncate">{type.label}</span>
                  </span>
                  <strong className="tabular-nums">{type.count}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

        <div className="grid gap-5 border-t p-5 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium">Shipped but unused</h3>
          <p className="mt-1 text-xs text-muted-foreground">Instrumented, genuinely at zero this period. This is the list that decides what to fix, teach or delete.</p>
          {block.unused.length === 0 ? (
            <p className="mt-3 text-sm text-emerald-600">Every instrumented activity was used at least once.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {block.unused.map(type => (
                <span key={type.key} className="rounded-full border border-amber-500/30 bg-amber-500/5 px-2.5 py-1 text-xs text-amber-700 dark:text-amber-500">{type.label}</span>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-medium"><IconInfoCircle className="size-3.5 text-muted-foreground" />Not measurable yet</h3>
          <p className="mt-1 text-xs text-muted-foreground">No producer records these, so they are reported as unavailable — never as zero. Each one is a slice of BL-12.</p>
          {block.notInstrumented.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Everything in the catalog is instrumented.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {block.notInstrumented.map(type => (
                <span key={type.key} className="rounded-full border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">{type.label}</span>
              ))}
            </div>
          )}
        </div>
        </div>
      </details>

      {payload.instrumentedSince && (
        <p className="border-t p-4 text-xs text-muted-foreground">
          App activity has been recorded since {new Date(payload.instrumentedSince).toLocaleDateString("vi-VN")}. Any part of this period before that date is short by construction.
        </p>
      )}

      {/*
        A class total is only trustworthy if you can see what it is made of. Without this
        list "Produce 42" is a number nobody can check, and an unverifiable number on a
        dashboard eventually stops being read.
      */}
      <Dialog open={openClass !== null} onOpenChange={open => { if (!open) setOpenClass(null) }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{openClass ? `${CLASS_LABEL[openClass]} — ${block.byClass[openClass]} action${block.byClass[openClass] === 1 ? "" : "s"}` : ""}</DialogTitle>
            <DialogDescription>
              {openClass ? CLASS_DESCRIPTION[openClass] : ""} Every action counted into this class, and the shipped function it comes from
              {scope === "team" ? ", across the whole team" : ", yours only"}, in this period.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {classRows.map(type => (
              <div key={type.key} className="rounded-lg border p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <span className={`size-1.5 shrink-0 rounded-full ${CLASS_BAR[type.class]}`} />
                    <span className="truncate">{type.label}</span>
                  </span>
                  {type.status === "live" ? (
                    <strong className="tabular-nums">{type.count}</strong>
                  ) : (
                    <span className="shrink-0 rounded-full border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">not measurable</span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{type.surface}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            An activity marked <em>not measurable</em> shows no number at all rather than 0: the function exists and people use it, but nothing records who did it, so a 0 would be a claim the app cannot make. Those are slices of BL-12.
          </p>
        </DialogContent>
      </Dialog>
    </section>
  )
}

/**
 * The card that counts what the app could NOT do.
 *
 * Every other number on this page measures work the app absorbed. This one measures the
 * work it pushed back to Meta Ads Manager, which is the only metric that can say the app
 * replaced the old way of working rather than merely being busy. Nothing can record it:
 * leaving the product is invisible from inside it. So it is typed in by hand, and it is
 * stored on the hand's own machine (`lib/tracking/fallback-local.ts`) — a self-count kept
 * in a server table would read as organisational measurement, which it is not.
 *
 * My usage only, for the same reason: on Team usage it would be a read-only tile of
 * somebody else's self-report, and a number with no owner stops being questioned.
 */
function FallbackCard({
  week,
  onChange,
}: {
  week: LocalFallbackWeek
  onChange: (next: LocalFallbackWeek) => void
}) {
  const total = totalCount(week)
  const weekLabel = new Date(`${week.weekStart}T00:00:00.000Z`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })

  const setCount = (reason: FallbackReason, value: number) =>
    onChange({ ...week, counts: { ...week.counts, [reason]: Math.max(0, Math.floor(value) || 0) } })

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
        <div>
          <h2 className="font-semibold">Fallback về Meta Ads Manager <span className="ml-1 align-middle text-xs font-normal text-muted-foreground">điền tay</span></h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Của bạn, tuần này (từ {weekLabel}). Mỗi lần phải mở Ads Manager để làm nốt việc = 1 lần app chưa thay được cách làm cũ. Bạn tự điền số — chỉ hiện ở My usage.
          </p>
          {/* App không nhìn thấy được lúc người ta rời khỏi nó. Con số này chỉ đúng bằng
              mức chăm điền, nên nó phải tự nói ra điều đó ngay cạnh con số. */}
          <p className="mt-1 text-xs text-muted-foreground">
            {total === 0
              ? "0 = chưa điền, không phải là không có fallback."
              : "Số tự điền, lưu trên máy bạn — app không tự thấy được lúc ai đó rời khỏi nó."}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold tabular-nums">{total}</p>
          <p className="text-xs text-muted-foreground">lần</p>
        </div>
      </div>

      <div className="divide-y">
        {FALLBACK_REASONS.map(reason => (
          <div key={reason} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{FALLBACK_LABEL[reason]}</p>
              <p className="text-xs text-muted-foreground">{FALLBACK_HINT[reason]}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="icon" variant="outline" className="size-8" onClick={() => setCount(reason, week.counts[reason] - 1)} disabled={week.counts[reason] === 0} title="Bớt 1">
                <IconMinus className="size-3.5" />
              </Button>
              <input
                type="number"
                min={0}
                value={week.counts[reason]}
                onChange={event => setCount(reason, Number(event.target.value))}
                className="w-14 rounded-md border bg-background px-2 py-1 text-center text-sm tabular-nums"
              />
              <Button size="icon" variant="outline" className="size-8" onClick={() => setCount(reason, week.counts[reason] + 1)} title="Thêm 1">
                <IconPlus className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 border-t p-5 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium">Creative aggregate</p>
            <p className="mt-1 text-xs text-muted-foreground">Xem creative gộp theo nhóm đã dùng được chưa?</p>
            <div className="mt-2 flex gap-2">
              {(["works", "not_yet"] as const).map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChange({ ...week, creativeAggregate: week.creativeAggregate === value ? null : value })}
                  className={`rounded-full border px-3 py-1 text-xs ${week.creativeAggregate === value ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground"}`}
                >
                  {value === "works" ? "work" : "chưa"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Data accuracy</p>
            <p className="mt-1 text-xs text-muted-foreground">Spot check: bao nhiêu số khớp với Ads Manager?</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={week.spotCheckTotal}
                value={week.spotCheckMatched ?? ""}
                placeholder="—"
                onChange={event => {
                  const raw = event.target.value
                  onChange({ ...week, spotCheckMatched: raw === "" ? null : Math.max(0, Math.min(week.spotCheckTotal, Number(raw))) })
                }}
                className="w-16 rounded-md border bg-background px-2 py-1 text-sm tabular-nums"
              />
              <span className="text-sm text-muted-foreground">/ {week.spotCheckTotal} khớp</span>
            </div>
          </div>
      </div>

      <details className="border-t">
          <summary className="cursor-pointer list-none p-5 text-sm text-muted-foreground hover:text-foreground">
            <span className="inline-flex items-center gap-1.5">
              <IconChevronRight className="size-3.5 transition-transform [details[open]_&]:rotate-90" />
              Ghi chú tuần (không bắt buộc)
            </span>
          </summary>
          <div className="px-5 pb-5">
            <textarea
              value={week.note}
              onChange={event => onChange({ ...week, note: event.target.value })}
              rows={3}
              placeholder="Ví dụ: launch table đơ khi dán 40 dòng…"
              className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm"
            />
            <p className="mt-2 text-xs text-muted-foreground">Lưu trên máy bạn, và đi kèm khi bạn copy Report.</p>
          </div>
      </details>
    </section>
  )
}

function KrCard({ score, week, scoreAvailable, loggingAvailable, unavailableReason, busy, error, onRecord, onUndo }: {
  score: ProbationScore
  week: ProbationPayload["weeks"][number]
  scoreAvailable: boolean
  loggingAvailable: boolean
  unavailableReason: string | null
  busy: boolean
  error: string | null
  onRecord: (kind: FallbackKind) => void
  onUndo: () => void
}) {
  const last = week.fallbacks[0]
  const status = score.verdict === "on_track" ? "On track" : score.verdict === "warning" ? "Warning" : "Off track"
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="grid gap-4 border-b p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-sm text-muted-foreground">This week</p>
          <h2 className="mt-1 text-xl font-semibold">KR score <span className="tabular-nums">{scoreAvailable ? `${score.total}/100` : "unavailable"}</span></h2>
          <p className="mt-1 text-sm text-muted-foreground">{scoreAvailable ? `${status}. Completed launches plus recorded Meta fallbacks.` : "Required evidence is unavailable, so no score is claimed."}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-muted/40 px-4 py-3"><p className="text-xs text-muted-foreground">KR1 Launch</p><p className="mt-1 text-2xl font-semibold tabular-nums">{scoreAvailable ? `${score.kr1}/80` : "-"}</p></div>
          <div className="rounded-lg bg-muted/40 px-4 py-3"><p className="text-xs text-muted-foreground">KR2 Control</p><p className="mt-1 text-2xl font-semibold tabular-nums">{scoreAvailable ? `${score.kr2}/20` : "-"}</p></div>
        </div>
      </div>
      <div className="p-5">
        <p className="text-sm font-medium">Had to use Meta Ads Manager</p>
        <p className="mt-1 text-xs text-muted-foreground">One tap after AdLauncher could not finish the job. Zero means zero recorded, not guaranteed zero fallback.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => onRecord("launch")} disabled={!loggingAvailable || busy}>Launch</Button>
          <Button variant="outline" onClick={() => onRecord("control")} disabled={!loggingAvailable || busy}>Control</Button>
          {last && <Button variant="ghost" onClick={onUndo} disabled={busy}>Undo last</Button>}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Recorded: Launch {score.launchFallbacks} - Control {score.controlFallbacks}</p>
        {!scoreAvailable && <p className="mt-3 text-sm text-amber-600">{unavailableReason}</p>}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>
    </section>
  )
}

/** What the probation route can prove: who launched, in which ISO week. */
type ProbationPayload = {
  monthStart: string
  monthEnd: string
  currentWeek: string
  fallbackAvailable: boolean
  fallbackUnavailableReason: string | null
  controlAvailable: boolean
  controlUnavailableReason: string | null
  weeks: Array<{
    week: string
    index: number
    isCurrent: boolean
    launchers: Array<{ name: string; batches: number }>
    controlActors: Array<{ name: string; actions: number }>
    fallbacks: Array<{ id: string; kind: FallbackKind; occurredAt: string }>
  }>
}

/** The plan covers one month. Outside it the block is noise, so it never renders. */
function isProbationMonth(now = new Date()) {
  const key = now.toISOString().slice(0, 7)
  return key === "2026-08"
}

export default function TrackingPage() {
  const [data, setData] = useState<TrackingData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const isAdminView = data?.role === "admin"
  const [view, setView] = useState<"admin" | "mine">("admin")
  const [days, setDays] = useState<7 | 30 | 90>(7)
  const [openMetric, setOpenMetric] = useState<null | "successRate" | "adsCreated" | "needsReview" | "avgDuration">(null)
  const [memberDetail, setMemberDetail] = useState<{ userId: string; name: string; avatarUrl?: string | null } | null>(null)
  const [memberData, setMemberData] = useState<MemberDetail | null>(null)
  const [memberLoading, setMemberLoading] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [probation, setProbation] = useState<ProbationPayload | null>(null)
  const [fallbackBusy, setFallbackBusy] = useState(false)
  const [fallbackError, setFallbackError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/tracking?days=${days}`, { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Tracking data is unavailable.")
      setData(body)
      if (body.role !== "admin" && view === "admin") setView("mine")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tracking data is unavailable.")
    } finally {
      setLoading(false)
    }
  }, [days, view])

  useEffect(() => { void load() }, [load])

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

  /** The hand-kept tally lives on this machine, keyed by user so a shared PC stays honest. */
  /**
   * Only inside the probation month, and only for the person the plan is about — the
   * route answers 403 to everyone else, so who sees the block is decided on the server
   * and this effect never has to know a name.
   */
  const loadProbation = useCallback(async () => {
    if (!isProbationMonth()) { setProbation(null); return }
    try {
      const res = await fetch("/api/tracking/probation", { cache: "no-store" })
      if (!res.ok) { setProbation(null); return }
      setProbation(await res.json())
    } catch { setProbation(null) }
  }, [])

  useEffect(() => { void loadProbation() }, [loadProbation])

  async function recordFallback(kind: FallbackKind) {
    setFallbackBusy(true)
    setFallbackError(null)
    try {
      const res = await fetch("/api/tracking/probation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Could not record fallback.")
      await loadProbation()
    } catch (cause) {
      setFallbackError(cause instanceof Error ? cause.message : "Could not record fallback.")
    } finally {
      setFallbackBusy(false)
    }
  }

  async function undoFallback() {
    const current = probation?.weeks.find(week => week.isCurrent) || probation?.weeks.at(-1)
    const last = current?.fallbacks[0]
    if (!last) return
    setFallbackBusy(true)
    setFallbackError(null)
    try {
      const res = await fetch(`/api/tracking/probation?id=${last.id}`, { method: "DELETE" })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Could not undo fallback.")
      await loadProbation()
    } catch (cause) {
      setFallbackError(cause instanceof Error ? cause.message : "Could not undo fallback.")
    } finally {
      setFallbackBusy(false)
    }
  }

  const summary = view === "admin" ? data?.admin : undefined
  const series = data?.adminTimeSeries || []
  const tabs: Array<["admin" | "mine", string]> = isAdminView
    ? [["admin", "Team usage"], ["mine", "My usage"]]
    : [["mine", "My usage"]]

  // Deltas describe the whole org; on My usage the tile still shows the org trend, so
  // only the team view claims them. Better no comparison than a wrong one.
  const isTeamScope = view === "admin"
  const metricConfig = summary ? [
    { key: "successRate" as const, label: "Full-batch success", value: `${summary.successRate}%`, note: `${summary.fullSuccess} / ${summary.batches} batches`, warning: false, dataKey: "fullSuccess" as const, methodology: METRIC_METHODOLOGY.successRate, delta: isTeamScope ? data?.previous?.deltaSuccessRate ?? null : undefined, deltaUnit: " pts" },
    { key: "adsCreated" as const, label: "Ads created", value: summary.adsCreated, note: "Excludes failed ads", warning: false, dataKey: "adsCreated" as const, methodology: METRIC_METHODOLOGY.adsCreated, delta: isTeamScope ? data?.previous?.deltaAdsCreated ?? null : undefined, deltaUnit: "%" },
    { key: "needsReview" as const, label: "Needs review", value: summary.nonSuccess, note: "Partial or failed batches", warning: summary.nonSuccess > 0, dataKey: "nonSuccess" as const, methodology: METRIC_METHODOLOGY.needsReview, delta: undefined, deltaUnit: "%" },
    { key: "avgDuration" as const, label: "Avg launch duration", value: formatDuration(summary.averageSessionDurationMs), note: "Server-side batch duration", warning: false, dataKey: "avgDurationMs" as const, methodology: METRIC_METHODOLOGY.avgDuration, delta: undefined, deltaUnit: "%" },
  ] : []

  const activity = data?.activity
  const activityBlock = view === "admin" ? activity?.team : activity?.mine

  // One row per person from the two half-pictures. A member who launched but recorded no
  // other activity, and one who did plenty without launching, both belong in the table.
  const usageRows = mergeUsageRows(data?.admin?.team || [], activity?.team?.byMember || [])

  /**
   * The report is built from the payload already on screen, so the number a PM pastes
   * into a message and the number the dashboard shows can never disagree.
   */
  const baseReport = data && activity ? buildTrackingReport({
    days: data.days,
    generatedAt: data.generatedAt,
    orgName: null,
    delivery: isAdminView && data.admin ? data.admin : data.mine,
    previous: data.previous,
    creative: data.creative,
    failureReasons: (isAdminView ? data.failureReasons : data.myFailureReasons) || [],
    activity: (isAdminView ? activity.team : activity.mine) || null,
    activityAvailable: activity.available,
    instrumentedSince: activity.instrumentedSince,
    automationRuns: activity.automationRuns,
    automationCoverage: activity.automationCoverage,
  }) : ""

  /**
   * The probation week rides inside this person's own report instead of standing as a
   * block on the page — it is a review of one person, and a card on a screen is read by
   * whoever walks past it. The route answers 403 to everyone else, so if `probation`
   * loaded at all, this is the subject reading their own week.
   *
   * Measured half (who launched) comes from the route; hand-kept half (fallback counts,
   * the two weekly answers) is read from this machine and scored here, so there is still
   * exactly one scoring path — `scoreProbationWeek`.
   */
  const scoredProbation = probation?.weeks.map(week => ({
    ...week,
    score: scoreProbationWeek({ launchers: week.launchers, controlActors: week.controlActors, fallbacks: week.fallbacks }),
  })) || []
  const currentProbation = scoredProbation.find(week => week.isCurrent) || scoredProbation.at(-1) || null
  const currentProbationIndex = currentProbation ? scoredProbation.findIndex(week => week.week === currentProbation.week) : -1
  const previousProbation = currentProbationIndex > 0 ? scoredProbation[currentProbationIndex - 1] : null
  const probationWeeksToDate = probation ? scoredProbation.filter(week => week.week <= probation.currentWeek) : []
  const probationEvidenceAvailable = Boolean(probation?.fallbackAvailable && probation?.controlAvailable)
  const probationUnavailableReason = probation?.fallbackUnavailableReason || probation?.controlUnavailableReason || null
  const probationReport = currentProbation && probationEvidenceAvailable ? `${buildProbationReport({
    score: currentProbation.score,
    week: currentProbation.index,
    reportDate: new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }),
    monthToDate: probationWeeksToDate.length === 0 ? null : Math.round((probationWeeksToDate.reduce((sum, week) => sum + week.score.total, 0) / probationWeeksToDate.length) * 10) / 10,
  })}\n**Vs previous week** ${previousProbation ? `${currentProbation.score.total - previousProbation.score.total >= 0 ? "+" : ""}${currentProbation.score.total - previousProbation.score.total} points` : "no prior data"}` : probation ? `## Probation\n**Score:** unavailable - ${probationUnavailableReason || "required evidence is unavailable"}` : ""

  const reportMarkdown = view === "mine" && probationReport ? probationReport : baseReport

  /** Adoption of Tracking itself is otherwise unmeasurable — see /api/tracking/export. */
  function recordExport() {
    void fetch("/api/tracking/export", { method: "POST" })
  }

  async function copyReport() {
    if (!reportMarkdown) return
    try {
      await navigator.clipboard.writeText(reportMarkdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2_000)
      recordExport()
    } catch {
      setCopied(false)
    }
  }

  /**
   * PDF via the browser's own print dialog — "Save as PDF" is a destination there on
   * every platform we run on. No renderer to keep in step with the report format, and
   * what prints is the text the dashboard already showed.
   */
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Active organization</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Tracking System</h1>
          <p className="mt-2 text-sm text-muted-foreground">Usage — delivery and app activity — plus Creative coverage, for the selected reporting period.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setReportOpen(true)} disabled={!data}>
            <IconNote className="size-4" />
            Report
          </Button>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <IconLoader2 className="size-4 animate-spin" /> : <IconRefresh className="size-4" />}
            Refresh
          </Button>
        </div>
      </header>

      {error && <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><IconAlertTriangle className="size-4" />{error}</div>}
      {loading && !data && <div className="flex min-h-64 items-center justify-center"><IconLoader2 className="size-6 animate-spin text-muted-foreground" /></div>}

      {data && <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex w-fit rounded-lg border bg-muted/30 p-1">
            {tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setView(id)} className={`rounded-md px-3 py-1.5 text-sm ${view === id ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}>{label}</button>)}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">Reporting period
            <select value={days} onChange={event => setDays(Number(event.target.value) as 7 | 30 | 90)} className="rounded-md border bg-background px-2 py-1 text-foreground">
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>
        </div>

        {summary && (
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Delivery</h2>
              <p className="mt-1 text-sm text-muted-foreground">What reached Meta: batches submitted and ads created.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metricConfig.map(metric => (
                <button key={metric.key} type="button" onClick={() => setOpenMetric(metric.key)} className="rounded-xl border bg-card p-5 text-left shadow-sm transition hover:border-foreground/20">
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  {/* Delta on the same line as the number it qualifies: it is a footnote to
                      that number, and on its own row it read as a second metric. */}
                  <p className={`mt-2 flex flex-wrap items-baseline gap-x-2 text-3xl font-semibold tabular-nums ${metric.warning ? "text-amber-600" : ""}`}>
                    {metric.value}
                    {metric.delta !== undefined && <DeltaBadge value={metric.delta} unit={metric.deltaUnit} />}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">{metric.note}</p>
                  <p className="mt-3 inline-flex items-center gap-1 text-xs text-primary"><IconChartBar className="size-3" />Trend &amp; definition</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {view === "admin" && data.admin && (
          <section className="rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="font-semibold">Usage by member</h2>
                <p className="mt-1 text-sm text-muted-foreground">Launches and app activity in one row per person. Click a member for their detail and timeline.</p>
              </div>
              <IconRocket className="size-5 text-muted-foreground" />
            </div>
            {usageRows.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Nothing recorded in the selected reporting period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table data-table="comfortable" className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-5 font-medium">Member</th>
                      <th className="px-5 text-right font-medium" title="Ads that reached Meta: total ads minus failed ads, across every launch mode.">Ads launched</th>
                      <th className="px-5 text-right font-medium" title="Launch batches submitted in this period.">Batches</th>
                      <th className="px-5 text-right font-medium" title="Valuable actions in the app, launches included — creatives, templates, presets, edits, automation, page work. Page views, logins and filters do not count.">App actions</th>
                      <th className="px-5 text-right font-medium" title={`Days out of ${days} on which this person did at least one valuable action (Vietnam calendar days).`}>Active days</th>
                      <th className="px-5 text-right font-medium" title="How many distinct kinds of action the person used — how broadly, not how much.">Features used</th>
                      <th className="px-5 text-right font-medium" title="Consecutive days ending today with at least one launch.">Streak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageRows.map(member => {
                      const isSelf = member.userId === data.currentUserId
                      return (
                        <tr key={member.userId} className={`border-b last:border-0 ${isSelf ? "opacity-60" : "cursor-pointer hover:bg-muted/30"}`} onClick={() => { if (!isSelf) setMemberDetail({ userId: member.userId, name: member.name, avatarUrl: member.avatarUrl }) }} title={isSelf ? "See My usage tab" : "Open member detail"}>
                          <td className="px-5 font-medium">
                            <div className="flex items-center gap-2">
                              <TrackingMemberAvatar name={member.name} avatarUrl={member.avatarUrl} />
                              <span>{member.name}{isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</span>
                            </div>
                          </td>
                          <td className="px-5 text-right font-medium tabular-nums">{member.adsCreated}</td>
                          <td className="px-5 text-right tabular-nums text-muted-foreground">{member.batches}</td>
                          <td className="px-5 text-right tabular-nums">{activity?.available ? member.actions : "—"}</td>
                          <td className="px-5 text-right tabular-nums">{activity?.available ? `${member.activeDays}/${days}` : "—"}</td>
                          <td className="px-5 text-right tabular-nums text-muted-foreground">{activity?.available ? member.breadth : "—"}</td>
                          <td className="px-5 text-right tabular-nums text-muted-foreground">{(data.teamStreaks || {})[member.userId] || 0}d</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="border-t p-4 text-xs text-muted-foreground">
              {activity?.available
                ? "Sorted by ads launched, then app actions. It is a sort, not a score — the table describes how the product is used, not how hard anyone worked."
                : "App activity is not recorded on this project yet, so those three columns show — rather than 0. Launch columns are complete."}
            </p>
          </section>
        )}

        {view === "admin" && data.admin && (
          <details className="rounded-xl border bg-card shadow-sm">
            <summary className="cursor-pointer list-none p-5 text-sm text-muted-foreground transition hover:text-foreground">
              <span className="inline-flex items-center gap-1.5">
                <IconChevronRight className="size-3.5 transition-transform [details[open]_&]:rotate-90" />
                Launch funnel and failure reasons
              </span>
            </summary>
          <div className="grid gap-4 border-t p-5 lg:grid-cols-2">
            <section>
              <h3 className="text-sm font-medium">Launch funnel</h3>
              <p className="mt-1 text-xs text-muted-foreground">Only recorded stages are measured.</p>
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
            <section>
              <h3 className="text-sm font-medium">Failure reasons</h3>
              <p className="mt-1 text-xs text-muted-foreground">Unclassified stored error messages. Not app-vs-Meta attribution.</p>
              {(data.failureReasons || []).length === 0 ? <p className="mt-5 text-sm text-muted-foreground">No stored failure reasons in this period.</p> : <div className="mt-4 space-y-2">{(data.failureReasons || []).slice(0, 5).map(reason => <div key={reason.label} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-sm"><span className="truncate">{reason.label}</span><strong className="tabular-nums">{reason.count}</strong></div>)}</div>}
            </section>
          </div>
          </details>
        )}

        {view === "admin" && activity && activityBlock && (
          <ActivityPanel
            payload={activity}
            block={activityBlock}
            scope="team"
            deltaActions={data.previous.deltaActivity}
            deltaMembers={data.previous.deltaActiveMembers}
          />
        )}

        {/*
          Hand-logged, so it lives where the hand is: the person who left the app is the
          only one who can record it. On Team usage it would have been a read-only tile of
          somebody else's self-report — a number with no owner, which is how a
          self-reported metric stops being questioned.
        */}
        {view === "mine" && currentProbation && probation && (
          <KrCard
            score={currentProbation.score}
            week={currentProbation}
            scoreAvailable={probationEvidenceAvailable}
            loggingAvailable={probation.fallbackAvailable}
            unavailableReason={probationUnavailableReason}
            busy={fallbackBusy}
            error={fallbackError}
            onRecord={kind => void recordFallback(kind)}
            onUndo={() => void undoFallback()}
          />
        )}

        {/*
          The probation week is NOT a block here. It is appended to this person's own
          Report — a review of one person should travel by being sent, not by sitting on
          a screen someone else can read over their shoulder. See lib/tracking/probation.ts.
        */}

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

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Period report</DialogTitle>
            <DialogDescription>
              {isAdminView ? "Organization-wide" : "Your own"} numbers for the last {days} days, in the shape a PM sends upward. Four lines, every one labelled measured, estimated or unavailable — paste it as-is.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[62vh] space-y-4 overflow-auto">
            {/* The numbers first, then the text that quotes them. Same source either way —
                metricConfig is what the tiles on the page read. */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {view === "mine" && currentProbation && [
                { label: "KR total", value: probationEvidenceAvailable ? `${currentProbation.score.total}/100` : "-" },
                { label: "KR1 Launch", value: probationEvidenceAvailable ? `${currentProbation.score.kr1}/80` : "-" },
                { label: "KR2 Control", value: probationEvidenceAvailable ? `${currentProbation.score.kr2}/20` : "-" },
                { label: "Vs previous", value: probationEvidenceAvailable && previousProbation ? `${currentProbation.score.total - previousProbation.score.total >= 0 ? "+" : ""}${currentProbation.score.total - previousProbation.score.total}` : "n/a" },
              ].map(metric => (
                <div key={metric.label} className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{metric.value}</p>
                </div>
              ))}
              {metricConfig.map(metric => (
                <div key={metric.key} className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p className={`mt-1 flex flex-wrap items-baseline gap-x-1.5 text-xl font-semibold tabular-nums ${metric.warning ? "text-amber-600" : ""}`}>
                    {metric.value}
                    {metric.delta !== undefined && <DeltaBadge value={metric.delta} unit={metric.deltaUnit} />}
                  </p>
                </div>
              ))}
            </div>

            {isAdminView && series.length > 0 && (
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Ads created — organization, last {days} days</p>
                <div className="-mb-2 mt-1 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis dataKey="bucket" tickFormatter={v => formatBucket(String(v), days)} stroke="#898781" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis stroke="#898781" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={32} />
                      <Tooltip
                        contentStyle={{ background: "#1a1a19", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, fontSize: 12, color: "#ffffff" }}
                        itemStyle={{ color: "#ffffff" }}
                        labelStyle={{ color: "#898781" }}
                        labelFormatter={v => formatBucket(String(v), days)}
                      />
                      <Line type="monotone" dataKey="adsCreated" stroke="#3987e5" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Copy lives on the text it copies, not in the footer — the button and the
                thing it acts on were two scroll-lengths apart. */}
            <div className="relative">
              <div className="rounded-lg border bg-muted/20 p-4 pr-12">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Analysis</p>
                {view === "mine" && currentProbation ? (
                  <p className="mt-2 text-sm">{probationEvidenceAvailable ? `KR ${currentProbation.score.total}/100${previousProbation ? ` (${currentProbation.score.total - previousProbation.score.total >= 0 ? "+" : ""}${currentProbation.score.total - previousProbation.score.total} vs previous week)` : ""}. ${currentProbation.score.launchFallbacks} launch and ${currentProbation.score.controlFallbacks} control fallbacks recorded.` : probationUnavailableReason}</p>
                ) : data?.admin ? (
                  <p className="mt-2 text-sm">{data.admin.adsCreated} ads created at {data.admin.successRate}% full-batch success. {data.admin.nonSuccess} batches need review.</p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">No measurable analysis for this period.</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void copyReport()}
                title={copied ? "Đã copy" : "Copy markdown"}
                className="absolute right-2 top-2 rounded-md border bg-background/80 p-1.5 text-muted-foreground backdrop-blur transition hover:text-foreground"
              >
                {copied ? <IconCheck className="size-4 text-emerald-600" /> : <IconCopy className="size-4" />}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={memberDetail !== null} onOpenChange={open => { if (!open) { setMemberDetail(null); setMemberData(null) } }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {memberData && <TrackingMemberAvatar name={memberDetail?.name} avatarUrl={memberData.avatarUrl ?? memberDetail?.avatarUrl} size="default" />}
              {memberDetail?.name}
            </DialogTitle>
            <DialogDescription>Delivery and app activity in the last {days} days.</DialogDescription>
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
              {memberData.activity && (
                <div className="space-y-4 rounded-lg border p-4">
                  <div>
                    <h3 className="text-sm font-medium">App activity</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Work beyond pressing Launch. {memberData.activity.available ? "" : memberData.activity.unavailableReason}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "Actions", value: memberData.activity.total },
                      { label: "Active days", value: memberData.activity.activeDays },
                      { label: "Breadth", value: memberData.activity.byType.filter(type => type.count > 0).length },
                      { label: "Est. saved", value: `~${memberData.activity.estimatedHoursSaved}h` },
                    ].map(stat => (
                      <div key={stat.label} className="rounded-lg bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CLASS_ORDER.map(key => (
                      <span key={key} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs" title={CLASS_DESCRIPTION[key]}>
                        <span className={`size-1.5 rounded-full ${CLASS_BAR[key]}`} />
                        {CLASS_LABEL[key]}
                        <strong className="tabular-nums">{memberData.activity!.byClass[key]}</strong>
                      </span>
                    ))}
                  </div>
                  {memberData.activity.byType.filter(type => type.count > 0).length > 0 && (
                    <div className="space-y-2">
                      {memberData.activity.byType.filter(type => type.count > 0).map(type => (
                        <div key={type.key} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-1.5 text-xs">
                          <span className="flex min-w-0 items-center gap-2"><span className={`size-1.5 shrink-0 rounded-full ${CLASS_BAR[type.class]}`} /><span className="truncate">{type.label}</span></span>
                          <strong className="tabular-nums">{type.count}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {memberData.timeline && memberData.timeline.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium">Activity timeline</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Most recent first. Only recorded, person-initiated actions — cron and automation runs are excluded.</p>
                  <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto rounded-md border p-2">
                    {memberData.timeline.map((entry, index) => (
                      <div key={`${entry.at}-${index}`} className="flex items-start gap-2 rounded px-2 py-1 text-xs hover:bg-muted/40">
                        <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${CLASS_BAR[entry.class]}`} />
                        <span className="w-28 shrink-0 text-muted-foreground">{new Date(entry.at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="font-medium">{entry.label}</span>
                        {entry.detail && <span className="truncate text-muted-foreground">— {entry.detail}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
