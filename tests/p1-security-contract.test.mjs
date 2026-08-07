import assert from "node:assert/strict"
import test from "node:test"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"

async function findFilesMatching(dir, pattern) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true })
  const hits = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!/\.(ts|tsx)$/.test(entry.name)) continue
    const fullPath = path.join(entry.parentPath ?? entry.path, entry.name)
    const content = await readFile(fullPath, "utf8")
    if (pattern.test(content)) hits.push(fullPath)
  }
  return hits
}

test("P1 Custom Auth disabled_at Re-check Contract", async () => {
  const customAuth = await readFile(new URL("../lib/custom-auth.ts", import.meta.url), "utf8")

  // getSessionAccount must check the DB for disabled_at after jwtVerify
  assert.match(customAuth, /getSessionAccount\(\)/)
  assert.match(customAuth, /from\("accounts"\)/)
  assert.match(customAuth, /select\("disabled_at"\)/)
  assert.match(customAuth, /if\s*\(!account\s*\|\|\s*account\.disabled_at\)\s*return\s*null/)
})

test("P1 Ad Single Routes Tenant Scoping Contract", async () => {
  const adRoute = await readFile(new URL("../app/api/ads/[id]/route.ts", import.meta.url), "utf8")

  // Must import getAuthContext, not getAuthUser
  assert.match(adRoute, /import\s*\{\s*getAuthContext\s*\}\s*from\s*["']@\/lib\/auth["']/)
  assert.doesNotMatch(adRoute, /getAuthUser/)

  // Handlers must use getAuthContext and query using ctx.orgId instead of user_id only
  assert.match(adRoute, /const ctx = await getAuthContext\(\)/)
  assert.match(adRoute, /\.eq\("org_id",\s*ctx\.orgId\)/)
  assert.doesNotMatch(adRoute, /\.eq\("user_id",\s*user\.id\)/)

  const mediaRoute = await readFile(new URL("../app/api/ads/[id]/media/route.ts", import.meta.url), "utf8")

  // Media routes must also use getAuthContext and enforce org_id
  assert.match(mediaRoute, /import\s*\{\s*getAuthContext\s*\}\s*from\s*["']@\/lib\/auth["']/)
  assert.doesNotMatch(mediaRoute, /getAuthUser/)
  assert.match(mediaRoute, /const ctx = await getAuthContext\(\)/)
  assert.match(mediaRoute, /\.eq\("org_id",\s*ctx\.orgId\)/)
  assert.doesNotMatch(mediaRoute, /\.eq\("user_id",\s*user\.id\)/)
})

test("P1 Destructive Actions Audit Logging Contract", async () => {
  const connRoute = await readFile(new URL("../app/api/facebook/connection/route.ts", import.meta.url), "utf8")
  // Connection DELETE must recordActivity
  assert.match(connRoute, /await recordActivity\(\{[\s\S]*?objectType:\s*["']facebook_connection["']/)

  const orgRoute = await readFile(new URL("../app/api/orgs/[id]/route.ts", import.meta.url), "utf8")
  // Org PATCH must recordActivity with updated action
  assert.match(orgRoute, /await recordActivity\(\{[\s\S]*?objectType:\s*["']organization["'][\s\S]*?action:\s*["']updated["']/)
  // Org DELETE must recordActivity with deleted action
  assert.match(orgRoute, /await recordActivity\(\{[\s\S]*?objectType:\s*["']organization["'][\s\S]*?action:\s*["']deleted["']/)

  const typesFile = await readFile(new URL("../lib/notifications/types.ts", import.meta.url), "utf8")
  // ObjectType union must contain facebook_connection and organization
  assert.match(typesFile, /\|\s*["']facebook_connection["']/)
  assert.match(typesFile, /\|\s*["']organization["']/)
})
