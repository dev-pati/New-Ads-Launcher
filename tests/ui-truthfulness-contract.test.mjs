import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readFileSync } from "node:fs"

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

describe("production UI truthfulness", () => {
  it("removes audited placeholder links and empty click handlers", () => {
    const files = [
      "components/ads-manager/PerformancePopup.tsx",
      "app/(dashboard)/ads-manager/page.tsx",
      "app/(dashboard)/launch/page.tsx",
      "app/(dashboard)/page-manager/page.tsx",
      "app/(dashboard)/insights/page.tsx",
      "components/inspo/AdDetailLeftPanel.tsx",
    ]
    for (const file of files) {
      const source = read(file)
      assert.doesNotMatch(source, /href="#"/, file)
      assert.doesNotMatch(source, /onClick=\{\(\) => \{\}\}/, file)
    }
  })

  it("keeps roadmap automation visible but unavailable", () => {
    const page = read("app/(dashboard)/automate/page.tsx")
    for (const platform of ["tiktok", "snapchat", "pinterest"]) {
      assert.match(page, new RegExp(`id: "launch_winners_${platform}"`))
    }
    assert.match(page, /disabled=\{isSoon\}/)
    assert.match(page, /if \(!isSoon\) useTemplate\(t\)/)
  })

  it("rejects roadmap-only automation at the API boundary", () => {
    const createRoute = read("app/api/automations/route.ts")
    const updateRoute = read("app/api/automations/[id]/route.ts")
    assert.match(createRoute, /findRoadmapOnlyAutomationApp\(steps\)/)
    assert.match(updateRoute, /findRoadmapOnlyAutomationApp\(steps\)/)
  })
})
