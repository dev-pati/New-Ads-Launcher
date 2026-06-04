import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

const META_AD_LIBRARY_URL = "https://graph.facebook.com/v25.0/ads_archive"

const META_FIELDS = [
  "id", "page_name", "page_id",
  "ad_creative_bodies", "ad_creative_link_titles",
  "ad_snapshot_url", "ad_delivery_start_time", "ad_delivery_stop_time",
  "publisher_platforms", "languages", "eu_total_reach", "impressions", "spend",
].join(",")

type CacheValue = { data: unknown; ts: number }
const serverCache = new Map<string, CacheValue>()
const SERVER_CACHE_TTL = 5 * 60 * 1000

function cacheGet<T>(key: string): T | null {
  const cached = serverCache.get(key)
  if (cached && Date.now() - cached.ts < SERVER_CACHE_TTL) return cached.data as T
  return null
}
function cacheSet(key: string, data: unknown) {
  serverCache.set(key, { data, ts: Date.now() })
}

function safeStr(v: unknown): string {
  if (!v) return ""
  if (typeof v === "string") return v
  if (Array.isArray(v)) return typeof v[0] === "string" ? v[0] : ""
  return ""
}
function rangeUpper(v: unknown): number | null {
  if (!v) return null
  if (typeof v === "number") return v
  const obj = v as Record<string, unknown>
  return parseInt(String(obj.upper_bound || obj.max || "0")) || null
}

function normalizeMetaAd(raw: Record<string, unknown>) {
  const start = safeStr(raw.ad_delivery_start_time)
  const stop  = safeStr(raw.ad_delivery_stop_time)
  const runningDays = start
    ? Math.max(0, Math.floor((new Date(stop || Date.now()).getTime() - new Date(start).getTime()) / 86400000))
    : null
  return {
    id:               String(raw.id),
    page_id:          safeStr(raw.page_id) || null,
    page_name:        safeStr(raw.page_name) || "Unknown",
    primary_text:     safeStr(raw.ad_creative_bodies) || null,
    headline:         safeStr(raw.ad_creative_link_titles) || null,
    ad_snapshot_url:  safeStr(raw.ad_snapshot_url) || null,
    media_url:        null,
    media_type:       "image",
    publisher_platforms: Array.isArray(raw.publisher_platforms) ? raw.publisher_platforms : [],
    languages:        Array.isArray(raw.languages) ? raw.languages : [],
    status:           stop ? "inactive" : "active",
    first_seen_at:    start || null,
    last_seen_at:     stop  || null,
    running_days:     runningDays,
    views_upper:      rangeUpper(raw.eu_total_reach) || rangeUpper(raw.impressions),
    spend_upper:      rangeUpper(raw.spend),
    brand_avatar:     null,
    cta:              null,
    display_format:   null,
    categories:       [] as string[],
  }
}

// ── Read from DB index ────────────────────────────────────────────────────────
async function queryFromDB(params: {
  q: string
  status: string
  mediaType: string
  platform: string
  country: string
  sortBy: string
  limit: number
  offset: number
}) {
  const db = createAdminClient()
  let query = db
    .from("inspo_ads_index")
    .select("id,page_id,page_name,brand_avatar,primary_text,headline,cta,ad_snapshot_url,media_url,media_type,display_format,publisher_platforms,languages,status,first_seen_at,running_days,views_upper,spend_upper,categories")

  if (params.q) {
    query = query.or(
      `page_name.ilike.%${params.q}%,primary_text.ilike.%${params.q}%,headline.ilike.%${params.q}%`
    )
  }
  if (params.status !== "ALL") {
    query = query.eq("status", params.status.toLowerCase())
  }
  if (params.mediaType && params.mediaType !== "ALL") {
    query = query.eq("media_type", params.mediaType.toLowerCase())
  }
  if (params.platform && params.platform !== "ALL") {
    query = query.contains("publisher_platforms", [params.platform.toLowerCase()])
  }
  if (params.country) {
    query = query.eq("country", params.country.toUpperCase())
  }

  if (params.sortBy === "views") {
    query = query.order("views_upper", { ascending: false, nullsFirst: false })
  } else if (params.sortBy === "newest") {
    query = query.order("first_seen_at", { ascending: false, nullsFirst: false })
  } else {
    query = query.order("indexed_at", { ascending: false })
  }

  query = query.range(params.offset, params.offset + params.limit - 1)

  const { data, error, count } = await query
  if (error) throw error
  return { data: data ?? [], count }
}

