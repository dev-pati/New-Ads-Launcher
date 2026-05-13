import type { DiscoveryAd } from "@/types/inspo"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TagCount {
  label: string
  count: number
  totalReach: number
  percentage: number
  topAd?: DiscoveryAd
}

export interface AdCopyMetrics {
  text: string
  adsCount: number
  longestRunning: number
  totalRunningDays: number
  totalReach: number
  score: number
  firstAd: DiscoveryAd
}

export interface HeadlineMetrics {
  text: string
  adsCount: number
  longestRunning: number
  totalRunningDays: number
  totalReach: number
  score: number
}

export interface LandingPageMetrics {
  url: string
  adsCount: number
  distribution: number
}

export interface DemoCountry  { country: string; flag: string; percentage: number }
export interface DemoAgeGroup { range: string; percentage: number }

export interface DemographicsData {
  topCountries: DemoCountry[]
  genderMale: number
  genderFemale: number
  ageGroups: DemoAgeGroup[]
}

export interface TimelinePoint {
  date: string
  value: number
}

export interface MediaTypeBreakdown {
  type: string
  count: number
  percentage: number
  color: string
}

export interface BrandSummary {
  brandName: string
  brandAvatar?: string
  totalAds: number
  totalReach: number
  totalSpend: number
  categories: string[]
  platforms: string[]
  lastSeenAt?: string
  mediaTypes: string[]
}

export interface BrandAnalytics {
  brandName: string
  brandAvatar?: string
  totalAds: number
  totalReach: number
  totalSpend: number
  avgRunningDays: number
  activeAds: number

  mediaTypeBreakdown: MediaTypeBreakdown[]
  adCopies: AdCopyMetrics[]
  headlines: HeadlineMetrics[]
  landingPages: LandingPageMetrics[]
  timelineAds: DiscoveryAd[]

  uspBreakdown: TagCount[]
  angleBreakdown: TagCount[]
  desireBreakdown: TagCount[]
  emotionBreakdown: TagCount[]
  themeBreakdown: TagCount[]
  formatBreakdown: TagCount[]

  demographics: DemographicsData
  reachTimeline: TimelinePoint[]
  adsCountTimeline: TimelinePoint[]
  topAds: DiscoveryAd[]
}

// ─── Cache ───────────────────────────────────────────────────────────────────

