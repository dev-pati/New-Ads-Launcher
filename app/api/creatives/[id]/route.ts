import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { mapCreativeForClient, parseStoragePath } from "@/lib/creative-media"
import { createAdminClient } from "@/lib/supabase/admin"
import { fireMediaUploadedTriggers } from "@/lib/media-trigger-checker"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("creatives")
      .select("*")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .single()

    if (error) return NextResponse.json({ error: "Creative not found" }, { status: 404 })
    return NextResponse.json({ creative: mapCreativeForClient(data) })
  } catch (err) {
    console.error("Failed to fetch creative:", err)
    return NextResponse.json({ error: "Failed to fetch creative" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const supabase = createAdminClient()

    const allowedFields = ["headline", "primary_text", "description", "cta", "link_url", "file_name", "status"]
    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field]
    }

    const { data, error } = await supabase
      .from("creatives")
      .update(updates)
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: "Failed to update creative" }, { status: 500 })

    // Fire on_approved trigger when status changes to "approved"
    if (updates.status === "approved" && data) {
      fireMediaUploadedTriggers(ctx.orgId, {
        id:       data.id,
        fileName: data.file_name,
        fileUrl:  data.file_url,
        mimeType: data.media_type === "video" ? "video/mp4" : "image/jpeg",
        thumbnailUrl: data.fb_thumbnail_url ?? undefined,
        status:   "approved",
        tags:     data.tags ?? [],
      }, "on_approved").catch(err => console.error("[creative update] on_approved trigger error:", err))
    }

    return NextResponse.json({ creative: mapCreativeForClient(data) })
  } catch (err) {
    console.error("Failed to update creative:", err)
    return NextResponse.json({ error: "Failed to update creative" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const supabase = createAdminClient()

    const { data: creative } = await supabase
      .from("creatives")
      .select("storage_path")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .single()

    if (creative?.storage_path) {
      const locator = parseStoragePath(creative.storage_path)

      if (locator.provider === "creative_media_r2") {
        if (locator.key.startsWith("creative-portal/approved/")) {
          // Portal approved media: unlink only, do not delete object
        } else if (locator.key.startsWith(`ads-launcher/${ctx.orgId}/`)) {
          // Ads-owned media: request delete through Portal API
          const portalApiBase = process.env.CREATIVE_MEDIA_API_ORIGIN || "https://creative.patigroup.com"
          const portalToken = process.env.ADS_MEDIA_API_TOKEN
          if (portalToken) {
             const res = await fetch(`${portalApiBase}/api/integrations/ads/v1/media/assets/${id}`, {
               method: "DELETE",
               headers: {
                 "Authorization": `Bearer ${portalToken}`,
                 "Content-Type": "application/json"
               },
               body: JSON.stringify({ orgId: ctx.orgId, actorId: ctx.user.id })
             })
             if (!res.ok) {
               console.error("Portal API delete failed:", res.status)
             }
          } else {
             console.warn("Portal API delete skipped: no token configured")
          }
        } else {
          // Out of scope or private prefixes: reject
          console.warn("Attempt to delete out-of-scope prefix:", locator.key)
          return NextResponse.json({ error: "Cannot delete this object" }, { status: 403 })
        }
      } else {
        // Legacy supabase delete
        await supabase.storage.from("ad-media").remove([creative.storage_path])
      }
    }

    await supabase.from("creatives").delete().eq("id", id).eq("org_id", ctx.orgId)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Failed to delete creative:", err)
    return NextResponse.json({ error: "Failed to delete creative" }, { status: 500 })
  }
}
