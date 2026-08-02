import assert from "node:assert/strict"
import test from "node:test"

import { normalizeMetaProcessingPercent } from "../lib/meta-assignment-progress"

test("keeps Meta per-item processing percentage on the 0-100 scale", () => {
  assert.equal(normalizeMetaProcessingPercent(0), 0)
  assert.equal(normalizeMetaProcessingPercent(42.6), 43)
  assert.equal(normalizeMetaProcessingPercent(100), 100)
})

test("does not fabricate a percentage when Meta has not supplied one", () => {
  assert.equal(normalizeMetaProcessingPercent(null), null)
  assert.equal(normalizeMetaProcessingPercent(undefined), null)
  assert.equal(normalizeMetaProcessingPercent("42"), null)
  assert.equal(normalizeMetaProcessingPercent(-1), null)
  assert.equal(normalizeMetaProcessingPercent(101), null)
})
