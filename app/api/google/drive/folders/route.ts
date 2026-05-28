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
  if (!refreshRes.ok || refreshed.error) {
    await adminDb.from("google_connections").delete().eq("org_id", orgId)
    return null
  }
  const newExpiry = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString()
  await adminDb.from("google_connections")
    .update({ access_token: refreshed.access_token, expiry_at: newExpiry, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
  return refreshed.access_token
}

// GET /api/google/drive/folders?name_contains=xxx
// Returns list of Google Drive folders for the connected account
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const token = await getValidToken(ctx.orgId)
    if (!token) return NextResponse.json({ connected: false, folders: [] })

    const sp = request.nextUrl.searchParams
    const nameFilter = sp.get("name_contains") ?? ""

    let q = `mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    if (nameFilter) q += ` and name contains '${nameFilter.replace(/'/g, "\\'")}'`

    const params = new URLSearchParams({
      q,
      fields: "files(id,name,modifiedTime,parents)",
      orderBy: "name",
      pageSize: "100",
    })

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json({ error: err.error?.message ?? "Drive API error" }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json({ connected: true, folders: data.files ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
