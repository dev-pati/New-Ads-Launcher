import { NextRequest, NextResponse } from "next/server"
import { getProbationViewer } from "@/lib/probation/auth"
import { isoWeekKey, weeksElapsed } from "@/lib/probation/config"
import { generateReport } from "@/lib/probation/report"
import { computeScore, STATUS_LABEL } from "@/lib/probation/scoring"
import {
  getConfig,
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

/** The weekly report, generated from current metrics. Text out, nothing sent. */
export async function GET(request: NextRequest) {
  try {
    const viewer = await getProbationViewer()
    if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const email = viewer.email as string

    const weekKey = request.nextUrl.searchParams.get("week") || isoWeekKey(new Date())
    const nextWeek = request.nextUrl.searchParams.get("next") || ""

    const [config, storedReadings, exceptions, issues, week, weeks, launches] = await Promise.all([
      getConfig(email),
      getReadings(email, weekKey),
      listExceptions(email),
      listIssues(email),
      getWeek(email, weekKey),
      listWeeks(email),
      getWeekLaunches(weekKey),
    ])

    const readings: MetricReading[] = [...storedReadings]
    for (const def of config.metrics) {
      if (def.source !== "auto_confirmed") continue
      const hit = launchedBy(launches, def.autoUserMatch)
      const existing = readings.find((r) => r.metricId === def.id)
      if (existing) existing.value = hit ? 1 : 0
      else readings.push({ metricId: def.id, weekKey, value: hit ? 1 : 0 })
    }

    const weekExceptions = exceptions.filter(
      (e) => e.date && isoWeekKey(new Date(e.date)) === weekKey
    )
    const score = computeScore(config, readings, weekExceptions, week?.confirmedScore ?? null)

    const closed = weeks.filter((w) => w.selfScore !== null && w.weekKey !== weekKey)
    const mtdValues = [...closed.map((w) => w.selfScore as number), score.selfScore]
    const monthToDate =
      Math.round((mtdValues.reduce((a, b) => a + b, 0) / mtdValues.length) * 100) / 100

    const allWeeks = weeksElapsed(config, new Date())
    const weekNumber = Math.max(1, allWeeks.indexOf(weekKey) + 1)

    const mtdStatus =
      monthToDate >= config.thresholds.onTrack
        ? STATUS_LABEL.on_track
        : monthToDate >= config.thresholds.warning
          ? STATUS_LABEL.warning
          : STATUS_LABEL.off_track

    const report = generateReport({
      config,
      weekKey,
      weekNumber,
      score,
      monthToDateScore: monthToDate,
      monthToDateStatus: mtdStatus,
      issues,
      week,
      nextWeek,
    })

    return NextResponse.json({ report, weekKey, weekNumber })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate report"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
