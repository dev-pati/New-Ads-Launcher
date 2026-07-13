"use client"

import { useState, useMemo } from "react"
import { IconSparkles } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { DiscoveryAd } from "@/types/inspo"
import { MOCK_ADS, formatViews } from "@/lib/inspo-mock-data"

interface Props {
  ad: DiscoveryAd
  onAdClick: (ad: DiscoveryAd) => void
  onCloneWithAI: () => void
}

export function SimilarAdsPanel({ ad, onAdClick, onCloneWithAI }: Props) {
  const [sameBrand, setSameBrand] = useState(false)

  const similarAds = useMemo(() => {
    return MOCK_ADS.filter(a => {
      if (a.id === ad.id) return false
      if (sameBrand)      return a.brandName === ad.brandName
      // same category OR shared tag
      const shareTag = a.tags?.some(t => ad.tags?.includes(t))
      return a.category === ad.category || shareTag
    }).slice(0, 8)
  }, [ad, sameBrand])

  return (
    <div className="w-[270px] shrink-0 border-l border-border bg-background flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-foreground">Similar Ads</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ads similar to this one</p>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer mt-0.5 shrink-0">
            <input
              type="checkbox"
              checked={sameBrand}
              onChange={e => setSameBrand(e.target.checked)}
              className="size-3.5 accent-primary rounded cursor-pointer"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">Same brand</span>
          </label>
        </div>
      </div>

      {/* Similar ads list */}
      <div className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
        {similarAds.length === 0 ? (
          <>
            {/* Skeleton loading */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-2.5 p-1.5 animate-pulse">
                <div className="size-[60px] rounded-xl bg-muted shrink-0" />
                <div className="flex-1 space-y-1.5 pt-1">
                  <div className="h-2.5 bg-muted rounded w-3/4" />
                  <div className="h-2 bg-muted rounded w-full" />
                  <div className="h-2 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </>
        ) : (
          similarAds.map(similar => (
            <button
              key={similar.id}
              onClick={() => onAdClick(similar)}
              className="flex gap-2.5 w-full text-left rounded-xl p-1.5 hover:bg-muted/60 transition-colors group"
            >
              {/* Thumbnail */}
              <div className="size-[60px] rounded-lg overflow-hidden shrink-0 bg-muted">
                <img
                  src={similar.mediaUrl}
                  alt={similar.brandName}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-xs font-semibold text-foreground truncate leading-tight">{similar.brandName}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                  {similar.headline || similar.primaryText}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  {similar.views != null && (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatViews(similar.views)}
                    </span>
                  )}
                  {similar.cta && (
                    <span className={cn(
                      "text-xs border border-border rounded px-1.5 py-0.5 text-foreground/60",
                      similar.views != null && "border-l border-border"
                    )}>
                      {similar.cta}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Generate Brand footer */}
      <div className="px-4 py-3 border-t border-border shrink-0 space-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Generate Brand</p>
        <button
          onClick={onCloneWithAI}
          className="flex items-center justify-center gap-2 w-full h-9 bg-primary text-primary-foreground text-xs font-medium rounded-xl hover:bg-primary/90 transition-colors"
        >
          <IconSparkles className="size-3.5" />
          Clone with AI for {ad.mediaType === "video" ? "videos" : "images"}
        </button>
      </div>
    </div>
  )
}
