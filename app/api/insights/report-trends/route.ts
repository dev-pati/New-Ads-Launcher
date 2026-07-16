import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getDbCachedFacebookMetadata } from "../../facebook/_db-cache"
import { datePresetToRange, clampTimeToToday } from "@/lib/snapshot-fallback"
import { computeInsightMetrics } from "@/lib/insights-metrics"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const GRAPH = "https://graph.facebook.com/v25.0"

type Level = "ad" | "adset" | "campaign" | "account"

// Each metric key maps to a function extracting the computed value from a raw daily insights row
const METRIC_EXTRACTOR: Record<string, (m: any) => number> = {
  spend: m => m.spend,
  purchases: m => m.purchases,
  purchaseValue: m => m.purchaseValue,
  costPerPurchase: m => m.costPerPurchase,
  roas: m => m.roas,
  impressions: m => m.impressions,
  reach: m => m.reach,
  linkClicks: m => m.linkClicks,
  ctr: m => m.ctr,
  ctrAll: m => m.ctrAll,
  cpm: m => m.cpm,
  frequency: m => m.frequency,
  addToCart: m => m.addToCart,
  initiateCheckout: m => m.initiateCheckout,
  contentViews: m => m.contentViews,
  hookRate: m => m.thumbstopRate,
  holdRate: m => m.holdRate,
  avgWatchTime: m => m.avgWatchTime,
  costPerResult: m => m.costPerResult,
  results: m => m.results,
}

// Higher-level trend metrics aggregate by summing, not averaging, so they need raw accumulation
const SUM_FIELDS: Record<string, string[]> = {
  spend: ["spend"],
  purchases: ["offsite_conversion.fb_pixel_purchase", "purchase"],
  purchaseValue: [],
  impressions: ["impressions"],
  reach: ["reach"],
  linkClicks: ["inline_link_clicks"],
  clicks: ["clicks"],
  addToCart: ["add_to_cart", "offsite_conversion.fb_pixel_add_to_cart"],
  initiateCheckout: ["offsite_conversion.fb_pixel_initiate_checkout", "initiate_checkout"],
  contentViews: ["omni_view_content", "offsite_conversion.fb_pixel_view_content"],
  results: [],
}

const INSIGHT_FIELDS = [
  "spend", "impressions", "reach", "clicks", "inline_link_clicks",
  "actions", "action_values", "purchase_roas", "date_start",
].join(",")

