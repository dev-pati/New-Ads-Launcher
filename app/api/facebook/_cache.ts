type CacheEntry<T> = {
  expiresAt: number
  value?: T
  inFlight?: Promise<T>
}

type FacebookMetadataCacheStore = Map<string, CacheEntry<unknown>>

declare global {
  var __adlauncherFacebookMetadataCache: FacebookMetadataCacheStore | undefined
}

function getStore() {
  if (!globalThis.__adlauncherFacebookMetadataCache) {
    globalThis.__adlauncherFacebookMetadataCache = new Map()
  }
  return globalThis.__adlauncherFacebookMetadataCache
}

export async function getCachedFacebookMetadata<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const store = getStore()
  const now = Date.now()
  const cached = store.get(key) as CacheEntry<T> | undefined

  if (cached?.value !== undefined && cached.expiresAt > now) {
    return cached.value
  }

  if (cached?.inFlight) {
    return cached.inFlight
  }

  const inFlight = loader()
    .then((value) => {
      store.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      })
      return value
    })
    .catch((error) => {
      store.delete(key)
      throw error
    })

  store.set(key, {
    expiresAt: now + ttlMs,
    inFlight,
  })

  return inFlight
}
