/**
 * Types for the probation dashboard.
 *
 * Vocabulary follows the probation plan document (kept out of this repo).
 * "Fallback" = the user could not finish the job in the app and went back to
 * Meta Ads Manager. It is a defect count, not an activity count — the plan
 * rejects activity metrics explicitly (§3.1).
 */

export type EntryKind = "config" | "metric" | "exception" | "issue" | "week"

/** How a metric's value is produced. */
export type MetricSource =
  /** Derived from launch_batches. No typing required. */
  | "auto"
  /** Auto-detected, then confirmed by the owner (e.g. "unaided?"). */
  | "auto_confirmed"
  /** Weekly manual reading — the app cannot observe it. */
  | "manual"

/** How a value becomes a score. */
export type MetricKind =
  /** Boolean: true scores full points. */
  | "boolean"
  /** Defect count: 0 scores full, each occurrence over `budget` costs points. */
  | "defect_count"
  /** Ratio: `value` of `denominator` matched, scored proportionally. */
  | "ratio"

export interface MetricDef {
  id: string
  kr: "KR1" | "KR2"
  label: string
  /** Compact form for the weekly report's one-line rows. Falls back to `label`. */
  shortLabel?: string
  /** Points this metric contributes to the 100-point total. */
  points: number
  kind: MetricKind
  source: MetricSource
  /** defect_count: occurrences allowed before points are lost. */
  budget?: number
  /** defect_count: points lost per occurrence beyond budget. */
  penaltyPerOccurrence?: number
  /** ratio: denominator, e.g. 5 for "X/5 spot checks matched". */
  denominator?: number
  /** Which launch_batches user this auto metric counts. */
  autoUserMatch?: string
  /** Shown in the UI so every number is explainable. */
  howMeasured: string
}

export interface KrDef {
  id: "KR1" | "KR2"
  label: string
  /** Percentage weight — KR1 80, KR2 20. */
  weight: number
}

export interface ProbationConfig {
  /** True once the point splits are confirmed by the reviewers. Drives the PROPOSED banner. */
  confirmed: boolean
  startDate: string // ISO date, day 31
  endDate: string // ISO date, day 60
  krs: KrDef[]
  metrics: MetricDef[]
  thresholds: {
    /** Score at or above this = On Track. */
    onTrack: number
    /** Score at or above this (below onTrack) = Warning. Below = Off Track. */
    warning: number
    /** Pass mark for probation — "Ngưỡng quyết định probation". */
    pass: number
  }
  /** Closed set — plan lines 75-83, deliberately not free text. */
  exceptionCategories: { id: string; label: string }[]
  /**
   * Minutes one ad takes in Meta Ads Manager — the manual baseline the app is
   * compared against. THIS IS AN ASSUMPTION, not a measurement: nobody has timed
   * it. Every hours-saved and cost-saved number derives from it, so it is
   * editable and labelled as an assumption wherever it surfaces. Time someone
   * doing five ads by hand and this becomes evidence.
   */
  minutesPerAdManual: number
  /** Loaded hourly cost of the person doing it, VND. Same caveat. */
  hourlyCostVnd: number
}

export interface MetricReading {
  metricId: string
  weekKey: string
  /** boolean → 0|1, defect_count → occurrences, ratio → numerator. */
  value: number
  /** auto_confirmed: owner's "unaided" call. */
  confirmed?: boolean
  note?: string
  evidence?: string
}

export interface ExceptionEntry {
  id: string
  date: string
  category: string
  description: string
  evidence: string
  approved: boolean
  /** Which metric's failures this excuses. Empty = all. */
  metricId?: string
  createdAt: string
}

export interface IssueEntry {
  id: string
  issue: string
  owner: string
  deadline: string
  status: "open" | "closed"
  createdAt: string
}

export interface WeekEntry {
  weekKey: string
  /** Score the app computed from metrics at the time the week was closed. */
  selfScore: number | null
  /** Score the reviewers gave. Null until they reply. */
  confirmedScore: number | null
  confirmedBy?: string
  confirmedNote?: string
  /** Rule #4: no reply = no data = that metric fails. */
  reportSentAt: string | null
  repliedAt: string | null
  /**
   * The report text as it stood. A draft is regenerated from live metrics and
   * stays editable; once sent it is frozen, because what you were scored on is
   * the text they read, not what the numbers say afterwards.
   */
  reportText?: string
  reportState?: "draft" | "sent"
}

/**
 * One person the KRs depend on, for the week. Everything here is read from
 * `launch_batches` and `accounts` — no new tracking.
 */
export interface PersonStatus {
  /** The metric this person's launch answers, e.g. `launch_user_1`. */
  metricId: string
  label: string
  matched: string
  launches: number
  ads: number
  failedAds: number
  /** Mean duration_ms across the week's batches, null when nothing launched. */
  avgMs: number | null
  totalMs: number
  lastLaunchAt: string | null
  /**
   * Last login, not a login COUNT — `accounts.last_sign_in_at` is overwritten
   * on every sign-in, so a count does not exist. Shown as context for chasing a
   * reply, never scored: the plan (§3.1) rejects activity metrics by name.
   */
  lastLoginAt: string | null
  /** The owner's "unaided" call, from the stored reading. */
  confirmedUnaided: boolean
}

export type TrackStatus = "on_track" | "warning" | "off_track"

export interface MetricResult {
  def: MetricDef
  /** Null when nothing has been recorded for the week yet. */
  value: number | null
  earned: number
  /** Points available — reduced to 0 when an approved exception voids it. */
  possible: number
  excused: boolean
  confirmed?: boolean
  note?: string
  evidence?: string
  /** Plain-English derivation shown in the UI. Every metric is explainable. */
  explanation: string
}

export interface KrResult {
  def: KrDef
  metrics: MetricResult[]
  earned: number
  possible: number
  status: TrackStatus
}

export interface ScoreResult {
  krs: KrResult[]
  selfScore: number
  /** Sum of possible points that were actually measurable this week. */
  possible: number
  status: TrackStatus
  confirmedScore: number | null
  /** selfScore - confirmedScore. The number worth looking at. */
  gap: number | null
}
