"use client"

import { useState, useMemo, useEffect } from "react"
import { cn } from "@/lib/utils"
import { IconChevronDown } from "@tabler/icons-react"
import type { BrandAnalytics } from "@/lib/brand-spy-analytics"
import { getBrandAnalytics } from "@/lib/brand-spy-analytics"
import { MOCK_ADS } from "@/lib/inspo-mock-data"
import type { DiscoveryAd } from "@/types/inspo"
import { BrandHeader } from "./BrandHeader"
import { BrandTabs, type BrandTab } from "./BrandTabs"
import { OverviewTab } from "./tabs/OverviewTab"
import { AdCopiesTab } from "./tabs/AdCopiesTab"
import { HeadlinesTab } from "./tabs/HeadlinesTab"
import { LandingPagesTab } from "./tabs/LandingPagesTab"
import { TimelineTab } from "./tabs/TimelineTab"
import { TagAnalysisTab } from "./tabs/TagAnalysisTab"
import type { BrandFilters } from "@/hooks/use-brand-spy"

// ─── Filter helpers ───────────────────────────────────────────────────────────

function applyBrandFilters(ads: DiscoveryAd[], filters: BrandFilters): DiscoveryAd[] {
  const now = Date.now()
  const DAY = 86400_000

  return ads.filter(ad => {
    // Time range
    if (filters.timeRange !== "all" && ad.firstSeenAt) {
      const days = filters.timeRange === "7d" ? 7 : filters.timeRange === "30d" ? 30 : 90
      const cutoff = now - days * DAY
      if (new Date(ad.firstSeenAt).getTime() < cutoff) return false
    }

    // Status
    if (filters.status !== "all" && ad.firstSeenAt) {
      const adEnd = new Date(ad.firstSeenAt).getTime() + (ad.runningDays ?? 0) * DAY
      if (filters.status === "active"   && adEnd <= now) return false
      if (filters.status === "inactive" && adEnd > now)  return false
    }

    // Type
    if (filters.type !== "all") {
      const t = (ad.mediaType ?? ad.format ?? "").toLowerCase()
      if (filters.type !== t) return false
    }

    // Language
    if (filters.language !== "all" && ad.language) {
      if (ad.language.toLowerCase() !== filters.language.toLowerCase()) return false
    }

    return true
  })
}

// ─── Dropdown pill ────────────────────────────────────────────────────────────

