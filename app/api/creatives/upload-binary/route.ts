import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { uploadImageToMeta, uploadVideoUrlToMeta } from "@/lib/facebook"
import { mapCreativeForClient } from "@/lib/creative-media"
import { notifyOrgMembers } from "@/lib/notify-org"
import { getOrgAdAccountInfo } from "@/app/api/facebook/_utils"
import { checkCreativeDup, getActorName } from "@/lib/upload-utils"

// Large media upload via raw binary body (avoids FormData parser limits).
// Client sends file as raw body, metadata via URL params + headers.
export const runtime = "nodejs"
export const maxDuration = 300 // Vercel Hobby plan max
export const dynamic = "force-dynamic"

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-")
}

async function uploadOriginalToStorage(params: {
  orgId: string
  fileName: string
  contentType: string
  buffer: ArrayBuffer
}) {
  const storagePath = `creatives/${params.orgId}/${crypto.randomUUID()}-${sanitizeFileName(params.fileName)}`
  const admin = createAdminClient()
  const { error } = await admin.storage.from("ad-media").upload(storagePath, params.buffer, {
    contentType: params.contentType,
    upsert: false,
    cacheControl: "31536000",
  })

  if (error) {
    throw new Error(error.message)
  }

  const { data } = admin.storage.from("ad-media").getPublicUrl(storagePath)
  return { storagePath, publicUrl: data.publicUrl }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp = request.nextUrl.searchParams
    const filename = sp.get("filename")
    const fileType = sp.get("type") || request.headers.get("content-type") || "application/octet-stream"
    const fileSize = parseInt(sp.get("size") || "0", 10)
    const adAccountIdParam = sp.get("ad_account_id") || sp.get("adAccountId")
    
    // Optional ad-text metadata
    const headline = sp.get("headline") || ""
    const primaryText = sp.get("primary_text") || ""
    const description = sp.get("description") || ""
    const linkUrl = sp.get("link_url") || ""
    const ctaParam = sp.get("cta") || "LEARN_MORE"

    if (!filename) return NextResponse.json({ error: "filename required (URL param)" }, { status: 400 })

    const isVideo = fileType.startsWith("video/")
    const isImage = fileType.startsWith("image/")
    if (!isVideo && !isImage) {
      return NextResponse.json({ error: `Unsupported file type: ${fileType}` }, { status: 400 })
    }

    // Dedup — same filename + size already in org? Return existing creative, skip Meta upload.
    if (fileSize > 0) {
      const dup = await checkCreativeDup(createAdminClient(), ctx.orgId, filename, fileSize, isVideo ? "video" : "image")
      if (dup) return NextResponse.json({ creative: mapCreativeForClient(dup), rateLimitPct: 0 })
    }

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const supabase = await createClient()
    let fbAdAccountId = adAccountIdParam

    if (!fbAdAccountId) {
      const { data: firstOrgAdAccount } = await supabase
        .from("ad_accounts")
        .select("fb_ad_account_id")
        .eq("org_id", ctx.orgId)
        .limit(1)
        .maybeSingle()

      if (!firstOrgAdAccount?.fb_ad_account_id) {
        return NextResponse.json({ error: "No ad account found" }, { status: 400 })
      }
      fbAdAccountId = firstOrgAdAccount.fb_ad_account_id
    } else {
      const account = await getOrgAdAccountInfo(ctx.orgId, fbAdAccountId, connection.access_token)
      if (!account) {
        return NextResponse.json({ error: `Ad account ${fbAdAccountId} not found` }, { status: 403 })
      }
      fbAdAccountId = account.id
    }

    const fileBuffer = await request.arrayBuffer()
    if (fileBuffer.byteLength === 0) {
      return NextResponse.json({ error: "Empty body" }, { status: 400 })
    }

    let fbImageHash: string | null = null
    let fbImageUrl: string | null = null
    let fbThumbnailUrl: string | null = null
    let fbVideoId: string | null = null
    let publicUrl = ""
    let storagePath: string | null = null

    let rateLimitPct = 0

    // Both images and videos go to Supabase Storage first for a stable public URL.
    // Images: Meta receives binary hash. Videos: Meta pulls from the public URL (1 API call, no chunking).
    const stored = await uploadOriginalToStorage({
      orgId: ctx.orgId,
      fileName: filename,
      contentType: fileType,
      buffer: fileBuffer,
    })
    publicUrl = stored.publicUrl
    storagePath = stored.storagePath

    if (isVideo) {
      try {
        const uploaded = await uploadVideoUrlToMeta(
          fbAdAccountId as string,
          connection.access_token,
          publicUrl,
          filename
        )
        fbVideoId = uploaded.videoId
        rateLimitPct = uploaded.rateLimitPct
      } catch (err: any) {
        console.error("Meta video URL upload error:", err)
        return NextResponse.json({ error: err?.message || "Meta Video Upload failed" }, { status: 500 })
      }
    } else {
      const uploadedImage = await uploadImageToMeta(fbAdAccountId as string, connection.access_token, fileBuffer, filename)
      fbImageHash = uploadedImage.hash
      fbImageUrl = uploadedImage.url
      fbThumbnailUrl = uploadedImage.url_128
      rateLimitPct = uploadedImage.rateLimitPct
    }

    const { data: creative, error: insertError } = await supabase
      .from("creatives")
      .insert({
        org_id: ctx.orgId,
        user_id: ctx.user.id,
        ad_account_id: fbAdAccountId,
        file_name: filename,
        file_url: publicUrl,
        storage_path: storagePath,
        media_type: isVideo ? "video" : "image",
        file_size: fileSize || fileBuffer.byteLength,
        headline,
        primary_text: primaryText,
        description,
        link_url: linkUrl,
        cta: ctaParam,
        fb_image_hash: fbImageHash,
        fb_image_url: fbImageUrl,
        fb_thumbnail_url: fbThumbnailUrl,
        fb_video_id: fbVideoId,
        status: isVideo ? "processing" : "ready",
      })
      .select()
      .single()

    if (insertError) {
      console.error("[upload-binary] DB insert error:", insertError)
      return NextResponse.json({ error: "Failed to save creative" }, { status: 500 })
    }

    await notifyOrgMembers({
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      actorName: getActorName(ctx.user),
      type: "asset_uploaded",
      title: `${getActorName(ctx.user)} uploaded "${filename}"`,
      link: "/assets",
    })

    return NextResponse.json({ creative: mapCreativeForClient(creative), rateLimitPct }, { status: 201 })
  } catch (err) {
    console.error("[upload-binary] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    )
  }
}
