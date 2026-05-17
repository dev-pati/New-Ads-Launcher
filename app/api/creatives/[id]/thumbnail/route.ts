import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { mapCreativeForClient } from "@/lib/creative-media"
import { createClient } from "@/lib/supabase/server"
import { getVideoThumbnail, getVideoSource, checkVideoStatus } from "@/lib/facebook"

interface CreativeUpdate {
  fb_thumbnail_url?: string
  file_url?: string
  status?: string
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = await createClient()
    const { data: creative } = await supabase
      .from("creatives")
      .select("id, media_type, storage_path, fb_video_id, fb_thumbnail_url, fb_image_url, file_url, status")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .single()

    if (!creative) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (!creative.fb_video_id) return NextResponse.json({ error: "Not a video creative" }, { status: 400 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    // 1. Check if the video is ready on Meta if it's still 'processing' in our DB
    let currentStatus = creative.status || "ready"
    if (currentStatus === "processing") {
      const statusCheck = await checkVideoStatus(creative.fb_video_id, connection.access_token)
      if (statusCheck.ready) {
        currentStatus = "ready"
        await supabase.from("creatives").update({ status: "ready" }).eq("id", id)
      } else if (statusCheck.status === "error") {
        currentStatus = "error"
        await supabase.from("creatives").update({ status: "error" }).eq("id", id)
        return NextResponse.json({
          error: statusCheck.errorMsg || "Video processing failed on Meta",
          status: "error",
          creative: mapCreativeForClient({ ...creative, status: "error" })
        })
      } else {
        // Still processing — thumbnail/source won't be available yet, skip fetching them
        return NextResponse.json({ status: "processing", creative: mapCreativeForClient(creative) })
      }
    }

    // 2. Decide if we need to fetch more data (only reached when status is "ready")
    const hasThumb =
      !!creative.fb_thumbnail_url &&
      /^https?:/.test(creative.fb_thumbnail_url) &&
      !creative.fb_thumbnail_url.includes("rsrc.php")
    const hasPlayableSource = !!(creative.file_url && /^https?:/.test(creative.file_url) && /(\.mp4|\.mov|\.webm|fbcdn\.net)/.test(creative.file_url))

    // If we already have everything, return early
    if (hasThumb && hasPlayableSource) {
      return NextResponse.json({
        thumbnail_url: creative.fb_thumbnail_url,
        source_url: creative.file_url,
        creative: mapCreativeForClient({ ...creative, status: "ready" }),
        cached: true,
      })
    }

    // 3. Fetch missing data from Meta (video is ready, so thumbnail/source should be available)
    const [thumbnailUrl, sourceUrl] = await Promise.all([
      hasThumb ? Promise.resolve(creative.fb_thumbnail_url) : getVideoThumbnail(creative.fb_video_id, connection.access_token),
      hasPlayableSource ? Promise.resolve(creative.file_url) : getVideoSource(creative.fb_video_id, connection.access_token),
    ])

    // 4. Update DB if we got new info
    const update: CreativeUpdate = {}
    if (thumbnailUrl && !hasThumb) update.fb_thumbnail_url = thumbnailUrl
    if (sourceUrl && !hasPlayableSource) update.file_url = sourceUrl
    if (currentStatus === "ready" && creative.status !== "ready") update.status = "ready"

    if (Object.keys(update).length > 0) {
      await supabase
        .from("creatives")
        .update(update)
        .eq("id", id)
    }

    const nextCreative = mapCreativeForClient({
      ...creative,
      ...update,
      status: currentStatus
    })

    return NextResponse.json({
      thumbnail_url: nextCreative.fb_thumbnail_url,
      source_url: nextCreative.file_url,
      status: currentStatus,
      creative: nextCreative,
    })
  } catch (err) {
    console.error("[thumbnail-refresh] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to refresh thumbnail" },
      { status: 500 }
    )
  }
}
