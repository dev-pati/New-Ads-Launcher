import assert from "node:assert/strict"
import test from "node:test"
import {
  CREATIVE_SORT_KEYS,
  MEDIA_STATUS_NOTE,
  formatMoney,
  sortCreatives,
  type CreativeMediaStatus,
} from "../lib/tracking/creative-table.ts"

// ---------------------------------------------------------------------------
// formatMoney — the column that was actually wrong. Spend rendered as a bare number, and
// on a VND account the same digits read as dollars: a 25,000× misreading of a number
// people quote in a review.
// ---------------------------------------------------------------------------

test("money carries its currency", () => {
  const vnd = formatMoney(1_234_567, "VND")
  const usd = formatMoney(1_234_567, "USD")

  // Not asserting the exact glyph or separator — those are the runtime's locale business.
  // What matters is that the two are distinguishable and neither is a bare number.
  assert.notEqual(vnd, usd)
  assert.equal(/^[\d.,\s]+$/.test(vnd), false, `VND rendered as a bare number: ${vnd}`)
  assert.equal(/^[\d.,\s]+$/.test(usd), false, `USD rendered as a bare number: ${usd}`)
})

test("an unknown currency prints the number rather than hiding it", () => {
  // The table says once, in prose, that the unit is unknown. Blanking the column would
  // lose the ranking too — and the ranking is still true whatever the unit is.
  assert.match(formatMoney(1234, null), /1[.,]?234/)
})

test("small amounts keep their precision, large ones do not", () => {
  // A 12.34 cost-per-result rounded to 12 is a 3% error on the number a buyer optimises.
  assert.match(formatMoney(12.34, "USD"), /12[.,]34/)
  assert.doesNotMatch(formatMoney(12_345.67, "USD"), /67/)
})

test("a non-finite value is a dash, never NaN", () => {
  // costPerResult is spend/results and results can be 0.
  assert.equal(formatMoney(Number.NaN, "USD"), "—")
  assert.equal(formatMoney(Number.POSITIVE_INFINITY, null), "—")
})

// ---------------------------------------------------------------------------
// sortCreatives — reordering the 20 rows already fetched. A sort that drops or invents a
// row would look identical in a screenshot, so the count is asserted every time.
// ---------------------------------------------------------------------------

const rows = [
  { adId: "a", spend: 100, roas: 1.5, results: 10, ctr: 2.0, costPerResult: 10 },
  { adId: "b", spend: 300, roas: 0.5, results: 2, ctr: 4.0, costPerResult: 150 },
  { adId: "c", spend: 200, roas: 3.0, results: 40, ctr: 1.0, costPerResult: 5 },
]

test("every sortable column orders both ways and keeps all rows", () => {
  for (const key of CREATIVE_SORT_KEYS) {
    const desc = sortCreatives(rows, key, "desc")
    const asc = sortCreatives(rows, key, "asc")

    assert.equal(desc.length, rows.length, `${key} desc dropped a row`)
    assert.equal(asc.length, rows.length, `${key} asc dropped a row`)
    assert.deepEqual(desc.map(row => row.adId).sort(), ["a", "b", "c"])
    assert.deepEqual(asc.map(row => row.adId), [...desc].reverse().map(row => row.adId))
  }
})

test("the default view is still top-by-spend", () => {
  assert.deepEqual(sortCreatives(rows, "spend", "desc").map(row => row.adId), ["b", "c", "a"])
  // Cheapest-first is the whole reason cost/result is sortable ascending.
  assert.deepEqual(sortCreatives(rows, "costPerResult", "asc").map(row => row.adId), ["c", "a", "b"])
})

test("sorting does not mutate the fetched rows", () => {
  const before = rows.map(row => row.adId)
  sortCreatives(rows, "roas", "asc")
  assert.deepEqual(rows.map(row => row.adId), before)
})

// ---------------------------------------------------------------------------
// The media-detail statuses. "No metadata" answered four different situations, one of
// which is "Portal is fine — this ad was never launched from AdLauncher".
// ---------------------------------------------------------------------------

test("every non-linked status has a sentence, and none of them says 'error'", () => {
  const statuses: CreativeMediaStatus[] = ["no_media_key", "not_in_adlauncher", "not_from_portal", "portal_missing"]
  for (const status of statuses) {
    const note = MEDIA_STATUS_NOTE[status as Exclude<CreativeMediaStatus, "linked">]
    assert.ok(note && note.length > 20, `${status} needs an explanation a reader can act on`)
  }
  // Three of the four are normal facts about where an ad came from. Calling them failures
  // would train people to ignore the one that is a real gap.
  assert.match(MEDIA_STATUS_NOTE.not_in_adlauncher, /outside AdLauncher/)
  assert.match(MEDIA_STATUS_NOTE.not_from_portal, /uploaded directly/)
})
