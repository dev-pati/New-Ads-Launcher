export type DiscoveryAd = {
  id: string
  brandName: string
  brandAvatar?: string
  headline?: string
  primaryText: string
  mediaUrl: string
  mediaType: "image" | "video"
  duration?: string      // "00:32"
  cta?: string
  platform?: string      // "facebook" | "instagram" | "tiktok"
  format?: string        // "video" | "image" | "carousel"
  category?: string
  language?: string
  views?: number
  estimatedSpend?: number
  runningDays?: number
  firstSeenAt?: string   // ISO date
  tags?: string[]
  angle?: string
  emotion?: string
  theme?: string
  usp?: string
  desire?: string
  adSnapshotUrl?: string
}

export type InspoBoard = {
  id: string
  name: string
  org_id: string
  user_id: string
  created_at: string
  ad_count?: number
}

export type SortOption = "recommended" | "most_views" | "newest" | "longest_running"

export type FilterState = {
  company: string[]
  language: string[]
  categories: string[]
  cta: string[]
  platform: string[]
  format: string[]
  usp: string[]
  angle: string[]
  desire: string[]
  emotion: string[]
  theme: string[]
  views: string   // "all" | "under_100k" | "100k_1m" | "over_1m"
}

export const DEFAULT_FILTERS: FilterState = {
  company: [],
  language: [],
  categories: [],
  cta: [],
  platform: [],
  format: [],
  usp: [],
  angle: [],
  desire: [],
  emotion: [],
  theme: [],
  views: "all",
}

export function hasActiveFilters(f: FilterState): boolean {
  return (
    f.company.length > 0 || f.language.length > 0 || f.categories.length > 0 ||
    f.cta.length > 0 || f.platform.length > 0 || f.format.length > 0 ||
    f.usp.length > 0 || f.angle.length > 0 || f.desire.length > 0 ||
    f.emotion.length > 0 || f.theme.length > 0 || f.views !== "all"
  )
}
