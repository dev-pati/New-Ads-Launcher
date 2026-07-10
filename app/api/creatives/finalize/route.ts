import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { mapCreativeForClient } from "@/lib/creative-media"
import { notifyOrgMembers } from "@/lib/notify-org"
import { checkCreativeDup, getActorName } from "@/lib/upload-utils"
import { fireMediaUploadedTriggers }      from "@/lib/media-trigger-checker"

// Lightweight finalize endpoint — file is already in Supabase Storage (uploaded directly by client).
// Both image and video: dedup check → DB insert (status=pending) → background cron uploads to Meta later.
// No file body passes through here, so there is no Payload Too Large risk.
export const runtime = "nodejs"
export const maxDuration = 60
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

    const adminDb = createAdminClient()

    // Dedup for videos: check all existing records (including pending ones) by filename+size.
    // The generic checkCreativeDup only finds records with fb_video_id IS NOT NULL, missing pending.
    if (isVideo && fileSize > 0) {
      const { data: existingVideo } = await adminDb
        .from("creatives")
        .select("id, file_name, file_url, media_type, fb_image_url, fb_thumbnail_url, fb_image_hash, fb_video_id, status, ad_account_id, created_at")
        .eq("org_id", ctx.orgId)
        .eq("file_name", filename)
        .eq("file_size", fileSize)
        .eq("media_type", "video")
        .neq("status", "error")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (existingVideo) return NextResponse.json({ creative: mapCreativeForClient(existingVideo), rateLimitPct: 0 })
    }

    // Dedup for images: only if already uploaded to Meta
    if (isImage && fileSize > 0) {
      const dup = await checkCreativeDup(adminDb, ctx.orgId, filename, fileSize, "image")
      if (dup) return NextResponse.json({ creative: mapCreativeForClient(dup), rateLimitPct: 0 })
    }

    const supabase = createAdminClient()
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
        fb_image_hash: null,
        fb_image_url: null,
        fb_thumbnail_url: null,
        fb_video_id: null,
        // Both images and videos start as pending and get processed asynchronously via cron
        status: "pending",
      })
      .select()
      .single()

    if (insertError) {
      console.error("[finalize] DB insert error:", insertError)
      return NextResponse.json({ error: "Failed to save creative" }, { status: 500 })
    }

    // Fire-and-forget: trigger cron worker immediately so media uploads within seconds
    if (process.env.CRON_SECRET) {
      const appUrl = process.env.APP_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || process.env.NEXT_PUBLIC_APP_URL
        || ""
      if (appUrl) {
        fetch(`${appUrl}/api/cron/upload-to-facebook`, {
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        }).catch(() => {})
      }
    }

    // Fire media_uploaded automations (fire-and-forget, don't block response)
    fireMediaUploadedTriggers(ctx.orgId, {
      id:          creative.id,
      fileName:    creative.file_name,
      fileUrl:     creative.file_url,
      mimeType:    fileType,
      thumbnailUrl:creative.fb_thumbnail_url ?? undefined,
      status:      creative.status,
      tags:        creative.tags ?? [],
    }, "immediately").catch(err => console.error("[finalize] media trigger error:", err))

    const actorName = getActorName(ctx.user)
    await notifyOrgMembers({
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      actorName,
      type: "asset_uploaded",
      title: `${actorName} uploaded "${filename}"`,
      link: "/assets",
    })

    return NextResponse.json({ creative: mapCreativeForClient(creative), rateLimitPct: 0 }, { status: 201 })
  } catch (err) {
    console.error("[finalize] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload finalization failed" },
      { status: 500 }
    )
  }
}
