"use client"

import { useMemo, useState, useRef, useCallback, useEffect } from "react"
import type { DiscoveryAd, FilterState, InspoBoard, SortOption } from "@/types/inspo"
import { DEFAULT_FILTERS } from "@/types/inspo"
import { InspoTabs, type InspoTab } from "./InspoTabs"
import { InspoSearchBar } from "./InspoSearchBar"
import { InspoFilterBar } from "./InspoFilterBar"
import { InspoSortControl } from "./InspoSortControl"
import { AdCardGrid } from "./AdCardGrid"
import { AdDetailModal } from "./AdDetailModal"
import { IconBookmarkFilled, IconSearch, IconLoader2 } from "@tabler/icons-react"

type RawAdLibraryAd = {
  id: string
  page_name?: string
  ad_creative_link_titles?: string[]
  ad_creative_bodies?: string[]
  publisher_platforms?: string[]
  languages?: string[]
  ad_delivery_start_time?: string
  ad_delivery_stop_time?: string
  ad_snapshot_url?: string
  brand_avatar?: string
  media_url?: string
  media_type?: "image" | "video"
  cta?: string
  format?: string
  category?: string
  running_days?: number
  eu_total_reach?: number
  impressions?: { lower_bound?: number; upper_bound?: number }
  spend?: { lower_bound?: number; upper_bound?: number }
}

// Map raw Ad Library API response → DiscoveryAd
function mapApiAd(raw: RawAdLibraryAd): DiscoveryAd {
  const startDate = raw.ad_delivery_start_time
  const stopDate  = raw.ad_delivery_stop_time
  const runningDays = startDate
    ? Math.max(0, Math.floor((new Date(stopDate || Date.now()).getTime() - new Date(startDate).getTime()) / 86400000))
    : undefined
  return {
    id:             raw.id,
    brandName:      raw.page_name || "Unknown",
    headline:       raw.ad_creative_link_titles?.[0] || undefined,
    primaryText:    raw.ad_creative_bodies?.[0] || "",
    mediaUrl:       raw.media_url || "",
    mediaType:      raw.media_type || "image",
    platform:       raw.publisher_platforms?.[0]?.toLowerCase() || "facebook",
    language:       raw.languages?.[0] || undefined,
    firstSeenAt:    startDate || undefined,
    runningDays:    raw.running_days ?? runningDays,
    adSnapshotUrl:  raw.ad_snapshot_url,
    brandAvatar:    raw.brand_avatar,
    cta:            raw.cta,
    format:         raw.format,
    category:       raw.category,
    views:          raw.eu_total_reach ?? raw.impressions?.upper_bound,
    estimatedSpend: raw.spend?.upper_bound,
  }
}

// Client-side query cache — avoids re-fetching same search
const queryCache = new Map<string, { ads: DiscoveryAd[]; ts: number }>()
const CACHE_TTL  = 5 * 60 * 1000

function applyFilters(ads: DiscoveryAd[], filters: FilterState, sort: SortOption): DiscoveryAd[] {
  let result = [...ads]

  if (filters.company.length)    result = result.filter(a => filters.company.includes(a.brandName))
  if (filters.language.length)   result = result.filter(a => a.language && filters.language.map(l => l.toLowerCase()).includes(a.language.toLowerCase()))
  if (filters.categories.length) result = result.filter(a => a.category && filters.categories.includes(a.category))
  if (filters.cta.length)        result = result.filter(a => a.cta && filters.cta.includes(a.cta))
  if (filters.platform.length)   result = result.filter(a => a.platform && filters.platform.map(p => p.toLowerCase()).includes(a.platform.toLowerCase()))
  if (filters.format.length)     result = result.filter(a => a.format && filters.format.map(f => f.toLowerCase()).includes(a.format.toLowerCase()))
  if (filters.views === "under_100k") result = result.filter(a => (a.views ?? 0) < 100_000)
  if (filters.views === "100k_1m")    result = result.filter(a => (a.views ?? 0) >= 100_000 && (a.views ?? 0) < 1_000_000)
  if (filters.views === "over_1m")    result = result.filter(a => (a.views ?? 0) >= 1_000_000)

  if (sort === "most_views")      result.sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
  if (sort === "newest")          result.sort((a, b) => new Date(b.firstSeenAt ?? 0).getTime() - new Date(a.firstSeenAt ?? 0).getTime())
  if (sort === "longest_running") result.sort((a, b) => (b.runningDays ?? 0) - (a.runningDays ?? 0))
  if (sort === "recommended")     result.sort((a, b) => (b.runningDays ?? 0) - (a.runningDays ?? 0))

  return result
}

