import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getCachedFacebookMetadata } from "@/app/api/facebook/_cache"
import { MetaRateLimitError } from "@/app/api/facebook/_meta-fetch"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const TTL_MS = 5 * 60 * 1000  // 5-minute cache — insights data is stable

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613])
const MAX_RETRIES = 3
const BACKOFF_BASE_MS = 1000

async function batchFetchWithRetry(
  url: string,
  body: URLSearchParams,
  caller: string
): Promise<any> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const wait = BACKOFF_BASE_MS * Math.pow(2, attempt - 1)
      console.warn(`[${caller}] BACKOFF attempt=${attempt}/${MAX_RETRIES} wait=${wait}ms`)
      await new Promise(r => setTimeout(r, wait))
    }
    try {
      const res = await fetch(url, { method: "POST", body })
      const data = await res.json()
      if (!res.ok) {
        const code: number = data?.error?.code ?? 0
        const msg: string = data?.error?.message ?? "Batch request failed"
        if (RATE_LIMIT_CODES.has(code)) {
          console.error(`[${caller}] RATE LIMIT code=${code} attempt=${attempt}/${MAX_RETRIES} | ${msg}`)
          lastError = new MetaRateLimitError(msg, code)
          if (attempt < MAX_RETRIES) continue
          throw lastError
        }
        throw new Error(msg)
      }
      return data
    } catch (err) {
      if (err instanceof MetaRateLimitError) throw err
      lastError = err as Error
      if (attempt >= MAX_RETRIES) throw lastError
    }
  }
  throw lastError ?? new Error("Batch fetch failed")
}

// POST { adAccountId, adIds: string[], datePreset?: string, statusOnly?: boolean }
// Returns live status + insights for a list of ad IDs via Facebook batch request.
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const { adIds, datePreset = "last_30d", statusOnly = false } = await request.json()
    if (!adIds?.length) return NextResponse.json({ insights: [] })

    const token = connection.access_token
    const fields = statusOnly
      ? "id,name,status,effective_status"
      : `id,name,status,effective_status,insights.date_preset(${datePreset}){spend,impressions,clicks,actions,cpc,cpm,ctr,reach}`

    // Stable cache key: sorted adIds + params (token-independent)
    const sortedIds = [...adIds].sort().join(",")
    const cacheKey = `ads-insights:${ctx.orgId}:${sortedIds}:${datePreset}:${statusOnly}`

    const insights = await getCachedFacebookMetadata(cacheKey, TTL_MS, async () => {
      const batch = (adIds as string[]).map((id: string) => ({
        method: "GET",
        relative_url: `${id}?fields=${fields}`,
      }))

      const form = new URLSearchParams()
      form.append("access_token", token)
      form.append("batch", JSON.stringify(batch))

      console.log(`[ads-insights] batch fetch | caller=ads-insights | ids=${adIds.length}`)
      const batchResults: Array<{ code: number; body: string }> = await batchFetchWithRetry(
        "https://graph.facebook.com/v25.0",
        form,
        "ads-insights"
      )

      return batchResults.map((r, i) => {
        const adId = adIds[i]
        if (r.code !== 200) {
          return { adId, name: "", status: "UNKNOWN", effectiveStatus: "UNKNOWN", spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0, reach: 0, actions: 0, costPerAction: 0 }
        }
        const data = JSON.parse(r.body)
        const ins = data.insights?.data?.[0]
        const spend = parseFloat(ins?.spend || "0")
        const impressions = parseInt(ins?.impressions || "0")
        const clicks = parseInt(ins?.clicks || "0")
        const reach = parseInt(ins?.reach || "0")
        const ctr = parseFloat(ins?.ctr || "0")
        const cpc = parseFloat(ins?.cpc || "0")
        const cpm = parseFloat(ins?.cpm || "0")
        const actions = (ins?.actions as Array<{ action_type: string; value: string }> | undefined)
          ?.filter(a => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase")
          .reduce((sum, a) => sum + parseInt(a.value || "0"), 0) || 0
        const costPerAction = actions > 0 ? spend / actions : 0
        return {
          adId, name: data.name || "", status: data.status || "UNKNOWN",
          effectiveStatus: data.effective_status || "UNKNOWN",
          spend, impressions, clicks, ctr, cpc, cpm, reach, actions, costPerAction,
        }
      })
    })

    return NextResponse.json({ insights })
  } catch (err: any) {
    if (err instanceof MetaRateLimitError) {
      return NextResponse.json({ error: "Rate limited by Meta", rateLimited: true }, { status: 429 })
    }
    console.error("[ads-insights]", err)
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}
