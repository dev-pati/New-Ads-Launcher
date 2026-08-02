import type { ProbationConfig } from "./types"

/**
 * Default KR configuration for probation month 2.
 *
 * The plan document (chốt 29/07/2026) defines the weights — KR1 80%, KR2 20% —
 * and names every metric, but the sections holding the per-metric points and the
 * "Ngưỡng quyết định probation" pass mark are empty in the plan itself. The
 * splits below were derived from the plan's wording and marked PROPOSED until
 * 31/07/2026, when the owner confirmed them. `confirmed: true` removes the
 * banner; the Scoring tab is where they are changed from here on.
 *
 * Changing any of this is a single JSONB row update via PUT /api/probation/config
 * — no migration. That is why option B (one generic table) was chosen.
 */

/**
 * The two colleagues KR1 depends on, from `PROBATION_TRACKED_USERS`
 * (comma-separated, exactly two).
 *
 * Names, not ids: `autoUserMatch` is matched against `launch_batches.user_name`
 * and `accounts.email`, so the value has to be what those columns actually hold.
 * That makes it real people's names, which is why it comes from the environment
 * — this repository is public and a colleague's name is not the product's data.
 *
 * Read once at import, and only used to seed a config row. Once the owner saves
 * from the Scoring tab the config lives in the DB and this stops being consulted.
 */
const TRACKED = (process.env.PROBATION_TRACKED_USERS || "User 1,User 2")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

const USER_1 = TRACKED[0] || "User 1"
const USER_2 = TRACKED[1] || "User 2"

/** Shown in the weekly report header. Never a default with a real name in it. */
export function getOwnerDisplayName(): string {
  return process.env.PROBATION_OWNER_NAME?.trim() || "PM"
}

export const DEFAULT_CONFIG: ProbationConfig = {
  confirmed: true,
  startDate: "2026-07-29", // day 31 — PROPOSED, derived from plan chốt date
  endDate: "2026-08-27", // day 60 — PROPOSED

  krs: [
    { id: "KR1", label: "Launch Ads", weight: 80 },
    { id: "KR2", label: "Control Ads", weight: 20 },
  ],

  metrics: [
    // ── KR1 — Launch Ads (80 points) ────────────────────────────────────────
    {
      id: "launch_user_1",
      kr: "KR1",
      label: `${USER_1} tự launch được`,
      shortLabel: USER_1,
      points: 30,
      kind: "boolean",
      source: "auto_confirmed",
      autoUserMatch: USER_1.toLowerCase(),
      howMeasured:
        "Detected from launch_batches: a successful batch by this user during the " +
        "week. You then confirm it was unaided — the DB can prove their account " +
        "launched, not that nobody walked them through it.",
    },
    {
      id: "launch_user_2",
      kr: "KR1",
      label: `${USER_2} tự launch được`,
      shortLabel: USER_2,
      points: 30,
      kind: "boolean",
      source: "auto_confirmed",
      autoUserMatch: USER_2.toLowerCase(),
      howMeasured:
        "Detected from launch_batches: a successful batch by this user during the " +
        "week, then confirmed unaided.",
    },
    {
      id: "launch_fallback",
      kr: "KR1",
      label: "Launch fallback",
      points: 20,
      kind: "defect_count",
      source: "manual",
      budget: 0,
      penaltyPerOccurrence: 10,
      howMeasured:
        "Weekly: filter the tracked users' ad account in Meta Ads Manager. Ads WITHOUT " +
        "the [APP]_ prefix were launched by hand — each one is a fallback. " +
        "Reconcile against the app's launch history.",
    },

    // ── KR2 — Control Ads (20 points) ───────────────────────────────────────
    {
      id: "review_status_fallback",
      kr: "KR2",
      label: "Review status fallback",
      points: 6,
      kind: "defect_count",
      source: "manual",
      budget: 0,
      penaltyPerOccurrence: 3,
      howMeasured:
        "Count of times a tracked user had to open Ads Manager to check ad review " +
        "status because the app could not show it. Manual — the app cannot observe " +
        "a user going somewhere else.",
    },
    {
      id: "performance_fallback",
      kr: "KR2",
      label: "Performance ads fallback",
      points: 6,
      kind: "defect_count",
      source: "manual",
      budget: 0,
      penaltyPerOccurrence: 3,
      howMeasured:
        "Count of times a tracked user had to open Ads Manager to read performance " +
        "numbers. Manual, same reason.",
    },
    {
      id: "creative_aggregate",
      kr: "KR2",
      label: "Creative aggregate works",
      points: 4,
      kind: "boolean",
      source: "manual",
      howMeasured: "Your call: does creative-level aggregation work end to end this week?",
    },
    {
      id: "data_accuracy",
      kr: "KR2",
      label: "Data accuracy spot check",
      points: 4,
      kind: "ratio",
      source: "manual",
      denominator: 5,
      howMeasured:
        "Pick 5 ads, compare the app's numbers against Ads Manager by eye, record " +
        "how many matched. This CANNOT be automated — the app reads Meta's API, so " +
        "comparing app numbers to that same API would always pass and prove nothing.",
    },
  ],

  thresholds: {
    onTrack: 80,
    warning: 65,
    pass: 80, // "Ngưỡng quyết định probation" — empty in the plan, set here
  },

  // Both ASSUMPTIONS. 15 min/ad matches the unsourced constant already in
  // app/api/insights/statistics/upload-stats/route.ts:117, kept identical so the
  // two screens cannot disagree. Neither number has been measured; every screen
  // that shows a derived saving says so.
  minutesPerAdManual: 15,
  hourlyCostVnd: 250_000,

  // Closed set — plan lines 75-83. Deliberately not free text: the plan fixed
  // these to close the argument ("chống cãi nhau cuối kỳ"), so the UI must not
  // reopen it.
  exceptionCategories: [
    { id: "meta_downtime", label: "Meta API downtime / outage (status page confirmed)" },
    { id: "meta_policy_reject", label: "Ad rejected by Meta policy (app launched correctly)" },
    { id: "meta_token_expiry", label: "Meta token expired by Meta policy (not a missed refresh)" },
    { id: "user_error", label: "User picked wrong option, UI correct (>2 same cause = UX fail)" },
    { id: "upstream_creative", label: "Creative source broken upstream (Creative app)" },
  ],
}

/** ISO week key, e.g. "2026-W31". Weeks run Mon–Sun; reports go out Saturday. */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  // Thursday of the current week decides the ISO year.
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

/** Monday 00:00 and Monday-next 00:00 for an ISO week key. */
export function weekRange(weekKey: string): { start: Date; end: Date } {
  const [yearStr, weekStr] = weekKey.split("-W")
  const year = parseInt(yearStr, 10)
  const week = parseInt(weekStr, 10)
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1)
  const start = new Date(week1Monday)
  start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 7)
  return { start, end }
}

/** Week keys from probation start to today, oldest first. */
export function weeksElapsed(config: ProbationConfig, today: Date): string[] {
  const start = new Date(`${config.startDate}T00:00:00Z`)
  const end = new Date(`${config.endDate}T00:00:00Z`)
  const cutoff = today < end ? today : end
  const keys: string[] = []
  const cursor = new Date(start)
  while (cursor <= cutoff) {
    const key = isoWeekKey(cursor)
    if (!keys.includes(key)) keys.push(key)
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }
  const todayKey = isoWeekKey(cutoff)
  if (!keys.includes(todayKey)) keys.push(todayKey)
  return keys
}
