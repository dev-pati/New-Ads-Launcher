import type {
  ExceptionEntry,
  KrResult,
  MetricDef,
  MetricReading,
  MetricResult,
  ProbationConfig,
  ScoreResult,
  TrackStatus,
} from "./types"

/**
 * The metric engine.
 *
 * Two rules from the plan shape it:
 *  - Approved exceptions do not count as KR failures (lines 73-83). An excused
 *    metric is removed from BOTH earned and possible, so one bad week caused by
 *    a Meta outage does not drag the percentage down.
 *  - The score this produces is SELF-ASSESSED. Evaluation principle #2 says the
 *    real score comes from the reviewers. Everything here is labelled as such
 *    and shown next to the confirmed number, never instead of it.
 */

function scoreMetric(def: MetricDef, reading: MetricReading | undefined): {
  earned: number
  value: number | null
  explanation: string
} {
  if (!reading) {
    return { earned: 0, value: null, explanation: "Not recorded yet — scores 0 until entered." }
  }

  switch (def.kind) {
    case "boolean": {
      // auto_confirmed needs BOTH the detected launch and the unaided tick.
      const detected = reading.value > 0
      const needsConfirm = def.source === "auto_confirmed"
      const passed = needsConfirm ? detected && reading.confirmed === true : detected

      if (!detected) {
        return { earned: 0, value: 0, explanation: `No successful launch detected → 0/${def.points}.` }
      }
      if (needsConfirm && reading.confirmed !== true) {
        return {
          earned: 0,
          value: 1,
          explanation:
            `Launch detected but not confirmed unaided → 0/${def.points}. ` +
            `An assisted launch is not adoption yet.`,
        }
      }
      return {
        earned: passed ? def.points : 0,
        value: 1,
        explanation: `Launched successfully${needsConfirm ? " and confirmed unaided" : ""} → ${def.points}/${def.points}.`,
      }
    }

    case "defect_count": {
      const budget = def.budget ?? 0
      const penalty = def.penaltyPerOccurrence ?? def.points
      const over = Math.max(0, reading.value - budget)
      const earned = Math.max(0, def.points - over * penalty)
      const detail =
        over === 0
          ? `${reading.value} fallback(s), budget ${budget} → full ${def.points}.`
          : `${reading.value} fallback(s), ${over} over budget of ${budget} × −${penalty} → ${earned}/${def.points}.`
      return { earned, value: reading.value, explanation: detail }
    }

    case "ratio": {
      const denom = def.denominator ?? 1
      const matched = Math.max(0, Math.min(reading.value, denom))
      const earned = Math.round((matched / denom) * def.points * 100) / 100
      return {
        earned,
        value: reading.value,
        explanation: `${matched}/${denom} spot checks matched → ${earned}/${def.points}.`,
      }
    }
  }
}

function statusFor(percent: number, config: ProbationConfig): TrackStatus {
  if (percent >= config.thresholds.onTrack) return "on_track"
  if (percent >= config.thresholds.warning) return "warning"
  return "off_track"
}

export function computeScore(
  config: ProbationConfig,
  readings: MetricReading[],
  exceptions: ExceptionEntry[],
  confirmedScore: number | null
): ScoreResult {
  const byMetric = new Map(readings.map((r) => [r.metricId, r]))

  // Only APPROVED exceptions excuse a metric. Pending ones are visible but inert
  // — otherwise logging an excuse would improve the score before anyone agreed.
  const approved = exceptions.filter((e) => e.approved)
  const excusedAll = approved.some((e) => !e.metricId)
  const excusedIds = new Set(approved.filter((e) => e.metricId).map((e) => e.metricId as string))

  const results: MetricResult[] = config.metrics.map((def) => {
    const reading = byMetric.get(def.id)
    const excused = excusedAll || excusedIds.has(def.id)
    const { earned, value, explanation } = scoreMetric(def, reading)

    if (excused) {
      return {
        def,
        value,
        earned: 0,
        possible: 0,
        excused: true,
        confirmed: reading?.confirmed,
        note: reading?.note,
        evidence: reading?.evidence,
        explanation: "Excused by an approved exception — removed from both earned and possible.",
      }
    }

    return {
      def,
      value,
      earned,
      possible: def.points,
      excused: false,
      confirmed: reading?.confirmed,
      note: reading?.note,
      evidence: reading?.evidence,
      explanation,
    }
  })

  const krs: KrResult[] = config.krs.map((krDef) => {
    const metrics = results.filter((r) => r.def.kr === krDef.id)
    const earned = metrics.reduce((s, m) => s + m.earned, 0)
    const possible = metrics.reduce((s, m) => s + m.possible, 0)
    const percent = possible > 0 ? (earned / possible) * 100 : 100
    return { def: krDef, metrics, earned: round2(earned), possible, status: statusFor(percent, config) }
  })

  const earned = krs.reduce((s, k) => s + k.earned, 0)
  const possible = krs.reduce((s, k) => s + k.possible, 0)
  // Normalised to 100 so an excused week is not punished for having fewer points.
  const selfScore = possible > 0 ? round2((earned / possible) * 100) : 0

  return {
    krs,
    selfScore,
    possible,
    status: statusFor(selfScore, config),
    confirmedScore,
    gap: confirmedScore === null ? null : round2(selfScore - confirmedScore),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export const STATUS_LABEL: Record<TrackStatus, string> = {
  on_track: "On Track",
  warning: "Warning",
  off_track: "Off Track",
}
