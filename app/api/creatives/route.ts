import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { uploadImageToMeta, uploadVideoToMeta } from "@/lib/facebook"

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("creatives")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Failed to fetch creatives:", error)
      return NextResponse.json({ error: "Failed to fetch creatives" }, { status: 500 })
    }

    return NextResponse.json({ creatives: data || [] })
  } catch (err) {
    console.error("Failed to fetch creatives:", err)
    return NextResponse.json({ error: "Failed to fetch creatives" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const contentType = request.headers.get("content-type") || ""

    // New flow: client uploaded directly to Meta, just save metadata
    if (contentType.includes("application/json")) {
      const body = await request.json()
      const supabase = await createClient()
      const { data: creative, error: insertError } = await supabase
        .from("creatives")
        .insert({
          org_id: ctx.orgId,
          user_id: ctx.user.id,
          file_name: body.file_name,
          file_url: body.fb_thumbnail_url || body.fb_image_url || "",
          media_type: body.media_type,
          file_size: body.file_size || 0,
          headline: body.headline || "",
          primary_text: body.primary_text || "",
          description: body.description || "",
          cta: body.cta || "LEARN_MORE",
          link_url: body.link_url || "",
          fb_image_hash: body.fb_image_hash || null,
          fb_image_url: body.fb_image_url || null,
          fb_thumbnail_url: body.fb_thumbnail_url || null,
          fb_video_id: body.fb_video_id || null,
        })
        .select()
        .single()

      if (insertError) {
        console.error("DB insert error:", insertError)
        return NextResponse.json({ error: "Failed to save creative" }, { status: 500 })
      }
      return NextResponse.json({ creative }, { status: 201 })
    }

    // Old flow: file uploaded through server (for duplicate row etc.)
    const formData = await request.formData()
    const file = formData.get("file") as File
    const headline = formData.get("headline") as string
    const primaryText = formData.get("primary_text") as string
    const description = formData.get("description") as string
    const cta = formData.get("cta") as string
    const linkUrl = formData.get("link_url") as string

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 })
    }

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) {
      return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })
    }

    const adAccountIdParam = formData.get("adAccountId") as string | null

    const supabase = await createClient()
    let fbAdAccountId = adAccountIdParam

    if (!fbAdAccountId) {
      const { data: adAccounts } = await supabase
        .from("ad_accounts")
        .select("id, fb_ad_account_id")
        .eq("org_id", ctx.orgId)
        .limit(1)

      if (!adAccounts || adAccounts.length === 0) {
        return NextResponse.json({ error: "No ad account found" }, { status: 400 })
      }
      fbAdAccountId = adAccounts[0].fb_ad_account_id
    }

    const isVideo = file.type.startsWith("video/")
    const mediaType = isVideo ? "video" : "image"
    const fileBuffer = await file.arrayBuffer()

    let fbImageHash: string | null = null
    let fbImageUrl: string | null = null
    let fbThumbnailUrl: string | null = null
    let fbVideoId: string | null = null

    if (mediaType === "image") {
      const result = await uploadImageToMeta(fbAdAccountId, connection.access_token, fileBuffer, file.name)
      fbImageHash = result.hash
      fbImageUrl = result.url
      fbThumbnailUrl = result.url_128
    } else {
      const result = await uploadVideoToMeta(fbAdAccountId, connection.access_token, fileBuffer, file.name)
      fbVideoId = result.videoId
    }

    const { data: creative, error: insertError } = await supabase
      .from("creatives")
      .insert({
        org_id: ctx.orgId,
        user_id: ctx.user.id,
        file_name: file.name,
        file_url: fbThumbnailUrl || fbImageUrl || "",
        media_type: mediaType,
        file_size: file.size,
        headline,
        primary_text: primaryText,
        description,
        cta: cta || "LEARN_MORE",
        link_url: linkUrl,
        fb_image_hash: fbImageHash,
        fb_image_url: fbImageUrl,
        fb_thumbnail_url: fbThumbnailUrl,
        fb_video_id: fbVideoId,
      })
      .select()
      .single()

    if (insertError) {
      console.error("DB insert error:", insertError)
      return NextResponse.json({ error: "Failed to save creative" }, { status: 500 })
    }

    return NextResponse.json({ creative }, { status: 201 })
  } catch (err: any) {
    console.error("Failed to create creative:", err)
    return NextResponse.json({ error: err.message || "Failed to create creative" }, { status: 500 })
  }
}
