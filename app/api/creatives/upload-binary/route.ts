import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { uploadImageToMeta, uploadVideoToMeta } from "@/lib/facebook"
import { notifyOrgMembers } from "@/lib/notify-org"

// Large media upload via raw binary body (avoids FormData parser limits).
// Client sends file as raw body, metadata via URL params + headers.
export const runtime = "nodejs"
export const maxDuration = 300 // Vercel Hobby plan max
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp = request.nextUrl.searchParams
    const filename = sp.get("filename")
    const fileType = sp.get("type") || request.headers.get("content-type") || "application/octet-stream"
    const fileSize = parseInt(sp.get("size") || "0", 10)
    const adAccountIdParam = sp.get("ad_account_id") || sp.get("adAccountId")
    // Optional ad-text metadata sent from launch flow — saved with creative for reuse
    const headline = sp.get("headline") || null
    const primaryText = sp.get("primary_text") || null
    const description = sp.get("description") || null
    const linkUrl = sp.get("link_url") || null
    const ctaParam = sp.get("cta") || "LEARN_MORE"

    if (!filename) return NextResponse.json({ error: "filename required (URL param)" }, { status: 400 })

    // File type whitelist
    const isVideo = fileType.startsWith("video/")
    const isImage = fileType.startsWith("image/")
    if (!isVideo && !isImage) {
      return NextResponse.json({ error: `Unsupported file type: ${fileType}. Only image/* and video/* allowed.` }, { status: 400 })
    }

    // Size guard from header (avoid wasting bandwidth before we even read body)
    const MAX_SIZE = isVideo ? 1024 * 1024 * 1024 : 30 * 1024 * 1024 // 1GB video, 30MB image (Meta limits)
    if (fileSize && fileSize > MAX_SIZE) {
      return NextResponse.json({
        error: `File too large: ${(fileSize / 1024 / 1024).toFixed(1)}MB. Max ${isVideo ? "1GB for video" : "30MB for image"}.`
      }, { status: 413 })
    }

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const supabase = await createClient()
    let fbAdAccountId = adAccountIdParam

    // Always fetch org's ad accounts for either validation or fallback
    const { data: orgAdAccounts } = await supabase
      .from("ad_accounts")
      .select("fb_ad_account_id")
      .eq("org_id", ctx.orgId)
    const allowedIds = (orgAdAccounts || []).map((a: any) => a.fb_ad_account_id)

    if (!fbAdAccountId) {
      if (allowedIds.length === 0) return NextResponse.json({ error: "No ad account found in workspace" }, { status: 400 })
      fbAdAccountId = allowedIds[0]
    } else {
      // Security: validate the requested ad account belongs to this org (normalize act_ prefix)
      const norm = (id: string) => id.startsWith("act_") ? id.slice(4) : id
      if (!allowedIds.map(norm).includes(norm(fbAdAccountId))) {
        return NextResponse.json({ error: `Ad account ${fbAdAccountId} not in your workspace` }, { status: 403 })
      }
    }

    const mediaType: "image" | "video" = isVideo ? "video" : "image"

    // Read raw body as ArrayBuffer (no FormData parsing)
    const fileBuffer = await request.arrayBuffer()
    if (fileBuffer.byteLength === 0) {
      return NextResponse.json({ error: "Empty body" }, { status: 400 })
    }
    // Re-check actual size (header could be wrong/missing)
    if (fileBuffer.byteLength > MAX_SIZE) {
      return NextResponse.json({
        error: `File too large: ${(fileBuffer.byteLength / 1024 / 1024).toFixed(1)}MB. Max ${isVideo ? "1GB for video" : "30MB for image"}.`
      }, { status: 413 })
    }

    let fbImageHash: string | null = null
    let fbImageUrl: string | null = null
    let fbThumbnailUrl: string | null = null
    let fbVideoId: string | null = null

    if (mediaType === "image") {
      const r = await uploadImageToMeta(fbAdAccountId!, connection.access_token, fileBuffer, filename)
      fbImageHash = r.hash
      fbImageUrl = r.url
      fbThumbnailUrl = r.url_128
    } else {
      const r = await uploadVideoToMeta(fbAdAccountId!, connection.access_token, fileBuffer, filename)
      fbVideoId = r.videoId
    }

    const { data: creative, error: insertError } = await supabase
      .from("creatives")
      .insert({
        org_id: ctx.orgId,
        user_id: ctx.user.id,
        ad_account_id: fbAdAccountId,
        file_name: filename,
        file_url: fbThumbnailUrl || fbImageUrl || "",
        media_type: mediaType,
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
      })
      .select()
      .single()

    if (insertError) {
      console.error("[upload-binary] DB insert error:", insertError)
      return NextResponse.json({ error: "Failed to save creative" }, { status: 500 })
    }

    const actorName = ctx.user.user_metadata?.full_name || ctx.user.email?.split("@")[0] || "Someone"
    notifyOrgMembers({
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      actorName,
      type: "asset_uploaded",
      title: `${actorName} uploaded "${filename}"`,
      body: mediaType === "video" ? "Video" : "Image",
      link: "/assets",
    }).catch(() => {})

    return NextResponse.json({ creative }, { status: 201 })
  } catch (err: any) {
    console.error("[upload-binary] error:", err)
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 })
  }
}
