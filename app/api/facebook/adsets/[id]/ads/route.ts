import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

const GRAPH_API_BASE = "https://graph.facebook.com/v25.0"

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
    const res = await fetch(
      `${GRAPH_API_BASE}/${id}/ads?fields=${fields}&limit=200&access_token=${connection.access_token}`
    )
    const data = await res.json()
    if (!res.ok) {
      const msg = data.error?.message || "Failed to fetch ads"
      if (/rate limit|#4|request limit/i.test(msg)) {
        return NextResponse.json({ error: "Rate limited", rateLimited: true }, { status: 429 })
      }
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    return NextResponse.json({ ads: data.data || [] })
  } catch (err: any) {
    console.error("[adset ads] error:", err)
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}
