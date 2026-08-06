/**
 * The fallback tally, counted by hand and kept on the person's own machine.
 *
 * It started as a table (`meta_fallback_events`) and a POST route. Both are gone. Two
 * reasons, and the second is the one that matters:
 *
 *   1. The migration is not applied on the shared project and applying it needs sign-off,
 *      so the feature could not be used at all — a card whose only action returns 500.
 *   2. The number is self-reported anyway. Nothing in the app can see a person opening
 *      Ads Manager in another tab; only they know. Storing a hand-typed number in a
 *      server table would have dressed a personal tally as organisational measurement,
 *      and the first time someone quoted it in a review it would have been believed more
 *      than it deserves.
 *
 * So it lives in localStorage, on My usage, for the person doing the counting. That is
 * exactly as much authority as the number has. When a *measured* fallback signal exists —
 * BL-40, ad_insights_snapshots minus creatives.fb_ad_id — it can be a table, because then
 * it will be evidence rather than a memory.
 *
 * Every function here takes storage as an argument so the logic is testable without a
 * browser, and returns plain data so the card never has to parse JSON itself.
 */

import { FALLBACK_REASONS, type FallbackReason } from "./fallback"

export const FALLBACK_STORAGE_KEY = "adlauncher.tracking.fallback.v1"

/** Weeks kept per user. Two months is enough for a month-to-date figure and a look back. */
export const KEPT_WEEKS = 10

export type LocalFallbackWeek = {
  weekStart: string
  counts: Record<FallbackReason, number>
  /** One free-text note for the week — the sentence that turns into a backlog item. */
  note: string
  /** Weekly self-answers. null means unanswered, which is not the same as "no". */
  creativeAggregate: "works" | "not_yet" | null
  spotCheckMatched: number | null
  spotCheckTotal: number
}

/** `{ [userId]: { [weekStart]: week } }` — one blob, so one read and one write. */
export type LocalFallbackStore = Record<string, Record<string, LocalFallbackWeek>>

/** The minimal storage surface used here — `Storage` in a browser, a Map-alike in tests. */
export type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function emptyCounts(): Record<FallbackReason, number> {
  return Object.fromEntries(FALLBACK_REASONS.map(reason => [reason, 0])) as Record<FallbackReason, number>
}

export function emptyWeek(weekStart: string): LocalFallbackWeek {
  return {
    weekStart,
    counts: emptyCounts(),
    note: "",
    creativeAggregate: null,
    spotCheckMatched: null,
    spotCheckTotal: 5,
  }
}

/**
 * Reads one week back, repairing anything the shape check does not like.
 *
 * localStorage is user-writable and survives deploys, so a stored blob is untrusted
 * input. A malformed entry becomes an empty week rather than an exception — losing a
 * hand-kept tally is bad; a dashboard that throws on load is worse.
 */
export function readWeek(storage: StorageLike | null | undefined, userId: string, weekStart: string): LocalFallbackWeek {
  const store = readStore(storage)
  const stored = store[userId]?.[weekStart]
  if (!stored) return emptyWeek(weekStart)

  const counts = emptyCounts()
  for (const reason of FALLBACK_REASONS) {
    const value = stored.counts?.[reason]
    counts[reason] = Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : 0
  }

  return {
    weekStart,
    counts,
    note: typeof stored.note === "string" ? stored.note : "",
    creativeAggregate: stored.creativeAggregate === "works" || stored.creativeAggregate === "not_yet" ? stored.creativeAggregate : null,
    spotCheckMatched: Number.isFinite(stored.spotCheckMatched) ? (stored.spotCheckMatched as number) : null,
    spotCheckTotal: Number.isFinite(stored.spotCheckTotal) && (stored.spotCheckTotal as number) > 0 ? (stored.spotCheckTotal as number) : 5,
  }
}

export function readStore(storage: StorageLike | null | undefined): LocalFallbackStore {
  if (!storage) return {}
  try {
    const raw = storage.getItem(FALLBACK_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as LocalFallbackStore) : {}
  } catch {
    return {}
  }
}

/** Writes one week back and prunes old ones, so the blob cannot grow forever. */
export function writeWeek(storage: StorageLike | null | undefined, userId: string, week: LocalFallbackWeek): LocalFallbackStore {
  const store = readStore(storage)
  const forUser = { ...(store[userId] || {}), [week.weekStart]: week }

  const kept = Object.keys(forUser)
    .sort((left, right) => right.localeCompare(left))
    .slice(0, KEPT_WEEKS)

  const next: LocalFallbackStore = {
    ...store,
    [userId]: Object.fromEntries(kept.map(key => [key, forUser[key]])),
  }

  try {
    storage?.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Private mode, or a full quota. The card keeps working on in-memory state for this
    // session; silently failing beats blocking someone from counting.
  }
  return next
}

/** Every week this user has stored, oldest first — the month-to-date figure reads this. */
export function weeksInRange(
  storage: StorageLike | null | undefined,
  userId: string,
  fromWeek: string,
  toWeekExclusive: string,
): LocalFallbackWeek[] {
  const forUser = readStore(storage)[userId] || {}
  return Object.keys(forUser)
    .filter(week => week >= fromWeek && week < toWeekExclusive)
    .sort()
    .map(week => readWeek(storage, userId, week))
}

export function totalCount(week: LocalFallbackWeek): number {
  return FALLBACK_REASONS.reduce((sum, reason) => sum + week.counts[reason], 0)
}

/**
 * The counts as the score expects them — one entry per occurrence.
 *
 * scoreProbationWeek takes a list because the table version handed it rows. Rebuilding
 * the list from counts keeps that function untouched and keeps one scoring path.
 */
export function toScoreFallbacks(week: LocalFallbackWeek): Array<{ reason: FallbackReason }> {
  return FALLBACK_REASONS.flatMap(reason => Array.from({ length: week.counts[reason] }, () => ({ reason })))
}