const _cache = new Map<string, { data: BrandAnalytics; ts: number }>()
const _summaryCache = new Map<string, { data: BrandSummary[]; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function seededRand(seed: number, min: number, max: number): number {
  const x = Math.sin(seed) * 10000
  return min + Math.round((x - Math.floor(x)) * (max - min))
}

function groupByField(
  ads: DiscoveryAd[],
  field: keyof DiscoveryAd,
  totalReachAll: number,
): TagCount[] {
  const map = new Map<string, { count: number; reach: number; topAd?: DiscoveryAd }>()

  for (const ad of ads) {
    const val = (ad[field] as string | undefined)?.trim()
    if (!val) continue
    const prev = map.get(val) || { count: 0, reach: 0 }
    const newReach = prev.reach + (ad.views ?? 0)
    map.set(val, {
      count:  prev.count + 1,
      reach:  newReach,
      topAd:  !prev.topAd || (ad.views ?? 0) > (prev.topAd.views ?? 0) ? ad : prev.topAd,
    })
  }

  const total = ads.length || 1
  return Array.from(map.entries())
    .map(([label, v]) => ({
      label,
      count: v.count,
      totalReach: v.reach,
      percentage: Math.round((v.count / total) * 100),
      topAd: v.topAd,
    }))
    .sort((a, b) => b.count - a.count)
}

function generateReachTimeline(ads: DiscoveryAd[]): TimelinePoint[] {
  const WEEKS = 16
  const now = Date.now()
  const points: TimelinePoint[] = []

  for (let i = WEEKS - 1; i >= 0; i--) {
    const wEnd   = now - i * 7 * 86400_000
    const wStart = wEnd - 7 * 86400_000
    let reach = 0

    for (const ad of ads) {
      if (!ad.firstSeenAt) continue
      const adStart = new Date(ad.firstSeenAt).getTime()
      const adEnd   = adStart + (ad.runningDays ?? 1) * 86400_000
      if (adStart >= wEnd || adEnd <= wStart) continue
      const overlap = Math.min(adEnd, wEnd) - Math.max(adStart, wStart)
      const total   = adEnd - adStart
      reach += (overlap / total) * (ad.views ?? 0)
    }

    points.push({
      date:  new Date(wEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: Math.round(reach),
    })
  }

  return points
}

function generateAdsCountTimeline(ads: DiscoveryAd[]): TimelinePoint[] {
  const WEEKS = 16
  const now = Date.now()
  return Array.from({ length: WEEKS }, (_, i) => {
    const wEnd   = now - (WEEKS - 1 - i) * 7 * 86400_000
    const wStart = wEnd - 7 * 86400_000
    const count  = ads.filter(ad => {
      if (!ad.firstSeenAt) return false
      const adStart = new Date(ad.firstSeenAt).getTime()
      const adEnd   = adStart + (ad.runningDays ?? 1) * 86400_000
      return adStart < wEnd && adEnd > wStart
    }).length
    return {
      date:  new Date(wEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: count,
    }
  })
}

const GEO_POOLS: Record<string, DemoCountry[]> = {
  fashion:  [{ country: "United States", flag: "🇺🇸", percentage: 42 }, { country: "United Kingdom", flag: "🇬🇧", percentage: 18 }, { country: "Australia", flag: "🇦🇺", percentage: 14 }, { country: "Canada", flag: "🇨🇦", percentage: 13 }, { country: "Germany", flag: "🇩🇪", percentage: 13 }],
  health:   [{ country: "United States", flag: "🇺🇸", percentage: 51 }, { country: "Canada", flag: "🇨🇦", percentage: 17 }, { country: "Australia", flag: "🇦🇺", percentage: 16 }, { country: "United Kingdom", flag: "🇬🇧", percentage: 10 }, { country: "New Zealand", flag: "🇳🇿", percentage: 6 }],
  tech:     [{ country: "United States", flag: "🇺🇸", percentage: 38 }, { country: "India", flag: "🇮🇳", percentage: 22 }, { country: "United Kingdom", flag: "🇬🇧", percentage: 14 }, { country: "Germany", flag: "🇩🇪", percentage: 14 }, { country: "France", flag: "🇫🇷", percentage: 12 }],
  default:  [{ country: "United States", flag: "🇺🇸", percentage: 44 }, { country: "United Kingdom", flag: "🇬🇧", percentage: 18 }, { country: "Canada", flag: "🇨🇦", percentage: 16 }, { country: "Australia", flag: "🇦🇺", percentage: 13 }, { country: "Germany", flag: "🇩🇪", percentage: 9 }],
}

function generateDemographics(brandName: string, category?: string): DemographicsData {
  const seed   = hashStr(brandName)
  const cat    = (category ?? "").toLowerCase()
  const isFash = cat.includes("fashion") || cat.includes("jewelry") || cat.includes("beauty")
  const isTech = cat.includes("tech") || cat.includes("saas") || cat.includes("software")

  const geoKey: keyof typeof GEO_POOLS = isFash ? "fashion" : isTech ? "tech" : cat.includes("health") ? "health" : "default"

  const malePct = isFash ? seededRand(seed, 20, 35) : isTech ? seededRand(seed, 55, 72) : seededRand(seed, 40, 60)

  return {
    topCountries: GEO_POOLS[geoKey],
    genderMale:   malePct,
    genderFemale: 100 - malePct,
    ageGroups: [
      { range: "18–24", percentage: seededRand(seed + 1, 12, 28) },
      { range: "25–34", percentage: seededRand(seed + 2, 25, 38) },
      { range: "35–44", percentage: seededRand(seed + 3, 18, 30) },
      { range: "45–54", percentage: seededRand(seed + 4, 10, 20) },
      { range: "55+",   percentage: seededRand(seed + 5, 5, 14) },
    ],
  }
}

const LANDING_PATHS = ["collections/new", "offer", "shop", "sale", "products/bestseller"]

function generateLandingPages(ads: DiscoveryAd[], brandName: string): LandingPageMetrics[] {
  const slug   = brandName.toLowerCase().replace(/[^a-z0-9]+/g, "")
  const total  = Math.max(ads.length, 1)

  return LANDING_PATHS.slice(0, Math.min(ads.length + 2, LANDING_PATHS.length)).map((path, i) => {
    const count = Math.max(0, total - i)
    return {
      url:          `https://www.${slug}.com/${path}`,
      adsCount:     count,
      distribution: Math.round((count / total) * 100),
    }
  }).filter(p => p.adsCount > 0)
}

const TYPE_COLORS: Record<string, string> = {
  video:    "#6366f1",
  image:    "#10b981",
  carousel: "#f59e0b",
}

// ─── Main computation ─────────────────────────────────────────────────────────

function computeBrandAnalytics(brandName: string, allAds: DiscoveryAd[]): BrandAnalytics {
  const ads = allAds.filter(a => a.brandName === brandName)
  const today = Date.now()

  const totalReach = ads.reduce((s, a) => s + (a.views ?? 0), 0)
  const totalSpend = ads.reduce((s, a) => s + (a.estimatedSpend ?? 0), 0)
  const avgRunning = ads.length
    ? Math.round(ads.reduce((s, a) => s + (a.runningDays ?? 0), 0) / ads.length)
    : 0

  const activeAds = ads.filter(a => {
    if (!a.firstSeenAt) return false
    const end = new Date(a.firstSeenAt).getTime() + (a.runningDays ?? 0) * 86400_000
    return end > today
  }).length

  // Media type
  const typeMap = new Map<string, number>()
  for (const ad of ads) {
    const t = (ad.format ?? ad.mediaType ?? "unknown").toLowerCase()
    typeMap.set(t, (typeMap.get(t) ?? 0) + 1)
  }
  const total = ads.length || 1
  const mediaTypeBreakdown: MediaTypeBreakdown[] = Array.from(typeMap.entries()).map(([type, count]) => ({
    type,
    count,
    percentage: Math.round((count / total) * 100),
    color: TYPE_COLORS[type] ?? "#94a3b8",
  }))

  // Ad copies
  const copyMap = new Map<string, { ads: DiscoveryAd[]; reach: number }>()
  for (const ad of ads) {
    const key = ad.primaryText.trim()
    const prev = copyMap.get(key) ?? { ads: [], reach: 0 }
    prev.ads.push(ad)
    prev.reach += ad.views ?? 0
    copyMap.set(key, prev)
  }
  const adCopies: AdCopyMetrics[] = Array.from(copyMap.entries()).map(([text, v]) => {
    const running = v.ads.map(a => a.runningDays ?? 0)
    return {
      text,
      adsCount: v.ads.length,
      longestRunning: Math.max(...running, 0),
      totalRunningDays: running.reduce((s, n) => s + n, 0),
      totalReach: v.reach,
      score: Math.round((v.reach / 1000) * (Math.max(...running, 1) / 30)),
      firstAd: v.ads[0],
    }
  }).sort((a, b) => b.totalReach - a.totalReach)

  // Headlines
  const headMap = new Map<string, { ads: DiscoveryAd[] }>()
  for (const ad of ads) {
    if (!ad.headline) continue
    const key = ad.headline.trim()
    const prev = headMap.get(key) ?? { ads: [] }
    prev.ads.push(ad)
    headMap.set(key, prev)
  }
  const headlines: HeadlineMetrics[] = Array.from(headMap.entries()).map(([text, v]) => {
    const running = v.ads.map(a => a.runningDays ?? 0)
    const reach   = v.ads.reduce((s, a) => s + (a.views ?? 0), 0)
    return {
      text,
      adsCount: v.ads.length,
      longestRunning: Math.max(...running, 0),
      totalRunningDays: running.reduce((s, n) => s + n, 0),
      totalReach: reach,
      score: Math.round((reach / 1000) * (Math.max(...running, 1) / 30)),
    }
  }).sort((a, b) => b.totalReach - a.totalReach)

  return {
    brandName,
    brandAvatar: ads[0]?.brandAvatar,
    totalAds: ads.length,
    totalReach,
    totalSpend,
    avgRunningDays: avgRunning,
    activeAds,

    mediaTypeBreakdown,
    adCopies,
    headlines,
    landingPages: generateLandingPages(ads, brandName),
    timelineAds: [...ads].sort((a, b) =>
      new Date(a.firstSeenAt ?? 0).getTime() - new Date(b.firstSeenAt ?? 0).getTime()
    ),

    uspBreakdown:    groupByField(ads, "usp",      totalReach),
    angleBreakdown:  groupByField(ads, "angle",    totalReach),
    desireBreakdown: groupByField(ads, "desire",   totalReach),
    emotionBreakdown:groupByField(ads, "emotion",  totalReach),
    themeBreakdown:  groupByField(ads, "theme",    totalReach),
    formatBreakdown: groupByField(ads, "format",   totalReach),

    demographics: generateDemographics(brandName, ads[0]?.category),
    reachTimeline:    generateReachTimeline(ads),
    adsCountTimeline: generateAdsCountTimeline(ads),

    topAds: [...ads].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getBrandAnalytics(brandName: string, allAds: DiscoveryAd[]): BrandAnalytics {
  const key    = `${brandName}::${allAds.length}`
  const cached = _cache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data
  const data = computeBrandAnalytics(brandName, allAds)
  _cache.set(key, { data, ts: Date.now() })
  return data
}

export function getAllBrandSummaries(allAds: DiscoveryAd[]): BrandSummary[] {
  const key    = `summaries::${allAds.length}`
  const cached = _summaryCache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

  const map = new Map<string, DiscoveryAd[]>()
  for (const ad of allAds) {
    const prev = map.get(ad.brandName) ?? []
    prev.push(ad)
    map.set(ad.brandName, prev)
  }

  const data: BrandSummary[] = Array.from(map.entries())
    .map(([brandName, ads]) => ({
      brandName,
      brandAvatar: ads[0]?.brandAvatar,
      totalAds:    ads.length,
      totalReach:  ads.reduce((s, a) => s + (a.views ?? 0), 0),
      totalSpend:  ads.reduce((s, a) => s + (a.estimatedSpend ?? 0), 0),
      categories:  [...new Set(ads.map(a => a.category).filter(Boolean) as string[])],
      platforms:   [...new Set(ads.map(a => a.platform).filter(Boolean) as string[])],
      mediaTypes:  [...new Set(ads.map(a => a.mediaType))],
      lastSeenAt:  ads.sort((a, b) =>
        new Date(b.firstSeenAt ?? 0).getTime() - new Date(a.firstSeenAt ?? 0).getTime()
      )[0]?.firstSeenAt,
    }))
    .sort((a, b) => b.totalReach - a.totalReach)

  _summaryCache.set(key, { data, ts: Date.now() })
  return data
}

export function invalidateCache(brandName?: string) {
  if (brandName) {
    for (const key of _cache.keys()) {
      if (key.startsWith(brandName)) _cache.delete(key)
    }
  } else {
    _cache.clear()
    _summaryCache.clear()
  }
}
