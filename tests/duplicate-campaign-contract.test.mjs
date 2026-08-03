// refactor-fragile: the assertions below read source files as text, so they fail on
// renames, moves and reformatting as readily as on real behaviour changes. Before
// adding one, read tests/README.md — assert the contract, not the characters.
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = path => readFileSync(join(process.cwd(), path), "utf8")

describe("Duplicate campaign contract", () => {
  it("does not report success when every ad set copy fails", () => {
    const route = read("app/api/facebook/campaigns/duplicate-adsets/route.ts")

    assert.match(route, /createdAdSetCount === 0 && errors\.length > 0/)
    assert.match(route, /status: 502/)
  })

  it("keeps Meta hierarchy pages small when nested insights are requested", () => {
    const facebook = read("lib/facebook.ts")
    const hierarchyReads = facebook.slice(
      facebook.indexOf("export async function getCampaigns"),
      facebook.indexOf("// Ad interfaces and functions")
    )

    assert.doesNotMatch(hierarchyReads, /limit=500/)
    assert.match(hierarchyReads, /const pageLimit = maxRows \? Math\.min\(25, maxRows\) : 25/g)
  })
})
