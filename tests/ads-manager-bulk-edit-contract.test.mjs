import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const read = path => readFileSync(join(root, path), "utf8")

describe("Ads Manager bulk edit integration contract", () => {
  const page = read("app/(dashboard)/ads-manager/page.tsx")
  const dialogs = read("components/ads-manager/BulkEditDraftDialogs.tsx")
  const menu = read("components/ads-manager/BulkEditFieldMenu.tsx")
  const publishRoute = read("app/api/ads-manager/workspace-publish/route.ts")

  it("keeps the direct single-row toggle path while staging workspace bulk status edits", () => {
    assert.match(page, /fetch\("\/api\/facebook\/toggle-status"/)
    assert.match(menu, /\{ label: "Turn on", action: "turn_on" \}/)
    assert.match(menu, /\{ label: "Turn off", action: "turn_off" \}/)
    assert.match(page, /selectedIds\.size > 0 && !workspaceAccess\.enabled/)
  })

  it("exposes the P0 edits by level with Budget enabled only for Ad sets", () => {
    assert.match(dialogs, /BulkStatusChangeDialog/)
    assert.match(dialogs, /field: "turn_on" \| "turn_off"/)
    assert.match(dialogs, /initialField === "budget" && level === "adset"/)
    assert.doesNotMatch(menu, /Campaign budget/)
    assert.match(menu, /\{ label: "Budget", action: "budget" \}/)
  })

  it("uses the mockup split: compact status confirmation and full-screen hierarchy editor", () => {
    assert.match(dialogs, /Change item status/)
    assert.match(dialogs, /Save to draft/)
    assert.match(dialogs, /bg-\[#078f67\][\s\S]*?Publish/)
    assert.match(dialogs, /h-\[calc\(100vh-16px\)\]/)
    assert.match(dialogs, /grid-cols-\[360px_250px_minmax\(0,1fr\)\]/)
    assert.match(dialogs, /Edit all selected/)
    assert.match(dialogs, /hierarchy\.rows\.map/)
    assert.match(page, /<BulkStatusChangeDialog/)
    assert.match(page, /hierarchy=\{bulkEditHierarchy\}/)
  })

  it("uses an Edit split button and keeps the complete level-specific option structure", () => {
    assert.match(page, /<BulkEditFieldMenu/)
    assert.match(menu, /campaign: \[/)
    assert.match(menu, /adset: \[/)
    assert.match(menu, /ad: \[/)
    assert.doesNotMatch(menu, /Soon/)
    assert.match(menu, /\{ label: "Name", action: "name" \}/)
    assert.match(menu, /disabled=\{!ready\}/)
    assert.match(menu, /cursor-not-allowed text-muted-foreground opacity-45/)
    assert.match(dialogs, /disabled=\{!selectable\}/)
  })

  it("renders account-level draft controls, row badges and contextual publish selected", () => {
    assert.match(page, /Discard Drafts/)
    assert.match(page, /Review and publish \(\{bulkDraftCount\}\)/)
    assert.match(page, /Publish selected \(\{selectedDraftKeys\.length\}\)/)
    assert.match(page, /Unpublished edits/)
    assert.match(page, /sessionStorage/)
  })

  it("publishes Campaign before Ad set before Ad and retains partial failures", () => {
    assert.match(publishRoute, /const ORDER: Record<Level, number> = \{ campaign: 0, adset: 1, ad: 2 \}/)
    assert.match(page, /removePublishedDrafts\(sourceDrafts, results\)/)
    assert.match(dialogs, /failed items stay available for retry/)
  })

  it("blocks unsafe budget ownership combinations", () => {
    assert.match(page, /Controlled by campaign budget/)
    assert.match(page, /Campaign budget is not a bulk-edit field/)
    assert.match(page, /Ads do not own budgets/)
  })
})
