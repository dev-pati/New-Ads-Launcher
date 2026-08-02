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
    const spendHover = page.slice(page.indexOf("function SpendHoverValue"), page.indexOf("function fmtPct"))

    assert.match(page, /aria-label="Open performance chart"/)
    assert.match(page, /event\.stopPropagation\(\)[\s\S]*?onOpenCharts\(\)/)
    assert.match(spendHover, /triggerPointer: false,[\s\S]*?triggerFocus: false,[\s\S]*?contentPointer: false,[\s\S]*?contentFocus: false/)
    assert.equal((spendHover.match(/onMouseEnter=\{\(\) => enterTarget\("triggerPointer"\)\}/g) || []).length, 1,
      "value and chart icon share one hover surface")
    assert.equal((spendHover.match(/onMouseLeave=\{\(\) => leaveTarget\("triggerPointer"\)\}/g) || []).length, 1,
      "leaving children inside the Amount Spent control must not schedule a close")
    assert.match(spendHover, /onFocusCapture=\{\(\) => enterTarget\("triggerFocus"\)\}/)
    assert.match(spendHover, /onFocusCapture=\{\(\) => enterTarget\("contentFocus"\)\}/)
    assert.match(spendHover, /<Popover open=\{open\} onOpenChange=\{handleOpenChange\}>/)
    assert.match(spendHover, /if \(!nextOpen\) \{[\s\S]*?contentPointer: false,[\s\S]*?contentFocus: false,[\s\S]*?clearTimeout\(closeTimer\.current\)/,
      "Escape and outside dismissal clear stale portalled-content state")
    assert.match(spendHover, /onOpenAutoFocus=\{event => event\.preventDefault\(\)\}/,
      "hover opening does not steal keyboard focus")
    assert.ok(spendHover.indexOf('aria-label="Open performance chart"') < spendHover.indexOf("<PopoverTrigger asChild>"),
      "chart icon stays left of the spend value")
  })
})
