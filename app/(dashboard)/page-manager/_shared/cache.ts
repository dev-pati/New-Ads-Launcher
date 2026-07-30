export type CacheEnvelope<T> = {
  ts: number
  value: T
}

export const PAGE_MANAGER_CACHE_TTL_MS = 5 * 60 * 1000
export const PAGE_MANAGER_COMMENT_CACHE_TTL_MS = 2 * 60 * 1000
export const PAGE_MANAGER_AUTOMATION_CACHE_TTL_MS = 10 * 60 * 1000

export function readCachedValue<T>(key: string, ttlMs: number) {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEnvelope<T>
    if (!parsed?.ts || Date.now() - parsed.ts > ttlMs) return null
    return parsed.value
  } catch {
    return null
  }
}

export function writeCachedValue<T>(key: string, value: T) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), value } satisfies CacheEnvelope<T>))
  } catch { }
}
