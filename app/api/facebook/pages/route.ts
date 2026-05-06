import { NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getFacebookPages } from "@/lib/facebook"

// Dev-only mock data — set MOCK_META_API=true in .env.local to skip real Meta API calls
// (preserves rate limit quota when developing UI)
const MOCK_PAGES = [
  { id: "100000000000001", name: "Mock Page A", access_token: "mock", category: "Brand", picture: { data: { url: "https://placehold.co/100x100/10b981/white?text=A" } } },
  { id: "100000000000002", name: "Mock Page B", access_token: "mock", category: "Brand", picture: { data: { url: "https://placehold.co/100x100/3b82f6/white?text=B" } } },
  { id: "100000000000003", name: "Mock Test Page", access_token: "mock", category: "Business", picture: { data: { url: "https://placehold.co/100x100/8b5cf6/white?text=T" } } },
]

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (process.env.MOCK_META_API === "true") {
      console.log("[pages] MOCK MODE — returning fake pages")
      return NextResponse.json({ pages: MOCK_PAGES, mock: true })
    }

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection found. Go to /connect to link Facebook." }, { status: 401 })

    try {
      const pages = await getFacebookPages(connection.access_token)
      console.log(`[pages] Fetched ${pages.length} pages for org=${ctx.orgId}`)
      return NextResponse.json({ pages })
    } catch (metaErr: any) {
      const msg = metaErr.message || "Meta API error"
      console.error("[pages] Meta API error:", msg)
      const lower = msg.toLowerCase()
      // Rate limit
      if (lower.includes("request limit") || lower.includes("#4") || lower.includes("rate limit") || lower.includes("too many")) {
        return NextResponse.json({
          error: "Facebook API rate limit reached. Wait 5-10 minutes and refresh the page.",
          rateLimited: true,
        }, { status: 429 })
      }
      // Token issues
      if (lower.includes("expired") || lower.includes("invalid") || lower.includes("oauth") || lower.includes("session") || lower.includes("revoked")) {
        return NextResponse.json({
          error: `Facebook token expired or revoked. Please reconnect at /connect. (${msg})`,
          needsReconnect: true,
        }, { status: 401 })
      }
      if (lower.includes("permission") || lower.includes("scope")) {
        return NextResponse.json({
          error: `Missing Facebook permission: ${msg}. Reconnect to grant pages_show_list scope.`,
          needsReconnect: true,
        }, { status: 403 })
      }
      return NextResponse.json({ error: `Meta API: ${msg}` }, { status: 500 })
    }
  } catch (err: any) {
    console.error("[pages] Server error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
