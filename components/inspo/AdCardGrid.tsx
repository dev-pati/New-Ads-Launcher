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
  loading?: boolean
}

export function AdCardGrid({ ads, boards, savedMap, onSave, onUnsave, onCreateBoard, onAdClick, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border overflow-hidden animate-pulse">
            <div className="p-3 pb-2 flex gap-2">
              <div className="size-7 rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-muted rounded w-2/3" />
                <div className="h-2.5 bg-muted rounded w-1/2" />
              </div>
            </div>
            <div className="px-3 pb-2"><div className="h-3 bg-muted rounded" /></div>
            <div className="aspect-[4/3] bg-muted" />
            <div className="px-3 py-2.5 flex justify-between">
              <div className="h-6 w-16 bg-muted rounded" />
              <div className="flex gap-1"><div className="size-7 bg-muted rounded-lg" /><div className="size-7 bg-muted rounded-lg" /></div>
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
        />
      ))}
    </div>
  )
}
