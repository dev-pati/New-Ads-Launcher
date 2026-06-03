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

// GET /api/google/drive/test?folder_id=xxx&file_type=images|videos|all
// Tests if we can access the folder and returns basic metadata
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = request.nextUrl
    const folderId = searchParams.get("folder_id")
    const fileType = searchParams.get("file_type") ?? "all"

    if (!folderId) {
      return NextResponse.json({ error: "Missing folder_id" }, { status: 400 })
    }

    const token = await getValidToken(ctx.orgId)
    if (!token) {
      return NextResponse.json({ error: "Google Drive not connected" }, { status: 401 })
    }

    // Get folder metadata
    const folderRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!folderRes.ok) {
      const err = await folderRes.json().catch(() => ({}))
      return NextResponse.json(
        { error: err?.error?.message ?? `Drive API error (${folderRes.status})` },
        { status: folderRes.status }
      )
    }
    const folder = await folderRes.json()

    // List files in the folder (up to 10 to show count)
    let mimeQuery = `'${folderId}' in parents and trashed = false`
    if (fileType === "images") mimeQuery += " and mimeType contains 'image/'"
    else if (fileType === "videos") mimeQuery += " and mimeType contains 'video/'"

    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(mimeQuery)}&fields=files(id,name,mimeType)&pageSize=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const listData = listRes.ok ? await listRes.json() : { files: [] }

    return NextResponse.json({
      folderName: folder.name,
      folderId:   folder.id,
      fileCount:  (listData.files ?? []).length,
      files:      (listData.files ?? []).slice(0, 5).map((f: any) => ({ id: f.id, name: f.name })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
