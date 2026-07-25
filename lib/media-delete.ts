import { parseStoragePath } from "@/lib/creative-media"

function extractAssetIdFromKey(key: string): string | null {
  const parts = key.split("/")
  if (parts.length < 5) return null
  const assetId = parts[parts.length - 2]
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetId)
    ? assetId
    : null
}

export interface DeleteOutcome {
  ok: boolean
  /** If false, a short reason for the caller to surface. */
  reason?: string
}

/**
 * Provider-aware object deletion for a single creative's storage_path.
 * - r2 creative-portal/approved/*  -> unlink only (object stays)
 * - r2 ads-launcher/<org>/*         -> Portal-brokered delete, fail closed
 * - r2 other prefixes               -> reject
 * - legacy relative path            -> Supabase ad-media.remove
 *
 * The DB row is NOT removed here; the caller removes the row only when ok=true.
 * Fail-closed means a missing token, a Portal error, or an unresolvable asset id
 * returns ok=false so the caller must NOT delete the DB row.
 */
export async function deleteMediaObject(
  storagePath: string,
  orgId: string,
  actorId: string,
  supabase: { storage: { from: (bucket: string) => { remove: (paths: string[]) => Promise<unknown> } } }
): Promise<DeleteOutcome> {
  const locator = parseStoragePath(storagePath)

  if (locator.provider !== "creative_media_r2") {
    await supabase.storage.from("ad-media").remove([storagePath])
    return { ok: true }
  }

  if (locator.key.startsWith("creative-portal/approved/")) {
    // Portal-owned: unlink only.
    return { ok: true }
  }

  if (!locator.key.startsWith(`ads-launcher/${orgId}/`)) {
    return { ok: false, reason: "Cannot delete this object" }
  }

  const assetId = extractAssetIdFromKey(locator.key)
  if (!assetId) {
    return { ok: false, reason: "Cannot resolve media asset to delete" }
  }

  const portalApiBase = process.env.CREATIVE_MEDIA_API_ORIGIN || "https://creative.patigroup.com"
  const portalToken = process.env.ADS_MEDIA_API_TOKEN
  if (!portalToken) {
    return { ok: false, reason: "Media service not configured" }
  }

  let res: Response
  try {
    res = await fetch(`${portalApiBase}/api/integrations/ads/v1/media/assets/${assetId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${portalToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orgId, actorId }),
    })
  } catch {
    return { ok: false, reason: "Failed to delete media object" }
  }

  if (!res.ok) {
    return { ok: false, reason: "Failed to delete media object" }
  }

  return { ok: true }
}
