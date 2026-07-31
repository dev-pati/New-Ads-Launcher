import { createAdminClient } from "@/lib/supabase/admin"
import { DEFAULT_CONFIG, weekRange } from "./config"
import type {
  ExceptionEntry,
  IssueEntry,
  MetricReading,
  PersonStatus,
  ProbationConfig,
  WeekEntry,
} from "./types"

/**
 * All persistence for the probation dashboard, over the single
 * `ads_launcher.probation_entries` table.
 *
 * Every function takes the owner email explicitly — it is the tenancy key. The
 * table has deny-all RLS, so these run through the admin client; the ONLY thing
 * standing between a caller and someone else's rows is that this module never
 * queries without `user_email`. Keep it that way.
 */

const TABLE = "probation_entries"

type Row = {
  id: string
  user_email: string
  kind: string
  week_key: string | null
  payload: Record<string, unknown>
  created_at: string
  updated_at: string
}

function db() {
  return createAdminClient()
}

/**
 * Surface every Postgres error instead of swallowing it.
 *
 * Supabase returns `{ data: null, error }` rather than throwing, so a missing
 * table or a denied insert reads as "no rows" unless you check. On this
 * dashboard that would mean a save returning ok and storing nothing, or a score
 * of 0/100 that is really "the table is not there yet" — a wrong number
 * presented as evidence. Both are worse than an error message.
 */
function unwrap<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    const missing = res.error.code === "42P01" || /does not exist/i.test(res.error.message)
    throw new Error(
      missing
        ? `${res.error.message} — run supabase/migrations/20260731_probation_entries.sql (needs sign-off; the shared project is locked).`
        : res.error.message
    )
  }
  return res.data
}

// ── Config ───────────────────────────────────────────────────────────────────

export async function getConfig(email: string): Promise<ProbationConfig> {
  const data = unwrap(
    await db()
      .from(TABLE)
      .select("payload")
      .eq("user_email", email)
      .eq("kind", "config")
      .maybeSingle()
  )

  const stored = (data as { payload?: unknown } | null)?.payload
  if (!stored || typeof stored !== "object") return DEFAULT_CONFIG
  // Shallow merge so a partially-edited config still boots.
  return { ...DEFAULT_CONFIG, ...(stored as Partial<ProbationConfig>) } as ProbationConfig
}

export async function saveConfig(email: string, config: ProbationConfig): Promise<void> {
  const client = db()
  const existing = unwrap(
    await client
      .from(TABLE)
      .select("id")
      .eq("user_email", email)
      .eq("kind", "config")
      .maybeSingle()
  )

  if (existing) {
    unwrap(
      await client.from(TABLE).update({ payload: config }).eq("id", (existing as { id: string }).id)
    )
  } else {
    unwrap(await client.from(TABLE).insert({ user_email: email, kind: "config", payload: config }))
  }
}

// ── Metric readings ──────────────────────────────────────────────────────────

export async function getReadings(email: string, weekKey: string): Promise<MetricReading[]> {
  const data = unwrap(
    await db()
      .from(TABLE)
      .select("payload")
      .eq("user_email", email)
      .eq("kind", "metric")
      .eq("week_key", weekKey)
  )

  return ((data || []) as { payload: MetricReading }[]).map((r) => r.payload)
}

export async function saveReading(email: string, reading: MetricReading): Promise<void> {
  const client = db()
  const existing = unwrap(
    await client
      .from(TABLE)
      .select("id")
      .eq("user_email", email)
      .eq("kind", "metric")
      .eq("week_key", reading.weekKey)
      .eq("payload->>metric_id", reading.metricId)
      .maybeSingle()
  )

  // metric_id is duplicated into the payload root because the unique index and
  // the lookup above both key on it. Keep the two in sync.
  const payload = { ...reading, metric_id: reading.metricId }

  if (existing) {
    unwrap(await client.from(TABLE).update({ payload }).eq("id", (existing as { id: string }).id))
  } else {
    unwrap(
      await client
        .from(TABLE)
        .insert({ user_email: email, kind: "metric", week_key: reading.weekKey, payload })
    )
  }
}

// ── Exceptions ───────────────────────────────────────────────────────────────

