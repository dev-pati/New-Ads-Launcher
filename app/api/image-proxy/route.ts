/**
 * GET /api/image-proxy?url=<encoded_url>
 * Server-side proxy for Facebook CDN images that block direct browser requests.
 * Requires auth session to prevent open proxy abuse.
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"

export const dynamic = "force-dynamic"

// Only proxy known safe domains
const ALLOWED_DOMAINS = [
  "fbcdn.net",
  "scontent",
  "fbsbx.com",
  "cdninstagram.com",
  "lookaside.fbsbx.com",
]

function isAllowedUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return ALLOWED_DOMAINS.some(d => hostname.includes(d))
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  // Auth check
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = request.nextUrl.searchParams.get("url")
  if (!url) return NextResponse.json({ error: "url param required" }, { status: 400 })

  if (!isAllowedUrl(url)) {
    return NextResponse.json({ error: "Domain not allowed" }, { status: 403 })
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AdLauncher/1.0)",
        "Accept": "image/*,*/*",
      },
      // 10 second timeout
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Upstream ${res.status}` }, { status: res.status })
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg"
    const buffer = await res.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
