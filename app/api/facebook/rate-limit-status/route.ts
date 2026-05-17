import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { clearAllCachedFacebookMetadata, getCacheRetryAfterMs } from "../_cache"
import { getUsageSnapshot } from "@/lib/rate-limit-store"

// GET  — check current rate-limit status from Meta headers
// POST — clear server-side cache so app retries immediately
export async function POST() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    clearAllCachedFacebookMetadata()
    return NextResponse.json({ cleared: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    // ── Lightest possible Meta call to read app-level rate-limit headers ───
    const res = await fetch(
      `https://graph.facebook.com/v25.0/me?fields=id&access_token=${connection.access_token}`
    )

    let appUsage: any = null
    try {
      const raw = res.headers.get("x-app-usage")
      if (raw) appUsage = JSON.parse(raw)
    } catch {}

    const data = await res.json().catch(() => ({}))

    // ── Business/ad-account usage — from last known ad-account API call ───
    // GET /me does NOT return X-Business-Use-Case-Usage.
    // We use the snapshot recorded by getAdAccounts() for accurate data.
    const snapshot = getUsageSnapshot()
    const businessUsage  = snapshot?.businessUsage  ?? null
    const adAccountUsage = snapshot?.adAccountUsage ?? null
    const snapshotAgeMs  = snapshot ? Date.now() - snapshot.recordedAt : null

    // ── App-level usage (0-100%) ──────────────────────────────────────────
    const maxAppPct = appUsage
      ? Math.max(appUsage.call_count || 0, appUsage.total_cputime || 0, appUsage.total_time || 0)
      : 0

    // ── Business / ADS_MANAGEMENT usage ──────────────────────────────────
    let maxBizPct = 0
    let estimatedMinutes: number | null = null
    if (businessUsage) {
      for (const entries of Object.values(businessUsage)) {
        if (!Array.isArray(entries)) continue
        for (const item of entries as any[]) {
          if (item.type !== "ADS_MANAGEMENT") continue
          const pct = Math.max(item.call_count || 0, item.total_cputime || 0, item.total_time || 0)
          if (pct > maxBizPct) maxBizPct = pct
          if ((item.estimated_time_to_regain_access || 0) > 0) {
            estimatedMinutes = Math.max(estimatedMinutes ?? 0, item.estimated_time_to_regain_access)
          }
        }
      }
    }

    const maxPct = Math.max(maxAppPct, maxBizPct)

    // ── Server-side cache state ──────────────────────────────────────────
    const cacheKey = `fb:ad-accounts:${ctx.orgId}`
    const cacheBlockedMs  = getCacheRetryAfterMs(cacheKey)
    const cacheBlockedSec = Math.ceil(cacheBlockedMs / 1000)

    // ── Overall status ────────────────────────────────────────────────────
    const apiRateLimited = data.error?.code === 4 || data.error?.code === 17
      || maxPct >= 100 || (estimatedMinutes !== null && estimatedMinutes > 0)

    let status: "ok" | "warning" | "blocked" = "ok"
    if (apiRateLimited || cacheBlockedMs > 0) {
      status = cacheBlockedMs > 0 && !apiRateLimited ? "warning" : "blocked"
    } else if (maxPct >= 75) {
      status = "warning"
    }

    let tip: string
    if (apiRateLimited) {
      tip = estimatedMinutes
        ? `✗ Meta rate limited — wait ~${estimatedMinutes} min`
        : "✗ Meta rate limited — wait a few minutes"
    } else if (cacheBlockedMs > 0) {
      tip = `⚠ Server cache blocked — clears in ${cacheBlockedSec}s (or click Clear Cache)`
    } else if (maxPct >= 75) {
      tip = `⚠ Usage at ${maxPct}% — minimize API-heavy actions`
    } else {
      tip = "✓ Safe to test the app"
    }

    return NextResponse.json({
      status,
      apiCallSucceeded: res.ok && !data.error,
      apiError: data.error || null,
      appUsage,
      businessUsage,
      adAccountUsage,
      snapshotAgeSeconds: snapshotAgeMs !== null ? Math.round(snapshotAgeMs / 1000) : null,
      maxAppPct,
      maxBizPct,
      maxPct,
      estimatedMinutesUntilOK: estimatedMinutes,
      cacheBlocked: cacheBlockedMs > 0,
      cacheBlockedSeconds: cacheBlockedSec,
      tip,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to check status" }, { status: 500 })
  }
}
