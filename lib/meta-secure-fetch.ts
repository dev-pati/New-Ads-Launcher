/**
 * Secure Meta Graph API fetch helpers.
 * Fixes 4 critical security issues:
 *   1. Token moved from URL query param → Authorization header
 *   2. appsecret_proof added (HMAC-SHA256 of token + app_secret)
 *   3. User-Agent header added
 *   4. Token no longer logged in plain text
 */

import { createHmac } from "crypto"

const USER_AGENT = "AdLauncher/1.0 (+https://ads.patigroup.com)"

/** Build secure headers for a Meta API call */
export function buildMetaHeaders(accessToken: string): HeadersInit {
  const appSecret = process.env.FACEBOOK_APP_SECRET ?? ""
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
    "User-Agent": USER_AGENT,
  }
  if (appSecret) {
    headers["appsecret_proof"] = createHmac("sha256", appSecret)
      .update(accessToken)
      .digest("hex")
  }
  return headers
}

/** Remove access_token from URL and return { cleanUrl, token } */
export function extractTokenFromUrl(rawUrl: string): { cleanUrl: string; token: string | null } {
  try {
    const u = new URL(rawUrl)
    const token = u.searchParams.get("access_token")
    u.searchParams.delete("access_token")
    return { cleanUrl: u.toString(), token }
  } catch {
    return { cleanUrl: rawUrl, token: null }
  }
}

/**
 * Secure wrapper around fetch() for Meta Graph API calls.
 * Automatically moves access_token from URL to Authorization header
 * and adds appsecret_proof + User-Agent.
 */
export async function secureMetaFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const { cleanUrl, token } = extractTokenFromUrl(url)
  const secureHeaders = token ? buildMetaHeaders(token) : { "User-Agent": USER_AGENT }
  return fetch(cleanUrl, {
    ...init,
    headers: {
      ...secureHeaders,
      ...(init?.headers ?? {}),
    },
  })
}

/** Delay helper for throttling concurrent Meta API calls */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Sequential mapper with delay between items — prevents API burst.
 * Use instead of Promise.all for Meta API calls.
 */
export async function sequentialMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  delayMs = 150
): Promise<R[]> {
  const results: R[] = []
  for (const item of items) {
    results.push(await fn(item))
    if (delayMs > 0) await delay(delayMs)
  }
  return results
}
