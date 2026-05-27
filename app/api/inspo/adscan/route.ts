import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

const META_AD_LIBRARY_URL = "https://graph.facebook.com/v25.0/ads_archive"
const SEARCHAPI_URL = "https://www.searchapi.io/api/v1/search"

const META_FIELDS = [
  "id",
  "page_name",
  "page_id",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_snapshot_url",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "publisher_platforms",
  "languages",
  "eu_total_reach",
  "impressions",
  "spend",
  "currency",
].join(",")

type CacheValue = { data: unknown; ts: number }
const serverCache = new Map<string, CacheValue>()
const SERVER_CACHE_TTL = 5 * 60 * 1000

type MetaToken = { token: string; source: "dedicated" | "user" | "app" }
type JsonObject = Record<string, unknown>
type SearchApiResult = {
  data?: JsonObject[]
  paging?: unknown
  source?: "searchapi"
  error?: { message?: string; code?: number | string }
}

function numericValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function rangeUpper(value: unknown): number | undefined {
  const obj = asObject(value)
  return numericValue(obj.upper_bound) ?? numericValue(obj.max) ?? numericValue(obj.to)
}

function cacheGet<T>(key: string): T | null {
  const cached = serverCache.get(key)
  if (cached && Date.now() - cached.ts < SERVER_CACHE_TTL) return cached.data as T
  return null
}

function cacheSet(key: string, data: unknown) {
  serverCache.set(key, { data, ts: Date.now() })
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}
}

function firstObject(value: unknown): JsonObject {
  return Array.isArray(value) ? asObject(value[0]) : {}
}

function firstString(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined
  return typeof value === "string" ? value : undefined
}

async function queryMetaAdLibrary(accessToken: string, q: string, country: string, status: string, limit: number) {
  const cacheKey = `meta|${q.toLowerCase()}|${country}|${status}|${limit}`
  const cached = cacheGet<JsonObject>(cacheKey)
  if (cached) return cached

  const params = new URLSearchParams({
    access_token: accessToken,
    search_terms: q,
    ad_reached_countries: JSON.stringify([country]),
    ad_active_status: status,
    ad_type: "ALL",
    fields: META_FIELDS,
    limit: String(limit),
  })

  const res = await fetch(`${META_AD_LIBRARY_URL}?${params}`, { next: { revalidate: 0 } })
  const data = await res.json()
  if (!data.error) cacheSet(cacheKey, data)
  return data
}

function normalizeStatus(status: string) {
  if (status === "INACTIVE") return "inactive"
  if (status === "ALL") return "all"
  return "active"
}

function pickSearchApiMedia(snapshot: JsonObject) {
  const videoObject = firstObject(snapshot.videos)
  const imageObject = firstObject(snapshot.images)
  const cardObject = firstObject(snapshot.cards)
  const video =
    firstString(videoObject.video_preview_image_url) ||
    firstString(videoObject.thumbnail_url) ||
    firstString(videoObject.video_sd_url) ||
    firstString(videoObject.video_hd_url)
  if (video) return { media_url: video, media_type: "video" }

  const image =
    firstString(imageObject.resized_image_url) ||
    firstString(imageObject.original_image_url) ||
    firstString(cardObject.resized_image_url) ||
    firstString(cardObject.original_image_url)
  return { media_url: image || "", media_type: "image" }
}

function normalizeSearchApiAd(ad: JsonObject) {
  const snapshot = asObject(ad.snapshot)
  const body = asObject(snapshot.body)
  const title = asObject(snapshot.title)
  const caption = asObject(snapshot.caption)
  const media = pickSearchApiMedia(snapshot)
  const start = firstString(ad.start_date) || firstString(ad.ad_delivery_start_time)
  const end = firstString(ad.end_date) || firstString(ad.ad_delivery_stop_time)
  const totalActiveTime = typeof ad.total_active_time === "number" || typeof ad.total_active_time === "string"
    ? Number(ad.total_active_time)
    : undefined
  const runningDays = totalActiveTime
    ? Math.max(1, Math.floor(totalActiveTime / 86400))
    : start
      ? Math.max(0, Math.floor((new Date(end || Date.now()).getTime() - new Date(start).getTime()) / 86400000))
      : undefined
  const adArchiveId = firstString(ad.ad_archive_id)
  const categories = Array.isArray(ad.categories) ? ad.categories : []

  return {
    id: adArchiveId || firstString(ad.id),
    page_name: firstString(ad.page_name) || firstString(snapshot.page_name) || firstString(snapshot.current_page_name) || "Unknown",
    page_id: firstString(ad.page_id) || firstString(snapshot.page_id),
    ad_creative_bodies: [firstString(body.text) || firstString(ad.body) || ""].filter(Boolean),
    ad_creative_link_titles: [firstString(title.text) || firstString(caption.text) || firstString(ad.title) || ""].filter(Boolean),
    ad_snapshot_url: firstString(ad.ad_snapshot_url) || (adArchiveId ? `https://www.facebook.com/ads/library/?id=${adArchiveId}` : undefined),
    ad_delivery_start_time: start,
    ad_delivery_stop_time: end,
    publisher_platforms: Array.isArray(ad.publisher_platform) ? ad.publisher_platform : Array.isArray(ad.publisher_platforms) ? ad.publisher_platforms : [],
    languages: Array.isArray(ad.languages) ? ad.languages : [],
    brand_avatar: firstString(snapshot.page_profile_picture_url) || "",
    media_url: media.media_url,
    media_type: media.media_type,
    cta: firstString(snapshot.cta_text) || "",
    format: firstString(snapshot.display_format) || "",
    category: firstString(snapshot.page_categories) || firstString(categories[0]),
    running_days: runningDays,
    impressions: {
      upper_bound:
        rangeUpper(ad.impressions) ??
        rangeUpper(ad.impressions_with_index) ??
        numericValue(ad.impressions),
    },
    spend: {
      upper_bound: rangeUpper(ad.spend) ?? numericValue(ad.spend),
    },
  }
}