function FilterDropdown<T extends string>({
  label, value, options, onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  const current = options.find(o => o.value === value)
  return (
    <div className="relative group">
      <button className="flex items-center gap-1 h-7 px-3 text-xs font-medium border border-border/60 rounded-lg bg-background hover:bg-muted transition-colors whitespace-nowrap">
        {label && <span className="text-muted-foreground">{label}:</span>}
        <span className="text-foreground">{current?.label ?? value}</span>
        <IconChevronDown className="size-3 text-muted-foreground ml-0.5" />
      </button>

      {/* Dropdown */}
      <div className="absolute right-0 top-full mt-1 z-50 min-w-[120px] bg-popover border border-border/60 rounded-xl shadow-xl overflow-hidden hidden group-focus-within:block">
        {options.map(opt => (
          <button
            key={opt.value}
            onMouseDown={() => onChange(opt.value)}
            className={cn(
              "w-full text-left px-3 py-2 text-xs transition-colors hover:bg-muted",
              opt.value === value ? "font-semibold text-primary" : "text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function BrandDetailSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* Header skeleton */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <div className="size-5 rounded bg-muted w-24" />
          <div className="w-px h-5 bg-border" />
          <div className="size-14 rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-5 bg-muted rounded w-32" />
            <div className="h-3 bg-muted rounded w-24" />
          </div>
          <div className="ml-auto flex gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-1">
                <div className="h-5 bg-muted rounded w-14" />
                <div className="h-3 bg-muted rounded w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Tabs skeleton */}
      <div className="flex gap-2 px-6 py-2 border-b border-border shrink-0">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-8 bg-muted rounded-lg w-20" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="flex-1 p-6 grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-muted rounded-2xl h-28" />
        ))}
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  brandName: string
  onBack: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BrandDetailPage({ brandName, onBack }: Props) {
  const [activeTab, setActiveTab]   = useState<BrandTab>("overview")
  const [search,    setSearch]      = useState("")
  const [loading,   setLoading]     = useState(true)
  const [analytics, setAnalytics]   = useState<BrandAnalytics | null>(null)

  const [filters, setFilters] = useState<BrandFilters>({
    timeRange: "all",
    status:    "all",
    type:      "all",
    language:  "all",
  })

  // Load analytics (simulated async)
  useEffect(() => {
    setLoading(true)
    setAnalytics(null)
    const t = setTimeout(() => {
      const data = getBrandAnalytics(brandName, MOCK_ADS)
      setAnalytics(data)
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [brandName])

  // Filtered ads derived from analytics
  const filteredAds = useMemo(() => {
    if (!analytics) return []
    return applyBrandFilters(analytics.timelineAds, filters)
  }, [analytics, filters])

  // Recompute copies/headlines/tags from filtered ads when filters are active
  const isFiltered = filters.timeRange !== "all" || filters.status !== "all" ||
    filters.type !== "all" || filters.language !== "all"

  const effectiveAnalytics = useMemo(() => {
    if (!analytics || !isFiltered) return analytics
    // Rebuild relevant arrays from filteredAds
    const ads = filteredAds
    const copyMap = new Map<string, { ads: DiscoveryAd[]; reach: number }>()
    for (const ad of ads) {
      const key = ad.primaryText.trim()
      const prev = copyMap.get(key) ?? { ads: [], reach: 0 }
      prev.ads.push(ad)
      prev.reach += ad.views ?? 0
      copyMap.set(key, prev)
    }

    const adCopies = Array.from(copyMap.entries()).map(([text, v]) => {
      const running = v.ads.map(a => a.runningDays ?? 0)
      return {
        text, adsCount: v.ads.length,
        longestRunning: Math.max(...running, 0),
        totalRunningDays: running.reduce((s, n) => s + n, 0),
        totalReach: v.reach,
        score: Math.round((v.reach / 1000) * (Math.max(...running, 1) / 30)),
        firstAd: v.ads[0],
      }
    }).sort((a, b) => b.totalReach - a.totalReach)

    const headMap = new Map<string, DiscoveryAd[]>()
    for (const ad of ads) {
      if (!ad.headline) continue
      const key = ad.headline.trim()
      headMap.set(key, [...(headMap.get(key) ?? []), ad])
    }
    const headlines = Array.from(headMap.entries()).map(([text, hAds]) => {
      const running = hAds.map(a => a.runningDays ?? 0)
      const reach = hAds.reduce((s, a) => s + (a.views ?? 0), 0)
      return {
        text, adsCount: hAds.length,
        longestRunning: Math.max(...running, 0),
        totalRunningDays: running.reduce((s, n) => s + n, 0),
        totalReach: reach,
        score: Math.round((reach / 1000) * (Math.max(...running, 1) / 30)),
      }
    }).sort((a, b) => b.totalReach - a.totalReach)

    return { ...analytics, adCopies, headlines, timelineAds: filteredAds,
      topAds: [...filteredAds].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5) }
  }, [analytics, filteredAds, isFiltered])

  if (loading || !analytics) return <BrandDetailSkeleton />

  const eff = effectiveAnalytics!

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Brand header */}
      <BrandHeader
        analytics={analytics}
        onBack={onBack}
        search={search}
        onSearchChange={setSearch}
      />

      {/* Tabs row + global filters */}
      <div className="relative shrink-0 bg-background">
        <BrandTabs active={activeTab} onChange={setActiveTab} />

        {/* Global filters — positioned absolute top-right of tab row */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-20 pb-px">
          <FilterDropdown
            label="All time"
            value={filters.timeRange}
            options={[
              { value: "all",  label: "All time" },
              { value: "7d",   label: "Last 7 days" },
              { value: "30d",  label: "Last 30 days" },
              { value: "90d",  label: "Last 90 days" },
            ]}
            onChange={v => setFilters(p => ({ ...p, timeRange: v }))}
          />
          <FilterDropdown
            label="Status"
            value={filters.status}
            options={[
              { value: "all",      label: "All" },
              { value: "active",   label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
            onChange={v => setFilters(p => ({ ...p, status: v }))}
          />
          <FilterDropdown
            label="Type"
            value={filters.type}
            options={[
              { value: "all",      label: "All" },
              { value: "video",    label: "Video" },
              { value: "image",    label: "Image" },
              { value: "carousel", label: "Carousel" },
            ]}
            onChange={v => setFilters(p => ({ ...p, type: v }))}
          />
          <FilterDropdown
            label="Language"
            value={filters.language}
            options={[
              { value: "all",   label: "All" },
              { value: "en",    label: "English" },
              { value: "vi",    label: "Vietnamese" },
              { value: "es",    label: "Spanish" },
            ]}
            onChange={v => setFilters(p => ({ ...p, language: v }))}
          />
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {activeTab === "overview" && (
          <OverviewTab analytics={eff} />
        )}
        {activeTab === "ad-copies" && (
          <AdCopiesTab copies={eff.adCopies} emptyLabel="No ad copies found for this brand." />
        )}
        {activeTab === "headlines" && (
          <HeadlinesTab headlines={eff.headlines} />
        )}
        {activeTab === "landing-pages" && (
          <LandingPagesTab pages={eff.landingPages} />
        )}
        {activeTab === "timeline" && (
          <TimelineTab ads={eff.timelineAds} />
        )}
        {activeTab === "usp" && (
          <TagAnalysisTab tags={eff.uspBreakdown} label="USP" />
        )}
        {activeTab === "ad-angle" && (
          <TagAnalysisTab tags={eff.angleBreakdown} label="Ad Angle" />
        )}
        {activeTab === "desire" && (
          <TagAnalysisTab tags={eff.desireBreakdown} label="Desire" />
        )}
        {activeTab === "emotion" && (
          <TagAnalysisTab tags={eff.emotionBreakdown} label="Emotion" />
        )}
        {activeTab === "theme" && (
          <TagAnalysisTab tags={eff.themeBreakdown} label="Theme" />
        )}
        {activeTab === "ad-format" && (
          <TagAnalysisTab tags={eff.formatBreakdown} label="Ad Format" />
        )}
      </div>
    </div>
  )
}
