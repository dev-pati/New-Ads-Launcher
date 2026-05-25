import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getVideoSource, getVideoThumbnail } from "@/lib/facebook"
import { isMetaCdnUrl } from "@/lib/creative-media"
import { extractThumbnailFromUrl } from "@/lib/ffmpeg-thumbnail"

export const runtime = "nodejs"
export const maxDuration = 120
export const dynamic = "force-dynamic"

interface StoredCreative {
  id: string
  org_id: string
  file_name: string
  file_url: string
  storage_path: string | null
  media_type: "image" | "video"
  ad_account_id: string | null
  fb_image_hash: string | null
  fb_image_url: string | null
  fb_thumbnail_url: string | null
  fb_video_id: string | null
}

function noStoreRedirect(url: string) {
  const response = NextResponse.redirect(url, 307)
  response.headers.set("Cache-Control", "no-store")
  return response
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-")
}

function extensionFromContentType(contentType?: string | null, fallback = "bin") {
  if (!contentType) return fallback
  if (contentType.includes("jpeg")) return "jpg"
  if (contentType.includes("png")) return "png"
  if (contentType.includes("webp")) return "webp"
  if (contentType.includes("gif")) return "gif"
  if (contentType.includes("mp4")) return "mp4"
  if (contentType.includes("quicktime")) return "mov"
  if (contentType.includes("webm")) return "webm"
  return fallback
}

function stablePublicUrl(url?: string | null) {
  if (!url || !/^https?:/i.test(url)) return null
  if (isMetaCdnUrl(url)) return null
  return url
}

async function cacheBufferAsAsset(params: {
  buffer: Buffer
  contentType: string
  storagePath: string
}): Promise<{ publicUrl: string }> {
  const admin = createAdminClient()
  const { error } = await admin.storage.from("ad-media").upload(params.storagePath, params.buffer, {
    contentType: params.contentType,
    upsert: true,
    cacheControl: "31536000",
  })
  if (error) throw new Error(error.message)
  const { data } = admin.storage.from("ad-media").getPublicUrl(params.storagePath)
  return { publicUrl: data.publicUrl }
}