async function querySearchApi(q: string, country: string, status: string, limit: number): Promise<SearchApiResult | null> {
  const apiKey = process.env.SEARCHAPI_API_KEY || process.env.SEARCHAPI_KEY
  if (!apiKey) return null

  const cacheKey = `searchapi|${q.toLowerCase()}|${country}|${status}|${limit}`
  const cached = cacheGet<SearchApiResult>(cacheKey)
  if (cached) return cached

  const params = new URLSearchParams({
    engine: "meta_ad_library",
    q,
    country,
    active_status: normalizeStatus(status),
    ad_type: "all",
    sort_by: "impressions_high_to_low",
  })

  const res = await fetch(`${SEARCHAPI_URL}?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 0 },
  })
  const data = await res.json()
  if (!res.ok || data.error) {
    return {
      error: data.error || {
        message: data.message || "SearchAPI request failed",
        code: res.status,
      },
    }
  }

  const normalized: SearchApiResult = {
    data: (data.ads || []).slice(0, limit).map(normalizeSearchApiAd),
    paging: data.pagination,
    source: "searchapi",
  }
  cacheSet(cacheKey, normalized)
  return normalized
}

async function getAccessToken(orgId: string): Promise<MetaToken | null> {
  const dedicatedToken = process.env.FACEBOOK_AD_LIBRARY_TOKEN
  if (dedicatedToken) return { token: dedicatedToken, source: "dedicated" }

  try {
    const conn = await getFacebookConnection(orgId)
    if (conn?.access_token) {
      if (!conn.token_expires_at || new Date(conn.token_expires_at) > new Date()) {
        return { token: conn.access_token, source: "user" }
      }
    }
  } catch {
    // no connection
  }

  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (appId && appSecret) return { token: `${appId}|${appSecret}`, source: "app" }

  return null
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp = request.nextUrl.searchParams
    const q = sp.get("q")?.trim() || ""
    const country = sp.get("country") || "GB"
    const status = sp.get("status") || "ACTIVE"
    const limit = Math.min(parseInt(sp.get("limit") || "24"), 50)

    if (!q) return NextResponse.json({ ads: [] })

    const searchApiData = await querySearchApi(q, country, status, limit)
    if (searchApiData && !searchApiData.error) {
      return NextResponse.json({
        ads: searchApiData.data || [],
        paging: searchApiData.paging,
        source: "searchapi",
      })
    }

    const tokenInfo = await getAccessToken(ctx.orgId)
    if (!tokenInfo) {
      return NextResponse.json(
        { error: "No ad library data source configured. Add SEARCHAPI_API_KEY or connect Facebook with Ad Library access.", no_connection: true },
        { status: 400 }
      )
    }

    const data = await queryMetaAdLibrary(tokenInfo.token, q, country, status, limit)
    if (data.error) {
      console.error("Meta Ad Library error:", data.error)

      if (tokenInfo.source === "user") {
        const appId = process.env.FACEBOOK_APP_ID
        const appSecret = process.env.FACEBOOK_APP_SECRET
        if (appId && appSecret) {
          const appData = await queryMetaAdLibrary(`${appId}|${appSecret}`, q, country, status, limit)
          if (!appData.error) {
            return NextResponse.json({ ads: appData.data || [], paging: appData.paging, source: "meta" })
          }
        }
      }

      return NextResponse.json({
        error: searchApiData?.error?.message || data.error.message,
        error_subcode: data.error?.error_subcode,
        error_code: data.error?.code,
      }, { status: 400 })
    }

    return NextResponse.json({ ads: data.data || [], paging: data.paging, source: "meta" })
  } catch (err) {
    console.error("Ad scan error:", err)
    return NextResponse.json({ error: "Failed to search ads" }, { status: 500 })
  }
}
