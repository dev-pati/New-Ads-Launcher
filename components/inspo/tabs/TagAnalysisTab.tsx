"use client"

import { formatViews } from "@/lib/inspo-mock-data"
import type { TagCount } from "@/lib/brand-spy-analytics"

interface Props {
  tags: TagCount[]
  label: string   // e.g. "USP", "Ad Angle"
}

export function TagAnalysisTab({ tags, label }: Props) {
  if (tags.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
      <p className="font-medium">No {label} data for this brand.</p>
      <p className="text-sm mt-1">This data is extracted from ad metadata.</p>
    </div>
  )

  const maxCount = Math.max(...tags.map(t => t.count), 1)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {tags.map((tag, i) => (
        <div key={tag.label} className="bg-card border border-border/60 rounded-2xl p-4 hover:shadow-md transition-shadow">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{tag.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tag.count} ad{tag.count !== 1 ? "s" : ""} · {tag.percentage}% of total
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
              {formatViews(tag.totalReach)}
            </span>
          </div>

          {/* Frequency bar */}
          <div className="mb-3">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(tag.count / maxCount) * 100}%`,
                  background: `hsl(${220 + i * 30}, 70%, 60%)`,
                }}
              />
            </div>
          </div>

          {/* Top creative */}
          {tag.topAd && (
            <div className="flex items-center gap-2 p-2 bg-muted/40 rounded-xl">
              <img
                src={tag.topAd.mediaUrl}
                alt=""
                className="size-10 rounded-lg object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground/70 uppercase font-medium mb-0.5">Top Creative</p>
                <p className="text-xs text-foreground/80 truncate leading-tight">
                  {tag.topAd.headline || tag.topAd.primaryText}
                </p>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
