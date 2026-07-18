import { NextRequest } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { resolveOrgPageAccessToken } from "@/lib/facebook-page-token"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GRAPH = "https://graph.facebook.com/v25.0"

// GET /api/insights/video-proxy?videoId=...&pageId=...
// Streams an ad creative's video with browser-playable headers so it can be
// embedded in a <video> tag. Dark-post video files are Page-owned and the
// browser cannot fetch them directly (auth/redirect/disposition), so we proxy.
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return new Response("Unauthorized", { status: 401 })

  const sp = request.nextUrl.searchParams
  const videoId = sp.get("videoId")
  const pageId = sp.get("pageId")
  if (!videoId) return new Response("videoId required", { status: 400 })

  // Prefer a Page token (dark-post videos are Page-owned); fall back to ad token.
  let token: string | null = null
  if (pageId) {
    try {
      const supabase = createAdminClient()
      const pageToken = await resolveOrgPageAccessToken(supabase, ctx.orgId, ctx.user.id, pageId)
      if (pageToken?.token) token = pageToken.token
    } catch {
      /* ignore */
    }
  }
  if (!token) {
    const conn = await getFacebookConnection(ctx.orgId)
    token = conn?.access_token || null
  }
  if (!token) return new Response("No Facebook token", { status: 401 })

  const metaRes = await fetch(
    `${GRAPH}/${videoId}?fields=source&access_token=${encodeURIComponent(token)}`
  )
  const metaJson = await metaRes.json().catch(() => null)
  const source = metaJson?.source
  if (typeof source !== "string" || !source.startsWith("http")) {
    return new Response("Video source unavailable", { status: 502 })
  }

  const upstream = await fetch(source)
  if (!upstream.ok || !upstream.body) return new Response("Upstream fetch failed", { status: 502 })

  const headers = new Headers()
  headers.set("Content-Type", "video/mp4")
  headers.set("Cache-Control", "private, max-age=300")
  const len = upstream.headers.get("content-length")
  if (len) headers.set("Content-Length", len)
  const range = upstream.headers.get("content-range")
  if (range) headers.set("Content-Range", range)
  headers.set("Accept-Ranges", "bytes")

  return new Response(upstream.body, { status: 200, headers })
}
