// refactor-fragile: the assertions below read source files as text, so they fail on
// renames, moves and reformatting as readily as on real behaviour changes. Before
// adding one, read tests/README.md — assert the contract, not the characters.
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = path => readFileSync(join(process.cwd(), path), "utf8")

describe("Ads Manager hierarchy and tab-state contract", () => {
  it("loads drill-down children from their selected Meta parent", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")

    assert.match(page, /campaign_id=\$\{encodeURIComponent\(hierarchyParentId\)\}/)
    assert.match(page, /campaign_ids=\$\{encodeURIComponent\(hierarchyParentIds\.join\(","\)\)\}/)
    assert.match(page, /adset_id=\$\{encodeURIComponent\(hierarchyParentId\)\}/)
  })

  it("loads one merged, paginated Ad set result for multiple selected Campaigns", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")
    const route = read("app/api/facebook/adsets/route.ts")

    assert.doesNotMatch(page, /Select one campaign at a time to view its ad sets\./)
    assert.match(route, /sp\.getAll\("campaign_ids"\)/)
    assert.match(route, /Promise\.all\(multiCampaignIds\.map/)
    assert.match(route, /multi:\$\{nextOffset\}/)
    assert.match(route, /multiCampaignIds\.join\(","\)/)
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

  it("loads Ads from either multiple Campaigns or multiple Ad sets without stale blockers", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")
    const route = read("app/api/facebook/ads/route.ts")

    assert.doesNotMatch(page, /Select one ad set at a time to view its ads\./)
    assert.doesNotMatch(page, /Select an ad set before viewing its ads\./)
    assert.match(page, /adset_ids=\$\{encodeURIComponent\(hierarchyParentIds\.join\(","\)\)\}/)
    assert.match(page, /campaign_ids=\$\{encodeURIComponent\(hierarchyParentIds\.join\(","\)\)\}/)
    assert.match(route, /parseIds\(sp, "adset_ids"\)/)
    assert.match(route, /parseIds\(sp, "campaign_ids"\)/)
    assert.match(route, /Promise\.all\(multiParentIds\.map/)
  })

  it("renders Learning as a plain delivery label without conversion progress", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")

    assert.match(page, /isLearning \? "Learning"/)
    assert.doesNotMatch(page, /learning\?\.conversions[\s\S]*?\/50/)
  })
})
