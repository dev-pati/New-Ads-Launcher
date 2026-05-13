import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getCachedFacebookMetadata, clearCachedFacebookMetadata } from "../_cache"

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
  const fields = [
    "id",
    "name",
    "creative{id,name,title,body,object_story_spec{link_data{message,name},video_data{message,title}}}",
    `insights.date_preset(${datePreset}){spend,impressions,clicks}`,
  ].join(",")

  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
  const statusFilter = encodeURIComponent(
    JSON.stringify(["ACTIVE", "PAUSED", "ARCHIVED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"])
  )
  const url = `${GRAPH}/${accountId}/ads?fields=${encodeURIComponent(fields)}&effective_status=${statusFilter}&limit=200&access_token=${token}`

  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || "Failed to fetch ads from Meta")
  }
  const data = await res.json()
  const ads: any[] = data.data || []

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

  for (const ad of ads) {
    const insight = ad.insights?.data?.[0]
    const spend = parseFloat(insight?.spend || "0")
    if (spend <= 0) continue

    const c = ad.creative
    const ls = c?.object_story_spec?.link_data
    const vs = c?.object_story_spec?.video_data
    const headline = c?.title || ls?.name || vs?.title || ""
    const primaryText = c?.body || ls?.message || vs?.message || ""
    if (!headline && !primaryText) continue

    const key = `${headline}|||${primaryText}`
    const existing = groups.get(key)
    if (existing) {
      existing.totalSpend += spend
      existing.copyCount++
      if (spend > existing.topAdSpend) {
        existing.topAdId = ad.id
        existing.topAdName = ad.name
        existing.topAdSpend = spend
      }
    } else {
      groups.set(key, {
        headline,
        primaryText,
        totalSpend: spend,
        topAdId: ad.id,
        topAdName: ad.name,
        topAdSpend: spend,
        copyCount: 1,
      })
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 20)
    .map((g, i) => ({
      rank: i + 1,
      adId: g.topAdId,
      adName: g.topAdName,
      headline: g.headline,
      primaryText: g.primaryText,
      spend: g.totalSpend,
      copyCount: g.copyCount,
    }))
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const adAccountId = searchParams.get("adAccountId")
    const datePreset = searchParams.get("datePreset") || "last_30d"
    const forceRefresh = searchParams.get("refresh") === "1"

    if (!adAccountId) return NextResponse.json({ error: "adAccountId is required" }, { status: 400 })

    const token = connection.access_token
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
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}
