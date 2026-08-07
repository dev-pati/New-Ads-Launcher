import assert from "node:assert/strict"
import test from "node:test"
import { isMissingTable } from "../lib/tracking/missing-table.ts"
import { buildProbationReport, isProbationSubject, scoreProbationWeek } from "../lib/tracking/probation.ts"

test("missing KR migration is unavailable, never a zero", () => {
  assert.equal(isMissingTable({ code: "PGRST205", message: "Could not find kr_fallbacks" }), true)
  assert.equal(isMissingTable({ code: "23505" }), false)
})

test("probation subject access fails closed", () => {
  assert.equal(isProbationSubject({ email: "tin@pati.vn" }, "tin@pati.vn"), true)
  assert.equal(isProbationSubject({ email: "kevin@pati.vn", full_name: "Nguyễn Thành Tín" }, "tin@pati.vn"), false)
  assert.equal(isProbationSubject({ full_name: "Nguyễn Thành Tín" }, ""), true)
  assert.equal(isProbationSubject({ full_name: "Martin Le" }, ""), false)
})

const launchers = [{ name: "Kevin Nguyen", batches: 2 }, { name: "Seth Tran", batches: 1 }]
const controlActors = [{ name: "Seth Tran", actions: 2 }]

test("clean measured week scores 100", () => {
  const score = scoreProbationWeek({ launchers, controlActors, fallbacks: [] })
  assert.deepEqual([score.kr1, score.kr2, score.total], [80, 20, 100])
})

test("launch and control fallbacks only affect their own KR", () => {
  const launch = scoreProbationWeek({ launchers, controlActors, fallbacks: [{ kind: "launch" }] })
  const control = scoreProbationWeek({ launchers, controlActors, fallbacks: [{ kind: "control" }] })
  assert.deepEqual([launch.kr1, launch.kr2], [70, 20])
  assert.deepEqual([control.kr1, control.kr2], [80, 15])
})

test("KR2 needs successful Seth control evidence", () => {
  const score = scoreProbationWeek({ launchers, controlActors: [], fallbacks: [] })
  assert.equal(score.kr2, 10)
  assert.equal(score.controlCompleted, false)
})

test("unknown launcher is unknown, not a negative event", () => {
  const score = scoreProbationWeek({ launchers: [{ name: "Kevin Nguyen", batches: 1 }], controlActors, fallbacks: [] })
  assert.equal(score.selfLaunch.find(entry => entry.name === "Seth")?.launched, null)
  assert.equal(score.kr1, 60)
})

test("report is compact and labels fallback as self-reported", () => {
  const score = scoreProbationWeek({ launchers, controlActors, fallbacks: [{ kind: "control" }] })
  const report = buildProbationReport({ score, week: 2, reportDate: "07/08/2026", monthToDate: 95 })
  assert.match(report, /KR1 Launch 80\/80/)
  assert.match(report, /KR2 Control 15\/20/)
  assert.match(report, /self-reporting/)
  assert.ok(report.split("\n").length <= 5)
})
