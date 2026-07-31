import { NextRequest, NextResponse } from "next/server"
import { getProbationViewer } from "@/lib/probation/auth"
import { isoWeekKey, weeksElapsed } from "@/lib/probation/config"
import { computeScore } from "@/lib/probation/scoring"
import {
  getConfig,
  getPeopleStatus,
  getReadings,
  getWeek,
  getWeekLaunches,
  launchedBy,
  listExceptions,
  listIssues,
  listWeeks,
} from "@/lib/probation/store"
import type { MetricReading } from "@/lib/probation/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Everything the dashboard needs in one call: config, this week's score (with
 * auto-detected launches folded in), exceptions, issues and the week history.
 *
 * One round trip rather than six — the page is a single screen and partial
 * loading would let it render a score before its exceptions arrived, which would
 * briefly show a wrong number. A wrong number is the one thing this must not do.
 */
export async function GET(request: NextRequest) {
  try {
    const viewer = await getProbationViewer()
    if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const email = viewer.email as string

    const weekKey = request.nextUrl.searchParams.get("week") || isoWeekKey(new Date())

    const [config, storedReadings, exceptions, issues, week, weeks, launches] = await Promise.all([
      getConfig(email),
      getReadings(email, weekKey),
      listExceptions(email),
      listIssues(email),
      getWeek(email, weekKey),
      listWeeks(email),
      getWeekLaunches(weekKey),
    ])

    // Fold auto-detected launches into the readings. A stored reading wins for
    // `confirmed` (the owner's unaided call) but the detected value always comes
    // from launch_batches — the DB is the evidence, not a remembered tick.
    const readings: MetricReading[] = [...storedReadings]
    for (const def of config.metrics) {
      if (def.source !== "auto_confirmed") continue
      const hit = launchedBy(launches, def.autoUserMatch)
      const existing = readings.find((r) => r.metricId === def.id)
      const detectedValue = hit ? 1 : 0
      if (existing) {
        existing.value = detectedValue
      } else {
        readings.push({ metricId: def.id, weekKey, value: detectedValue })
      }
    }

    const weekExceptions = exceptions.filter((e) => {
      if (!e.date) return false
      return isoWeekKey(new Date(e.date)) === weekKey
    })

    const score = computeScore(config, readings, weekExceptions, week?.confirmedScore ?? null)

    // Adoption detail. Runs after the readings are folded so the "unaided" tick
    // shown per person is the same one the score used.
    const people = await getPeopleStatus(config, weekKey, readings)
    const adsThisWeek = people.reduce((s, p) => s + p.ads, 0)
    const hoursSaved =
      Math.round(((adsThisWeek * config.minutesPerAdManual) / 60) * 10) / 10
    const savings = {
      adsThisWeek,
      appMs: people.reduce((s, p) => s + p.totalMs, 0),
      hoursSaved,
      costSavedVnd: Math.round(hoursSaved * config.hourlyCostVnd),
      // Carried to the UI so the caveat travels with the number, not next to it.
      assumption: `${config.minutesPerAdManual} min/ad manual · ${config.hourlyCostVnd.toLocaleString("vi-VN")} ₫/h — assumed, never measured`,
    }

    // Month-to-date: mean of closed weeks' self scores plus the current week.
    const closed = weeks.filter((w) => w.selfScore !== null && w.weekKey !== weekKey)
    const mtdValues = [...closed.map((w) => w.selfScore as number), score.selfScore]
    const monthToDate =
      mtdValues.length > 0
        ? Math.round((mtdValues.reduce((a, b) => a + b, 0) / mtdValues.length) * 100) / 100
        : 0

    const confirmedWeeks = weeks.filter((w) => w.confirmedScore !== null)
    const confirmedMtd =
      confirmedWeeks.length > 0
        ? Math.round(
            (confirmedWeeks.reduce((a, w) => a + (w.confirmedScore as number), 0) /
              confirmedWeeks.length) *
              100
          ) / 100
        : null

    return NextResponse.json({
      config,
      weekKey,
      allWeeks: weeksElapsed(config, new Date()),
      score,
      monthToDate,
      confirmedMtd,
      launches,
      people,
      savings,
      exceptions,
      issues,
      week,
      weeks,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load probation overview"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
