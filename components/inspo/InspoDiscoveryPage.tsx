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
import { IconBookmarkFilled, IconSearch } from "@tabler/icons-react"

// Map raw Ad Library API response → DiscoveryAd
function mapApiAd(raw: any): DiscoveryAd {
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
    mediaUrl:       "",
    mediaType:      "image",
    platform:       raw.publisher_platforms?.[0]?.toLowerCase() || "facebook",
    language:       raw.languages?.[0] || undefined,
    firstSeenAt:    startDate || undefined,
    runningDays,
    adSnapshotUrl:  raw.ad_snapshot_url,
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
  onSave: (adId: string, boardId: string) => Promise<void>
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
  const [apiAds,        setApiAds]        = useState<DiscoveryAd[]>([])
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [searchedQuery, setSearchedQuery] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchAds = useCallback(async (q: string) => {
    const key = q.toLowerCase().trim()
    setSearchedQuery(q)
    const cached = queryCache.get(key)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setApiAds(cached.ads)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/inspo/adscan?q=${encodeURIComponent(q)}&limit=50`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to fetch ads")
      const mapped = (data.ads || []).map(mapApiAd)
      queryCache.set(key, { ads: mapped, ts: Date.now() })
      setApiAds(mapped)
    } catch (e: any) {
      setError(e.message)
      setApiAds([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce: 400ms after user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = search.trim()
    if (!q) { setApiAds([]); setSearchedQuery(""); setError(null); return }
    debounceRef.current = setTimeout(() => fetchAds(q), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, fetchAds])

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
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Top bar: Tabs + board label */}
      <div className="flex items-center justify-between px-5 pt-1 border-b border-border shrink-0">
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
      <div className="px-5 py-2.5 border-b border-border shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <InspoSearchBar value={search} onChange={setSearch} />
          <InspoSortControl
            sort={sort}
            onSortChange={setSort}
            filters={filters}
            onClearFilters={() => setFilters(DEFAULT_FILTERS)}
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <InspoFilterBar filters={filters} onChange={setFilters} />
        </div>
      </div>

      {/* Results count */}
      {searchedQuery && !loading && (
        <div className="px-5 py-1.5 shrink-0">
          <p className="text-[11px] text-muted-foreground/60">
            {filteredAds.length} ad{filteredAds.length !== 1 ? "s" : ""} for &quot;{searchedQuery}&quot;
          </p>
        </div>
      )}

      {/* Grid / Empty state */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {!searchedQuery && !loading && !error ? (
          <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
            <IconSearch className="size-10 mb-3 opacity-20" />
            <p className="font-medium text-sm">Search Facebook Ad Library</p>
            <p className="text-xs mt-1 opacity-70">Enter a brand name, keyword, or ad copy</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : (
          <AdCardGrid
            ads={filteredAds}
            boards={boards}
            savedMap={savedMap}
            onSave={onSave}
            onUnsave={onUnsave}
            onCreateBoard={onCreateBoard}
            onAdClick={setSelected}
            onBrandClick={onBrandClick}
            loading={loading}
          />
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
