// refactor-fragile: the assertions below read source files as text, so they fail on
// renames, moves and reformatting as readily as on real behaviour changes. Before
// adding one, read tests/README.md — assert the contract, not the characters.
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = path => readFileSync(join(process.cwd(), path), "utf8")

describe("Create Campaign UX and Ads Manager paging contract", () => {
  it("reuses shared media and copy pickers in Launch and New Ad", () => {
    const launch = read("app/(dashboard)/launch/page.tsx")
    const ad = read("components/ads-manager/create-flow/AdLevel.tsx")

    assert.match(launch, /components\/shared\/load-media-modal/)
    assert.match(ad, /components\/shared\/load-media-modal/)
    assert.match(launch, /components\/shared\/load-copy-modal/)
    assert.match(ad, /components\/shared\/load-copy-modal/)
    assert.match(ad, /setPickerOpen\(true\)/)
    assert.match(ad, /Load copy/)
    assert.doesNotMatch(ad, /Single image or video/)
    assert.match(ad, /previewItems\.map/)
  })

  it("marks missing fields inline without a top-level validation message", () => {
    const modal = read("components/ads-manager/create-flow/CreateCampaignModal.tsx")
    const campaign = read("components/ads-manager/create-flow/CampaignLevel.tsx")
    // Ad-set inputs live in the shared AdSetFormFields component, not AdSetLevel.
    const adSet = read("components/ads-manager/create-flow/AdSetFormFields.tsx")
    const ad = read("components/ads-manager/create-flow/AdLevel.tsx")

    assert.match(modal, /invalidFields/)
    assert.match(modal, /showValidation/)
    assert.doesNotMatch(modal, /setFormError\(validation\.message\)/)
    for (const source of [campaign, adSet, ad]) {
      assert.match(source, /aria-invalid/)
      assert.match(source, /border-red-500/)
    }
  })

  it("requests one opaque 20-row Meta cursor page at a time", () => {
    const page = read("app/(dashboard)/ads-manager/page.tsx")
    const facebook = read("lib/facebook.ts")

    assert.match(page, /useState<"all" \| "ACTIVE" \| "PAUSED">\("ACTIVE"\)/)
    assert.match(page, /const PAGE_SIZE = 20/)
    assert.match(page, /after/)
    assert.match(page, /hasNext/)
    assert.match(facebook, /fetchMetaPage/)
    assert.match(facebook, /paging/)
  })

  it("keys every hierarchy route by cursor and returns paging metadata", () => {
    for (const route of [
      "app/api/facebook/campaigns/route.ts",
      "app/api/facebook/adsets/route.ts",
      "app/api/facebook/ads/route.ts",
    ]) {
      const source = read(route)
      assert.match(source, /sp\.get\("after"\)/)
      assert.match(source, /after:/)
      assert.match(source, /paging/)
    }
  })

  it("resets the unified editor scroll when the selected hierarchy node changes", () => {
    const popup = read("components/ads-manager/PerformancePopup.tsx")

    assert.match(popup, /const workspaceContentRef = useRef<HTMLDivElement>\(null\)/)
    assert.match(popup, /workspaceContentRef\.current\?\.scrollTo\(\{ top: 0, left: 0 \}\)/)
    assert.match(popup, /\[workspaceDetailKey, workspaceView\]/)
    assert.match(popup, /<div ref=\{workspaceContentRef\} className=/)
  })
})