// ── Fallback: Meta Ad Library ─────────────────────────────────────────────────
async function queryMetaAdLibrary(accessToken: string, q: string, country: string, status: string, limit: number) {
  const cacheKey = `meta|${q.toLowerCase()}|${country}|${status}|${limit}`
  const cached = cacheGet<Record<string, unknown>>(cacheKey)
  if (cached) return cached

  const params = new URLSearchParams({
    access_token: accessToken,
    search_terms: q || "shop",
    ad_reached_countries: JSON.stringify([country]),
    ad_active_status: status,
    ad_type: "ALL",
    fields: META_FIELDS,
    limit: String(limit),
  })

  const res  = await fetch(`${META_AD_LIBRARY_URL}?${params}`, { next: { revalidate: 0 } })
  const data = await res.json() as Record<string, unknown>
  if (!data.error) cacheSet(cacheKey, data)
  return data
}

async function getAccessToken(orgId: string) {
  const dedicated = process.env.FACEBOOK_AD_LIBRARY_TOKEN
  if (dedicated) return dedicated

  const conn = await getFacebookConnection(orgId)
  if (conn?.access_token) return conn.access_token

  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (appId && appSecret) return `${appId}|${appSecret}`
  return null
}

// ── GET handler ───────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp        = request.nextUrl.searchParams
    const q         = sp.get("q")?.trim() || ""
    const country   = sp.get("country") || "US"
    const status    = sp.get("status") || "ALL"
    const mediaType = sp.get("format") || "ALL"
    const platform  = sp.get("platform") || "ALL"
    const sortBy    = sp.get("sort") || "recommended"
    const limit     = Math.min(parseInt(sp.get("limit") || "24"), 100)
    const offset    = parseInt(sp.get("offset") || "0")
    const source    = sp.get("source") || "auto" // "db" | "meta" | "auto"

    // 1. Try DB index first (has data when crawled)
    if (source !== "meta") {
      try {
        const { data, count } = await queryFromDB({ q, status, mediaType, platform, country, sortBy, limit, offset })
        if (data.length > 0) {
          return NextResponse.json({
            ads: data,
            total: count,
            hasMore: (offset + data.length) < (count ?? 0),
            source: "db",
          })
        }
      } catch (dbErr) {
        console.warn("[inspo/adscan] DB query failed, falling back to Meta:", dbErr)
      }
    }

    // 2. Fallback to Meta Ad Library
    if (!q && source !== "meta") {
      return NextResponse.json({ ads: [], total: 0, hasMore: false, source: "db", empty: true })
    }

    const token = await getAccessToken(ctx.orgId)
    if (!token) {
      return NextResponse.json(
        { error: "No data source configured. Run the crawl script or connect Facebook.", no_connection: true },
        { status: 400 }
      )
    }

    const data = await queryMetaAdLibrary(token, q || "shop", country, status === "ALL" ? "ALL" : status, limit)
    if ((data as any).error) {
      return NextResponse.json({ error: (data as any).error.message }, { status: 400 })
    }

    const ads = ((data as any).data || []).map(normalizeMetaAd)
    return NextResponse.json({ ads, hasMore: !!(data as any).paging?.next, source: "meta" })

  } catch (err: any) {
    console.error("[inspo/adscan]", err)
    return NextResponse.json({ error: "Failed to search ads" }, { status: 500 })
  }
}
