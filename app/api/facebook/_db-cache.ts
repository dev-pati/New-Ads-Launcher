import { createAdminClient } from "@/lib/supabase/admin"
import { clearCachedFacebookMetadata, getCachedFacebookMetadata } from "./_cache"

type CacheRow<T> = {
  payload: T | null
  expires_at: string
  retry_after: string | null
}

type DbCacheResult<T> = {
  value: T
  source: "db-cache" | "memory-cache" | "meta"
  stale: boolean
  retryAfterMs: number
}

type DbCacheOptions<T> = {
  orgId: string
  cacheKey: string
  ttlMs: number
  loader: () => Promise<T>
  forceRefresh?: boolean
}

const RATE_LIMIT_BACKOFF_MS = 5 * 60_000
const GENERIC_ERROR_BACKOFF_MS = 30_000

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  const name = err instanceof Error ? err.name : ""
  return (
    name === "MetaRateLimitError" ||
    /too many calls|rate limit|request limit|#4|code 4|code=4|613|17/i.test(msg)
  )
}

function isMissingCacheTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /meta_api_cache|does not exist|schema cache/i.test(error.message || "")
  )
}

function retryAfterMs(row: CacheRow<unknown> | null, now = Date.now()) {
  if (!row?.retry_after) return 0
  return Math.max(0, new Date(row.retry_after).getTime() - now)
}

async function readCacheRow<T>(orgId: string, cacheKey: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from("meta_api_cache")
    .select("payload, expires_at, retry_after")
    .eq("org_id", orgId)
    .eq("cache_key", cacheKey)
    .maybeSingle()

  if (error) {
    if (isMissingCacheTable(error)) return { missingTable: true, row: null as CacheRow<T> | null }
    throw error
  }

  return { missingTable: false, row: (data as CacheRow<T> | null) || null }
}

async function writeCacheRow<T>(
  orgId: string,
  cacheKey: string,
  payload: T | null,
  expiresAt: Date,
  retryAfter: Date | null
) {
  const db = createAdminClient()
  const { error } = await db
    .from("meta_api_cache")
    .upsert(
      {
        org_id: orgId,
        cache_key: cacheKey,
        payload,
        expires_at: expiresAt.toISOString(),
        retry_after: retryAfter ? retryAfter.toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,cache_key" }
    )

  if (error && !isMissingCacheTable(error)) throw error
}

async function memoryFallback<T>(
  orgId: string,
  cacheKey: string,
  ttlMs: number,
  loader: () => Promise<T>,
  forceRefresh?: boolean
): Promise<DbCacheResult<T>> {
  const memoryKey = `db-fallback:${orgId}:${cacheKey}`
  if (forceRefresh) clearCachedFacebookMetadata(memoryKey)
  const value = await getCachedFacebookMetadata(memoryKey, ttlMs, loader)
  return { value, source: "memory-cache", stale: false, retryAfterMs: 0 }
}

export async function getDbCachedFacebookMetadata<T>({
  orgId,
  cacheKey,
  ttlMs,
  loader,
  forceRefresh = false,
}: DbCacheOptions<T>): Promise<DbCacheResult<T>> {
  const memoryKey = `db:${orgId}:${cacheKey}`
  if (forceRefresh) clearCachedFacebookMetadata(memoryKey)

  let row: CacheRow<T> | null = null

  try {
    const read = await readCacheRow<T>(orgId, cacheKey)
    if (read.missingTable) return memoryFallback(orgId, cacheKey, ttlMs, loader, forceRefresh)
    row = read.row
  } catch (err) {
    console.warn(`[meta-db-cache] read failed; falling back to memory cache: ${err instanceof Error ? err.message : String(err)}`)
    return memoryFallback(orgId, cacheKey, ttlMs, loader, forceRefresh)
  }

  const now = Date.now()
  const blockedMs = retryAfterMs(row, now)

  if (!forceRefresh && blockedMs > 0) {
    if (row?.payload !== null && row?.payload !== undefined) {
      return { value: row.payload, source: "db-cache", stale: true, retryAfterMs: blockedMs }
    }
    throw new Error("Rate limited - please try again in a few minutes")
  }

  if (!forceRefresh && row?.payload !== null && row?.payload !== undefined && new Date(row.expires_at).getTime() > now) {
    return { value: row.payload, source: "db-cache", stale: false, retryAfterMs: 0 }
  }

  const loaded = await getCachedFacebookMetadata(memoryKey, ttlMs, async () => {
    try {
      const value = await loader()
      await writeCacheRow(orgId, cacheKey, value, new Date(Date.now() + ttlMs), null)
      return value
    } catch (err) {
      const stalePayload = row?.payload !== null && row?.payload !== undefined ? row.payload : null
      const backoffMs = isRateLimitError(err) ? RATE_LIMIT_BACKOFF_MS : GENERIC_ERROR_BACKOFF_MS
      try {
        await writeCacheRow(orgId, cacheKey, stalePayload, new Date(0), new Date(Date.now() + backoffMs))
      } catch (writeErr) {
        console.warn(`[meta-db-cache] backoff write failed: ${writeErr instanceof Error ? writeErr.message : String(writeErr)}`)
      }
      if (stalePayload !== null) return stalePayload
      throw err
    }
  })

  const stale = row?.payload !== null && row?.payload !== undefined && loaded === row.payload
  return { value: loaded, source: stale ? "db-cache" : "meta", stale, retryAfterMs: stale ? retryAfterMs(row) : 0 }
}
