"use client"

import { useEffect, useCallback } from "react"
import {
  IconX, IconChevronLeft, IconChevronRight, IconShare,
} from "@tabler/icons-react"
import type { DiscoveryAd, InspoBoard } from "@/types/inspo"
import { AdDetailLeftPanel } from "./AdDetailLeftPanel"
import { AdMediaPreview } from "./AdMediaPreview"
import { SimilarAdsPanel } from "./SimilarAdsPanel"

function BrandAvatar({ name, src }: { name: string; src?: string }) {
  const colors = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500",
    "bg-orange-500", "bg-pink-500", "bg-teal-500", "bg-red-500", "bg-amber-500",
  ]
  const color = colors[name.charCodeAt(0) % colors.length]
  if (src) return (
    <img src={src} alt={name} className="size-8 rounded-full object-cover ring-2 ring-border shrink-0"
      onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
  )
  return (
    <div className={`${color} size-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

interface Props {
  ad: DiscoveryAd | null
  ads: DiscoveryAd[]               // full filtered list — for prev/next + similar
  boards: InspoBoard[]
  savedMap: Map<string, Set<string>>
  onSave: (ad: DiscoveryAd, boardId: string) => Promise<void>
  onUnsave: (adId: string, boardId: string) => Promise<void>
  onCreateBoard: (name: string) => Promise<InspoBoard>
  onClose: () => void
  onAdChange: (ad: DiscoveryAd) => void
  onCloneWithAI?: (ad: DiscoveryAd) => void
}

export function AdDetailModal({
  ad, ads, boards, savedMap,
  onSave, onUnsave, onCreateBoard,
  onClose, onAdChange, onCloneWithAI,
}: Props) {

  const idx     = ad ? ads.findIndex(a => a.id === ad.id) : -1
  const hasPrev = idx > 0
  const hasNext = idx >= 0 && idx < ads.length - 1

  const goPrev = useCallback(() => {
    if (hasPrev) onAdChange(ads[idx - 1])
  }, [hasPrev, idx, ads, onAdChange])

  const goNext = useCallback(() => {
    if (hasNext) onAdChange(ads[idx + 1])
  }, [hasNext, idx, ads, onAdChange])

  // Keyboard navigation
  useEffect(() => {
    if (!ad) return
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape")     onClose()
      if (e.key === "ArrowLeft")  goPrev()
      if (e.key === "ArrowRight") goNext()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [ad, onClose, goPrev, goNext])

  if (!ad) return null

  const savedBoardIds = savedMap.get(ad.id) || new Set<string>()

  function share() {
    if (navigator.share) {
      navigator.share({ title: ad!.brandName, text: ad!.headline, url: ad!.mediaUrl }).catch(() => {})
    } else {
      navigator.clipboard.writeText(ad!.mediaUrl)
    }
  }

  function handleCloneWithAI() {
    onCloneWithAI?.(ad!)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">

      {/* ── Header bar ─────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0 bg-background">

        {/* Left: brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          <BrandAvatar name={ad.brandName} src={ad.brandAvatar} />
          <span className="text-[15px] font-semibold text-foreground truncate max-w-[240px]">
            {ad.brandName}
          </span>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={share}
            className="flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors text-foreground/80"
          >
            <IconShare className="size-3.5" />
            Share
          </button>

          {/* Prev / Next */}
          <button
            onClick={goPrev}
            disabled={!hasPrev}
            className="size-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous ad (←)"
          >
            <IconChevronLeft className="size-4" />
          </button>
          <button
            onClick={goNext}
            disabled={!hasNext}
            className="size-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next ad (→)"
          >
            <IconChevronRight className="size-4" />
          </button>

          <div className="w-px h-5 bg-border mx-0.5" />

          {/* Close */}
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Close (Esc)"
          >
            <IconX className="size-4" />
          </button>
        </div>
      </div>

      {/* ── Body: 3 panels ──────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel */}
        <AdDetailLeftPanel
          ad={ad}
          boards={boards}
          savedBoardIds={savedBoardIds}
          onSave={boardId => onSave(ad, boardId)}
          onUnsave={boardId => onUnsave(ad.id, boardId)}
          onCreateBoard={onCreateBoard}
          onCloneWithAI={handleCloneWithAI}
        />

        {/* Center: media preview */}
        <AdMediaPreview
          ad={ad}
          hasPrev={hasPrev}
          hasNext={hasNext}
          onPrev={goPrev}
          onNext={goNext}
        />

        {/* Right panel */}
        <SimilarAdsPanel
          ad={ad}
          onAdClick={onAdChange}
          onCloneWithAI={handleCloneWithAI}
        />
      </div>
    </div>
  )
}
