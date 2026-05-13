"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import type { DiscoveryAd } from "@/types/inspo"

type TimeframeFilter = "3m" | "6m" | "12m" | "all"

const TIMEFRAME_DAYS: Record<TimeframeFilter, number | null> = {
  "3m": 90, "6m": 180, "12m": 365, "all": null,
}

const AD_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-orange-500",
  "bg-pink-500", "bg-teal-500", "bg-amber-500", "bg-red-400",
]

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

interface Props { ads: DiscoveryAd[] }

export function TimelineTab({ ads }: Props) {
  const [timeframe, setTimeframe] = useState<TimeframeFilter>("all")

  const { rangeStart, rangeEnd, totalDays, filteredAds, monthMarkers } = useMemo(() => {
    const now = new Date()
    const limitDays = TIMEFRAME_DAYS[timeframe]
    const cutoff = limitDays ? new Date(now.getTime() - limitDays * 86400_000) : null

    const filtered = ads.filter(ad => {
      if (!ad.firstSeenAt) return false
      const adEnd = new Date(ad.firstSeenAt).getTime() + (ad.runningDays ?? 1) * 86400_000
      if (cutoff && adEnd < cutoff.getTime()) return false
      return true
    })

    if (filtered.length === 0) return { rangeStart: new Date(), rangeEnd: now, totalDays: 30, filteredAds: [], monthMarkers: [] }

    // Compute range
    let minTs = Infinity
    let maxTs = 0
    for (const ad of filtered) {
      const s = new Date(ad.firstSeenAt!).getTime()
      const e = s + (ad.runningDays ?? 1) * 86400_000
      if (s < minTs) minTs = s
      if (e > maxTs) maxTs = e
    }

    const startDate  = new Date(Math.min(minTs, cutoff?.getTime() ?? minTs))
    const endDate    = new Date(Math.max(maxTs, now.getTime()))
    const totalDays  = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400_000))

    // Month markers
    const markers: { label: string; pct: number }[] = []
    const cur = new Date(startDate)
    cur.setDate(1)
    cur.setMonth(cur.getMonth() + 1)
    while (cur < endDate) {
      const pct = ((cur.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100
      markers.push({ label: cur.toLocaleDateString("en-US", { month: "short", year: "2-digit" }), pct })
      cur.setMonth(cur.getMonth() + 1)
    }

    return { rangeStart: startDate, rangeEnd: endDate, totalDays, filteredAds: filtered, monthMarkers: markers }
  }, [ads, timeframe])

  if (ads.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
      <p className="font-medium">No timeline data available.</p>
      <p className="text-sm mt-1">Ads with firstSeenAt and runningDays will appear here.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Timeframe filter */}
      <div className="flex items-center gap-1.5">
        <span className="text-[12px] text-muted-foreground font-medium mr-1">Timeframe:</span>
        {(["3m", "6m", "12m", "all"] as TimeframeFilter[]).map(tf => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={cn(
              "h-7 px-3 text-[12px] font-medium rounded-lg border transition-colors",
              timeframe === tf
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-muted/40 border-border/60 text-foreground/70 hover:bg-muted"
            )}
          >
            {tf === "all" ? "All Time" : tf.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Timeline chart */}
      <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
        {/* Month header */}
        <div className="relative h-8 border-b border-border/50 bg-muted/20 px-[180px]">
          {monthMarkers.map((m, i) => (
            <div key={i} className="absolute top-0 bottom-0 flex items-center" style={{ left: `calc(180px + ${m.pct}%)` }}>
              <div className="h-full w-px bg-border/30" />
              <span className="absolute left-1.5 text-[10px] text-muted-foreground/70 whitespace-nowrap">{m.label}</span>
            </div>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/20">
          {filteredAds.map((ad, i) => {
            const adStart   = new Date(ad.firstSeenAt!).getTime()
            const adEnd     = adStart + (ad.runningDays ?? 1) * 86400_000
            const rangeMs   = rangeEnd.getTime() - rangeStart.getTime()
            const leftPct   = ((adStart - rangeStart.getTime()) / rangeMs) * 100
            const widthPct  = Math.max(0.5, ((adEnd - adStart) / rangeMs) * 100)
            const color     = AD_COLORS[i % AD_COLORS.length]
            const isActive  = adEnd > Date.now()

            return (
              <div key={ad.id} className="flex items-center h-12 hover:bg-muted/20 transition-colors">
                {/* Label */}
                <div className="w-[180px] shrink-0 px-4 flex items-center gap-2">
                  <img src={ad.mediaUrl} alt="" className="size-7 rounded object-cover shrink-0" />
                  <span className="text-[11px] text-foreground/80 truncate">{ad.headline || ad.brandName}</span>
                </div>

                {/* Bar track */}
                <div className="flex-1 relative h-full flex items-center px-2">
                  {/* Month grid lines */}
                  {monthMarkers.map((m, j) => (
                    <div key={j} className="absolute top-0 bottom-0 w-px bg-border/20" style={{ left: `${m.pct}%` }} />
                  ))}

                  {/* Duration bar */}
                  <div
                    className={cn("absolute h-5 rounded-full flex items-center px-2 min-w-[4px] transition-all", color, isActive ? "opacity-100" : "opacity-60")}
                    style={{ left: `${Math.max(0, leftPct)}%`, width: `${Math.min(widthPct, 100 - Math.max(0, leftPct))}%` }}
                    title={`${formatDate(new Date(adStart))} – ${ad.runningDays}d`}
                  >
                    {widthPct > 8 && (
                      <span className="text-[9px] text-white font-medium whitespace-nowrap">{ad.runningDays}d</span>
                    )}
                  </div>
                </div>

                {/* Duration label */}
                <div className="w-16 shrink-0 px-3 text-right">
                  <span className={cn("text-[11px] font-medium tabular-nums", isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                    {ad.runningDays ?? "?"}d
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer legend */}
        <div className="px-4 py-2.5 border-t border-border/30 flex items-center gap-4 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5"><div className="size-2.5 rounded-full bg-emerald-500" /> Active</div>
          <div className="flex items-center gap-1.5"><div className="size-2.5 rounded-full bg-muted-foreground/40" /> Ended</div>
          <span className="ml-auto">{formatDate(rangeStart)} – {formatDate(rangeEnd)}</span>
        </div>
      </div>
    </div>
  )
}
