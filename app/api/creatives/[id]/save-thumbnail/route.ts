import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// Save a thumbnail (client-extracted video frame) to Supabase Storage
// and update the creative's fb_thumbnail_url to the public URL.
// Body: raw image binary (jpeg/png).
// Eliminates dependency on Meta thumbnail polling for the lifetime of this creative.
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

    // Verify creative belongs to org
    const { data: creative, error: fetchErr } = await supabase
      .from("creatives")
      .select("id, org_id, file_name")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .single()
    if (fetchErr || !creative) return NextResponse.json({ error: "Creative not found" }, { status: 404 })

    // Read raw body
    const buffer = await request.arrayBuffer()
    if (buffer.byteLength === 0) return NextResponse.json({ error: "Empty body" }, { status: 400 })
    if (buffer.byteLength > 5 * 1024 * 1024) return NextResponse.json({ error: "Thumbnail too large (max 5MB)" }, { status: 413 })

    const contentType = request.headers.get("content-type") || "image/jpeg"
    const ext = contentType.includes("png") ? "png" : "jpg"
    const path = `thumbnails/${ctx.orgId}/${id}.${ext}`

    // Upload to Supabase Storage (upsert to overwrite if exists)
    const { error: uploadErr } = await supabase.storage
      .from("ad-media")
      .upload(path, buffer, {
        contentType,
        upsert: true,
        cacheControl: "31536000", // 1 year
      })
    if (uploadErr) {
      console.error("[save-thumbnail] Storage upload error:", uploadErr)
      return NextResponse.json({ error: uploadErr.message }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from("ad-media").getPublicUrl(path)
    const publicUrl = urlData.publicUrl

    // Update creative
    await supabase
      .from("creatives")
      .update({ fb_thumbnail_url: publicUrl, file_url: publicUrl })
      .eq("id", id)

    return NextResponse.json({ thumbnail_url: publicUrl })
  } catch (err: any) {
    console.error("[save-thumbnail] error:", err)
    return NextResponse.json({ error: err.message || "Failed to save thumbnail" }, { status: 500 })
  }
}
