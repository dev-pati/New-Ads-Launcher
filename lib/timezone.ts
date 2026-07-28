export interface WallClockParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

export function parseDateTimeLocal(value: string): WallClockParts | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) return null
  const [, y, mo, d, h, mi] = match
  return {
    year: Number(y),
    month: Number(mo),
    day: Number(d),
    hour: Number(h),
    minute: Number(mi),
  }
}

export function partsInTimeZone(date: Date, timeZone: string): WallClockParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value || 0)
  const hourRaw = get("hour")
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: hourRaw === 24 ? 0 : hourRaw,
    minute: get("minute"),
  }
}

export function wallClockToUtcDate(value: string, timeZone: string): Date | null {
  const target = parseDateTimeLocal(value)
  if (!target) return null
  const same = (p: WallClockParts) =>
    p.year === target.year && p.month === target.month && p.day === target.day &&
    p.hour === target.hour && p.minute === target.minute

  const guessUtc = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute)
  const guessParts = partsInTimeZone(new Date(guessUtc), timeZone)
  const offsetMs = Date.UTC(guessParts.year, guessParts.month - 1, guessParts.day, guessParts.hour, guessParts.minute) - guessUtc
  const candidates = [guessUtc - offsetMs, guessUtc - offsetMs + 3_600_000, guessUtc - offsetMs - 3_600_000]

  for (const candidate of candidates) {
    const date = new Date(candidate)
    if (same(partsInTimeZone(date, timeZone))) return date
  }
  return null
}

export function wallClockToUtcIso(value: string, timeZone: string) {
  return wallClockToUtcDate(value, timeZone)?.toISOString() || null
}

export function getUtcOffsetLabel(timeZone: string, date = new Date()) {
  // Offset = (wall-clock in zone) − (UTC wall-clock) at the same instant.
  const zoneParts = partsInTimeZone(date, timeZone)
  const zoneMs = Date.UTC(zoneParts.year, zoneParts.month - 1, zoneParts.day, zoneParts.hour, zoneParts.minute)
  const utcMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes())
  const diffMinutes = Math.round((zoneMs - utcMs) / 60000)
  const sign = diffMinutes >= 0 ? "+" : "-"
  const abs = Math.abs(diffMinutes)
  const hh = Math.floor(abs / 60)
  const mm = abs % 60
  return `UTC${sign}${hh}${mm ? `:${String(mm).padStart(2, "0")}` : ""}`
}
