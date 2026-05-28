import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

async function getValidToken(orgId: string): Promise<string | null> {
  const adminDb = createAdminClient()
  const { data: conn } = await adminDb
    .from("google_connections")
    .select("access_token, refresh_token, expiry_at")
    .eq("org_id", orgId)
    .maybeSingle()

  if (!conn) return null

  const expired = !conn.expiry_at || new Date(conn.expiry_at).getTime() < Date.now() + 60_000
  if (!expired) return conn.access_token

  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: conn.refresh_token,
      client_id:     process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type:    "refresh_token",
    }),
  })
  const refreshed = await refreshRes.json()
  if (!refreshRes.ok || refreshed.error) return null

  const newExpiry = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString()
  await adminDb.from("google_connections")
    .update({ access_token: refreshed.access_token, expiry_at: newExpiry, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
  return refreshed.access_token
}

// GET /api/google/drive/thumbnail?file_id=xxx&size=80
// Proxies Google Drive thumbnail through server-side auth token
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return new NextResponse("Unauthorized", { status: 401 })

    const fileId = request.nextUrl.searchParams.get("file_id")
    if (!fileId) return new NextResponse("file_id required", { status: 400 })

    const size = request.nextUrl.searchParams.get("size") ?? "120"

    const token = await getValidToken(ctx.orgId)
    if (!token) return new NextResponse("Not connected", { status: 401 })

    // Try thumbnail link first (fastest)
    const thumbRes = await fetch(
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (thumbRes.ok) {
      const contentType = thumbRes.headers.get("content-type") ?? "image/jpeg"
      const buffer = await thumbRes.arrayBuffer()
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
        },
      })
    }

    // Fallback: use files API thumbnailLink
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!metaRes.ok) return new NextResponse("Not found", { status: 404 })

    const meta = await metaRes.json()
    if (!meta.thumbnailLink) return new NextResponse("No thumbnail", { status: 404 })

    const imgRes = await fetch(meta.thumbnailLink, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!imgRes.ok) return new NextResponse("Thumbnail fetch failed", { status: 502 })

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg"
    const buffer = await imgRes.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 })
  }
}
