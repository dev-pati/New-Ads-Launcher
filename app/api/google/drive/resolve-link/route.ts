/**
 * POST /api/google/drive/resolve-link
 * Resolves Google Drive file/folder URLs to actual media files.
 * Used by the Drive Link tab in the launch page.
 * Body: { items: [{id, type, label}], includeSubfolders?: boolean }
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthContext }            from "@/lib/auth"
import { createAdminClient }         from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const DRIVE_API = "https://www.googleapis.com/drive/v3"

const MEDIA_MIME_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/quicktime", "video/x-msvideo",
]

async function getValidToken(orgId: string): Promise<string | null> {
  const db = createAdminClient()
  const { data: conn } = await db
    .from("google_connections")
    .select("access_token, refresh_token, expiry_at")
    .eq("org_id", orgId)
    .maybeSingle()

  if (!conn?.refresh_token) return null

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
  if (!refreshRes.ok || refreshed.error) {
    await db.from("google_connections").delete().eq("org_id", orgId)
    return null
  }
  const newExpiry = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString()
  await db.from("google_connections")
    .update({ access_token: refreshed.access_token, expiry_at: newExpiry })
    .eq("org_id", orgId)
  return refreshed.access_token
}

async function listFilesInFolder(
  folderId: string,
  token: string,
  includeSubfolders: boolean
): Promise<{ id: string; name: string; mimeType: string; webViewLink?: string }[]> {
  const q = `'${folderId}' in parents and trashed = false and (${MEDIA_MIME_TYPES.map(m => `mimeType='${m}'`).join(" or ")}${includeSubfolders ? ` or mimeType='application/vnd.google-apps.folder'` : ""})`
  const params = new URLSearchParams({
    q,
    fields: "files(id,name,mimeType,webViewLink,thumbnailLink)",
    pageSize: "100",
    orderBy: "name",
  })
  const res  = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? "Drive API error")

  let files = (data.files ?? []).filter((f: any) =>
    MEDIA_MIME_TYPES.includes(f.mimeType)
  )

  if (includeSubfolders) {
    const folders = (data.files ?? []).filter((f: any) =>
      f.mimeType === "application/vnd.google-apps.folder"
    )
    for (const folder of folders) {
      const subFiles = await listFilesInFolder(folder.id, token, true)
      files = [...files, ...subFiles]
    }
  }

  return files
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const token = await getValidToken(ctx.orgId)
    if (!token) return NextResponse.json({ connected: false, error: "Google Drive not connected" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const items: { id: string; type: "file" | "folder"; label: string }[] = body.items ?? []
    const includeSubfolders: boolean = body.includeSubfolders ?? false

    if (!items.length) return NextResponse.json({ files: [], errors: [] })

    const allFiles: { id: string; name: string; mimeType: string }[] = []
    const errors: { name: string; error: string }[] = []

    for (const item of items) {
      try {
        if (item.type === "file") {
          // Single file
          const params = new URLSearchParams({ fields: "id,name,mimeType,webViewLink,thumbnailLink" })
          const res  = await fetch(`${DRIVE_API}/files/${item.id}?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const file = await res.json()
          if (!res.ok) throw new Error(file.error?.message ?? "File not found")
          if (!MEDIA_MIME_TYPES.includes(file.mimeType)) {
            throw new Error(`Not a supported media file (${file.mimeType})`)
          }
          allFiles.push({ id: file.id, name: file.name, mimeType: file.mimeType })
        } else {
          // Folder — list contents
          const files = await listFilesInFolder(item.id, token, includeSubfolders)
          if (files.length === 0) {
            errors.push({ name: item.label, error: "No media files found in folder" })
          } else {
            allFiles.push(...files)
          }
        }
      } catch (err: any) {
        errors.push({ name: item.label, error: err.message })
      }
    }

    return NextResponse.json({ files: allFiles, errors })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
