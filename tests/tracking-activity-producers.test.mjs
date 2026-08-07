import assert from "node:assert/strict"
import test from "node:test"
import { readFile, readdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith(".ts") ? [path] : []
  }))
  return nested.flat()
}

test("action producers await activity writes before returning", async () => {
  const files = await sourceFiles(fileURLToPath(new URL("../app/api", import.meta.url)))
  const sources = await Promise.all(files.map(file => readFile(file, "utf8")))

  assert.doesNotMatch(sources.join("\n"), /void (?:emitAndLog|recordActivity)\(/)
})

test("weekly check-in stores mismatch count and keeps fallback evidence", async () => {
  const [page, route, migration] = await Promise.all([
    readFile(new URL("../app/(dashboard)/tracking/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/tracking/painpoint/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260807_weekly_painpoints_data_mismatch.sql", import.meta.url), "utf8"),
  ])

  assert.match(page, /Data mismatch count/)
  assert.match(page, /Launch \+1/)
  assert.match(page, /Save all changes/)
  assert.match(route, /data_mismatch_count/)
  assert.match(migration, /weekly_painpoints_data_mismatch_count_check/)
})
