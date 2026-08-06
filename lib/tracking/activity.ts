/**
 * Turns raw activity rows into the App Activity half of Usage.
 *
 * Pure functions only — no Supabase, no fetch — so the rules below are testable
 * without a database. lib/tracking/summary.ts does the same for Delivery.
 *
 * Two rules that are easy to get wrong and expensive to get wrong:
 *
 *   1. **A launch is counted once.** Batches come from launch_batches (complete
 *      history); the matching activity_log rows are dropped via EXCLUDED_MATCHES.
 *   2. **Machines are not people.** Automation executions are the numerator of
 *      automation coverage, never a member's valuable-action count. Anything with
 *      no actor_id, or source = cron/automation, is excluded from per-member numbers.
 */

import {
  ACTIVITY_CATALOG,
  AUTOMATION_MINUTES_SAVED,
  CLASS_ORDER,
  EXCLUDED_MATCHES,
  activityFor,
  type ActivityClass,
  type ActivityDefinition,
} from "./activity-catalog"
import { toVietnamDateKey } from "./summary"

export type ActivityRow = {
  actor_id: string | null
  actor_name: string | null
  object_type: string
  action: string
  created_at: string
  source?: string | null
}

export type PageActivityRow = {
  actor_id: string | null
  module: string
  created_at: string
}

export type ActivityMember = {
  userId: string
  name: string
  actions: number
  activeDays: number
  /** How many distinct activity types this person used — breadth of the product. */
  breadth: number
  byClass: Record<ActivityClass, number>
}

export type ActivityTypeCount = {
  key: string
  label: string
  class: ActivityClass
  status: ActivityDefinition["status"]
  /** The screen this action happens on — so a class total can be traced to a function. */
  surface: string
  count: number
}

export type ActivitySeriesPoint = {
  bucket: string
  produce: number
  reuse: number
  govern: number
  collaborate: number
}

export type ActivitySummary = {
  /** Valuable actions in the period, launches included. */
  total: number
  byClass: Record<ActivityClass, number>
  byType: ActivityTypeCount[]
  byMember: ActivityMember[]
  series: ActivitySeriesPoint[]
  /** Members with at least one valuable action — the WAU numerator. */
  activeMembers: number
  /** Distinct calendar days (Asia/Ho_Chi_Minh) with at least one valuable action. */
  activeDays: number
  /** Catalog entries nobody performed. Split so the UI never shows 0 for an uninstrumented act. */
  unused: ActivityTypeCount[]
  notInstrumented: ActivityTypeCount[]
  /** Always render with the word "estimated". Built from stated assumptions, not measurement. */
  estimatedMinutesSaved: number
}

const EMPTY_BY_CLASS = (): Record<ActivityClass, number> => ({
  produce: 0,
  reuse: 0,
  govern: 0,
  collaborate: 0,
})

/** Written by a cron, a worker or an automation rather than by a person. */
function isMachineRow(row: ActivityRow) {
  if (!row.actor_id) return true
  const source = (row.source || "app").toLowerCase()
  return source === "cron" || source === "automation" || source === "system"
}

/**
 * One activity per row. Rows we do not recognise are dropped rather than bucketed
 * into "other": an unnamed number on a dashboard is worse than no number.
 */
function definitionForRow(row: ActivityRow): ActivityDefinition | undefined {
  const pair = `${row.object_type}:${row.action}`
  if (EXCLUDED_MATCHES.has(pair)) return undefined
  return activityFor(row.object_type, row.action)
}

export type SummarizeActivityInput = {
  rows: ActivityRow[]
  pageRows?: PageActivityRow[]
  /** Launch batches, counted as the launch.submitted activity. */
  batches?: Array<{ user_id: string; user_name: string | null; created_at?: string | null }>
  /** Restrict every number to one member — powers the My usage tab. */
  onlyUserId?: string | null
}

