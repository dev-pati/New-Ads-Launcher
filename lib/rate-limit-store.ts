type RateLimitSnapshot = {
  appUsage: any | null
  businessUsage: any | null
  adAccountUsage: any | null
  recordedAt: number
}

declare global {
  var __adlauncherRLSnapshot: RateLimitSnapshot | undefined
}

function parseHeader(headers: Headers, key: string): any | null {
  const raw = headers.get(key)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function recordUsageHeaders(headers: Headers) {
  const appUsage      = parseHeader(headers, "x-app-usage")
  const businessUsage = parseHeader(headers, "x-business-use-case-usage")
  const adAccountUsage = parseHeader(headers, "x-ad-account-usage")
  if (!appUsage && !businessUsage && !adAccountUsage) return
  globalThis.__adlauncherRLSnapshot = { appUsage, businessUsage, adAccountUsage, recordedAt: Date.now() }
}

export function getUsageSnapshot(): RateLimitSnapshot | null {
  return globalThis.__adlauncherRLSnapshot ?? null
}