interface Props {
  boards: InspoBoard[]
  savedMap: Map<string, Set<string>>   // adId → Set<boardId>
  onSave: (ad: DiscoveryAd, boardId: string) => Promise<void>
  onUnsave: (adId: string, boardId: string) => Promise<void>
  onCreateBoard: (name: string) => Promise<InspoBoard>
  activeBoardId: string | null
  boardAds?: DiscoveryAd[]  // ads in the active board (from DB)
  onAnalyzeAd?: (body: string, title?: string) => void
  onBrandClick?: (brandName: string) => void
}

export function InspoDiscoveryPage({
  boards, savedMap, onSave, onUnsave, onCreateBoard, activeBoardId, boardAds, onAnalyzeAd, onBrandClick,
}: Props) {
  const [activeTab, setActiveTab] = useState<InspoTab>("explore")
  const [search,    setSearch]    = useState("")
  const [filters,   setFilters]   = useState<FilterState>(DEFAULT_FILTERS)
  const [sort,      setSort]      = useState<SortOption>("recommended")
  const [selected,  setSelected]  = useState<DiscoveryAd | null>(null)

  // API state
  const [apiAds,    setApiAds]    = useState<DiscoveryAd[]>([])
  const [loading,   setLoading]   = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [errorType, setErrorType] = useState<"no_connection" | "no_permission" | "generic" | null>(null)
  const [hasMore,   setHasMore]   = useState(false)
  const [offset,    setOffset]    = useState(0)
  const [dataSource, setDataSource] = useState<"db" | "meta" | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const LIMIT = 48

  const fetchAds = useCallback(async (q: string, currentOffset = 0, append = false) => {
    if (append) setLoadingMore(true)
    else { setLoading(true); setError(null); setErrorType(null) }

    const params = new URLSearchParams({ q, limit: String(LIMIT), offset: String(currentOffset) })
    if (filters.platform?.length) params.set("platform", filters.platform[0])
    if (filters.format?.length)   params.set("format",   filters.format[0])
    if (sort === "newest")        params.set("sort", "newest")
    else if (sort === "most_views") params.set("sort", "views")

    try {
      const res  = await fetch(`/api/inspo/adscan?${params}`)
      const data = await res.json()
      if (!res.ok) {
        if (data.no_connection) setErrorType("no_connection")
        else if (data.error_code === 200) setErrorType("no_permission")
        else setErrorType("generic")
        throw new Error(data.error || "Failed to fetch ads")
      }
      const mapped = ((data.ads || []) as RawAdLibraryAd[]).map(mapApiAd)
      if (append) setApiAds(prev => [...prev, ...mapped])
      else setApiAds(mapped)
      setHasMore(!!data.hasMore)
      setOffset(currentOffset + mapped.length)
      setDataSource(data.source || "db")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch ads")
      if (!append) setApiAds([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [filters.platform, filters.format, sort])

  // Auto-load on mount and filter/sort changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setOffset(0)
      fetchAds(search.trim(), 0, false)
    }, search ? 400 : 0)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, filters.platform, filters.format, sort, fetchAds])

  const boardAdIds = useMemo(() => {
    if (!activeBoardId || !boardAds) return undefined
    return new Set(boardAds.map(a => a.id))
  }, [activeBoardId, boardAds])

  const savedAdIds = useMemo(() => {
    const ids = new Set<string>()
    savedMap.forEach((_, adId) => ids.add(adId))
    return ids
  }, [savedMap])

  const filteredAds = useMemo(() => {
    let base = activeTab === "following"
      ? apiAds.filter(a => savedAdIds.has(a.id))
      : apiAds
    if (activeBoardId && boardAdIds) base = base.filter(a => boardAdIds.has(a.id))
    return applyFilters(base, filters, sort)
  }, [apiAds, activeTab, filters, sort, activeBoardId, boardAdIds, savedAdIds])

  const activeBoard = activeBoardId ? boards.find(b => b.id === activeBoardId) : null

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Top bar: Tabs + board label */}
      <div className="flex items-center justify-between px-5 pt-2 border-b border-[#e4e7ec] shrink-0">
        <InspoTabs active={activeTab} onChange={setActiveTab} />
        {activeBoard && (
          <div className="flex items-center gap-1.5 pb-2.5 text-[13px] font-semibold text-primary">
            <IconBookmarkFilled className="size-3.5" />
            {activeBoard.name}
            <span className="text-xs text-muted-foreground font-normal ml-0.5">
              · {activeBoard.ad_count ?? 0} ads
            </span>
          </div>
        )}
      </div>

      {/* Search + Sort + Filters combined row */}
      <div className="relative z-30 px-5 py-3 border-b border-[#e4e7ec] shrink-0 space-y-2 bg-white overflow-visible">
        <div className="flex items-center gap-2">
          <div className="w-full max-w-[520px]">
            <InspoSearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search for ads by brand or keywords..."
            />
          </div>
          <span className="text-xs text-slate-500">1.4s</span>
          <InspoSortControl
            sort={sort}
            onSortChange={setSort}
            filters={filters}
            onClearFilters={() => setFilters(DEFAULT_FILTERS)}
          />
        </div>
        <div className="flex items-center gap-2 overflow-visible">
          <InspoFilterBar filters={filters} onChange={setFilters} />
        </div>
      </div>

      {/* Results count */}
      {!loading && !error && apiAds.length > 0 && (
        <div className="px-5 py-1.5 shrink-0 flex items-center gap-2">
          <p className="text-[11px] text-muted-foreground/60">
            {filteredAds.length} ads{search ? ` for "${search}"` : ""}
          </p>
          {dataSource === "db" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-medium">DB</span>
          )}
          {dataSource === "meta" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium">Meta API</span>
          )}
        </div>
      )}

      {/* Grid / Empty state */}
      <div className="relative z-0 flex-1 overflow-y-auto px-5 py-7">
        {loading ? null : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center px-4">
            {errorType === "no_connection" ? (
              <>
                <p className="font-semibold text-sm">Facebook chưa được kết nối</p>
                <p className="text-xs text-muted-foreground max-w-xs">Kết nối tài khoản Facebook để sử dụng Meta Ad Library.</p>
                <a href="/connect" className="text-xs text-primary hover:underline font-medium">Đi đến trang Connect →</a>
              </>
            ) : errorType === "no_permission" ? (
              <>
                <p className="font-semibold text-sm">Chưa có quyền truy cập Ad Library</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Cần chấp nhận điều khoản Meta Ad Library API, sau đó reconnect tài khoản Facebook trong trang Connect.
                </p>
                <div className="flex flex-col gap-2 w-full max-w-xs">
                  <a href="https://www.facebook.com/ads/library/api/" target="_blank" rel="noopener noreferrer"
                    className="text-xs px-3 py-2 rounded-lg border text-center hover:bg-muted transition-colors">
                    Chấp nhận ToS tại facebook.com/ads/library/api ↗
                  </a>
                  <a href="/connect" className="text-xs px-3 py-2 rounded-lg bg-primary text-primary-foreground text-center hover:bg-primary/90 transition-colors">
                    Reconnect Facebook →
                  </a>
                </div>
              </>
            ) : (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        ) : filteredAds.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-center text-muted-foreground">
            <IconSearch className="size-10 mb-3 opacity-25" />
            <p className="font-medium text-sm">Chưa có data</p>
            <p className="text-xs mt-1 max-w-sm opacity-75">
              Chạy script crawl trên MacMini để index ads vào DB, sau đó browse được không cần keyword.
            </p>
            <code className="mt-3 text-xs bg-muted px-3 py-1.5 rounded">node scripts/crawl-inspo.mjs</code>
          </div>
        ) : (
          <>
            <AdCardGrid
              ads={filteredAds}
              boards={boards}
              savedMap={savedMap}
              onSave={async (adId, boardId) => {
                const ad = apiAds.find(a => a.id === adId)
                if (ad) await onSave(ad, boardId)
              }}
              onUnsave={onUnsave}
              onCreateBoard={onCreateBoard}
              onAdClick={setSelected}
              onBrandClick={onBrandClick}
              loading={loading}
            />
            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center pt-6 pb-2">
                <button
                  onClick={() => fetchAds(search.trim(), offset, true)}
                  disabled={loadingMore}
                  className="px-6 py-2 text-sm rounded-lg border hover:bg-muted/50 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loadingMore ? (
                    <><IconLoader2 className="size-3.5 animate-spin" /> Loading...</>
                  ) : (
                    "Load more"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      <AdDetailModal
        ad={selected}
        ads={filteredAds}
        boards={boards}
        savedMap={savedMap}
        onSave={onSave}
        onUnsave={onUnsave}
        onCreateBoard={onCreateBoard}
        onClose={() => setSelected(null)}
        onAdChange={setSelected}
        onCloneWithAI={ad => onAnalyzeAd?.(ad.primaryText, ad.headline)}
      />
    </div>
  )
}
