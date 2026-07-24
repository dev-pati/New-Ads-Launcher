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
}

export function isMetaCdnUrl(url?: string | null) {
  return !!url && /(^https?:\/\/)?([^.]+\.)*fbcdn\.net/i.test(url)
}

export function buildCreativeMediaRoute(id: string, variant: CreativeMediaVariant) {
  return `/api/creatives/${id}/media?variant=${variant}`
}

export function mapCreativeForClient<T extends ClientCreativeMedia>(creative: T): T {
  if (!creative?.id) return creative

  const mapped = { ...creative }

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

  if (creative.fb_video_id && (!creative.fb_thumbnail_url || isMetaCdnUrl(creative.fb_thumbnail_url))) {
    mapped.fb_thumbnail_url = buildCreativeMediaRoute(creative.id, "thumbnail")
  }

  return mapped
}