function aggregateByGranularity(
  daily: any[],
  granularity: "day" | "week" | "month",
  metric: string
): { date: string; value: number; label: string }[] {
  const bucket = (d: string) => {
    const dt = new Date(d + "T00:00:00Z")
    if (granularity === "day") return { key: d, label: `${dt.getUTCDate()} ${dt.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}` }
    if (granularity === "week") {
      const day = dt.getUTCDay()
      const monday = new Date(dt)
      monday.setUTCDate(dt.getUTCDate() - ((day + 6) % 7))
      const key = monday.toISOString().split("T")[0]
      return { key, label: `W${getISOWeek(monday)}` }
    }
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`
    return { key, label: dt.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }) }
  }

  const extractor = METRIC_EXTRACTOR[metric] || (m => m[metric] ?? 0)

  // For sum-based metrics, accumulate raw then compute ratio at bucket level
  const buckets: Record<string, { acc: any; label: string }> = {}
  for (const r of daily) {
    const { key, label } = bucket(r.date_start)
    if (!buckets[key]) buckets[key] = { acc: blankAcc(), label }
    const m = computeInsightMetrics(r)
    accumulate(buckets[key].acc, r, m)
  }

  return Object.keys(buckets).sort().map(key => {
    const b = buckets[key]
    const merged = mergeAccToRow(b.acc)
    return { date: key, value: extractor(computeInsightMetrics(merged)), label: b.label }
  })
}

function blankAcc() {
  return {
    spend: 0, impressions: 0, reach: 0, clicks: 0, inline_link_clicks: 0, purchaseValue: 0,
    actions: {} as Record<string, number>,
    action_values: {} as Record<string, number>,
    purchase_roas: 0,
    dates: 0,
  }
}

function accumulate(acc: ReturnType<typeof blankAcc>, r: any, m: any) {
  acc.spend += parseFloat(r.spend || "0");
  const pVal = parseFloat(r.action_values?.find((a: any) => ["offsite_conversion.fb_pixel_purchase", "purchase", "omni_purchase"].includes(a.action_type))?.value || "0");
  acc.purchaseValue += pVal;
  acc.impressions += parseInt(r.impressions || "0")
  acc.reach += parseInt(r.reach || "0")
  acc.clicks += parseInt(r.clicks || "0")
  acc.inline_link_clicks += parseInt(r.inline_link_clicks || "0")
  acc.purchase_roas += m.roas
  acc.dates += 1
  for (const a of r.actions || []) {
    acc.actions[a.action_type] = (acc.actions[a.action_type] || 0) + parseInt(a.value || "0")
  }
  for (const a of r.action_values || []) {
    acc.action_values[a.action_type] = (acc.action_values[a.action_type] || 0) + parseFloat(a.value || "0")
  }
}

function mergeAccToRow(acc: ReturnType<typeof blankAcc>): any {
  return {
    spend: String(acc.spend),
    impressions: String(acc.impressions),
    reach: String(acc.reach),
    clicks: String(acc.clicks),
    inline_link_clicks: String(acc.inline_link_clicks),
    actions: Object.entries(acc.actions).map(([action_type, value]) => ({ action_type, value: String(value) })),
    action_values: Object.entries(acc.action_values).map(([action_type, value]) => ({ action_type, value: String(value) })),
    purchase_roas: [{ value: String(acc.spend > 0 ? (acc.purchaseValue || 0) / acc.spend : 0) }],
    date_start: "",
  }
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const sp = request.nextUrl.searchParams
    const adAccountId = sp.get("adAccountId") || ""
    const level = (["ad", "adset", "campaign", "account"].includes(sp.get("level") || "") ? sp.get("level") : "account") as Level
    const id = sp.get("id") || ""
    const metric = sp.get("metric") || "spend"
    const granularity = (["day", "week", "month"].includes(sp.get("granularity") || "") ? sp.get("granularity") : "day") as "day" | "week" | "month"
    const datePreset = sp.get("datePreset") || "last_30d"
    const attributionWindows = sp.get("action_attribution_windows") || ""
    let since = sp.get("since") || ""
    let until = sp.get("until") || ""
    ;({ since, until } = clampTimeToToday(since, until))

    if (!adAccountId) return NextResponse.json({ error: "adAccountId required" }, { status: 400 })

    const token = connection.access_token
    const accountPath = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`

    // Object to query: selected id, else account
    const basePath = id ? id : accountPath
    const dateKey = since && until ? `range:${since}_${until}` : `preset:${datePreset}`
    const cacheKey = `insights:trends:${adAccountId}:${id || "account"}:${dateKey}:${granularity}:${metric}:${attributionWindows}`

    const result = await getDbCachedFacebookMetadata({
      orgId: ctx.orgId,
      cacheKey,
      ttlMs: 10 * 60_000,
      loader: async () => {
        const params = new URLSearchParams({
          fields: INSIGHT_FIELDS,
          time_increment: "1",
          limit: "100",
          access_token: token,
          ...(!attributionWindows ? { use_account_attribution_setting: "true" } : { action_attribution_windows: attributionWindows }),
        })
        if (since && until) params.set("time_range", JSON.stringify({ since, until }))
        else params.set("date_preset", datePreset)

        // Paginate
        const daily: any[] = []
        let nextUrl: string | null = `${GRAPH}/${basePath}/insights?${params}`
        while (nextUrl) {
          const currentUrl: string = nextUrl
          const fetchRes: Response = await fetch(currentUrl)
          const fetchedData: any = await fetchRes.json()
          if (fetchedData.error) throw new Error(fetchedData.error.message)
          daily.push(...(fetchedData.data || []))
          nextUrl = fetchedData.paging?.next || null
        }

        return aggregateByGranularity(daily, granularity, metric)
      },
    })

    return NextResponse.json({
      series: result.value,
      metric, granularity, level, id,
      cached: result.source !== "meta",
      stale: result.stale,
      dateRange: datePresetToRange(datePreset, since, until),
    })
  } catch (err: any) {
    console.error("[insights/report-trends]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Reference export so SUM_FIELDS is not flagged unused — it documents which metrics are sum-based.
export const _SUM_FIELDS_DOC = SUM_FIELDS
