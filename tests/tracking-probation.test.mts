import assert from "node:assert/strict"
import test from "node:test"
import { ACTIVITY_CATALOG, CLASS_ORDER } from "../lib/tracking/activity-catalog.ts"
import { mergeUsageRows } from "../lib/tracking/activity.ts"
import { isMissingTable } from "../lib/tracking/missing-table.ts"
import { buildProbationReport, isProbationSubject, scoreProbationWeek } from "../lib/tracking/probation.ts"

// ---------------------------------------------------------------------------
// isMissingTable — the check that decides "unavailable" instead of "0".
// Observed against the running dev server: PostgREST answers PGRST205 from its schema
// cache and never reaches Postgres, so a 42P01-only check turns a missing migration
// into a 500.
// ---------------------------------------------------------------------------

test("a missing table is recognised under both codes and by message", () => {
  assert.equal(isMissingTable({ code: "42P01" }), true)
  assert.equal(isMissingTable({ code: "PGRST205", message: "Could not find the table 'ads_launcher.meta_fallback_events' in the schema cache" }), true)
  assert.equal(isMissingTable({ message: 'relation "ads_launcher.activity_log" does not exist' }), true)
  assert.equal(isMissingTable({ code: "23505", message: "duplicate key value" }), false)
  assert.equal(isMissingTable(null), false)
})

// ---------------------------------------------------------------------------
// isProbationSubject — who the probation block is allowed to render for. The block
// moved from Team usage to one person's My usage, so this function is the whole access
// rule; getting it wrong shows a colleague's review to the org.
// ---------------------------------------------------------------------------

test("the configured email wins over any display name", () => {
  const env = "tin@pati.vn"
  assert.equal(isProbationSubject({ email: "TIN@pati.vn", full_name: "anything" }, env), true)
  // Same name, different account: an env-configured subject is exact, never fuzzy.
  assert.equal(isProbationSubject({ email: "kevin@pati.vn", full_name: "Nguyễn Thành Tín" }, env), false)
  assert.equal(isProbationSubject({ email: "tin@pati.vn" }, "kevin@pati.vn, tin@pati.vn"), true)
})

test("without the env var it falls back to the full name, diacritics ignored", () => {
  assert.equal(isProbationSubject({ full_name: "Nguyễn Thành Tín" }, ""), true)
  assert.equal(isProbationSubject({ full_name: "nguyen thanh tin" }, undefined), true)
})

test("a bare 'tin' is not a match — a near-miss must fail closed", () => {
  // Showing one person's probation review to the wrong colleague is worse than
  // showing it to nobody, so the name match requires the whole phrase.
  assert.equal(isProbationSubject({ full_name: "Martin Le" }, ""), false)
  assert.equal(isProbationSubject({ full_name: "Nguyễn Thành Tình" }, ""), false)
  assert.equal(isProbationSubject({ full_name: null, email: "tin@pati.vn" }, ""), false)
  assert.equal(isProbationSubject(null, ""), false)
})

// ---------------------------------------------------------------------------
// The catalog is what the class drill-down reads. A class total nobody can trace back
// to a screen is a number nobody can check.
// ---------------------------------------------------------------------------

test("every activity names a shipped screen, and every class has at least one", () => {
  for (const definition of ACTIVITY_CATALOG) {
    assert.ok(definition.surface.trim().length > 0, `${definition.key} has no surface`)
  }
  for (const key of CLASS_ORDER) {
    assert.ok(ACTIVITY_CATALOG.some(definition => definition.class === key), `${key} would open an empty dialog`)
  }
})

// ---------------------------------------------------------------------------
// mergeUsageRows — the Team table is one row per person, from two half-pictures.
// ---------------------------------------------------------------------------

test("a member present in only one source still gets a row", () => {
  const rows = mergeUsageRows(
    [{ userId: "a", name: "Kevin", adsCreated: 12, batches: 3 }],
    [{ userId: "b", name: "Tin", actions: 40, activeDays: 5, breadth: 6 }],
  )

  assert.equal(rows.length, 2)
  const kevin = rows.find(row => row.userId === "a")
  const tin = rows.find(row => row.userId === "b")
  // A launcher with no recorded activity is 0 actions, not a missing row.
  assert.deepEqual([kevin?.adsCreated, kevin?.actions], [12, 0])
  // Someone who never launched but used the app all week is the person this table
  // exists to make visible.
  assert.deepEqual([tin?.adsCreated, tin?.actions, tin?.activeDays], [0, 40, 5])
})

