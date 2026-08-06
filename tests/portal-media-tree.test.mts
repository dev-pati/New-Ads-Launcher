import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildTree, collectKeysUnder } from "../lib/portal-media/tree.ts"

const asset = (objectKey: string) => ({
  id: objectKey,
  object_key: objectKey,
  original_file_name: null,
  mime_type: "video/mp4",
  actual_size_bytes: 1,
  created_at: "2026-08-05T00:00:00Z",
  file_url: null,
  brand_id: null,
  brand_name: "SouthEDC",
  brand_slug: "southedc",
  product_id: null,
  product_name: null,
  product_catalog_pdp_url: null,
  product_catalog_sales_page_url: null,
  product_catalog_landing_url: null,
  product_catalog_checkoutchamp_funnel_url: null,
  language: null,
  brief_type: null,
  voice_variant: null,
  media_type: "video",
  width: null,
  height: null,
  duration_seconds: null,
})

const JULY = "creative-portal/approved/southedc/2026/07/july.mp4"
const AUGUST = "creative-portal/approved/southedc/2026/08/august.mp4"
const IMPORT = "creative-portal/approved/southedc/2026/08/imports/48d7e0e2-597f-4ffe-91d0-72882260dabb/ref.mp4"

describe("Portal Media R2 tree", () => {
  it("preserves brand/year/month and every lower R2 segment", () => {
    const tree = buildTree([asset(JULY), asset(AUGUST), asset(IMPORT)])
    const brand = tree[0]
    const year = brand.folders[0]
    const [july, august] = year.folders

    assert.equal(brand.label, "southedc")
    assert.equal(year.label, "2026")
    assert.deepEqual([july.label, august.label], ["07", "08"])
    assert.equal(august.files[0].objectKey, AUGUST)
    assert.equal(august.folders[0].label, "imports")
    assert.equal(august.folders[0].folders[0].label, "48d7e0e2-597f-4ffe-91d0-72882260dabb")
    assert.deepEqual(collectKeysUnder(tree, august.path).sort(), [AUGUST, IMPORT].sort())
  })
})