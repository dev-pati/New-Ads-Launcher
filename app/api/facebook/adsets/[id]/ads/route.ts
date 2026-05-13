import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getCachedFacebookMetadata } from "@/app/api/facebook/_cache"
import { metaFetch, MetaRateLimitError } from "@/app/api/facebook/_meta-fetch"

const GRAPH_API_BASE = "https://graph.facebook.com/v25.0"
const TTL_MS = 2 * 60 * 1000  // 2 minutes — adset ads list changes rarely

// GET /api/facebook/adsets/[id]/ads
// Returns list of ads in the specified ad set (used by Duplicate Campaign Step 2 "Choose ads to copy")
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    if (!id) return NextResponse.json({ error: "ad set id required" }, { status: 400 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    const fields = "id,name,status,effective_status,created_time"
    const cacheKey = `adset-ads:${ctx.orgId}:${id}`

    const ads = await getCachedFacebookMetadata(cacheKey, TTL_MS, async () => {
      const url = `${GRAPH_API_BASE}/${id}/ads?fields=${fields}&limit=200&access_token=${connection.access_token}`
      const data = await metaFetch(url, { caller: "adset-ads" })
      return data.data || []
    })

    return NextResponse.json({ ads })
  } catch (err: any) {
    if (err instanceof MetaRateLimitError) {
      return NextResponse.json({ error: "Rate limited by Meta", rateLimited: true }, { status: 429 })
    }
    console.error("[adset ads] error:", err)
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}
