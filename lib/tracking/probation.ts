import type { FallbackKind } from "./fallback"

export const KR1_TOTAL = 80
export const KR2_TOTAL = 20
export const KR1_SELF_LAUNCH = 40
export const KR1_NO_FALLBACK = 40
export const LAUNCH_FALLBACK_PENALTY = 10
export const KR2_CONTROL_ADOPTION = 10
export const KR2_NO_FALLBACK = 10
export const CONTROL_FALLBACK_PENALTY = 5
export const PASS_THRESHOLD = 80
export const WARNING_THRESHOLD = 65
export const PROBATION_LAUNCH_USERS = ["Kevin", "Seth"]
export const PROBATION_SUBJECT_LABEL = "Nguyễn Thành Tín"

function unaccent(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim()
}

export function isProbationSubject(
  user: { email?: string | null; full_name?: string | null } | null | undefined,
  configuredEmails = process.env.PROBATION_SUBJECT_EMAIL,
): boolean {
  if (!user) return false
  const allowed = (configuredEmails || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean)
  if (allowed.length > 0) return allowed.includes((user.email || "").toLowerCase())

  const words = unaccent(user.full_name || "").split(/\s+/).filter(Boolean)
  return words.some((word, index) => word === "thanh" && words[index + 1] === "tin")
}

export type ProbationInput = {
  launchers: Array<{ name: string; batches: number }>
  controlActors: Array<{ name: string; actions: number }>
  fallbacks: Array<{ kind: FallbackKind }>
}

export type ProbationScore = {
  kr1: number
  kr2: number
  total: number
  selfLaunch: Array<{ name: string; launched: boolean | null }>
  controlCompleted: boolean
  launchFallbacks: number
  controlFallbacks: number
  verdict: "on_track" | "warning" | "off_track"
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function scoreProbationWeek(input: ProbationInput): ProbationScore {
  const launchFallbacks = input.fallbacks.filter(event => event.kind === "launch").length
  const controlFallbacks = input.fallbacks.filter(event => event.kind === "control").length
  const knownLaunchers = new Map(input.launchers.map(entry => [entry.name.toLowerCase(), entry.batches]))

  const selfLaunch = PROBATION_LAUNCH_USERS.map(name => {
    const match = [...knownLaunchers.entries()].find(([known]) => known.includes(name.toLowerCase()))
    return { name, launched: match ? match[1] > 0 : null }
  })
  const selfLaunchPoints = (KR1_SELF_LAUNCH / PROBATION_LAUNCH_USERS.length) * selfLaunch.filter(entry => entry.launched).length
  const kr1 = clamp(selfLaunchPoints + KR1_NO_FALLBACK - launchFallbacks * LAUNCH_FALLBACK_PENALTY, 0, KR1_TOTAL)
  const controlCompleted = input.controlActors.some(entry => entry.name.toLowerCase().includes("seth") && entry.actions > 0)
  const kr2 = clamp((controlCompleted ? KR2_CONTROL_ADOPTION : 0) + KR2_NO_FALLBACK - controlFallbacks * CONTROL_FALLBACK_PENALTY, 0, KR2_TOTAL)
  const total = Math.round((kr1 + kr2) * 10) / 10

  return {
    kr1,
    kr2,
    total,
    selfLaunch,
    controlCompleted,
    launchFallbacks,
    controlFallbacks,
    verdict: total >= PASS_THRESHOLD ? "on_track" : total >= WARNING_THRESHOLD ? "warning" : "off_track",
  }
}

const VERDICT_LABEL: Record<ProbationScore["verdict"], string> = {
  on_track: "On track",
  warning: "Warning",
  off_track: "Off track",
}

export function buildProbationReport(input: {
  score: ProbationScore
  week: number
  reportDate: string
  monthToDate: number | null
}): string {
  const mark = (value: boolean | null) => value === null ? "chưa có data" : value ? "yes" : "no"
  return [
    `## Probation - ${PROBATION_SUBJECT_LABEL} - Week ${input.week} - ${input.reportDate}`,
    `**KR1 Launch ${input.score.kr1}/80** - ${input.score.selfLaunch.map(entry => `${entry.name} ${mark(entry.launched)}`).join(" - ")} - ${input.score.launchFallbacks} recorded fallback`,
    `**KR2 Control ${input.score.kr2}/20** - Seth completed control ${input.score.controlCompleted ? "yes" : "no"} - ${input.score.controlFallbacks} recorded fallback`,
    `**Month-to-date** ${input.monthToDate === null ? "not enough data" : `${input.monthToDate}/100 - ${VERDICT_LABEL[input.score.verdict]}`}`,
    "_Launch is measured from launch_batches. Fallback is one-tap self-reporting and may be under-recorded._",
  ].join("\n")
}
