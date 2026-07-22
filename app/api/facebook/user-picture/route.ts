import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveOrgPageAccessToken } from "@/lib/facebook-page-token"
import { GRAPH_API_BASE } from "@/lib/facebook"

const FALLBACK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <rect width="96" height="96" rx="48" fill="#E4E6EB"/>
  <circle cx="48" cy="38" r="16" fill="#65676B"/>
  <path d="M48 60c-15 0-26 8-30 18v6h60v-6c-4-10-15-18-30-18z" fill="#65676B"/>
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
  const psid = request.nextUrl.searchParams.get("psid")

  if (!pageId || !psid) return fallbackImage()

  try {
    const ctx = await getAuthContext()
    if (!ctx) return fallbackImage()

    const supabase = createAdminClient()
    const pageToken = await resolveOrgPageAccessToken(supabase, ctx.orgId, ctx.user.id, pageId)
    if (!pageToken?.token) return fallbackImage()

    const res = await fetch(
      `${GRAPH_API_BASE}/${encodeURIComponent(psid)}/picture?type=large&redirect=true&access_token=${pageToken.token}`,
      { redirect: "follow" }
    )

    if (!res.ok) return fallbackImage()

    const contentType = res.headers.get("content-type") || "image/jpeg"
    const body = await res.arrayBuffer()
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400", // cache proxy for 24h
      },
    })
  } catch {
    return fallbackImage()
  }
}
