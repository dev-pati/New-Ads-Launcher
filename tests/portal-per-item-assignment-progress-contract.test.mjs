// refactor-fragile: the assertions below read source files as text, so they fail on
// renames, moves and reformatting as readily as on real behaviour changes. Before
// adding one, read tests/README.md — assert the contract, not the characters.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const read = path => readFileSync(join(process.cwd(), path), "utf8")

describe("Portal per-item assignment progress contract", () => {
  it("returns the creative identity for every assigned Portal item", () => {
    const assignments = read("app/api/portal-media/assignments/route.ts")

    assert.match(assignments, /assignedItems\.push\(\{ object_key: asset\.object_key, creative_id: creativeId \}\)/)
    assert.match(assignments, /items: assignedItems/)
    assert.match(assignments, /\.update\(\{ status: "error" \}\)/)
    assert.match(assignments, /for \(const item of assignedItems\)/)
  })

  it("reads each creative's Meta progress without using job aggregates", () => {
    const route = read("app/api/creatives/meta-progress/route.ts")

    assert.match(route, /\.eq\("org_id", ctx\.orgId\)/)
    assert.match(route, /getConnectionForAdAccount\(ctx\.orgId, accountId, "read"\)/)
    assert.match(route, /getVideoProcessingStatus/)
    assert.match(route, /processingProgress/)
    assert.match(route, /Creative not found or not accessible/)
    assert.match(route, /getCachedFacebookMetadata/)
    assert.doesNotMatch(route, /media_upload_jobs|media_upload_job_items|done\s*\/\s*total/)
  })

  it("renders Assigning per item in Assets and the shared Portal Vault", () => {
    const assets = read("app/(dashboard)/assets/page.tsx")
    const vault = read("components/shared/load-media-modal.tsx")
    const status = read("components/shared/meta-assignment-status.tsx")

    assert.doesNotMatch(assets, /\/api\/portal-media\/jobs|Syncing to Meta/)
    assert.doesNotMatch(vault, /Syncing to Meta/)
    assert.match(assets, /assignmentProgressById\[assigningCreativeId\]/)
    assert.match(vault, /vaultProgressById\[c\.id\]/)
    assert.match(status, /"Assigning…"/)
    assert.doesNotMatch(status, /\{percent\}%/)
    assert.match(status, /Keep one loading state until ready/)
  })

  it("bounds Meta polling while still rotating through individual items", () => {
    const hook = read("hooks/use-meta-assignment-progress.ts")

    assert.match(hook, /const ITEMS_PER_TICK = 6/)
    assert.match(hook, /const terminalIds = new Set<string>\(\)/)
    assert.match(hook, /activeIds\[\(cursor \+ offset\) % activeIds\.length\]/)
    assert.doesNotMatch(hook, /REQUEST_CHUNK_SIZE/)
  })
})
