import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

test("does not substitute AdLauncher uploader data for Creator", async () => {
  const [route, page] = await Promise.all([
    readFile(new URL("../app/api/tracking/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/(dashboard)/tracking/page.tsx", import.meta.url), "utf8"),
  ])

  assert.match(route, /creatorDataStatus: "awaiting_portal"/)
  assert.doesNotMatch(route, /\.from\("accounts"\)/)
  assert.match(page, /Creator data is awaiting sync from Creative Portal\./)
})
