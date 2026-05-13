import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getCachedFacebookMetadata, clearCachedFacebookMetadata } from "../_cache"
import { metaFetch } from "../_meta-fetch"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const GRAPH = "https://graph.facebook.com/v25.0"
const CACHE_TTL = 5 * 60 * 1000

export interface TopPerformingItem {
  rank: number
  adId: string
  adName: string
  headline: string
  primaryText: string
  spend: number
  copyCount: number
}

async function fetchTopPerforming(
  adAccountId: string,
  token: string,
  datePreset: string
): Promise<TopPerformingItem[]> {
  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`

  // Step 1: Fetch ad-level spend only (lightweight — no creative fields)
  // Insights endpoint naturally excludes zero-spend ads
  const spendMap = new Map<string, { adName: string; spend: number }>()

  const insParams = new URLSearchParams({
    level: "ad",
    fields: "ad_id,ad_name,spend",
    date_preset: datePreset,
    limit: "200",
    access_token: token,
  })

  let insUrl: string | null = `${GRAPH}/${accountId}/insights?${insParams}`
  let pageCount = 0
  while (insUrl && pageCount < 5) {
    const data = await metaFetch(insUrl, { caller: "top-performing/insights" })
    for (const row of data.data || []) {
      const spend = parseFloat(row.spend || "0")
      if (spend <= 0) continue
      const prev = spendMap.get(row.ad_id)
      if (prev) {
        prev.spend += spend
      } else {
        spendMap.set(row.ad_id, { adName: row.ad_name || "", spend })
      }
    }
    insUrl = data.paging?.next || null
    pageCount++
  }

  if (spendMap.size === 0) return []

  // Sort by spend, take top 50 to fetch creative for
  const sorted = Array.from(spendMap.entries())
    .sort((a, b) => b[1].spend - a[1].spend)
    .slice(0, 50)

  // Step 2: Batch-fetch creative for top 50 ads using ?ids= endpoint (single request)
  const ids = sorted.map(([id]) => id).join(",")
  const creativeFields = "creative{title,body,object_story_spec{link_data{message,name},video_data{message,title}}}"
  const batchParams = new URLSearchParams({
    ids,
    fields: creativeFields,
    access_token: token,
  })

  const creativeData = await metaFetch(`${GRAPH}/?${batchParams}`, { caller: "top-performing/creative" })

  // Group by headline + primaryText
  type Group = {
    headline: string
    primaryText: string
    totalSpend: number
    topAdId: string
    topAdName: string
    topAdSpend: number
    copyCount: number
  }
  const groups = new Map<string, Group>()

  for (const [adId, { adName, spend }] of sorted) {
    const adData = creativeData?.[adId] as any
    const c = adData?.creative
    if (!c) continue

    const ls = c?.object_story_spec?.link_data
    const vs = c?.object_story_spec?.video_data
    const headline    = c?.title || ls?.name  || vs?.title   || ""
    const primaryText = c?.body  || ls?.message || vs?.message || ""
    if (!headline && !primaryText) continue

    const key = `${headline}|||${primaryText}`
    const existing = groups.get(key)
    if (existing) {
      existing.totalSpend += spend
      existing.copyCount++
      if (spend > existing.topAdSpend) {
        existing.topAdId   = adId
        existing.topAdName = adName
        existing.topAdSpend = spend
      }
    } else {
      groups.set(key, { headline, primaryText, totalSpend: spend, topAdId: adId, topAdName: adName, topAdSpend: spend, copyCount: 1 })
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 20)
    .map((g, i) => ({
      rank: i + 1,
      adId:        g.topAdId,
      adName:      g.topAdName,
      headline:    g.headline,
      primaryText: g.primaryText,
      spend:       g.totalSpend,
      copyCount:   g.copyCount,
    }))
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const adAccountId  = searchParams.get("adAccountId")
    const datePreset   = searchParams.get("datePreset") || "last_30d"
    const forceRefresh = searchParams.get("refresh") === "1"

    if (!adAccountId) return NextResponse.json({ error: "adAccountId is required" }, { status: 400 })

    const token    = connection.access_token
    const cacheKey = `top-performing:${adAccountId}:${datePreset}`

    if (forceRefresh) clearCachedFacebookMetadata(cacheKey)

    const items = (await getCachedFacebookMetadata(
      cacheKey,
      CACHE_TTL,
      () => fetchTopPerforming(adAccountId, token, datePreset)
    )) as TopPerformingItem[]

    return NextResponse.json({ items, count: items.length })
  } catch (err: any) {
    console.error("[top-performing]", err)
    const isRateLimit = err?.name === "MetaRateLimitError"
    return NextResponse.json(
      { error: isRateLimit ? "Meta API rate limit reached. Please wait a moment." : (err.message || "Failed") },
      { status: isRateLimit ? 429 : 500 }
    )
  }
}
