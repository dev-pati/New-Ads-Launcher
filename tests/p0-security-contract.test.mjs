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

test("P0 Custom Auth Secret Contract", async () => {
  const file = await readFile(new URL("../lib/custom-auth.ts", import.meta.url), "utf8")

  // Custom auth secret must throw at load time if missing or insecure
  assert.match(file, /const customAuthSecret = process\.env\.CUSTOM_AUTH_SECRET/)
  assert.match(file, /throw new Error\("CUSTOM_AUTH_SECRET must be set to a secure string >= 32 characters\."\)/)

  // Ensure service role key and general jwt secrets are NOT fallback session secrets
  assert.doesNotMatch(file, /CUSTOM_AUTH_SECRET\s*\|\|\s*JWT_SECRET/)
  assert.doesNotMatch(file, /CUSTOM_AUTH_SECRET\s*\|\|\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY/)
})

test("P0 Schema Boundary Contract", async () => {
  const portalRegistry = await readFile(new URL("../lib/supabase/portal-registry.ts", import.meta.url), "utf8")

  // The sanctioned portal-registry file must configure the schema bypass
  assert.match(portalRegistry, /return createClient\(url,\s*serviceKey,\s*\{\s*db:\s*\{\s*schema:\s*["']creative_portal["']\s*\}\s*\}\)/)

  // The schema bypass must appear in EXACTLY one file across app/ and lib/
  const appMatches = await findFilesMatching(new URL("../app", import.meta.url), /schema:\s*["']creative_portal["']/)
  const libMatches = await findFilesMatching(new URL("../lib", import.meta.url), /schema:\s*["']creative_portal["']/)
  const allMatches = [...appMatches, ...libMatches]

  assert.equal(allMatches.length, 1, `creative_portal schema bypass must appear in only one file, found: ${JSON.stringify(allMatches)}`)
  assert.ok(
    allMatches[0].replace(/\\/g, "/").endsWith("lib/supabase/portal-registry.ts"),
    `creative_portal schema bypass must live in lib/supabase/portal-registry.ts, found: ${allMatches[0]}`
  )
})

test("P0 Admin Connection Route Auth Guard", async () => {
  const route = await readFile(new URL("../app/api/facebook/connection/route.ts", import.meta.url), "utf8")

  // The connection DELETE route must enforce requireRole check
  assert.match(route, /const forbidden = requireRole\(ctx,\s*ADMIN_ROLES\)/)
  assert.match(route, /if\s*\(forbidden\)\s*return\s*forbidden/)
})

test("P0 Orgs Update/Delete Route Auth Guard", async () => {
  const route = await readFile(new URL("../app/api/orgs/[id]/route.ts", import.meta.url), "utf8")

  // PATCH and DELETE org routes must enforce admin role check
  assert.match(route, /callerMember\.role\s*!==\s*["']admin["']/)
})

test("P0 Media Delete Path Guard Check", async () => {
  const file = await readFile(new URL("../lib/media-delete.ts", import.meta.url), "utf8")

  // Deletion logic must return ok early without a fetch when targeted at portal-owned assets
  assert.match(file, /if\s*\(locator\.key\.startsWith\("creative-portal\/approved\/"\)\)\s*\{\s*\/\/\s*Portal-owned:\s*unlink\s*only\.\s*return\s*\{\s*ok:\s*true\s*\}\s*\}/)
})
