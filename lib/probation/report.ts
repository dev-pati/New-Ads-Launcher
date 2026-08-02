import type {
  IssueEntry,
  MetricResult,
  ProbationConfig,
  ScoreResult,
  WeekEntry,
} from "./types"
import { getOwnerDisplayName, weekRange } from "./config"

/**
 * The weekly report, in the exact format fixed by the probation plan
 * (lines 95-109). The format is not a design choice — the reviewers read the
 * same shape every week, and the plan says it is "dùng cố định mỗi tuần".
 *
 * Output is plain text, ready to paste into Lark. Not markdown: the box-drawing
 * characters are part of the agreed format and markdown would mangle them.
 */

export interface ReportInput {
  config: ProbationConfig
  weekKey: string
  /** 1-based week number within probation. */
  weekNumber: number
  score: ScoreResult
  monthToDateScore: number
  monthToDateStatus: string
  issues: IssueEntry[]
  week: WeekEntry | null
  /** Manual override. Empty = derived from the metrics that lost points. */
  nextWeek: string
}

function tick(v: boolean | null): string {
  if (v === null) return "—"
  return v ? "✅" : "❌"
}

function metricValue(score: ScoreResult, id: string): number | null {
  for (const kr of score.krs) {
    const m = kr.metrics.find((x) => x.def.id === id)
    if (m) return m.value
  }
  return null
}

function metricBool(score: ScoreResult, id: string): boolean | null {
  for (const kr of score.krs) {
    const m = kr.metrics.find((x) => x.def.id === id)
    if (!m) continue
    if (m.value === null) return null
    if (m.def.source === "auto_confirmed") return m.value > 0 && m.confirmed === true
    return m.value > 0
  }
  return null
}

function metricNote(score: ScoreResult, id: string): string {
  for (const kr of score.krs) {
    const m = kr.metrics.find((x) => x.def.id === id)
    if (m?.note) return m.note
  }
  return ""
}

/**
 * NEXT WEEK, derived instead of typed.
 *
 * "What should I fix this week?" is question 4 of the dashboard, and the answer
 * is already in the numbers: the metric that lost the most points is the thing
 * costing the most, so it is the thing to fix. Open issues follow, oldest
 * deadline first — those are commitments already made, and a report that omits
 * an overdue one is the report that lets it stay overdue.
 *
 * Excused metrics are skipped: an approved exception means the loss was not
 * yours to fix.
 */
function deriveNextWeek(score: ScoreResult, issues: IssueEntry[]): string {
  const parts: string[] = []

  const losing = score.krs
    .flatMap((kr) => kr.metrics)
    .filter((m) => !m.excused && m.possible - m.earned > 0.01)
    .sort((a, b) => b.possible - b.earned - (a.possible - a.earned))

  for (const m of losing.slice(0, 2)) parts.push(actionFor(m))

  const open = issues
    .filter((i) => i.status === "open")
    .sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"))

  for (const i of open.slice(0, 2)) parts.push(`${i.issue} (${i.owner}, ${i.deadline})`)

  if (parts.length === 0) return "không metric nào mất điểm — giữ nhịp, không thêm việc"
  return parts.join(" · ")
}

/** One metric's loss, phrased as the action that closes it. */
function actionFor(m: MetricResult): string {
  const d = m.def
  if (m.value === null) {
    return `ghi số cho "${d.label}" — chưa có reading nên đang tính 0/${d.points}`
  }
  if (d.kind === "defect_count") {
    return `${d.label}: ${m.value} → ${d.budget ?? 0} (đang mất ${fmt(m.possible - m.earned)}đ)`
  }
  if (d.kind === "ratio") {
    return `${d.label}: ${m.value}/${d.denominator ?? "?"} → khớp hết`
  }
  if (d.source === "auto_confirmed") {
    return m.value > 0
      ? `${d.label}: có launch nhưng chưa tick "tự làm" — xác nhận hoặc ghi lý do`
      : `${d.label}: tuần này chưa launch lần nào — hỏi lý do, không đoán`
  }
  return `${d.label}: chưa đạt (${fmt(m.possible - m.earned)}đ)`
}

