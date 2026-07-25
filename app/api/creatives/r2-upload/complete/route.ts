import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { completeR2Upload } from "@/lib/r2-upload-client"
import { createAdminClient } from "@/lib/supabase/admin"
import { mapCreativeForClient } from "@/lib/creative-media"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
    const { assetId, parts, adAccountId, headline, primaryText, description, cta, linkUrl } = body as {
      assetId?: string
      parts?: { partNumber: number; etag: string }[]
      adAccountId?: string
      headline?: string
      primaryText?: string
      description?: string
      cta?: string
      linkUrl?: string
    }

    if (typeof assetId !== "string" || !assetId.trim()) {
      return NextResponse.json({ error: "assetId is required" }, { status: 400 })
    }
    if (parts !== undefined && !Array.isArray(parts)) {
      return NextResponse.json({ error: "parts must be an array" }, { status: 400 })
    }

    // Complete direct upload through Portal R2 broker
    const complete = await completeR2Upload(assetId, ctx.orgId, ctx.user.id, parts)
    const descriptor = complete.descriptor
    if (!descriptor || !descriptor.fileUrl || !descriptor.storagePath) {
      return NextResponse.json({ error: "Failed to obtain file descriptor" }, { status: 500 })
    }

    const supabase = createAdminClient()

    // Query default ad account if missing, matching creatives/route.ts POST logic
    let fbAdAccountId = adAccountId
    if (!fbAdAccountId) {
      const { data: adAccounts } = await supabase
        .from("ad_accounts")
        .select("fb_ad_account_id")
        .eq("org_id", ctx.orgId)
        .limit(1)

      if (adAccounts && adAccounts.length > 0) {
        fbAdAccountId = adAccounts[0].fb_ad_account_id
      }
    }

    // Write row to creatives table - zero local byte copy.
    const { data: creative, error: insertError } = await supabase
      .from("creatives")
      .insert({
        org_id: ctx.orgId,
        user_id: ctx.user.id,
        ad_account_id: fbAdAccountId || null,
        file_name: descriptor.fileName || "unnamed_media",
        file_url: descriptor.fileUrl,
        storage_path: descriptor.storagePath,
        media_type: descriptor.mediaType || (descriptor.mimeType?.startsWith("image/") ? "image" : "video"),
        file_size: descriptor.sizeBytes || 0,
        status: "ready",
        headline: headline || "",
        primary_text: primaryText || "",
        description: description || "",
        cta: cta || "LEARN_MORE",
        link_url: linkUrl || "",
      })
      .select()
      .single()

    if (insertError) {
      console.error("[creatives/r2-upload/complete] db insert error:", insertError)
      return NextResponse.json({ error: "Database error during finalization" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      creative: mapCreativeForClient(creative),
    }, { status: 201 })
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status
    const message = err instanceof Error ? err.message : "Failed to complete upload"
    return NextResponse.json({ error: message }, { status: status || 500 })
  }
}
