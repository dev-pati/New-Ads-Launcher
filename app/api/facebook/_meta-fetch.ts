/**
 * Shared Meta Graph API fetcher with:
 * - Secure headers: Authorization Bearer, appsecret_proof, User-Agent
 * - Token moved from URL query param to Authorization header
 * - Structured logging (endpoint, params, caller, cache hit/miss, timestamp)
 * - Rate-limit detection (error code 4, 17, 613)
 * - Exponential backoff on rate-limit: 2s → 4s → 8s (max 3 retries)
 * - Hard-stop after exhausting retries — no infinite loops
 */
import { extractTokenFromUrl, buildMetaHeaders } from "@/lib/meta-secure-fetch"

export interface MetaFetchOptions {
  caller?: string
  cacheHit?: boolean
}

export class MetaRateLimitError extends Error {
  code: number
  constructor(message: string, code: number) {
    super(message)
    this.name = "MetaRateLimitError"
    this.code = code
  }
}

export class MetaApiError extends Error {
  code: number
  constructor(message: string, code: number) {
    super(message)
    this.name = "MetaApiError"
    this.code = code
  }
}

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613])
const MAX_RETRIES = 3
const BACKOFF_BASE_MS = 2000 // 2s → 4s → 8s (was 1s → 2s → 4s)

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export async function metaFetch(
  url: string,
  options: MetaFetchOptions = {}
): Promise<any> {
  const { caller = "unknown", cacheHit = false } = options

  // Strip access_token from URL for safe logging
  const logUrl = url.replace(/access_token=[^&]+/, "access_token=***")
  const endpoint = logUrl.split("?")[0].replace("https://graph.facebook.com/v25.0/", "")

  if (cacheHit) {
    console.log(`[meta-api] CACHE HIT  | ${new Date().toISOString()} | caller=${caller} | ${endpoint}`)
    return
  }

  console.log(`[meta-api] FETCH      | ${new Date().toISOString()} | caller=${caller} | ${endpoint}`)

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = BACKOFF_BASE_MS * Math.pow(2, attempt - 1)
      console.warn(`[meta-api] BACKOFF    | attempt=${attempt}/${MAX_RETRIES} | wait=${backoff}ms | caller=${caller} | ${endpoint}`)
      await sleep(backoff)
    }

    try {
      // Move token from URL to Authorization header + add appsecret_proof + User-Agent
      const { cleanUrl, token } = extractTokenFromUrl(url)
      const headers = token ? buildMetaHeaders(token) : {}
      const res = await fetch(cleanUrl, { headers })
      const data = await res.json()

      if (data?.error) {
        const code: number = data.error.code ?? 0
        const msg: string = data.error.message ?? "Meta API error"

        if (RATE_LIMIT_CODES.has(code)) {
          console.error(`[meta-api] RATE LIMIT | code=${code} | attempt=${attempt}/${MAX_RETRIES} | caller=${caller} | ${endpoint} | ${msg}`)
          lastError = new MetaRateLimitError(msg, code)

          if (attempt < MAX_RETRIES) continue
          // Exhausted retries
          throw lastError
        }

        // Non-rate-limit Meta error — throw immediately, no retry
        console.error(`[meta-api] ERROR      | code=${code} | caller=${caller} | ${endpoint} | ${msg}`)
        throw new MetaApiError(msg, code)
      }

      if (attempt > 0) {
        console.log(`[meta-api] RECOVERED  | attempt=${attempt} | caller=${caller} | ${endpoint}`)
      }

      return data
    } catch (err) {
      if (err instanceof MetaRateLimitError || err instanceof MetaApiError) throw err
      // Network error — retry
      lastError = err as Error
      console.error(`[meta-api] NET ERROR  | attempt=${attempt}/${MAX_RETRIES} | caller=${caller} | ${endpoint} | ${(err as Error).message}`)
      if (attempt >= MAX_RETRIES) throw lastError
    }
  }

  throw lastError ?? new Error("Meta fetch failed")
}
