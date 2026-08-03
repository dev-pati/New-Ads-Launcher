import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { datePresetToRange, resolveAdsManagerTimeRange } from "../lib/snapshot-fallback"

const daysBetween = (since: string, until: string) =>
  Math.round((Date.parse(until) - Date.parse(since)) / 86_400_000)

describe("Ads Manager date range normalization", () => {
  it("includes today in Last N days presets", () => {
    const last7 = datePresetToRange("last_7d")
    const last30 = datePresetToRange("last_30d")
    const today = new Date().toISOString().split("T")[0]

    assert.equal(last7.until, today)
    assert.equal(last30.until, today)
    assert.equal(daysBetween(last7.since, last7.until), 6)
    assert.equal(daysBetween(last30.since, last30.until), 29)
  })

  it("preserves an explicit client range and clamps future dates to today", () => {
    const explicit = JSON.parse(resolveAdsManagerTimeRange(
      "last_7d",
      JSON.stringify({ since: "2026-07-20", until: "2026-07-26" }),
    ))
    assert.deepEqual(explicit, { since: "2026-07-20", until: "2026-07-26" })

    const future = JSON.parse(resolveAdsManagerTimeRange(
      "custom",
      JSON.stringify({ since: "2099-01-01", until: "2099-01-02" }),
    ))
    const today = new Date().toISOString().split("T")[0]
    assert.deepEqual(future, { since: today, until: today })
  })

  it("serializes canonical presets as a Meta time_range", () => {
    const resolved = JSON.parse(resolveAdsManagerTimeRange("last_14d"))
    assert.equal(daysBetween(resolved.since, resolved.until), 13)
  })
})
