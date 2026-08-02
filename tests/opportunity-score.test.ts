import assert from "node:assert/strict"
import test from "node:test"

import { normalizeOpportunityScore } from "../lib/opportunity-score"

test("normalizes Meta Opportunity Score from either supported scale", () => {
  assert.equal(normalizeOpportunityScore(0.74), 74)
  assert.equal(normalizeOpportunityScore(74), 74)
  assert.equal(normalizeOpportunityScore("0.74"), 74)
  assert.equal(normalizeOpportunityScore(1), 1)
})

test("rejects missing, invalid, and out-of-range Opportunity Scores", () => {
  assert.equal(normalizeOpportunityScore(null), null)
  assert.equal(normalizeOpportunityScore(undefined), null)
  assert.equal(normalizeOpportunityScore("not-a-score"), null)
  assert.equal(normalizeOpportunityScore(-1), null)
  assert.equal(normalizeOpportunityScore(101), null)
})
