import assert from "node:assert/strict"
import test from "node:test"
import { LatestRequestGuard } from "../lib/latest-request-guard.ts"

test("only the newest hierarchy request may update the UI", () => {
  const guard = new LatestRequestGuard()
  const first = guard.begin()
  const second = guard.begin()

  assert.equal(first.signal.aborted, true)
  assert.equal(first.isCurrent(), false)
  assert.equal(second.signal.aborted, false)
  assert.equal(second.isCurrent(), true)
})
