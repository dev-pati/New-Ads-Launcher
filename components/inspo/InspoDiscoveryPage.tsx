"use client"

import { useMemo, useState } from "react"
import type { DiscoveryAd, FilterState, InspoBoard, SortOption } from "@/types/inspo"
import { DEFAULT_FILTERS } from "@/types/inspo"
import { MOCK_ADS } from "@/lib/inspo-mock-data"
import { InspoTabs, type InspoTab } from "./InspoTabs"
import { InspoSearchBar } from "./InspoSearchBar"
import { InspoFilterBar } from "./InspoFilterBar"
import { InspoSortControl } from "./InspoSortControl"
import { AdCardGrid } from "./AdCardGrid"
import { AdDetailModal } from "./AdDetailModal"
import { IconBookmarkFilled } from "@tabler/icons-react"

function applyFilters(ads: DiscoveryAd[], search: string, filters: FilterState, sort: SortOption, boardAdIds?: Set<string>): DiscoveryAd[] {
  let result = [...ads]

  // Board filter
  if (boardAdIds) result = result.filter(a => boardAdIds.has(a.id))

  // Search
  if (search.trim()) {
    const q = search.toLowerCase()
    result = result.filter(a =>
      a.brandName.toLowerCase().includes(q) ||
      a.headline?.toLowerCase().includes(q) ||
      a.primaryText.toLowerCase().includes(q) ||
      a.tags?.some(t => t.toLowerCase().includes(q))
    )
  }

  // Multi-select filters
  if (filters.company.length)    result = result.filter(a => filters.company.includes(a.brandName))
  if (filters.language.length)   result = result.filter(a => a.language && filters.language.map(l => l.toLowerCase()).includes(a.language.toLowerCase()))
  if (filters.categories.length) result = result.filter(a => a.category && filters.categories.includes(a.category))
  if (filters.cta.length)        result = result.filter(a => a.cta && filters.cta.includes(a.cta))
  if (filters.platform.length)   result = result.filter(a => a.platform && filters.platform.map(p => p.toLowerCase()).includes(a.platform.toLowerCase()))
  if (filters.format.length)     result = result.filter(a => a.format && filters.format.map(f => f.toLowerCase()).includes(a.format.toLowerCase()))
  if (filters.usp.length)        result = result.filter(a => a.usp && filters.usp.includes(a.usp))
  if (filters.angle.length)      result = result.filter(a => a.angle && filters.angle.includes(a.angle))
  if (filters.desire.length)     result = result.filter(a => a.desire && filters.desire.includes(a.desire))
  if (filters.emotion.length)    result = result.filter(a => a.emotion && filters.emotion.includes(a.emotion))
  if (filters.theme.length)      result = result.filter(a => a.theme && filters.theme.includes(a.theme))

  // Views range
  if (filters.views === "under_100k") result = result.filter(a => (a.views ?? 0) < 100_000)
  if (filters.views === "100k_1m")    result = result.filter(a => (a.views ?? 0) >= 100_000 && (a.views ?? 0) < 1_000_000)
  if (filters.views === "over_1m")    result = result.filter(a => (a.views ?? 0) >= 1_000_000)

  // Sort
  if (sort === "most_views")      result.sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
  if (sort === "newest")          result.sort((a, b) => new Date(b.firstSeenAt ?? 0).getTime() - new Date(a.firstSeenAt ?? 0).getTime())
  if (sort === "longest_running") result.sort((a, b) => (b.runningDays ?? 0) - (a.runningDays ?? 0))
  if (sort === "recommended")     result.sort((a, b) => ((b.views ?? 0) * (b.runningDays ?? 1)) - ((a.views ?? 0) * (a.runningDays ?? 1)))

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
}

export function InspoDiscoveryPage({
  boards, savedMap, onSave, onUnsave, onCreateBoard, activeBoardId, boardAds,
}: Props) {
  const [activeTab, setActiveTab] = useState<InspoTab>("explore")
  const [search,    setSearch]    = useState("")
  const [filters,   setFilters]   = useState<FilterState>(DEFAULT_FILTERS)
  const [sort,      setSort]      = useState<SortOption>("recommended")
  const [selected,  setSelected]  = useState<DiscoveryAd | null>(null)

  const boardAdIds = useMemo(() => {
    if (!activeBoardId || !boardAds) return undefined
    return new Set(boardAds.map(a => a.id))
  }, [activeBoardId, boardAds])

  // "Following" tab: show only saved ads across all boards
  const savedAdIds = useMemo(() => {
    const ids = new Set<string>()
    savedMap.forEach((_, adId) => ids.add(adId))
    return ids
  }, [savedMap])

  const filteredAds = useMemo(() => {
    const base = activeTab === "following"
      ? MOCK_ADS.filter(a => savedAdIds.has(a.id))
      : MOCK_ADS
    const boardFilter = activeBoardId && boardAdIds ? boardAdIds : undefined
    return applyFilters(base, search, filters, sort, activeBoardId ? boardFilter : undefined)
  }, [MOCK_ADS, activeTab, search, filters, sort, activeBoardId, boardAdIds, savedAdIds])

  const activeBoard = activeBoardId ? boards.find(b => b.id === activeBoardId) : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center justify-between px-5 pt-3 border-b border-border shrink-0">
        <InspoTabs active={activeTab} onChange={setActiveTab} />
        {activeBoard && (
          <div className="flex items-center gap-1.5 pb-2 text-sm font-medium text-primary">
            <IconBookmarkFilled className="size-4" />
            {activeBoard.name}
            <span className="text-xs text-muted-foreground font-normal ml-0.5">
              ({activeBoard.ad_count ?? 0} ads)
            </span>
          </div>
        )}
      </div>

      {/* Search + Sort row */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
        <InspoSearchBar value={search} onChange={setSearch} />
        <InspoSortControl
          sort={sort}
          onSortChange={setSort}
          filters={filters}
          onClearFilters={() => setFilters(DEFAULT_FILTERS)}
        />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-1.5 px-5 py-2 border-b border-border overflow-x-auto shrink-0 scrollbar-none">
        <InspoFilterBar filters={filters} onChange={setFilters} />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <AdCardGrid
          ads={filteredAds}
          boards={boards}
          savedMap={savedMap}
          onSave={onSave}
          onUnsave={onUnsave}
          onCreateBoard={onCreateBoard}
          onAdClick={setSelected}
        />
      </div>

      {/* Detail modal */}
      <AdDetailModal
        ad={selected}
        boards={boards}
        savedMap={savedMap}
        onSave={onSave}
        onUnsave={onUnsave}
        onCreateBoard={onCreateBoard}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
