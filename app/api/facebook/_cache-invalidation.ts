export type MetaReadCacheTarget = {
  orgId: string
  adAccountId: string
  objectIds?: readonly string[]
}

function accountIds(adAccountId: string) {
  const id = adAccountId.startsWith("act_") ? adAccountId.slice(4) : adAccountId
  return [id, `act_${id}`]
}

function startsWithAccount(cacheKey: string, prefixes: readonly string[], adAccountId: string) {
  return accountIds(adAccountId).some(id => prefixes.some(prefix => cacheKey.startsWith(`${prefix}${id}:`)))
}

/** True when a Meta response cache entry is made stale by a write in this account. */
export function matchesMetaReadCacheKey(cacheKey: string, target: MetaReadCacheTarget) {
  if (startsWithAccount(cacheKey, ["campaigns:v3:"], target.adAccountId)) return true
  if (startsWithAccount(cacheKey, ["adsets:v5:", "adsets:v6:"], target.adAccountId)) return true
  if (startsWithAccount(cacheKey, ["ads:v8:"], target.adAccountId)) return true

  if (startsWithAccount(cacheKey, [
    "insights:account-summary:",
    "insights:metrics:",
    "insights:report:",
    "insights:top-creatives:",
    "insights:trends:",
    "insights-breakdown:",
  ], target.adAccountId)) return true

  return target.objectIds?.some(id => cacheKey.includes(`insights:report-object:v5:`) && cacheKey.includes(`:${id}:`)) ?? false
}

/** Applies tenant scoping to DB-backed L1 keys; `adset-ads` lacks account scope. */
export function matchesMetaReadMemoryKey(memoryKey: string, target: MetaReadCacheTarget) {
  if (matchesMetaReadCacheKey(memoryKey, target)) return true

  // ponytail: clear this org's ad-set list because its legacy key has no account ID.
  if (memoryKey.startsWith(`adset-ads:${target.orgId}:`)) return true

  for (const prefix of [`db:${target.orgId}:`, `db-fallback:${target.orgId}:`]) {
    if (memoryKey.startsWith(prefix) && matchesMetaReadCacheKey(memoryKey.slice(prefix.length), target)) {
      return true
    }
  }

  return false
}
