import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = path => readFileSync(join(process.cwd(), path), "utf8")

describe("Ads Manager hierarchy and tab-state contract", () => {
  it("loads drill-down children from their selected Meta parent", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")

    assert.match(page, /campaign_id=\$\{encodeURIComponent\(hierarchyParentId\)\}/)
    assert.match(page, /adset_id=\$\{encodeURIComponent\(hierarchyParentId\)\}/)
  })

  it("reuses a loaded tab state until an explicit refresh path asks for Meta again", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")

    assert.match(page, /if \(cached\) \{[\s\S]*?return\s*\}/)
    assert.match(page, /useEffect\(\(\) => \{ fetchMainData\(\) \}, \[fetchMainData\]\)/)
    assert.match(page, /fetchMainData\(true\)/)
    assert.match(page, /clientCache\.current\.clear\(\)/)
  })

  it("separates cached hierarchy pages by their selected parent", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")

    assert.match(page, /hierarchy:\$\{hierarchyCacheKey\}/)
  })

  it("does not pretend that multiple parent cursors are one complete hierarchy", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")

    assert.match(page, /Select one campaign at a time to view its ad sets\./)
    assert.match(page, /Select one ad set at a time to view its ads\./)
    assert.match(page, /Select an ad set before viewing its ads\./)
  })
})