export async function listExceptions(email: string): Promise<ExceptionEntry[]> {
  const data = unwrap(
    await db()
      .from(TABLE)
      .select("id, payload, created_at")
      .eq("user_email", email)
      .eq("kind", "exception")
      .order("created_at", { ascending: false })
  )

  return ((data || []) as Row[]).map((r) => ({
    ...(r.payload as unknown as ExceptionEntry),
    id: r.id,
    createdAt: r.created_at,
  }))
}

export async function createException(
  email: string,
  entry: Omit<ExceptionEntry, "id" | "createdAt">
): Promise<void> {
  unwrap(await db().from(TABLE).insert({ user_email: email, kind: "exception", payload: entry }))
}

export async function updateException(
  email: string,
  id: string,
  patch: Partial<ExceptionEntry>
): Promise<void> {
  const client = db()
  const data = unwrap(
    await client
      .from(TABLE)
      .select("payload")
      .eq("id", id)
      .eq("user_email", email)
      .eq("kind", "exception")
      .maybeSingle()
  )
  if (!data) throw new Error("Exception not found")
  const merged = { ...((data as { payload: object }).payload as object), ...patch }
  unwrap(
    await client.from(TABLE).update({ payload: merged }).eq("id", id).eq("user_email", email)
  )
}

export async function deleteEntry(email: string, id: string): Promise<void> {
  unwrap(await db().from(TABLE).delete().eq("id", id).eq("user_email", email))
}

// ── Issues ───────────────────────────────────────────────────────────────────

export async function listIssues(email: string): Promise<IssueEntry[]> {
  const data = unwrap(
    await db()
      .from(TABLE)
      .select("id, payload, created_at")
      .eq("user_email", email)
      .eq("kind", "issue")
      .order("created_at", { ascending: false })
  )

  return ((data || []) as Row[]).map((r) => ({
    ...(r.payload as unknown as IssueEntry),
    id: r.id,
    createdAt: r.created_at,
  }))
}

export async function createIssue(
  email: string,
  entry: Omit<IssueEntry, "id" | "createdAt">
): Promise<void> {
  unwrap(await db().from(TABLE).insert({ user_email: email, kind: "issue", payload: entry }))
}

export async function updateIssue(
  email: string,
  id: string,
  patch: Partial<IssueEntry>
): Promise<void> {
  const client = db()
  const data = unwrap(
    await client
      .from(TABLE)
      .select("payload")
      .eq("id", id)
      .eq("user_email", email)
      .eq("kind", "issue")
      .maybeSingle()
  )
  if (!data) throw new Error("Issue not found")
  const merged = { ...((data as { payload: object }).payload as object), ...patch }
  unwrap(
    await client.from(TABLE).update({ payload: merged }).eq("id", id).eq("user_email", email)
  )
}

// ── Weekly snapshots ─────────────────────────────────────────────────────────

export async function getWeek(email: string, weekKey: string): Promise<WeekEntry | null> {
  const data = unwrap(
    await db()
      .from(TABLE)
      .select("payload")
      .eq("user_email", email)
      .eq("kind", "week")
      .eq("week_key", weekKey)
      .maybeSingle()
  )

  return data ? ((data as { payload: WeekEntry }).payload as WeekEntry) : null
}

export async function listWeeks(email: string): Promise<WeekEntry[]> {
  const data = unwrap(
    await db()
      .from(TABLE)
      .select("payload, week_key")
      .eq("user_email", email)
      .eq("kind", "week")
      .order("week_key", { ascending: false })
  )

  return ((data || []) as { payload: WeekEntry }[]).map((r) => r.payload)
}

export async function saveWeek(email: string, entry: WeekEntry): Promise<void> {
  const client = db()
  const existing = unwrap(
    await client
      .from(TABLE)
      .select("id")
      .eq("user_email", email)
      .eq("kind", "week")
      .eq("week_key", entry.weekKey)
      .maybeSingle()
  )

  if (existing) {
    unwrap(
      await client.from(TABLE).update({ payload: entry }).eq("id", (existing as { id: string }).id)
    )
  } else {
    unwrap(
      await client
        .from(TABLE)
        .insert({ user_email: email, kind: "week", week_key: entry.weekKey, payload: entry })
    )
  }
}

// ── Auto-detection from launch_batches ───────────────────────────────────────

export interface AutoLaunch {
  userName: string
  batches: number
  totalAds: number
  lastAt: string
}