test("sorted by ads launched, then actions — a sort, not a score", () => {
  const rows = mergeUsageRows(
    [
      { userId: "a", name: "Kevin", adsCreated: 3, batches: 1 },
      { userId: "b", name: "Seth", adsCreated: 9, batches: 2 },
    ],
    [
      { userId: "a", name: "Kevin", actions: 100, activeDays: 6, breadth: 8 },
      { userId: "b", name: "Seth", actions: 4, activeDays: 1, breadth: 2 },
    ],
  )

  assert.deepEqual(rows.map(row => row.name), ["Seth", "Kevin"])
})

// ---------------------------------------------------------------------------
// scoreProbationWeek — the rubric is a proposal, but it must at least be consistent.
// ---------------------------------------------------------------------------

const clean = {
  launchers: [{ name: "Kevin Nguyen", batches: 2 }, { name: "Seth Tran", batches: 1 }],
  fallbacks: [],
  creativeAggregate: "works" as const,
  spotCheckMatched: 5,
  spotCheckTotal: 5,
}

test("a week with both users launching and no fallback is a full 100", () => {
  const score = scoreProbationWeek(clean)
  assert.deepEqual([score.kr1, score.kr2, score.total], [80, 20, 100])
  assert.equal(score.verdict, "on_track")
})

test("only launch fallbacks touch KR1; other never does", () => {
  const withOther = scoreProbationWeek({ ...clean, fallbacks: [{ reason: "other" }, { reason: "other" }] })
  assert.equal(withOther.kr1, 80)

  const withLaunch = scoreProbationWeek({ ...clean, fallbacks: [{ reason: "launch" }] })
  assert.equal(withLaunch.kr1, 70)
  assert.equal(withLaunch.launchFallbacks, 1)
})

test("a user the app cannot find is unknown, never a fail", () => {
  const score = scoreProbationWeek({ ...clean, launchers: [{ name: "Kevin Nguyen", batches: 2 }] })
  const seth = score.selfLaunch.find(entry => entry.name === "Seth")

  assert.equal(seth?.launched, null)
  // Half the self-launch points are simply not awarded — the missing half is reported
  // as "chưa có data", not as a ❌ against someone the query could not see.
  assert.equal(score.kr1, 20 + 40)
})

test("an unanswered spot check scores 0 and says so — not reporting is the fail", () => {
  const score = scoreProbationWeek({ ...clean, spotCheckMatched: null })
  assert.equal(score.spotCheck.matched, null)
  assert.equal(score.kr2, 15)
})

test("KR2 control fallbacks cost 2.5 each and floor at zero for that line", () => {
  const score = scoreProbationWeek({
    ...clean,
    fallbacks: [{ reason: "review_status" }, { reason: "review_status" }, { reason: "review_status" }],
  })

  assert.equal(score.reviewStatusFallbacks, 3)
  // 5 - 3*2.5 clamps to 0, not to -2.5.
  assert.equal(score.kr2, 15)
})

test("an empty fallback log is flagged unverified, not read as a clean week", () => {
  const empty = scoreProbationWeek(clean)
  assert.equal(empty.unverified, true)
  // The points are still awarded — withholding them would invent a failure — but the
  // block has to say out loud which of the two readings it cannot rule out.
  assert.equal(empty.total, 100)

  const block = buildProbationReport({ score: empty, week: 1, reportDate: "05/08/2026", monthToDate: 100 })
  assert.match(block, /chưa ai log fallback/)
  assert.match(block, /chưa kiểm chứng/)

  assert.equal(scoreProbationWeek({ ...clean, fallbacks: [{ reason: "other" }] }).unverified, false)
})

test("the report block prints unknowns as text, never as a zero", () => {
  const score = scoreProbationWeek({
    launchers: [],
    fallbacks: [],
    creativeAggregate: null,
    spotCheckMatched: null,
    spotCheckTotal: 5,
  })

  const block = buildProbationReport({ score, week: 1, reportDate: "05/08/2026", monthToDate: null })

  assert.match(block, /Kevin chưa có data/)
  assert.match(block, /chưa trả lời/)
  assert.match(block, /chưa spot check/)
  assert.match(block, /chưa đủ tuần để tính/)
  assert.doesNotMatch(block, /❌/)
})

test("the block is short enough to paste, and carries the counted fallbacks", () => {
  const score = scoreProbationWeek({ ...clean, fallbacks: [{ reason: "launch" }] })
  const block = buildProbationReport({
    score,
    week: 2,
    reportDate: "05/08/2026",
    monthToDate: 85,
    note: "table mode đơ khi dán 40 dòng",
  })

  assert.match(block, /launch fallback 1 lần/)
  assert.match(block, /\*\*Month-to-date\*\* 85\/100 → On track/)
  assert.match(block, /Ghi chú:_ table mode đơ khi dán 40 dòng/)
  // A block nobody scrolls is a block people read. Six lines, not fifteen.
  assert.ok(block.split("\n").length <= 7, block)
})
