"use client"

import { IconPlayerPlay, IconExternalLink, IconBookmark } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { DiscoveryAd, InspoBoard } from "@/types/inspo"
import { formatViews, formatSpend, timeAgo } from "@/lib/inspo-mock-data"
import { SaveToBoardButton } from "./SaveToBoardButton"

function BrandAvatar({ name, src }: { name: string; src?: string }) {
  const colors = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500",
    "bg-orange-500", "bg-pink-500", "bg-teal-500",
    "bg-red-500", "bg-amber-500",
  ]
  const color = colors[name.charCodeAt(0) % colors.length]
  if (src) return (
    <img src={src} alt={name} className="size-6 rounded-full object-cover ring-1 ring-white/20 shrink-0"
      onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
  )
  return (
    <div className={cn("size-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0", color)}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

interface Props {
  ad: DiscoveryAd
  boards: InspoBoard[]
  savedBoardIds: Set<string>
  onSave: (boardId: string) => Promise<void>
  onUnsave: (boardId: string) => Promise<void>
  onCreateBoard: (name: string) => Promise<InspoBoard>
  onClick: () => void
  onBrandClick?: (brandName: string) => void
}

export function AdCard({ ad, boards, savedBoardIds, onSave, onUnsave, onCreateBoard, onClick, onBrandClick }: Props) {
  const isSaved = savedBoardIds.size > 0

  return (
    <div
      onClick={onClick}
      className="group bg-card rounded-2xl border border-border/60 overflow-hidden cursor-pointer hover:shadow-xl hover:shadow-black/8 hover:-translate-y-0.5 hover:border-border transition-all duration-200"
    >
      {/* Media */}
      <div className="relative bg-neutral-100 dark:bg-neutral-900 overflow-hidden aspect-[4/3]">
        <img
          src={ad.mediaUrl}
          alt={ad.headline || ad.brandName}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          loading="lazy"
        />

        {/* Duration badge */}
        {ad.duration && (
          <span className="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-md backdrop-blur-sm">
            {ad.duration}
          </span>
        )}

        {/* Stats badges top-right */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {ad.views != null && (
            <span className="bg-black/65 backdrop-blur-sm text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none">
              {formatViews(ad.views)}
            </span>
          )}
          {ad.estimatedSpend != null && (
            <span className="bg-black/65 backdrop-blur-sm text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none">
              {formatSpend(ad.estimatedSpend)}
            </span>
          )}
        </div>

        {/* Play button */}
        {ad.mediaType === "video" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-11 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 group-hover:bg-black/70 transition-all duration-200">
              <IconPlayerPlay className="size-5 text-white fill-white ml-0.5" />
            </div>
          </div>
        )}

        {/* Hover action overlay */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-end p-2 gap-1.5"
          onClick={e => e.stopPropagation()}
        >
          <a
            href={ad.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="size-7 flex items-center justify-center rounded-lg bg-white/90 backdrop-blur-sm text-neutral-700 hover:bg-white hover:text-neutral-900 transition-colors shadow"
            title="Open original"
          >
            <IconExternalLink className="size-3.5" />
          </a>
          <div className="size-7 flex items-center justify-center">
            <SaveToBoardButton
              ad={ad}
              boards={boards}
              savedBoardIds={savedBoardIds}
              onSave={onSave}
              onUnsave={onUnsave}
              onCreateBoard={onCreateBoard}
              size="sm"
              overlayMode
            />
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="px-3 pt-2.5 pb-3 space-y-2">
        {/* Brand + meta row */}
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); onBrandClick?.(ad.brandName) }}
            className={onBrandClick ? "shrink-0 hover:opacity-80 transition-opacity" : "shrink-0 cursor-default"}
            tabIndex={onBrandClick ? 0 : -1}
          >
            <BrandAvatar name={ad.brandName} src={ad.brandAvatar} />
          </button>
          <div className="flex-1 min-w-0">
            <button
              onClick={e => { e.stopPropagation(); onBrandClick?.(ad.brandName) }}
              className={onBrandClick ? "text-[12px] font-semibold text-foreground truncate leading-tight hover:text-primary transition-colors block w-full text-left" : "text-[12px] font-semibold text-foreground truncate leading-tight block w-full text-left"}
              tabIndex={onBrandClick ? 0 : -1}
            >{ad.brandName}</button>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
              {[
                ad.firstSeenAt ? timeAgo(ad.firstSeenAt) : null,
                ad.runningDays ? `ran ${ad.runningDays}d` : null,
              ].filter(Boolean).join(" · ")}
            </p>
          </div>
          {/* Saved indicator (non-hover) */}
          {isSaved && (
            <IconBookmark className="size-3.5 text-primary fill-primary shrink-0" />
          )}
        </div>

        {/* Headline */}
        {(ad.headline || ad.primaryText) && (
          <p className="text-[12px] text-foreground/85 line-clamp-2 leading-snug">
            {ad.headline || ad.primaryText}
          </p>
        )}

        {/* CTA */}
        {ad.cta && (
          <div>
            <span className="inline-block text-[11px] font-medium border border-border/80 rounded-lg px-2.5 py-1 text-foreground/70 bg-muted/50">
              {ad.cta}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
