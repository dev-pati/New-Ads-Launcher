import assert from "node:assert/strict"
import test from "node:test"
import {
  matchesMetaReadCacheKey,
  matchesMetaReadMemoryKey,
} from "../app/api/facebook/_cache-invalidation.ts"

test("matches only account-scoped hierarchy and insight cache keys", () => {
  const target = { orgId: "org-a", adAccountId: "act_123" }

  assert.equal(matchesMetaReadCacheKey("campaigns:v3:act_123:last_30d:limit:all:active:false:after:first", target), true)
  assert.equal(matchesMetaReadCacheKey("ads:v8:123:adset:all:last_30d:limit:all:active:false:after:first", target), true)
  assert.equal(matchesMetaReadCacheKey("insights:report:act_123:ad:last_30d:limit:50:7d_click", target), true)
  assert.equal(matchesMetaReadCacheKey("insights:metrics:999:last_30d", target), false)
  assert.equal(matchesMetaReadCacheKey("facebook:ad-accounts", target), false)
})

test("matches object reports only for changed Meta IDs", () => {
  const target = { orgId: "org-a", adAccountId: "123", objectIds: ["ad-1"] }

  assert.equal(matchesMetaReadCacheKey("insights:report-object:v5:ad:ad-1:last_30d:7d_click", target), true)
  assert.equal(matchesMetaReadCacheKey("insights:report-object:v5:ad:ad-2:last_30d:7d_click", target), false)
})

test("matches DB-backed memory keys only inside the authenticated org", () => {
  const target = { orgId: "org-a", adAccountId: "123" }

  assert.equal(matchesMetaReadMemoryKey("db:org-a:insights:account-summary:123:last_30d:7d_click", target), true)
  assert.equal(matchesMetaReadMemoryKey("db:org-b:insights:account-summary:123:last_30d:7d_click", target), false)
  assert.equal(matchesMetaReadMemoryKey("campaigns:v3:123:last_30d:limit:all:active:false:after:first", target), true)
})

test("clears legacy ad-set lists within the affected org", () => {
  const target = { orgId: "org-a", adAccountId: "123" }

  assert.equal(matchesMetaReadMemoryKey("adset-ads:org-a:adset-1", target), true)
  assert.equal(matchesMetaReadMemoryKey("adset-ads:org-b:adset-1", target), false)
})
