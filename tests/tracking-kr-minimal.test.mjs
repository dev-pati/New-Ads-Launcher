import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

test("My usage is KR-only and fallback logging is one tap", async () => {
  const page = await readFile(new URL("../app/(dashboard)/tracking/page.tsx", import.meta.url), "utf8")

  assert.match(page, /Had to use Meta Ads Manager/)
  assert.match(page, />Launch</)
  assert.match(page, />Control</)
  assert.match(page, /Undo last/)
  assert.doesNotMatch(page, /data\.myBatches\.map/)
  assert.doesNotMatch(page, /scope="mine"/)
})

test("period report keeps analysis and copy but hides markdown and file exports", async () => {
  const page = await readFile(new URL("../app/(dashboard)/tracking/page.tsx", import.meta.url), "utf8")

  assert.match(page, /Copy markdown/)
  assert.doesNotMatch(page, /<pre className=/)
  assert.doesNotMatch(page, /downloadMarkdown/)
  assert.doesNotMatch(page, /printReport/)
})

test("probation endpoint stores only launch or control fallback events", async () => {
  const [route, migration] = await Promise.all([
    readFile(new URL("../app/api/tracking/probation/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260807_kr_fallbacks.sql", import.meta.url), "utf8"),
  ])

  assert.match(route, /\.from\("kr_fallbacks"\)/)
  assert.match(route, /\.from\("activity_log"\)/)
  assert.match(route, /batch\.status !== "success"/)
  assert.match(route, /export async function POST/)
  assert.match(route, /export async function DELETE/)
  assert.match(migration, /kind in \('launch', 'control'\)/)
  assert.match(migration, /user_id = current_account_id\(\)/)
  assert.doesNotMatch(migration, /note|metadata|reason/)
})
