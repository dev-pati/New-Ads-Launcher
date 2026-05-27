"use client"

import {
  IconBookmark,
  IconExternalLink,
  IconPlayerPlay,
  IconShare3,
  IconStarFilled,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { DiscoveryAd, InspoBoard } from "@/types/inspo"
import { formatSpend, formatViews, timeAgo } from "@/lib/inspo-mock-data"
import { SaveToBoardButton } from "./SaveToBoardButton"

function BrandAvatar({ name, src }: { name: string; src?: string }) {
  const colors = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500",
    "bg-orange-500", "bg-pink-500", "bg-teal-500",
    "bg-red-500", "bg-amber-500",
  ]
  const color = colors[name.charCodeAt(0) % colors.length]
  if (src) return (
    <img
      src={src}
      alt={name}
      className="size-12 rounded-full object-cover shadow-sm ring-1 ring-slate-200 shrink-0"
      onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
    />
  )
  return (
    <div className={cn("size-12 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0", color)}>
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
  const openPreview = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(ad.adSnapshotUrl || ad.mediaUrl || "#", "_blank")
  }

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer overflow-hidden rounded-lg border border-[#dfe3ea] bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-900/10"
    >
      <div className="space-y-2.5 px-4 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <button
            onClick={e => { e.stopPropagation(); onBrandClick?.(ad.brandName) }}
            className={onBrandClick ? "shrink-0 hover:opacity-80 transition-opacity" : "shrink-0 cursor-default"}
            tabIndex={onBrandClick ? 0 : -1}
          >
            <BrandAvatar name={ad.brandName} src={ad.brandAvatar} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onBrandClick?.(ad.brandName) }}
            className={cn(
              "min-w-0 flex-1 text-left text-[15px] font-semibold leading-tight text-slate-950",
              onBrandClick && "hover:text-primary transition-colors"
            )}
            tabIndex={onBrandClick ? 0 : -1}
          >
            <span className="block truncate">{ad.brandName}</span>
          </button>
          <a
            href={ad.adSnapshotUrl || ad.mediaUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100"
            title="Open in Ad Library"
          >
            <IconShare3 className="size-4" />
          </a>
          <div onClick={e => e.stopPropagation()} className="flex size-8 shrink-0 items-center justify-center">
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

        <div className="flex min-h-6 flex-wrap items-center gap-1.5 text-xs text-slate-600">
          <span className={cn("size-2 rounded-full", (ad.runningDays ?? 0) > 60 ? "bg-emerald-500" : "bg-red-500")} />
          <span>{ad.firstSeenAt ? timeAgo(ad.firstSeenAt) : "recently"}</span>
          {ad.runningDays && <span>- ran for {ad.runningDays}d</span>}
          {ad.views != null && (
            <span className="ml-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {formatViews(ad.views)} views
            </span>
          )}
          {ad.estimatedSpend != null && (
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              {formatSpend(ad.estimatedSpend)}
            </span>
          )}
        </div>

        {(ad.headline || ad.primaryText) && (
          <p className="line-clamp-1 text-[13px] leading-snug text-slate-950">
            {ad.headline || ad.primaryText}
          </p>
        )}
      </div>

      <div className="relative aspect-[3/4] overflow-hidden bg-slate-100">
        {ad.mediaUrl ? (
          <img
            src={ad.mediaUrl}
            alt={ad.headline || ad.brandName}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
            onError={e => {
              const el = e.target as HTMLImageElement
              el.style.display = "none"
              el.parentElement?.classList.add("ad-img-fallback")
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="select-none text-6xl font-bold text-slate-300">
              {ad.brandName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        <div className="absolute left-4 top-4 flex items-center gap-2">
          {ad.duration && (
            <span className="rounded-full bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-950 shadow">
              {ad.duration}
            </span>
          )}
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-950 shadow">View</span>
        </div>

        <button
          className="absolute right-4 top-4 flex size-12 items-center justify-center rounded-full bg-black/70 text-white shadow-lg transition-colors hover:bg-black/80"
          onClick={e => {
            e.stopPropagation()
            window.open(ad.adSnapshotUrl || ad.mediaUrl || "#", "_blank")
          }}
          title="Open media"
        >
          <IconExternalLink className="size-5" />
        </button>

        {ad.mediaType === "video" && (
          <button
            onClick={openPreview}
            className="absolute inset-0 flex items-center justify-center"
            title="Open video in Meta Ad Library"
          >
            <div className="flex size-16 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm transition-all duration-200 group-hover:scale-110 group-hover:bg-black/65">
              <IconPlayerPlay className="ml-1 size-8 fill-white text-white" />
            </div>
          </button>
        )}
      </div>

      <div className="flex min-h-[64px] items-center gap-3 border-t border-[#edf0f4] px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-slate-950">{ad.primaryText || ad.headline || ad.brandName}</p>
          {ad.cta && <p className="mt-1 text-xs text-slate-500">{ad.cta}</p>}
        </div>
        {isSaved && (
          <IconBookmark className="size-4 shrink-0 fill-primary text-primary" />
        )}
        <div className="hidden items-center gap-0.5 text-amber-400 xl:flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <IconStarFilled key={i} className="size-3.5" />
          ))}
        </div>
      </div>
    </div>
  )
}
