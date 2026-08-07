import assert from "node:assert/strict"
import { test } from "node:test"
import { getRangeToggledIds } from "../lib/range-selection.ts"

const IDS = ["a", "b", "c", "d", "e"]

test("shift-click selects inclusive range from anchor to clicked (forward)", () => {
  const { nextSelected, nextAnchorId } = getRangeToggledIds(new Set(["a"]), IDS, "d", "a", true, false)
  assert.deepEqual([...nextSelected].sort(), ["a", "b", "c", "d"])
  assert.equal(nextAnchorId, "a", "shift-click keeps anchor so the range can be re-extended")
})

test("shift-click selects inclusive range in reverse", () => {
  const { nextSelected, nextAnchorId } = getRangeToggledIds(new Set(["d"]), IDS, "b", "d", true, false)
  assert.deepEqual([...nextSelected].sort(), ["b", "c", "d"])
  assert.equal(nextAnchorId, "d")
})

test("shift+ctrl-click removes the range", () => {
  const prev = new Set(["a", "b", "c", "d"])
  const { nextSelected } = getRangeToggledIds(prev, IDS, "c", "a", true, true)
  assert.deepEqual([...nextSelected], ["d"])
})

test("plain click toggles a single id and moves the anchor", () => {
  const { nextSelected, nextAnchorId } = getRangeToggledIds(new Set(), IDS, "c", null, false, false)
  assert.deepEqual([...nextSelected], ["c"])
  assert.equal(nextAnchorId, "c")
})

test("plain click on an already-selected id deselects it", () => {
  const { nextSelected, nextAnchorId } = getRangeToggledIds(new Set(["c"]), IDS, "c", "c", false, false)
  assert.equal(nextSelected.size, 0)
  assert.equal(nextAnchorId, "c")
})

test("shift-click with no anchor falls back to a plain toggle", () => {
  const { nextSelected, nextAnchorId } = getRangeToggledIds(new Set(), IDS, "c", null, true, false)
  assert.deepEqual([...nextSelected], ["c"])
  assert.equal(nextAnchorId, "c")
})

test("shift-click when anchor is no longer in the list falls back to a plain toggle", () => {
  const { nextSelected, nextAnchorId } = getRangeToggledIds(new Set(), IDS, "c", "zzz", true, false)
  assert.deepEqual([...nextSelected], ["c"])
  assert.equal(nextAnchorId, "c")
})