export function summarizeActivity(input: SummarizeActivityInput): ActivitySummary {
  const counts = new Map<string, number>()
  const members = new Map<string, { name: string; days: Set<string>; keys: Set<string>; actions: number; byClass: Record<ActivityClass, number> }>()
  const buckets = new Map<string, ActivitySeriesPoint>()
  const activeDays = new Set<string>()
  const byClass = EMPTY_BY_CLASS()
  let total = 0
  let estimatedMinutesSaved = 0

  const record = (
    definition: ActivityDefinition,
    actorId: string | null,
    actorName: string | null,
    createdAt: string | null | undefined
  ) => {
    if (input.onlyUserId && actorId !== input.onlyUserId) return

    total += 1
    byClass[definition.class] += 1
    counts.set(definition.key, (counts.get(definition.key) || 0) + 1)
    estimatedMinutesSaved += definition.minutesSaved || 0

    const dateKey = createdAt ? toVietnamDateKey(createdAt) : null
    if (dateKey) {
      activeDays.add(dateKey)
      const point = buckets.get(dateKey) || { bucket: dateKey, produce: 0, reuse: 0, govern: 0, collaborate: 0 }
      point[definition.class] += 1
      buckets.set(dateKey, point)
    }

    if (!actorId) return
    const member = members.get(actorId) || {
      name: actorName || "Unknown",
      days: new Set<string>(),
      keys: new Set<string>(),
      actions: 0,
      byClass: EMPTY_BY_CLASS(),
    }
    if (actorName && member.name === "Unknown") member.name = actorName
    member.actions += 1
    member.byClass[definition.class] += 1
    member.keys.add(definition.key)
    if (dateKey) member.days.add(dateKey)
    members.set(actorId, member)
  }

  const launchDefinition = ACTIVITY_CATALOG.find(definition => definition.key === "launch.submitted")!
  for (const batch of input.batches || []) {
    record(launchDefinition, batch.user_id, batch.user_name, batch.created_at)
  }

  for (const row of input.rows) {
    if (isMachineRow(row)) continue
    const definition = definitionForRow(row)
    if (!definition) continue
    record(definition, row.actor_id, row.actor_name, row.created_at)
  }

  for (const row of input.pageRows || []) {
    const definition = activityFor("page_manage", row.module)
    if (!definition || !row.actor_id) continue
    record(definition, row.actor_id, null, row.created_at)
  }

  const byType: ActivityTypeCount[] = ACTIVITY_CATALOG.map(definition => ({
    key: definition.key,
    label: definition.label,
    class: definition.class,
    status: definition.status,
    surface: definition.surface,
    count: counts.get(definition.key) || 0,
  }))

  const byMember: ActivityMember[] = [...members.entries()]
    .map(([userId, member]) => ({
      userId,
      name: member.name,
      actions: member.actions,
      activeDays: member.days.size,
      breadth: member.keys.size,
      byClass: member.byClass,
    }))
    .sort((left, right) => right.actions - left.actions || left.name.localeCompare(right.name))

  return {
    total,
    byClass,
    byType: byType.sort(
      (left, right) =>
        right.count - left.count ||
        CLASS_ORDER.indexOf(left.class) - CLASS_ORDER.indexOf(right.class) ||
        left.label.localeCompare(right.label)
    ),
    byMember,
    series: [...buckets.values()].sort((left, right) => left.bucket.localeCompare(right.bucket)),
    activeMembers: members.size,
    activeDays: activeDays.size,
    unused: byType.filter(type => type.count === 0 && type.status === "live"),
    notInstrumented: byType.filter(type => type.status !== "live"),
    estimatedMinutesSaved,
  }
}

/**
 * How much of the govern work the machine did.
 *
 * Numerator is automation executions; denominator adds the govern-class actions a
 * person performed by hand. 100% would mean nobody had to touch a live ad manually.
 * Returns null when neither happened — an empty period is not 0% coverage.
 */
export function automationCoverage(executions: number, humanGovernActions: number): number | null {
  const total = executions + humanGovernActions
  if (total === 0) return null
  return Math.round((executions / total) * 100)
}

/**
 * Reuse actions per launch. Deliberately a ratio, not the percentage everyone wants.
 *
 * The real question — "what share of launches reused a template or preset" — needs
 * template.applied / preset.applied, which nothing records (see the catalog). Naming
 * this a rate would be claiming an answer we do not have.
 */
export function leverageRatio(reuseActions: number, batches: number): number | null {
  if (batches === 0) return null
  return Math.round((reuseActions / batches) * 100) / 100
}

export function estimatedHoursSaved(minutesFromActivities: number, automationExecutions: number): number {
  const minutes = minutesFromActivities + automationExecutions * AUTOMATION_MINUTES_SAVED
  return Math.round((minutes / 60) * 10) / 10
}

/** Percentage change against the previous window of equal length. null when there is no base. */
export function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 100)
}

export type UsageRow = {
  userId: string
  name: string
  adsCreated: number
  batches: number
  actions: number
  activeDays: number
  breadth: number
}

/**
 * One row per person, from the two half-pictures the app records separately.
 *
 * A member who launched but did nothing else, and a member who did plenty but never
 * pressed Launch, are both real and both belong in the table — so this is a full outer
 * join on user id, not a lookup from either side. Dropping either side is how a
 * dashboard starts telling people that quiet work is no work.
 *
 * Order: ads launched first, then app actions, then name — the reading order of the
 * question the page exists to answer. It is a sort, not a score.
 */
export function mergeUsageRows(
  delivery: Array<{ userId: string; name: string; adsCreated: number; batches: number }>,
  activity: Array<{ userId: string; name: string; actions: number; activeDays: number; breadth: number }>,
): UsageRow[] {
  const rows = new Map<string, UsageRow>()

  for (const member of delivery) {
    rows.set(member.userId, {
      userId: member.userId,
      name: member.name,
      adsCreated: member.adsCreated,
      batches: member.batches,
      actions: 0,
      activeDays: 0,
      breadth: 0,
    })
  }

  for (const member of activity) {
    const existing = rows.get(member.userId)
    if (existing) {
      existing.actions = member.actions
      existing.activeDays = member.activeDays
      existing.breadth = member.breadth
      if (!existing.name) existing.name = member.name
      continue
    }
    rows.set(member.userId, {
      userId: member.userId,
      name: member.name,
      adsCreated: 0,
      batches: 0,
      actions: member.actions,
      activeDays: member.activeDays,
      breadth: member.breadth,
    })
  }

  return [...rows.values()].sort(
    (left, right) =>
      right.adsCreated - left.adsCreated ||
      right.actions - left.actions ||
      left.name.localeCompare(right.name),
  )
}
