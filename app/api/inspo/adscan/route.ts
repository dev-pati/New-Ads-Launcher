import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

const AD_LIBRARY_URL = "https://graph.facebook.com/v21.0/ads_archive"
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

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection?.access_token) {
      return NextResponse.json(
        { error: "No Facebook connection. Please connect your Meta account in Settings → Connect." },
        { status: 400 }
      )
    }

    const sp = request.nextUrl.searchParams
    const q = sp.get("q")?.trim() || ""
    const country = sp.get("country") || "VN"
    const status = sp.get("status") || "ACTIVE"
    const limit = Math.min(parseInt(sp.get("limit") || "24"), 50)

    if (!q) return NextResponse.json({ ads: [] })

    const params = new URLSearchParams({
      access_token: connection.access_token,
      search_terms: q,
      ad_reached_countries: JSON.stringify([country]),
      ad_active_status: status,
      ad_type: "ALL",
      fields: FIELDS,
      limit: String(limit),
    })

    const res = await fetch(`${AD_LIBRARY_URL}?${params}`, {
      next: { revalidate: 0 },
    })
    const data = await res.json()

    if (data.error) {
      console.error("Meta Ad Library error:", data.error)
      return NextResponse.json({ error: data.error.message }, { status: 400 })
    }

    return NextResponse.json({ ads: data.data || [], paging: data.paging })
  } catch (err) {
    console.error("Ad scan error:", err)
    return NextResponse.json({ error: "Failed to search ads" }, { status: 500 })
  }
}
