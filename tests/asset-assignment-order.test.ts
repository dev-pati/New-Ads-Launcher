import assert from "node:assert/strict"
import test from "node:test"

import { collectAllCreativePages, sortCreativesByLatestAssignment } from "../lib/creative-media"

test("recent assignments outrank newer creative creation dates before pagination", () => {
  const ordinary = Array.from({ length: 21 }, (_, index) => ({
    id: `ordinary-${index}`,
    created_at: `2026-08-01T${String(index).padStart(2, "0")}:00:00Z`,
  }))
  const recentlyAssigned = [
    { id: "assigned-one", created_at: "2026-07-01T00:00:00Z", assigned_at: "2026-08-02T10:00:00Z" },
    { id: "assigned-two", created_at: "2026-07-02T00:00:00Z", assigned_at: "2026-08-02T11:00:00Z" },
  ]

  const firstPage = sortCreativesByLatestAssignment([...ordinary, ...recentlyAssigned]).slice(0, 20)

  assert.deepEqual(firstPage.slice(0, 2).map(item => item.id), ["assigned-two", "assigned-one"])
})

test("creation date remains the fallback for media without an assignment", () => {
  const sorted = sortCreativesByLatestAssignment([
    { id: "older", created_at: "2026-07-30T00:00:00Z" },
    { id: "newer", created_at: "2026-07-31T00:00:00Z" },
  ])

  assert.deepEqual(sorted.map(item => item.id), ["newer", "older"])
})

test("collects candidates beyond the first database page before sorting", async () => {
  const rows = Array.from({ length: 1002 }, (_, index) => ({ id: index }))
  const calls: Array<[number, number]> = []

  const collected = await collectAllCreativePages(async (from, to) => {
    calls.push([from, to])
    return rows.slice(from, to + 1)
  })

  assert.equal(collected.length, 1002)
  assert.deepEqual(calls, [[0, 999], [1000, 1999]])
})
