"use client"

import { IconPlayerPlay, IconExternalLink } from "@tabler/icons-react"
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
    <img src={src} alt={name} className="size-7 rounded-full object-cover border border-border" onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
  )
  return (
    <div className={cn("size-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0", color)}>
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
}

export function AdCard({ ad, boards, savedBoardIds, onSave, onUnsave, onCreateBoard, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className="group bg-white dark:bg-card rounded-xl border border-border overflow-hidden cursor-pointer hover:shadow-md hover:border-border/80 transition-all"
    >
      {/* Header */}
      <div className="flex items-start gap-2 p-3 pb-2">
        <BrandAvatar name={ad.brandName} src={ad.brandAvatar} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-foreground leading-tight truncate">{ad.brandName}</p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
            {ad.firstSeenAt ? `${timeAgo(ad.firstSeenAt)} • ` : ""}
            {ad.runningDays ? `ran for ${ad.runningDays}d` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {ad.views != null && (
            <span className="text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-md">
              {formatViews(ad.views)} views
            </span>
          )}
          {ad.estimatedSpend != null && (
            <span className="text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-md">
              {formatSpend(ad.estimatedSpend)}
            </span>
          )}
        </div>
      </div>

      {/* Ad text */}
      {(ad.headline || ad.primaryText) && (
        <div className="px-3 pb-2">
          <p className="text-[13px] text-foreground/90 leading-snug line-clamp-2">
            {ad.headline || ad.primaryText}
          </p>
        </div>
      )}

      {/* Media */}
      <div className="relative bg-muted overflow-hidden aspect-[4/3]">
        <img
          src={ad.mediaUrl}
          alt={ad.headline || ad.brandName}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {ad.mediaType === "video" && (
          <>
            {ad.duration && (
              <span className="absolute top-2 left-2 bg-black/70 text-white text-[11px] font-mono px-1.5 py-0.5 rounded">
                {ad.duration}
              </span>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="size-11 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                <IconPlayerPlay className="size-5 text-white fill-white ml-0.5" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2.5" onClick={e => e.stopPropagation()}>
        {ad.cta ? (
          <span className="text-[12px] font-medium border border-border rounded-md px-2.5 py-1 text-foreground/80">
            {ad.cta}
          </span>
        ) : <span />}

        <div className="flex items-center gap-1">
          <a
            href={ad.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="size-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Open"
          >
            <IconExternalLink className="size-3.5" />
          </a>
          <SaveToBoardButton
            ad={ad}
            boards={boards}
            savedBoardIds={savedBoardIds}
            onSave={onSave}
            onUnsave={onUnsave}
            onCreateBoard={onCreateBoard}
            size="sm"
          />
        </div>
      </div>
    </div>
  )
}
