// refactor-fragile: the assertions below read source files as text, so they fail on
// renames, moves and reformatting as readily as on real behaviour changes. Before
// adding one, read tests/README.md — assert the contract, not the characters.
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const read = path => readFileSync(join(root, path), "utf8")

describe("all authorized ad accounts can reach the media-to-launch path", () => {
  it("has no source allowlist or unauthorized priority bypass", () => {
    assert.equal(existsSync(join(root, "lib/priority-ad-accounts.ts")), false)
    assert.doesNotMatch(read("app/api/facebook/_utils.ts"), /PRIORITY_AD_ACCOUNTS|isPriorityAdAccount/)
  })

  it("accepts an org-owned DB account or one visible to the org OAuth token", () => {
    const source = read("app/api/facebook/_utils.ts")
    assert.match(source, /\.eq\("org_id", orgId\)/, "DB membership remains tenant-scoped")
    assert.match(source, /if \(orgAdAccountsError\) throw orgAdAccountsError/, "DB failures must not look like missing accounts")
    assert.match(source, /if \(dbAccount\)/, "saved Via-only accounts remain supported")
    assert.match(source, /id: dbAccount\.fb_ad_account_id!/, "DB account IDs are canonicalized")
    assert.match(source, /if \(!accessToken\) return null/, "no credential means no live-account bypass")
    assert.match(source, /getAdAccounts\(accessToken\)/, "Meta visibility is the fallback authority")
    assert.match(source, /if \(!liveAccount\) return null/, "unknown accounts fail closed")
  })

  it("uses the shared account check before Portal media assignment", () => {
    const source = read("app/api/portal-media/assignments/route.ts")
    assert.match(source, /getFacebookConnection\(orgId\)/)
    assert.match(source, /getOrgAdAccountInfo\(orgId, adAccountId, oauth\?\.access_token\)/)
    assert.match(source, /const account = await resolveAdAccountInOrg\(ctx\.orgId, adAccountId\)/)
    assert.match(source, /adAccountId = account\.id/, "claim and assignment use the canonical Meta ID")
  })

  it("keeps all launch writes on the per-account write resolver", () => {
    for (const route of ["launch", "launch-direct", "launch-table-batch"]) {
      const source = read(`app/api/facebook/${route}/route.ts`)
      assert.match(
        source,
        /getConnectionForAdAccount\(ctx\.orgId, adAccountId, "write"\)/,
        `${route} must resolve Via LAUNCH or OAuth for the selected account`,
      )
      assert.match(
        source,
        /adAccountBelongsToOrg\(ctx\.orgId, adAccountId, (?:connection\.access_token|token)\)/,
        `${route} must accept DB-owned or live Meta-visible accounts and fail closed otherwise`,
      )
    }
  })
})
