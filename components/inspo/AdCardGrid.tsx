"use client"

import type { DiscoveryAd, InspoBoard } from "@/types/inspo"
import { AdCard } from "./AdCard"
import { IconMoodEmpty } from "@tabler/icons-react"

interface Props {
  ads: DiscoveryAd[]
  boards: InspoBoard[]
  savedMap: Map<string, Set<string>>  // adId → Set of boardIds where saved
  onSave: (adId: string, boardId: string) => Promise<void>
  onUnsave: (adId: string, boardId: string) => Promise<void>
  onCreateBoard: (name: string) => Promise<InspoBoard>
  onAdClick: (ad: DiscoveryAd) => void
  onBrandClick?: (brandName: string) => void
  loading?: boolean
}

export function AdCardGrid({ ads, boards, savedMap, onSave, onUnsave, onCreateBoard, onAdClick, onBrandClick, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/60 overflow-hidden animate-pulse bg-card">
            <div className="aspect-[4/3] bg-muted" />
            <div className="px-3 pt-2.5 pb-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-full bg-muted" />
                <div className="flex-1 space-y-1">
                  <div className="h-2.5 bg-muted rounded w-1/2" />
                  <div className="h-2 bg-muted rounded w-1/3" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="h-2.5 bg-muted rounded w-full" />
                <div className="h-2.5 bg-muted rounded w-3/4" />
              </div>
              <div className="h-6 w-20 bg-muted rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (ads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <IconMoodEmpty className="size-12 mb-3 opacity-30" />
        <p className="font-medium">No ads found</p>
        <p className="text-sm mt-1">Try adjusting your filters or search query</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
      {ads.map(ad => (
        <AdCard
          key={ad.id}
          ad={ad}
          boards={boards}
          savedBoardIds={savedMap.get(ad.id) || new Set()}
          onSave={boardId => onSave(ad.id, boardId)}
          onUnsave={boardId => onUnsave(ad.id, boardId)}
          onCreateBoard={onCreateBoard}
          onClick={() => onAdClick(ad)}
          onBrandClick={onBrandClick}
        />
      ))}
    </div>
  )
}
