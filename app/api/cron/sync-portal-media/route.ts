import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { extractThumbnailFromUrl } from "@/lib/ffmpeg-thumbnail"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120 // 2 minutes to allow for FFmpeg extraction

type PortalAsset = {
  id: string
  object_key: string
  original_file_name: string | null
  mime_type: string | null
  actual_size_bytes: number | null
  created_at: string | null
}

function brandFromObjectKey(objectKey: string) {
  const parts = objectKey.split("/")
  return parts[0] === "creative-portal" && parts[1] === "approved" ? parts[2] : null
}

function mediaTypeFromMime(mimeType?: string | null): "image" | "video" {
  return mimeType?.startsWith("video") ? "video" : "image"
}

async function cacheThumbnail(params: { id: string; orgId: string; fileUrl: string }) {
  const buffer = await extractThumbnailFromUrl(params.fileUrl)
  if (!buffer) return null

  const adsDb = createAdminClient()
  const storagePath = `thumbnails/${params.orgId}/${params.id}.jpg`
  const { error } = await adsDb.storage.from("ad-media").upload(storagePath, buffer, {
    contentType: "image/jpeg",
    upsert: true,
    cacheControl: "31536000",
  })
  if (error) throw error

  const { data } = adsDb.storage.from("ad-media").getPublicUrl(storagePath)
  await adsDb.from("creatives").update({ fb_thumbnail_url: data.publicUrl }).eq("id", params.id)
  return data.publicUrl
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const adsDb = createAdminClient()
  const portalDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "creative_portal" } }
  )

  const { data: portalAssets, error: portalErr } = await portalDb
    .from("media_assets")
    .select("id, object_key, original_file_name, mime_type, actual_size_bytes, created_at")
    .eq("status", "available")
    .eq("visibility", "external")

  if (portalErr) return NextResponse.json({ error: portalErr.message }, { status: 500 })

  const { data: existingRows, error: existingErr } = await adsDb
    .from("creatives")
    .select("storage_path")
    .like("storage_path", "r2://pati-videos/creative-portal/%")

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 })

  const { data: mappingRows, error: mappingErr } = await adsDb
    .from("portal_brand_mappings")
    .select("brand_slug, org_id, ad_account_id, mapped_by")
    .eq("status", "mapped")

  if (mappingErr) return NextResponse.json({ error: mappingErr.message }, { status: 500 })

  const mappings = new Map(
    (mappingRows || [])
      .filter(row => row.brand_slug && row.org_id && row.ad_account_id && row.mapped_by)
      .map(row => [row.brand_slug, row])
  )
  const existingPaths = new Set((existingRows || []).map(row => row.storage_path).filter(Boolean))
  const inserted: Record<string, number> = {}
  const pending: Record<string, number> = {}
  const invalid: Record<string, number> = {}
  const errors: { id: string; error: string }[] = []

  for (const asset of (portalAssets || []) as PortalAsset[]) {
    const storagePath = `r2://pati-videos/${asset.object_key}`
    if (existingPaths.has(storagePath)) continue

    const brand = brandFromObjectKey(asset.object_key)
    if (!brand) {
      invalid["unknown"] = (invalid["unknown"] || 0) + 1
      continue
    }

    const target = mappings.get(brand)
    if (!target) {
      pending[brand] = (pending[brand] || 0) + 1
      const now = new Date().toISOString()
      const { error } = await adsDb.from("portal_brand_mappings").upsert(
        {
          brand_slug: brand,
          status: "pending",
          sample_asset_id: asset.id,
          sample_object_key: asset.object_key,
          last_seen_at: now,
          updated_at: now,
        },
        { onConflict: "brand_slug" }
      )
      if (error) errors.push({ id: asset.id, error: error.message })
      continue
    }

    const { error } = await adsDb.from("creatives").insert({
      org_id: target.org_id,
      user_id: target.mapped_by,
      file_name: asset.original_file_name || asset.object_key.split("/").pop() || asset.id,
      file_url: `https://creative.patigroup.com/api/media/${asset.id}`,
      storage_path: storagePath,
      media_type: mediaTypeFromMime(asset.mime_type),
      file_size: asset.actual_size_bytes,
      ad_account_id: target.ad_account_id,
      status: "ready",
      created_at: asset.created_at || new Date().toISOString(),
    })

    if (error) {
      errors.push({ id: asset.id, error: error.message })
      continue
    }

    existingPaths.add(storagePath)
    inserted[brand] = (inserted[brand] || 0) + 1
  }

  if (Object.keys(pending).length > 0) {
    console.warn("[sync-portal-media] pending Portal brand mappings", pending)
  }
  if (errors.length > 0) {
    console.error("[sync-portal-media] sync errors", errors.slice(0, 10))
  }

  const thumbnailsWarmed: string[] = []
  const thumbnailErrors: { id: string; error: string }[] = []

  const { data: missingThumbs } = await adsDb
    .from("creatives")
    .select("id, org_id, file_url")
    .like("storage_path", "r2://pati-videos/creative-portal/%")
    .is("fb_thumbnail_url", null)
    .limit(5)

  for (const row of missingThumbs || []) {
    try {
      const url = await cacheThumbnail({ id: row.id, orgId: row.org_id, fileUrl: row.file_url })
      if (url) thumbnailsWarmed.push(row.id)
    } catch (err) {
      thumbnailErrors.push({ id: row.id, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({
    portalApproved: portalAssets?.length || 0,
    existingAfterSync: existingPaths.size,
    inserted,
    pending,
    invalid,
    errors: errors.length,
    thumbnailsWarmed,
    thumbnailErrors: thumbnailErrors.length,
  })
}
