import assert from "node:assert/strict"
import test from "node:test"
import {
  FALLBACK_STORAGE_KEY,
  KEPT_WEEKS,
  emptyWeek,
  readWeek,
  toScoreFallbacks,
  totalCount,
  weeksInRange,
  writeWeek,
} from "../lib/tracking/fallback-local.ts"
import { scoreProbationWeek } from "../lib/tracking/probation.ts"
import { reportToHtml } from "../lib/tracking/report.ts"

/** localStorage without a browser. */
function memoryStorage(seed?: string) {
  const map = new Map<string, string>()
  if (seed !== undefined) map.set(FALLBACK_STORAGE_KEY, seed)
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
    raw: () => map.get(FALLBACK_STORAGE_KEY),
  }
}

// ---------------------------------------------------------------------------
// The tally is hand-kept and lives in a store the user can edit, so every read is
// treated as untrusted input. Losing a tally is bad; a dashboard that throws on load
// is worse.
// ---------------------------------------------------------------------------

test("a week that was never written reads as empty, not as an error", () => {
  const week = readWeek(memoryStorage(), "user-a", "2026-08-03")

  assert.equal(totalCount(week), 0)
  // Unanswered is not "no" and not 0 — the score prints these as text.
  assert.equal(week.creativeAggregate, null)
  assert.equal(week.spotCheckMatched, null)
})

test("corrupt or hostile stored values are repaired, never thrown on", () => {
  assert.equal(totalCount(readWeek(memoryStorage("not json at all"), "user-a", "2026-08-03")), 0)

  const week = readWeek(
    memoryStorage(JSON.stringify({
      "user-a": {
        "2026-08-03": {
          counts: { launch: -4, review_status: 2.7, performance: "3" },
          creativeAggregate: "maybe",
          spotCheckTotal: 0,
          note: 42,
        },
      },
    })),
    "user-a",
    "2026-08-03",
  )

  assert.equal(week.counts.launch, 0)        // negative is not a count
  assert.equal(week.counts.review_status, 2) // floored, not rounded up
  assert.equal(week.counts.performance, 0)   // a string is not a number
  assert.equal(week.creativeAggregate, null) // an unknown answer is no answer
  assert.equal(week.spotCheckTotal, 5)       // a zero denominator would divide by zero
  assert.equal(week.note, "")
})

test("each user reads their own tally on a shared machine", () => {
  const storage = memoryStorage()
  writeWeek(storage, "user-a", { ...emptyWeek("2026-08-03"), counts: { ...emptyWeek("2026-08-03").counts, launch: 3 } })

  assert.equal(readWeek(storage, "user-a", "2026-08-03").counts.launch, 3)
  assert.equal(readWeek(storage, "user-b", "2026-08-03").counts.launch, 0)
})

test("the blob is pruned to the kept window, newest weeks first", () => {
  const storage = memoryStorage()
  for (let index = 0; index < KEPT_WEEKS + 4; index += 1) {
    const day = String(index + 1).padStart(2, "0")
    writeWeek(storage, "user-a", emptyWeek(`2026-01-${day}`))
  }

  const stored = JSON.parse(storage.raw() as string)
  const kept = Object.keys(stored["user-a"]).sort()
  assert.equal(kept.length, KEPT_WEEKS)
  assert.equal(kept.at(-1), `2026-01-${String(KEPT_WEEKS + 4).padStart(2, "0")}`)
})

test("weeksInRange is bounded by the month, end exclusive", () => {
  const storage = memoryStorage()
  for (const week of ["2026-07-27", "2026-08-03", "2026-08-31", "2026-09-01"]) {
    writeWeek(storage, "user-a", emptyWeek(week))
  }

  const weeks = weeksInRange(storage, "user-a", "2026-08-01", "2026-09-01")
  assert.deepEqual(weeks.map(week => week.weekStart), ["2026-08-03", "2026-08-31"])
})

test("counts turn back into the rows the score expects", () => {
  const week = emptyWeek("2026-08-03")
  week.counts.launch = 2
  week.counts.review_status = 1

  const fallbacks = toScoreFallbacks(week)
  assert.equal(fallbacks.length, 3)

  // The whole point of the round trip: one scoring path, whether the rows came from a
  // table or from a number somebody typed.
  const score = scoreProbationWeek({
    launchers: [{ name: "Kevin Nguyen", batches: 1 }, { name: "Seth Tran", batches: 1 }],
    fallbacks,
    creativeAggregate: "works",
    spotCheckMatched: 5,
    spotCheckTotal: 5,
  })

  assert.equal(score.launchFallbacks, 2)
  assert.equal(score.kr1, 60)
  assert.equal(score.unverified, false)
})

// ---------------------------------------------------------------------------
// reportToHtml — the PDF path. A stored Meta error message ends up in this document.
// ---------------------------------------------------------------------------

test("the printable report escapes before it formats", () => {
  const html = reportToHtml('**Risk** — top error "<script>alert(1)</script>" ×2')

  assert.ok(html.includes("&lt;script&gt;"))
  assert.ok(!html.includes("<script>"))
  assert.ok(html.includes("<strong>Risk</strong>"))
})

test("headings and emphasis survive, blank lines do not become empty paragraphs", () => {
  const html = reportToHtml("# Tracking\n\n## Probation\n_footnote_")

  assert.ok(html.includes("<h1>Tracking</h1>"))
  assert.ok(html.includes("<h2>Probation</h2>"))
  assert.ok(html.includes("<em>footnote</em>"))
  assert.ok(!html.includes("<p></p>"))
})
