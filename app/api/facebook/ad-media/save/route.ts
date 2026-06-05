import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

// POST /api/facebook/ad-media/save
// Upsert FB media library items into the creatives table so they can be used for launch.
// Returns real Supabase creatives with UUID ids.
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { ad_account_id, items } = body as {
      ad_account_id: string
      items: {
        id: string
        name: string
        media_type: "image" | "video"
        thumbnail_url?: string
        fb_image_hash?: string
        fb_image_url?: string
        fb_video_id?: string
      }[]
    }

    if (!ad_account_id || !items?.length) {
      return NextResponse.json({ error: "ad_account_id and items required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Separate images and videos
    const imageHashes = items.filter(i => i.fb_image_hash).map(i => i.fb_image_hash!)
    const videoIds = items.filter(i => i.fb_video_id).map(i => i.fb_video_id!)

    // Find already-saved creatives for this org to avoid duplicates
    const { data: existing } = await supabase
      .from("creatives")
      .select("*")
      .eq("org_id", ctx.orgId)
      .or(
        [
          imageHashes.length ? `fb_image_hash.in.(${imageHashes.map(h => `"${h}"`).join(",")})` : null,
          videoIds.length ? `fb_video_id.in.(${videoIds.map(v => `"${v}"`).join(",")})` : null,
        ]
          .filter(Boolean)
          .join(",")
      )

    const existingByImageHash = new Map((existing || []).filter((c: any) => c.fb_image_hash).map((c: any) => [c.fb_image_hash, c]))
    const existingByVideoId = new Map((existing || []).filter((c: any) => c.fb_video_id).map((c: any) => [c.fb_video_id, c]))

    const toInsert: any[] = []
    const resolved: any[] = []

    for (const item of items) {
      const existingCreative = item.fb_image_hash
        ? existingByImageHash.get(item.fb_image_hash)
        : item.fb_video_id
          ? existingByVideoId.get(item.fb_video_id)
          : null

      if (existingCreative) {
        resolved.push(existingCreative)
      } else {
        toInsert.push({
          org_id: ctx.orgId,
          user_id: ctx.user.id,
          ad_account_id,
          file_name: item.name,
          file_url: item.thumbnail_url || item.fb_image_url || "",
          media_type: item.media_type,
          file_size: 0,
          fb_image_hash: item.fb_image_hash || null,
          fb_image_url: item.fb_image_url || null,
          fb_thumbnail_url: item.thumbnail_url || null,
          fb_video_id: item.fb_video_id || null,
        })
      }
    }

    if (toInsert.length > 0) {
      const { data: inserted, error: insertErr } = await supabase
        .from("creatives")
        .insert(toInsert)
        .select()
      if (insertErr) {
        console.error("[ad-media/save]", insertErr)
        return NextResponse.json({ error: "Failed to save creatives" }, { status: 500 })
      }
      resolved.push(...(inserted || []))
    }

    // Return in same order as input items
    const ordered = items.map(item => {
      return resolved.find(r =>
        (item.fb_image_hash && r.fb_image_hash === item.fb_image_hash) ||
        (item.fb_video_id && r.fb_video_id === item.fb_video_id)
      )
    }).filter(Boolean)

    return NextResponse.json({ creatives: ordered })
  } catch (err: any) {
    console.error("[ad-media/save]", err)
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}