async function cacheRemoteAsset(params: {
  remoteUrl: string
  storageBasePath: string
  fallbackName: string
}) {
  const response = await fetch(params.remoteUrl, { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Failed to fetch remote media: ${response.status}`)
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream"
  const ext = extensionFromContentType(contentType, params.fallbackName.split(".").pop() || "bin")
  const storagePath = `${params.storageBasePath}.${ext}`
  const buffer = await response.arrayBuffer()

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from("ad-media")
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
      cacheControl: "31536000",
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data } = admin.storage.from("ad-media").getPublicUrl(storagePath)
  return { publicUrl: data.publicUrl, storagePath }
}

async function getMetaImageUrls(adAccountId: string, accessToken: string, imageHash: string) {
  const normalizedId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
  const fields = encodeURIComponent("hash,url,url_128,name")
  const hashes = encodeURIComponent(JSON.stringify([imageHash]))
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${normalizedId}/adimages?fields=${fields}&hashes=${hashes}&access_token=${encodeURIComponent(accessToken)}`,
    { cache: "no-store" }
  )

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error?.message || "Failed to refresh image from Meta")
  }

  const fromList = Array.isArray(data?.data)
    ? data.data.find((item: { hash?: string }) => item.hash === imageHash) || data.data[0]
    : null

  const fromMap = data?.images?.[imageHash]
    || (data?.images ? Object.values(data.images)[0] as { url?: string; url_128?: string } : null)

  const image = fromList || fromMap

  return {
    url: image?.url || "",
    thumbnailUrl: image?.url_128 || image?.url || "",
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const variant = request.nextUrl.searchParams.get("variant")

    const supabase = await createClient()
    const admin = createAdminClient()
    const { data, error } = await supabase
      .from("creatives")
      .select("id, org_id, file_name, file_url, storage_path, media_type, ad_account_id, fb_image_hash, fb_image_url, fb_thumbnail_url, fb_video_id")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Creative not found" }, { status: 404 })
    }

    const creative = data as StoredCreative

    if (creative.media_type === "image") {
      const preferredStableUrl =
        stablePublicUrl(creative.file_url)
        || stablePublicUrl(creative.fb_image_url)
        || stablePublicUrl(creative.fb_thumbnail_url)

      if (preferredStableUrl) return noStoreRedirect(preferredStableUrl)

      if (!creative.ad_account_id || !creative.fb_image_hash) {
        return NextResponse.json({ error: "Image source is unavailable" }, { status: 404 })
      }

      const connection = await getFacebookConnection(ctx.orgId)
      if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

      const image = await getMetaImageUrls(creative.ad_account_id, connection.access_token, creative.fb_image_hash)
      const sourceUrl = image.url || image.thumbnailUrl
      if (!sourceUrl) {
        return NextResponse.json({ error: "Image source is unavailable" }, { status: 404 })
      }

      try {
        const cached = await cacheRemoteAsset({
          remoteUrl: sourceUrl,
          storageBasePath: `creatives/${ctx.orgId}/${creative.id}/${sanitizeFileName(creative.file_name).replace(/\.[^.]+$/, "") || "image"}`,
          fallbackName: creative.file_name,
        })

        await admin
          .from("creatives")
          .update({
            file_url: cached.publicUrl,
            storage_path: cached.storagePath,
            fb_image_url: cached.publicUrl,
            fb_thumbnail_url: cached.publicUrl,
          })
          .eq("id", creative.id)
          .eq("org_id", ctx.orgId)

        return noStoreRedirect(cached.publicUrl)
      } catch {
        await admin
          .from("creatives")
          .update({
            fb_image_url: image.url || sourceUrl,
            fb_thumbnail_url: image.thumbnailUrl || sourceUrl,
          })
          .eq("id", creative.id)
          .eq("org_id", ctx.orgId)

        return noStoreRedirect(sourceUrl)
      }
    }

    if (variant === "thumbnail") {
      const stableThumbnailUrl = stablePublicUrl(creative.fb_thumbnail_url)
      if (stableThumbnailUrl) return noStoreRedirect(stableThumbnailUrl)

      // Try FFmpeg extraction from Supabase storage — zero Meta API calls.
      // Falls back to Meta API only if FFmpeg is unavailable or fails.
      if (creative.storage_path) {
        const videoPublicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ad-media/${creative.storage_path}`
        const thumbBuffer = await extractThumbnailFromUrl(videoPublicUrl)
        if (thumbBuffer) {
          const storagePath = `thumbnails/${ctx.orgId}/${creative.id}.jpg`
          try {
            const cached = await cacheBufferAsAsset({
              buffer: thumbBuffer,
              contentType: "image/jpeg",
              storagePath,
            })
            await admin
              .from("creatives")
              .update({ fb_thumbnail_url: cached.publicUrl })
              .eq("id", creative.id)
              .eq("org_id", ctx.orgId)
            return noStoreRedirect(cached.publicUrl)
          } catch {
            // Cache failed — return the JPEG directly without redirect
            return new NextResponse(thumbBuffer.buffer as ArrayBuffer, {
              headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" },
            })
          }
        }
      }

      // Fallback: fetch thumbnail from Meta API
      if (!creative.fb_video_id) {
        return NextResponse.json({ error: "Video thumbnail is unavailable" }, { status: 404 })
      }

      const connection = await getFacebookConnection(ctx.orgId)
      if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

      const thumbnailUrl = await getVideoThumbnail(creative.fb_video_id, connection.access_token)
      if (!thumbnailUrl) {
        return NextResponse.json({ error: "Video thumbnail is unavailable" }, { status: 404 })
      }

      try {
        const cached = await cacheRemoteAsset({
          remoteUrl: thumbnailUrl,
          storageBasePath: `thumbnails/${ctx.orgId}/${creative.id}`,
          fallbackName: "thumbnail.jpg",
        })

        await admin
          .from("creatives")
          .update({ fb_thumbnail_url: cached.publicUrl })
          .eq("id", creative.id)
          .eq("org_id", ctx.orgId)

        return noStoreRedirect(cached.publicUrl)
      } catch {
        await admin
          .from("creatives")
          .update({ fb_thumbnail_url: thumbnailUrl })
          .eq("id", creative.id)
          .eq("org_id", ctx.orgId)

        return noStoreRedirect(thumbnailUrl)
      }
    }

    const stableSourceUrl = stablePublicUrl(creative.file_url)
    if (stableSourceUrl) return noStoreRedirect(stableSourceUrl)

    if (!creative.fb_video_id) {
      return NextResponse.json({ error: "Video source is unavailable" }, { status: 404 })
    }

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const sourceUrl = await getVideoSource(creative.fb_video_id, connection.access_token)
    if (!sourceUrl) {
      return NextResponse.json({ error: "Video source is unavailable" }, { status: 404 })
    }

    await admin
      .from("creatives")
      .update({ file_url: sourceUrl })
      .eq("id", creative.id)
      .eq("org_id", ctx.orgId)

    return noStoreRedirect(sourceUrl)
  } catch (error) {
    console.error("[creative-media] error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve creative media" },
      { status: 500 }
    )
  }
}
