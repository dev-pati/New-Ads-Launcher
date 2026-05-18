import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-")
}

// Returns a Supabase signed upload URL so the client can PUT the file directly,
// bypassing Next.js body size limits entirely.
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp = request.nextUrl.searchParams
    const filename = sp.get("filename")
    if (!filename) return NextResponse.json({ error: "filename required" }, { status: 400 })

    const storagePath = `creatives/${ctx.orgId}/${crypto.randomUUID()}-${sanitizeFileName(filename)}`
    const admin = createAdminClient()

    const { data, error } = await admin.storage.from("ad-media").createSignedUploadUrl(storagePath)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: { publicUrl } } = admin.storage.from("ad-media").getPublicUrl(storagePath)

    return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, storagePath, publicUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create signed URL" }, { status: 500 })
  }
}
