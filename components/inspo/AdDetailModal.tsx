"use client"

import { useEffect, useState } from "react"
import { IconX, IconCopy, IconCheck, IconPlayerPlay, IconExternalLink } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { DiscoveryAd, InspoBoard } from "@/types/inspo"
import { formatViews, formatSpend, timeAgo } from "@/lib/inspo-mock-data"
import { SaveToBoardButton } from "./SaveToBoardButton"

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Copy">
      {copied ? <IconCheck className="size-3.5 text-emerald-500" /> : <IconCopy className="size-3.5" />}
    </button>
  )
}

function MetaBadge({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">{label}</span>
      <span className="text-sm text-foreground bg-muted px-2 py-0.5 rounded-md inline-block">{value}</span>
    </div>
  )
}

interface Props {
  ad: DiscoveryAd | null
  boards: InspoBoard[]
  savedMap: Map<string, Set<string>>
  onSave: (adId: string, boardId: string) => Promise<void>
  onUnsave: (adId: string, boardId: string) => Promise<void>
  onCreateBoard: (name: string) => Promise<InspoBoard>
  onClose: () => void
}

export function AdDetailModal({ ad, boards, savedMap, onSave, onUnsave, onCreateBoard, onClose }: Props) {
  useEffect(() => {
    if (!ad) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [ad, onClose])

  if (!ad) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex"
        onClick={e => e.stopPropagation()}
      >
        {/* Left — creative preview */}
        <div className="w-[44%] shrink-0 bg-black flex items-center justify-center relative">
          <img
            src={ad.mediaUrl}
            alt={ad.headline || ad.brandName}
            className="w-full h-full object-contain"
          />
          {ad.mediaType === "video" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="size-14 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
                <IconPlayerPlay className="size-7 text-white fill-white ml-1" />
              </div>
            </div>
          )}
          {ad.duration && (
            <span className="absolute top-3 left-3 bg-black/70 text-white text-xs font-mono px-2 py-0.5 rounded">
              {ad.duration}
            </span>
          )}
        </div>

        {/* Right — details */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div className="flex items-center gap-2.5">
              {ad.brandAvatar && (
                <img src={ad.brandAvatar} alt={ad.brandName} className="size-9 rounded-full object-cover border" />
              )}
              <div>
                <p className="font-semibold text-[15px]">{ad.brandName}</p>
                <p className="text-xs text-muted-foreground">
                  {ad.firstSeenAt && `${timeAgo(ad.firstSeenAt)}`}
                  {ad.runningDays && ` • ran ${ad.runningDays}d`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SaveToBoardButton
                ad={ad}
                boards={boards}
                savedBoardIds={savedMap.get(ad.id) || new Set()}
                onSave={boardId => onSave(ad.id, boardId)}
                onUnsave={boardId => onUnsave(ad.id, boardId)}
                onCreateBoard={onCreateBoard}
              />
              <a
                href={ad.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="size-8 flex items-center justify-center rounded-lg border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <IconExternalLink className="size-4" />
              </a>
              <button onClick={onClose} className="size-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                <IconX className="size-4" />
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Stats */}
            <div className="flex gap-3 flex-wrap">
              {ad.views != null && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatViews(ad.views)}</p>
                  <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70 uppercase font-medium">Views</p>
                </div>
              )}
              {ad.estimatedSpend != null && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatSpend(ad.estimatedSpend)}</p>
                  <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70 uppercase font-medium">Est. Spend</p>
                </div>
              )}
              {ad.runningDays != null && (
                <div className="bg-muted rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold">{ad.runningDays}d</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">Running</p>
                </div>
              )}
            </div>

            {/* Headline */}
            {ad.headline && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Headline</p>
                  <CopyButton text={ad.headline} />
                </div>
                <p className="text-sm font-medium text-foreground bg-muted rounded-lg px-3 py-2">{ad.headline}</p>
              </div>
            )}

            {/* Primary text */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Primary Text</p>
                <CopyButton text={ad.primaryText} />
              </div>
              <p className="text-sm text-foreground bg-muted rounded-lg px-3 py-2 leading-relaxed">{ad.primaryText}</p>
            </div>

            {/* Meta tags grid */}
            <div className="grid grid-cols-3 gap-3">
              <MetaBadge label="Platform"  value={ad.platform} />
              <MetaBadge label="Format"    value={ad.format} />
              <MetaBadge label="Category"  value={ad.category} />
              <MetaBadge label="Language"  value={ad.language} />
              <MetaBadge label="CTA"       value={ad.cta} />
              <MetaBadge label="Ad Angle"  value={ad.angle} />
              <MetaBadge label="Emotion"   value={ad.emotion} />
              <MetaBadge label="Desire"    value={ad.desire} />
              <MetaBadge label="Theme"     value={ad.theme} />
              <MetaBadge label="USP"       value={ad.usp} />
            </div>

            {/* Tags */}
            {ad.tags && ad.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {ad.tags.map(tag => (
                  <span key={tag} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* CTA footer */}
          {ad.cta && (
            <div className="px-5 py-3 border-t">
              <button className="w-full h-9 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
                {ad.cta}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
