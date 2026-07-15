/**
 * Guardrail: flag app/api routes that use createAdminClient without an obvious
 * org_id filter / getAuthContext. Whitelist cron, auth, health, webhooks.
 *
 *   node scripts/check-admin-org-scope.mjs
 * Exit 1 if high-risk routes found.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = "app/api"
const WHITELIST = [
  /^auth\//,
  /^cron\//,
  /^health\//,
  /^mcp\/oauth\//,
  /messenger\/webhook/,
  /facebook\/video-upload\//,
  // Token-gated email approval links: authorization = ownership of approval.id
  /automations\/executions\/\[id\]\/(approve|reject)\//,
  // Cross-org / user-scoped (no single org_id applies)
  /^orgs\//,
  /^user-settings\//,
  /^mcp\/route\b/,
]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (name === "route.ts") out.push(p)
  }
  return out
}

const routes = walk(ROOT)
const risky = []

for (const file of routes) {
  const rel = relative(ROOT, file).replace(/\\/g, "/")
  if (WHITELIST.some((re) => re.test(rel))) continue
  const src = readFileSync(file, "utf8")
  if (!src.includes("createAdminClient")) continue
  const hasAuth = /getAuthContext|getAuthUser/.test(src)
  const hasOrgFilter = /\.eq\(\s*["']org_id["']|\borgId\b|ctx\.orgId/.test(src)
  if (!hasAuth || !hasOrgFilter) {
    risky.push({
      file: rel,
      hasAuth,
      hasOrgFilter,
    })
  }
}

if (risky.length === 0) {
  console.log("OK: no high-risk createAdminClient routes found")
  process.exit(0)
}

console.log(`Found ${risky.length} high-risk route(s):\n`)
for (const r of risky) {
  console.log(`- ${r.file}  auth=${r.hasAuth} org_filter=${r.hasOrgFilter}`)
}
process.exit(1)