/**
 * Successful launches per user for one ISO week, read from `launch_batches`.
 *
 * This is the only genuinely automatic input in the whole dashboard: all three
 * launch routes write this table, so a row is proof the app produced ads. It
 * proves whose ACCOUNT launched — not that they were unaided. The "unaided" call
 * stays with the owner (metric source `auto_confirmed`).
 */
export async function getWeekLaunches(weekKey: string): Promise<AutoLaunch[]> {
  const { start, end } = weekRange(weekKey)
  const data = unwrap(
    await db()
      .from("launch_batches")
      .select("user_name, total_ads, created_at, status")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .eq("status", "success")
      .order("created_at", { ascending: false })
  )

  const rows = (data || []) as {
    user_name: string | null
    total_ads: number | null
    created_at: string
    status: string
  }[]

  const byUser = new Map<string, AutoLaunch>()
  for (const row of rows) {
    const name = (row.user_name || "unknown").trim()
    const existing = byUser.get(name)
    if (existing) {
      existing.batches += 1
      existing.totalAds += row.total_ads || 0
    } else {
      byUser.set(name, {
        userName: name,
        batches: 1,
        totalAds: row.total_ads || 0,
        lastAt: row.created_at,
      })
    }
  }
  return [...byUser.values()]
}

/**
 * Per-person adoption for one week: who launched, how much, how fast, and when
 * they were last seen.
 *
 * Every field comes from tables that already exist. Nothing new is tracked, and
 * deliberately so — the plan (§3.1) rejects activity metrics, so there is no
 * login counter here and there should not be one. `last_sign_in_at` is a single
 * overwritten timestamp, which is all the app has ever stored.
 */
export async function getPeopleStatus(
  config: ProbationConfig,
  weekKey: string,
  readings: MetricReading[]
): Promise<PersonStatus[]> {
  const { start, end } = weekRange(weekKey)
  const people = config.metrics.filter((m) => m.source === "auto_confirmed" && m.autoUserMatch)
  if (people.length === 0) return []

  const rows = unwrap(
    await db()
      .from("launch_batches")
      .select("user_id, user_name, total_ads, failed_ads, duration_ms, created_at, status")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .eq("status", "success")
  ) as {
    user_id: string | null
    user_name: string | null
    total_ads: number | null
    failed_ads: number | null
    duration_ms: number | null
    created_at: string
  }[]

  // One lookup for everyone, matched on name or email — a person who did not
  // launch has no row above, so their user_id is unknown from batches alone.
  const accounts = unwrap(
    await db().from("accounts").select("id, email, full_name, last_sign_in_at")
  ) as {
    id: string
    email: string | null
    full_name: string | null
    last_sign_in_at: string | null
  }[]

  return people.map((def) => {
    const needle = (def.autoUserMatch as string).toLowerCase()
    const mine = rows.filter((r) => (r.user_name || "").toLowerCase().includes(needle))
    const account = accounts.find(
      (a) =>
        (a.full_name || "").toLowerCase().includes(needle) ||
        (a.email || "").toLowerCase().includes(needle) ||
        mine.some((r) => r.user_id === a.id)
    )

    const totalMs = mine.reduce((s, r) => s + (r.duration_ms || 0), 0)
    const timed = mine.filter((r) => r.duration_ms)
    const lastLaunchAt = mine.reduce<string | null>(
      (acc, r) => (!acc || r.created_at > acc ? r.created_at : acc),
      null
    )

    return {
      metricId: def.id,
      label: def.label,
      matched: mine[0]?.user_name || account?.full_name || (def.autoUserMatch as string),
      launches: mine.length,
      ads: mine.reduce((s, r) => s + (r.total_ads || 0), 0),
      failedAds: mine.reduce((s, r) => s + (r.failed_ads || 0), 0),
      avgMs: timed.length > 0 ? Math.round(totalMs / timed.length) : null,
      totalMs,
      lastLaunchAt,
      lastLoginAt: account?.last_sign_in_at ?? null,
      confirmedUnaided: readings.find((r) => r.metricId === def.id)?.confirmed === true,
    }
  })
}

/** True when someone whose name matches `needle` launched successfully that week. */
export function launchedBy(launches: AutoLaunch[], needle: string | undefined): AutoLaunch | null {
  if (!needle) return null
  const n = needle.toLowerCase()
  return launches.find((l) => l.userName.toLowerCase().includes(n)) ?? null
}
