import { createAdminClient } from "@/lib/supabase/admin"
import { CREATIVE_STATUS } from "@/lib/creative-readiness"
import type { PortalRegistryAsset } from "@/lib/supabase/portal-registry"

export const PORTAL_MEDIA_ORIGIN = process.env.CREATIVE_MEDIA_API_ORIGIN || "https://creative.patigroup.com"

export function portalMediaUrl(assetId: string) {
  return `${PORTAL_MEDIA_ORIGIN}/api/media/${assetId}`
}

export function portalStoragePath(objectKey: string) {
  return `r2://pati-videos/${objectKey}`
}

type ClaimPortalAssetParams = {
  asset: PortalRegistryAsset
  orgId: string
  adAccountId: string
  userId: string
}

/**
 * The single writer of a Portal asset into `creatives`.
 *
 * Keyed on the registry asset rather than on a `portal_media_items` row (v1), because
 * the same object can now be assigned to any number of ad accounts across any number of
 * orgs. Dedup stays on (org_id, ad_account_id, storage_path), which is what makes a
 * repeated assign idempotent per account without blocking a second account.
 */
export async function claimPortalAsset(params: ClaimPortalAssetParams) {
  const supabase = createAdminClient()
  const { asset, orgId, adAccountId, userId } = params
  const storagePath = portalStoragePath(asset.object_key)

  const { data: duplicate, error: dupErr } = await supabase
    .from("creatives")
    .select("id")
    .eq("org_id", orgId)
    .eq("ad_account_id", adAccountId)
    .eq("storage_path", storagePath)
    .maybeSingle()
  if (dupErr) throw dupErr
  if (duplicate?.id) return { creativeId: duplicate.id as string, reused: true }

  const { data, error } = await supabase
    .from("creatives")
    .insert({
      org_id: orgId,
      user_id: userId,
      file_name: asset.original_file_name || asset.object_key.split("/").pop() || asset.id,
      file_url: portalMediaUrl(asset.id),
      storage_path: storagePath,
      media_type: asset.mime_type?.startsWith("image/") ? "image" : "video",
      file_size: asset.actual_size_bytes,
      ad_account_id: adAccountId,
      status: CREATIVE_STATUS.PENDING,
      created_at: asset.created_at || new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error) throw error

  await supabase
    .from("portal_media_items")
    .upsert({
      object_key: asset.object_key,
      portal_asset_id: asset.id,
      brand_slug: asset.brand_slug,
      file_name: asset.original_file_name || asset.object_key.split("/").pop() || asset.id,
      media_type: asset.media_type,
      mime_type: asset.mime_type,
      file_size: asset.actual_size_bytes,
      org_id: orgId,
      ad_account_id: adAccountId,
      mapped_by: userId,
      creative_id: data.id,
      status: "imported",
      portal_created_at: asset.created_at || null,
      brand_id: asset.brand_id,
      brand_name: asset.brand_name,
      product_id: asset.product_id,
      product_name: asset.product_name,
      language: asset.language,
      width: asset.width,
      height: asset.height,
      duration_seconds: asset.duration_seconds,
      pdp_url: asset.product_catalog_pdp_url,
      sales_page_url: asset.product_catalog_sales_page_url,
      landing_url: asset.product_catalog_landing_url,
      checkout_funnel_url: asset.product_catalog_checkoutchamp_funnel_url,
      brief_type: asset.brief_type,
      voice_variant: asset.voice_variant,
    }, { onConflict: "object_key" })

  return { creativeId: data.id as string, reused: false }
}
