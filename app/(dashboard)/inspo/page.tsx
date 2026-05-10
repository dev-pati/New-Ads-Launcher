"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  IconScan,
  IconSparkles,
  IconPencil,
  IconBinoculars,
  IconBookmark,
  IconBookmarkFilled,
  IconSearch,
  IconLoader2,
  IconExternalLink,
  IconAlertCircle,
  IconBrandFacebook,
  IconBrandInstagram,
  IconLink,
} from "@tabler/icons-react"

type SubTab = "adscan" | "ai" | "create" | "brand-spy" | "saved"

interface AdResult {
  id: string
  page_name: string
  page_id?: string
  ad_creative_bodies?: string[]
  ad_creative_link_titles?: string[]
  ad_snapshot_url?: string
  ad_delivery_start_time?: string
  publisher_platforms?: string[]
}

interface SavedAd {
  id: string
  ad_archive_id: string
  page_name: string
  ad_body?: string
  ad_title?: string
  ad_snapshot_url?: string
  ad_delivery_start_time?: string
  publisher_platforms?: string[]
  created_at: string
}

const COUNTRIES = [
  { code: "VN", label: "🇻🇳 Vietnam" },
  { code: "US", label: "🇺🇸 United States" },
  { code: "GB", label: "🇬🇧 United Kingdom" },
  { code: "AU", label: "🇦🇺 Australia" },
  { code: "SG", label: "🇸🇬 Singapore" },
  { code: "TH", label: "🇹🇭 Thailand" },
  { code: "MY", label: "🇲🇾 Malaysia" },
  { code: "PH", label: "🇵🇭 Philippines" },
  { code: "ID", label: "🇮🇩 Indonesia" },
  { code: "JP", label: "🇯🇵 Japan" },
  { code: "KR", label: "🇰🇷 South Korea" },
  { code: "IN", label: "🇮🇳 India" },
]

const STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "ALL", label: "All Status" },
]

const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500",
  "bg-orange-500", "bg-pink-500", "bg-teal-500",
  "bg-red-500", "bg-amber-500", "bg-cyan-500",
]

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

function formatDate(dateStr?: string) {
  if (!dateStr) return null
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", year: "numeric" })
  } catch {
    return null
  }
}

function PlatformPill({ platform }: { platform: string }) {
  if (platform === "facebook") {
    return (
      <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
        <IconBrandFacebook className="size-3" />
        Facebook
      </span>
    )
  }
  if (platform === "instagram") {
    return (
      <span className="flex items-center gap-1 text-xs text-pink-600 bg-pink-50 dark:bg-pink-950/30 dark:text-pink-400 px-2 py-0.5 rounded-full font-medium">
        <IconBrandInstagram className="size-3" />
        Instagram
      </span>
    )
  }
  return (
    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize font-medium">
      {platform}
    </span>
  )
}

interface AdCardProps {
  archiveId: string
  pageName: string
  body?: string
  title?: string
  snapshotUrl?: string
  startTime?: string
  platforms?: string[]
  isSaved: boolean
  isSaving: boolean
  onSave: () => void
  onUnsave: () => void
}

