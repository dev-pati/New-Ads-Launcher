import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { uploadImageToMeta, uploadVideoToMeta } from "@/lib/facebook"
import { createClient } from "@supabase/supabase-js"

// POST /api/google/import-drive
// Downloads a file from Google Drive using the user's OAuth token,
// uploads it to Meta, and saves a creative record.
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { accessToken, fileId, fileName, mimeType, adAccountId } = await request.json()
    if (!accessToken || !fileId || !adAccountId) {
      return NextResponse.json({ error: "accessToken, fileId, adAccountId required" }, { status: 400 })
    }

    // Download file from Google Drive
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!driveRes.ok) {
      const err = await driveRes.text()
      return NextResponse.json({ error: `Drive download failed: ${err}` }, { status: 400 })
    }
    const fileBuffer = await driveRes.arrayBuffer()

    // Get Facebook connection
    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    const isVideo = mimeType?.startsWith("video/")
    let fbImageHash: string | null = null
    let fbImageUrl: string | null = null
    let fbThumbnailUrl: string | null = null
    let fbVideoId: string | null = null

    if (isVideo) {
      const r = await uploadVideoToMeta(adAccountId, connection.access_token, fileBuffer, fileName)
      fbVideoId = r.videoId
    } else {
      const r = await uploadImageToMeta(adAccountId, connection.access_token, fileBuffer, fileName)
      fbImageHash = r.hash
      fbImageUrl = r.url
      fbThumbnailUrl = r.url_128 || r.url
    }

    // Save creative to Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: creative, error: insertError } = await supabase
      .from("creatives")
      .insert({
        org_id: ctx.orgId,
        user_id: ctx.user.id,
        ad_account_id: adAccountId,
        file_name: fileName,
        file_url: (fbThumbnailUrl || fbImageUrl || "") + "#gdrive",
        media_type: isVideo ? "video" : "image",
        file_size: fileBuffer.byteLength,
        fb_image_hash: fbImageHash,
        fb_image_url: fbImageUrl,
        fb_thumbnail_url: fbThumbnailUrl,
        fb_video_id: fbVideoId,
      })
      .select()
      .single()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    return NextResponse.json({ creative }, { status: 201 })
  } catch (err: any) {
    console.error("[import-drive]", err)
    return NextResponse.json({ error: err.message || "Import failed" }, { status: 500 })
  }
}
