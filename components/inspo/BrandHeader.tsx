"use client"

import { useState } from "react"
import { IconBell, IconBellFilled, IconSearch, IconChevronLeft } from "@tabler/icons-react"
import { formatViews, formatSpend } from "@/lib/inspo-mock-data"
import type { BrandAnalytics } from "@/lib/brand-spy-analytics"
import { BrandAvatar } from "./BrandCard"

interface Props {
  analytics: BrandAnalytics
  onBack: () => void
  search: string
  onSearchChange: (v: string) => void
}

export function BrandHeader({ analytics, onBack, search, onSearchChange }: Props) {
  const [following, setFollowing] = useState(false)

  return (
    <div className="px-6 py-4 border-b border-border bg-background shrink-0">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <IconChevronLeft className="size-4" />
          All Brands
        </button>

        <div className="w-px h-5 bg-border" />

        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <BrandAvatar name={analytics.brandName} src={analytics.brandAvatar} size="lg" />
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">{analytics.brandName}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {analytics.activeAds} active · {analytics.totalAds} total ads
            </p>
          </div>
        </div>

        {/* Follow */}
        <button
          onClick={() => setFollowing(p => !p)}
          className={following
            ? "flex items-center gap-1.5 h-8 px-4 rounded-xl text-sm font-medium bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15 transition-colors"
            : "flex items-center gap-1.5 h-8 px-4 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          }
        >
          {following ? <IconBellFilled className="size-4" /> : <IconBell className="size-4" />}
          {following ? "Following" : "Follow"}
        </button>

        {/* Stats */}
        <div className="flex items-center gap-4 ml-auto">
          <Stat label="Total Ads"    value={analytics.totalAds.toString()} />
          <Stat label="Total Reach"  value={formatViews(analytics.totalReach)} accent />
          <Stat label="Est. Spend"   value={formatSpend(analytics.totalSpend)} />
          <Stat label="Avg. Running" value={`${analytics.avgRunningDays}d`} />
        </div>

        {/* Search */}
        <div className="relative w-52 shrink-0">
          <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search advertisers..."
            className="w-full h-8 pl-8 pr-3 text-sm bg-muted/50 border border-border/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 transition-all"
          />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-right">
      <p className={`text-sm font-bold tabular-nums ${accent ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground uppercase font-medium tracking-wide">{label}</p>
    </div>
  )
}
