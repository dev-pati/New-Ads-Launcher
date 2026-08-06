export type CreativeMediaVariant = "image" | "thumbnail" | "source"
export type MediaProvider = "creative_media_r2" | "legacy_supabase_ad_media"

export interface ParsedLocator {
  provider: MediaProvider
  bucket?: string
  key: string
}

export function parseStoragePath(storagePath: string): ParsedLocator {
  if (storagePath.startsWith("r2://")) {
    const parts = storagePath.slice(5).split("/")
    return {
      provider: "creative_media_r2",
      bucket: parts[0],
      key: parts.slice(1).join("/")
    }
  }
  return {
    provider: "legacy_supabase_ad_media",
    key: storagePath
  }
}

export interface ClientCreativeMedia {
  id: string
  media_type: "image" | "video"
  file_url: string
  storage_path?: string | null
  fb_image_url?: string | null
  fb_thumbnail_url?: string | null
  fb_video_id?: string | null
  fb_image_hash?: string | null
  // Present only when the query joined portal_media_assignments (see /api/creatives).
  // Not a column on `creatives` itself — the row that actually carries "when was this
  // claimed for this ad account" is the assignment, not the creative.
  portal_media_assignments?: { created_at: string }[] | { created_at: string } | null
  // Portal registry metadata snapshot, populated when the query joined portal_media_items.
  // Preserves brand/product/format metadata after the asset leaves Creative Portal's
  // `creative_storage_catalog` view (which only exposes 'available' assets).
  portal_media_items?: PortalMediaItemRow[] | PortalMediaItemRow | null
}

export interface PortalMediaItemRow {
  object_key: string
  portal_asset_id: string | null
  file_name: string | null
  media_type: string | null
  mime_type: string | null
  file_size: number | null
  portal_created_at: string | null
  brand_id: string | null
  brand_name: string | null
  brand_slug: string | null
  product_id: string | null
  product_name: string | null
  language: string | null
  width: number | null
  height: number | null
  duration_seconds: number | null
  pdp_url: string | null
  sales_page_url: string | null
  landing_url: string | null
  checkout_funnel_url: string | null
  brief_type: string | null
  voice_variant: string | null
}

export function sortCreativesByLatestAssignment<
  T extends { assigned_at?: string; created_at?: string }
>(creatives: T[]): T[] {
  return [...creatives].sort((a, b) => {
    const assignedB = Date.parse(b.assigned_at || b.created_at || "") || 0
    const assignedA = Date.parse(a.assigned_at || a.created_at || "") || 0
    return assignedB - assignedA
  })
}

export async function collectAllCreativePages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  chunkSize = 1000,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += chunkSize) {
    const page = await fetchPage(from, from + chunkSize - 1)
    rows.push(...page)
    if (page.length < chunkSize) return rows
  }
}

export function isMetaCdnUrl(url?: string | null) {
  return !!url && /(^https?:\/\/)?([^.]+\.)*fbcdn\.net/i.test(url)
}

export function buildCreativeMediaRoute(id: string, variant: CreativeMediaVariant) {
  return `/api/creatives/${id}/media?variant=${variant}`
}

export function mapCreativeForClient<T extends ClientCreativeMedia>(creative: T): T & { assigned_at?: string } {
  if (!creative?.id) return creative as T & { assigned_at?: string }

  const mapped = { ...creative } as T & { assigned_at?: string }

  // Flatten the portal_media_assignments join (if present) into assigned_at.
  // A Portal asset may be assigned to more than one account, and PostgREST does not
  // guarantee the embedded relation's order. Assets therefore needs the latest claim,
  // not whichever assignment happens to be returned first.
  const join = (creative as ClientCreativeMedia).portal_media_assignments
  if (join !== undefined) {
    const arr = Array.isArray(join) ? join : join ? [join] : []
    mapped.assigned_at = arr.reduce<string | undefined>((latest, assignment) => {
      if (!latest || Date.parse(assignment.created_at) > Date.parse(latest)) return assignment.created_at
      return latest
    }, undefined)
    delete (mapped as ClientCreativeMedia).portal_media_assignments
  }

  if (creative.media_type === "image") {
    if (creative.storage_path && creative.file_url) {
      mapped.fb_image_url = creative.file_url
      mapped.fb_thumbnail_url = creative.file_url
      return mapped
    }

    const shouldResolveImage =
      !creative.storage_path &&
      (!!creative.fb_image_hash
        || isMetaCdnUrl(creative.file_url)
        || isMetaCdnUrl(creative.fb_image_url)
        || isMetaCdnUrl(creative.fb_thumbnail_url))

    if (shouldResolveImage) {
      const imageRoute = buildCreativeMediaRoute(creative.id, "image")
      mapped.file_url = imageRoute
      mapped.fb_image_url = imageRoute
      mapped.fb_thumbnail_url = imageRoute
    }

    return mapped
  }

  if (!creative.storage_path && isMetaCdnUrl(creative.file_url)) {
    mapped.file_url = ""
  }

  if (creative.storage_path) {
    mapped.file_url = buildCreativeMediaRoute(creative.id, "source")
  }

  if (creative.storage_path && (!creative.fb_thumbnail_url || isMetaCdnUrl(creative.fb_thumbnail_url))) {
    mapped.fb_thumbnail_url = buildCreativeMediaRoute(creative.id, "thumbnail")
  }

  return mapped
}
