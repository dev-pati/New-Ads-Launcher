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
    // For large files, Google Drive might return a virus scan warning (HTML). 
    // We try to handle it by checking the content type and looking for confirmation tokens.
    let driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    // Check if we got an HTML response instead of binary (common for large files / warnings)
    const contentType = driveRes.headers.get("content-type") || ""
    if (contentType.includes("text/html")) {
      const html = await driveRes.text()
      // Look for confirmation token in the HTML (e.g. name="confirm" value="xxxx")
      const match = html.match(/name="confirm" value="([^"]+)"/)
      if (match) {
        const confirmToken = match[1]
        console.log(`[import-drive] Large file detected, retrying with confirm token: ${confirmToken}`)
        driveRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&confirm=${confirmToken}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
      } else {
        console.error("[import-drive] Received HTML instead of media and no confirm token found.")
        return NextResponse.json({ error: "Google Drive returned an HTML page instead of the video file. This usually happens with very large files or restricted permissions." }, { status: 400 })
      }
    }

    if (!driveRes.ok) {
      const err = await driveRes.text()
      console.error("[import-drive] Drive download failed:", driveRes.status, err)
      return NextResponse.json({ error: `Drive download failed: ${err}` }, { status: 400 })
    }
    const fileBuffer = await driveRes.arrayBuffer()
    
    // Final sanity check: if buffer is very small and contains HTML-like tags, it's likely a failure
    if (fileBuffer.byteLength < 5000) {
      const head = new TextDecoder().decode(fileBuffer.slice(0, 100))
      if (head.toLowerCase().includes("<!doctype html") || head.toLowerCase().includes("<html")) {
        return NextResponse.json({ error: "Downloaded content appears to be HTML, not a video file." }, { status: 400 })
      }
    }

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

    if (insertError) {
      console.error("[import-drive] Supabase Insert Error:", insertError)
      return NextResponse.json({ error: `Database error: ${insertError.message}` }, { status: 500 })
    }
    
    return NextResponse.json({ creative }, { status: 201 })
  } catch (err: any) {
    console.error("[import-drive] Critical Error:", err)
    // If the error is a SyntaxError from JSON.parse somewhere, include the full stack
    const errorMessage = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return NextResponse.json({ error: errorMessage, details: err?.stack }, { status: 500 })
  }
}
