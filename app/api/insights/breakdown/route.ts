import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getCachedFacebookMetadata } from "@/app/api/facebook/_cache"
import { metaFetch } from "@/app/api/facebook/_meta-fetch"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const GRAPH          = "https://graph.facebook.com/v25.0"
const CACHE_TTL      = 5 * 60 * 1000 // 5 minutes
const PURCHASE_TYPES = ["offsite_conversion.fb_pixel_purchase", "purchase"]

function sumAction(actions: any[], types: string[]) {
  return (actions || []).filter(a => types.includes(a.action_type))
    .reduce((s, a) => s + parseFloat(a.value || "0"), 0)
}
function sumActionValue(values: any[], types: string[]) {
  return (values || []).filter(a => types.includes(a.action_type))
    .reduce((s, a) => s + parseFloat(a.value || "0"), 0)
}

const VALID_BREAKDOWNS = ["publisher_platform", "age", "gender", "impression_device"]

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const sp          = request.nextUrl.searchParams
    const adAccountId = sp.get("adAccountId") || ""
    const datePreset  = sp.get("datePreset")  || "last_30d"
    const breakdown   = VALID_BREAKDOWNS.includes(sp.get("breakdown") || "")
      ? sp.get("breakdown")! : "publisher_platform"

    if (!adAccountId) return NextResponse.json({ error: "adAccountId required" }, { status: 400 })

    const accountPath = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const token       = connection.access_token
    const cacheKey    = `insights-breakdown:${adAccountId}:${datePreset}:${breakdown}`

    const rows = await getCachedFacebookMetadata(cacheKey, CACHE_TTL, async () => {
      const params = new URLSearchParams({
        fields:      "spend,impressions,inline_link_clicks,actions,action_values,cpm",
        breakdowns:  breakdown,
        date_preset: datePreset,
        limit:       "50",
        access_token: token,
      })

      const data = await metaFetch(`${GRAPH}/${accountPath}/insights?${params}`, {
        caller: "insights/breakdown",
      })

      return (data.data || []).map((d: any) => {
        const spend        = parseFloat(d.spend || "0")
        const impressions  = parseInt(d.impressions || "0")
        const linkClicks   = parseInt(d.inline_link_clicks || "0")
        const purchases    = sumAction(d.actions, PURCHASE_TYPES)
        const purchaseValue = sumActionValue(d.action_values, PURCHASE_TYPES)
        const cpm          = parseFloat(d.cpm || "0")
        const ctr          = impressions > 0 ? (linkClicks / impressions) * 100 : 0
        const cpc          = linkClicks   > 0 ? spend / linkClicks : 0
        const roas         = spend        > 0 ? purchaseValue / spend : 0
        const label        = d[breakdown] || "Unknown"
        return { label, spend, impressions, linkClicks, purchases, purchaseValue, cpm, ctr, cpc, roas }
      }).sort((a: any, b: any) => b.spend - a.spend)
    })

    return NextResponse.json({ rows, breakdown, datePreset })
  } catch (err: any) {
    console.error("[insights/breakdown]", err)
    const isRateLimit = err?.name === "MetaRateLimitError"
    return NextResponse.json(
      { error: isRateLimit ? "Meta API rate limit reached. Please wait a moment." : err.message },
      { status: isRateLimit ? 429 : 500 }
    )
  }
}
