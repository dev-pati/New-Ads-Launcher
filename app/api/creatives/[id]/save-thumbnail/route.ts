import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const supabase = await createClient()
    const admin = createAdminClient()

    // Verify creative belongs to org
    const { data: creative, error: fetchErr } = await supabase
      .from("creatives")
      .select("id, org_id, file_name")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .single()
    if (fetchErr || !creative) {
      return NextResponse.json({ error: "Creative not found" }, { status: 404 })
    }

    // Read raw body
    const buffer = await request.arrayBuffer()
    if (buffer.byteLength === 0) return NextResponse.json({ error: "Empty body" }, { status: 400 })
    if (buffer.byteLength > 5 * 1024 * 1024) return NextResponse.json({ error: "Thumbnail too large (max 5MB)" }, { status: 413 })

    const contentType = request.headers.get("content-type") || "image/jpeg"
    const ext = contentType.includes("png") ? "png" : "jpg"
    const storagePath = `thumbnails/${ctx.orgId}/${id}.${ext}`

    // Use admin client for storage to bypass RLS issues
    const { error: uploadErr } = await admin.storage
      .from("ad-media")
      .upload(storagePath, buffer, {
        contentType,
        upsert: true,
        cacheControl: "31536000",
      })

    if (uploadErr) {
      console.error("[save-thumbnail] Storage upload error:", uploadErr)
      return NextResponse.json({ error: uploadErr.message }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from("ad-media").getPublicUrl(storagePath)
    const publicUrl = urlData.publicUrl

    await admin
      .from("creatives")
      .update({ fb_thumbnail_url: publicUrl })
      .eq("id", id)

    return NextResponse.json({ thumbnail_url: publicUrl })
  } catch (err: any) {
    console.error("[save-thumbnail] error:", err)
    return NextResponse.json({ error: err.message || "Failed to save thumbnail" }, { status: 500 })
  }
}
