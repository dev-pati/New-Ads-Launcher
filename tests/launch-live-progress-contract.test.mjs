import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = path => readFileSync(join(process.cwd(), path), "utf8")

describe("Launch live progress contract", () => {
  it("lets active launches minimize into a non-modal status dock", () => {
    const dialog = read("components/launch/launch-progress-dialog.tsx")

    assert.doesNotMatch(dialog, /Prevent closing during active launch/)
    assert.match(dialog, /role="status"/)
    assert.match(dialog, /fixed bottom-4 left-4/)
    assert.match(dialog, /onClick=\{\(\) => onOpenChange\(true\)\}/)
  })

  it("removes bulk activation controls from Configure Ad Sets", () => {
    const page = read("app/(dashboard)/launch/page.tsx")
    const configure = page.slice(
      page.indexOf("Choose Ad Sets ("),
      page.indexOf("sourceAdSets.map")
    )

    assert.doesNotMatch(configure, /Activate All|Pause All/)
  })

  it("polls launched ad status without a manual refresh", () => {
    const page = read("app/(dashboard)/launch/page.tsx")
    const resultModal = page.slice(
      page.indexOf("function LaunchResultModal"),
      page.indexOf("function LaunchHistory")
    )

    assert.match(resultModal, /setInterval\(loadStatus, 5000\)/)
    assert.match(resultModal, /loadStatus\(\)/)
  })

  it("refreshes visible Ads Manager data on focus without polling", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")

    assert.match(page, /document\.visibilityState === "visible"/)
    assert.doesNotMatch(page, /setInterval\(refreshVisibleData, 60_000\)/)
    assert.match(page, /fetchMainData\(true\)/)
    assert.match(page, /useEffect\(\(\) => \{ fetchMainData\(\) \}, \[fetchMainData\]\)/)
    assert.match(page, /active_only=true/)
  })

  it("sorts newest launch time first, then active status", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")
    const comparator = page.slice(
      page.indexOf("const byNewestFirst = ("),
      page.indexOf("interface BreakdownRow")
    )

    assert.match(comparator, /effective_status === "ACTIVE"/)
    assert.match(comparator, /return bt - at/)
    assert.ok(comparator.indexOf("return bt - at") < comparator.indexOf('effective_status === "ACTIVE"'))
  })

  it("caps refresh API pagination at the requested row count", () => {
    const facebook = read("lib/facebook.ts")
    for (const route of ["campaigns", "adsets", "ads"]) {
      const source = read(`app/api/facebook/${route}/route.ts`)
      assert.match(source, /sp\.get\("limit"\)/)
      assert.match(source, /maxRows/)
    }
    assert.match(facebook, /rows\.length >= maxRows/)
    assert.match(facebook, /effective_status/)
  })

  it("keeps configured ad-set names when one-ad-per-adset duplicates structure", () => {
    for (const route of [
      "app/api/facebook/launch-direct/route.ts",
      "app/api/facebook/launch-table-batch/route.ts",
    ]) {
      const source = read(route)
      assert.match(source, /name: adSetInfo\.name/)
      assert.doesNotMatch(source, /name: `\$\{adSetInfo\.name\} - \$\{creative\.file_name\}`/)
    }
  })

  it("gives stored Portal videos a cacheable thumbnail resolver", () => {
    const media = read("lib/creative-media.ts")
    const route = read("app/api/creatives/[id]/media/route.ts")

    assert.match(media, /creative\.storage_path && \(!creative\.fb_thumbnail_url/)
    assert.match(route, /Cache-Control", "private, max-age=86400/)
  })
})
