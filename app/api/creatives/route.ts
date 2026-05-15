import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { mapCreativeForClient } from "@/lib/creative-media"
import { createClient } from "@/lib/supabase/server"
import { uploadImageToMeta, uploadVideoToMeta, pollVideoReady } from "@/lib/facebook"
import { notifyOrgMembers } from "@/lib/notify-org"

// Large media uploads (videos can be 100MB+) — use Node runtime + extended timeout
export const runtime = "nodejs"
export const maxDuration = 300 // 5 minutes for big videos
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

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const adAccountId = url.searchParams.get("ad_account_id")
    const limit  = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 200)
    const cursor = url.searchParams.get("cursor") || null  // last item's created_at (ISO string)

    const supabase = await createClient()
    let query = supabase
      .from("creatives")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1)

    // Batch lookup by filenames (for CSV import) — org-scoped only, no account filter
    const fileNames = url.searchParams.getAll("file_name")
    if (fileNames.length > 0) {
      const db = createAdminClient()
      const { data, error } = await db
        .from("creatives")
        .select("id, file_name, file_url, media_type, headline, primary_text, cta, link_url, fb_image_url, fb_thumbnail_url, fb_image_hash, fb_video_id, status, ad_account_id")
        .eq("org_id", ctx.orgId)
        .in("file_name", fileNames)
        .order("created_at", { ascending: false })
      if (error) return NextResponse.json({ error: "Failed to fetch creatives" }, { status: 500 })
      return NextResponse.json({ creatives: (data ?? []).map(mapCreativeForClient) })
    }

    if (adAccountId) query = query.eq("ad_account_id", adAccountId)
    if (cursor)      query = query.lt("created_at", cursor)

    const { data, error } = await query

    if (error) {
      console.error("Failed to fetch creatives:", error)
      return NextResponse.json({ error: "Failed to fetch creatives" }, { status: 500 })
    }

    const hasMore  = (data?.length ?? 0) > limit
    const items    = (data ?? []).slice(0, limit)
    const nextCursor = hasMore ? (items[items.length - 1]?.created_at ?? null) : null

    return NextResponse.json({
      creatives:  items.map((creative) => mapCreativeForClient(creative)),
      hasMore,
      nextCursor,
    })
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

    // Case 1: Metadata update or JSON-based upload (already uploaded on client)
    if (contentType.includes("application/json")) {
      const body = await request.json()
      const supabase = await createClient()
      const { data: creative, error: insertError } = await supabase
        .from("creatives")
        .insert({
          org_id: ctx.orgId,
          user_id: ctx.user.id,
          ad_account_id: body.ad_account_id || null,
          file_name: body.file_name,
          file_url: body.fb_thumbnail_url || body.fb_image_url || "",
          media_type: body.media_type,
          file_size: body.file_size || 0,
          campaign_name: body.campaign_name || null,
          adset_name: body.adset_name || null,
          headline: body.headline || "",
          primary_text: body.primary_text || "",
          description: body.description || "",
          cta: body.cta || "LEARN_MORE",
          link_url: body.link_url || "",
          fb_image_hash: body.fb_image_hash || null,
          fb_image_url: body.fb_image_url || null,
          fb_thumbnail_url: body.fb_thumbnail_url || null,
          fb_video_id: body.fb_video_id || null,
          status: "ready",
        })
        .select()
        .single()

      if (insertError) {
        console.error("DB insert error:", insertError)
        return NextResponse.json({ error: "Failed to save creative metadata" }, { status: 500 })
      }

      return NextResponse.json({ creative: mapCreativeForClient(creative) }, { status: 201 })
    }

    // Case 2: Binary file upload through server
    const formData = await request.formData()
    const file = formData.get("file") as File
    const headline = formData.get("headline") as string
    const primaryText = formData.get("primary_text") as string
    const description = formData.get("description") as string
    const cta = formData.get("cta") as string
    const linkUrl = formData.get("link_url") as string
    const adAccountIdParam = formData.get("adAccountId") as string | null

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 })
    }

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) {
      return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })
    }

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

    if (!fbAdAccountId) {
      return NextResponse.json({ error: "Facebook Ad Account ID is missing" }, { status: 400 })
    }

    const isVideo = file.type.startsWith("video/")
    const mediaType = isVideo ? "video" : "image"
    const fileBuffer = await file.arrayBuffer()

    let fbImageHash: string | null = null
    let fbImageUrl: string | null = null
    let fbThumbnailUrl: string | null = null
    let fbVideoId: string | null = null
    let publicUrl = ""
    let storagePath: string | null = null

    if (mediaType === "video") {
      // Direct Meta Upload for Video (No intermediate storage)
      try {
        const uploadResult = await uploadVideoToMeta(fbAdAccountId, connection.access_token, fileBuffer, file.name)
        fbVideoId = uploadResult.videoId

      } catch (err: any) {
        console.error("Meta video upload error:", err)
        const msg = err?.message || "Meta Video Upload failed"
        if (msg.includes("permission") || msg.includes("OAuth")) {
          return NextResponse.json({ error: "Meta Permission Error: Please check your Ad Account access." }, { status: 403 })
        }
        return NextResponse.json({ error: msg }, { status: 500 })
      }
    } else {
      // Image Flow: Still using Supabase for reliable previews as Meta image URLs are volatile
      const storedOriginal = await uploadOriginalToStorage({
        orgId: ctx.orgId,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        buffer: fileBuffer,
      })
      publicUrl = storedOriginal.publicUrl
      storagePath = storedOriginal.storagePath

      const result = await uploadImageToMeta(fbAdAccountId, connection.access_token, fileBuffer, file.name)
      fbImageHash = result.hash
      fbImageUrl = result.url
      fbThumbnailUrl = result.url_128
    }

    const { data: creative, error: insertError } = await supabase
      .from("creatives")
      .insert({
        org_id: ctx.orgId,
        user_id: ctx.user.id,
        ad_account_id: fbAdAccountId || null,
        file_name: file.name,
        file_url: publicUrl,
        storage_path: storagePath,
        media_type: mediaType,
        file_size: file.size,
        headline: headline || "",
        primary_text: primaryText || "",
        description: description || "",
        cta: cta || "LEARN_MORE",
        link_url: linkUrl || "",
        fb_image_hash: fbImageHash,
        fb_image_url: fbImageUrl,
        fb_thumbnail_url: fbThumbnailUrl,
        fb_video_id: fbVideoId,
        status: isVideo ? "processing" : "ready",
      })
      .select()
      .single()

    if (insertError) {
      console.error("DB insert error:", insertError)
      return NextResponse.json({ error: "Failed to save creative" }, { status: 500 })
    }

    const actorName = ctx.user.user_metadata?.full_name || ctx.user.email?.split("@")[0] || "Someone"
    await notifyOrgMembers({
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      actorName,
      type: "asset_uploaded",
      title: `${actorName} uploaded "${file.name}"`,
      link: "/assets",
    })

    return NextResponse.json({ creative: mapCreativeForClient(creative) }, { status: 201 })
  } catch (err: unknown) {
    console.error("Failed to create creative:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create creative" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null)
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((value: unknown): value is string => typeof value === "string" && value.length > 0)
      : []

    if (ids.length === 0) {
      return NextResponse.json({ error: "ids are required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: creatives, error: fetchError } = await supabase
      .from("creatives")
      .select("id, storage_path")
      .eq("org_id", ctx.orgId)
      .in("id", ids)

    if (fetchError) {
      return NextResponse.json({ error: "Failed to load creatives" }, { status: 500 })
    }

    const foundIds = (creatives || []).map((creative) => creative.id)
    if (foundIds.length !== ids.length) {
      return NextResponse.json({ error: "Some selected assets were not found" }, { status: 404 })
    }

    const storagePaths = (creatives || [])
      .map((creative) => creative.storage_path)
      .filter((path): path is string => typeof path === "string" && path.length > 0)

    if (storagePaths.length > 0) {
      await supabase.storage.from("ad-media").remove(storagePaths)
    }

    const { error: deleteError } = await supabase
      .from("creatives")
      .delete()
      .eq("org_id", ctx.orgId)
      .in("id", ids)

    if (deleteError) {
      return NextResponse.json({ error: "Failed to delete creatives" }, { status: 500 })
    }

    return NextResponse.json({ success: true, deletedIds: ids })
  } catch (err) {
    console.error("Failed to bulk delete creatives:", err)
    return NextResponse.json({ error: "Failed to bulk delete creatives" }, { status: 500 })
  }
}
