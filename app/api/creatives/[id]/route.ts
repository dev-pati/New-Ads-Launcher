import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { mapCreativeForClient, type ClientCreativeMedia } from "@/lib/creative-media"
import { createAdminClient } from "@/lib/supabase/admin"
import { fireMediaUploadedTriggers } from "@/lib/media-trigger-checker"
import { deleteMediaObject } from "@/lib/media-delete"
import { emitAndLog } from "@/lib/notifications/emit"
import { conflictResponse, readExpectedVersion, updateWithVersion } from "@/lib/optimistic-update"
import { getActorName } from "@/lib/upload-utils"

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

    const expectedVersion = readExpectedVersion(body)
    if (expectedVersion === "invalid") {
      return NextResponse.json({ error: "Invalid expected_version" }, { status: 400 })
    }

    // Creative copy is edited by two people at once more often than anything else here
    // — one writing headlines, one fixing the link — and the loser used to lose silently.
    const outcome = await updateWithVersion<ClientCreativeMedia & Record<string, any>>({
      db: supabase,
      table: "creatives",
      id,
      orgId: ctx.orgId,
      expectedVersion,
      updates,
      actorId: ctx.user.id,
      baseline: body.baseline ?? null,
      resolveActorName: async userId => {
        if (!userId) return null
        const { data: account } = await supabase
          .from("accounts")
          .select("full_name, email")
          .eq("id", userId)
          .maybeSingle()
        return account?.full_name || account?.email?.split("@")[0] || null
      },
    })

    if (outcome.ok === false) {
      if (outcome.kind === "not_found") {
        return NextResponse.json({ error: "Creative not found" }, { status: 404 })
      }
      if (outcome.kind === "conflict") return conflictResponse(outcome.conflict)
      return NextResponse.json({ error: "Failed to update creative" }, { status: 500 })
    }

    const data = outcome.row

    if (outcome.changes.length > 0) {
      void emitAndLog("creatives.update", {
        orgId: ctx.orgId,
        actorId: ctx.user.id,
        actorName: getActorName(ctx.user),
        type: "creative.updated",
        action: "updated",
        objectType: "creative",
        objectId: id,
        objectName: data.file_name || null,
        changes: outcome.changes,
        link: "/assets",
        // Editing the same creative twice is two events, not one.
        dedupeKey: `creative.updated:${id}:${Date.now()}`,
        source: "creatives.update",
      })
    }

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
      .select("storage_path, fb_video_id, fb_image_hash")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .single()

    const isPortalSourced = creative?.storage_path?.startsWith("r2://pati-videos/creative-portal/")
    if (isPortalSourced && (creative?.fb_video_id || creative?.fb_image_hash)) {
      return NextResponse.json(
        { error: "Asset already uploaded to Meta. Remove it from Meta before deleting." },
        { status: 409 }
      )
    }

    if (creative?.storage_path) {
      const deleted = await deleteMediaObject(creative.storage_path, ctx.orgId, ctx.user.id, supabase)
      if (!deleted.ok) {
        return NextResponse.json({ error: deleted.reason || "Failed to delete media object" }, { status: 502 })
      }
    }

    // Order B: reset the Portal tracking row before deleting the creative so
    // partial failure self-heals via the storage_path dedup check in claim.ts.
    if (isPortalSourced) {
      await supabase
        .from("portal_media_items")
        .update({ org_id: null, ad_account_id: null, mapped_by: null, creative_id: null, status: "pending", updated_at: new Date().toISOString() })
        .eq("creative_id", id)
    }

    await supabase.from("creatives").delete().eq("id", id).eq("org_id", ctx.orgId)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Failed to delete creative:", err)
    return NextResponse.json({ error: "Failed to delete creative" }, { status: 500 })
  }
}
