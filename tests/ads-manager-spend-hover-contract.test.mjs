import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const read = path => readFileSync(join(process.cwd(), path), "utf8")

describe("Ads Manager spend hover contract", () => {
  it("does not cancel the trend request when loading state changes", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")

    assert.match(page, /if \(!open \|\| trendLoaded \|\| trendLoading \|\| !accountId\) return/)
    assert.match(page, /\[accountId, datePreset, level, open, row\.id, since, trendLoaded, until\]/)
    assert.doesNotMatch(page, /trendLoaded, trendLoading, until\]\)/)
  })

  it("provides a stable chart action from the spend popup", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")

    assert.match(page, /aria-label="Open performance chart"/)
    assert.match(page, /event\.stopPropagation\(\)[\s\S]*?onOpenCharts\(\)/)
    assert.match(page, /const hoverTarget = useRef<"trigger" \| "content" \| null>\(null\)/)
  })
})
