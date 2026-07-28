import { createClient } from "@supabase/supabase-js"

/**
 * The one sanctioned read of a schema other than `ads_launcher`.
 *
 * AdLauncher writes only `ads_launcher` and reads exactly one other schema —
 * `creative_portal`, for discovery of Portal-approved creative (ADR-0003, contract 1,
 * widened under BL-37 from `media_assets` alone to the `creative_storage_catalog` view).
 * `assertSupabaseBoundary()` in ./boundary.ts refuses any non-`ads_launcher` schema, so
 * that read needs an explicit, audited exception rather than an ad-hoc `createClient`
 * at the call site.
 *
 * This module is that exception, and it is deliberately narrow:
 *   - read-only: no insert/update/delete surface is exported
 *   - one view: `creative_storage_catalog` — Portal's own pre-join of media_assets with
 *     submissions/briefs/products/brands, keyed one row per media asset. Reading the
 *     view instead of hand-joining the underlying tables means Portal owns the join
 *     logic (e.g. which of submission vs. approved-import is the source of truth for a
 *     given asset) and AdLauncher only owns the column list it depends on.
 *   - one query shape: available assets
 *
 * Do not export the raw client. If a second Portal table/view is ever needed, add a
 * named function here so the boundary stays greppable — `{ schema: "creative_portal" }`
 * must appear in this file and nowhere else.
 */

export type PortalRegistryAsset = {
  id: string
  object_key: string
  original_file_name: string | null
  mime_type: string | null
  actual_size_bytes: number | null
  created_at: string | null
  file_url: string | null

  brand_id: string | null
  brand_name: string | null
  brand_slug: string | null
  product_id: string | null
  product_name: string | null
  product_catalog_pdp_url: string | null
  product_catalog_sales_page_url: string | null
  product_catalog_landing_url: string | null
  product_catalog_checkoutchamp_funnel_url: string | null

  language: string | null
  brief_type: string | null
  voice_variant: string | null

  media_type: string | null
  width: number | null
  height: number | null
  duration_seconds: number | null
}

// Selected from `creative_storage_catalog`, then mapped to PortalRegistryAsset below.
// Column names on the left are the view's own — kept verbatim so a Portal-side rename
// fails loudly here rather than silently downstream.
const CATALOG_COLUMNS = [
  "media_asset_id", "object_key", "file_name", "mime_type", "file_size_bytes",
  "source_ready_at", "file_url",
  "brand_id", "brand_name", "brand_slug",
  "product_id", "product_name",
  "product_catalog_pdp_url", "product_catalog_sales_page_url",
  "product_catalog_landing_url", "product_catalog_checkoutchamp_funnel_url",
  "language", "brief_type", "voice_variant",
  "media_type", "width", "height", "duration_seconds",
].join(",")

type CatalogRow = {
  media_asset_id: string
  object_key: string
  file_name: string | null
  mime_type: string | null
  file_size_bytes: number | null
  source_ready_at: string | null
  file_url: string | null
  brand_id: string | null
  brand_name: string | null
  brand_slug: string | null
  product_id: string | null
  product_name: string | null
  product_catalog_pdp_url: string | null
  product_catalog_sales_page_url: string | null
  product_catalog_landing_url: string | null
  product_catalog_checkoutchamp_funnel_url: string | null
  language: string | null
  brief_type: string | null
  voice_variant: string | null
  media_type: string | null
  width: number | null
  height: number | null
  duration_seconds: number | null
}

function toPortalRegistryAsset(row: CatalogRow): PortalRegistryAsset {
  return {
    id: row.media_asset_id,
    object_key: row.object_key,
    original_file_name: row.file_name,
    mime_type: row.mime_type,
    actual_size_bytes: row.file_size_bytes,
    created_at: row.source_ready_at,
    file_url: row.file_url,
    brand_id: row.brand_id,
    brand_name: row.brand_name,
    brand_slug: row.brand_slug,
    product_id: row.product_id,
    product_name: row.product_name,
    product_catalog_pdp_url: row.product_catalog_pdp_url,
    product_catalog_sales_page_url: row.product_catalog_sales_page_url,
    product_catalog_landing_url: row.product_catalog_landing_url,
    product_catalog_checkoutchamp_funnel_url: row.product_catalog_checkoutchamp_funnel_url,
    language: row.language,
    brief_type: row.brief_type,
    voice_variant: row.voice_variant,
    media_type: row.media_type,
    width: row.width,
    height: row.height,
    duration_seconds: row.duration_seconds,
  }
}

function registryClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error("Portal registry unavailable: Supabase service credentials are not configured")
  }
  return createClient(url, serviceKey, { db: { schema: "creative_portal" } })
}

/**
 * Every Portal asset a Media Buyer is allowed to see, with the brand/product/format
 * metadata needed to judge launch fit — not just the file itself (BL-37).
 *
 * `object_key` still carries the two-layout distinction the tree builder depends on:
 *   approved   → creative-portal/approved/<brand>/<yyyy>/<mm>/imports/<uuid>/<file>
 *   submission → sub/<brand>/<uuid>/<uuid>/<ULID>/v<n>/<ULID>.<ext>
 *
 * `creative_storage_catalog` is scoped to available/approved media by Portal itself —
 * unlike the old direct `media_assets` read, this view does not require re-stating
 * `asset_role = 'approved'` / `status = 'available'` / `deleted_at is null` here; that
 * filtering is Portal's responsibility as the view's owner.
 */
export async function listApprovedAssets(): Promise<PortalRegistryAsset[]> {
  const { data, error } = await registryClient()
    .from("creative_storage_catalog")
    .select(CATALOG_COLUMNS)
    .order("source_ready_at", { ascending: false })

  if (error) throw new Error(`Portal registry read failed: ${error.message}`)
  return ((data || []) as unknown as CatalogRow[]).map(toPortalRegistryAsset)
}

/** The subset matching a set of object keys. Used to expand a folder assign. */
export async function listApprovedAssetsByKeys(objectKeys: string[]): Promise<PortalRegistryAsset[]> {
  if (!objectKeys.length) return []
  const { data, error } = await registryClient()
    .from("creative_storage_catalog")
    .select(CATALOG_COLUMNS)
    .in("object_key", objectKeys)

  if (error) throw new Error(`Portal registry read failed: ${error.message}`)
  return ((data || []) as unknown as CatalogRow[]).map(toPortalRegistryAsset)
}
