import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { extractThumbnailFromUrl } from "@/lib/ffmpeg-thumbnail"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120 // 2 minutes to allow for FFmpeg extraction

/**
 * Thumbnail warming for Portal-sourced creatives.
 *
 * Discovery used to live here too: this route copied `creative_portal.media_assets`
 * into `portal_media_items` so the Assets page could render them. That made the Portal
 * section only as fresh as the last cron run, and the crontab installation is
 * unverified (TD-05 / BL-23) — so nothing new ever appeared and the feature went unused.
 * Portal Media v2 reads the registry live in `GET /api/portal-media/tree`, and discovery
 * is deleted rather than scheduled.
 *
 * What remains is genuinely a background job: FFmpeg thumbnail extraction, which is too
 * slow for a request path. It still depends on the scheduler actually running — TD-32.
 */
async function cacheThumbnail(params: { id: string; orgId: string; fileUrl: string }) {
  const buffer = await extractThumbnailFromUrl(params.fileUrl)
  if (!buffer) return null

  const adsDb = createAdminClient()
  const storagePath = `thumbnails/${params.orgId}/${params.id}.jpg`
  const { error } = await adsDb.storage.from("ad-media").upload(storagePath, buffer, {
    contentType: "image/jpeg",
    upsert: true,
    cacheControl: "31536000",
  })
  if (error) throw error

  const { data } = adsDb.storage.from("ad-media").getPublicUrl(storagePath)
  await adsDb.from("creatives").update({ fb_thumbnail_url: data.publicUrl }).eq("id", params.id)
  return data.publicUrl
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const adsDb = createAdminClient()
  const thumbnailsWarmed: string[] = []
  const thumbnailErrors: { id: string; error: string }[] = []

  const { data: missingThumbs, error } = await adsDb
    .from("creatives")
    .select("id, org_id, file_url")
    .like("storage_path", "r2://pati-videos/%")
    .is("fb_thumbnail_url", null)
    .limit(5)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  for (const row of missingThumbs || []) {
    try {
      const url = await cacheThumbnail({ id: row.id, orgId: row.org_id, fileUrl: row.file_url })
      if (url) thumbnailsWarmed.push(row.id)
    } catch (err) {
      thumbnailErrors.push({ id: row.id, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({
    thumbnailsWarmed,
    thumbnailErrors: thumbnailErrors.length,
  })
}
