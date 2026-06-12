import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const read = path => readFileSync(join(root, path), "utf8")

describe("workspace Page selector contract", () => {
  it("Page Manager loads workspace Pages instead of all Meta Pages", () => {
    const source = read("app/(dashboard)/page-manager/page.tsx")
    assert.match(source, /\/api\/workspace\/pages/)
    assert.doesNotMatch(source, /fetch\("\/api\/facebook\/pages/)
    assert.match(source, /No pages added yet/)
    assert.match(source, /Add Pages to Workspace/)
    assert.match(source, /Manage Workspace Pages/)
  })

  it("required API endpoints exist", () => {
    assert.equal(existsSync(join(root, "app/api/meta/pages/available/route.ts")), true)
    assert.equal(existsSync(join(root, "app/api/meta/pages/sync/route.ts")), true)
    assert.equal(existsSync(join(root, "app/api/workspace/pages/route.ts")), true)
    assert.equal(existsSync(join(root, "app/api/workspace/pages/[id]/route.ts")), true)
  })

  it("migration defines workspace page inventory and uniqueness", () => {
    const migration = read("supabase/migrations/20260612_workspace_pages.sql")
    assert.match(migration, /create table if not exists meta_accounts/)
    assert.match(migration, /create table if not exists meta_pages/)
    assert.match(migration, /create table if not exists workspace_pages/)
    assert.match(migration, /unique \(workspace_id, meta_page_id\)/)
  })

  it("frontend-facing workspace Page DTOs do not expose tokens", () => {
    const helper = read("lib/workspace-pages.ts")
    const dtoSection = helper.slice(helper.indexOf("export type WorkspacePageDto"), helper.indexOf("export async function syncMetaPagesForWorkspace"))
    assert.doesNotMatch(dtoSection, /access_token/)
    assert.doesNotMatch(dtoSection, /access_token_encrypted/)
    assert.match(helper, /access_token_encrypted/)
  })
})
