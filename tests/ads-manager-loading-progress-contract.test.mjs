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

    assert.match(page, /<thead[\s\S]*?isDataLoading[\s\S]*?loadingProgress[\s\S]*?style=\{\{ width:/)
    assert.match(page, /<tbody className=\{cn\([\s\S]*?isDataLoading[\s\S]*?pointer-events-none[\s\S]*?opacity-35/)
    assert.match(page, /aria-busy=\{isDataLoading\}/)
    assert.match(page, /readJsonWithProgress/)
    assert.doesNotMatch(page, /ads-manager-progress-indicator absolute inset-y-0/)
  })
})