function saturdayOf(weekKey: string): string {
  const { start } = weekRange(weekKey)
  const sat = new Date(start)
  sat.setUTCDate(start.getUTCDate() + 5)
  const dd = String(sat.getUTCDate()).padStart(2, "0")
  const mm = String(sat.getUTCMonth() + 1).padStart(2, "0")
  return `${dd}/${mm}`
}

export function generateReport(input: ReportInput): string {
  const { config, weekKey, weekNumber, score, monthToDateScore, monthToDateStatus, issues } = input

  const kr1 = score.krs.find((k) => k.def.id === "KR1")
  const kr2 = score.krs.find((k) => k.def.id === "KR2")
  const kr1Weight = config.krs.find((k) => k.id === "KR1")?.weight ?? 80
  const kr2Weight = config.krs.find((k) => k.id === "KR2")?.weight ?? 20

  const fallbackCount = metricValue(score, "launch_fallback")
  const fallbackNote = metricNote(score, "launch_fallback")
  const reviewFallback = metricValue(score, "review_status_fallback")
  const perfFallback = metricValue(score, "performance_fallback")
  const creativeAgg = metricBool(score, "creative_aggregate")
  const accuracy = metricValue(score, "data_accuracy")
  const accuracyDenom =
    config.metrics.find((m) => m.id === "data_accuracy")?.denominator ?? 5

  const openIssues = issues.filter((i) => i.status === "open")

  const lines: string[] = []
  lines.push(`=== ${getOwnerDisplayName()} PROBATION — THÁNG 2 — WEEK ${weekNumber} ===`)
  lines.push(`Ngày: [thứ 7 ${saturdayOf(weekKey)}]`)
  lines.push(
    `━ KR1 LAUNCH ADS (${kr1Weight}%) — [${fmt(kr1?.earned)}/${kr1Weight}]`
  )
  // Built from the config rather than two hardcoded ids: who KR1 tracks is an
  // environment setting, so the report row has to follow it.
  const selfLaunch = config.metrics
    .filter((m) => m.source === "auto_confirmed")
    .map((m) => `${m.shortLabel || m.label} ${tick(metricBool(score, m.id))}`)
    .join(" · ")
  lines.push(`• User tự launch:      ${selfLaunch || "—"}`)
  lines.push(
    `• Launch fallback:     ${fallbackCount ?? "—"} lần` +
      (fallbackNote ? `   → log: ${fallbackNote}` : "")
  )
  lines.push(`━ KR2 CONTROL ADS (${kr2Weight}%) — [${fmt(kr2?.earned)}/${kr2Weight}]`)
  lines.push(`• Review status:       ${reviewFallback ?? "—"} fallback`)
  lines.push(`• Performance ads:     ${perfFallback ?? "—"} fallback`)
  lines.push(
    `• Creative aggregate:  ${creativeAgg === null ? "—" : creativeAgg ? "work" : "chưa"}`
  )
  lines.push(
    `• Data accuracy:       ${accuracy ?? "—"}/${accuracyDenom} spot check khớp`
  )
  lines.push(`━ MONTH-TO-DATE: [${fmt(monthToDateScore)}/100] → [${monthToDateStatus}]`)

  if (openIssues.length === 0) {
    lines.push(`━ ISSUES OPEN: (none)`)
  } else {
    openIssues.forEach((i, idx) => {
      const prefix = idx === 0 ? "━ ISSUES OPEN: " : "                "
      lines.push(`${prefix}${i.issue} — ${i.owner} — ${i.deadline}`)
    })
  }

  lines.push(`━ NEXT WEEK: ${input.nextWeek || deriveNextWeek(score, issues)}`)

  if (!config.confirmed) {
    lines.push("")
    lines.push(
      "(Điểm số theo thang PROPOSED — chưa chốt point split & ngưỡng pass với reviewer.)"
    )
  }

  return lines.join("\n")
}

function fmt(n: number | undefined): string {
  if (n === undefined) return "—"
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
