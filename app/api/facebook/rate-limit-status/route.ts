import { NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

// Make 1 lightweight call to Meta and parse rate-limit headers to show current quota usage
// X-App-Usage: { call_count, total_cputime, total_time } as 0-100% of app-level limit
// X-Business-Use-Case-Usage: per business / ad account, includes estimated_time_to_regain_access
export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (process.env.MOCK_META_API === "true") {
      return NextResponse.json({
        status: "ok",
        mock: true,
        tip: "✓ Mock mode active — no Meta API calls being made",
        appUsage: { call_count: 0, total_cputime: 0, total_time: 0 },
        maxAppPct: 0,
      })
    }

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    // Lightest call possible: GET /me?fields=id (1 simple field)
    const res = await fetch(`https://graph.facebook.com/v25.0/me?fields=id&access_token=${connection.access_token}`)

    const appUsageRaw = res.headers.get("x-app-usage")
    const businessUsageRaw = res.headers.get("x-business-use-case-usage")
    const adAccountUsageRaw = res.headers.get("x-ad-account-usage")

    let appUsage: any = null
    let businessUsage: any = null
    let adAccountUsage: any = null
    try { if (appUsageRaw) appUsage = JSON.parse(appUsageRaw) } catch {}
    try { if (businessUsageRaw) businessUsage = JSON.parse(businessUsageRaw) } catch {}
    try { if (adAccountUsageRaw) adAccountUsage = JSON.parse(adAccountUsageRaw) } catch {}

    const data = await res.json().catch(() => ({}))

    // Compute "can call" status
    const maxAppPct = appUsage
      ? Math.max(appUsage.call_count || 0, appUsage.total_cputime || 0, appUsage.total_time || 0)
      : 0

    let status: "ok" | "warning" | "blocked" = "ok"
    if (maxAppPct >= 100 || data.error?.code === 4) status = "blocked"
    else if (maxAppPct >= 75) status = "warning"

    // Estimated wait from any source
    let estimatedMinutes: number | null = null
    if (businessUsage) {
      for (const k of Object.keys(businessUsage)) {
        const items = businessUsage[k]
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item.estimated_time_to_regain_access > 0) {
              estimatedMinutes = Math.max(estimatedMinutes || 0, item.estimated_time_to_regain_access)
            }
          }
        }
      }
    }

    return NextResponse.json({
      status,
      apiCallSucceeded: res.ok && !data.error,
      apiError: data.error || null,
      appUsage,         // { call_count, total_cputime, total_time } each 0-100
      businessUsage,    // per business
      adAccountUsage,
      maxAppPct,
      estimatedMinutesUntilOK: estimatedMinutes,
      tip: status === "ok"
        ? "✓ Safe to test the app"
        : status === "warning"
          ? "⚠ Quota above 75% — minimize API-heavy actions"
          : "✗ Rate limited — wait before testing",
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to check status" }, { status: 500 })
  }
}
