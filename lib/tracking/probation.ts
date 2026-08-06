/**
 * Turns the fallback log into the weekly probation score.
 *
 * The plan (`Probation Plan — PM — Nguyễn Thành Tín | THÁNG 2`) fixes the weights —
 * KR1 Launch 80, KR2 Control 20 — the four KR2 lines, and the report format. What the
 * exported file does NOT contain is the point rubric itself: the "Cách tính điểm" and
 * "Ngưỡng quyết định probation" sections are empty headings. Everything below marked
 * ASSUMPTION is therefore a proposal derived from the plan's own stated principles
 * (count defects, not activity; no subjective judgement; exceptions defined in advance),
 * not a transcription. Change the constants here and every number moves with them.
 *
 * The plan's own rule decides how to treat a gap: "không reply = không data = fail metric
 * đó" applies to the weekly report, not to the app. Where the app cannot see something,
 * this module reports `null` and says so, rather than scoring a zero it cannot defend.
 */

import type { FallbackReason } from "./fallback"

/** ASSUMPTION — weights are from the plan; the split inside each KR is not. */
export const KR1_TOTAL = 80
export const KR2_TOTAL = 20

/** KR1 splits into "the two users launched by themselves" and "they never had to fall back". */
export const KR1_SELF_LAUNCH = 40
export const KR1_NO_FALLBACK = 40

/** ASSUMPTION — a launch fallback is the plan's headline defect, so it is priced highest. */
export const LAUNCH_FALLBACK_PENALTY = 10

/** KR2's four lines, 5 points each — the plan lists them without weights. */
export const KR2_LINE = 5
export const CONTROL_FALLBACK_PENALTY = 2.5

/**
 * ASSUMPTION — the plan says Seth + Kevin score, Kevin is final reviewer, and gives no
 * numbers. These are the conventional bands; they exist so "On track / Warning / Off
 * track" in the weekly report means something fixed instead of a mood.
 */
export const PASS_THRESHOLD = 80
export const WARNING_THRESHOLD = 65

/**
 * The two people whose adoption is the actual KR: "mỗi khi Kevin/Seth cần launch hoặc
 * control ads, họ mở app và làm xong được trên app".
 *
 * Matched case-insensitively against the launcher name recorded on the batch. A name
 * that matches nothing yields `null` — unknown, not ❌. Scoring someone as failed because
 * the app could not find their row is exactly the mistake this file exists to avoid.
 */
export const PROBATION_LAUNCH_USERS = ["Kevin", "Seth"]

/**
 * Whose block this is.
 *
 * The probation report is about one person, so it is never a block on a shared screen.
 * It is appended to that person's own period report — the thing they copy and send —
 * and to nobody else's. Reviewers read it because it was sent to them, which is how the
 * plan already says the report travels.
 *
 * Matching is by email when PROBATION_SUBJECT_EMAIL is set (exact, and the only form
 * that survives someone changing their display name), by name otherwise. A miss shows
 * the block to nobody, which is the safe direction to fail in.
 */
export const PROBATION_SUBJECT_LABEL = "Nguyễn Thành Tín"

/** Vietnamese names are compared without diacritics — "Tín" and "Tin" are one person. */
function unaccent(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().trim()
}

export function isProbationSubject(
  user: { email?: string | null; full_name?: string | null } | null | undefined,
  configuredEmails = process.env.PROBATION_SUBJECT_EMAIL,
): boolean {
  if (!user) return false

  const allowed = (configuredEmails || "")
    .split(",")
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean)
  if (allowed.length > 0) return allowed.includes((user.email || "").toLowerCase())

  // Fallback while the env var is unset: the words "thanh tin", adjacent and whole.
  // Substring matching is not enough — "Thành Tình" contains "thanh tin" — and showing
  // one person's probation review to the wrong colleague is worse than showing it to
  // nobody, so this fails closed on a near miss.
  const words = unaccent(user.full_name || "").split(/\s+/).filter(Boolean)
  return words.some((word, index) => word === "thanh" && words[index + 1] === "tin")
}

export type ProbationInput = {
  /** Launchers seen this week, from launch_batches — measured, never self-reported. */
  launchers: Array<{ name: string; batches: number }>
  /** Fallbacks logged this week, already filtered to the org. */
  fallbacks: Array<{ reason: FallbackReason }>
  /** Weekly answers a person gives about themselves; null means unanswered. */
  creativeAggregate: "works" | "not_yet" | null
  spotCheckMatched: number | null
  spotCheckTotal: number
}

