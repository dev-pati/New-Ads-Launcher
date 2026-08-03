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

  it("shows progress below the table header and dims stale rows", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")
    const styles = read("app/globals.css")

    assert.match(page, /<thead[\s\S]*?isDataLoading[\s\S]*?role="progressbar"[\s\S]*?ads-manager-progress-indicator/)
    assert.match(page, /<tbody className=\{cn\([\s\S]*?isDataLoading[\s\S]*?pointer-events-none[\s\S]*?opacity-35/)
    assert.match(page, /aria-busy=\{isDataLoading\}/)
    assert.match(page, /readJsonWithProgress/)
    assert.match(styles, /@keyframes ads-manager-indeterminate-progress/)
    assert.match(styles, /\.ads-manager-progress-indicator[\s\S]*?animation: ads-manager-indeterminate-progress/)
  })

  it("starts indeterminate, then advances 3 to 90 before completing at 100", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")

    assert.match(page, /setLoadingProgress\(3\)/)
    assert.match(page, /setLoadingPhase\("indeterminate"\)/)
    assert.match(page, /setLoadingPhase\("determinate"\)/)
    assert.match(page, /isDataLoading && \(/)
    assert.match(page, /window\.setInterval/)
    assert.match(page, /current >= 90/)
    assert.match(page, /current \+ 4/)
    assert.match(page, /Math\.max\(current, value\)/)
    assert.match(page, /setLoadingProgress\(100\)/)
    assert.match(page, /setLoadingPhase\("complete"\)/)
    assert.match(page, /window\.setTimeout\(resolve, 140\)/)
  })
})
