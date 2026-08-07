import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAdDetail } from "@/lib/facebook"
import { emitAndLog } from "@/lib/notifications/emit"
import { adAccountBelongsToOrg, normalizeAdAccountId } from "../../facebook/_utils"

// "Save as Template" from Ads Manager: read a live ad's copy + media + metrics
// and store it as a reusable template.
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { ad_id, ad_account_id, name, tags, date_preset } = body

    if (!ad_id) return NextResponse.json({ error: "ad_id is required" }, { status: 400 })
    if (!ad_account_id) return NextResponse.json({ error: "ad_account_id is required" }, { status: 400 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    if (!(await adAccountBelongsToOrg(ctx.orgId, ad_account_id, connection.access_token))) {
      return NextResponse.json({ error: `Ad account ${ad_account_id} not in your workspace` }, { status: 403 })
    }

    const ad = await getAdDetail(ad_id, connection.access_token, { datePreset: date_preset || "last_30d" })

    if (ad.account_id && normalizeAdAccountId(ad.account_id) !== normalizeAdAccountId(ad_account_id)) {
      return NextResponse.json({ error: "Ad does not belong to this ad account" }, { status: 403 })
    }

    const db = createAdminClient()

    // A template can only preselect media that exists in our own creatives table —
    // Meta's image_hash / video_id are the join keys. When the winning ad's media
    // was never uploaded through AdLauncher there is no row to point at, so the
    // template is copy-only and the Launch page will ask for media (needs_media).
    let creativeIds: string[] = []
    if (ad.image_hash || ad.video_id) {
      const filters: string[] = []
      if (ad.image_hash) filters.push(`fb_image_hash.eq.${ad.image_hash}`)
      if (ad.video_id) filters.push(`fb_video_id.eq.${ad.video_id}`)

      const { data: matched } = await db
        .from("creatives")
        .select("id")
        .eq("org_id", ctx.orgId)
        .eq("ad_account_id", ad_account_id)
        .or(filters.join(","))
        .limit(10)

      creativeIds = (matched || []).map((c: any) => c.id)
    }

    const media = {
      creative_ids: creativeIds,
      media_type: ad.media_type,
      thumb_url: ad.thumb_url || null,
      image_hash: ad.image_hash || null,
      video_id: ad.video_id || null,
      needs_media: creativeIds.length === 0,
    }

    const metrics = {
      spend: ad.spend,
      roas: ad.roas,
      results: ad.results,
      impressions: ad.impressions,
      date_preset: date_preset || "last_30d",
      captured_at: new Date().toISOString(),
    }

    const templateName = (name?.trim() || ad.name || "Untitled template").slice(0, 200)

    const { data, error } = await db
      .from("ad_copy_templates")
      .insert({
        org_id: ctx.orgId,
        user_id: ctx.user.id,
        ad_account_id,
        name: templateName,
        primary_text: ad.primaryText || null,
        headline: ad.headline || null,
        description: ad.description || null,
        link: ad.link || null,
        cta: ad.cta || "SHOP_NOW",
        tags: Array.isArray(tags) ? tags : [],
        media,
        metrics,
        source_ad_id: ad.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const actorName = ctx.user.user_metadata?.full_name || ctx.user.email?.split("@")[0] || "Someone"
    await emitAndLog("templates.from-ad", {
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      actorName,
      type: "template.created",
      action: "created",
      objectType: "template",
      objectId: data.id,
      objectName: templateName,
      body: ad.name ? `Saved from ad "${ad.name}".` : null,
      link: "/templates",
      dedupeKey: `template.created:${data.id}`,
      source: "templates.from-ad",
    })

    return NextResponse.json({ template: data }, { status: 201 })
  } catch (err: any) {
    console.error("[templates/from-ad] error:", err)
    return NextResponse.json({ error: err.message || "Failed to save template" }, { status: 500 })
  }
}
