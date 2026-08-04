// refactor-fragile: the assertions below read source files as text, so they fail on
// renames, moves and reformatting as readily as on real behaviour changes. Before
// adding one, read tests/README.md — assert the contract, not the characters.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const read = path => readFileSync(join(process.cwd(), path), "utf8")

describe("Ads Manager inline loading contract", () => {
  it("does not block or replace the page with a loading overlay", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")

    assert.doesNotMatch(page, /<p className="font-semibold">Loading Ads Manager<\/p>/)
    assert.doesNotMatch(page, /absolute inset-0 z-\[70\]/)
    assert.doesNotMatch(page, /loading && currentData\.length === 0/)
  })

  it("shows progress in the table header and marks the region busy", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")

    // The bar lives in <thead>, is rendered only while loading, and reports its
    // position to assistive tech rather than animating a sweep.
    assert.match(page, /isDataLoading && \(/)
    assert.match(page, /role="progressbar"/)
    assert.match(page, /aria-valuetext=/)
    assert.match(page, /aria-busy=\{isDataLoading\}/)
    // Width is driven by the numeric progress value, i.e. determinate.
    assert.match(page, /width: `\$\{Math\.max\(0, Math\.min\(100, loadingProgress\)\)\}%`/)
  })

  it("keeps stale rows non-interactive, and only dims them on an account switch", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")

    // Rows must not be clickable while their data is stale.
    assert.match(page, /<tbody className=\{cn\([\s\S]*?pointer-events-none/)
    // Dimming is reserved for switching account, where the whole table is
    // replaced. A plain refresh must not dim — that flicker was the bug fixed
    // in 61fff28, so this asserts the opacity change is gated on the account
    // switch and not on `loading`.
    assert.match(page, /isLoadingAccount \? "opacity-35/)
  })

  it("climbs toward 90 while Meta responds, then snaps to 100 on completion", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")

    assert.match(page, /setLoadingProgress\(0\)/)
    assert.match(page, /window\.setInterval/)
    // Holds at 90 rather than rushing past it while the request is outstanding.
    assert.match(page, /current >= 90/)
    assert.match(page, /Math\.min\(90,/)
    assert.match(page, /setLoadingProgress\(100\)/)
  })

  it("has no indeterminate sweep left in the page", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")

    // 61fff28 deliberately removed the animated sweep: it visibly looped while
    // waiting and read as jitter. Guard against it coming back.
    assert.doesNotMatch(page, /ads-manager-progress-indicator/)
    assert.doesNotMatch(page, /setLoadingPhase/)
  })
})
