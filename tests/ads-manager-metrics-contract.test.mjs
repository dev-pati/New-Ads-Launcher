// refactor-fragile: the assertions below read source files as text, so they fail on
// renames, moves and reformatting as readily as on real behaviour changes. Before
// adding one, read tests/README.md — assert the contract, not the characters.
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const read = path => readFileSync(join(root, path), "utf8")

describe("Ads Manager metrics contract", () => {
  it("requests action_values for purchase value metrics", () => {
    const facebook = read("lib/facebook.ts")
    const breakdown = read("app/api/facebook/breakdown-insights/route.ts")

    // lib/facebook.ts used to inline the joined field string. The fields are now declared as
    // an array that is `.join(",")`-ed, so the guarantee is unchanged (the request URL still
    // carries actions,action_values,cost_per_action_type) but the literal is no longer in the
    // source. Assert the array form — same three fields, current shape.
    assert.match(facebook, /"actions", "action_values", "cost_per_action_type"/)
    assert.match(facebook, /\]\.join\(","\)/)
    assert.match(breakdown, /"actions", "action_values", "cost_per_action_type"/)
  })

  it("paginates Meta list and breakdown responses", () => {
    const facebook = read("lib/facebook.ts")
    const breakdown = read("app/api/facebook/breakdown-insights/route.ts")

    assert.match(facebook, /async function fetchAllMetaPages/)
    assert.match(facebook, /data\.paging\?\.next/)
    assert.match(breakdown, /while \(nextUrl\)/)
    assert.match(breakdown, /result\.paging\?\.next/)
  })

  it("calculates purchase value, AOV, and ROAS from action_values", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")

    assert.match(page, /function getActionValueAmount/)
    assert.match(page, /const purchaseValue = getActionValueAmount\(ins, "omni_purchase"\)/)
    assert.match(page, /purchaseValue \/ purchasesN/)
    assert.match(page, /purchaseValue \/ spend/)

    const purchaseValueCase = page.slice(
      page.indexOf('case "purchase_value"'),
      page.indexOf('case "cost_per_purchase"')
    )
    assert.doesNotMatch(purchaseValueCase, /purchase_roas|omni_purchase_roas/)
  })

  it("keeps custom date ranges in the user's selected local calendar day", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")
    const buildDateParamSection = page.slice(
      page.indexOf("const buildDateParam"),
      page.indexOf("const fetchMainData")
    )

    assert.match(page, /function formatMetaDate\(date: Date\)/)
    assert.match(buildDateParamSection, /since: formatMetaDate\(customDateRange\.start\)/)
    assert.match(buildDateParamSection, /until: formatMetaDate\(customDateRange\.end\)/)
    assert.doesNotMatch(buildDateParamSection, /toISOString\(\)/)
  })
})
