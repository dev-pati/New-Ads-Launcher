import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { uploadImageToMeta, uploadVideoUrlToMeta } from "@/lib/facebook"
import { mapCreativeForClient } from "@/lib/creative-media"
import { notifyOrgMembers } from "@/lib/notify-org"
import { getOrgAdAccountInfo } from "@/app/api/facebook/_utils"
import { checkCreativeDup, getActorName } from "@/lib/upload-utils"

// Lightweight finalize endpoint — file is already in Supabase Storage (uploaded directly by client).
// This only does: dedup check → Meta API → DB insert → notify.
// No file body passes through here, so there is no Payload Too Large risk.
export const runtime = "nodejs"
export const maxDuration = 300
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const {
      storagePath,
      publicUrl,
      filename,
      fileType,
      fileSize,
      adAccountId: adAccountIdParam,
      headline = "",
      primary_text: primaryText = "",
      description = "",
      link_url: linkUrl = "",
      cta: ctaParam = "LEARN_MORE",
    } = body

    if (!storagePath || !publicUrl || !filename || !fileType) {
      return NextResponse.json(
        { error: "storagePath, publicUrl, filename, fileType are required" },
        { status: 400 }
      )
    }

    const isVideo = (fileType as string).startsWith("video/")
    const isImage = (fileType as string).startsWith("image/")
    if (!isVideo && !isImage) {
      return NextResponse.json({ error: `Unsupported file type: ${fileType}` }, { status: 400 })
    }

    // Dedup — same filename + size already processed in this org? Skip Meta re-upload.
    if (fileSize > 0) {
      const dup = await checkCreativeDup(
        createAdminClient(),
        ctx.orgId,
        filename,
        fileSize,
        isVideo ? "video" : "image"
      )
      if (dup) return NextResponse.json({ creative: mapCreativeForClient(dup), rateLimitPct: 0 })
    }

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const supabase = await createClient()
    let fbAdAccountId: string = adAccountIdParam || ""

    if (!fbAdAccountId) {
      const { data: firstAccount } = await supabase
        .from("ad_accounts")
        .select("fb_ad_account_id")
        .eq("org_id", ctx.orgId)
        .limit(1)
        .maybeSingle()

      if (!firstAccount?.fb_ad_account_id) {
        return NextResponse.json({ error: "No ad account found" }, { status: 400 })
      }
      fbAdAccountId = firstAccount.fb_ad_account_id
    } else {
      const account = await getOrgAdAccountInfo(ctx.orgId, fbAdAccountId, connection.access_token)
      if (!account) {
        return NextResponse.json({ error: `Ad account ${fbAdAccountId} not found` }, { status: 403 })
      }
      fbAdAccountId = account.id
    }

    let fbImageHash: string | null = null
    let fbImageUrl: string | null = null
    let fbThumbnailUrl: string | null = null
    let fbVideoId: string | null = null
    let rateLimitPct = 0

    if (isVideo) {
      // Video: Meta pulls the file from Supabase public URL — no binary transfer needed.
      const uploaded = await uploadVideoUrlToMeta(
        fbAdAccountId,
        connection.access_token,
        publicUrl,
        filename
      )
      fbVideoId = uploaded.videoId
      rateLimitPct = uploaded.rateLimitPct
    } else {
      // Image: Meta requires binary (base64 hash). Download from Supabase server-side.
      // The image is already public so this is a cheap server-to-server fetch (typically < 5MB).
      const imgRes = await fetch(publicUrl)
      if (!imgRes.ok) {
        return NextResponse.json(
          { error: `Failed to fetch uploaded image from storage (${imgRes.status})` },
          { status: 500 }
        )
      }
      const imgBuffer = await imgRes.arrayBuffer()
      const uploadedImage = await uploadImageToMeta(
        fbAdAccountId,
        connection.access_token,
        imgBuffer,
        filename
      )
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
        file_size: fileSize || 0,
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
      console.error("[finalize] DB insert error:", insertError)
      return NextResponse.json({ error: "Failed to save creative" }, { status: 500 })
    }

    const actorName = getActorName(ctx.user)
    await notifyOrgMembers({
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      actorName,
      type: "asset_uploaded",
      title: `${actorName} uploaded "${filename}"`,
      link: "/assets",
    })

    return NextResponse.json({ creative: mapCreativeForClient(creative), rateLimitPct }, { status: 201 })
  } catch (err) {
    console.error("[finalize] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload finalization failed" },
      { status: 500 }
    )
  }
}