function AdCard({
  pageName, body, title, snapshotUrl, startTime,
  platforms, isSaved, isSaving, onSave, onUnsave,
}: AdCardProps) {
  return (
    <div className="border rounded-xl bg-card hover:shadow-md transition-all duration-150 flex flex-col overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        <div className={cn("size-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0", avatarColor(pageName))}>
          {pageName[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{pageName}</p>
          {startTime && (
            <p className="text-xs text-muted-foreground">Since {formatDate(startTime)}</p>
          )}
        </div>
      </div>

      <div className="px-4 pb-3 flex-1">
        {body ? (
          <p className="text-sm text-muted-foreground line-clamp-4 leading-relaxed">{body}</p>
        ) : (
          <p className="text-sm text-muted-foreground/40 italic">No ad copy</p>
        )}
        {title && (
          <p className="text-sm font-medium mt-2 line-clamp-2">{title}</p>
        )}
      </div>

      {platforms && platforms.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {platforms.slice(0, 3).map(p => <PlatformPill key={p} platform={p} />)}
        </div>
      )}

      <div className="px-4 py-3 border-t flex items-center gap-2">
        <Button
          size="sm"
          variant={isSaved ? "default" : "outline"}
          className="gap-1.5 text-xs flex-1"
          onClick={isSaved ? onUnsave : onSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <IconLoader2 className="size-3 animate-spin" />
          ) : isSaved ? (
            <IconBookmarkFilled className="size-3" />
          ) : (
            <IconBookmark className="size-3" />
          )}
          {isSaved ? "Saved" : "Save"}
        </Button>
        {snapshotUrl && (
          <Button
            size="sm"
            variant="ghost"
            className="px-2.5"
            onClick={() => window.open(snapshotUrl, "_blank")}
            title="View on Meta Ad Library"
          >
            <IconExternalLink className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

export default function InspoPage() {
  const [subTab, setSubTab] = useState<SubTab>("adscan")

  // Ad Scan state
  const [query, setQuery] = useState("")
  const [country, setCountry] = useState("VN")
  const [adStatus, setAdStatus] = useState("ACTIVE")
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [results, setResults] = useState<AdResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  // Saved Ads state
  const [savedAds, setSavedAds] = useState<SavedAd[]>([])
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())

  const loadSavedAds = useCallback(async () => {
    setLoadingSaved(true)
    try {
      const res = await fetch("/api/inspo/saved")
      const data = await res.json()
      if (data.ads) {
        setSavedAds(data.ads)
        setSavedIds(new Set(data.ads.map((a: SavedAd) => a.ad_archive_id)))
      }
    } catch {
      // silent
    } finally {
      setLoadingSaved(false)
    }
  }, [])

  useEffect(() => {
    loadSavedAds()
  }, [loadSavedAds])

  const handleSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    setSearchError(null)
    setHasSearched(true)
    try {
      const params = new URLSearchParams({ q: query.trim(), country, status: adStatus })
      const res = await fetch(`/api/inspo/adscan?${params}`)
      const data = await res.json()
      if (data.error) {
        setSearchError(data.error)
        setResults([])
      } else {
        setResults(data.ads || [])
      }
    } catch {
      setSearchError("Network error. Please try again.")
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleSave = async (ad: AdResult) => {
    setSavingIds(prev => new Set(prev).add(ad.id))
    try {
      const res = await fetch("/api/inspo/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad_archive_id: ad.id,
          page_name: ad.page_name,
          page_id: ad.page_id,
          ad_body: ad.ad_creative_bodies?.[0],
          ad_title: ad.ad_creative_link_titles?.[0],
          ad_snapshot_url: ad.ad_snapshot_url,
          ad_delivery_start_time: ad.ad_delivery_start_time,
          publisher_platforms: ad.publisher_platforms,
        }),
      })
      if (res.ok) {
        setSavedIds(prev => new Set(prev).add(ad.id))
        loadSavedAds()
      }
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(ad.id); return n })
    }
  }

  const handleUnsave = async (archiveId: string, dbId?: string) => {
    setSavingIds(prev => new Set(prev).add(archiveId))
    try {
      const savedAd = savedAds.find(a => a.ad_archive_id === archiveId)
      const id = dbId || savedAd?.id
      if (!id) return
      const res = await fetch(`/api/inspo/saved/${id}`, { method: "DELETE" })
      if (res.ok) {
        setSavedIds(prev => { const n = new Set(prev); n.delete(archiveId); return n })
        setSavedAds(prev => prev.filter(a => a.id !== id))
      }
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(archiveId); return n })
    }
  }

  const selectClass = "h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b shrink-0">
        <h1 className="font-heading text-xl font-bold">Inspo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Research competitors, scan winning ads, and generate creative inspiration.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-6 border-b shrink-0">
        {[
          { id: "adscan", label: "Ad Scan", icon: IconScan },
          { id: "ai", label: "AI", icon: IconSparkles },
          { id: "create", label: "Create", icon: IconPencil },
          { id: "brand-spy", label: "Brand Spy", icon: IconBinoculars },
          { id: "saved", label: "Saved Ads", icon: IconBookmark },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id as SubTab)}
            className={cn(
              "flex items-center gap-1.5 px-0 py-3 mr-7 text-sm border-b-2 transition-colors",
              subTab === t.id
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
            {t.id === "saved" && savedIds.size > 0 && (
              <span className="ml-0.5 min-w-[18px] h-[18px] text-xs bg-primary text-primary-foreground rounded-full flex items-center justify-center px-1">
                {savedIds.size}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">

        {/* ── Ad Scan ── */}
        {subTab === "adscan" && (
          <div className="h-full flex flex-col">
            <div className="px-6 py-4 border-b shrink-0">
              <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search by brand or keyword..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                    className="pl-9"
                  />
                </div>
                <select
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className={selectClass}
                >
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <select
                  value={adStatus}
                  onChange={e => setAdStatus(e.target.value)}
                  className={selectClass}
                >
                  {STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <Button
                  onClick={handleSearch}
                  disabled={searching || !query.trim()}
                  className="gap-2 shrink-0"
                >
                  {searching
                    ? <IconLoader2 className="size-4 animate-spin" />
                    : <IconSearch className="size-4" />
                  }
                  Search
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {searching ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                  <IconLoader2 className="size-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Searching Meta Ad Library...</p>
                </div>
              ) : searchError ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                  <IconAlertCircle className="size-10 text-destructive/50" />
                  <div>
                    <p className="font-medium text-sm">Search failed</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">{searchError}</p>
                  </div>
                  {(searchError.includes("permission") || searchError.includes("Permission")) && (
                    <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-4 text-left max-w-sm space-y-2">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Cách fix:</p>
                      <ol className="text-xs text-amber-700 dark:text-amber-400 space-y-1.5 list-decimal list-inside">
                        <li>Vào <strong>Connect → Meta</strong> và reconnect lại tài khoản để refresh token</li>
                        <li>Hoặc vào <strong>facebook.com/ads/library</strong>, xác minh danh tính lần đầu</li>
                      </ol>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" className="text-xs gap-1.5 flex-1" onClick={() => window.open(`https://facebook.com/ads/library?q=${encodeURIComponent(query)}&active_status=active&ad_type=all&country=all&is_targeted_country=false&media_type=all`, "_blank")}>
                          <IconExternalLink className="size-3" />
                          Mở Meta Ad Library
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs" onClick={handleSearch}>
                          Retry
                        </Button>
                      </div>
                    </div>
                  )}
                  {!searchError.includes("permission") && !searchError.includes("Permission") && (
                    <Button size="sm" variant="outline" onClick={handleSearch}>
                      Try again
                    </Button>
                  )}
                </div>
              ) : !hasSearched ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
                  <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <IconScan className="size-8 text-muted-foreground/40" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Scan competitor ads</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                      Search by brand name or keyword to discover active ads from Meta Ad Library
                    </p>
                  </div>
                </div>
              ) : results.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
                  <IconSearch className="size-10 text-muted-foreground/20" />
                  <div>
                    <p className="font-medium">No ads found</p>
                    <p className="text-sm text-muted-foreground mt-1">Try a different keyword or country</p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground mb-4">{results.length} ads found</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {results.map(ad => (
                      <AdCard
                        key={ad.id}
                        archiveId={ad.id}
                        pageName={ad.page_name}
                        body={ad.ad_creative_bodies?.[0]}
                        title={ad.ad_creative_link_titles?.[0]}
                        snapshotUrl={ad.ad_snapshot_url}
                        startTime={ad.ad_delivery_start_time}
                        platforms={ad.publisher_platforms}
                        isSaved={savedIds.has(ad.id)}
                        isSaving={savingIds.has(ad.id)}
                        onSave={() => handleSave(ad)}
                        onUnsave={() => handleUnsave(ad.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Saved Ads ── */}
        {subTab === "saved" && (
          <div className="h-full flex flex-col">
            <div className="px-6 py-4 border-b shrink-0 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Saved Ads</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {savedAds.length} ad{savedAds.length !== 1 ? "s" : ""} saved
                </p>
              </div>
              {savedAds.length > 0 && (
                <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={() => setSubTab("adscan")}>
                  <IconScan className="size-3.5" />
                  Scan more
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingSaved ? (
                <div className="flex items-center justify-center h-64">
                  <IconLoader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : savedAds.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
                  <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <IconBookmark className="size-8 text-muted-foreground/40" />
                  </div>
                  <div>
                    <h3 className="font-semibold">No saved ads yet</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Scan competitors and save ads that inspire you
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="gap-2 mt-1" onClick={() => setSubTab("adscan")}>
                    <IconScan className="size-3.5" />
                    Go to Ad Scan
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {savedAds.map(ad => (
                    <AdCard
                      key={ad.id}
                      archiveId={ad.ad_archive_id}
                      pageName={ad.page_name}
                      body={ad.ad_body}
                      title={ad.ad_title}
                      snapshotUrl={ad.ad_snapshot_url}
                      startTime={ad.ad_delivery_start_time}
                      platforms={ad.publisher_platforms}
                      isSaved={true}
                      isSaving={savingIds.has(ad.ad_archive_id)}
                      onSave={() => {}}
                      onUnsave={() => handleUnsave(ad.ad_archive_id, ad.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Coming Soon tabs ── */}
        {(subTab === "ai" || subTab === "create" || subTab === "brand-spy") && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center">
              {subTab === "ai" && <IconSparkles className="size-8 text-muted-foreground/40" />}
              {subTab === "create" && <IconPencil className="size-8 text-muted-foreground/40" />}
              {subTab === "brand-spy" && <IconBinoculars className="size-8 text-muted-foreground/40" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold">Coming Soon</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                {subTab === "ai" && "AI-powered analysis of saved ads — hooks, messaging structure, and copy suggestions"}
                {subTab === "create" && "Generate ad creatives and copy directly from your saved inspiration"}
                {subTab === "brand-spy" && "Monitor competitor brands and track their ad strategy over time"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
