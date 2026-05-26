import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { GRAPH_API_BASE } from "@/lib/facebook"

const FALLBACK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <rect width="96" height="96" rx="48" fill="#dbeafe"/>
  <path d="M52 82V52h10l2-12H52v-8c0-3.5 1.2-6 6.2-6H65V15.4C63.8 15.2 59.8 15 55.4 15 46.2 15 40 20.6 40 30.9V40H30v12h10v30h12Z" fill="#2563eb"/>
</svg>
`.trim()

function fallbackImage() {
  return new NextResponse(FALLBACK_SVG, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  })
}

export async function GET(request: NextRequest) {
  const pageId = request.nextUrl.searchParams.get("page_id")
  if (!pageId) return fallbackImage()

  try {
    const ctx = await getAuthContext()
    if (!ctx) return fallbackImage()

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return fallbackImage()

    const res = await fetch(
      `${GRAPH_API_BASE}/${encodeURIComponent(pageId)}/picture?type=square&height=96&width=96&access_token=${connection.access_token}`,
      { redirect: "follow" }
    )

    if (!res.ok) return fallbackImage()

    const contentType = res.headers.get("content-type") || "image/jpeg"
    const body = await res.arrayBuffer()
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch {
    return fallbackImage()
  }
}
