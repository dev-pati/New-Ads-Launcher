type CacheEntry<T> = {
  value?:      T
  expiresAt:   number
  retryAfter:  number
  inFlight?:   Promise<T>
}

type CacheStore = Map<string, CacheEntry<unknown>>

declare global {
  var __adlauncherFacebookMetadataCache: CacheStore | undefined
}

function getStore(): CacheStore {
  if (!globalThis.__adlauncherFacebookMetadataCache) {
    globalThis.__adlauncherFacebookMetadataCache = new Map()
  }
  return globalThis.__adlauncherFacebookMetadataCache
}

export function clearCachedFacebookMetadata(key: string) {
  getStore().delete(key)
}

export function clearAllCachedFacebookMetadata() {
  getStore().clear()
}

/** Returns ms until retry is allowed, or 0 if not blocked */
export function getCacheRetryAfterMs(key: string): number {
  const entry = getStore().get(key) as CacheEntry<unknown> | undefined
  if (!entry?.retryAfter) return 0
  return Math.max(0, entry.retryAfter - Date.now())
}

export function getCacheKeys(): string[] {
  return [...getStore().keys()]
}

export function peekCachedFacebookMetadata<T>(key: string): T | undefined {
  const entry = getStore().get(key) as CacheEntry<T> | undefined
  if (entry?.value !== undefined && entry.expiresAt > Date.now()) return entry.value
  return undefined
}

// ponytail: stale-while-revalidate support — returns prior value even when expired,
// so callers can paint instantly and refresh in the background. Upgrade path: move
// this store to Redis/DB so it survives cold starts and works across instances.
export function peekStaleCachedFacebookMetadata<T>(key: string): T | undefined {
  const entry = getStore().get(key) as CacheEntry<T> | undefined
  return entry?.value
}

/** True when a fresh value exists (not expired, not in-flight, not in backoff). */
export function isCachedFacebookMetadataFresh(key: string): boolean {
  const entry = getStore().get(key)
  return !!entry && entry.value !== undefined && entry.expiresAt > Date.now()
}

export function setCachedFacebookMetadata<T>(key: string, value: T, ttlMs: number): void {
  getStore().set(key, { value, expiresAt: Date.now() + ttlMs, retryAfter: 0 })
}

const RATE_LIMIT_BACKOFF_MS  = 5 * 60_000  // 5 min after rate-limit error
const GENERIC_ERROR_BACKOFF_MS = 30_000    // 30 s after other errors

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes("too many calls") || msg.includes("rate limit") || msg.includes("Rate limit")
}

export async function getCachedFacebookMetadata<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const store = getStore()
  const now   = Date.now()
  const cached = store.get(key) as CacheEntry<T> | undefined

  // Fresh cache hit
  if (cached?.value !== undefined && cached.expiresAt > now) {
    return cached.value
  }

  // Join an already-running request
  if (cached?.inFlight) {
    return cached.inFlight
  }

  // Still within backoff window — return stale if available, else throw
  if (cached?.retryAfter && cached.retryAfter > now) {
    if (cached.value !== undefined) return cached.value
    throw new Error("Rate limited — please try again in a few minutes")
  }

  // Kick off a new fetch
  const inFlight: Promise<T> = loader()
    .then((value) => {
      store.set(key, { value, expiresAt: Date.now() + ttlMs, retryAfter: 0 })
      return value
    })
    .catch((err: unknown) => {
      const backoff = isRateLimitError(err) ? RATE_LIMIT_BACKOFF_MS : GENERIC_ERROR_BACKOFF_MS
      const stale   = (store.get(key) as CacheEntry<T> | undefined)?.value
      // Preserve stale value; block retries for backoff period
      store.set(key, { value: stale, expiresAt: 0, retryAfter: Date.now() + backoff })
      if (stale !== undefined) return stale   // transparent fallback to stale data
      throw err
    })

  // Mark in-flight while preserving any stale value we already have
  store.set(key, {
    value:      cached?.value,
    expiresAt:  0,
    retryAfter: cached?.retryAfter ?? 0,
    inFlight,
  })

  return inFlight
}
