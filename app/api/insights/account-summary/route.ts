import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getDbCachedFacebookMetadata } from "@/app/api/facebook/_db-cache"
import { clampTimeToToday } from "@/lib/snapshot-fallback"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const GRAPH = "https://graph.facebook.com/v25.0"

// GET ?adAccountId=&datePreset=|since=&until=&action_attribution_windows=
// Returns the deduplicated account-level totals Meta reports when you query the
// ad account directly (not a sum of campaign rows). Footer "Per Meta account"
// metrics (frequency = impressions/reach, cost per unique click = spend/unique_clicks)
// need these deduplicated denominators — summing per-row reach double-counts users.
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const sp = request.nextUrl.searchParams
    const adAccountId = sp.get("adAccountId") || ""
    const datePreset = sp.get("datePreset") || "last_7d"
    const attributionWindows = sp.get("action_attribution_windows") || ""
    let since = sp.get("since") || ""
    let until = sp.get("until") || ""
    ;({ since, until } = clampTimeToToday(since, until))

    if (!adAccountId) return NextResponse.json({ error: "adAccountId required" }, { status: 400 })

    const accountPath = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const token = connection.access_token
    const dateKey = since && until ? `range:${since}_${until}` : `preset:${datePreset}`
    const cacheKey = `insights:account-summary:${adAccountId}:${dateKey}:${attributionWindows}`

    const result = await getDbCachedFacebookMetadata({
      orgId: ctx.orgId,
      cacheKey,
      ttlMs: 5 * 60_000,
      loader: async () => {
        const params = new URLSearchParams({
          fields: "spend,impressions,reach,clicks,unique_clicks,inline_link_clicks,unique_inline_link_clicks,frequency,cpm,ctr,actions,action_values,cost_per_action_type",
          access_token: token,
          ...(!attributionWindows ? { use_account_attribution_setting: "true" } : { action_attribution_windows: attributionWindows }),
        })
        if (since && until) params.set("time_range", JSON.stringify({ since, until }))
        else params.set("date_preset", datePreset)

        const res = await fetch(`${GRAPH}/${accountPath}/insights?${params}`)
        const data = await res.json()
        if (data.error) throw new Error(data.error.message)
        return data.data?.[0] || null
      },
    })

    return NextResponse.json({ summary: result.value })
  } catch (err: any) {
    console.error("[insights/account-summary]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
