import { createClient } from "@supabase/supabase-js"

/**
 * The one sanctioned read of a schema other than `ads_launcher`.
 *
 * AdLauncher writes only `ads_launcher` and reads exactly one other schema —
 * `creative_portal.media_assets`, for discovery of Portal-approved creative
 * (ADR-0003, contract 1). `assertSupabaseBoundary()` in ./boundary.ts refuses any
 * non-`ads_launcher` schema, so that read needs an explicit, audited exception
 * rather than an ad-hoc `createClient` at the call site.
 *
 * This module is that exception, and it is deliberately narrow:
 *   - read-only: no insert/update/delete surface is exported
 *   - one table: `media_assets`
 *   - one query shape: approved + available assets
 *
 * Do not export the raw client. If a second Portal table is ever needed, add a
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
}

const REGISTRY_COLUMNS = "id, object_key, original_file_name, mime_type, actual_size_bytes, created_at"

function registryClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error("Portal registry unavailable: Supabase service credentials are not configured")
  }
  return createClient(url, serviceKey, { db: { schema: "creative_portal" } })
}

/**
 * Every Portal asset a Media Buyer is allowed to see.
 *
 * `asset_role` is the approved filter — not a path prefix — because the bucket holds
 * two unrelated key layouts and only the approved one is human-navigable:
 *   approved   → creative-portal/approved/<brand>/<yyyy>/<mm>/imports/<uuid>/<file>
 *   submission → sub/<brand>/<uuid>/<uuid>/<ULID>/v<n>/<ULID>.<ext>
 *
 * `media_assets.status` is a third status vocabulary, unrelated to
 * `creatives.status` and to v1's `portal_media_items.status` (CONTEXT.md). It is read
 * here and nowhere else so the word cannot leak into the rest of the codebase:
 * `available` = usable, `orphaned` = the row outlived its object.
 */
export async function listApprovedAssets(): Promise<PortalRegistryAsset[]> {
  const { data, error } = await registryClient()
    .from("media_assets")
    .select(REGISTRY_COLUMNS)
    .eq("asset_role", "approved")
    .eq("status", "available")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) throw new Error(`Portal registry read failed: ${error.message}`)
  return (data || []) as PortalRegistryAsset[]
}

/** The subset matching a set of object keys. Used to expand a folder assign. */
export async function listApprovedAssetsByKeys(objectKeys: string[]): Promise<PortalRegistryAsset[]> {
  if (!objectKeys.length) return []
  const { data, error } = await registryClient()
    .from("media_assets")
    .select(REGISTRY_COLUMNS)
    .eq("asset_role", "approved")
    .eq("status", "available")
    .is("deleted_at", null)
    .in("object_key", objectKeys)

  if (error) throw new Error(`Portal registry read failed: ${error.message}`)
  return (data || []) as PortalRegistryAsset[]
}
