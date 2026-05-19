import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"

// App Access Token = app_id|app_secret — never expires, no user ToS required
function getAppAccessToken() {
  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appId || !appSecret) return null
  return `${appId}|${appSecret}`
}

const AD_LIBRARY_URL = "https://graph.facebook.com/v25.0/ads_archive"
const FIELDS = [
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
].join(",")

// Server-side cache: key = "q|country|status" → { data, ts }
const serverCache = new Map<string, { data: any; ts: number }>()
const SERVER_CACHE_TTL = 5 * 60 * 1000

async function queryAdLibrary(accessToken: string, q: string, country: string, status: string, limit: number) {
  const cacheKey = `${q.toLowerCase()}|${country}|${status}|${limit}`
  const cached = serverCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < SERVER_CACHE_TTL) return cached.data

  const params = new URLSearchParams({
    access_token: accessToken,
    search_terms: q,
    ad_reached_countries: JSON.stringify([country]),
    ad_active_status: status,
    ad_type: "ALL",
    fields: FIELDS,
    limit: String(limit),
  })
  const res  = await fetch(`${AD_LIBRARY_URL}?${params}`, { next: { revalidate: 0 } })
  const data = await res.json()

  if (!data.error) serverCache.set(cacheKey, { data, ts: Date.now() })
  return data
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp      = request.nextUrl.searchParams
    const q       = sp.get("q")?.trim() || ""
    const country = sp.get("country") || "VN"
    const status  = sp.get("status") || "ACTIVE"
    const limit   = Math.min(parseInt(sp.get("limit") || "24"), 50)

    if (!q) return NextResponse.json({ ads: [] })

    const token = getAppAccessToken()
    if (!token) {
      return NextResponse.json(
        { error: "Facebook App credentials not configured." },
        { status: 500 }
      )
    }

    const data = await queryAdLibrary(token, q, country, status, limit)
    if (data.error) {
      console.error("Meta Ad Library error:", data.error)
      return NextResponse.json({ error: data.error.message, error_subcode: data.error?.error_subcode }, { status: 400 })
    }

    return NextResponse.json({ ads: data.data || [], paging: data.paging })
  } catch (err) {
    console.error("Ad scan error:", err)
    return NextResponse.json({ error: "Failed to search ads" }, { status: 500 })
  }
}
