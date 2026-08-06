/**
 * Backfill portal_media_items metadata columns from Creative Portal's registry.
 *
 * Run after applying 20260806_portal_media_items_metadata.sql. For every row whose
 * brand_name is still null, fetch the matching asset from creative_storage_catalog by
 * object_key and persist its metadata snapshot. Assets no longer marked 'available' by
 * Portal will not be returned by the view and are skipped (logged to stderr).
 *
 * Usage: npx tsx supabase/backfill-portal-media-metadata.ts
 */
import { createClient } from "@supabase/supabase-js"
import { listApprovedAssetsByKeys } from "../lib/supabase/portal-registry"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(url!, serviceKey!, { db: { schema: "ads_launcher" } })

async function main() {
  const { data: rows, error } = await supabase
    .from("portal_media_items")
    .select("id, object_key")
    .is("brand_name", null)

  if (error) throw error
  if (!rows || rows.length === 0) {
    console.log("No portal_media_items rows need backfill.")
    return
  }

  const BATCH = 100
  let updated = 0
  let skipped = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    const keys = slice.map((r: { object_key: string }) => r.object_key)

    const assets = await listApprovedAssetsByKeys(keys)
    const assetByKey = new Map(assets.map(a => [a.object_key, a]))

    for (const row of slice) {
      const asset = assetByKey.get((row as { object_key: string }).object_key)
      if (!asset) {
        skipped++
        continue
      }
      const { error: updateErr } = await supabase
        .from("portal_media_items")
        .update({
          brand_id: asset.brand_id,
          brand_name: asset.brand_name,
          brand_slug: asset.brand_slug,
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
        })
        .eq("id", (row as { id: string }).id)

      if (updateErr) {
        console.error(`Failed to update ${row}:`, updateErr.message)
        continue
      }
      updated++
    }
  }

  console.log(`Backfill complete. Updated: ${updated}. Skipped (no longer available in Portal): ${skipped}.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