export type ProbationScore = {
  kr1: number
  kr2: number
  total: number
  /**
   * True when nothing at all was logged this week.
   *
   * The fallback log is entered by hand — leaving the product is invisible from inside
   * it — so an empty week has two readings: nobody had to fall back, or nobody clicked
   * Log. The score cannot tell them apart, so it awards the points and says which one it
   * cannot rule out. Silently treating an empty log as a perfect week is how a
   * self-reported metric turns into a rubber stamp.
   */
  unverified: boolean
  /** null where the app cannot see the answer — the report prints "chưa có data". */
  selfLaunch: Array<{ name: string; launched: boolean | null }>
  launchFallbacks: number
  reviewStatusFallbacks: number
  performanceFallbacks: number
  creativeAggregate: "works" | "not_yet" | null
  spotCheck: { matched: number | null; total: number }
  verdict: "on_track" | "warning" | "off_track"
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function round(value: number) {
  return Math.round(value * 10) / 10
}

export function scoreProbationWeek(input: ProbationInput): ProbationScore {
  const counts = { launch: 0, review_status: 0, performance: 0, creative_aggregate: 0, data_accuracy: 0, other: 0 }
  for (const fallback of input.fallbacks) counts[fallback.reason] += 1

  // Only 'launch' scores against KR1. 'other' is deliberately not folded in: it still
  // appears in the log for the reviewer to read, but an uncategorised entry must not
  // silently cost 10 points under a heading it may not belong to.
  const launchFallbacks = counts.launch
  const knownLaunchers = new Map(input.launchers.map(entry => [entry.name.toLowerCase(), entry.batches]))

  const selfLaunch = PROBATION_LAUNCH_USERS.map(name => {
    const match = [...knownLaunchers.entries()].find(([known]) => known.includes(name.toLowerCase()))
    return { name, launched: match ? match[1] > 0 : null }
  })

  const answered = selfLaunch.filter(entry => entry.launched !== null)
  const selfLaunchPoints = answered.length === 0
    ? 0
    : (KR1_SELF_LAUNCH / PROBATION_LAUNCH_USERS.length) * answered.filter(entry => entry.launched).length

  const kr1 = clamp(selfLaunchPoints + (KR1_NO_FALLBACK - launchFallbacks * LAUNCH_FALLBACK_PENALTY), 0, KR1_TOTAL)

  const reviewPoints = clamp(KR2_LINE - counts.review_status * CONTROL_FALLBACK_PENALTY, 0, KR2_LINE)
  const performancePoints = clamp(KR2_LINE - counts.performance * CONTROL_FALLBACK_PENALTY, 0, KR2_LINE)
  const aggregatePoints = input.creativeAggregate === "works" ? KR2_LINE : 0
  // Unanswered spot check scores 0 — this one IS self-reported, and the plan makes not
  // reporting a fail ("không reply = không data = fail metric đó").
  const accuracyPoints = input.spotCheckMatched === null
    ? 0
    : KR2_LINE * (input.spotCheckMatched / Math.max(1, input.spotCheckTotal))

  const kr2 = clamp(reviewPoints + performancePoints + aggregatePoints + accuracyPoints, 0, KR2_TOTAL)
  const total = round(kr1 + kr2)

  return {
    kr1: round(kr1),
    kr2: round(kr2),
    total,
    unverified: input.fallbacks.length === 0,
    selfLaunch,
    launchFallbacks,
    reviewStatusFallbacks: counts.review_status,
    performanceFallbacks: counts.performance,
    creativeAggregate: input.creativeAggregate,
    spotCheck: { matched: input.spotCheckMatched, total: input.spotCheckTotal },
    verdict: total >= PASS_THRESHOLD ? "on_track" : total >= WARNING_THRESHOLD ? "warning" : "off_track",
  }
}

const VERDICT_LABEL: Record<ProbationScore["verdict"], string> = {
  on_track: "On track",
  warning: "Warning",
  off_track: "Off track",
}

/**
 * The weekly block, appended to the shared period report rather than shown as its own
 * card. It is one person's review: it travels by being pasted, so it is written to be
 * read in a chat window — four lines, plus a warning only when there is one.
 *
 * The counts come from `score`, not from a list of logged rows, because the tally is now
 * kept as counts on the subject's own machine. Nothing here reads a database it does not
 * already have.
 */
export function buildProbationReport(input: {
  score: ProbationScore
  week: number
  reportDate: string
  monthToDate: number | null
  note?: string
}): string {
  const { score } = input
  const mark = (value: boolean | null) => (value === null ? "chưa có data" : value ? "✅" : "❌")

  const monthToDate = input.monthToDate === null
    ? "chưa đủ tuần để tính"
    : `${input.monthToDate}/100 → ${VERDICT_LABEL[score.verdict]}${score.unverified ? " (chưa kiểm chứng)" : ""}`

  const lines = [
    `## Probation — ${PROBATION_SUBJECT_LABEL} · Week ${input.week} · ${input.reportDate}`,
    `**KR1 Launch ${score.kr1}/80** — tự launch: ${score.selfLaunch.map(entry => `${entry.name} ${mark(entry.launched)}`).join(" · ")} · launch fallback ${score.launchFallbacks} lần`,
    `**KR2 Control ${score.kr2}/20** — review status ${score.reviewStatusFallbacks} · performance ${score.performanceFallbacks} · creative aggregate ${score.creativeAggregate === null ? "chưa trả lời" : score.creativeAggregate === "works" ? "work" : "chưa"} · data accuracy ${score.spotCheck.matched === null ? "chưa spot check" : `${score.spotCheck.matched}/${score.spotCheck.total} khớp`}`,
    `**Month-to-date** ${monthToDate}`,
  ]

  // The warning is the whole point of `unverified`: an empty tally reads as a perfect
  // week unless the block says which of the two things it cannot tell apart.
  if (score.unverified) lines.push("⚠️ Tuần này chưa ai log fallback — 0 nghĩa là không ai ghi nhận, không phải là không có fallback.")
  if (input.note?.trim()) lines.push(`_Ghi chú:_ ${input.note.trim()}`)
  lines.push("_Tự launch đo từ launch_batches; fallback là log tay. Rubric là đề xuất — plan để trống mục Cách tính điểm._")

  return lines.join("\n")
}
