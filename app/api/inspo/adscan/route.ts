import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

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

// Server-side cache: key = "q|country|status|limit" → { data, ts }
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

// Try to get a valid access token — priority: dedicated env token > org user token > App Token
async function getAccessToken(orgId: string): Promise<{ token: string; source: "dedicated" | "user" | "app" } | null> {
  // 1. Dedicated long-lived Ad Library token (best — no user connection required)
  const dedicatedToken = process.env.FACEBOOK_AD_LIBRARY_TOKEN
  if (dedicatedToken) return { token: dedicatedToken, source: "dedicated" }

  // 2. Org's connected Facebook user token
  try {
    const conn = await getFacebookConnection(orgId)
    if (conn?.access_token) {
      if (!conn.token_expires_at || new Date(conn.token_expires_at) > new Date()) {
        return { token: conn.access_token, source: "user" }
      }
    }
  } catch { /* no connection */ }

  // 3. App Access Token fallback
  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (appId && appSecret) {
    return { token: `${appId}|${appSecret}`, source: "app" }
  }

  return null
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

    const tokenInfo = await getAccessToken(ctx.orgId)
    if (!tokenInfo) {
      return NextResponse.json(
        { error: "Facebook not connected. Go to Connect → Facebook to link your account.", no_connection: true },
        { status: 400 }
      )
    }

    const data = await queryAdLibrary(tokenInfo.token, q, country, status, limit)

    if (data.error) {
      console.error("Meta Ad Library error:", data.error)

      // If user token failed (e.g. expired), try App Token as fallback
      if (tokenInfo.source === "user") {
        const appId = process.env.FACEBOOK_APP_ID
        const appSecret = process.env.FACEBOOK_APP_SECRET
        if (appId && appSecret) {
          const appData = await queryAdLibrary(`${appId}|${appSecret}`, q, country, status, limit)
          if (!appData.error) {
            return NextResponse.json({ ads: appData.data || [], paging: appData.paging })
          }
        }
      }

      return NextResponse.json({
        error: data.error.message,
        error_subcode: data.error?.error_subcode,
        error_code: data.error?.code,
      }, { status: 400 })
    }

    return NextResponse.json({ ads: data.data || [], paging: data.paging })
  } catch (err) {
    console.error("Ad scan error:", err)
    return NextResponse.json({ error: "Failed to search ads" }, { status: 500 })
  }
}
