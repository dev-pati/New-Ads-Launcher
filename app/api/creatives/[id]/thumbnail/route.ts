import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { mapCreativeForClient } from "@/lib/creative-media"
import { createClient } from "@/lib/supabase/server"
import { getVideoThumbnail, getVideoSource } from "@/lib/facebook"

interface ThumbnailUpdate {
  fb_thumbnail_url?: string
  file_url?: string
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
      .select("id, media_type, storage_path, fb_video_id, fb_thumbnail_url, fb_image_url, file_url")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .single()

    if (!creative) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (!creative.fb_video_id) return NextResponse.json({ error: "Not a video creative" }, { status: 400 })

    // Check what's missing — only call Meta for what we don't already have
    const hasThumb =
      !!creative.fb_thumbnail_url &&
      /^https?:/.test(creative.fb_thumbnail_url) &&
      !creative.fb_thumbnail_url.includes("rsrc.php")
    const hasPlayableSource = !!(creative.file_url && /^https?:/.test(creative.file_url) && /(\.mp4|\.mov|\.webm|fbcdn\.net)/.test(creative.file_url))
    const clientCreative = mapCreativeForClient(creative)
    const hasDeferredThumbnailRoute =
      !!clientCreative.fb_thumbnail_url &&
      clientCreative.fb_thumbnail_url.startsWith("/api/creatives/")

    if (!hasThumb && hasDeferredThumbnailRoute) {
      return NextResponse.json({
        thumbnail_url: clientCreative.fb_thumbnail_url,
        source_url: clientCreative.file_url,
        creative: clientCreative,
        deferred: true,
      })
    }

    if (hasThumb && hasPlayableSource) {
      return NextResponse.json({
        thumbnail_url: clientCreative.fb_thumbnail_url,
        source_url: clientCreative.file_url,
        creative: clientCreative,
        cached: true,
      })
    }

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    // Fetch only what's missing
    const [thumbnailUrl, sourceUrl] = await Promise.all([
      hasThumb ? Promise.resolve(creative.fb_thumbnail_url) : getVideoThumbnail(creative.fb_video_id, connection.access_token),
      hasPlayableSource ? Promise.resolve(creative.file_url) : getVideoSource(creative.fb_video_id, connection.access_token),
    ])

    if (!thumbnailUrl && !sourceUrl) {
      return NextResponse.json({
        thumbnail_url: null,
        creative: mapCreativeForClient(creative)
      })
    }

    const update: ThumbnailUpdate = {}
    if (thumbnailUrl && !hasThumb) update.fb_thumbnail_url = thumbnailUrl
    // Only update file_url if we just fetched a NEW source AND DB didn't already have a playable one
    if (sourceUrl && !hasPlayableSource) update.file_url = sourceUrl

    if (Object.keys(update).length > 0) {
      await supabase
        .from("creatives")
        .update(update)
        .eq("id", id)
    }

    const nextCreative = mapCreativeForClient({
      ...creative,
      ...update,
    })

    return NextResponse.json({
      thumbnail_url: nextCreative.fb_thumbnail_url,
      source_url: nextCreative.file_url,
      creative: nextCreative,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to refresh thumbnail" },
      { status: 500 }
    )
  }
}
