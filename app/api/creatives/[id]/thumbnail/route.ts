import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { mapCreativeForClient } from "@/lib/creative-media"
import { createAdminClient } from "@/lib/supabase/admin"
import { getVideoReadyData } from "@/lib/facebook"

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

    const supabase = createAdminClient()
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

    // Return early if we already have everything cached in DB
    const hasThumb =
      !!creative.fb_thumbnail_url &&
      /^https?:/.test(creative.fb_thumbnail_url) &&
      !creative.fb_thumbnail_url.includes("rsrc.php")
    const hasPlayableSource = !!(creative.file_url && /^https?:/.test(creative.file_url) && /(\.mp4|\.mov|\.webm|fbcdn\.net)/.test(creative.file_url))

    if (hasThumb && hasPlayableSource && creative.status === "ready") {
      return NextResponse.json({
        thumbnail_url: creative.fb_thumbnail_url,
        source_url: creative.file_url,
        creative: mapCreativeForClient(creative),
        cached: true,
      })
    }

    // Single Meta API call: status + thumbnails + source (replaces 3 separate calls)
    const videoData = await getVideoReadyData(creative.fb_video_id, connection.access_token)

    if (videoData.status === "error") {
      await supabase.from("creatives").update({ status: "error" }).eq("id", id)
      return NextResponse.json({
        error: videoData.errorMsg || "Video processing failed on Meta",
        status: "error",
        creative: mapCreativeForClient({ ...creative, status: "error" }),
      })
    }

    if (!videoData.ready) {
      return NextResponse.json({ status: videoData.status, creative: mapCreativeForClient(creative) })
    }

    const [thumbnailUrl, sourceUrl] = [
      hasThumb ? creative.fb_thumbnail_url : videoData.thumbnailUrl,
      hasPlayableSource ? creative.file_url : videoData.sourceUrl,
    ]
    let currentStatus = "ready"

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

    // Return raw URLs (not proxy-mapped) so the client's <img> src actually changes.
    // mapCreativeForClient converts fbcdn.net → proxy URL; if the client already holds
    // the same proxy URL in state, React skips the DOM update and the image never loads.
    return NextResponse.json({
      thumbnail_url: thumbnailUrl || null,
      source_url: sourceUrl || null,
      status: currentStatus,
      creative: { ...nextCreative, fb_thumbnail_url: thumbnailUrl || nextCreative.fb_thumbnail_url },
    })
  } catch (err) {
    console.error("[thumbnail-refresh] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to refresh thumbnail" },
      { status: 500 }
    )
  }
}
