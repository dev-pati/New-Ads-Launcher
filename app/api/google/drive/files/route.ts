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

// GET /api/google/drive/files
// ?folder_id=xxx         – restrict to specific folder (omit = search all Drive)
// ?media_type=image|video – filter by image or video mimeTypes
// ?name_op=name_contains|name_equals|... – name filter operator
// ?name_val=xxx          – value for name filter
// ?limit=5
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const token = await getValidToken(ctx.orgId)
    if (!token) return NextResponse.json({ connected: false, files: [] })

    const sp       = request.nextUrl.searchParams
    const folderId = sp.get("folder_id")
    const mediaType= sp.get("media_type")   // "image" | "video" | null
    const nameOp   = sp.get("name_op")      // "name_contains" | "name_equals" | etc.
    const nameVal  = sp.get("name_val")     // filter value
    const limit    = Math.min(parseInt(sp.get("limit") || "5", 10), 50)

    // Build Drive query
    const clauses: string[] = ["trashed = false"]

    // Folder scope
    if (folderId) {
      clauses.push(`'${folderId}' in parents`)
    }

    // Media type filter
    if (mediaType === "image") {
      clauses.push("(mimeType contains 'image/')")
    } else if (mediaType === "video") {
      clauses.push("(mimeType contains 'video/')")
    } else {
      // All media — exclude folders and docs
      clauses.push("(mimeType contains 'image/' or mimeType contains 'video/')")
    }

    // Name filter
    if (nameVal && nameOp && nameOp !== "all") {
      const safeVal = nameVal.replace(/'/g, "\\'")
      if (nameOp === "name_contains")           clauses.push(`name contains '${safeVal}'`)
      else if (nameOp === "name_equals")        clauses.push(`name = '${safeVal}'`)
      else if (nameOp === "name_does_not_contain") clauses.push(`not name contains '${safeVal}'`)
      else if (nameOp === "name_starts_with")   clauses.push(`name contains '${safeVal}'`)
      else if (nameOp === "name_ends_with")     clauses.push(`name contains '${safeVal}'`)
    }

    const q = clauses.join(" and ")

    const params = new URLSearchParams({
      q,
      fields: "files(id,name,mimeType,thumbnailLink,iconLink,size,modifiedTime,createdTime,parents)",
      orderBy: "modifiedTime desc",
      pageSize: String(limit),
    })

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json({ error: err.error?.message ?? "Drive API error" }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json({ connected: true, files: data.files ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
