/**
 * Resolves the tracking reporting window from query params.
 *
 * Two modes:
 *  - `from`+`to` (YYYY-MM-DD): an explicit inclusive calendar range the user
 *    picked. The previous comparison window is the equal-length span immediately
 *    before it.
 *  - `days` (7|30|90): legacy lookback from now. Kept so old links still resolve.
 *
 * All four bounds are inclusive ISO strings so callers can use a uniform
 * `.gte(field, lower).lte(field, upper)` shape regardless of mode.
 */
export type TrackingWindow = {
  since: string
  until: string
  previousSince: string
  previousUntil: string
  /** Span of the current window in whole days (inclusive of both ends). */
  days: number
}

const DAY_MS = 86_400_000
const ALLOWED_LEGACY_DAYS = [7, 30, 90] as const

export function resolveTrackingWindow(params: URLSearchParams): TrackingWindow {
  const from = params.get("from")
  const to = params.get("to")
  if (from && to) {
    const start = new Date(`${from}T00:00:00.000Z`)
    const end = new Date(`${to}T23:59:59.999Z`)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start) {
      const span = end.getTime() - start.getTime() + DAY_MS
      return {
        since: start.toISOString(),
        until: end.toISOString(),
        previousSince: new Date(start.getTime() - span).toISOString(),
        previousUntil: new Date(start.getTime() - 1).toISOString(),
        days: Math.max(1, Math.round(span / DAY_MS)),
      }
    }
  }
  return legacyWindow(params)
}

function legacyWindow(params: URLSearchParams): TrackingWindow {
  const requested = Number(params.get("days") || 7)
  const days = (ALLOWED_LEGACY_DAYS as readonly number[]).includes(requested) ? requested : 7
  const windowMs = days * DAY_MS
  const since = new Date(Date.now() - windowMs)
  return {
    since: since.toISOString(),
    until: new Date().toISOString(),
    previousSince: new Date(since.getTime() - windowMs).toISOString(),
    previousUntil: new Date(since.getTime() - 1).toISOString(),
    days,
  }
}
