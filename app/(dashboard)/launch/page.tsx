"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useAdAccount } from "@/lib/ad-account-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  IconSearch, IconX, IconPlus, IconUpload, IconFolder,
  IconRefresh, IconLayoutGrid, IconTable, IconRocket,
  IconCalendar, IconEye, IconBookmark, IconChevronDown,
  IconLoader2, IconPhoto, IconVideo, IconCopy, IconTrash,
  IconCheck, IconSettings, IconTextCaption, IconWorld,
  IconPlayerPlay, IconAlertCircle, IconAlertTriangle,
  IconCircleCheck, IconDotsVertical, IconMinus, IconBrandMeta,
  IconExternalLink, IconBrandFacebook, IconBrandInstagram,
  IconUsers, IconLanguage, IconStack2, IconLayout,
  IconClock, IconPencil, IconInfoCircle, IconArrowsUpDown,
  IconSelector, IconChevronUp, IconFolderOpen, IconDeviceFloppy,
  IconFileDescription, IconBuildingStore, IconShoppingBag, IconBox,
  IconBrandGoogleDrive, IconClipboard, IconDots, IconBrandMeta as IconMetaBadge,
  IconArrowsSort,
  IconBrandTiktok, IconBrandSnapchat, IconBrandReddit, IconBrandLinkedin,
  IconDownload, IconThumbUp, IconMessageCircle, IconShare3,
  IconArrowLeft, IconArrowRight,
  IconHeart, IconBookmark as IconBookmarkOutline, IconSend, IconArrowUp, IconArrowDown,
  IconHome, IconUser, IconBrandFacebook as IconFb,
  IconVolumeOff, IconMaximize, IconPlayerPause, IconPlus as IconPlusFollow,
  IconCurrencyDollar, IconTarget, IconTrendingUp,
  IconFilter, IconWorldPin,
} from "@tabler/icons-react"
import { CreativeCardMedia } from "@/components/creative-card-media"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdSet { id: string; name: string; status: string; effective_status: string; campaign_id: string; daily_budget?: string }
interface Creative { id: string; file_name: string; file_url: string; media_type: "image" | "video"; headline?: string; primary_text?: string; cta?: string; link_url?: string; fb_image_url?: string; fb_thumbnail_url?: string; fb_image_hash?: string; fb_video_id?: string; created_at?: string; transcript?: string; tags?: string[] }
interface IgAccount { id: string; username?: string; profile_pic?: string }
interface FacebookPage { id: string; name: string; picture?: { data: { url: string } }; instagram_accounts?: { data: IgAccount[] } }
interface AdAccountItem { id: string; name: string; account_id?: string }
interface TableRow { id: string; creative: Creative | null; adName: string; primaryText: string; headline: string; description: string; adSetIds: string[] }
interface LaunchResult { created: number; failed: number; durationMs: number; errors: { adSetId: string; fileName: string; error: string }[] }
interface UploadItem {
  id: string
  file: File
  filename: string
  fileSize: number
  fileTypeShort: string
  status: "uploading" | "completed" | "cancelled" | "error"
  uploaded: number
  speed: number
  eta: number
  error?: string
  xhr?: XMLHttpRequest
  startedAt: number
  creativeId?: string
}

interface PartnershipState {
  enabled: boolean
  partnerPageId: string
  partnerIgId: string
  displayMode: "dynamic" | "both" | "first"
  partnerFirstInDisplay: boolean
}
interface LanguageTranslation {
  language: string
  primaryText: string
  headline: string
  description: string
}
interface MultilanguageState {
  enabled: boolean
  defaultLanguage: string
  translations: LanguageTranslation[]
}
type AdFormatType = "single" | "collection" | "catalog"
interface AdFormatState {
  type: AdFormatType
}
interface CollectionAdsState {
  enabled: boolean
  catalogId: string
  catalogName: string
  catalogVertical: string
  productSetId: string
  productSetName: string
  order: "dynamic" | "specific"
  productHeadlineChips: string[]
  productDescriptionChips: string[]
  buttonLabel: string
  destinationUrl: string
}
interface CatalogItem { id: string; name: string; product_count?: number; vertical?: string }
interface ProductSetItem { id: string; name: string; product_count?: number }
interface CatalogProductItem { id: string; name?: string; image_url?: string; price?: string; brand?: string }

interface CarouselCard {
  creativeId: string
  headline?: string
  description?: string
  linkUrl?: string
  cta?: string
}
interface CarouselAd {
  id: string
  name: string
  cards: CarouselCard[]
  showAsCollectionTiles: boolean
  showAsSingleMedia: boolean
}
interface CarouselAdsState {
  enabled: boolean
  carousels: CarouselAd[]
}

interface FlexibleGroup {
  id: string
  creativeIds: string[]
}
interface FlexibleAd {
  id: string
  name: string
  groups: FlexibleGroup[]
}
interface FlexibleAdsState {
  enabled: boolean
  flexibleAds: FlexibleAd[]
}

interface MultiPlacementGroup {
  id: string
  name: string
  creativeIds: string[]
  // optional manual placement mapping creativeId -> placement key
  placements?: Record<string, string[]>
}
interface MultiPlacementAdsState {
  enabled: boolean
  manualPlacements: boolean
  groups: MultiPlacementGroup[]
}

interface CatalogAdsState {
  enabled: boolean
  formatMode: "automatic" | "manual"
  format: "single" | "carousel"
  frameImageUrl: string
  dynamicMedia: {
    optimizedMediaSelection: boolean
    automaticVideoCropping: boolean
    prioritizeVideo: boolean
  }
  catalogId: string
  catalogName: string
  productSetId: string
  productSetName: string
  hideAutoCreatedSets: boolean
}

// Available template variables for product fields (Meta DPA placeholders)
const PRODUCT_FIELD_OPTIONS = [
  { key: "product_name", label: "Product Name" },
  { key: "current_price", label: "Current Price" },
  { key: "sale_price", label: "Sale Price" },
  { key: "brand", label: "Brand" },
  { key: "description", label: "Description" },
]
interface LaunchBatch {
  id: string
  user_name: string
  ad_account_id: string
  ad_account_name: string
  adset_ids: string[]
  adset_names: string[]
  creative_ids: string[]
  creative_thumbs: string[]
  primary_text: string
  headline: string
  status: "success" | "partial" | "failed"
  total_ads: number
  failed_ads: number
  duration_ms: number
  created_at: string
  errors: any[]
}

// Facebook ads-supported languages (Meta locale codes)
const FB_LANGUAGES = [
  { code: "en_US", name: "English (US)" },
  { code: "en_GB", name: "English (UK)" },
  { code: "es_ES", name: "Spanish (Spain)" },
  { code: "es_LA", name: "Spanish (Latin America)" },
  { code: "fr_FR", name: "French" },
  { code: "de_DE", name: "German" },
  { code: "it_IT", name: "Italian" },
  { code: "pt_BR", name: "Portuguese (Brazil)" },
  { code: "pt_PT", name: "Portuguese (Portugal)" },
  { code: "ja_JP", name: "Japanese" },
  { code: "ko_KR", name: "Korean" },
  { code: "zh_CN", name: "Chinese (Simplified)" },
  { code: "zh_TW", name: "Chinese (Traditional)" },
  { code: "vi_VN", name: "Vietnamese" },
  { code: "th_TH", name: "Thai" },
  { code: "ar_AR", name: "Arabic" },
  { code: "hi_IN", name: "Hindi" },
  { code: "id_ID", name: "Indonesian" },
  { code: "ms_MY", name: "Malay" },
  { code: "nl_NL", name: "Dutch" },
  { code: "pl_PL", name: "Polish" },
  { code: "ru_RU", name: "Russian" },
  { code: "tr_TR", name: "Turkish" },
  { code: "sv_SE", name: "Swedish" },
]

const CTA_OPTIONS = [
  { value: "LEARN_MORE", label: "Learn More" },
  { value: "SHOP_NOW", label: "Shop Now" },
  { value: "SIGN_UP", label: "Sign Up" },
  { value: "DOWNLOAD", label: "Download" },
  { value: "GET_OFFER", label: "Get Offer" },
  { value: "CONTACT_US", label: "Contact Us" },
  { value: "SUBSCRIBE", label: "Subscribe" },
  { value: "WATCH_MORE", label: "Watch More" },
  { value: "APPLY_NOW", label: "Apply Now" },
  { value: "ORDER_NOW", label: "Order Now" },
  { value: "GET_QUOTE", label: "Get Quote" },
  { value: "BOOK_TRAVEL", label: "Book Now" },
]

function formatDuration(ms: number): string {
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60000)
  const secs = Math.round((ms % 60000) / 1000)
  return `${mins}min ${secs}s`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}

// ─── Platform Status Popover ──────────────────────────────────────────────────

interface ServiceStatus { label: string; status: "operational" | "degraded" | "down" | "unknown" }

function PlatformStatusPopover() {
  const [open, setOpen] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)
  const [metaApi, setMetaApi] = useState<ServiceStatus>({ label: "Marketing API", status: "unknown" })
  const [adsManager, setAdsManager] = useState<ServiceStatus>({ label: "Ads Manager", status: "unknown" })
  const ref = useRef<HTMLDivElement>(null)

  const checkStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/facebook/ad-accounts")
      const ok = res.ok
      setMetaApi({ label: "Marketing API", status: ok ? "operational" : "degraded" })
      setAdsManager({ label: "Ads Manager", status: ok ? "operational" : "degraded" })
    } catch {
      setMetaApi({ label: "Marketing API", status: "down" })
      setAdsManager({ label: "Ads Manager", status: "down" })
    }
    setUpdatedAt(new Date())
    setLoading(false)
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Auto-check on mount, then every 5 minutes
  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const allOk = metaApi.status === "operational" && adsManager.status === "operational"

  const StatusBadge = ({ status }: { status: ServiceStatus["status"] }) => {
    if (status === "operational") return <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium"><IconCircleCheck className="size-3.5" />Operational</span>
    if (status === "degraded") return <span className="flex items-center gap-1 text-amber-500 text-xs font-medium"><IconAlertTriangle className="size-3.5" />Degraded</span>
    if (status === "down") return <span className="flex items-center gap-1 text-red-500 text-xs font-medium"><IconAlertCircle className="size-3.5" />Down</span>
    return <span className="text-xs text-muted-foreground">Checking...</span>
  }

  const minutesAgo = updatedAt ? Math.floor((Date.now() - updatedAt.getTime()) / 60000) : null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 hover:opacity-70 transition-opacity"
      >
        <div className={cn("size-1.5 rounded-full", allOk && updatedAt ? "bg-green-500" : "bg-muted-foreground/40")} />
        <span className="text-[10px] text-muted-foreground font-medium tracking-wide">Status</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-popover border rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm font-semibold">Platform Status</span>
            <div className="flex items-center gap-2">
              {minutesAgo !== null && (
                <span className="text-[11px] text-muted-foreground">Updated {minutesAgo}m ago</span>
              )}
              <button onClick={checkStatus} disabled={loading} className="hover:opacity-70 transition-opacity">
                <IconRefresh className={cn("size-3.5 text-muted-foreground", loading && "animate-spin")} />
              </button>
            </div>
          </div>

          <div className="px-4 py-3 space-y-3">
            {/* Meta API */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Meta API</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Ads Manager</span>
                  <StatusBadge status={adsManager.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Marketing API</span>
                  <StatusBadge status={metaApi.status} />
                </div>
              </div>
            </div>

            {/* Launcher */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Launcher</p>
              <div className="flex items-center justify-between">
                <span className="text-sm">App Server</span>
                <StatusBadge status="operational" />
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="px-4 py-2.5 border-t flex flex-wrap gap-x-3 gap-y-1">
            <a href="https://metastatus.com" target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-primary hover:underline flex items-center gap-0.5">
              <IconExternalLink className="size-3" />Meta Status
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Ad Account Dropdown ──────────────────────────────────────────────────────

function AdAccountDropdown({ accounts, selectedId, onSelect }: {
  accounts: AdAccountItem[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const selected = accounts.find(a => a.id === selectedId)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = accounts.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.id.includes(search)
  )

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="h-8 flex items-center gap-1.5 px-3 rounded-lg border bg-background hover:bg-muted/40 transition-colors min-w-[180px] max-w-[240px] text-sm"
      >
        <IconBrandMeta className="size-3.5 text-[#0064E0] shrink-0" />
        <span className="truncate flex-1 text-left">{selected?.name || "Select account..."}</span>
        <IconChevronDown className="size-3.5 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-popover border rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Search */}
          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search account..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/40 border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          {/* Account list */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.map(a => {
              const isSelected = a.id === selectedId
              return (
                <button
                  key={a.id}
                  onClick={() => { onSelect(a.id); setOpen(false); setSearch("") }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left",
                    isSelected && "bg-primary/5"
                  )}
                >
                  <div className="size-4 shrink-0">
                    {isSelected && <IconCheck className="size-4 text-primary" />}
                  </div>
                  <div className="size-5 rounded-full bg-[#0064E0]/10 flex items-center justify-center shrink-0">
                    <IconBrandMeta className="size-3 text-[#0064E0]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground">{a.id}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="border-t">
            <button className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <IconPlus className="size-3.5" />
              Add or edit ad accounts
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Ad Profiles Modal ────────────────────────────────────────────────────────

function AdProfilesModal({
  open, onClose, pages,
  selectedPageId, selectedIgId,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  pages: FacebookPage[]
  selectedPageId: string
  selectedIgId: string
  onConfirm: (pageId: string, igId: string, igCache: Record<string, IgAccount[]>) => void
}) {
  const [search, setSearch] = useState("")
  const [showAvailableOnly, setShowAvailableOnly] = useState(false)
  const [localPageId, setLocalPageId] = useState(selectedPageId)
  const [localIgId, setLocalIgId] = useState(selectedIgId)
  const [igByPage, setIgByPage] = useState<Record<string, IgAccount[]>>({})
  const [igLoading, setIgLoading] = useState(false)

  const fetchIgAccounts = async () => {
    if (pages.length === 0) return
    setIgLoading(true)
    try {
      const res = await fetch("/api/facebook/page-instagram")
      if (res.ok) {
        const data = await res.json()
        const map: Record<string, IgAccount[]> = {}
        for (const r of (data.results || [])) {
          map[r.pageId] = r.igAccounts || []
        }
        setIgByPage(map)
      }
    } catch {}
    setIgLoading(false)
  }

  useEffect(() => {
    if (open) {
      setLocalPageId(selectedPageId)
      setLocalIgId(selectedIgId)
      fetchIgAccounts()
    }
  }, [open, selectedPageId, selectedIgId])

  const [igExpanded, setIgExpanded] = useState<Record<string, boolean>>({})
  const [fetchTime, setFetchTime] = useState<number | null>(null)

  const fetchIgAccountsTimed = async () => {
    const t = Date.now()
    await fetchIgAccounts()
    setFetchTime(Date.now() - t)
  }

  const filtered = pages.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search)
  )

  const totalIg = Object.values(igByPage).reduce((n, arr) => n + arr.length, 0)

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl p-0 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b shrink-0">
          <DialogTitle className="text-base font-semibold">Ad Profiles</DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            These pages will be used as the profiles to launch your ads under. Missing pages or Instagram accounts?
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs">
            <a href="#" className="text-primary hover:underline">Help</a>
            <span className="text-muted-foreground">|</span>
            <a href="#" className="text-primary hover:underline flex items-center gap-0.5">
              Re-authenticate <IconExternalLink className="size-3 ml-0.5" />
            </a>
            <span className="text-muted-foreground">|</span>
            <a href="#" className="text-primary hover:underline flex items-center gap-0.5">
              <IconBrandMeta className="size-3 mr-0.5" /> See granted permissions
            </a>
          </div>
          {/* Search + filters */}
          <div className="flex items-center gap-2 mt-3">
            <div className="relative flex-1">
              <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search profiles..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/40 border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 shrink-0" onClick={fetchIgAccountsTimed} disabled={igLoading}>
              <IconRefresh className={cn("size-3.5", igLoading && "animate-spin")} />Refresh
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={showAvailableOnly} onChange={e => setShowAvailableOnly(e.target.checked)} className="rounded size-3" />
              Show available only
            </label>
          </div>
        </div>

        {/* Section sub-header */}
        <div className="px-5 py-2 border-b shrink-0 flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground flex-1">
            Ad Account Pages ({pages.length} Pages, {igLoading ? "..." : totalIg} Instagrams)
          </span>
          {fetchTime !== null && !igLoading && (
            <span className="text-[11px] text-muted-foreground">Refreshed in {(fetchTime / 1000).toFixed(1)}s</span>
          )}
        </div>

        {/* Pages list */}
        <div className="overflow-y-auto px-3 py-2 flex-1 min-h-0">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">No pages found</div>
          ) : filtered.map(page => {
            const isPageSelected = localPageId === page.id
            const igAccounts = igByPage[page.id] || []
            const igCount = igAccounts.length + 1 // +1 for "Use Facebook Page"
            const expanded = igExpanded[page.id] !== false // default expanded

            return (
              <div key={page.id} className={cn("border rounded-xl mb-2 overflow-hidden bg-background transition-colors", isPageSelected ? "border-primary/60" : "border-border")}>

                {/* "Facebook Page" type label */}
                <div className="flex items-center gap-1 px-3 pt-2 pb-0">
                  <IconBrandMeta className="size-3 text-[#0064E0]" />
                  <span className="text-[10px] text-muted-foreground font-medium">Facebook Page</span>
                </div>

                {/* Page main row */}
                <div
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => {
                    setLocalPageId(page.id)
                  }}
                >
                  {/* Checkbox */}
                  <div className={cn(
                    "size-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                    isPageSelected ? "bg-primary border-primary" : "border-muted-foreground/40 bg-background"
                  )}>
                    {isPageSelected && <IconCheck className="size-3 text-primary-foreground" />}
                  </div>
                  {page.picture?.data?.url ? (
                    <img src={page.picture.data.url} className="size-9 rounded-full shrink-0 object-cover" alt="" />
                  ) : (
                    <div className="size-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-muted-foreground">{page.name.slice(0, 1)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold truncate">{page.name}</span>
                      <IconCircleCheck className="size-3.5 text-blue-500 shrink-0" />
                      <IconExternalLink className="size-3 text-muted-foreground/50 shrink-0" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{page.id}</p>
                  </div>
                </div>

                {/* Associated Instagram Accounts — collapsible, always show */}
                <div className="border-t">
                  <button
                    className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-muted/20 transition-colors"
                    onClick={() => setIgExpanded(prev => ({ ...prev, [page.id]: !expanded }))}
                  >
                    <IconChevronDown className={cn("size-3 transition-transform", !expanded && "-rotate-90")} />
                    <IconBrandInstagram className="size-3 text-[#E1306C]" />
                    <span>Associated Instagram Accounts ({igLoading ? "..." : igAccounts.length})</span>
                  </button>

                  {expanded && (
                    <div className="px-3 pb-2 space-y-1">
                      {/* Use Facebook Page */}
                      <div
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors",
                          localIgId === `fb_${page.id}` && "bg-primary/8"
                        )}
                        onClick={() => setLocalIgId(`fb_${page.id}`)}
                      >
                        <div className={cn(
                          "size-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                          localIgId === `fb_${page.id}` ? "bg-primary border-primary" : "border-muted-foreground/40 bg-background"
                        )}>
                          {localIgId === `fb_${page.id}` && <IconCheck className="size-3 text-primary-foreground" />}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <IconBrandMeta className="size-4 text-[#0064E0]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Use Facebook Page</p>
                          <p className="text-[11px] text-muted-foreground">{page.id}</p>
                        </div>
                      </div>

                      {/* Real IG accounts */}
                      {igAccounts.map(ig => (
                        <div
                          key={ig.id}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors",
                            localIgId === ig.id && "bg-primary/8"
                          )}
                          onClick={() => setLocalIgId(ig.id)}
                        >
                          <div className={cn(
                            "size-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                            localIgId === ig.id ? "bg-primary border-primary" : "border-muted-foreground/40 bg-background"
                          )}>
                            {localIgId === ig.id && <IconCheck className="size-3 text-primary-foreground" />}
                          </div>
                          {ig.profile_pic ? (
                            <img src={ig.profile_pic} className="size-7 rounded-full object-cover shrink-0" alt="" />
                          ) : (
                            <div className="size-7 rounded-full bg-gradient-to-br from-purple-400 to-rose-400 flex items-center justify-center shrink-0">
                              <IconBrandInstagram className="size-3.5 text-white" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">@{ig.username || ig.id}</p>
                            <p className="text-[11px] text-muted-foreground">{ig.id}</p>
                          </div>
                        </div>
                      ))}

                      {igLoading && igAccounts.length === 0 && (
                        <p className="text-[11px] text-muted-foreground px-3 py-1">Loading...</p>
                      )}
                      {!igLoading && igAccounts.length === 0 && (
                        <p className="text-[11px] text-muted-foreground px-3 py-1">No Instagram accounts associated</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t shrink-0">
          <Button
            className="w-full"
            onClick={() => { onConfirm(localPageId, localIgId, igByPage); onClose() }}
          >
            Confirm Selection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Partnership Ads Modal ────────────────────────────────────────────────────

function PartnershipAdsModal({
  open, onClose, pages, selectedPageId, selectedIgId, igAccountCache,
  value, onConfirm,
}: {
  open: boolean
  onClose: () => void
  pages: FacebookPage[]
  selectedPageId: string
  selectedIgId: string
  igAccountCache: Record<string, IgAccount[]>
  value: PartnershipState
  onConfirm: (v: PartnershipState) => void
}) {
  const [local, setLocal] = useState<PartnershipState>(value)
  const [partnerSearchOpen, setPartnerSearchOpen] = useState(false)
  const [partnerSearch, setPartnerSearch] = useState("")
  const [manualPageId, setManualPageId] = useState("")

  useEffect(() => { if (open) setLocal(value) }, [open, value])

  const selectedPage = pages.find(p => p.id === selectedPageId)
  const isFbActor = selectedIgId.startsWith("fb_")
  const igAccount = Object.values(igAccountCache).flat().find(ig => ig.id === selectedIgId)
  const igLabel = isFbActor ? `@${selectedPage?.name || ""}` : (igAccount?.username ? `@${igAccount.username}` : selectedIgId)

  const partnerPage = pages.find(p => p.id === local.partnerPageId)
  const partnerIg = Object.values(igAccountCache).flat().find(ig => ig.id === local.partnerIgId)
  const partnerIsFbActor = local.partnerIgId.startsWith("fb_")
  const hasPartner = !!local.partnerPageId

  // Identities — order based on swap state
  const identityA = local.partnerFirstInDisplay && hasPartner
    ? { page: partnerPage, igId: local.partnerIgId, isFb: partnerIsFbActor, ig: partnerIg, isManual: !partnerPage }
    : { page: selectedPage, igId: selectedIgId, isFb: isFbActor, ig: igAccount, isManual: false }
  const identityB = local.partnerFirstInDisplay && hasPartner
    ? { page: selectedPage, igId: selectedIgId, isFb: isFbActor, ig: igAccount, isManual: false }
    : { page: partnerPage, igId: local.partnerIgId, isFb: partnerIsFbActor, ig: partnerIg, isManual: hasPartner && !partnerPage }

  const availablePartners = pages.filter(p =>
    p.id !== selectedPageId &&
    (!partnerSearch || p.name.toLowerCase().includes(partnerSearch.toLowerCase()) || p.id.includes(partnerSearch))
  )

  const addPartner = (pageId: string, igId?: string) => {
    setLocal(s => ({ ...s, partnerPageId: pageId, partnerIgId: igId || `fb_${pageId}` }))
    setPartnerSearchOpen(false)
    setPartnerSearch("")
    setManualPageId("")
  }
  const removePartner = () => {
    setLocal(s => ({ ...s, partnerPageId: "", partnerIgId: "", partnerFirstInDisplay: false }))
  }
  const swapIdentities = () => {
    if (!hasPartner) return
    setLocal(s => ({ ...s, partnerFirstInDisplay: !s.partnerFirstInDisplay }))
  }
  const toggleEnabled = () => {
    setLocal(s => ({ ...s, enabled: !s.enabled }))
  }
  const handleSave = () => {
    onConfirm(hasPartner ? local : { ...local, enabled: false })
    onClose()
  }

  const OPTIONS = [
    { value: "dynamic" as const, title: "Dynamic identity.", desc: "Uses the version that's likely to perform best" },
    { value: "both" as const, title: "Both identities in the header.", desc: "Showcases your partnership and cross-promotes accounts" },
    { value: "first" as const, title: "First identity only in the header.", desc: "Displaying the first identity leverages your partner's voice" },
  ]

  const renderIdentityCell = (id: typeof identityA, label: "Facebook" | "Instagram", showFbActions: boolean) => (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2 min-h-[20px]">
        <div className="flex items-center gap-1.5">
          {label === "Facebook"
            ? <IconBrandMeta className="size-3.5 text-[#0064E0]" />
            : <IconBrandInstagram className="size-3.5 text-[#E1306C]" />}
          <span className="text-sm font-medium">{label}</span>
        </div>
        {label === "Facebook" && showFbActions && (
          <div className="flex items-center gap-3 text-xs">
            <button className="flex items-center gap-0.5 text-muted-foreground hover:text-foreground">
              <IconExternalLink className="size-3" />View
            </button>
            <button className="flex items-center gap-0.5 text-muted-foreground hover:text-foreground">
              <IconSearch className="size-3" />Search custom
            </button>
          </div>
        )}
      </div>
      {label === "Facebook" ? (
        <button className="w-full flex items-center gap-2 px-2.5 py-2 border rounded-lg bg-background hover:bg-muted/30 transition-colors">
          {id.page?.picture?.data?.url ? (
            <img src={id.page.picture.data.url} className="size-5 rounded-full shrink-0 object-cover" alt="" />
          ) : (
            <div className="size-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-emerald-700">{(id.page?.name || id.igId)?.slice(0, 1) || "?"}</span>
            </div>
          )}
          <span className="flex-1 text-sm truncate text-left">
            {id.page?.name || (id.isManual ? `Page ${id.igId}` : "—")}
          </span>
          <IconSelector className="size-3.5 text-muted-foreground shrink-0" />
        </button>
      ) : (
        <button className="w-full flex items-center gap-2 px-2.5 py-2 border rounded-lg bg-background hover:bg-muted/30 transition-colors">
          {id.ig?.profile_pic && !id.isFb ? (
            <img src={id.ig.profile_pic} className="size-5 rounded-full shrink-0 object-cover" alt="" />
          ) : (
            <div className="size-5 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
              <IconBrandInstagram className="size-3 text-[#E1306C]" />
            </div>
          )}
          <span className="flex-1 text-sm truncate text-left">
            {id.isFb ? `Use ${id.page?.name || "Facebook Page"}` : (id.ig?.username ? `@${id.ig.username}` : id.igId || "—")}
          </span>
          <IconSelector className="size-3.5 text-muted-foreground shrink-0" />
        </button>
      )}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl p-0 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b shrink-0">
          <DialogTitle className="text-base font-semibold">Partnership Ads</DialogTitle>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Info card */}
          <div className="border rounded-xl p-3 flex items-start gap-3">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <IconUsers className="size-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Partnership ads</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select a partner identity to activate partnership ads for this launch. Searching partners for {igLabel || `@${selectedPage?.name || "Use Facebook Page"}`}.
              </p>
            </div>
          </div>

          {/* Select Identity row */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs px-3">Select Identity</Button>
            <button className="text-muted-foreground hover:text-foreground" title="Refresh identities">
              <IconRefresh className="size-3.5" />
            </button>
          </div>

          {/* First Identity */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-muted-foreground">First Identity {local.partnerFirstInDisplay && hasPartner && <span className="text-primary">(Partner)</span>}</p>
            </div>
            <div className="border rounded-xl overflow-hidden">
              <div className="grid grid-cols-2 divide-x">
                {renderIdentityCell(identityA, "Facebook", true)}
                {renderIdentityCell(identityA, "Instagram", false)}
              </div>
            </div>
          </div>

          {/* Second Identity */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-muted-foreground">Second Identity {local.partnerFirstInDisplay && hasPartner && <span className="text-muted-foreground">(You)</span>}</p>
              <div className="flex items-center gap-3 text-xs">
                <button
                  onClick={swapIdentities}
                  disabled={!hasPartner}
                  className={cn(
                    "flex items-center gap-0.5 transition-colors",
                    hasPartner ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/40 cursor-not-allowed"
                  )}
                >
                  <IconArrowsUpDown className="size-3" />Swap
                </button>
                <button
                  onClick={removePartner}
                  disabled={!hasPartner}
                  className={cn(
                    "flex items-center gap-0.5 transition-colors",
                    hasPartner ? "text-muted-foreground hover:text-destructive" : "text-muted-foreground/40 cursor-not-allowed"
                  )}
                >
                  <IconX className="size-3" />Remove
                </button>
              </div>
            </div>

            {hasPartner ? (
              <div className="border rounded-xl overflow-hidden">
                <div className="grid grid-cols-2 divide-x">
                  {renderIdentityCell(identityB, "Facebook", false)}
                  {renderIdentityCell(identityB, "Instagram", false)}
                </div>
              </div>
            ) : !partnerSearchOpen ? (
              <button
                onClick={() => setPartnerSearchOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 py-3 border-2 border-dashed rounded-xl text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
              >
                <IconPlus className="size-4" />Add Partnership Identity
              </button>
            ) : (
              <div className="border rounded-xl p-3 space-y-3 bg-muted/20">
                {/* Search from connected pages */}
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">From your connected pages</p>
                  <div className="relative mb-2">
                    <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                    <input
                      autoFocus
                      value={partnerSearch}
                      onChange={e => setPartnerSearch(e.target.value)}
                      placeholder="Search page name or ID..."
                      className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto bg-background rounded-lg border">
                    {availablePartners.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-muted-foreground">No other pages available</div>
                    ) : availablePartners.map(p => (
                      <button
                        key={p.id}
                        onClick={() => addPartner(p.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/40 text-left transition-colors"
                      >
                        {p.picture?.data?.url ? (
                          <img src={p.picture.data.url} className="size-6 rounded-full shrink-0 object-cover" alt="" />
                        ) : (
                          <div className="size-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold">{p.name.slice(0, 1)}</span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground">{p.id}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Manual page ID */}
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Or enter Partner Page ID</p>
                  <div className="flex gap-2">
                    <input
                      value={manualPageId}
                      onChange={e => setManualPageId(e.target.value)}
                      placeholder="e.g. 123456789012345"
                      className="flex-1 px-3 py-1.5 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                    />
                    <Button size="sm" disabled={!/^\d{5,}$/.test(manualPageId.trim())} onClick={() => addPartner(manualPageId.trim())}>
                      Add
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Partner page must have authorized this app or be a public page.</p>
                </div>

                <div className="flex justify-end">
                  <button onClick={() => setPartnerSearchOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Choose which identities */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <p className="text-sm font-semibold">Choose which identities to display</p>
              <div className="relative group">
                <IconInfoCircle className="size-3.5 text-muted-foreground cursor-help" />
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 px-3 py-2 bg-zinc-900 dark:bg-zinc-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                  Control how identities are displayed in your partnership ads. Dynamic will adapt based on the platform and placement.
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 size-2 bg-zinc-900 dark:bg-zinc-800 rotate-45" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                {OPTIONS.map(opt => (
                  <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                    <div className={cn(
                      "size-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                      local.displayMode === opt.value ? "border-primary" : "border-muted-foreground/30"
                    )}>
                      {local.displayMode === opt.value && <div className="size-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{opt.title}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                    <input type="radio" className="sr-only" checked={local.displayMode === opt.value} onChange={() => setLocal(s => ({ ...s, displayMode: opt.value }))} />
                  </label>
                ))}
              </div>
              <div className="border-2 border-dashed rounded-xl flex items-center justify-center text-center text-sm p-4 min-h-[140px]">
                {!hasPartner || !local.enabled ? (
                  <span className="text-muted-foreground/60">Enable partnership ads to see preview</span>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Ad header will show:</p>
                    {local.displayMode === "first" ? (
                      <p className="text-sm font-semibold">{identityA.page?.name || "First Identity"}</p>
                    ) : (
                      <p className="text-sm font-semibold">
                        {identityA.page?.name || "First"} <span className="text-muted-foreground font-normal">×</span> {identityB.page?.name || "Partner"}
                      </p>
                    )}
                    {local.displayMode === "dynamic" && <p className="text-[10px] text-muted-foreground">(Meta will pick best variant)</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t bg-background shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status</span>
            <button
              onClick={toggleEnabled}
              disabled={!hasPartner}
              className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                local.enabled && hasPartner ? "bg-primary" : "bg-muted-foreground/30",
                !hasPartner && "opacity-50 cursor-not-allowed")}
            >
              <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                local.enabled && hasPartner ? "translate-x-4" : "translate-x-0.5")} />
            </button>
            <span className="text-xs text-muted-foreground">
              {!hasPartner ? "No partner selected" : local.enabled ? "Partnership active" : "Partnership paused"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>Save Confirm</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Multilanguage Ads Modal ──────────────────────────────────────────────────

function MultilanguageAdsModal({
  open, onClose, value, onConfirm,
  basePrimaryText, baseHeadline, baseDescription,
}: {
  open: boolean
  onClose: () => void
  value: MultilanguageState
  onConfirm: (v: MultilanguageState) => void
  basePrimaryText: string
  baseHeadline: string
  baseDescription: string
}) {
  const [local, setLocal] = useState<MultilanguageState>(value)
  const [collapsed, setCollapsed] = useState(false)
  const [langPickerOpen, setLangPickerOpen] = useState(false)
  const [langSearch, setLangSearch] = useState("")

  useEffect(() => { if (open) { setLocal(value); setLangPickerOpen(false); setLangSearch("") } }, [open, value])

  const usedCodes = new Set([local.defaultLanguage, ...local.translations.map(t => t.language)])
  const availableLangs = FB_LANGUAGES.filter(l =>
    !usedCodes.has(l.code) &&
    (!langSearch || l.name.toLowerCase().includes(langSearch.toLowerCase()) || l.code.toLowerCase().includes(langSearch.toLowerCase()))
  )

  const addLanguage = (code: string) => {
    setLocal(s => ({
      ...s,
      translations: [...s.translations, { language: code, primaryText: "", headline: "", description: "" }],
    }))
    setLangPickerOpen(false)
    setLangSearch("")
  }
  const removeLanguage = (code: string) => {
    setLocal(s => ({ ...s, translations: s.translations.filter(t => t.language !== code) }))
  }
  const updateTranslation = (code: string, field: keyof Omit<LanguageTranslation, "language">, val: string) => {
    setLocal(s => ({
      ...s,
      translations: s.translations.map(t => t.language === code ? { ...t, [field]: val } : t),
    }))
  }
  const toggleEnabled = () => setLocal(s => ({ ...s, enabled: !s.enabled }))
  const handleSave = () => {
    const hasTranslations = local.translations.length > 0
    onConfirm(hasTranslations ? local : { ...local, enabled: false })
    onClose()
  }

  const langName = (code: string) => FB_LANGUAGES.find(l => l.code === code)?.name || code

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl p-0 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b shrink-0">
          <DialogTitle className="text-base font-semibold">Multilanguage ads</DialogTitle>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
          <div className="border rounded-xl overflow-hidden">
            {/* Section header */}
            <button
              onClick={() => setCollapsed(c => !c)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <IconLanguage className="size-4" />
                <span className="text-sm font-semibold">Multi-Language Ads</span>
                <div className="relative group">
                  <IconInfoCircle className="size-3.5 text-muted-foreground cursor-help" />
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 px-3 py-2 bg-zinc-900 dark:bg-zinc-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none text-left">
                    Provide translations of your ad text. Meta will show the right version based on viewer language; otherwise the default is used.
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 size-2 bg-zinc-900 dark:bg-zinc-800 rotate-45" />
                  </div>
                </div>
              </div>
              {collapsed
                ? <IconChevronDown className="size-4 text-muted-foreground" />
                : <IconChevronUp className="size-4 text-muted-foreground" />}
            </button>

            {!collapsed && (
              <div className="border-t">
                {/* Language Templates */}
                <div className="bg-muted/20 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconFileDescription className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Language Templates</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                      <IconFolderOpen className="size-3.5" />Load Template
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                      <IconDeviceFloppy className="size-3.5" />Save Template
                    </Button>
                  </div>
                </div>

                {/* Default Language */}
                <div className="px-4 py-4 space-y-3 border-t">
                  <div>
                    <label className="text-sm font-semibold block mb-1.5">Default Language</label>
                    <Select value={local.defaultLanguage} onValueChange={v => setLocal(s => ({ ...s, defaultLanguage: v }))}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FB_LANGUAGES.filter(l => !local.translations.some(t => t.language === l.code)).map(l => (
                          <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      This is the primary language for your ad. It will be shown when viewer's language doesn't match any of your translations.
                    </p>
                  </div>

                  {/* Translations list */}
                  {local.translations.map(t => (
                    <div key={t.language} className="border rounded-xl p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{langName(t.language)}</span>
                        <button
                          onClick={() => removeLanguage(t.language)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="Remove"
                        >
                          <IconX className="size-3.5" />
                        </button>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Primary Text</label>
                        <textarea
                          value={t.primaryText}
                          onChange={e => updateTranslation(t.language, "primaryText", e.target.value)}
                          placeholder={basePrimaryText ? `Translate: "${basePrimaryText.slice(0, 50)}${basePrimaryText.length > 50 ? "..." : ""}"` : "Primary text in " + langName(t.language)}
                          rows={2}
                          className="w-full px-3 py-2 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring resize-none placeholder:text-muted-foreground/50"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Headline</label>
                        <input
                          type="text"
                          value={t.headline}
                          onChange={e => updateTranslation(t.language, "headline", e.target.value)}
                          placeholder={baseHeadline || "Headline in " + langName(t.language)}
                          maxLength={125}
                          className="w-full px-3 py-2 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Description (optional)</label>
                        <input
                          type="text"
                          value={t.description}
                          onChange={e => updateTranslation(t.language, "description", e.target.value)}
                          placeholder={baseDescription || "Description in " + langName(t.language)}
                          className="w-full px-3 py-2 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                        />
                      </div>
                    </div>
                  ))}

                  {/* Add Language */}
                  {!langPickerOpen ? (
                    <button
                      onClick={() => setLangPickerOpen(true)}
                      disabled={availableLangs.length === 0}
                      className={cn(
                        "w-full flex items-center justify-center gap-1.5 py-2.5 border rounded-lg text-sm transition-colors",
                        availableLangs.length === 0
                          ? "text-muted-foreground/50 cursor-not-allowed"
                          : "text-foreground hover:bg-muted/40"
                      )}
                    >
                      <IconPlus className="size-4" />Add Language
                    </button>
                  ) : (
                    <div className="border rounded-xl p-3 space-y-2 bg-muted/20">
                      <div className="relative">
                        <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                        <input
                          autoFocus
                          value={langSearch}
                          onChange={e => setLangSearch(e.target.value)}
                          placeholder="Search language..."
                          className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto bg-background border rounded-lg">
                        {availableLangs.length === 0 ? (
                          <div className="px-3 py-3 text-xs text-muted-foreground">No more languages</div>
                        ) : availableLangs.map(l => (
                          <button
                            key={l.code}
                            onClick={() => addLanguage(l.code)}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/40 text-left transition-colors"
                          >
                            <span className="text-sm">{l.name}</span>
                            <span className="text-[11px] text-muted-foreground font-mono">{l.code}</span>
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-end">
                        <button onClick={() => setLangPickerOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t bg-background shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status</span>
            <button
              onClick={toggleEnabled}
              disabled={local.translations.length === 0}
              className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                local.enabled && local.translations.length > 0 ? "bg-primary" : "bg-muted-foreground/30",
                local.translations.length === 0 && "opacity-50 cursor-not-allowed")}
            >
              <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                local.enabled && local.translations.length > 0 ? "translate-x-4" : "translate-x-0.5")} />
            </button>
            <span className="text-xs text-muted-foreground">
              {local.translations.length === 0
                ? "No translations configured"
                : local.enabled
                  ? `${local.translations.length} translation${local.translations.length > 1 ? "s" : ""} active`
                  : "Translations paused"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}><IconX className="size-3.5 mr-1" />Cancel</Button>
            <Button onClick={handleSave}><IconCheck className="size-3.5 mr-1" />Save Confirm</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Collection Ads / Instant Experience Modal ────────────────────────────────

function CollectionAdsModal({
  open, onClose, value, onConfirm, baseHeadline, baseWebLink,
  onLoadMedia, adAccountId,
}: {
  open: boolean
  onClose: () => void
  value: CollectionAdsState
  onConfirm: (v: CollectionAdsState) => void
  baseHeadline: string
  baseWebLink: string
  onLoadMedia?: () => void
  adAccountId?: string
}) {
  const [local, setLocal] = useState<CollectionAdsState>(value)
  const [collapsed, setCollapsed] = useState(false)
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([])
  const [catalogsLoading, setCatalogsLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string>("")
  const [catalogDebug, setCatalogDebug] = useState<string[]>([])
  const [catalogDropdownOpen, setCatalogDropdownOpen] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState("")
  const [manualCatalogId, setManualCatalogId] = useState("")
  const [manualCatalogLoading, setManualCatalogLoading] = useState(false)
  const [productSets, setProductSets] = useState<ProductSetItem[]>([])
  const [productSetsLoading, setProductSetsLoading] = useState(false)
  const [productSetDropdownOpen, setProductSetDropdownOpen] = useState(false)
  const [products, setProducts] = useState<CatalogProductItem[]>([])
  const catalogRef = useRef<HTMLDivElement>(null)
  const productSetRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (open) setLocal(value) }, [open, value])

  // Load catalogs on open
  useEffect(() => {
    if (!open) return
    fetchCatalogs()
  }, [open, adAccountId])

  // Load product sets + preview when catalog changes
  useEffect(() => {
    if (!local.catalogId) { setProductSets([]); setProducts([]); return }
    setProductSetsLoading(true)
    fetch(`/api/facebook/product-sets?catalog_id=${encodeURIComponent(local.catalogId)}`)
      .then(r => r.json())
      .then(d => {
        setProductSets(d.productSets || [])
        setProducts(d.products || [])
      })
      .catch(() => {})
      .finally(() => setProductSetsLoading(false))
  }, [local.catalogId])

  // Click outside dropdowns
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (catalogRef.current && !catalogRef.current.contains(e.target as Node)) setCatalogDropdownOpen(false)
      if (productSetRef.current && !productSetRef.current.contains(e.target as Node)) setProductSetDropdownOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const fetchCatalogs = async () => {
    setCatalogsLoading(true)
    setCatalogError("")
    try {
      const url = adAccountId
        ? `/api/facebook/catalogs?ad_account_id=${encodeURIComponent(adAccountId)}`
        : "/api/facebook/catalogs"
      const res = await fetch(url)
      const d = await res.json()
      if (!res.ok) {
        setCatalogError(d.error || "Failed to fetch catalogs")
        setCatalogs([])
      } else {
        setCatalogs(d.catalogs || [])
        setCatalogDebug(d.debug || [])
        if ((d.catalogs || []).length === 0) {
          setCatalogError(
            "No catalogs found. Possible reasons: (1) your Facebook account has no Business with catalogs, (2) the connection lacks `business_management` / `catalog_management` permissions, or (3) the ad account isn't linked to a business with catalogs."
          )
        }
      }
    } catch (e: any) {
      setCatalogError(e.message || "Network error")
    }
    setCatalogsLoading(false)
  }

  const filteredCatalogs = catalogs.filter(c =>
    !catalogSearch || c.name.toLowerCase().includes(catalogSearch.toLowerCase()) || c.id.includes(catalogSearch)
  )

  const selectCatalog = (c: CatalogItem) => {
    setLocal(s => ({
      ...s,
      catalogId: c.id, catalogName: c.name, catalogVertical: c.vertical || "",
      productSetId: "", productSetName: "",
    }))
    setCatalogDropdownOpen(false)
    setCatalogSearch("")
  }
  const addManualCatalog = async () => {
    const id = manualCatalogId.trim()
    if (!/^\d{5,}$/.test(id)) return
    setManualCatalogLoading(true)
    try {
      // Try fetching the catalog name by directly hitting product-sets endpoint
      // (it'll succeed if user has access via business_management/catalog_management)
      const res = await fetch(`/api/facebook/product-sets?catalog_id=${encodeURIComponent(id)}`)
      const ok = res.ok
      const name = ok ? `Catalog ${id}` : `Catalog ${id}`
      selectCatalog({ id, name, vertical: "" })
    } catch {
      selectCatalog({ id, name: `Catalog ${id}`, vertical: "" })
    }
    setManualCatalogLoading(false)
    setManualCatalogId("")
  }
  const selectProductSet = (ps: ProductSetItem) => {
    setLocal(s => ({ ...s, productSetId: ps.id, productSetName: ps.name }))
    setProductSetDropdownOpen(false)
  }

  const toggleChip = (field: "productHeadlineChips" | "productDescriptionChips", chipKey: string) => {
    setLocal(s => {
      const arr = s[field]
      return { ...s, [field]: arr.includes(chipKey) ? arr.filter(c => c !== chipKey) : [...arr, chipKey] }
    })
  }
  const removeChip = (field: "productHeadlineChips" | "productDescriptionChips", chipKey: string) => {
    setLocal(s => ({ ...s, [field]: s[field].filter(c => c !== chipKey) }))
  }

  const requiredMissing: string[] = []
  if (!local.catalogId) requiredMissing.push("Select a catalog")
  if (!local.productSetId) requiredMissing.push("Select a product set")
  if (!local.buttonLabel.trim()) requiredMissing.push("Enter button label")
  if (!local.destinationUrl.trim()) requiredMissing.push("Enter destination URL")
  const isValid = requiredMissing.length === 0

  const handleSave = () => {
    onConfirm(isValid ? { ...local, enabled: true } : { ...local, enabled: false })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl p-0 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b shrink-0">
          <DialogTitle className="text-base font-semibold">Collection Ads / Instant Experience</DialogTitle>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
          <div className="border rounded-xl overflow-hidden">
            {/* Section header */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <IconShoppingBag className="size-4" />
                <span className="text-sm font-semibold">Collection Ads / Instant Experience</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLocal(s => ({ ...s, enabled: !s.enabled }))}
                  className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                    local.enabled ? "bg-primary" : "bg-muted-foreground/30")}
                >
                  <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                    local.enabled ? "translate-x-4" : "translate-x-0.5")} />
                </button>
                <button onClick={() => setCollapsed(c => !c)} className="text-muted-foreground hover:text-foreground">
                  {collapsed ? <IconChevronDown className="size-4" /> : <IconChevronUp className="size-4" />}
                </button>
              </div>
            </div>

            {!collapsed && local.enabled && (
              <>
                {/* Presets */}
                <div className="bg-muted/20 border-t px-4 py-2.5 flex items-center justify-between">
                  <span className="text-sm">Collection ad presets</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                      <IconFolderOpen className="size-3.5" />Templates<IconChevronDown className="size-3" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                      <IconDeviceFloppy className="size-3.5" />Save
                    </Button>
                  </div>
                </div>

                {/* Body content */}
                <div className="px-4 py-4 space-y-4 border-t">
                  {/* Title */}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold">Create Instant Experience</p>
                      <IconInfoCircle className="size-3.5 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">One instant experience will be created per media item.</p>
                  </div>

                  {/* Catalog + Product Set grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Catalogue */}
                    <div className="border rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold">Catalogue</span>
                          <IconInfoCircle className="size-3.5 text-muted-foreground" />
                        </div>
                        <button onClick={fetchCatalogs} disabled={catalogsLoading} className="text-muted-foreground hover:text-foreground">
                          <IconRefresh className={cn("size-3.5", catalogsLoading && "animate-spin")} />
                        </button>
                      </div>
                      <div ref={catalogRef} className="relative">
                        <button
                          onClick={() => setCatalogDropdownOpen(o => !o)}
                          className="w-full flex items-center gap-2 px-3 py-2 border rounded-lg bg-background hover:bg-muted/30 transition-colors text-sm"
                        >
                          <span className="flex-1 truncate text-left text-muted-foreground">
                            {local.catalogId ? `${local.catalogName} (${local.catalogId})` : "Select a catalog"}
                          </span>
                          <IconChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                        </button>
                        {catalogDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-xl shadow-lg z-50 overflow-hidden">
                            <div className="p-2 border-b">
                              <div className="relative">
                                <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                                <input
                                  autoFocus
                                  value={catalogSearch}
                                  onChange={e => setCatalogSearch(e.target.value)}
                                  placeholder="Select a catalog"
                                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                                />
                              </div>
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                              {catalogsLoading ? (
                                <div className="px-3 py-3 text-xs text-muted-foreground flex items-center gap-2">
                                  <IconLoader2 className="size-3 animate-spin" />Loading catalogs...
                                </div>
                              ) : filteredCatalogs.length === 0 ? (
                                <div className="px-3 py-3 text-xs text-muted-foreground">No catalogs found via API</div>
                              ) : filteredCatalogs.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => selectCatalog(c)}
                                  className={cn(
                                    "w-full px-3 py-2 text-sm hover:bg-accent text-left transition-colors",
                                    local.catalogId === c.id && "bg-primary/5"
                                  )}
                                >
                                  {c.name} ({c.id})
                                </button>
                              ))}
                            </div>
                            {/* Manual catalog ID fallback */}
                            <div className="border-t p-2 bg-muted/20">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Or enter Catalog ID manually</p>
                              <div className="flex gap-1.5">
                                <input
                                  value={manualCatalogId}
                                  onChange={e => setManualCatalogId(e.target.value)}
                                  placeholder="e.g. 1611620056697514"
                                  className="flex-1 px-2 py-1 text-xs bg-background border rounded outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                                />
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  disabled={!/^\d{5,}$/.test(manualCatalogId.trim()) || manualCatalogLoading}
                                  onClick={addManualCatalog}
                                >
                                  {manualCatalogLoading ? <IconLoader2 className="size-3 animate-spin" /> : "Use"}
                                </Button>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-1">Tip: copy ID from Facebook Commerce Manager URL.</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Error / debug */}
                      {!catalogsLoading && catalogError && (
                        <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2 text-[11px] text-amber-900 dark:text-amber-200">
                          {catalogError}
                          {catalogDebug.length > 0 && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-[10px] opacity-70">Debug</summary>
                              <ul className="mt-1 ml-3 list-disc opacity-80">
                                {catalogDebug.map((l, i) => <li key={i}>{l}</li>)}
                              </ul>
                            </details>
                          )}
                        </div>
                      )}

                      {/* Catalog detail card */}
                      {local.catalogId && (
                        <div className="mt-2 border rounded-lg p-2 bg-muted/10 flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{local.catalogName}</p>
                            <p className="text-[11px] text-muted-foreground">Catalog ID: {local.catalogId}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {local.catalogVertical && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded border bg-background">{local.catalogVertical}</span>
                            )}
                            <Button variant="outline" size="sm" className="h-6 text-[10px] gap-0.5">
                              <IconEye className="size-3" />View
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Product Set */}
                    <div className="border rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold">Product set</span>
                          <span className="text-destructive text-xs">*</span>
                          <IconInfoCircle className="size-3.5 text-muted-foreground" />
                        </div>
                        <button
                          onClick={() => local.catalogId && setProductSets([])}
                          className="text-muted-foreground hover:text-foreground"
                          disabled={!local.catalogId}
                        >
                          <IconRefresh className={cn("size-3.5", productSetsLoading && "animate-spin")} />
                        </button>
                      </div>
                      {!local.catalogId ? (
                        <div className="text-xs text-muted-foreground p-2">Select a catalog first</div>
                      ) : productSetsLoading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                          <IconLoader2 className="size-3 animate-spin" />Loading...
                        </div>
                      ) : productSets.length === 0 ? (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 text-xs text-amber-900 dark:text-amber-200">
                          No product sets found. Create one in Facebook Business Manager first.
                        </div>
                      ) : (
                        <div ref={productSetRef} className="relative">
                          <button
                            onClick={() => setProductSetDropdownOpen(o => !o)}
                            className="w-full flex items-center gap-2 px-3 py-2 border rounded-lg bg-background hover:bg-muted/30 transition-colors text-sm"
                          >
                            <span className="flex-1 truncate text-left text-muted-foreground">
                              {local.productSetId ? local.productSetName : "Select a product set"}
                            </span>
                            <IconChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                          </button>
                          {productSetDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-xl shadow-lg z-50 overflow-hidden max-h-60 overflow-y-auto">
                              {productSets.map(ps => (
                                <button
                                  key={ps.id}
                                  onClick={() => selectProductSet(ps)}
                                  className="w-full px-3 py-2 text-sm hover:bg-accent text-left"
                                >
                                  {ps.name} {ps.product_count !== undefined && <span className="text-muted-foreground">({ps.product_count})</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Product preview */}
                  {local.catalogId && (
                    <div className="border rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold">Product preview</p>
                          <p className="text-xs text-muted-foreground">Previewing products from the selected catalog.</p>
                        </div>
                        <button className="text-muted-foreground hover:text-foreground">
                          <IconRefresh className="size-3.5" />
                        </button>
                      </div>
                      {products.length === 0 ? (
                        <div className="bg-muted/30 border rounded-lg p-2.5 text-xs text-muted-foreground">
                          No product images were available for this catalog.
                        </div>
                      ) : (
                        <div className="grid grid-cols-6 gap-2">
                          {products.slice(0, 6).map(p => (
                            <div key={p.id} className="aspect-square rounded-md overflow-hidden border bg-muted">
                              {p.image_url
                                ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center"><IconPhoto className="size-4 text-muted-foreground/40" /></div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Order + Cover media */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-sm font-semibold">Order</span>
                        <IconInfoCircle className="size-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex items-center gap-4">
                        {([
                          { value: "dynamic" as const, label: "Order dynamically" },
                          { value: "specific" as const, label: "Choose a specific order" },
                        ]).map(opt => (
                          <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                            <div className={cn(
                              "size-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                              local.order === opt.value ? "border-primary" : "border-muted-foreground/30"
                            )}>
                              {local.order === opt.value && <div className="size-2 rounded-full bg-primary" />}
                            </div>
                            <span className="text-sm">{opt.label}</span>
                            <input type="radio" className="sr-only" checked={local.order === opt.value}
                              onChange={() => setLocal(s => ({ ...s, order: opt.value }))} />
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="border-2 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl p-3 flex items-start gap-2">
                      <IconInfoCircle className="size-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold">Cover media</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Automatically uses your uploaded videos and images as the instant experience cover.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Product headline + description */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-xs font-medium">Product headline</span>
                        <IconInfoCircle className="size-3 text-muted-foreground" />
                      </div>
                      <ChipPicker
                        selected={local.productHeadlineChips}
                        options={PRODUCT_FIELD_OPTIONS}
                        onAdd={k => toggleChip("productHeadlineChips", k)}
                        onRemove={k => removeChip("productHeadlineChips", k)}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-xs font-medium">Product description</span>
                        <IconInfoCircle className="size-3 text-muted-foreground" />
                      </div>
                      <ChipPicker
                        selected={local.productDescriptionChips}
                        options={PRODUCT_FIELD_OPTIONS}
                        onAdd={k => toggleChip("productDescriptionChips", k)}
                        onRemove={k => removeChip("productDescriptionChips", k)}
                      />
                    </div>
                  </div>

                  {/* Button label + Destination URL */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-xs font-medium">Button label</span>
                        <span className="text-destructive text-xs">*</span>
                        <IconInfoCircle className="size-3 text-muted-foreground" />
                      </div>
                      <input
                        value={local.buttonLabel}
                        onChange={e => setLocal(s => ({ ...s, buttonLabel: e.target.value }))}
                        placeholder={baseHeadline || "Button label"}
                        className="w-full px-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-xs font-medium">Destination URL</span>
                        <span className="text-destructive text-xs">*</span>
                        <IconInfoCircle className="size-3 text-muted-foreground" />
                      </div>
                      <input
                        value={local.destinationUrl}
                        onChange={e => setLocal(s => ({ ...s, destinationUrl: e.target.value }))}
                        placeholder={baseWebLink || "https://..."}
                        className="w-full px-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>

                  {/* Load Media CTA */}
                  <Button
                    className="w-full h-10"
                    disabled={!isValid}
                    onClick={() => { onLoadMedia?.(); }}
                  >
                    Load Media to Create Experiences
                  </Button>

                  {/* Required warning */}
                  {requiredMissing.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
                      <p className="text-xs text-amber-900 dark:text-amber-200">
                        Please complete all required fields:
                        {requiredMissing.map((r, i) => (
                          <span key={i} className="block ml-3">• {r}</span>
                        ))}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-background shrink-0">
          <Button variant="outline" onClick={onClose}><IconX className="size-3.5 mr-1" />Cancel</Button>
          <Button onClick={handleSave}><IconCheck className="size-3.5 mr-1" />Save Confirm</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Chip picker for product field placeholders
function ChipPicker({ selected, options, onAdd, onRemove }: {
  selected: string[]
  options: { key: string; label: string }[]
  onAdd: (key: string) => void
  onRemove: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])
  const remaining = options.filter(o => !selected.includes(o.key))
  const labelOf = (k: string) => options.find(o => o.key === k)?.label || k

  return (
    <div className="border rounded-lg px-2 py-1.5 bg-background min-h-[36px] flex flex-wrap gap-1 items-center" ref={ref}>
      {selected.map(k => (
        <span key={k} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs border border-blue-200 dark:border-blue-800">
          {labelOf(k)}
          <button onClick={() => onRemove(k)} className="hover:text-destructive">
            <IconX className="size-3" />
          </button>
        </span>
      ))}
      {remaining.length > 0 && (
        <div className="relative">
          <button onClick={() => setOpen(o => !o)} className="text-xs text-muted-foreground hover:text-foreground px-1">
            <IconPlus className="size-3.5" />
          </button>
          {open && (
            <div className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 min-w-[140px] py-1">
              {remaining.map(o => (
                <button
                  key={o.key}
                  onClick={() => { onAdd(o.key); setOpen(false) }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent"
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Catalog Ads (Meta) Modal ─────────────────────────────────────────────────

function CatalogAdsModal({
  open, onClose, value, onConfirm, adAccountId,
}: {
  open: boolean
  onClose: () => void
  value: CatalogAdsState
  onConfirm: (v: CatalogAdsState) => void
  adAccountId?: string
}) {
  const [local, setLocal] = useState<CatalogAdsState>(value)
  const [collapsed, setCollapsed] = useState(false)
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([])
  const [catalogsLoading, setCatalogsLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string>("")
  const [catalogDropdownOpen, setCatalogDropdownOpen] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState("")
  const [productSets, setProductSets] = useState<ProductSetItem[]>([])
  const [productSetsLoading, setProductSetsLoading] = useState(false)
  const [productSetDropdownOpen, setProductSetDropdownOpen] = useState(false)
  const [manualCatalogId, setManualCatalogId] = useState("")
  const catalogRef = useRef<HTMLDivElement>(null)
  const productSetRef = useRef<HTMLDivElement>(null)
  const frameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) setLocal(value) }, [open, value])

  // Fetch catalogs on open
  useEffect(() => {
    if (!open) return
    fetchCatalogs()
  }, [open, adAccountId])

  // Fetch product sets when catalog changes
  useEffect(() => {
    if (!local.catalogId) { setProductSets([]); return }
    setProductSetsLoading(true)
    fetch(`/api/facebook/product-sets?catalog_id=${encodeURIComponent(local.catalogId)}`)
      .then(r => r.json())
      .then(d => setProductSets(d.productSets || []))
      .catch(() => {})
      .finally(() => setProductSetsLoading(false))
  }, [local.catalogId])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (catalogRef.current && !catalogRef.current.contains(e.target as Node)) setCatalogDropdownOpen(false)
      if (productSetRef.current && !productSetRef.current.contains(e.target as Node)) setProductSetDropdownOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const fetchCatalogs = async () => {
    setCatalogsLoading(true)
    setCatalogError("")
    try {
      const url = adAccountId ? `/api/facebook/catalogs?ad_account_id=${encodeURIComponent(adAccountId)}` : "/api/facebook/catalogs"
      const res = await fetch(url)
      const d = await res.json()
      if (!res.ok) {
        setCatalogError(d.error || "Failed to fetch catalogs")
      } else {
        setCatalogs(d.catalogs || [])
        if ((d.catalogs || []).length === 0) {
          setCatalogError("No catalogs found. Connect a Business with catalogs or enter Catalog ID manually.")
        }
      }
    } catch (e: any) {
      setCatalogError(e.message)
    }
    setCatalogsLoading(false)
  }

  const filteredCatalogs = catalogs.filter(c =>
    !catalogSearch || c.name.toLowerCase().includes(catalogSearch.toLowerCase()) || c.id.includes(catalogSearch)
  )
  const visibleProductSets = local.hideAutoCreatedSets
    ? productSets.filter(ps => !/auto[- ]?created|url[- ]?based/i.test(ps.name))
    : productSets

  const selectCatalog = (c: CatalogItem) => {
    setLocal(s => ({ ...s, catalogId: c.id, catalogName: c.name, productSetId: "", productSetName: "" }))
    setCatalogDropdownOpen(false)
    setCatalogSearch("")
  }
  const addManualCatalog = () => {
    const id = manualCatalogId.trim()
    if (!/^\d{5,}$/.test(id)) return
    selectCatalog({ id, name: `Catalog ${id}` })
    setManualCatalogId("")
  }
  const selectProductSet = (ps: ProductSetItem) => {
    setLocal(s => ({ ...s, productSetId: ps.id, productSetName: ps.name }))
    setProductSetDropdownOpen(false)
  }

  const handleFrameUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setLocal(s => ({ ...s, frameImageUrl: reader.result as string }))
    reader.readAsDataURL(file)
  }

  const isValid = !!local.catalogId
  const handleSave = () => {
    onConfirm(isValid ? { ...local, enabled: true } : { ...local, enabled: false })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl p-0 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b shrink-0">
          <div>
            <DialogTitle className="text-base font-semibold">Catalog Ads (Meta)</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Pick a catalogue, then confirm the setup at the bottom of this modal.</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
          <div className="border rounded-xl overflow-hidden">
            {/* Section header with toggle */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <IconBox className="size-4" />
                <span className="text-sm font-semibold">Catalog Ads (Meta)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLocal(s => ({ ...s, enabled: !s.enabled }))}
                  className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                    local.enabled ? "bg-primary" : "bg-muted-foreground/30")}
                >
                  <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                    local.enabled ? "translate-x-4" : "translate-x-0.5")} />
                </button>
                <button onClick={() => setCollapsed(c => !c)} className="text-muted-foreground hover:text-foreground">
                  {collapsed ? <IconChevronDown className="size-4" /> : <IconChevronUp className="size-4" />}
                </button>
              </div>
            </div>

            {!collapsed && local.enabled && (
              <div className="border-t px-4 py-4 space-y-4">
                {/* Format Mode */}
                <div>
                  <p className="text-sm font-semibold mb-2">Format Mode</p>
                  <div className="space-y-2">
                    {([
                      { value: "automatic" as const, title: "Automatic", desc: "Let Meta choose the best format for your ad" },
                      { value: "manual" as const, title: "Manual", desc: "Manage format manually" },
                    ]).map(opt => (
                      <label key={opt.value} className={cn(
                        "flex items-start gap-2.5 p-3 border rounded-xl cursor-pointer transition-colors",
                        local.formatMode === opt.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                      )}>
                        <div className={cn(
                          "size-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                          local.formatMode === opt.value ? "border-primary" : "border-muted-foreground/30"
                        )}>
                          {local.formatMode === opt.value && <div className="size-2 rounded-full bg-primary" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{opt.title}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                        <input type="radio" className="sr-only" checked={local.formatMode === opt.value}
                          onChange={() => setLocal(s => ({ ...s, formatMode: opt.value }))} />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Format + Frame Image grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-semibold mb-1">Format</p>
                    <p className="text-xs text-muted-foreground mb-2">Choose an ad creative layout</p>
                    <div className="space-y-2">
                      {([
                        { value: "single" as const, title: "Single image or video", desc: "Use a single image or video for your ad" },
                        { value: "carousel" as const, title: "Carousel", desc: "Show multiple images or videos in a scrollable format" },
                      ]).map(opt => (
                        <label key={opt.value} className={cn(
                          "flex items-start gap-2.5 p-2.5 border rounded-xl cursor-pointer transition-colors",
                          local.format === opt.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30",
                          local.formatMode === "automatic" && "opacity-60 cursor-not-allowed"
                        )}>
                          <div className={cn(
                            "size-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                            local.format === opt.value ? "border-primary" : "border-muted-foreground/30"
                          )}>
                            {local.format === opt.value && <div className="size-2 rounded-full bg-primary" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{opt.title}</p>
                            <p className="text-xs text-muted-foreground">{opt.desc}</p>
                          </div>
                          <input type="radio" disabled={local.formatMode === "automatic"} className="sr-only"
                            checked={local.format === opt.value}
                            onChange={() => setLocal(s => ({ ...s, format: opt.value }))} />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold mb-1">Frame Image (Optional)</p>
                    <p className="text-xs text-muted-foreground mb-2">Upload an image to use as a frame for your catalogue ad creative.</p>
                    <input ref={frameInputRef} type="file" accept="image/*" className="hidden" onChange={handleFrameUpload} />
                    <button
                      onClick={() => frameInputRef.current?.click()}
                      className="w-full aspect-[2/1] border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:bg-muted/30 transition-colors overflow-hidden"
                    >
                      {local.frameImageUrl ? (
                        <img src={local.frameImageUrl} className="w-full h-full object-cover" alt="Frame" />
                      ) : (
                        <>
                          <IconUpload className="size-5" />
                          <span className="text-xs">Upload Frame Image</span>
                        </>
                      )}
                    </button>
                    {local.frameImageUrl && (
                      <button
                        onClick={() => setLocal(s => ({ ...s, frameImageUrl: "" }))}
                        className="text-[11px] text-destructive hover:underline mt-1"
                      >
                        Remove frame
                      </button>
                    )}
                  </div>
                </div>

                {/* Dynamic Media */}
                <div className="border rounded-xl p-3">
                  <p className="text-sm font-semibold">Dynamic media</p>
                  <p className="text-xs text-muted-foreground mb-3">Control how catalogue images and videos are chosen for delivery (maps to Meta Dynamic Media).</p>
                  <div className="space-y-2.5">
                    <DynamicMediaToggle
                      title="Optimized media selection"
                      desc="Let Meta show images or videos from your catalogue based on what each person is likely to engage with."
                      checked={local.dynamicMedia.optimizedMediaSelection}
                      onChange={v => setLocal(s => ({ ...s, dynamicMedia: { ...s.dynamicMedia, optimizedMediaSelection: v, automaticVideoCropping: v ? s.dynamicMedia.automaticVideoCropping : false, prioritizeVideo: v ? s.dynamicMedia.prioritizeVideo : false } }))}
                    />
                    <DynamicMediaToggle
                      title="Automatic video cropping"
                      desc="Crop catalogue videos to fit placements when aspect ratios differ."
                      checked={local.dynamicMedia.automaticVideoCropping}
                      onChange={v => setLocal(s => ({ ...s, dynamicMedia: { ...s.dynamicMedia, automaticVideoCropping: v } }))}
                      disabled={!local.dynamicMedia.optimizedMediaSelection}
                      indent
                    />
                    <DynamicMediaToggle
                      title="Prioritize video"
                      desc="Prefer catalogue video for the hero when both image and video are available."
                      checked={local.dynamicMedia.prioritizeVideo}
                      onChange={v => setLocal(s => ({ ...s, dynamicMedia: { ...s.dynamicMedia, prioritizeVideo: v } }))}
                      disabled={!local.dynamicMedia.optimizedMediaSelection}
                      indent
                    />
                  </div>
                </div>

                {/* Catalogue */}
                <div>
                  <p className="text-sm font-semibold mb-1">Catalogue</p>
                  <p className="text-xs text-muted-foreground mb-2">Your ad is currently using catalogue in media setup. We'll use product images from this catalogue as your ad creative.</p>
                  <div ref={catalogRef} className="relative">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCatalogDropdownOpen(o => !o)}
                        className="flex-1 flex items-center gap-2 px-3 py-2 border rounded-lg bg-background hover:bg-muted/30 transition-colors text-sm"
                      >
                        <IconSearch className="size-3.5 text-muted-foreground/50" />
                        <span className="flex-1 truncate text-left text-muted-foreground">
                          {local.catalogId ? `${local.catalogName} (${local.catalogId})` : "Search catalogues..."}
                        </span>
                        <IconChevronDown className="size-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={fetchCatalogs} disabled={catalogsLoading} className="size-9 border rounded-lg flex items-center justify-center hover:bg-muted/30">
                        <IconRefresh className={cn("size-3.5 text-muted-foreground", catalogsLoading && "animate-spin")} />
                      </button>
                    </div>
                    {catalogDropdownOpen && (
                      <div className="absolute top-full left-0 right-12 mt-1 bg-popover border rounded-xl shadow-lg z-50 overflow-hidden">
                        <div className="p-2 border-b">
                          <input
                            autoFocus
                            value={catalogSearch}
                            onChange={e => setCatalogSearch(e.target.value)}
                            placeholder="Search catalogues..."
                            className="w-full px-3 py-1.5 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                        <div className="max-h-52 overflow-y-auto">
                          {catalogsLoading ? (
                            <div className="px-3 py-3 text-xs text-muted-foreground flex items-center gap-2">
                              <IconLoader2 className="size-3 animate-spin" />Loading...
                            </div>
                          ) : filteredCatalogs.length === 0 ? (
                            <div className="px-3 py-3 text-xs text-muted-foreground">{catalogError || "No catalogs"}</div>
                          ) : filteredCatalogs.map(c => (
                            <button key={c.id} onClick={() => selectCatalog(c)}
                              className={cn("w-full px-3 py-2 text-sm hover:bg-accent text-left",
                                local.catalogId === c.id && "bg-primary/5")}>
                              {c.name} ({c.id})
                            </button>
                          ))}
                        </div>
                        <div className="border-t p-2 bg-muted/20">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Or enter Catalog ID</p>
                          <div className="flex gap-1.5">
                            <input
                              value={manualCatalogId}
                              onChange={e => setManualCatalogId(e.target.value)}
                              placeholder="e.g. 1611620056697514"
                              className="flex-1 px-2 py-1 text-xs bg-background border rounded outline-none focus:ring-1 focus:ring-ring"
                            />
                            <Button size="sm" className="h-7 text-xs" disabled={!/^\d{5,}$/.test(manualCatalogId.trim())} onClick={addManualCatalog}>Use</Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Product set */}
                <div>
                  <p className="text-sm font-semibold mb-1">Product set</p>
                  <p className="text-xs text-muted-foreground mb-2">Use a product set to feature certain products in your ads and shops on Facebook and Instagram. Leave this on All Products to use the whole catalogue.</p>

                  {/* Hide auto-created toggle */}
                  <div className="flex items-start justify-between p-3 border rounded-lg mb-2 bg-muted/10">
                    <div className="flex-1">
                      <p className="text-sm font-medium">Hide Meta auto-created sets</p>
                      <p className="text-xs text-muted-foreground">Hides URL-based sets and "Auto-Created Set" entries from this list.</p>
                    </div>
                    <button
                      onClick={() => setLocal(s => ({ ...s, hideAutoCreatedSets: !s.hideAutoCreatedSets }))}
                      className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
                        local.hideAutoCreatedSets ? "bg-primary" : "bg-muted-foreground/30")}
                    >
                      <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                        local.hideAutoCreatedSets ? "translate-x-4" : "translate-x-0.5")} />
                    </button>
                  </div>

                  <div ref={productSetRef} className="relative">
                    <div className="flex gap-2">
                      <button
                        onClick={() => local.catalogId && setProductSetDropdownOpen(o => !o)}
                        disabled={!local.catalogId}
                        className={cn("flex-1 flex items-center gap-2 px-3 py-2 border rounded-lg bg-background hover:bg-muted/30 transition-colors text-sm",
                          !local.catalogId && "opacity-60 cursor-not-allowed")}
                      >
                        <span className="flex-1 truncate text-left text-muted-foreground">
                          {!local.catalogId ? "Select a catalogue first" : (local.productSetId ? local.productSetName : "All Products (default)")}
                        </span>
                        <IconChevronDown className="size-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => local.catalogId && setProductSets([])}
                        disabled={!local.catalogId || productSetsLoading}
                        className="size-9 border rounded-lg flex items-center justify-center hover:bg-muted/30"
                      >
                        <IconRefresh className={cn("size-3.5 text-muted-foreground", productSetsLoading && "animate-spin")} />
                      </button>
                    </div>
                    {productSetDropdownOpen && local.catalogId && (
                      <div className="absolute top-full left-0 right-12 mt-1 bg-popover border rounded-xl shadow-lg z-50 max-h-52 overflow-y-auto">
                        <button onClick={() => { setLocal(s => ({ ...s, productSetId: "", productSetName: "All Products" })); setProductSetDropdownOpen(false) }}
                          className="w-full px-3 py-2 text-sm hover:bg-accent text-left border-b font-medium">
                          All Products (default)
                        </button>
                        {productSetsLoading ? (
                          <div className="px-3 py-3 text-xs text-muted-foreground flex items-center gap-2">
                            <IconLoader2 className="size-3 animate-spin" />Loading...
                          </div>
                        ) : visibleProductSets.length === 0 ? (
                          <div className="px-3 py-3 text-xs text-muted-foreground">No product sets</div>
                        ) : visibleProductSets.map(ps => (
                          <button key={ps.id} onClick={() => selectProductSet(ps)}
                            className="w-full px-3 py-2 text-sm hover:bg-accent text-left">
                            {ps.name} {ps.product_count !== undefined && <span className="text-muted-foreground">({ps.product_count})</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-background shrink-0">
          <Button onClick={handleSave} disabled={local.enabled && !isValid}>
            <IconCheck className="size-3.5 mr-1" />Confirm Catalog Setup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Carousel Ads Modal ───────────────────────────────────────────────────────

function CarouselAdsModal({
  open, onClose, value, onConfirm,
  availableCreatives, baseHeadline, baseLinkUrl, baseCta,
}: {
  open: boolean
  onClose: () => void
  value: CarouselAdsState
  onConfirm: (v: CarouselAdsState) => void
  availableCreatives: Creative[]
  baseHeadline: string
  baseLinkUrl: string
  baseCta: string
}) {
  const [local, setLocal] = useState<CarouselAdsState>(value)
  const [selectedAdId, setSelectedAdId] = useState<string>("")
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!open) return
    // Ensure at least one carousel exists
    if (value.carousels.length === 0) {
      const initial: CarouselAd = { id: `c_${Date.now()}`, name: "Ad 1", cards: [], showAsCollectionTiles: false, showAsSingleMedia: false }
      setLocal({ enabled: value.enabled, carousels: [initial] })
      setSelectedAdId(initial.id)
    } else {
      setLocal(value)
      setSelectedAdId(value.carousels[0].id)
    }
  }, [open])

  const selectedAd = local.carousels.find(c => c.id === selectedAdId)
  const usedCreativeIds = new Set(local.carousels.flatMap(c => c.cards.map(card => card.creativeId)))
  const totalMediaCount = local.carousels.reduce((sum, c) => sum + c.cards.length, 0)
  const totalSelected = usedCreativeIds.size

  const availableFiltered = availableCreatives
    .filter(c => !usedCreativeIds.has(c.id))
    .filter(c => !search || c.file_name.toLowerCase().includes(search.toLowerCase()))

  const addCarousel = () => {
    const next = local.carousels.length + 1
    const newAd: CarouselAd = { id: `c_${Date.now()}`, name: `Ad ${next}`, cards: [], showAsCollectionTiles: false, showAsSingleMedia: false }
    setLocal(s => ({ ...s, carousels: [...s.carousels, newAd] }))
    setSelectedAdId(newAd.id)
  }
  const duplicateCarousel = (id: string) => {
    const ad = local.carousels.find(c => c.id === id)
    if (!ad) return
    const dup: CarouselAd = { ...ad, id: `c_${Date.now()}`, name: `${ad.name} (copy)`, cards: [...ad.cards] }
    setLocal(s => ({ ...s, carousels: [...s.carousels, dup] }))
  }
  const deleteCarousel = (id: string) => {
    if (local.carousels.length === 1) return
    const idx = local.carousels.findIndex(c => c.id === id)
    const next = local.carousels.filter(c => c.id !== id)
    setLocal(s => ({ ...s, carousels: next }))
    if (selectedAdId === id) setSelectedAdId(next[Math.max(0, idx - 1)].id)
  }
  const updateAd = (id: string, patch: Partial<CarouselAd>) => {
    setLocal(s => ({ ...s, carousels: s.carousels.map(c => c.id === id ? { ...c, ...patch } : c) }))
  }
  const addCardToSelected = (creativeId: string) => {
    if (!selectedAd) return
    if (selectedAd.cards.length >= 10) return // Meta max 10 cards
    const card: CarouselCard = {
      creativeId,
      headline: baseHeadline,
      linkUrl: baseLinkUrl,
      cta: baseCta,
    }
    updateAd(selectedAd.id, { cards: [...selectedAd.cards, card] })
  }
  const removeCard = (creativeId: string) => {
    if (!selectedAd) return
    updateAd(selectedAd.id, { cards: selectedAd.cards.filter(c => c.creativeId !== creativeId) })
  }
  const moveCard = (creativeId: string, dir: -1 | 1) => {
    if (!selectedAd) return
    const idx = selectedAd.cards.findIndex(c => c.creativeId === creativeId)
    if (idx < 0) return
    const next = [...selectedAd.cards]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    updateAd(selectedAd.id, { cards: next })
  }
  const updateCardField = (creativeId: string, field: keyof CarouselCard, val: string) => {
    if (!selectedAd) return
    updateAd(selectedAd.id, {
      cards: selectedAd.cards.map(c => c.creativeId === creativeId ? { ...c, [field]: val } : c),
    })
  }
  const toggleFormat = (id: string, field: "showAsCollectionTiles" | "showAsSingleMedia", val: boolean) => {
    // The two are mutually exclusive
    if (field === "showAsCollectionTiles" && val) updateAd(id, { showAsCollectionTiles: true, showAsSingleMedia: false })
    else if (field === "showAsSingleMedia" && val) updateAd(id, { showAsCollectionTiles: false, showAsSingleMedia: true })
    else updateAd(id, { [field]: val } as any)
  }
  const handleDone = () => {
    const validCarousels = local.carousels.filter(c => c.cards.length >= 2) // Meta requires min 2 cards
    onConfirm({
      enabled: validCarousels.length > 0,
      carousels: local.carousels,
    })
    onClose()
  }

  const creativeById = (id: string) => availableCreatives.find(c => c.id === id)
  const thumbOf = (c?: Creative) => c ? (c.media_type === "video" ? c.fb_thumbnail_url : (c.fb_image_url || c.file_url)) : ""

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-5xl p-0 flex flex-col max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b shrink-0">
          <DialogTitle className="text-base font-semibold">
            Create Carousel Ads <span className="text-muted-foreground font-normal">({totalMediaCount} media)</span>
          </DialogTitle>
        </div>

        <div className="grid grid-cols-2 flex-1 min-h-0 overflow-hidden">
          {/* LEFT: Available Media + Carousel Ads list */}
          <div className="border-r flex flex-col overflow-hidden">
            {/* Available Media */}
            <div className="px-4 py-3 border-b shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold">Available Media</span>
                  <span className="text-xs text-primary">({totalSelected} selected)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1 text-xs px-2 py-1 border rounded-full hover:bg-muted/30" title="Auto-group with AI (coming soon)">
                    <span>AI Group</span>
                    <svg className="size-3.5 text-purple-500" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4" /></svg>
                  </button>
                  <IconInfoCircle className="size-3.5 text-muted-foreground" />
                </div>
              </div>
              <div className="relative">
                <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 bg-muted/10">
              {availableFiltered.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  No available media to add
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availableFiltered.map(c => {
                    const thumb = thumbOf(c)
                    return (
                      <button
                        key={c.id}
                        onClick={() => addCardToSelected(c.id)}
                        disabled={!selectedAd || selectedAd.cards.length >= 10}
                        className="group relative aspect-square rounded-lg overflow-hidden border bg-muted hover:ring-2 hover:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <CreativeCardMedia creative={c} className="w-full h-full object-cover" compact />
                        <div className="absolute inset-0 bg-primary/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <IconPlus className="size-5 text-white" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Carousel Ads list */}
            <div className="border-t shrink-0 max-h-[40%] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm font-semibold">Carousel Ads</span>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addCarousel}>
                  <IconPlus className="size-3" />New
                </Button>
              </div>
              <div className="overflow-y-auto px-3 pb-3 space-y-1.5">
                {local.carousels.map(ad => (
                  <div
                    key={ad.id}
                    onClick={() => setSelectedAdId(ad.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 border rounded-lg cursor-pointer transition-colors",
                      selectedAdId === ad.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                    )}
                  >
                    <span className="flex-1 text-sm font-medium">{ad.name}</span>
                    <span className="text-xs text-muted-foreground">{ad.cards.length} card{ad.cards.length !== 1 ? "s" : ""}</span>
                    <button
                      onClick={e => { e.stopPropagation(); duplicateCarousel(ad.id) }}
                      className="text-muted-foreground hover:text-foreground"
                      title="Duplicate"
                    >
                      <IconCopy className="size-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteCarousel(ad.id) }}
                      disabled={local.carousels.length === 1}
                      className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                      title="Delete"
                    >
                      <IconTrash className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Selected carousel details */}
          <div className="flex flex-col overflow-hidden">
            {selectedAd ? (
              <>
                <div className="px-5 py-3 border-b shrink-0">
                  <h3 className="text-sm font-semibold">Carousel {local.carousels.findIndex(c => c.id === selectedAd.id) + 1} Details</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {/* Ad Name */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Ad Name</label>
                    <input
                      value={selectedAd.name}
                      onChange={e => updateAd(selectedAd.id, { name: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  {/* Format display options */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Format display options</p>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedAd.showAsCollectionTiles}
                          onChange={e => toggleFormat(selectedAd.id, "showAsCollectionTiles", e.target.checked)}
                          className="rounded size-3.5"
                        />
                        <span className="text-sm">Show cards as collection tiles</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedAd.showAsSingleMedia}
                          onChange={e => toggleFormat(selectedAd.id, "showAsSingleMedia", e.target.checked)}
                          className="rounded size-3.5"
                        />
                        <span className="text-sm">Show cards as single media</span>
                      </label>
                    </div>
                  </div>

                  {/* Cards list */}
                  {selectedAd.cards.length === 0 ? (
                    <div className="border-2 border-dashed rounded-xl py-12 px-4 text-center text-sm text-muted-foreground">
                      Select an ad from above to add to <span className="font-semibold text-foreground">{selectedAd.name}</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Cards ({selectedAd.cards.length}/10)</p>
                      {selectedAd.cards.map((card, idx) => {
                        const c = creativeById(card.creativeId)
                        const thumb = thumbOf(c)
                        return (
                          <div key={card.creativeId} className="border rounded-lg p-2 flex gap-2">
                            <div className="size-14 rounded overflow-hidden bg-muted shrink-0 relative">
                              {thumb ? <img src={thumb} className="w-full h-full object-cover" alt="" />
                                : <div className="w-full h-full flex items-center justify-center"><IconPhoto className="size-4 text-muted-foreground/40" /></div>}
                              {c?.media_type === "video" && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none">
                                  <IconPlayerPlay className="size-4 text-white opacity-60" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-muted-foreground">CARD {idx + 1}</span>
                                <div className="flex items-center gap-0.5">
                                  <button onClick={() => moveCard(card.creativeId, -1)} disabled={idx === 0}
                                    className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                                    <IconChevronUp className="size-3.5" />
                                  </button>
                                  <button onClick={() => moveCard(card.creativeId, 1)} disabled={idx === selectedAd.cards.length - 1}
                                    className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                                    <IconChevronDown className="size-3.5" />
                                  </button>
                                  <button onClick={() => removeCard(card.creativeId)} className="text-muted-foreground hover:text-destructive">
                                    <IconX className="size-3.5" />
                                  </button>
                                </div>
                              </div>
                              <input
                                value={card.headline || ""}
                                onChange={e => updateCardField(card.creativeId, "headline", e.target.value)}
                                placeholder="Card headline"
                                className="w-full px-2 py-1 text-xs bg-muted/30 border rounded outline-none focus:ring-1 focus:ring-ring"
                              />
                              <input
                                value={card.linkUrl || ""}
                                onChange={e => updateCardField(card.creativeId, "linkUrl", e.target.value)}
                                placeholder="Card URL"
                                className="w-full px-2 py-1 text-xs bg-muted/30 border rounded outline-none focus:ring-1 focus:ring-ring"
                              />
                            </div>
                          </div>
                        )
                      })}
                      {selectedAd.cards.length < 2 && (
                        <p className="text-[11px] text-amber-600">Carousel ads require at least 2 cards.</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Create a carousel ad to begin
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t shrink-0">
          <Button
            className="w-full h-10"
            disabled={local.carousels.every(c => c.cards.length < 2)}
            onClick={handleDone}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Flexible Ads Modal ───────────────────────────────────────────────────────

function FlexibleAdsModal({
  open, onClose, value, onConfirm, availableCreatives,
}: {
  open: boolean
  onClose: () => void
  value: FlexibleAdsState
  onConfirm: (v: FlexibleAdsState) => void
  availableCreatives: Creative[]
}) {
  const [local, setLocal] = useState<FlexibleAdsState>(value)
  const [selectedAdId, setSelectedAdId] = useState<string>("")
  const [selectedGroupId, setSelectedGroupId] = useState<string>("")
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!open) return
    if (value.flexibleAds.length === 0) {
      const g: FlexibleGroup = { id: `g_${Date.now()}`, creativeIds: [] }
      const ad: FlexibleAd = { id: `f_${Date.now()}`, name: "Flexible Ad 1", groups: [g] }
      setLocal({ enabled: value.enabled, flexibleAds: [ad] })
      setSelectedAdId(ad.id); setSelectedGroupId(g.id)
    } else {
      setLocal(value)
      setSelectedAdId(value.flexibleAds[0].id)
      setSelectedGroupId(value.flexibleAds[0].groups[0]?.id || "")
    }
  }, [open])

  const selectedAd = local.flexibleAds.find(a => a.id === selectedAdId)
  const selectedGroup = selectedAd?.groups.find(g => g.id === selectedGroupId)

  const totalLoaded = local.flexibleAds.reduce((sum, a) => sum + a.groups.reduce((s, g) => s + g.creativeIds.length, 0), 0)
  const validFlexibleAds = local.flexibleAds.filter(a => a.groups.some(g => g.creativeIds.length > 0))
  const validCount = validFlexibleAds.length

  // Available media = creatives NOT in current group (can be in other groups/ads)
  const usedInCurrentGroup = new Set(selectedGroup?.creativeIds || [])
  const availableFiltered = availableCreatives
    .filter(c => !usedInCurrentGroup.has(c.id))
    .filter(c => !search || c.file_name.toLowerCase().includes(search.toLowerCase()))

  const addFlexibleAd = () => {
    const g: FlexibleGroup = { id: `g_${Date.now()}`, creativeIds: [] }
    const ad: FlexibleAd = { id: `f_${Date.now()}`, name: `Flexible Ad ${local.flexibleAds.length + 1}`, groups: [g] }
    setLocal(s => ({ ...s, flexibleAds: [...s.flexibleAds, ad] }))
    setSelectedAdId(ad.id); setSelectedGroupId(g.id)
  }
  const deleteFlexibleAd = (id: string) => {
    if (local.flexibleAds.length === 1) return
    const idx = local.flexibleAds.findIndex(a => a.id === id)
    const next = local.flexibleAds.filter(a => a.id !== id)
    setLocal(s => ({ ...s, flexibleAds: next }))
    if (selectedAdId === id) {
      const newSelected = next[Math.max(0, idx - 1)]
      setSelectedAdId(newSelected.id)
      setSelectedGroupId(newSelected.groups[0]?.id || "")
    }
  }
  const addGroup = () => {
    if (!selectedAd || selectedAd.groups.length >= 3) return
    const g: FlexibleGroup = { id: `g_${Date.now()}`, creativeIds: [] }
    setLocal(s => ({
      ...s,
      flexibleAds: s.flexibleAds.map(a => a.id === selectedAdId ? { ...a, groups: [...a.groups, g] } : a),
    }))
    setSelectedGroupId(g.id)
  }
  const deleteGroup = (groupId: string) => {
    if (!selectedAd || selectedAd.groups.length === 1) return
    const idx = selectedAd.groups.findIndex(g => g.id === groupId)
    const nextGroups = selectedAd.groups.filter(g => g.id !== groupId)
    setLocal(s => ({
      ...s,
      flexibleAds: s.flexibleAds.map(a => a.id === selectedAdId ? { ...a, groups: nextGroups } : a),
    }))
    if (selectedGroupId === groupId) setSelectedGroupId(nextGroups[Math.max(0, idx - 1)].id)
  }
  const addToGroup = (creativeId: string) => {
    if (!selectedAd || !selectedGroup || selectedGroup.creativeIds.length >= 10) return
    setLocal(s => ({
      ...s,
      flexibleAds: s.flexibleAds.map(a => a.id !== selectedAdId ? a : {
        ...a,
        groups: a.groups.map(g => g.id !== selectedGroupId ? g : { ...g, creativeIds: [...g.creativeIds, creativeId] }),
      }),
    }))
  }
  const removeFromGroup = (creativeId: string) => {
    if (!selectedAd || !selectedGroup) return
    setLocal(s => ({
      ...s,
      flexibleAds: s.flexibleAds.map(a => a.id !== selectedAdId ? a : {
        ...a,
        groups: a.groups.map(g => g.id !== selectedGroupId ? g : { ...g, creativeIds: g.creativeIds.filter(id => id !== creativeId) }),
      }),
    }))
  }
  const updateAdName = (id: string, name: string) => {
    setLocal(s => ({ ...s, flexibleAds: s.flexibleAds.map(a => a.id === id ? { ...a, name } : a) }))
  }

  const handleDone = () => {
    onConfirm({
      enabled: validCount > 0,
      flexibleAds: local.flexibleAds.filter(a => a.groups.some(g => g.creativeIds.length > 0)),
    })
    onClose()
  }

  const creativeById = (id: string) => availableCreatives.find(c => c.id === id)
  const thumbOf = (c?: Creative) => c ? (c.media_type === "video" ? c.fb_thumbnail_url : (c.fb_image_url || c.file_url)) : ""

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-5xl p-0 flex flex-col max-h-[92vh] overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b shrink-0">
          <DialogTitle className="text-base font-semibold">
            Group Media Together for Flexible Ads <span className="text-muted-foreground font-normal">({totalLoaded} ads loaded)</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create up to 3 groups per flexible ad. Each group holds up to 10 images or videos — Meta optimises delivery across groups.
          </p>
        </div>

        <div className="grid grid-cols-[260px_1fr] flex-1 min-h-0 overflow-hidden">
          {/* LEFT: Flexible Ads list */}
          <div className="border-r flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b shrink-0">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">FLEXIBLE ADS</p>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
              {local.flexibleAds.map(ad => {
                const groupCount = ad.groups.length
                const imgCount = ad.groups.reduce((s, g) => s + g.creativeIds.length, 0)
                return (
                  <div
                    key={ad.id}
                    onClick={() => { setSelectedAdId(ad.id); setSelectedGroupId(ad.groups[0]?.id || "") }}
                    className={cn(
                      "px-3 py-2.5 border rounded-lg cursor-pointer transition-colors group",
                      selectedAdId === ad.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <input
                        value={ad.name}
                        onClick={e => e.stopPropagation()}
                        onChange={e => updateAdName(ad.id, e.target.value)}
                        className={cn(
                          "bg-transparent outline-none text-sm font-semibold flex-1 min-w-0",
                          selectedAdId === ad.id ? "text-primary-foreground" : ""
                        )}
                      />
                      {local.flexibleAds.length > 1 && (
                        <button
                          onClick={e => { e.stopPropagation(); deleteFlexibleAd(ad.id) }}
                          className={cn(
                            "opacity-0 group-hover:opacity-100 transition-opacity",
                            selectedAdId === ad.id ? "text-primary-foreground/70 hover:text-primary-foreground" : "text-muted-foreground hover:text-destructive"
                          )}
                        >
                          <IconTrash className="size-3.5" />
                        </button>
                      )}
                    </div>
                    <p className={cn("text-[11px] mt-0.5", selectedAdId === ad.id ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {groupCount} group{groupCount !== 1 ? "s" : ""} · {imgCount} img
                    </p>
                  </div>
                )
              })}
            </div>
            <div className="border-t p-3 shrink-0">
              <Button variant="outline" className="w-full h-8 text-xs gap-1" onClick={addFlexibleAd}>
                <IconPlus className="size-3.5" />New Flexible Ad
              </Button>
            </div>
          </div>

          {/* RIGHT: Groups + media */}
          <div className="flex flex-col overflow-hidden">
            {selectedAd ? (
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Group tabs */}
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedAd.groups.map((g, i) => (
                    <div key={g.id} className="flex items-center group">
                      <button
                        onClick={() => setSelectedGroupId(g.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5",
                          selectedGroupId === g.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground hover:bg-muted/70"
                        )}
                      >
                        Group {i + 1}
                        <span className={cn("px-1 rounded", selectedGroupId === g.id ? "bg-primary-foreground/20" : "bg-foreground/10")}>
                          {g.creativeIds.length}/10
                        </span>
                        {selectedAd.groups.length > 1 && (
                          <span
                            onClick={e => { e.stopPropagation(); deleteGroup(g.id) }}
                            className="hover:text-destructive ml-1"
                          >
                            <IconX className="size-3" />
                          </span>
                        )}
                      </button>
                    </div>
                  ))}
                  {selectedAd.groups.length < 3 && (
                    <button
                      onClick={addGroup}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-muted-foreground/40 hover:bg-muted/30 transition-colors flex items-center gap-1"
                    >
                      <IconPlus className="size-3" />Add Group
                    </button>
                  )}
                </div>

                {/* Available Media */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">AVAILABLE MEDIA</p>
                    <div className="relative">
                      <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/50" />
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search..."
                        className="pl-7 pr-3 py-1 text-xs bg-background border rounded-md outline-none focus:ring-1 focus:ring-ring w-44"
                      />
                    </div>
                  </div>
                  <div className="border rounded-xl bg-muted/10 min-h-[180px] p-3">
                    {availableFiltered.length === 0 ? (
                      <div className="flex items-center justify-center h-[160px] text-sm text-muted-foreground">
                        No available media
                      </div>
                    ) : (
                      <div className="grid grid-cols-6 gap-2">
                        {availableFiltered.map(c => {
                          const thumb = thumbOf(c)
                          const canAdd = selectedGroup && selectedGroup.creativeIds.length < 10
                          return (
                            <button
                              key={c.id}
                              onClick={() => addToGroup(c.id)}
                              disabled={!canAdd}
                              className="group relative aspect-square rounded-lg overflow-hidden border bg-muted hover:ring-2 hover:ring-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <CreativeCardMedia creative={c} className="w-full h-full object-cover" compact />
                              <div className="absolute inset-0 bg-primary/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <IconPlus className="size-4 text-white" />
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected group */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      GROUP {selectedAd.groups.findIndex(g => g.id === selectedGroupId) + 1} — SELECTED
                    </p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {selectedGroup?.creativeIds.length || 0} / 10
                    </span>
                  </div>
                  <div className="border rounded-xl min-h-[180px] p-3">
                    {!selectedGroup || selectedGroup.creativeIds.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-[160px] gap-2 text-center">
                        <div className="size-8 rounded-full bg-muted flex items-center justify-center">
                          <IconPlus className="size-4 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">No media in Group {selectedAd.groups.findIndex(g => g.id === selectedGroupId) + 1} yet</p>
                        <p className="text-xs text-muted-foreground/70">Click items in Available Media above to add them here</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-6 gap-2">
                        {selectedGroup.creativeIds.map(id => {
                          const c = creativeById(id)
                          return (
                            <div key={id} className="group relative aspect-square rounded-lg overflow-hidden border bg-muted">
                              {c && <CreativeCardMedia creative={c} className="w-full h-full object-cover" compact />}
                              <button
                                onClick={() => removeFromGroup(id)}
                                className="absolute top-0.5 right-0.5 size-5 rounded-full bg-background/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                              >
                                <IconX className="size-2.5" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Create a flexible ad to begin
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t shrink-0">
          <Button
            className="w-full h-10"
            disabled={validCount === 0}
            onClick={handleDone}
          >
            Done ({validCount} flexible ad{validCount !== 1 ? "s" : ""} configured) ↵
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Multi Placement Ads Modal ────────────────────────────────────────────────

const META_PLACEMENTS = [
  { key: "feed", label: "Feed (1:1, 4:5)", platforms: ["facebook", "instagram"], positions: ["feed"] },
  { key: "story", label: "Stories (9:16)", platforms: ["facebook", "instagram"], positions: ["story"] },
  { key: "reels", label: "Reels (9:16)", platforms: ["facebook", "instagram"], positions: ["reels"] },
  { key: "right_column", label: "Right Column (1:1)", platforms: ["facebook"], positions: ["right_hand_column"] },
  { key: "marketplace", label: "Marketplace (1:1)", platforms: ["facebook"], positions: ["marketplace"] },
  { key: "explore", label: "Explore (1:1, 4:5)", platforms: ["instagram"], positions: ["explore"] },
]

function MultiPlacementAdsModal({
  open, onClose, value, onConfirm, availableCreatives,
}: {
  open: boolean
  onClose: () => void
  value: MultiPlacementAdsState
  onConfirm: (v: MultiPlacementAdsState) => void
  availableCreatives: Creative[]
}) {
  const [local, setLocal] = useState<MultiPlacementAdsState>(value)
  const [activeGroupId, setActiveGroupId] = useState<string>("")
  const [search, setSearch] = useState("")
  const [view, setView] = useState<"grid" | "list">("grid")

  useEffect(() => {
    if (!open) return
    setLocal(value)
    if (value.groups.length > 0) setActiveGroupId(value.groups[0].id)
    else setActiveGroupId("")
  }, [open])

  const validGroupCount = local.groups.filter(g => g.creativeIds.length >= 2).length

  const usedAcrossActiveGroup = new Set(local.groups.find(g => g.id === activeGroupId)?.creativeIds || [])
  const filteredAvailable = availableCreatives
    .filter(c => !usedAcrossActiveGroup.has(c.id))
    .filter(c => !search || c.file_name.toLowerCase().includes(search.toLowerCase()))

  const addGroup = () => {
    const g: MultiPlacementGroup = {
      id: `mg_${Date.now()}`,
      name: `Multi Group ${local.groups.length + 1}`,
      creativeIds: [],
    }
    setLocal(s => ({ ...s, groups: [...s.groups, g] }))
    setActiveGroupId(g.id)
  }
  const deleteGroup = (id: string) => {
    const idx = local.groups.findIndex(g => g.id === id)
    const next = local.groups.filter(g => g.id !== id)
    setLocal(s => ({ ...s, groups: next }))
    if (activeGroupId === id) setActiveGroupId(next[Math.max(0, idx - 1)]?.id || "")
  }
  const updateGroupName = (id: string, name: string) => {
    setLocal(s => ({ ...s, groups: s.groups.map(g => g.id === id ? { ...g, name } : g) }))
  }
  const addToActiveGroup = (creativeId: string) => {
    if (!activeGroupId) {
      // Auto-create first group
      const g: MultiPlacementGroup = {
        id: `mg_${Date.now()}`,
        name: "Multi Group 1",
        creativeIds: [creativeId],
      }
      setLocal(s => ({ ...s, groups: [...s.groups, g] }))
      setActiveGroupId(g.id)
      return
    }
    setLocal(s => ({
      ...s,
      groups: s.groups.map(g => g.id !== activeGroupId ? g : (
        g.creativeIds.includes(creativeId) ? g : { ...g, creativeIds: [...g.creativeIds, creativeId] }
      )),
    }))
  }
  const removeFromGroup = (groupId: string, creativeId: string) => {
    setLocal(s => ({
      ...s,
      groups: s.groups.map(g => g.id !== groupId ? g : { ...g, creativeIds: g.creativeIds.filter(id => id !== creativeId) }),
    }))
  }
  const togglePlacement = (groupId: string, creativeId: string, placementKey: string) => {
    setLocal(s => ({
      ...s,
      groups: s.groups.map(g => {
        if (g.id !== groupId) return g
        const placements = { ...(g.placements || {}) }
        const list = placements[creativeId] || []
        placements[creativeId] = list.includes(placementKey)
          ? list.filter(p => p !== placementKey)
          : [...list, placementKey]
        return { ...g, placements }
      }),
    }))
  }
  const handleDone = () => {
    onConfirm({
      ...local,
      enabled: validGroupCount > 0,
      groups: local.groups.filter(g => g.creativeIds.length >= 2),
    })
    onClose()
  }

  const creativeById = (id: string) => availableCreatives.find(c => c.id === id)
  const thumbOf = (c?: Creative) => c ? (c.media_type === "video" ? c.fb_thumbnail_url : (c.fb_image_url || c.file_url)) : ""

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-6xl p-0 flex flex-col max-h-[92vh] overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b shrink-0">
          <DialogTitle className="text-base font-semibold">
            Group Media Together for Multi Placement Ads <span className="text-muted-foreground font-normal">({validGroupCount} ads loaded)</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pair your ads together to optimize for different placements. You can combine a square format (1:1) / (4:5) for Facebook newsfeed with a vertical format (9:16) for Instagram Stories.
          </p>
        </div>

        {/* Manual Placements toggle */}
        <div className="px-5 py-3 border-b shrink-0 flex items-center gap-2">
          <span className="text-sm font-medium">Manual Placements</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-bold">BETA</span>
          <button
            onClick={() => setLocal(s => ({ ...s, manualPlacements: !s.manualPlacements }))}
            className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
              local.manualPlacements ? "bg-primary" : "bg-muted-foreground/30")}
          >
            <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
              local.manualPlacements ? "translate-x-4" : "translate-x-0.5")} />
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-[1fr_360px] flex-1 min-h-0 overflow-hidden">
          {/* LEFT: Available Media */}
          <div className="border-r flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b shrink-0">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm font-semibold">Available Media</span>
                <span className="text-xs text-muted-foreground">• Select ads to group</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search media..."
                    className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="flex items-center bg-muted/30 border rounded-lg p-0.5">
                  <button onClick={() => setView("grid")}
                    className={cn("size-6 flex items-center justify-center rounded transition-colors",
                      view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                    <IconLayoutGrid className="size-3.5" />
                  </button>
                  <button onClick={() => setView("list")}
                    className={cn("size-6 flex items-center justify-center rounded transition-colors",
                      view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                    <IconTable className="size-3.5" />
                  </button>
                </div>
                <button className="flex items-center gap-1 text-xs px-2 py-1 border rounded-full hover:bg-muted/30" title="Auto-group with AI (coming soon)">
                  <span>AI Group</span>
                  <svg className="size-3.5 text-purple-500" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4" /></svg>
                </button>
                <IconInfoCircle className="size-3.5 text-muted-foreground" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-muted/10">
              {filteredAvailable.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  No available media
                </div>
              ) : view === "grid" ? (
                <div className="grid grid-cols-5 gap-2">
                  {filteredAvailable.map(c => {
                    const thumb = thumbOf(c)
                    return (
                      <button
                        key={c.id}
                        onClick={() => addToActiveGroup(c.id)}
                        className="group relative aspect-square rounded-lg overflow-hidden border bg-muted hover:ring-2 hover:ring-primary transition-all"
                      >
                        <CreativeCardMedia creative={c} className="w-full h-full object-cover" compact />
                        <div className="absolute inset-0 bg-primary/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <IconPlus className="size-5 text-white" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredAvailable.map(c => {
                    const thumb = thumbOf(c)
                    return (
                      <button
                        key={c.id}
                        onClick={() => addToActiveGroup(c.id)}
                        className="w-full flex items-center gap-3 p-2 border rounded-lg hover:bg-background transition-colors text-left"
                      >
                        <div className="size-10 rounded overflow-hidden bg-muted shrink-0">
                          <CreativeCardMedia creative={c} className="w-full h-full object-cover" compact />
                        </div>
                        <span className="text-sm truncate flex-1">{c.file_name}</span>
                        <IconPlus className="size-4 text-muted-foreground shrink-0" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Multi-format groups preview */}
          <div className="flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b shrink-0 flex items-center justify-between">
              <span className="text-sm font-semibold">Multi-Format Groups Preview</span>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addGroup}>
                <IconPlus className="size-3" />New Group
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-muted/10 space-y-3">
              {local.groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <p className="text-sm text-muted-foreground">No multi-format groups yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Click "New Group" to create your first multi-format group</p>
                </div>
              ) : (
                local.groups.map(g => (
                  <div
                    key={g.id}
                    onClick={() => setActiveGroupId(g.id)}
                    className={cn(
                      "border rounded-xl p-3 bg-background cursor-pointer transition-all",
                      activeGroupId === g.id ? "border-primary ring-1 ring-primary/30" : "hover:border-muted-foreground/30"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        value={g.name}
                        onClick={e => e.stopPropagation()}
                        onChange={e => updateGroupName(g.id, e.target.value)}
                        className="flex-1 bg-transparent outline-none text-sm font-semibold"
                      />
                      <span className="text-[11px] text-muted-foreground">{g.creativeIds.length} media</span>
                      <button
                        onClick={e => { e.stopPropagation(); deleteGroup(g.id) }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <IconTrash className="size-3.5" />
                      </button>
                    </div>
                    {g.creativeIds.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic">Click media on the left to add</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5">
                        {g.creativeIds.map(id => {
                          const c = creativeById(id)
                          const thumb = thumbOf(c)
                          return (
                            <div key={id} className="relative group">
                              <div className="aspect-square rounded overflow-hidden bg-muted border">
                                <CreativeCardMedia creative={c!} className="w-full h-full object-cover" compact />
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); removeFromGroup(g.id, id) }}
                                className="absolute -top-1 -right-1 size-4 rounded-full bg-background border shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100"
                              >
                                <IconX className="size-2.5" />
                              </button>
                              {/* Manual placements selector */}
                              {local.manualPlacements && (
                                <div className="mt-1 flex flex-wrap gap-0.5">
                                  {META_PLACEMENTS.map(p => {
                                    const active = (g.placements?.[id] || []).includes(p.key)
                                    return (
                                      <button
                                        key={p.key}
                                        onClick={e => { e.stopPropagation(); togglePlacement(g.id, id, p.key) }}
                                        className={cn(
                                          "text-[8px] px-1 py-0.5 rounded transition-colors",
                                          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                                        )}
                                        title={p.label}
                                      >
                                        {p.key}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {g.creativeIds.length === 1 && (
                      <p className="text-[10px] text-amber-600 mt-1.5">Add at least 2 different aspect ratios</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t shrink-0">
          <Button
            className="w-full h-10"
            disabled={validGroupCount === 0}
            onClick={handleDone}
          >
            Done ({validGroupCount} multi ad{validGroupCount !== 1 ? "s" : ""} created) ↵
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

const MOCKUP_PLATFORMS = [
  { key: "meta", label: "Meta", Icon: IconBrandMeta },
  { key: "instagram", label: "Instagram", Icon: IconBrandInstagram },
  { key: "tiktok", label: "TikTok", Icon: IconBrandTiktok },
  { key: "snapchat", label: "Snapchat", Icon: IconBrandSnapchat },
  { key: "admanage", label: "AdManage", Icon: IconRocket },
  { key: "loom", label: "Loom", Icon: IconPlayerPlay },
  { key: "reddit", label: "Reddit", Icon: IconBrandReddit },
  { key: "linkedin", label: "LinkedIn", Icon: IconBrandLinkedin },
] as const
type MockupPlatform = typeof MOCKUP_PLATFORMS[number]["key"]

// ─── Platform Mockups ────────────────────────────────────────────────────────

interface MockupProps {
  mockup: MockupPlatform
  placement: "feed" | "story"
  page?: FacebookPage
  creative: Creative
  thumb?: string
  isVideo: boolean
  primaryText: string
  headline: string
  webLink: string
  ctaLabel: string
  primaryExpanded: boolean
  setPrimaryExpanded: (v: boolean) => void
}

function MediaArea({ thumb, creative, isVideo, aspect = "aspect-square", roundBottom = false }: {
  thumb?: string
  creative: Creative
  isVideo: boolean
  aspect?: string
  roundBottom?: boolean
}) {
  return (
    <div className={cn("relative bg-black group/media overflow-hidden", aspect, roundBottom && "rounded-b-xl")}>
      {thumb && (
        <img
          src={thumb}
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60 pointer-events-none"
          alt=""
        />
      )}
      <div className="relative w-full h-full z-10">
        <CreativeCardMedia creative={creative} className="w-full h-full object-contain bg-transparent" />
      </div>
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity group-hover/media:opacity-0 z-20">
          <div className="size-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <IconPlayerPlay className="size-6 text-foreground translate-x-0.5" />
          </div>
        </div>
      )}
    </div>
  )
}

function PlatformMockup(props: MockupProps) {
  const { mockup } = props
  switch (mockup) {
    case "instagram": return <InstagramMockup {...props} />
    case "tiktok": return <TikTokMockup {...props} />
    case "snapchat": return <SnapchatMockup {...props} />
    case "admanage": return <AdManageMockup {...props} />
    case "loom": return <LoomMockup {...props} />
    case "reddit": return <RedditMockup {...props} />
    case "linkedin": return <LinkedInMockup {...props} />
    default: return <MetaMockup {...props} />
  }
}

// ── META / FACEBOOK ──
function MetaMockup({ page, creative, thumb, isVideo, primaryText, headline, webLink, ctaLabel, primaryExpanded, setPrimaryExpanded, placement }: MockupProps) {
  return (
    <div className="w-full max-w-[400px] bg-background border rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-4 py-3">
        {page?.picture?.data?.url
          ? <img src={page.picture.data.url} className="size-10 rounded-full shrink-0 object-cover border" alt="" />
          : <div className="size-10 rounded-full bg-emerald-600 flex items-center justify-center shrink-0"><span className="text-sm font-bold text-white">{(page?.name || "P").slice(0, 1)}</span></div>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-[14px] font-bold hover:underline cursor-pointer">{page?.name || "Your Page"}</span>
            <IconCircleCheck className="size-3.5 text-blue-500 shrink-0" />
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <p className="text-[12px] text-[#65676B] font-medium">Sponsored</p>
            <span className="text-[#65676B]">·</span>
            <IconWorld className="size-3 text-[#65676B]" />
          </div>
        </div>
        <button className="text-[#65676B] p-1.5 rounded-full"><IconDotsVertical className="size-4" /></button>
      </div>
      {primaryText && (
        <div className="px-3 pb-2.5 text-[13px]">
          <p className={primaryExpanded ? "" : "line-clamp-3"}>{primaryText}</p>
          {primaryText.length > 120 && (
            <button onClick={() => setPrimaryExpanded(!primaryExpanded)} className="text-muted-foreground hover:underline text-xs mt-0.5">
              {primaryExpanded ? "See less" : "See more"}
            </button>
          )}
        </div>
      )}
      <MediaArea thumb={thumb} creative={creative} isVideo={isVideo} aspect={placement === "story" ? "aspect-[9/16]" : "aspect-square"} />
      {(headline || webLink) && placement === "feed" && (
        <div className="flex items-center justify-between px-3 py-2.5 bg-muted/30 border-t">
          <div className="flex-1 min-w-0">
            {webLink && <p className="text-[11px] text-[#65676B] uppercase truncate font-medium">{(() => { try { return new URL(webLink).hostname } catch { return webLink } })()}</p>}
            {headline && <p className="text-[15px] font-bold truncate leading-tight mt-0.5">{headline}</p>}
          </div>
          <Button size="sm" variant="outline" className="h-9 px-4 text-[13px] font-bold bg-[#E4E6EB] hover:bg-[#D8DADF] border-none text-[#050505] shrink-0 ml-3 rounded-lg">{ctaLabel}</Button>
        </div>
      )}
      <div className="flex items-center gap-3 px-3 py-2 border-t">
        <div className="flex items-center gap-1 text-[13px] text-[#65676B]">
          <div className="flex -space-x-1 mr-1">
            <span className="size-[18px] rounded-full bg-[#1877F2] border-2 border-background flex items-center justify-center"><IconThumbUp className="size-[10px] text-white" /></span>
            <span className="size-[18px] rounded-full bg-[#F33E58] border-2 border-background flex items-center justify-center text-white text-[10px]">♥</span>
          </div>
          <span className="hover:underline cursor-pointer">420</span>
        </div>
        <span className="text-[13px] text-[#65676B] ml-auto hover:underline cursor-pointer">96 comments</span>
      </div>
      <div className="grid grid-cols-3 border-t mx-3 my-1">
        {[{i: IconThumbUp, l: "Like"}, {i: IconMessageCircle, l: "Comment"}, {i: IconShare3, l: "Share"}].map(({i: I, l}) => (
          <button key={l} className="flex items-center justify-center gap-2 py-1.5 text-[13px] font-semibold text-[#65676B] hover:bg-muted/50 rounded-md">
            <I className="size-[18px]" />{l}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── INSTAGRAM ──
function InstagramMockup({ page, creative, thumb, isVideo }: MockupProps) {
  return (
    <div className="w-full max-w-[400px] bg-background border rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          {page?.picture?.data?.url
            ? <img src={page.picture.data.url} className="size-9 rounded-full object-cover ring-2 ring-pink-500/30" alt="" />
            : <div className="size-9 rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 p-0.5"><div className="size-full rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">{(page?.name || "P").slice(0, 1)}</div></div>}
          <div>
            <p className="text-[13px] font-semibold leading-tight">@{page?.name?.toLowerCase().replace(/\s+/g, "") || "your_page"}</p>
            <p className="text-[11px] text-muted-foreground">Sponsored</p>
          </div>
        </div>
        <button><IconDotsVertical className="size-4" /></button>
      </div>
      <MediaArea thumb={thumb} creative={creative} isVideo={isVideo} aspect="aspect-square" />
      <div className="px-3 py-2 flex items-center gap-3">
        <IconHeart className="size-6" />
        <IconMessageCircle className="size-6" />
        <IconSend className="size-6" />
        <IconBookmarkOutline className="size-6 ml-auto" />
      </div>
      <p className="px-3 pb-3 text-[13px] font-semibold">@{page?.name?.toLowerCase().replace(/\s+/g, "") || "your_page"}</p>
    </div>
  )
}

// ── TIKTOK ──
function TikTokMockup({ page, creative, thumb, isVideo, ctaLabel }: MockupProps) {
  return (
    <div className="w-full max-w-[280px] bg-black rounded-2xl overflow-hidden shadow-xl relative" style={{ aspectRatio: "9/16" }}>
      {/* Top tabs */}
      <div className="absolute top-0 left-0 right-0 z-30 flex justify-center items-center gap-6 pt-3 pb-2 text-white">
        <span className="text-sm opacity-70">Following</span>
        <span className="text-sm font-bold border-b-2 border-white pb-0.5">For You</span>
      </div>
      {/* Media background */}
      <div className="absolute inset-0">
        <CreativeCardMedia creative={creative} className="w-full h-full object-cover" />
      </div>
      {/* Right side actions */}
      <div className="absolute right-2 bottom-20 flex flex-col items-center gap-4 z-20 text-white">
        {page?.picture?.data?.url
          ? <div className="relative"><img src={page.picture.data.url} className="size-10 rounded-full ring-2 ring-white object-cover" alt="" /><div className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-4 rounded-full bg-red-500 flex items-center justify-center text-white text-[10px] font-bold">+</div></div>
          : <div className="size-10 rounded-full bg-pink-500 flex items-center justify-center text-white font-bold ring-2 ring-white">{(page?.name || "Y").slice(0, 1)}</div>}
        <div className="flex flex-col items-center"><IconHeart className="size-7" /><span className="text-[10px] font-semibold">991K</span></div>
        <div className="flex flex-col items-center"><IconMessageCircle className="size-7" /><span className="text-[10px] font-semibold">3456</span></div>
        <div className="flex flex-col items-center"><IconBookmarkOutline className="size-7" /><span className="text-[10px] font-semibold">810</span></div>
        <div className="flex flex-col items-center"><IconShare3 className="size-7" /><span className="text-[10px] font-semibold">1256</span></div>
      </div>
      {/* Bottom info + CTA */}
      <div className="absolute left-0 right-0 bottom-12 px-3 z-20 text-white">
        <p className="text-sm font-bold mb-0.5">{page?.name || "Your Page Name"}</p>
        <p className="text-[11px] opacity-80 mb-2">Sponsored</p>
        <button className="w-full bg-[#FE2C55] text-white text-sm font-semibold py-2 rounded">{ctaLabel}</button>
      </div>
      {/* Bottom nav */}
      <div className="absolute bottom-0 left-0 right-0 grid grid-cols-5 py-2 bg-black/80 z-20 text-white">
        {["Home", "Friends", "+", "Inbox", "Me"].map(l => (
          <span key={l} className="text-center text-[10px] font-medium">{l}</span>
        ))}
      </div>
    </div>
  )
}

// ── SNAPCHAT ──
function SnapchatMockup({ page, creative, thumb, isVideo, headline, webLink, ctaLabel }: MockupProps) {
  return (
    <div className="w-full max-w-[280px] bg-black rounded-3xl overflow-hidden shadow-xl relative" style={{ aspectRatio: "9/19.5" }}>
      {/* Status bar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex justify-between items-center px-5 pt-2 pb-1 text-white text-[10px] font-semibold">
        <span>9:41</span>
        <div className="flex items-center gap-1">
          <span>•••</span>
          <span>📶</span>
          <span>🔋</span>
        </div>
      </div>
      <div className="absolute top-7 left-3 right-3 z-30 flex items-center gap-2 text-white">
        {page?.picture?.data?.url
          ? <img src={page.picture.data.url} className="size-7 rounded-full object-cover" alt="" />
          : <div className="size-7 rounded-full bg-emerald-500" />}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold flex items-center gap-1">{page?.name || "Your Page"} <span className="opacity-70">· Ad</span></p>
          <p className="text-[10px] opacity-80">{headline || "Your headline here"}</p>
        </div>
        <button><IconDotsVertical className="size-4" /></button>
      </div>
      {/* Media */}
      <div className="absolute inset-0">
        <CreativeCardMedia creative={creative} className="w-full h-full object-cover" />
      </div>
      {/* Bottom card */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-black/95 px-3 pt-3 pb-2 text-white">
        <div className="flex items-center gap-2 mb-2">
          {page?.picture?.data?.url
            ? <img src={page.picture.data.url} className="size-8 rounded-full object-cover" alt="" />
            : <div className="size-8 rounded-full bg-emerald-500" />}
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold flex items-center gap-1 truncate">{page?.name || "Your Page"} <IconArrowRight className="size-3" /></p>
            <p className="text-[10px] opacity-80 truncate">{headline || "Your headline here"}</p>
            <p className="text-[10px] opacity-60 truncate">{(() => { try { return new URL(webLink).hostname } catch { return webLink || "your-link.com" } })()}</p>
          </div>
          <IconHeart className="size-5" />
        </div>
        <button className="w-full bg-yellow-400 text-black font-bold text-sm py-2 rounded-full mb-1">{ctaLabel}</button>
      </div>
    </div>
  )
}

// ── ADMANAGE (custom phone mockup) ──
function AdManageMockup({ creative, thumb, isVideo }: MockupProps) {
  const [tab, setTab] = useState<"video" | "endcard">("video")
  return (
    <div className="w-full max-w-[300px]">
      <div className="flex items-center justify-center gap-2 mb-3">
        <button onClick={() => setTab("video")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium", tab === "video" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          <IconPlayerPlay className="size-4" />Video
        </button>
        <button onClick={() => setTab("endcard")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium", tab === "endcard" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          <IconPhoto className="size-4" />Endcard
        </button>
      </div>
      <div className="relative bg-black rounded-[2.5rem] p-2 shadow-2xl">
        <div className="rounded-[2rem] overflow-hidden bg-black" style={{ aspectRatio: "9/19.5" }}>
          <CreativeCardMedia creative={creative} className="w-full h-full object-cover" />
        </div>
      </div>
    </div>
  )
}

// ── LOOM (video player style) ──
function LoomMockup({ creative, thumb, isVideo, webLink, ctaLabel }: MockupProps) {
  const duration = (creative as any).duration || "0:52"
  return (
    <div className="w-full max-w-[400px] bg-background border rounded-xl overflow-hidden shadow-sm">
      <MediaArea thumb={thumb} creative={creative} isVideo={isVideo} aspect="aspect-video" />
      <div className="bg-black/95 text-white px-3 py-2 flex items-center gap-2 text-xs">
        <IconPlayerPlay className="size-4" />
        <span className="opacity-80">0:00 / {duration}</span>
        <IconVolumeOff className="size-4 ml-auto opacity-80" />
        <IconMaximize className="size-4 opacity-80" />
        <IconDotsVertical className="size-4 opacity-80" />
      </div>
      <div className="flex items-center justify-between px-3 py-2.5 bg-background border-t">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-muted-foreground truncate"><span className="font-medium text-foreground">{(() => { try { return new URL(webLink).hostname } catch { return webLink || "your-link.com" } })()}</span> · Sponsored</p>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs rounded-full ml-3 shrink-0">{ctaLabel}</Button>
      </div>
    </div>
  )
}

// ── REDDIT ──
function RedditMockup({ page, creative, thumb, isVideo, headline, webLink, ctaLabel }: MockupProps) {
  return (
    <div className="w-full max-w-[400px] bg-background border rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2.5">
        {page?.picture?.data?.url
          ? <img src={page.picture.data.url} className="size-8 rounded-full object-cover" alt="" />
          : <div className="size-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">{(page?.name || "U").slice(0, 1)}</div>}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold">u/{page?.name?.toLowerCase().replace(/\s+/g, "") || "your_page"} · <span className="text-muted-foreground font-normal">Promoted</span></p>
        </div>
        <button><IconDotsVertical className="size-4" /></button>
      </div>
      {headline && <p className="px-3 pb-2 text-[16px] font-bold leading-tight">{headline}</p>}
      <MediaArea thumb={thumb} creative={creative} isVideo={isVideo} aspect="aspect-square" />
      <div className="flex items-center justify-between px-3 py-2.5 border-t">
        <p className="text-[12px] text-muted-foreground truncate font-medium">{(() => { try { return new URL(webLink).hostname } catch { return webLink || "your-link.com" } })()}</p>
        <Button size="sm" variant="outline" className="h-8 text-xs rounded-full ml-3 shrink-0">{ctaLabel}</Button>
      </div>
      <div className="flex items-center gap-4 px-3 py-2 border-t text-muted-foreground">
        <div className="flex items-center gap-1"><IconArrowUp className="size-4" /><span className="text-xs font-medium">Vote</span><IconArrowDown className="size-4" /></div>
        <div className="flex items-center gap-1"><IconMessageCircle className="size-4" /><span className="text-xs">0</span></div>
        <div className="flex items-center gap-1 ml-auto"><IconShare3 className="size-4" /><span className="text-xs">Share</span></div>
      </div>
    </div>
  )
}

// ── LINKEDIN ──
function LinkedInMockup({ page, creative, thumb, isVideo, primaryText, headline, webLink, ctaLabel, primaryExpanded, setPrimaryExpanded }: MockupProps) {
  return (
    <div className="w-full max-w-[400px] bg-background border rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-start gap-2.5 px-3 py-3">
        {page?.picture?.data?.url
          ? <img src={page.picture.data.url} className="size-12 rounded-full object-cover" alt="" />
          : <div className="size-12 rounded-full bg-emerald-500 flex items-center justify-center text-white text-base font-bold">{(page?.name || "P").slice(0, 1)}</div>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-[14px] font-bold truncate">{page?.name || "Your Page"}</p>
            <span className="size-4 bg-[#0A66C2] flex items-center justify-center rounded-sm"><IconBrandLinkedin className="size-3 text-white" /></span>
          </div>
          <p className="text-[12px] text-muted-foreground">Followers</p>
          <p className="text-[12px] text-muted-foreground">Promoted · <IconWorld className="size-3 inline" /></p>
        </div>
        <button className="text-[#0A66C2] text-[13px] font-semibold flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded">
          <IconPlusFollow className="size-3.5" />Follow
        </button>
      </div>
      {primaryText && (
        <div className="px-3 pb-2.5 text-[13px]">
          <p className={primaryExpanded ? "" : "line-clamp-3"}>{primaryText}</p>
          {primaryText.length > 120 && (
            <button onClick={() => setPrimaryExpanded(!primaryExpanded)} className="text-muted-foreground hover:underline text-xs mt-0.5">
              {primaryExpanded ? "see less" : "…see more"}
            </button>
          )}
        </div>
      )}
      <MediaArea thumb={thumb} creative={creative} isVideo={isVideo} aspect="aspect-square" />
      <div className="flex items-center justify-between px-3 py-2.5 bg-muted/30 border-t">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted-foreground uppercase truncate font-medium">{(() => { try { return new URL(webLink).hostname } catch { return webLink || "your-link.com" } })()}</p>
          {headline && <p className="text-[14px] font-semibold truncate leading-tight mt-0.5">{headline}</p>}
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs font-semibold rounded-full ml-3 shrink-0 border-[#0A66C2] text-[#0A66C2] hover:bg-blue-50">{ctaLabel}</Button>
      </div>
    </div>
  )
}

function PreviewModal({
  open, onClose, creatives, page, primaryText, headline, webLink, cta, adNameOverrides, onUpdateCreative,
}: {
  open: boolean
  onClose: () => void
  creatives: Creative[]
  page?: FacebookPage
  primaryText: string
  headline: string
  webLink: string
  cta: string
  adNameOverrides: Record<string, string>
  onUpdateCreative?: (c: Creative) => void
}) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [mockup, setMockup] = useState<MockupPlatform>("meta")
  const [placement, setPlacement] = useState<"feed" | "story">("feed")
  const [primaryExpanded, setPrimaryExpanded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [uploadingThumb, setUploadingThumb] = useState(false)
  const thumbInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) { setActiveIdx(0); setPlacement("feed"); setMockup("meta"); setPrimaryExpanded(false) } }, [open])

  if (creatives.length === 0) {
    return (
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-md p-6">
          <DialogTitle>Preview</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">No creatives to preview. Load media first.</p>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const creative = creatives[activeIdx]
  const customName = adNameOverrides[creative.id]
  const adName = customName ?? creative.file_name.replace(/\.[^/.]+$/, "")
  const isVideo = creative.media_type === "video"
  const thumb = creative.fb_thumbnail_url || creative.fb_image_url || creative.file_url
  // Fallback to creative's saved metadata if main form fields are empty
  const effectivePrimaryText = primaryText || creative.primary_text || ""
  const effectiveHeadline = headline || creative.headline || ""
  const effectiveWebLink = webLink || creative.link_url || ""
  const effectiveCta = cta || creative.cta || "LEARN_MORE"
  const ctaLabel = CTA_OPTIONS.find(o => o.value === effectiveCta)?.label || "Learn More"
  const duration = (creative as any).duration as string | undefined
  const fileSizeMB = (creative as any).file_size ? `${((creative as any).file_size / 1024 / 1024).toFixed(2)}MB` : ""

  const refreshThumbnail = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      const res = await fetch(`/api/creatives/${creative.id}/thumbnail`, { method: "POST" })
      const data = await res.json()
      if (data.thumbnail_url || data.source_url) {
        onUpdateCreative?.({
          ...creative,
          fb_thumbnail_url: data.thumbnail_url || creative.fb_thumbnail_url,
          file_url: data.source_url || creative.file_url || data.thumbnail_url
        })
      }
    } catch {} finally {
      setRefreshing(false)
    }
  }

  const handleUploadThumb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || uploadingThumb) return
    setUploadingThumb(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`/api/creatives/${creative.id}/custom-thumbnail`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.thumbnail_url) {
        onUpdateCreative?.({ ...creative, fb_thumbnail_url: data.thumbnail_url })
      }
    } catch {} finally {
      setUploadingThumb(false)
      e.target.value = ""
    }
  }

  const downloadTranscript = () => {
    if (!creative.transcript) return
    const blob = new Blob([creative.transcript], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${creative.file_name}_transcript.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const regenerateTranscript = async () => {
    // Placeholder for real logic
    console.log("Regenerating transcript...")
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-5xl h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <div className="grid grid-cols-[1fr_400px] flex-1 min-h-0 overflow-hidden">
          {/* LEFT: Mockup area */}
          <div className="bg-muted/30 overflow-y-auto p-6 flex flex-col items-center">
            {/* Carousel nav for multiple ads */}
            {creatives.length > 1 && (
              <div className="flex items-center gap-3 mb-3 self-start">
                <button onClick={() => setActiveIdx(i => Math.max(0, i - 1))} disabled={activeIdx === 0}
                  className="size-7 rounded-full bg-background border flex items-center justify-center hover:bg-muted disabled:opacity-30">
                  <IconArrowLeft className="size-3.5" />
                </button>
                <span className="text-xs text-muted-foreground">{activeIdx + 1} / {creatives.length}</span>
                <button onClick={() => setActiveIdx(i => Math.min(creatives.length - 1, i + 1))} disabled={activeIdx === creatives.length - 1}
                  className="size-7 rounded-full bg-background border flex items-center justify-center hover:bg-muted disabled:opacity-30">
                  <IconArrowRight className="size-3.5" />
                </button>
              </div>
            )}

            {/* Platform-specific mockup */}
            <PlatformMockup
              mockup={mockup}
              placement={placement}
              page={page}
              creative={creative}
              thumb={thumb}
              isVideo={isVideo}
              primaryText={effectivePrimaryText}
              headline={effectiveHeadline}
              webLink={effectiveWebLink}
              ctaLabel={ctaLabel}
              primaryExpanded={primaryExpanded}
              setPrimaryExpanded={setPrimaryExpanded}
            />
          </div>

          {/* RIGHT: Details panel */}
          <div className="border-l flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
              <DialogTitle className="text-base font-semibold">Preview</DialogTitle>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Choose Mockup */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-sm font-medium">Choose Mockup</span>
                  <IconInfoCircle className="size-3.5 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-1 border rounded-lg p-1">
                  {MOCKUP_PLATFORMS.map(p => (
                    <button
                      key={p.key}
                      onClick={() => setMockup(p.key)}
                      title={p.label}
                      className={cn(
                        "flex-1 size-9 flex items-center justify-center rounded-md transition-colors",
                        mockup === p.key ? "bg-muted shadow-sm" : "hover:bg-muted/50"
                      )}
                    >
                      <p.Icon className={cn("size-4", mockup === p.key ? "text-foreground" : "text-muted-foreground")} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Placement */}
              <div>
                <div className="text-sm font-medium mb-2">Placement</div>
                <div className="grid grid-cols-2 border rounded-lg p-1">
                  {(["feed", "story"] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPlacement(p)}
                      className={cn(
                        "py-2 text-sm font-semibold rounded-md transition-colors capitalize",
                        placement === p ? "bg-primary text-primary-foreground" : "hover:bg-muted/50 text-muted-foreground"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ad Details */}
              <div>
                <div className="text-sm font-medium mb-2">Ad Details</div>
                <div className="border rounded-lg overflow-hidden">
                  {/* Destination URL */}
                  <div className="px-4 py-3 border-b bg-blue-50/70 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/50 transition-colors">
                    <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Destination URL:</p>
                    <a href={effectiveWebLink} target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-primary hover:underline break-all block">
                      {effectiveWebLink || "—"}
                    </a>
                    <div className="mt-2.5 pt-2 border-t border-blue-200/50">
                      <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-0.5">UTM Parameters:</p>
                      <p className="text-[11px] text-muted-foreground font-medium italic">
                        {(() => {
                          try {
                            const params = new URL(effectiveWebLink).searchParams
                            const utm: string[] = []
                            params.forEach((v, k) => { if (k.startsWith("utm_")) utm.push(`${k}=${v}`) })
                            return utm.length > 0 ? utm.join(" · ") : "No UTM params"
                          } catch {
                            return "No UTM params"
                          }
                        })()}
                      </p>
                    </div>
                  </div>

                  {/* Static rows */}
                  {[
                    { label: "Creative ID", value: creative.id.startsWith("temp_") ? "N/A" : creative.id.slice(0, 12) },
                    { label: "Source", value: "launch" },
                    { label: "Dimensions", value: (creative as any).dimensions || (isVideo ? "1080x1920" : "—") },
                    ...(duration ? [{ label: "Duration", value: duration }] : []),
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between px-3 py-2 border-b text-xs">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-medium text-right truncate ml-2">{row.value}</span>
                    </div>
                  ))}

                  <div className="px-3 py-2 border-b text-xs">
                    <p className="text-muted-foreground mb-0.5">Original filename</p>
                    <p className="font-medium text-foreground/80 break-all">{creative.file_name}</p>
                  </div>

                  <div className="px-3 py-2 border-b text-xs">
                    <p className="text-muted-foreground mb-0.5">Ad Name Preview</p>
                    <p className="font-medium text-foreground/80 break-all">{adName}</p>
                  </div>

                  <div className="px-3 py-2 border-b text-xs">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-muted-foreground">Thumbnail URL</p>
                      <button onClick={refreshThumbnail} className={cn("text-muted-foreground hover:text-foreground", refreshing && "animate-spin")}>
                        <IconRefresh className="size-3" />
                      </button>
                    </div>
                    <a href={thumb} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{thumb || "—"}</a>
                  </div>

                  <div className="px-3 py-2 text-xs">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-muted-foreground">Custom Thumbnail</p>
                      <input type="file" ref={thumbInputRef} className="hidden" accept="image/*" onChange={handleUploadThumb} />
                      <button onClick={() => thumbInputRef.current?.click()} className={cn("text-muted-foreground hover:text-foreground", uploadingThumb && "animate-pulse")}>
                        <IconUpload className="size-3" />
                      </button>
                    </div>
                    <p className="font-medium text-muted-foreground/70">{creative.fb_thumbnail_url ? "Set" : "Not set"}</p>
                  </div>
                </div>
              </div>

              {/* Transcript */}
              {isVideo && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium">Transcript</span>
                    <div className="flex items-center gap-1.5">
                      <button onClick={downloadTranscript} disabled={!creative.transcript} className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Download transcript"><IconDownload className="size-3.5" /></button>
                      <button onClick={regenerateTranscript} className="text-muted-foreground hover:text-foreground" title="Re-generate"><IconRefresh className="size-3.5" /></button>
                    </div>
                  </div>
                  <div className="border rounded-lg p-3.5 text-xs text-muted-foreground leading-relaxed bg-muted/5 min-h-[60px]">
                    {creative.transcript ? (
                      <p>{creative.transcript}</p>
                    ) : isVideo ? (
                      <p className="italic">Auto-transcript will appear here after Meta processes the video. (Requires speech-to-text integration.)</p>
                    ) : (
                      <p className="italic">No transcript available for static images.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Smart Tags */}
              <div>
                <div className="text-sm font-medium mb-1.5">Smart Tags</div>
                <div className="flex flex-wrap gap-1">
                  {(creative.tags || ["influencer", "senior", "outdoor", "selfie", "textoverlay", "aging"]).map(tag => (
                    <span key={tag} className="text-[11px] px-2.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium border border-zinc-200 dark:border-zinc-700">{tag}</span>
                  ))}
                </div>
                {!creative.tags && (
                  <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                    <IconLoader2 className="size-2.5 animate-spin" />
                    Analyzing media for smart tags...
                  </p>
                )}
              </div>

              {/* Files in this Ad */}
              <div className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
                  <span className="text-sm font-medium">Files in this Ad ({creatives.length})</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                    <IconDownload className="size-3" />Download All
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {creatives.map((c, i) => {
                    const ct = c.fb_thumbnail_url || c.fb_image_url || c.file_url
                    const cd = (c as any).duration
                    const cdim = (c as any).dimensions || (c.media_type === "video" ? "1080x1920" : "—")
                    return (
                      <div
                        key={c.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveIdx(i)}
                        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setActiveIdx(i) }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/30 transition-all text-left relative cursor-pointer",
                          activeIdx === i ? "bg-blue-50/50 dark:bg-blue-900/10 ring-2 ring-primary ring-inset" : ""
                        )}
                      >
                        <div className="size-10 rounded overflow-hidden bg-muted shrink-0 relative">
                          {ct ? <img src={ct} alt="" className="w-full h-full object-cover" /> :
                            <div className="w-full h-full flex items-center justify-center"><IconVideo className="size-3 text-muted-foreground/40" /></div>}
                          {c.media_type === "video" && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <IconPlayerPlay className="size-3 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate" title={c.file_name}>{c.file_name}</p>
                          <p className="text-[10px] text-muted-foreground">{cdim}{cd ? ` · ${cd}` : ""}</p>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); if (ct) window.open(ct, "_blank") }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <IconDownload className="size-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DynamicMediaToggle({ title, desc, checked, onChange, disabled, indent }: {
  title: string; desc: string; checked: boolean
  onChange: (v: boolean) => void; disabled?: boolean; indent?: boolean
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", indent && "pl-4")}>
      <div className={cn("flex-1", disabled && "opacity-50")}>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
          checked && !disabled ? "bg-primary" : "bg-muted-foreground/30",
          disabled && "opacity-50 cursor-not-allowed")}
      >
        <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
          checked && !disabled ? "translate-x-4" : "translate-x-0.5")} />
      </button>
    </div>
  )
}

// ─── Load Media Modal ─────────────────────────────────────────────────────────

type MediaTab = "library" | "existing" | "gdrive" | "drive_browser" | "drive_link" | "integrations"
type SortField = "name" | "ad_id" | "dimensions" | "duration" | "date" | "status" | "user" | "workspace"
type SortDir = "asc" | "desc"

interface ExistingAdRow {
  id: string
  name: string
  status: string
  effective_status: string
  date_created: string
  page_name?: string
  page_id?: string
  post_id?: string
  post_url?: string
  thumb_url?: string
  image_hash?: string
  video_id?: string
  media_type: "image" | "video" | "unknown"
  spend: number
  impressions: number
  results: number
  roas: number
  platform: string
}
type ExistingSortField = "name" | "page" | "date" | "status" | "spend" | "roas" | "results" | "impressions"
const DATE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7d", label: "Last 7 days" },
  { value: "last_14d", label: "Last 14 days" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "last_90d", label: "Last 90 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "maximum", label: "Maximum" },
]
const EXISTING_COLUMNS = [
  { key: "page", label: "Page" },
  { key: "date", label: "Date Created" },
  { key: "post", label: "Post" },
  { key: "status", label: "Status" },
  { key: "platform", label: "Platform" },
  { key: "spend", label: "Spend" },
  { key: "roas", label: "ROAS" },
  { key: "results", label: "Results" },
  { key: "impressions", label: "Impressions" },
]
function formatNumberShort(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}
function formatCurrency(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

function LoadMediaModal({
  open, onClose, adAccountId, adAccounts, alreadySelected, onConfirm,
}: {
  open: boolean; onClose: () => void; adAccountId: string
  adAccounts?: AdAccountItem[]
  alreadySelected: Set<string>; onConfirm: (ids: string[], creatives: Creative[]) => void
}) {
  // ── Existing Ads tab state ──────────────────────────────────────
  const [existingAds, setExistingAds] = useState<ExistingAdRow[]>([])
  const [existingLoading, setExistingLoading] = useState(false)
  const [existingError, setExistingError] = useState<string>("")
  const [existingAfter, setExistingAfter] = useState<string>("")
  const [existingHasMore, setExistingHasMore] = useState(false)
  const [existingSearch, setExistingSearch] = useState("")
  const [existingDatePreset, setExistingDatePreset] = useState("last_30d")
  const [existingActiveOnly, setExistingActiveOnly] = useState(false)
  const [existingActiveAdSetOnly, setExistingActiveAdSetOnly] = useState(false)
  const [existingSortField, setExistingSortField] = useState<ExistingSortField>("spend")
  const [existingSortDir, setExistingSortDir] = useState<SortDir>("desc")
  const [existingSelected, setExistingSelected] = useState<Set<string>>(new Set())
  const [existingColumnsOpen, setExistingColumnsOpen] = useState(false)
  const [existingMetricsOpen, setExistingMetricsOpen] = useState(false)
  const [existingDateOpen, setExistingDateOpen] = useState(false)
  const [existingAccountId, setExistingAccountId] = useState(adAccountId)
  const [existingAccountOpen, setExistingAccountOpen] = useState(false)
  const [existingFilterOpen, setExistingFilterOpen] = useState(false)
  const [existingIncludeOpen, setExistingIncludeOpen] = useState(false)
  const [existingIncludeMode, setExistingIncludeMode] = useState<"creatives" | "full" | "ad_settings">("creatives")
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(["page", "date", "post", "status", "platform", "spend", "roas", "results", "impressions"])
  )
  const [allCreatives, setAllCreatives] = useState<Creative[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [mediaTab, setMediaTab] = useState<MediaTab>("library")
  const [selected, setSelected] = useState<Set<string>>(new Set(alreadySelected))
  // Filter chip values
  const [filters, setFilters] = useState<{
    uploader: string; status: string; channels: string; fileType: string
    dimensions: string; workspace: string; source: string; dateAdded: string
  }>({
    uploader: "all", status: "all", channels: "all", fileType: "all",
    dimensions: "all", workspace: "all", source: "all", dateAdded: "all",
  })
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>("date")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState("")
  const [includeOpen, setIncludeOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    if (!open || !adAccountId) return
    setSelected(new Set(alreadySelected))
    fetchCreatives()
  }, [open, adAccountId])

  // Polling for missing thumbnails in Library tab
  useEffect(() => {
    if (!open || mediaTab !== "library" || allCreatives.length === 0) return
    
    const pending = allCreatives.filter(c => c.media_type === "video" && !c.fb_thumbnail_url)
    if (pending.length === 0) return

    const interval = setInterval(async () => {
      // Check first 5 pending to avoid too many requests
      const toCheck = pending.slice(0, 5)
      for (const c of toCheck) {
        try {
          const res = await fetch(`/api/creatives/${c.id}/thumbnail`, { method: "POST" })
          const data = await res.json()
          if (data.thumbnail_url || data.source_url) {
            setAllCreatives(prev => prev.map(x => 
              x.id === c.id 
                ? { 
                    ...x, 
                    fb_thumbnail_url: data.thumbnail_url || x.fb_thumbnail_url,
                    file_url: data.source_url || x.file_url || data.thumbnail_url
                  } 
                : x
            ))
          }
        } catch {}
      }
    }, 5000)
    
    return () => clearInterval(interval)
  }, [open, mediaTab, allCreatives])

  // Sync existing ads ad-account when prop changes
  useEffect(() => {
    if (open) setExistingAccountId(adAccountId)
  }, [open, adAccountId])

  // Auto-fetch existing ads when entering tab or filter changes
  useEffect(() => {
    if (!open || mediaTab !== "existing" || !existingAccountId) return
    fetchExistingAds(true)
  }, [open, mediaTab, existingAccountId, existingDatePreset, existingActiveOnly, existingActiveAdSetOnly])

  const fetchExistingAds = async (reset: boolean) => {
    setExistingLoading(true)
    setExistingError("")
    try {
      const params = new URLSearchParams({
        ad_account_id: existingAccountId,
        date_preset: existingDatePreset,
        limit: "50",
      })
      if (existingActiveOnly) params.set("active_only", "1")
      if (existingActiveAdSetOnly) params.set("active_adset_only", "1")
      if (!reset && existingAfter) params.set("after", existingAfter)
      const res = await fetch(`/api/facebook/existing-ads?${params}`)
      const d = await res.json()
      if (!res.ok) {
        setExistingError(d.error || "Failed to load")
        if (reset) setExistingAds([])
      } else {
        setExistingAds(prev => reset ? (d.ads || []) : [...prev, ...(d.ads || [])])
        setExistingAfter(d.paging?.after || "")
        setExistingHasMore(!!d.paging?.after)
        if (reset) setExistingSelected(new Set())
      }
    } catch (e: any) {
      setExistingError(e.message)
    }
    setExistingLoading(false)
  }

  const filteredExisting = existingAds.filter(a =>
    !existingSearch || a.name.toLowerCase().includes(existingSearch.toLowerCase()) || a.id.includes(existingSearch)
  )
  const sortedExisting = [...filteredExisting].sort((a, b) => {
    const dir = existingSortDir === "asc" ? 1 : -1
    switch (existingSortField) {
      case "name": return a.name.localeCompare(b.name) * dir
      case "page": return (a.page_name || "").localeCompare(b.page_name || "") * dir
      case "date": return (new Date(a.date_created).getTime() - new Date(b.date_created).getTime()) * dir
      case "status": return a.effective_status.localeCompare(b.effective_status) * dir
      case "spend": return (a.spend - b.spend) * dir
      case "roas": return (a.roas - b.roas) * dir
      case "results": return (a.results - b.results) * dir
      case "impressions": return (a.impressions - b.impressions) * dir
      default: return 0
    }
  })

  const toggleExisting = (id: string) => {
    setExistingSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  const toggleExistingSort = (f: ExistingSortField) => {
    if (existingSortField === f) setExistingSortDir(d => d === "asc" ? "desc" : "asc")
    else { setExistingSortField(f); setExistingSortDir("desc") }
  }

  const handleSelectExistingAds = () => {
    // Convert selected existing ads → creatives and pass back
    const picked = existingAds.filter(a => existingSelected.has(a.id))
    const creatives: Creative[] = picked.map(a => ({
      id: `existing_${a.id}`,
      file_name: a.name,
      file_url: a.thumb_url || "",
      media_type: a.media_type === "video" ? "video" : "image",
      headline: "",
      primary_text: "",
      cta: "LEARN_MORE",
      link_url: a.post_url || "",
      fb_image_url: a.thumb_url,
      fb_thumbnail_url: a.thumb_url,
      fb_image_hash: a.image_hash,
      fb_video_id: a.video_id,
      created_at: a.date_created,
    }))
    onConfirm(picked.map(a => `existing_${a.id}`), creatives)
    onClose()
  }

  const fetchCreatives = () => {
    setLoading(true)
    fetch(`/api/creatives?ad_account_id=${encodeURIComponent(adAccountId)}`)
      .then(r => r.json())
      .then(d => {
        const list: Creative[] = d.creatives || []
        setAllCreatives(list)
        // Background refresh: ONLY for videos that genuinely need it
        // (recent uploads OR no thumbnail at all). Throttled to 1 at a time
        // with 1.5s delay between calls to avoid Meta rate limits.
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
        const videosToRefresh = list.filter(c => {
          if (c.media_type !== "video" || !c.fb_video_id) return false
          const hasGoodThumb = c.fb_thumbnail_url && /^https?:/.test(c.fb_thumbnail_url)
          if (hasGoodThumb) return false // already has thumbnail, skip
          const createdAt = c.created_at ? new Date(c.created_at).getTime() : 0
          return createdAt > oneDayAgo // only refresh recent uploads (Meta processed by now)
        })
        if (videosToRefresh.length === 0) return
        console.log(`[creatives] Refreshing thumbnails for ${videosToRefresh.length} recent videos (throttled 1/sec)`)
        ;(async () => {
          for (const c of videosToRefresh) {
            await new Promise(r => setTimeout(r, 1500))
            try {
              const tRes = await fetch(`/api/creatives/${c.id}/thumbnail`, { method: "POST" })
              if (tRes.status === 429 || tRes.status === 500) {
                const td = await tRes.json().catch(() => ({}))
                if (/rate limit|#4|request limit/i.test(td.error || "")) {
                  console.warn("[creatives] Rate limited — stopping thumbnail refresh")
                  return
                }
              }
              const td = await tRes.json()
              if (td.thumbnail_url && td.thumbnail_url !== c.fb_thumbnail_url) {
                setAllCreatives(prev => prev.map(x => x.id === c.id
                  ? { ...x, fb_thumbnail_url: td.thumbnail_url, file_url: td.thumbnail_url }
                  : x))
              }
            } catch {}
          }
        })()
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const dimsOf = (c: Creative) => (c as any).dimensions || (c.media_type === "video" ? "9:16" : "1:1")
  const durationOf = (c: Creative) => (c as any).duration || (c.media_type === "video" ? "0:30" : "—")
  const uploaderOf = (c: Creative) => (c as any).uploader || (c as any).user_email || "—"
  const workspaceOf = (c: Creative) => (c as any).workspace_id || "—"

  // Build dynamic chip options from data
  const uniq = (arr: any[]) => Array.from(new Set(arr.filter(Boolean)))
  const filterOptions = {
    uploader: uniq(allCreatives.map(uploaderOf)),
    status: ["ready", "pending", "launched"],
    channels: ["meta", "tiktok", "google"],
    fileType: ["image", "video"],
    dimensions: uniq(allCreatives.map(dimsOf)),
    workspace: uniq(allCreatives.map(workspaceOf)),
    source: ["library", "drive", "upload"],
    dateAdded: ["today", "week", "month", "year"],
  }

  const filtered = allCreatives.filter(c => {
    const isReady = !!(c.fb_image_hash || c.fb_video_id)
    const matchSearch = !search || c.file_name.toLowerCase().includes(search.toLowerCase()) || (c as any).fb_ad_id?.includes(search)
    if (!matchSearch) return false
    if (filters.fileType !== "all" && c.media_type !== filters.fileType) return false
    if (filters.status !== "all") {
      const st = filters.status === "ready" ? isReady : filters.status === "pending" ? !isReady : (c as any).status === "launched"
      if (!st) return false
    }
    if (filters.uploader !== "all" && uploaderOf(c) !== filters.uploader) return false
    if (filters.dimensions !== "all" && dimsOf(c) !== filters.dimensions) return false
    if (filters.workspace !== "all" && workspaceOf(c) !== filters.workspace) return false
    if (filters.dateAdded !== "all") {
      const d = c.created_at ? new Date(c.created_at) : null
      if (!d) return false
      const ms = Date.now() - d.getTime()
      const day = 86400000
      if (filters.dateAdded === "today" && ms > day) return false
      if (filters.dateAdded === "week" && ms > 7 * day) return false
      if (filters.dateAdded === "month" && ms > 30 * day) return false
      if (filters.dateAdded === "year" && ms > 365 * day) return false
    }
    return true
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let va: any, vb: any
    switch (sortField) {
      case "name": va = a.file_name; vb = b.file_name; break
      case "ad_id": va = (a as any).fb_ad_id || ""; vb = (b as any).fb_ad_id || ""; break
      case "dimensions": va = dimsOf(a); vb = dimsOf(b); break
      case "duration": va = durationOf(a); vb = durationOf(b); break
      case "date": va = a.created_at || ""; vb = b.created_at || ""; break
      case "user": va = uploaderOf(a); vb = uploaderOf(b); break
      case "workspace": va = workspaceOf(a); vb = workspaceOf(b); break
      default: return 0
    }
    return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
  })

  const toggle = (id: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  const toggleAll = () => {
    setSelected(prev => prev.size === sorted.length ? new Set() : new Set(sorted.map(c => c.id)))
  }
  const handleConfirm = () => {
    onConfirm(Array.from(selected), allCreatives.filter(c => selected.has(c.id)))
    onClose()
  }
  const handlePasteSubmit = () => {
    const ids = pasteText.split(/[\s,;\n]+/).map(s => s.trim()).filter(Boolean)
    const matched = allCreatives.filter(c => ids.includes(c.id) || ids.includes((c as any).fb_ad_id))
    setSelected(prev => { const s = new Set(prev); matched.forEach(m => s.add(m.id)); return s })
    setPasteText("")
    setPasteOpen(false)
  }
  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortField(f); setSortDir("asc") }
  }

  const TABS: { id: MediaTab; label: string; Icon: React.ElementType; beta?: boolean }[] = [
    { id: "library", label: "Media Library", Icon: IconStack2 },
    { id: "existing", label: "Existing Ads", Icon: IconLayoutGrid },
    { id: "gdrive", label: "Google Drive", Icon: IconBrandGoogleDrive },
    { id: "drive_browser", label: "Drive Browser", Icon: IconBrandGoogleDrive, beta: true },
    { id: "drive_link", label: "Drive Link", Icon: IconBrandGoogleDrive },
    { id: "integrations", label: "Integrations", Icon: IconSettings },
  ]

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="inline-flex flex-col -space-y-1 ml-0.5 opacity-60">
      <IconChevronUp className={cn("size-2.5", sortField === field && sortDir === "asc" && "text-primary opacity-100")} />
      <IconChevronDown className={cn("size-2.5", sortField === field && sortDir === "desc" && "text-primary opacity-100")} />
    </span>
  )

  const FilterChip = ({ id, label }: { id: keyof typeof filters; label: string }) => {
    const opts = filterOptions[id] as string[]
    const value = filters[id]
    const isActive = value !== "all"
    return (
      <div className="relative">
        <button
          onClick={() => setOpenFilter(openFilter === id ? null : id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-colors",
            isActive ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted/30"
          )}
        >
          <span className="font-medium">{label}</span>
          {isActive && <span className="bg-primary/10 px-1 rounded text-[10px]">{value}</span>}
          <IconChevronDown className="size-3" />
        </button>
        {openFilter === id && (
          <div className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 min-w-[160px] py-1 max-h-60 overflow-y-auto">
            <button
              onClick={() => { setFilters(f => ({ ...f, [id]: "all" })); setOpenFilter(null) }}
              className={cn("w-full text-left px-3 py-1.5 text-xs hover:bg-accent", value === "all" && "font-semibold")}
            >
              All
            </button>
            {opts.map(o => (
              <button
                key={o}
                onClick={() => { setFilters(f => ({ ...f, [id]: o })); setOpenFilter(null) }}
                className={cn("w-full text-left px-3 py-1.5 text-xs hover:bg-accent capitalize", value === o && "font-semibold")}
              >
                {o}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-6xl h-[94vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-3 border-b shrink-0">
          <DialogTitle className="text-base font-semibold">Select media to use</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex items-center border-b px-6 shrink-0 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.Icon
            return (
              <button
                key={t.id}
                onClick={() => setMediaTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 py-2.5 mr-6 text-sm border-b-2 transition-colors whitespace-nowrap shrink-0",
                  mediaTab === t.id ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" />{t.label}
                {t.beta && <span className="text-[9px] px-1 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">Beta</span>}
              </button>
            )
          })}
        </div>

        {mediaTab === "library" ? (
          <>
            {/* Search row */}
            <div className="flex items-center gap-2 px-6 py-3 border-b shrink-0">
              <div className="relative flex-1">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or ID..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50" />
              </div>
              <div className="relative">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setIncludeOpen(o => !o)}>
                  <IconPlus className="size-3.5" />Include<IconChevronDown className="size-3" />
                </Button>
                {includeOpen && (
                  <div className="absolute top-full right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 min-w-[180px] py-1">
                    {["Archived", "Deleted", "Other workspaces"].map(o => (
                      <label key={o} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent cursor-pointer">
                        <input type="checkbox" className="rounded size-3" />{o}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <Button size="sm">Search</Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPasteOpen(true)}>
                <IconClipboard className="size-3.5" />Paste list
              </Button>
            </div>

            {/* Filter chips */}
            <div className="flex items-center gap-2 px-6 py-2 border-b shrink-0 overflow-x-auto">
              <FilterChip id="uploader" label="Uploader" />
              <FilterChip id="status" label="Status" />
              <FilterChip id="channels" label="Channels" />
              <FilterChip id="fileType" label="File Type" />
              <FilterChip id="dimensions" label="Dimensions" />
              <FilterChip id="workspace" label="Workspace" />
              <FilterChip id="source" label="Source" />
              <div className="relative">
                <button
                  onClick={() => setOpenFilter(openFilter === "dateAdded" ? null : "dateAdded")}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg",
                    filters.dateAdded !== "all" ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted/30")}
                >
                  <IconCalendar className="size-3" />
                  <span className="font-medium">Date added{filters.dateAdded !== "all" && ` · ${filters.dateAdded}`}</span>
                  <IconChevronDown className="size-3" />
                </button>
                {openFilter === "dateAdded" && (
                  <div className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 min-w-[140px] py-1">
                    {[["all", "All time"], ["today", "Today"], ["week", "This week"], ["month", "This month"], ["year", "This year"]].map(([v, l]) => (
                      <button key={v} onClick={() => { setFilters(f => ({ ...f, dateAdded: v })); setOpenFilter(null) }}
                        className={cn("w-full text-left px-3 py-1.5 text-xs hover:bg-accent", filters.dateAdded === v && "font-semibold")}>
                        {l}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Toolbar actions */}
            <div className="flex items-center justify-end gap-2 px-6 py-2 border-b shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5">
                <IconUpload className="size-3.5" />Upload New Media
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5">
                <IconFolder className="size-3.5" />Upload Folder
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchCreatives} disabled={loading}>
                <IconRefresh className={cn("size-3.5", loading && "animate-spin")} />Refresh list
              </Button>
              <div className="relative">
                <Button variant="outline" size="icon" className="size-8" onClick={() => setMoreOpen(o => !o)}>
                  <IconDots className="size-3.5" />
                </Button>
                {moreOpen && (
                  <div className="absolute top-full right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 min-w-[160px] py-1">
                    {["Export selected", "Bulk delete", "Settings"].map(o => (
                      <button key={o} className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent">{o}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Table header */}
            <div className="grid items-center text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide border-b px-6 py-2 shrink-0"
              style={{ gridTemplateColumns: "28px 2.5fr 80px 100px 80px 120px 1.6fr 120px 120px" }}>
              <button onClick={toggleAll} className={cn("size-4 rounded border-2 flex items-center justify-center",
                selected.size > 0 && selected.size === sorted.length ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                {selected.size > 0 && selected.size === sorted.length && <IconCheck className="size-2.5 text-primary-foreground" />}
              </button>
              <button onClick={() => toggleSort("name")} className="flex items-center text-left hover:text-foreground">Name<SortIcon field="name" /></button>
              <button onClick={() => toggleSort("ad_id")} className="flex items-center hover:text-foreground">AD ID<SortIcon field="ad_id" /></button>
              <button onClick={() => toggleSort("dimensions")} className="flex items-center hover:text-foreground">Dimensions<SortIcon field="dimensions" /></button>
              <button onClick={() => toggleSort("duration")} className="flex items-center hover:text-foreground">Duration<SortIcon field="duration" /></button>
              <button onClick={() => toggleSort("date")} className="flex items-center hover:text-foreground">Date Added<SortIcon field="date" /></button>
              <button onClick={() => toggleSort("status")} className="flex items-center hover:text-foreground">Status<SortIcon field="status" /></button>
              <button onClick={() => toggleSort("user")} className="flex items-center hover:text-foreground">User<SortIcon field="user" /></button>
              <button onClick={() => toggleSort("workspace")} className="flex items-center hover:text-foreground">Workspace ID<SortIcon field="workspace" /></button>
            </div>

            {/* Table body */}
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : sorted.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                  <IconPhoto className="size-8 opacity-30" />
                  <p className="text-sm">No media assets found</p>
                </div>
              ) : (
                sorted.map(c => {
                  const isSelected = selected.has(c.id)
                  const isReady = !!(c.fb_image_hash || c.fb_video_id)
                  const adId = (c as any).fb_ad_id || (c as any).ad_id || "—"
                  const adSetName = (c as any).adset_name || (c as any).fb_adset_name
                  const thumb = c.media_type === "video" ? c.fb_thumbnail_url : (c.fb_image_url || c.file_url)
                  return (
                    <div key={c.id} onClick={() => toggle(c.id)}
                      className={cn("grid items-center px-6 py-2.5 border-b cursor-pointer hover:bg-muted/30 transition-colors",
                        isSelected && "bg-primary/5 hover:bg-primary/10")}
                      style={{ gridTemplateColumns: "28px 2.5fr 80px 100px 80px 120px 1.6fr 120px 120px" }}>
                      <div className={cn("size-4 rounded border-2 flex items-center justify-center shrink-0",
                        isSelected ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                        {isSelected && <IconCheck className="size-2.5 text-primary-foreground" />}
                      </div>
                      <div className="flex items-center gap-2.5 min-w-0 pr-3">
                        <div className="size-9 rounded overflow-hidden bg-muted shrink-0 relative">
                          <CreativeCardMedia creative={c} className="w-full h-full object-cover" compact />
                          {c.media_type === "video" && (
                            <div className="absolute bottom-0 right-0 size-3.5 rounded-tl bg-black/60 flex items-center justify-center pointer-events-none">
                              <IconPlayerPlay className="size-2 text-white" />
                            </div>
                          )}
                        </div>
                        <span className="text-sm truncate" title={c.file_name}>{c.file_name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{adId !== "—" ? adId.slice(-3) : "—"}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted/50 w-fit">{dimsOf(c)}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted/50 w-fit">{durationOf(c)}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </span>
                      {adSetName ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 w-fit max-w-full">
                          <IconBrandMeta className="size-3 shrink-0 text-[#0064E0]" />
                          <span className="truncate">Ad Set: {adSetName.slice(0, 20)}{adSetName.length > 20 ? "..." : ""}</span>
                        </span>
                      ) : (
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium w-fit",
                          isReady ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground")}>
                          {isReady ? "Ready" : "Pending"}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground truncate" title={uploaderOf(c)}>{uploaderOf(c)}</span>
                      <span className="text-xs text-muted-foreground truncate font-mono">{workspaceOf(c)}</span>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="border-t shrink-0">
              <div className="px-6 pt-2 pb-1">
                <span className="text-xs text-muted-foreground">{sorted.length} of {allCreatives.length} row(s).</span>
              </div>
              <Button
                onClick={handleConfirm}
                disabled={selected.size === 0}
                className="w-full h-12 rounded-none rounded-b-xl text-base font-semibold"
              >
                Add {selected.size > 0 ? `${selected.size} ` : "New "}Creatives
              </Button>
            </div>
          </>
        ) : mediaTab === "existing" ? (
          <>
            {/* Search row + ad account picker (combined) */}
            <div className="flex items-center gap-2 px-6 py-2 border-b shrink-0">
              <div className="relative flex-1">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                <input value={existingSearch} onChange={e => setExistingSearch(e.target.value)} placeholder="Search by ad name or ID..."
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="relative">
                <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setExistingIncludeOpen(o => !o)}>
                  <IconPlus className="size-3.5" />Include<IconChevronDown className="size-3" />
                </Button>
                {existingIncludeOpen && (
                  <div className="absolute top-full right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 min-w-[180px] py-1">
                    {["Archived ads", "Deleted ads", "Inactive ads"].map(o => (
                      <label key={o} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent cursor-pointer">
                        <input type="checkbox" className="rounded size-3" />{o}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <Button size="sm" className="gap-1.5 h-8" onClick={() => fetchExistingAds(true)}>
                <IconSearch className="size-3.5" />Search
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setPasteOpen(true)}>
                <IconClipboard className="size-3.5" />Paste list
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => fetchExistingAds(true)} disabled={existingLoading}>
                <IconRefresh className={cn("size-3.5", existingLoading && "animate-spin")} />Refresh
              </Button>
              <div className="w-px h-6 bg-border mx-1" />
              <div className="relative">
                <button
                  onClick={() => setExistingAccountOpen(o => !o)}
                  className="h-8 flex items-center gap-1.5 px-3 rounded-lg border bg-background hover:bg-muted/40 transition-colors min-w-[160px] max-w-[220px] text-sm"
                  title="Load creatives from this ad account"
                >
                  <IconBrandMeta className="size-3.5 text-[#0064E0] shrink-0" />
                  <span className="truncate flex-1 text-left">
                    {adAccounts?.find(a => a.id === existingAccountId)?.name || existingAccountId}
                  </span>
                  <IconChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                </button>
                {existingAccountOpen && adAccounts && (
                  <div className="absolute top-full right-0 mt-1 bg-popover border rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto min-w-[240px]">
                    {adAccounts.map(a => (
                      <button key={a.id}
                        onClick={() => { setExistingAccountId(a.id); setExistingAccountOpen(false) }}
                        className={cn("w-full px-3 py-2 text-left text-sm hover:bg-accent",
                          existingAccountId === a.id && "bg-primary/5 font-medium")}>
                        {a.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Filter chips — wrap, no horizontal scroll */}
            <div className="flex items-center gap-2 flex-wrap px-6 py-2 border-b shrink-0">
              {/* Date preset */}
              <div className="relative">
                <button onClick={() => setExistingDateOpen(o => !o)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg hover:bg-muted/30">
                  <IconCalendar className="size-3" />
                  <span className="font-medium">{DATE_PRESETS.find(p => p.value === existingDatePreset)?.label}</span>
                  <IconChevronDown className="size-3" />
                </button>
                {existingDateOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 min-w-[160px] py-1">
                    {DATE_PRESETS.map(p => (
                      <button key={p.value} onClick={() => { setExistingDatePreset(p.value); setExistingDateOpen(false) }}
                        className={cn("w-full text-left px-3 py-1.5 text-xs hover:bg-accent", existingDatePreset === p.value && "font-semibold")}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={() => setExistingFilterOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg hover:bg-muted/30">
                <IconArrowsSort className="size-3" /><span className="font-medium">Filter</span>
              </button>

              <button onClick={() => setExistingActiveOnly(v => !v)}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg",
                  existingActiveOnly ? "bg-primary/10 border-primary text-primary" : "hover:bg-muted/30")}>
                <IconCircleCheck className="size-3" /><span className="font-medium">Active ads</span>
              </button>

              <button onClick={() => setExistingActiveAdSetOnly(v => !v)}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg",
                  existingActiveAdSetOnly ? "bg-primary/10 border-primary text-primary" : "hover:bg-muted/30")}>
                <IconCircleCheck className="size-3" /><span className="font-medium">Active ad sets</span>
              </button>

              {/* Columns */}
              <div className="relative">
                <button onClick={() => setExistingColumnsOpen(o => !o)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg hover:bg-muted/30">
                  <IconTable className="size-3" /><span className="font-medium">Columns</span><IconChevronDown className="size-3" />
                </button>
                {existingColumnsOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 min-w-[180px] py-1 max-h-60 overflow-y-auto">
                    {EXISTING_COLUMNS.map(c => (
                      <label key={c.key} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent cursor-pointer">
                        <input
                          type="checkbox"
                          checked={visibleColumns.has(c.key)}
                          onChange={() => setVisibleColumns(prev => { const s = new Set(prev); s.has(c.key) ? s.delete(c.key) : s.add(c.key); return s })}
                          className="rounded size-3"
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button onClick={() => setExistingMetricsOpen(o => !o)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg hover:bg-muted/30">
                  <span className="font-medium">Metrics</span>
                  <span className="text-[9px] px-1 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">BETA</span>
                </button>
                {existingMetricsOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 min-w-[200px] py-1">
                    {["CPC", "CTR", "Frequency", "CPM", "Reach", "Conversions"].map(m => (
                      <label key={m} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent cursor-pointer">
                        <input type="checkbox" className="rounded size-3" />{m}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>
                  <span className="font-semibold text-foreground">{existingAds.length}</span> ads
                  {existingHasMore && " (more available)"}
                </span>
                {existingSelected.size > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-primary font-semibold">{existingSelected.size} selected</span>
                  </>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              {existingLoading && existingAds.length === 0 ? (
                <div className="flex items-center justify-center h-40">
                  <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : existingError ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg mx-6 my-4 p-3 text-xs text-amber-900">{existingError}</div>
              ) : sortedExisting.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                  <IconLayoutGrid className="size-8 opacity-30" />
                  <p className="text-sm">No ads found in this time range</p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-background sticky top-0 z-10">
                    <tr className="border-b">
                      <th className="w-10 px-3 py-2"></th>
                      <th className="w-12 px-2 py-2"><IconPhoto className="size-3.5 text-muted-foreground inline" /></th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground/80 cursor-pointer" onClick={() => toggleExistingSort("name")}>
                        <span className="inline-flex items-center">Name {existingSortField === "name" && <IconChevronDown className={cn("size-3 ml-0.5 transition-transform", existingSortDir === "asc" && "rotate-180")} />}</span>
                      </th>
                      {visibleColumns.has("page") && <th className="px-3 py-2 text-left font-semibold text-muted-foreground/80 cursor-pointer" onClick={() => toggleExistingSort("page")}>Page</th>}
                      {visibleColumns.has("date") && <th className="px-3 py-2 text-left font-semibold text-muted-foreground/80 cursor-pointer" onClick={() => toggleExistingSort("date")}>Date Created</th>}
                      {visibleColumns.has("post") && <th className="px-3 py-2 text-left font-semibold text-muted-foreground/80">Post</th>}
                      {visibleColumns.has("status") && <th className="px-3 py-2 text-left font-semibold text-muted-foreground/80 cursor-pointer" onClick={() => toggleExistingSort("status")}>Status</th>}
                      {visibleColumns.has("platform") && <th className="px-3 py-2 text-left font-semibold text-muted-foreground/80">Platform</th>}
                      {visibleColumns.has("spend") && <th className="px-3 py-2 text-right font-semibold text-muted-foreground/80 cursor-pointer" onClick={() => toggleExistingSort("spend")}>
                        <span className="inline-flex items-center">Spend <IconChevronDown className={cn("size-3 ml-0.5", existingSortField === "spend" && existingSortDir === "asc" && "rotate-180")} /></span>
                      </th>}
                      {visibleColumns.has("roas") && <th className="px-3 py-2 text-right font-semibold text-muted-foreground/80 cursor-pointer" onClick={() => toggleExistingSort("roas")}>ROAS</th>}
                      {visibleColumns.has("results") && <th className="px-3 py-2 text-right font-semibold text-muted-foreground/80 cursor-pointer" onClick={() => toggleExistingSort("results")}>Results</th>}
                      {visibleColumns.has("impressions") && <th className="px-3 py-2 text-right font-semibold text-muted-foreground/80 cursor-pointer" onClick={() => toggleExistingSort("impressions")}>Impr.</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedExisting.map(ad => {
                      const isSel = existingSelected.has(ad.id)
                      const isVideo = ad.media_type === "video"
                      return (
                        <tr key={ad.id} onClick={() => toggleExisting(ad.id)}
                          className={cn("border-b cursor-pointer hover:bg-muted/20 transition-colors",
                            isSel && "bg-primary/5 hover:bg-primary/10")}>
                          <td className="px-3 py-2">
                            <div className={cn("size-4 rounded border-2 flex items-center justify-center",
                              isSel ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                              {isSel && <IconCheck className="size-2.5 text-primary-foreground" />}
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <div className="relative size-9 rounded overflow-hidden bg-muted">
                              {ad.thumb_url ? <img src={ad.thumb_url} className="w-full h-full object-cover" alt="" />
                                : <div className="w-full h-full flex items-center justify-center">
                                  {isVideo ? <IconVideo className="size-3.5 text-muted-foreground/40" /> : <IconPhoto className="size-3.5 text-muted-foreground/40" />}
                                </div>}
                              {ad.effective_status === "DELETED" && (
                                <div className="absolute -top-1 -right-1 size-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[8px] font-bold">D</div>
                              )}
                              {isVideo && (
                                <div className="absolute bottom-0.5 left-0.5 size-3.5 rounded-full bg-black/60 flex items-center justify-center">
                                  <IconPlayerPlay className="size-2 text-white" />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 max-w-[280px]">
                            <span className="truncate block" title={ad.name}>{ad.name}</span>
                          </td>
                          {visibleColumns.has("page") && <td className="px-3 py-2 text-muted-foreground">{ad.page_name || "—"}</td>}
                          {visibleColumns.has("date") && <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{new Date(ad.date_created).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>}
                          {visibleColumns.has("post") && <td className="px-3 py-2">
                            {ad.post_url ? <a href={ad.post_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" onClick={e => e.stopPropagation()}>Post</a> : "—"}
                          </td>}
                          {visibleColumns.has("status") && <td className="px-3 py-2">
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap",
                              ad.effective_status === "ACTIVE" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                              /PAUSED/.test(ad.effective_status) ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                              /DISAPPROVED|DELETED|ARCHIVED/.test(ad.effective_status) ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                              "bg-muted text-muted-foreground")}
                              title={ad.effective_status}>
                              {ad.effective_status === "ACTIVE" ? "ACTIVE" :
                               ad.effective_status === "CAMPAIGN_PAUSED" ? "CAMP. PAUSED" :
                               ad.effective_status === "ADSET_PAUSED" ? "ADSET PAUSED" :
                               ad.effective_status === "PAUSED" ? "PAUSED" :
                               ad.effective_status.replace(/_/g, " ").slice(0, 12)}
                            </span>
                          </td>}
                          {visibleColumns.has("platform") && <td className="px-3 py-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-medium">{ad.platform}</span>
                          </td>}
                          {visibleColumns.has("spend") && <td className="px-3 py-2 text-right font-medium">{formatCurrency(ad.spend)}</td>}
                          {visibleColumns.has("roas") && <td className="px-3 py-2 text-right">{ad.roas > 0 ? ad.roas.toFixed(2) : "—"}</td>}
                          {visibleColumns.has("results") && <td className="px-3 py-2 text-right">{ad.results > 0 ? ad.results : "—"}</td>}
                          {visibleColumns.has("impressions") && <td className="px-3 py-2 text-right text-muted-foreground">{formatNumberShort(ad.impressions)}</td>}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {/* Load more */}
              {existingHasMore && (
                <div className="flex justify-center py-4">
                  <Button variant="outline" size="sm" onClick={() => fetchExistingAds(false)} disabled={existingLoading}>
                    {existingLoading ? <IconLoader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                    Load more
                  </Button>
                </div>
              )}
            </div>

            {/* Footer — combined into single compact row + button */}
            <div className="border-t shrink-0">
              <div className="flex items-center gap-3 px-6 py-1.5">
                <span className="text-[11px] text-muted-foreground">Include:</span>
                <div className="relative">
                  <button onClick={() => setExistingIncludeOpen(o => !o)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs border rounded-lg hover:bg-muted/30 min-w-[130px]">
                    <span className="font-medium flex-1 text-left">
                      {existingIncludeMode === "creatives" ? "Creatives only" : existingIncludeMode === "full" ? "Full ad config" : "Ad settings only"}
                    </span>
                    <IconChevronDown className="size-3" />
                  </button>
                  {existingIncludeOpen && (
                    <div className="absolute bottom-full left-0 mb-1 bg-popover border rounded-lg shadow-lg z-50 min-w-[160px] py-1">
                      {[
                        { v: "creatives", l: "Creatives only" },
                        { v: "full", l: "Full ad config" },
                        { v: "ad_settings", l: "Ad settings only" },
                      ].map(o => (
                        <button key={o.v} onClick={() => { setExistingIncludeMode(o.v as any); setExistingIncludeOpen(false) }}
                          className={cn("w-full text-left px-3 py-1.5 text-xs hover:bg-accent", existingIncludeMode === o.v && "font-semibold")}>
                          {o.l}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Button
                onClick={handleSelectExistingAds}
                disabled={existingSelected.size === 0}
                className="w-full h-10 rounded-none rounded-b-xl text-sm font-semibold"
              >
                Select Ads to Use
              </Button>
            </div>
          </>
        ) : mediaTab === "gdrive" || mediaTab === "drive_browser" || mediaTab === "drive_link" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <IconBrandGoogleDrive className="size-10 opacity-30" />
            <p className="text-sm">Connect Google Drive to import media</p>
            <Button variant="outline" size="sm" className="mt-2 gap-1.5">
              <IconBrandGoogleDrive className="size-3.5" />Connect Google Drive
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <IconSettings className="size-10 opacity-30" />
            <p className="text-sm">Connect more integrations</p>
            <p className="text-xs">Dropbox, OneDrive, S3, etc.</p>
          </div>
        )}

        {/* Paste list dialog */}
        {pasteOpen && (
          <div className="absolute inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setPasteOpen(false)}>
            <div className="bg-popover border rounded-xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold mb-2">Paste creative IDs</h3>
              <p className="text-xs text-muted-foreground mb-3">One ID per line, or comma-separated. Matching media will be auto-selected.</p>
              <textarea
                autoFocus
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring resize-none font-mono"
                placeholder="123456789012345&#10;987654321098765&#10;..."
              />
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => setPasteOpen(false)}>Cancel</Button>
                <Button size="sm" disabled={!pasteText.trim()} onClick={handlePasteSubmit}>Match</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Schedule Modal ───────────────────────────────────────────────────────────

function ScheduleModal({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (dt: string) => void }) {
  const [date, setDate] = useState("")
  const [time, setTime] = useState("09:00")

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Schedule Ads</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Start Date</label>
            <input type="date" value={date} min={new Date().toISOString().split("T")[0]}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-muted/30 outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Start Time</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-muted/30 outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1 gap-1.5" disabled={!date}
              onClick={() => { if (date) { onConfirm(new Date(`${date}T${time}:00`).toISOString()); onClose() } }}>
              <IconCalendar className="size-4" />Schedule
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Duplicate Ad Set Modal ───────────────────────────────────────────────────

function DuplicateAdSetModal({
  open, onClose, allAdSets, onDuplicated,
}: {
  open: boolean
  onClose: () => void
  allAdSets: AdSet[]
  onDuplicated: (newAdSets: AdSet[]) => void
}) {
  const [search, setSearch] = useState("")
  const [selectedSourceId, setSelectedSourceId] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [count, setCount] = useState(1)
  const [duplicateAds, setDuplicateAds] = useState(false)
  const [launchAsActive, setLaunchAsActive] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [error, setError] = useState("")
  const [detail, setDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  // Additional Options state
  const [advTab, setAdvTab] = useState<"budget" | "delivery" | "targeting">("budget")
  const [budgetOverride, setBudgetOverride] = useState("")
  const [budgetType, setBudgetType] = useState<"daily" | "lifetime">("daily")
  const [spendingLimitsOn, setSpendingLimitsOn] = useState(false)
  const [minSpend, setMinSpend] = useState("")
  const [maxSpend, setMaxSpend] = useState("")
  const [optimizationOverride, setOptimizationOverride] = useState("")
  const [bidStrategy, setBidStrategy] = useState("")
  const [geoOverride, setGeoOverride] = useState("")
  const [ageRange, setAgeRange] = useState({ min: "", max: "" })
  // Delivery tab state
  const [scheduleStart, setScheduleStart] = useState("")
  const [scheduleEnd, setScheduleEnd] = useState("")
  const [targetCampaign, setTargetCampaign] = useState<"source" | "another">("source")
  const [destCampaignId, setDestCampaignId] = useState("")
  const [changeConversionEvent, setChangeConversionEvent] = useState(false)
  const [changeConversionLocation, setChangeConversionLocation] = useState(false)
  const [changePlacements, setChangePlacements] = useState(false)
  // Targeting tab state
  const [locationTarget, setLocationTarget] = useState<"living_in" | "recently_in" | "traveling_in" | "visited">("living_in")
  const [locationFilter, setLocationFilter] = useState<"all" | "countries" | "states" | "cities">("all")
  const [locationSearch, setLocationSearch] = useState("")
  const [ageMinSelect, setAgeMinSelect] = useState("18")
  const [ageMaxSelect, setAgeMaxSelect] = useState("65+")
  const [includedAudiences, setIncludedAudiences] = useState<string[]>([])
  const [excludedAudiences, setExcludedAudiences] = useState<string[]>([])
  const [setDSA, setSetDSA] = useState(false)
  const [customAttribution, setCustomAttribution] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setSearch("")
      setSelectedSourceId("")
      setSearchOpen(false)
      setNewName("")
      setCount(1)
      setDuplicateAds(false)
      setLaunchAsActive(true)
      setShowAdvanced(false)
      setDetailsExpanded(false)
      setError("")
      setDetail(null)
      setAdvTab("budget")
      setBudgetOverride("")
      setBudgetType("daily")
      setSpendingLimitsOn(false)
      setMinSpend("")
      setMaxSpend("")
      setOptimizationOverride("")
      setBidStrategy("")
      setGeoOverride("")
      setAgeRange({ min: "", max: "" })
      setScheduleStart("")
      setScheduleEnd("")
      setTargetCampaign("source")
      setDestCampaignId("")
      setChangeConversionEvent(false)
      setChangeConversionLocation(false)
      setChangePlacements(false)
      setLocationTarget("living_in")
      setLocationFilter("all")
      setLocationSearch("")
      setAgeMinSelect("18")
      setAgeMaxSelect("65+")
      setIncludedAudiences([])
      setExcludedAudiences([])
      setSetDSA(false)
      setCustomAttribution(false)
    }
  }, [open])

  // Auto-fetch detail when expanded for first time
  useEffect(() => {
    if (!detailsExpanded || !selectedSourceId || detail) return
    setDetailLoading(true)
    fetch(`/api/facebook/adsets/${selectedSourceId}/detail`)
      .then(r => r.json())
      .then(d => { if (!d.error) setDetail(d) })
      .catch(() => {})
      .finally(() => setDetailLoading(false))
  }, [detailsExpanded, selectedSourceId, detail])

  // Reset detail when source changes
  useEffect(() => { setDetail(null) }, [selectedSourceId])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const sourceAdSet = allAdSets.find(a => a.id === selectedSourceId)
  const filtered = allAdSets.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.id.includes(search)
  )

  const selectSource = (a: AdSet) => {
    setSelectedSourceId(a.id)
    setNewName(`${a.name} - copy`)
    setSearchOpen(false)
    setSearch("")
  }

  const handleDuplicate = async () => {
    if (!selectedSourceId || count < 1) return
    setDuplicating(true)
    setError("")
    try {
      const newAdSets: AdSet[] = []
      const errors: string[] = []
      for (let i = 0; i < count; i++) {
        const suffix = count > 1 ? ` - ${i + 1}` : ""
        const res = await fetch(`/api/facebook/adsets/${selectedSourceId}/duplicate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            renameSuffix: "",
            customName: newName + suffix,
            statusOption: launchAsActive ? "ACTIVE" : "PAUSED",
            deepCopy: duplicateAds,
            // Advanced overrides (only sent if user changed them)
            budgetOverride: budgetOverride ? Math.round(parseFloat(budgetOverride) * 100) : undefined, // dollars → cents
            budgetType: budgetOverride ? budgetType : undefined,
            spendingLimits: spendingLimitsOn ? {
              min: minSpend ? Math.round(parseFloat(minSpend) * 100) : undefined,
              max: maxSpend ? Math.round(parseFloat(maxSpend) * 100) : undefined,
            } : undefined,
            optimizationGoal: optimizationOverride || undefined,
            bidStrategy: bidStrategy || undefined,
            geoCountries: geoOverride ? geoOverride.split(",").map(c => c.trim()).filter(Boolean) : undefined,
            ageMin: ageRange.min ? parseInt(ageRange.min) : undefined,
            ageMax: ageRange.max ? parseInt(ageRange.max) : undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          errors.push(data.error || `HTTP ${res.status}`)
          continue
        }
        newAdSets.push(data.adSet)
      }
      if (newAdSets.length > 0) onDuplicated(newAdSets)
      if (errors.length > 0) {
        setError(`${newAdSets.length}/${count} duplicated. Errors: ${errors[0]}`)
        if (newAdSets.length === 0) {
          setDuplicating(false)
          return
        }
      }
      onClose()
    } catch (e: any) {
      setError(e.message)
    }
    setDuplicating(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center">
            <IconCopy className="size-4 text-primary" />
          </div>
          <DialogTitle className="text-base font-semibold flex-1 text-center">Duplicate existing ad sets</DialogTitle>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Source selector */}
          <div className="border rounded-xl p-3">
            <p className="text-sm font-semibold mb-2">
              Select an existing Ad Set <span className="text-muted-foreground font-normal italic">(1 ad set maximum)</span>
            </p>
            <div ref={searchRef} className="relative">
              <div className="flex items-center gap-2 px-2.5 py-2 border rounded-lg bg-muted/20 min-h-[40px]">
                <IconSearch className="size-3.5 text-muted-foreground/50 shrink-0" />
                {sourceAdSet ? (
                  <span className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-md bg-background border text-xs font-medium max-w-full">
                    <IconCircleCheck className="size-3 text-emerald-500 shrink-0" />
                    <span className="truncate">{sourceAdSet.name}</span>
                    <IconBrandMeta className="size-3 text-[#0064E0] shrink-0" />
                    <button
                      onClick={() => { setSelectedSourceId(""); setNewName("") }}
                      className="hover:text-destructive ml-1"
                    >
                      <IconX className="size-3" />
                    </button>
                  </span>
                ) : (
                  <input
                    autoFocus
                    value={search}
                    onChange={e => { setSearch(e.target.value); setSearchOpen(true) }}
                    onFocus={() => setSearchOpen(true)}
                    placeholder="Search by Ad Set name or ID"
                    className="flex-1 bg-transparent outline-none text-sm"
                  />
                )}
                {sourceAdSet && (
                  <button onClick={() => { setSelectedSourceId(""); setNewName("") }} className="text-muted-foreground hover:text-foreground ml-auto">
                    <IconX className="size-3.5" />
                  </button>
                )}
              </div>
              {searchOpen && !sourceAdSet && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-muted-foreground">
                      {allAdSets.length === 0 ? "No ad sets in this account" : "No match"}
                    </div>
                  ) : filtered.map(a => (
                    <button key={a.id} onClick={() => selectSource(a)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent border-b last:border-b-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.name}</p>
                        <p className="text-[10px] text-muted-foreground">{a.id}</p>
                      </div>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                        a.effective_status === "ACTIVE"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {a.effective_status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {sourceAdSet && (
            <>
              {/* New Ad Set Name + Quantity */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-semibold">New Ad Set Name</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{count} duplicate{count > 1 ? "s" : ""}</span>
                    <div className="flex items-center border rounded-lg">
                      <button
                        onClick={() => setCount(c => Math.max(1, c - 1))}
                        className="size-7 flex items-center justify-center hover:bg-muted/40 disabled:opacity-30"
                        disabled={count <= 1}
                      >
                        <IconMinus className="size-3.5" />
                      </button>
                      <span className="px-2 text-sm font-medium min-w-[28px] text-center">{count}</span>
                      <button
                        onClick={() => setCount(c => Math.min(20, c + 1))}
                        className="size-7 flex items-center justify-center hover:bg-muted/40 disabled:opacity-30"
                        disabled={count >= 20}
                      >
                        <IconPlus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Ad set name..."
                  className="w-full px-3 py-2.5 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                />
                {count > 1 && (
                  <p className="text-[10px] text-muted-foreground mt-1">Each copy will be suffixed " - 1", " - 2", etc.</p>
                )}
              </div>

              {/* Source ad set details (collapsible with 3 sections) */}
              <div className="border rounded-xl bg-muted/20 overflow-hidden">
                <button
                  onClick={() => setDetailsExpanded(e => !e)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                >
                  <IconChevronDown className={cn("size-4 transition-transform", !detailsExpanded && "-rotate-90")} />
                  <IconEye className="size-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{sourceAdSet.name}</p>
                    <p className="text-[11px] text-muted-foreground">See ad set details</p>
                  </div>
                </button>
                {detailsExpanded && (
                  <div className="border-t bg-background p-2 space-y-2">
                    {detailLoading ? (
                      <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground">
                        <IconLoader2 className="size-3.5 animate-spin" />Loading details...
                      </div>
                    ) : detail ? (
                      <>
                        {/* BUDGET & SCHEDULE */}
                        <div className="border rounded-lg p-2.5">
                          <div className="flex items-center gap-1.5 mb-2">
                            <IconCurrencyDollar className="size-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-bold text-muted-foreground tracking-wider">BUDGET & SCHEDULE</span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                            {detail.adSet?.daily_budget && (
                              <span><span className="text-muted-foreground">Daily:</span> <span className="font-medium">${(parseInt(detail.adSet.daily_budget) / 100).toFixed(2)}</span></span>
                            )}
                            {detail.adSet?.lifetime_budget && (
                              <span><span className="text-muted-foreground">Lifetime:</span> <span className="font-medium">${(parseInt(detail.adSet.lifetime_budget) / 100).toFixed(2)}</span></span>
                            )}
                            <span><span className="text-muted-foreground">CBO:</span> <span className="font-medium">{detail.campaign?.is_cbo ? "Yes" : "No"}</span></span>
                            {detail.adSet?.pacing_type?.[0] && (
                              <span><span className="text-muted-foreground">Pacing:</span> <span className="font-medium capitalize">{detail.adSet.pacing_type[0]}</span></span>
                            )}
                            {detail.adSet?.start_time && (
                              <span><span className="text-muted-foreground">Start:</span> <span className="font-medium">{new Date(detail.adSet.start_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}</span></span>
                            )}
                            <span className="inline-flex items-center gap-0.5">
                              <span className="text-muted-foreground">Status:</span>
                              <span className={cn(
                                "font-medium",
                                detail.adSet?.effective_status === "ACTIVE" ? "text-emerald-600" : "text-muted-foreground"
                              )}>{detail.adSet?.effective_status}</span>
                              <IconExternalLink className="size-2.5 text-muted-foreground" />
                            </span>
                          </div>
                          {detail.campaign && (
                            <div className="mt-1.5 text-[11px]">
                              <span className="text-muted-foreground">Campaign:</span>
                              <span className="font-medium ml-1">
                                {detail.campaign.daily_budget
                                  ? `$${(parseInt(detail.campaign.daily_budget) / 100).toFixed(2)}/day`
                                  : detail.campaign.lifetime_budget
                                    ? `$${(parseInt(detail.campaign.lifetime_budget) / 100).toFixed(2)} lifetime`
                                    : "ad-set level"}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* TARGETING */}
                        <div className="border rounded-lg p-2.5">
                          <div className="flex items-center gap-1.5 mb-2">
                            <IconTarget className="size-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-bold text-muted-foreground tracking-wider">TARGETING</span>
                          </div>
                          {detail.adSet?.targeting?.geo_locations?.countries?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {detail.adSet.targeting.geo_locations.countries.slice(0, 24).map((c: string) => (
                                <span key={c} className="text-[10px] px-1 py-0.5 rounded bg-muted/50 font-medium uppercase">{c}</span>
                              ))}
                              {detail.adSet.targeting.geo_locations.countries.length > 24 && (
                                <span className="text-[10px] text-muted-foreground">+{detail.adSet.targeting.geo_locations.countries.length - 24}</span>
                              )}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]">
                            <span>
                              <span className="text-muted-foreground">Age:</span>{" "}
                              <span className="font-medium">{detail.adSet?.targeting?.age_min || 18}-{detail.adSet?.targeting?.age_max === 65 ? "65+" : (detail.adSet?.targeting?.age_max || "65+")}</span>
                            </span>
                            <span>
                              <span className="text-muted-foreground">Gender:</span>{" "}
                              <span className="font-medium">
                                {!detail.adSet?.targeting?.genders || detail.adSet.targeting.genders.length === 0
                                  ? "All"
                                  : detail.adSet.targeting.genders.includes(1) ? "Male"
                                  : detail.adSet.targeting.genders.includes(2) ? "Female"
                                  : "Custom"}
                              </span>
                            </span>
                            <span><span className="text-muted-foreground">Ad count:</span> <span className="font-medium">{detail.adSet?.ad_count ?? 0}</span></span>
                          </div>
                          <div className="mt-1.5 text-[11px] space-y-0.5">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <IconUsers className="size-2.5" />
                              <span>Inc:</span>
                              <span className="italic">{detail.adSet?.targeting?.custom_audiences?.length ? `${detail.adSet.targeting.custom_audiences.length} audience(s)` : "none"}</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <IconUsers className="size-2.5" />
                              <span>Exc:</span>
                              <span className="italic">{detail.adSet?.targeting?.excluded_custom_audiences?.length ? `${detail.adSet.targeting.excluded_custom_audiences.length} audience(s)` : "none"}</span>
                            </div>
                          </div>
                        </div>

                        {/* OPTIMIZATION */}
                        <div className="border rounded-lg p-2.5">
                          <div className="flex items-center gap-1.5 mb-2">
                            <IconTrendingUp className="size-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-bold text-muted-foreground tracking-wider">OPTIMIZATION</span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                            {detail.campaign?.objective && (
                              <span><span className="text-muted-foreground">Objective:</span> <span className="font-bold">{detail.campaign.objective.replace(/_/g, " ")}</span></span>
                            )}
                            {detail.adSet?.optimization_goal && (
                              <span><span className="text-muted-foreground">Goal:</span> <span className="font-bold">{detail.adSet.optimization_goal.replace(/_/g, " ")}</span></span>
                            )}
                            {detail.adSet?.billing_event && (
                              <span><span className="text-muted-foreground">Billing:</span> <span className="font-bold">{detail.adSet.billing_event.replace(/_/g, " ")}</span></span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                            <span><span className="text-muted-foreground">Destination:</span> <span className="font-bold">{(detail.adSet?.destination_type || "UNDEFINED").replace(/_/g, " ")}</span></span>
                            {detail.adSet?.attribution_spec && (
                              <span><span className="text-muted-foreground">Attribution:</span> <span className="font-medium">{
                                detail.adSet.attribution_spec.map((s: any) =>
                                  `${s.window_days}d ${s.event_type === "CLICK_THROUGH" ? "click" : "view"}`
                                ).join(" / ")
                              }</span></span>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground italic px-3 py-4 text-center">Failed to load details. Click to retry.</div>
                    )}
                  </div>
                )}
              </div>

              {/* 2-column toggles */}
              <div className="grid grid-cols-2 gap-3">
                <div className="border rounded-xl p-3">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-semibold">Duplicate ads</p>
                      <IconInfoCircle className="size-3 text-muted-foreground" />
                    </div>
                    <button
                      onClick={() => setDuplicateAds(v => !v)}
                      className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
                        duplicateAds ? "bg-primary" : "bg-muted-foreground/30")}
                    >
                      <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                        duplicateAds ? "translate-x-4" : "translate-x-0.5")} />
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Copy ads to new ad set</p>
                </div>

                <div className={cn("border rounded-xl p-3", launchAsActive && "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900")}>
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-semibold">Launch as</p>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                        launchAsActive
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      )}>{launchAsActive ? "Active" : "Paused"}</span>
                    </div>
                    <button
                      onClick={() => setLaunchAsActive(v => !v)}
                      className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
                        launchAsActive ? "bg-emerald-500" : "bg-muted-foreground/30")}
                    >
                      <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                        launchAsActive ? "translate-x-4" : "translate-x-0.5")} />
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{launchAsActive ? "Starts spending immediately" : "Paused until you enable"}</p>
                </div>
              </div>

              {/* Show Additional Options */}
              <button
                onClick={() => setShowAdvanced(s => !s)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-foreground hover:text-primary"
              >
                {showAdvanced ? "Hide" : "Show"} Additional Options
                <IconChevronDown className={cn("size-4 transition-transform", showAdvanced && "rotate-180")} />
              </button>

              {showAdvanced && (
                <div className="space-y-3">
                  {/* Tab switcher */}
                  <div className="grid grid-cols-3 border rounded-xl p-1 bg-muted/30">
                    {([
                      { key: "budget" as const, label: "Budget & Bid", Icon: IconCurrencyDollar },
                      { key: "delivery" as const, label: "Delivery", Icon: IconSend },
                      { key: "targeting" as const, label: "Targeting", Icon: IconTarget },
                    ]).map(t => (
                      <button
                        key={t.key}
                        onClick={() => setAdvTab(t.key)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-colors",
                          advTab === t.key
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <t.Icon className="size-3.5" />
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  {advTab === "budget" && (
                    <div className="space-y-3">
                      {/* Budget override */}
                      <div className="border rounded-xl p-3">
                        <p className="text-sm font-bold mb-0.5">Budget</p>
                        <p className="text-[11px] text-muted-foreground mb-2.5">Override the budget amount and type for the duplicated ad set.</p>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={budgetOverride}
                            onChange={e => setBudgetOverride(e.target.value)}
                            placeholder="0.00"
                            className="flex-1 px-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                          />
                          <Select value={budgetType} onValueChange={v => setBudgetType(v as any)}>
                            <SelectTrigger className="w-28 h-9 text-sm bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="lifetime">Lifetime</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* CBO info banner (if campaign has budget) */}
                      {detail?.campaign?.is_cbo && (
                        <div className="border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 rounded-xl p-3">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <IconInfoCircle className="size-3.5 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-bold text-blue-700 dark:text-blue-300">Campaign Budget (CBO)</span>
                          </div>
                          <p className="text-[12px] mb-1">
                            <span className="font-bold">Daily Budget:</span>{" "}
                            <span className="font-semibold">${detail.campaign.daily_budget ? (parseInt(detail.campaign.daily_budget) / 100).toFixed(2) : "—"}</span>
                          </p>
                          <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80">
                            Consider this campaign budget when setting your ad set spending limits below.
                          </p>
                        </div>
                      )}

                      {/* Ad set spending limits toggle */}
                      <div className="border rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-1">
                              <p className="text-sm font-bold">Ad set spending limits</p>
                              <IconInfoCircle className="size-3 text-muted-foreground" />
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Optional min and max spend per ad set. Turn on to set daily or lifetime limits in currency or as a % of campaign budget.
                            </p>
                          </div>
                          <button
                            onClick={() => setSpendingLimitsOn(v => !v)}
                            className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 mt-0.5",
                              spendingLimitsOn ? "bg-primary" : "bg-muted-foreground/30")}
                          >
                            <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                              spendingLimitsOn ? "translate-x-4" : "translate-x-0.5")} />
                          </button>
                        </div>
                        {spendingLimitsOn && (
                          <div className="grid grid-cols-2 gap-2 mt-2.5">
                            <div>
                              <label className="text-[10px] font-medium text-muted-foreground block mb-1">Min spend ($)</label>
                              <input
                                type="number"
                                value={minSpend}
                                onChange={e => setMinSpend(e.target.value)}
                                placeholder="0.00"
                                className="w-full px-2 py-1.5 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-muted-foreground block mb-1">Max spend ($)</label>
                              <input
                                type="number"
                                value={maxSpend}
                                onChange={e => setMaxSpend(e.target.value)}
                                placeholder="0.00"
                                className="w-full px-2 py-1.5 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Day parting note */}
                      <div className="flex items-start gap-2 px-1 text-[11px] text-muted-foreground">
                        <IconClock className="size-3.5 shrink-0 mt-0.5" />
                        <p>
                          <span className="font-medium text-foreground/70">Ad Scheduling (Day Parting)</span> - Requires Lifetime Budget. Select{" "}
                          <button onClick={() => setBudgetType("lifetime")} className="text-primary hover:underline font-medium">"Lifetime"</button>{" "}
                          budget type to enable.
                        </p>
                      </div>
                    </div>
                  )}

                  {advTab === "delivery" && (
                    <div className="space-y-3">
                      {/* Schedule */}
                      <div className="border rounded-xl p-3">
                        <p className="text-sm font-bold mb-0.5">Schedule</p>
                        <p className="text-[11px] text-muted-foreground mb-2.5">Override start and end dates for the duplicated ad set.</p>

                        {/* Timezone info banner */}
                        <div className="border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 rounded-lg p-2.5 mb-3">
                          <div className="flex items-start gap-1.5 mb-2">
                            <IconInfoCircle className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] flex-1">
                              <div>
                                <p className="font-bold text-blue-700 dark:text-blue-300">Your Local Timezone:</p>
                                <p className="font-mono">{Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
                              </div>
                              <div>
                                <p className="font-bold text-blue-700 dark:text-blue-300">Ad Account Timezone:</p>
                                <p className="font-mono">America/Los_Angeles (UTC-7)</p>
                              </div>
                              <div>
                                <p className="font-bold text-blue-700 dark:text-blue-300">Ad Account Time:</p>
                                <p className="font-mono">{new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</p>
                              </div>
                              <div>
                                <p className="font-bold text-blue-700 dark:text-blue-300">Local Time:</p>
                                <p className="font-mono">{new Date().toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</p>
                              </div>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            All dates and times will be set according to <span className="text-primary font-medium">your ad account timezone</span>.
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-1">Start Date (optional)</label>
                            <input
                              type="datetime-local"
                              value={scheduleStart}
                              onChange={e => setScheduleStart(e.target.value)}
                              className="w-full px-2 py-1.5 text-xs bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-1">End Date (optional)</label>
                            <input
                              type="datetime-local"
                              value={scheduleEnd}
                              onChange={e => setScheduleEnd(e.target.value)}
                              className="w-full px-2 py-1.5 text-xs bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Target Campaign */}
                      <div className="border rounded-xl p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-sm font-bold">Target Campaign (Optional)</p>
                            <p className="text-[11px] text-muted-foreground">Choose whether to duplicate into the original campaign or another campaign.</p>
                          </div>
                          <button className="flex items-center gap-1 text-xs px-2 py-1 border rounded-lg hover:bg-muted/30 shrink-0 ml-2">
                            <IconRefresh className="size-3" />Refresh
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setTargetCampaign("source")}
                            className={cn(
                              "p-2.5 border rounded-lg text-left transition-colors",
                              targetCampaign === "source"
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background hover:bg-muted/30"
                            )}
                          >
                            <p className="text-sm font-bold">Existing campaign</p>
                            <p className={cn("text-[10px]", targetCampaign === "source" ? "opacity-80" : "text-muted-foreground")}>Keep the source campaign</p>
                          </button>
                          <button
                            onClick={() => setTargetCampaign("another")}
                            className={cn(
                              "p-2.5 border rounded-lg text-left transition-colors",
                              targetCampaign === "another"
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background hover:bg-muted/30"
                            )}
                          >
                            <p className="text-sm font-bold">Another campaign</p>
                            <p className={cn("text-[10px]", targetCampaign === "another" ? "opacity-80" : "text-muted-foreground")}>Choose a destination</p>
                          </button>
                        </div>
                        {targetCampaign === "another" && (
                          <input
                            value={destCampaignId}
                            onChange={e => setDestCampaignId(e.target.value)}
                            placeholder="Destination campaign ID"
                            className="w-full mt-2 px-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring font-mono"
                          />
                        )}
                      </div>

                      {/* Override toggles */}
                      {([
                        {
                          label: "Change conversion event",
                          desc: "Override the pixel conversion on the duplicate (standard Meta events or account custom conversions).",
                          link: "About conversion events",
                          state: changeConversionEvent,
                          set: setChangeConversionEvent,
                        },
                        {
                          label: "Conversion location and performance goal",
                          desc: <>Override Meta <span className="font-mono text-[10px]">destination_type</span> and <span className="font-mono text-[10px]">optimization_goal</span> on the duplicate (same fields as Ads Manager). Leave off to keep the source ad set settings.</>,
                          state: changeConversionLocation,
                          set: setChangeConversionLocation,
                        },
                        {
                          label: "Change placements",
                          desc: "Override which platforms the duplicated ad set delivers on. Unselected platform positions will be removed.",
                          state: changePlacements,
                          set: setChangePlacements,
                        },
                      ]).map((row, i) => (
                        <div key={i} className="border rounded-xl p-3 flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-bold">{row.label}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{row.desc}</p>
                            {row.link && (
                              <a href="#" className="text-[11px] text-primary hover:underline mt-0.5 inline-block">{row.link}</a>
                            )}
                          </div>
                          <button
                            onClick={() => row.set(!row.state)}
                            className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 mt-1",
                              row.state ? "bg-primary" : "bg-muted-foreground/30")}
                          >
                            <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                              row.state ? "translate-x-4" : "translate-x-0.5")} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {advTab === "targeting" && (
                    <div className="space-y-3">
                      {/* Location Targeting */}
                      <div className="border rounded-xl p-3">
                        <p className="text-sm font-bold mb-0.5">Location Targeting</p>
                        <p className="text-[11px] text-muted-foreground mb-2.5">Override the geographic targeting for the duplicated ad set.</p>

                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs">Target:</span>
                          <Select value={locationTarget} onValueChange={v => setLocationTarget(v as any)}>
                            <SelectTrigger className="h-8 text-xs bg-background flex-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="living_in">Living in this location</SelectItem>
                              <SelectItem value="recently_in">Recently in this location</SelectItem>
                              <SelectItem value="traveling_in">Traveling in this location</SelectItem>
                              <SelectItem value="visited">People who visited this location</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Filter chips */}
                        <div className="flex items-center gap-1.5 mb-2">
                          <IconFilter className="size-3.5 text-muted-foreground" />
                          {(["all", "countries", "states", "cities"] as const).map(f => (
                            <button
                              key={f}
                              onClick={() => setLocationFilter(f)}
                              className={cn(
                                "px-2.5 py-0.5 text-[11px] rounded-full font-medium transition-colors capitalize",
                                locationFilter === f
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground hover:bg-muted/70"
                              )}
                            >
                              {f === "all" ? "All Types" : f === "states" ? "States/Regions" : f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                          ))}
                        </div>

                        {/* Search */}
                        <div className="relative mb-2">
                          <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                          <input
                            value={locationSearch}
                            onChange={e => setLocationSearch(e.target.value)}
                            placeholder="Search locations..."
                            className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>

                        <div className="border rounded-lg p-4 text-center">
                          <p className="text-xs text-muted-foreground italic">Type to search for locations</p>
                        </div>
                      </div>

                      {/* Age Targeting */}
                      <div className="border rounded-xl p-3">
                        <p className="text-sm font-bold mb-0.5">Age Targeting</p>
                        <p className="text-[11px] text-muted-foreground mb-2">Define the age range of people who will see your ads.</p>

                        <div className="flex items-center gap-1.5 mb-1.5">
                          <IconCalendar className="size-3.5 text-muted-foreground" />
                          <p className="text-[11px] font-bold text-muted-foreground">Age Targeting</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-2">Define the age range of people who will see your ads</p>

                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-2">
                          <Select value={ageMinSelect} onValueChange={setAgeMinSelect}>
                            <SelectTrigger className="h-9 text-sm bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 53 }, (_, i) => 13 + i).map(a => (
                                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground">to</span>
                          <Select value={ageMaxSelect} onValueChange={setAgeMaxSelect}>
                            <SelectTrigger className="h-9 text-sm bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 52 }, (_, i) => 14 + i).map(a => (
                                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                              ))}
                              <SelectItem value="65+">65+</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="bg-muted/30 rounded-lg p-2 mb-2">
                          <p className="text-[11px] font-medium">Age: {ageMinSelect} - {ageMaxSelect}</p>
                          {ageMaxSelect === "65+" && <p className="text-[10px] text-muted-foreground">People aged 65 and older will be included</p>}
                        </div>

                        <p className="text-[10px] text-muted-foreground mb-1">Common age ranges</p>
                        <div className="flex flex-wrap gap-1">
                          {[
                            { label: "All adults (18-65+)", min: "18", max: "65+" },
                            { label: "18-34", min: "18", max: "34" },
                            { label: "25-54", min: "25", max: "54" },
                            { label: "35-65+", min: "35", max: "65+" },
                          ].map(r => (
                            <button
                              key={r.label}
                              onClick={() => { setAgeMinSelect(r.min); setAgeMaxSelect(r.max) }}
                              className={cn(
                                "px-2 py-1 text-[11px] border rounded-full font-medium transition-colors",
                                ageMinSelect === r.min && ageMaxSelect === r.max
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "hover:bg-muted/30"
                              )}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Audiences */}
                      <div className="border rounded-xl p-3">
                        <p className="text-sm font-bold mb-0.5">Custom Audiences</p>
                        <p className="text-[11px] text-muted-foreground mb-2.5">Include or exclude specific audiences from targeting.</p>

                        <div className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-1.5">
                              <IconUsers className="size-4" />
                              <p className="text-sm font-bold">Custom Audiences</p>
                              <IconInfoCircle className="size-3 text-muted-foreground" />
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{(detail?.adSet?.targeting?.custom_audiences?.length || 4)} available</span>
                          </div>

                          {/* Include block */}
                          <div className="border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-lg p-2.5 mb-2">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                                <IconUsers className="size-3.5" />
                                <span className="text-sm font-bold">Include</span>
                              </div>
                              <button className="flex items-center gap-1 px-2.5 py-1 text-xs border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-background rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-medium">
                                <IconChevronDown className="size-3" />Include
                              </button>
                            </div>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <IconUsers className="size-3" />
                              {includedAudiences.length === 0
                                ? <>No audiences included — click <span className="font-bold text-foreground">Include</span> to add</>
                                : `${includedAudiences.length} audience(s) included`}
                            </p>
                          </div>

                          {/* Exclude block */}
                          <div className="border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/10 rounded-lg p-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
                                <IconUsers className="size-3.5" />
                                <span className="text-sm font-bold">Exclude</span>
                              </div>
                              <button className="flex items-center gap-1 px-2.5 py-1 text-xs border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 bg-background rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 font-medium">
                                <IconChevronDown className="size-3" />Exclude
                              </button>
                            </div>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <IconUsers className="size-3" />
                              {excludedAudiences.length === 0
                                ? <>No audiences excluded — click <span className="font-bold text-foreground">Exclude</span> to add</>
                                : `${excludedAudiences.length} audience(s) excluded`}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Advanced Options */}
                      <div className="border rounded-xl p-3">
                        <p className="text-sm font-bold mb-0.5">Advanced Options</p>
                        <p className="text-[11px] text-muted-foreground mb-2.5">DSA compliance, attribution settings, and debug data.</p>

                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2 py-2 border-b">
                            <div className="flex-1">
                              <p className="text-sm font-medium">Set DSA Beneficiary & Payer <span className="text-[10px] text-muted-foreground italic">(Only for EU/Taiwan Ad sets)</span></p>
                            </div>
                            <button
                              onClick={() => setSetDSA(v => !v)}
                              className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
                                setDSA ? "bg-primary" : "bg-muted-foreground/30")}
                            >
                              <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                                setDSA ? "translate-x-4" : "translate-x-0.5")} />
                            </button>
                          </div>

                          <div className="flex items-start justify-between gap-2 py-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium">Set Custom Attribution Window</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">Using original ad set's attribution settings</p>
                              <button className="text-[11px] text-primary hover:underline mt-0.5 inline-flex items-center gap-1">
                                View current ad set data <IconChevronDown className="size-3" />
                              </button>
                            </div>
                            <button
                              onClick={() => setCustomAttribution(v => !v)}
                              className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
                                customAttribution ? "bg-primary" : "bg-muted-foreground/30")}
                            >
                              <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                                customAttribution ? "translate-x-4" : "translate-x-0.5")} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-2">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 pb-4">
          <Button
            className="w-full h-11 text-sm font-semibold"
            disabled={!selectedSourceId || !newName.trim() || duplicating}
            onClick={handleDuplicate}
          >
            {duplicating
              ? <><IconLoader2 className="size-4 animate-spin mr-1.5" />Duplicating {count}...</>
              : `Duplicate ${count} Ad Set${count > 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Duplicate Campaign Modal (3-step wizard) ────────────────────────────────

interface CampaignItem {
  id: string
  name: string
  status: string
  effective_status: string
  objective: string
  daily_budget?: string
  _adset_count?: number
  _spend?: number
}

interface AdSetCfg {
  id: string
  sourceName: string
  sourceStatus: string
  customName: string
  copies: number
  statusActive: boolean
  startTime: string
  endTime: string
  customAttribution: boolean
  deepCopy: boolean
  copyCurrentSettings: boolean
}

function DuplicateCampaignModal({
  open, onClose, adAccountId, onDuplicated,
}: {
  open: boolean
  onClose: () => void
  adAccountId: string
  onDuplicated: (newAdSets: AdSet[]) => void
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  // Step 1
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [selectedCampaignId, setSelectedCampaignId] = useState("")
  const [campaignDropdownOpen, setCampaignDropdownOpen] = useState(false)
  const [campaignSearch, setCampaignSearch] = useState("")
  const [filterValue, setFilterValue] = useState("all")
  const [campaignName, setCampaignName] = useState("")
  const [campaignCount, setCampaignCount] = useState(1)
  const [budgetCollapsed, setBudgetCollapsed] = useState(true)
  const [budgetType, setBudgetType] = useState<"daily" | "lifetime">("daily")
  const [budgetAmount, setBudgetAmount] = useState("")
  const [bidStrategy, setBidStrategy] = useState("inherit")
  const [launchAsActive, setLaunchAsActive] = useState(false)
  // Step 2
  const [sourceAdSets, setSourceAdSets] = useState<AdSet[]>([])
  const [adSetsLoading, setAdSetsLoading] = useState(false)
  const [selectedAdSetIds, setSelectedAdSetIds] = useState<Set<string>>(new Set())
  const [adSetConfigs, setAdSetConfigs] = useState<Record<string, AdSetCfg>>({})
  // Step 3 results
  const [results, setResults] = useState<any[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setSelectedCampaignId("")
    setCampaignName("")
    setCampaignCount(1)
    setBudgetCollapsed(true)
    setBudgetType("daily")
    setBudgetAmount("")
    setBidStrategy("inherit")
    setLaunchAsActive(false)
    setSelectedAdSetIds(new Set())
    setAdSetConfigs({})
    setResults([])
    setError("")
    fetchCampaigns()
  }, [open, adAccountId])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setCampaignDropdownOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const fetchCampaigns = async () => {
    if (!adAccountId) return
    setCampaignsLoading(true)
    try {
      const res = await fetch(`/api/facebook/campaigns?ad_account_id=${encodeURIComponent(adAccountId)}`)
      const d = await res.json()
      setCampaigns(d.campaigns || [])
    } catch {}
    setCampaignsLoading(false)
  }

  const selectCampaign = (c: CampaignItem) => {
    setSelectedCampaignId(c.id)
    setCampaignName(c.name + " - copy")
    setCampaignDropdownOpen(false)
    setCampaignSearch("")
  }

  const sourceCampaign = campaigns.find(c => c.id === selectedCampaignId)
  const filteredCampaigns = campaigns.filter(c => {
    if (filterValue === "active" && c.effective_status !== "ACTIVE") return false
    if (filterValue === "paused" && c.effective_status !== "PAUSED") return false
    if (campaignSearch && !c.name.toLowerCase().includes(campaignSearch.toLowerCase()) && !c.id.includes(campaignSearch)) return false
    return true
  })

  const goToStep2 = async () => {
    if (!selectedCampaignId || !campaignName.trim()) return
    setAdSetsLoading(true)
    try {
      const res = await fetch(`/api/facebook/adsets?ad_account_id=${encodeURIComponent(adAccountId)}&campaign_id=${selectedCampaignId}`)
      const d = await res.json()
      const list: AdSet[] = d.adSets || []
      setSourceAdSets(list)
      // Auto-select all
      const ids = new Set(list.map(a => a.id))
      setSelectedAdSetIds(ids)
      const cfgs: Record<string, AdSetCfg> = {}
      list.forEach(a => {
        cfgs[a.id] = {
          id: a.id,
          sourceName: a.name,
          sourceStatus: a.effective_status,
          customName: `${a.name} (copy)`,
          copies: 1,
          // ACTIVE → default true, PAUSED → default false (user can toggle on to activate + show full panel)
          statusActive: a.effective_status === "ACTIVE",
          startTime: "",
          endTime: "",
          customAttribution: false,
          deepCopy: false,
          copyCurrentSettings: true,
        }
      })
      setAdSetConfigs(cfgs)
    } catch {}
    setAdSetsLoading(false)
    setStep(2)
  }

  const handleCreate = async () => {
    setCreating(true)
    setError("")
    try {
      const adSetConfigsArr = Array.from(selectedAdSetIds).map(id => adSetConfigs[id]).filter(Boolean)
      const res = await fetch(`/api/facebook/campaigns/${selectedCampaignId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customName: campaignName,
          count: campaignCount,
          launchAsActive,
          dailyBudget: budgetType === "daily" && budgetAmount ? budgetAmount : undefined,
          lifetimeBudget: budgetType === "lifetime" && budgetAmount ? budgetAmount : undefined,
          bidStrategy: bidStrategy === "inherit" ? undefined : bidStrategy,
          adSetConfigs: adSetConfigsArr,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
        setCreating(false)
        return
      }
      setResults(data.campaigns || [])
      // Push new ad sets to parent for selection
      const allNewAdSets: AdSet[] = []
      for (const cmp of (data.campaigns || [])) {
        for (const a of (cmp.adSets || [])) {
          allNewAdSets.push({
            id: a.id,
            name: a.name,
            status: launchAsActive ? "ACTIVE" : "PAUSED",
            effective_status: launchAsActive ? "ACTIVE" : "PAUSED",
            campaign_id: cmp.id,
          })
        }
      }
      onDuplicated(allNewAdSets)
      setStep(3)
    } catch (e: any) {
      setError(e.message)
    }
    setCreating(false)
  }

  const totalAdSetsToCreate = Array.from(selectedAdSetIds).reduce((sum, id) => sum + (adSetConfigs[id]?.copies || 1), 0) * campaignCount

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl p-0 max-h-[92vh] overflow-y-auto gap-0">
        {/* Header */}
        <div className="px-5 py-4 border-b">
          <DialogTitle className="text-base font-semibold mb-3">Duplicate an existing campaign</DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center justify-between gap-2">
            {([
              { n: 1, label: "Duplicate Campaign" },
              { n: 2, label: "Configure Ad Sets" },
              { n: 3, label: "Complete" },
            ] as const).map((s, i, arr) => (
              <div key={s.n} className="flex items-center flex-1">
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
                  step === s.n ? "bg-primary/10 text-primary" : "",
                  step > s.n ? "text-emerald-600" : ""
                )}>
                  {step > s.n ? (
                    <IconCircleCheck className="size-5 text-emerald-600" />
                  ) : (
                    <span className={cn(
                      "size-5 rounded-full flex items-center justify-center text-xs font-bold",
                      step === s.n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>{s.n}</span>
                  )}
                  <span className={step === s.n || step > s.n ? "" : "text-muted-foreground"}>{s.label}</span>
                </div>
                {i < arr.length - 1 && <div className="flex-1 h-px bg-border mx-1" />}
              </div>
            ))}
          </div>
        </div>

        {/* STEP 1 — Duplicate Campaign */}
        {step === 1 && (
          <div className="px-5 py-4 space-y-3">
            {/* Filter */}
            <Select value={filterValue} onValueChange={setFilterValue}>
              <SelectTrigger className="h-10 text-sm">
                <div className="flex items-center gap-2">
                  <IconFilter className="size-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Filter Campaigns" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="paused">Paused only</SelectItem>
              </SelectContent>
            </Select>

            {/* Campaign selector */}
            <div className="flex gap-2">
              <div ref={dropdownRef} className="relative flex-1">
                <button
                  onClick={() => setCampaignDropdownOpen(o => !o)}
                  className="w-full flex items-center justify-between px-3 py-2.5 border rounded-lg bg-background hover:bg-muted/30 text-left"
                >
                  {sourceCampaign ? (
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <IconBrandMeta className="size-4 text-[#0064E0] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate">{sourceCampaign.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          Manual | {sourceCampaign._adset_count || 0} ad sets | {sourceCampaign.id} | {(sourceCampaign.objective || "").replace(/_/g, " ")} | spend: {sourceCampaign._spend ? `${(sourceCampaign._spend / 1000).toFixed(1)}K` : "0"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Select a campaign...</span>
                  )}
                  <IconSelector className="size-4 text-muted-foreground shrink-0 ml-2" />
                </button>
                {campaignDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-xl shadow-lg z-50 overflow-hidden">
                    <div className="p-2 border-b">
                      <div className="relative">
                        <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                        <input
                          autoFocus
                          value={campaignSearch}
                          onChange={e => setCampaignSearch(e.target.value)}
                          placeholder="Search campaigns..."
                          className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {campaignsLoading ? (
                        <div className="px-3 py-3 text-xs text-muted-foreground flex items-center gap-2">
                          <IconLoader2 className="size-3 animate-spin" />Loading...
                        </div>
                      ) : filteredCampaigns.length === 0 ? (
                        <div className="px-3 py-3 text-xs text-muted-foreground">No campaigns</div>
                      ) : filteredCampaigns.map(c => (
                        <button
                          key={c.id}
                          onClick={() => selectCampaign(c)}
                          className={cn(
                            "w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-accent border-b last:border-b-0",
                            selectedCampaignId === c.id && "bg-primary/5"
                          )}
                        >
                          <div className="size-4 shrink-0 mt-0.5">
                            {selectedCampaignId === c.id && <IconCheck className="size-4 text-primary" />}
                          </div>
                          <IconBrandMeta className="size-4 text-[#0064E0] shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{c.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              Ad Sets: {c._adset_count || 0} | Total Ads: {(c._adset_count || 0) * 1} | Manual | {(c.objective || "").replace(/_/g, " ")} | spend: {c._spend || 0}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={fetchCampaigns} className="size-10 border rounded-lg flex items-center justify-center hover:bg-muted/30">
                <IconRefresh className={cn("size-4 text-muted-foreground", campaignsLoading && "animate-spin")} />
              </button>
            </div>

            {sourceCampaign && (
              <>
                {/* Duplicating from card */}
                <div className="border rounded-xl p-3 bg-muted/20">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">DUPLICATING FROM</p>
                  <div className="flex items-center gap-2 mb-1.5">
                    <IconBrandFacebook className="size-4 text-[#1877F2]" />
                    <span className="text-sm font-bold flex-1 truncate">{sourceCampaign.name}</span>
                    <IconExternalLink className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-background border">
                      <IconPlus className="size-3" />{sourceCampaign._adset_count || 0} ad set{(sourceCampaign._adset_count || 0) !== 1 ? "s" : ""}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-background border">
                      <IconClock className="size-3" />${((sourceCampaign._spend || 0) / 1).toFixed(2)} spend
                    </span>
                    {sourceCampaign.daily_budget && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-background border font-bold">
                        ${(parseInt(sourceCampaign.daily_budget) / 100).toFixed(2)}/day
                      </span>
                    )}
                  </div>
                </div>

                {/* New Campaign divider */}
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 border-t border-dashed" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">NEW CAMPAIGN</span>
                  <div className="flex-1 border-t border-dashed" />
                </div>

                {/* Campaign name + count */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-bold">Campaign Name</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{campaignCount} campaign{campaignCount > 1 ? "s" : ""}</span>
                      <div className="flex items-center border rounded-lg">
                        <button onClick={() => setCampaignCount(c => Math.max(1, c - 1))} className="size-7 flex items-center justify-center hover:bg-muted/40 disabled:opacity-30" disabled={campaignCount <= 1}>
                          <IconMinus className="size-3.5" />
                        </button>
                        <span className="px-2 text-sm font-medium min-w-[28px] text-center">{campaignCount}</span>
                        <button onClick={() => setCampaignCount(c => Math.min(20, c + 1))} className="size-7 flex items-center justify-center hover:bg-muted/40 disabled:opacity-30" disabled={campaignCount >= 20}>
                          <IconPlus className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <input
                    value={campaignName}
                    onChange={e => setCampaignName(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                    <IconInfoCircle className="size-3" />Ad sets will be configured in the next step
                  </p>
                </div>

                {/* Budget & Schedule (collapsible) */}
                <div className="border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setBudgetCollapsed(c => !c)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-bold hover:bg-muted/20"
                  >
                    Budget & Schedule
                    <IconChevronDown className={cn("size-4 transition-transform", !budgetCollapsed && "rotate-180")} />
                  </button>
                  {!budgetCollapsed && (
                    <div className="border-t p-3 space-y-3">
                      <div>
                        <label className="text-sm font-bold block mb-1.5">Budget Type</label>
                        <Select value={budgetType} onValueChange={v => setBudgetType(v as any)}>
                          <SelectTrigger className="h-9 text-sm bg-background"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily Budget</SelectItem>
                            <SelectItem value="lifetime">Lifetime Budget</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-bold block mb-1.5">{budgetType === "daily" ? "Daily Budget" : "Lifetime Budget"}</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                          <input
                            type="number"
                            value={budgetAmount}
                            onChange={e => setBudgetAmount(e.target.value)}
                            placeholder="0"
                            className="w-full pl-7 pr-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">{budgetType === "daily" ? "Amount to spend each day" : "Total amount over campaign lifetime"}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bid strategy */}
                <div className="border rounded-xl p-3 flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-bold">Campaign bid strategy</p>
                    <p className="text-[11px] text-muted-foreground">Override the copied campaign's bid strategy</p>
                  </div>
                  <Select value={bidStrategy} onValueChange={setBidStrategy}>
                    <SelectTrigger className="w-36 h-9 text-sm bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">Keep original</SelectItem>
                      <SelectItem value="LOWEST_COST_WITHOUT_CAP">Lowest cost (no cap)</SelectItem>
                      <SelectItem value="LOWEST_COST_WITH_BID_CAP">Bid cap</SelectItem>
                      <SelectItem value="COST_CAP">Cost cap</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Launch as Active */}
                <div className="border rounded-xl p-3 flex items-center justify-between">
                  <p className="text-sm font-bold">Launch as Active</p>
                  <button
                    onClick={() => setLaunchAsActive(v => !v)}
                    className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      launchAsActive ? "bg-primary" : "bg-muted-foreground/30")}
                  >
                    <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                      launchAsActive ? "translate-x-4" : "translate-x-0.5")} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 2 — Configure Ad Sets */}
        {step === 2 && (
          <div className="px-5 py-4 space-y-3">
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg px-3 py-2 text-[11px] flex items-center justify-between">
              <span><span className="font-bold text-blue-700 dark:text-blue-300">Ad Account Timezone:</span> America/Los_Angeles (UTC-07:00)</span>
              <span><span className="font-bold text-blue-700 dark:text-blue-300">Time:</span> {new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-bold">Choose Ad Sets ({selectedAdSetIds.size}/{sourceAdSets.length}) To Duplicate</p>
              <div className="flex items-center gap-3 text-xs">
                {selectedAdSetIds.size > 0 && (
                  <>
                    <button
                      onClick={() => {
                        setAdSetConfigs(prev => {
                          const next = { ...prev }
                          selectedAdSetIds.forEach(id => { if (next[id]) next[id] = { ...next[id], statusActive: true } })
                          return next
                        })
                      }}
                      className="px-2 py-1 rounded-md text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 font-semibold border border-emerald-200 dark:border-emerald-900"
                      title={`Set all ${selectedAdSetIds.size} selected to ACTIVE`}
                    >
                      Activate All
                    </button>
                    <button
                      onClick={() => {
                        setAdSetConfigs(prev => {
                          const next = { ...prev }
                          selectedAdSetIds.forEach(id => { if (next[id]) next[id] = { ...next[id], statusActive: false } })
                          return next
                        })
                      }}
                      className="px-2 py-1 rounded-md text-muted-foreground bg-muted hover:bg-muted/70 font-semibold border"
                      title={`Set all ${selectedAdSetIds.size} selected to PAUSED`}
                    >
                      Pause All
                    </button>
                    <span className="w-px h-4 bg-border" />
                  </>
                )}
                <button onClick={() => setSelectedAdSetIds(selectedAdSetIds.size === sourceAdSets.length ? new Set() : new Set(sourceAdSets.map(a => a.id)))}
                  className="text-primary hover:underline">
                  {selectedAdSetIds.size === sourceAdSets.length ? "Deselect All" : "Select All"}
                </button>
                <span className="text-muted-foreground">{sourceAdSets.length} total ad sets</span>
              </div>
            </div>

            {adSetsLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
                <IconLoader2 className="size-4 animate-spin" />Loading ad sets...
              </div>
            ) : sourceAdSets.length === 0 ? (
              <div className="text-sm text-muted-foreground italic px-3 py-6 text-center border rounded-lg">No ad sets in this campaign</div>
            ) : sourceAdSets.map((adset, idx) => {
              const cfg = adSetConfigs[adset.id]
              const sel = selectedAdSetIds.has(adset.id)
              const isPaused = adset.effective_status !== "ACTIVE"
              if (!cfg) return null
              const updateCfg = (patch: Partial<AdSetCfg>) => {
                setAdSetConfigs(prev => ({ ...prev, [adset.id]: { ...prev[adset.id], ...patch } }))
              }
              return (
                <div key={adset.id} className={cn("border rounded-xl overflow-hidden",
                  sel && cfg.statusActive && "border-l-4 border-l-primary",
                  sel && !cfg.statusActive && "border-l-4 border-l-muted-foreground/30 bg-muted/10"
                )}>
                  <div className="px-3 py-2.5 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={sel}
                      onChange={e => {
                        setSelectedAdSetIds(prev => {
                          const s = new Set(prev)
                          e.target.checked ? s.add(adset.id) : s.delete(adset.id)
                          return s
                        })
                      }}
                      className="size-4"
                    />
                    <IconBrandMeta className="size-4 text-[#0064E0]" />
                    <span className={cn("text-sm font-bold flex-1 truncate", !cfg.statusActive && "text-muted-foreground")}>{adset.name}</span>
                    {/* Badge: ALWAYS reflect cfg.statusActive (user's choice persists across check/uncheck) */}
                    {(() => {
                      const willBeActive = cfg.statusActive
                      const changed = cfg.statusActive !== (adset.effective_status === "ACTIVE")
                      return (
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-bold border inline-flex items-center gap-1",
                          willBeActive
                            ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                            : "bg-muted text-muted-foreground border-border",
                          !sel && "opacity-50"
                        )}
                          title={changed ? `Source: ${adset.effective_status} → Will be: ${willBeActive ? "ACTIVE" : "PAUSED"}${!sel ? " (not selected — won't duplicate)" : ""}` : adset.effective_status}
                        >
                          {willBeActive ? "ACTIVE" : "PAUSED"}
                          {changed && sel && <IconArrowRight className="size-2.5 opacity-70" />}
                        </span>
                      )
                    })()}
                  </div>
                  <p className="px-3 pb-2 text-[11px] text-muted-foreground">
                    Ad Set {idx + 1} of {sourceAdSets.length}
                    {sel && (
                      cfg.statusActive
                        ? (isPaused ? <span className="ml-2 italic">— paused source, will be activated on duplicate</span> : null)
                        : (isPaused
                            ? <span className="ml-2 italic">— paused source (toggle Activate for full options)</span>
                            : <span className="ml-2 italic">— set to pause on duplicate (toggle Activate for full options)</span>)
                    )}
                  </p>

                  {/* statusActive = false → mini panel (regardless of source status) */}
                  {sel && !cfg.statusActive && (
                    <div className="border-t bg-background p-3 space-y-2.5">
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <div>
                          <label className="text-[11px] font-medium text-muted-foreground block mb-1">New Ad Set Name</label>
                          <input value={cfg.customName} onChange={e => updateCfg({ customName: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring" />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-muted-foreground block mb-1">Copies <span className="text-[10px]">1–250</span></label>
                          <input type="number" min={1} max={250} value={cfg.copies}
                            onChange={e => updateCfg({ copies: Math.max(1, Math.min(250, parseInt(e.target.value) || 1)) })}
                            className="w-16 px-2 py-1.5 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring text-center" />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/30 border">
                        <div className="flex-1">
                          <p className="text-sm font-medium">Activate when duplicated</p>
                          <p className="text-[11px] text-muted-foreground">Toggle on to set status ACTIVE + customize schedule, dates, attribution</p>
                        </div>
                        <button onClick={() => updateCfg({ statusActive: true })}
                          className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 bg-muted-foreground/30">
                          <span className="inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform translate-x-0.5" />
                        </button>
                      </div>

                      <div className="flex items-start justify-between gap-2 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900 rounded-lg p-2">
                        <div>
                          <p className="text-sm font-medium flex items-center gap-1">
                            Duplicate ads from original ad set
                            <IconInfoCircle className="size-3 text-muted-foreground" />
                          </p>
                          <p className="text-[11px] text-muted-foreground">Copy all existing ads to new ad set</p>
                        </div>
                        <button onClick={() => updateCfg({ deepCopy: !cfg.deepCopy })}
                          className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 mt-0.5",
                            cfg.deepCopy ? "bg-primary" : "bg-muted-foreground/30")}>
                          <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                            cfg.deepCopy ? "translate-x-4" : "translate-x-0.5")} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* statusActive = true → full panel (regardless of source) */}
                  {sel && cfg.statusActive && (
                    <div className="border-t bg-muted/10 p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Copy current settings</span>
                        <button onClick={() => updateCfg({ copyCurrentSettings: !cfg.copyCurrentSettings })}
                          className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                            cfg.copyCurrentSettings ? "bg-primary" : "bg-muted-foreground/30")}>
                          <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                            cfg.copyCurrentSettings ? "translate-x-4" : "translate-x-0.5")} />
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Budget: No budget • {adset.effective_status} • Scheduled</p>

                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <div>
                          <label className="text-[11px] font-medium text-muted-foreground block mb-1">New Ad Set Name</label>
                          <input value={cfg.customName} onChange={e => updateCfg({ customName: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring" />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-muted-foreground block mb-1">Copies <span className="text-[10px]">1–250</span></label>
                          <input type="number" min={1} max={250} value={cfg.copies}
                            onChange={e => updateCfg({ copies: Math.max(1, Math.min(250, parseInt(e.target.value) || 1)) })}
                            className="w-16 px-2 py-1.5 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring text-center" />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button onClick={() => updateCfg({ statusActive: !cfg.statusActive })}
                          className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                            cfg.statusActive ? "bg-primary" : "bg-muted-foreground/30")}>
                          <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                            cfg.statusActive ? "translate-x-4" : "translate-x-0.5")} />
                        </button>
                        <span className="text-sm font-medium">Ad Set Status: {cfg.statusActive ? "Active" : "Paused"}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-medium block mb-1">Start Date & Time <span className="text-muted-foreground">(Optional)</span></label>
                          <input type="datetime-local" value={cfg.startTime} onChange={e => updateCfg({ startTime: e.target.value })}
                            className="w-full px-2 py-1.5 text-xs bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring" />
                          <p className="text-[10px] text-muted-foreground mt-0.5">Leave empty to start immediately when ad set is activated</p>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium block mb-1">End Date & Time <span className="text-muted-foreground">(Optional)</span></label>
                          <input type="datetime-local" value={cfg.endTime} onChange={e => updateCfg({ endTime: e.target.value })} disabled={!cfg.startTime}
                            className="w-full px-2 py-1.5 text-xs bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring disabled:opacity-50" />
                          <p className="text-[10px] text-muted-foreground mt-0.5">Please select a start date first</p>
                        </div>
                      </div>

                      <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                        <IconClock className="size-3 mt-0.5" />
                        <span><span className="font-medium text-foreground/70">Ad Scheduling (Day Parting)</span> - Requires Lifetime Budget. Turn off "Copy current settings" and select "Lifetime Budget" to enable.</span>
                      </p>

                      <div className="flex items-start justify-between gap-2 py-2 border-t">
                        <div>
                          <p className="text-sm font-medium">Set Custom Attribution Window</p>
                          <p className="text-[11px] text-muted-foreground">Using original ad set's attribution settings</p>
                        </div>
                        <button onClick={() => updateCfg({ customAttribution: !cfg.customAttribution })}
                          className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 mt-0.5",
                            cfg.customAttribution ? "bg-primary" : "bg-muted-foreground/30")}>
                          <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                            cfg.customAttribution ? "translate-x-4" : "translate-x-0.5")} />
                        </button>
                      </div>

                      <div className="flex items-start justify-between gap-2 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900 rounded-lg p-2">
                        <div>
                          <p className="text-sm font-medium flex items-center gap-1">
                            Duplicate ads from original ad set
                            <IconInfoCircle className="size-3 text-muted-foreground" />
                          </p>
                          <p className="text-[11px] text-muted-foreground">Copy all existing ads to new ad set</p>
                        </div>
                        <button onClick={() => updateCfg({ deepCopy: !cfg.deepCopy })}
                          className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 mt-0.5",
                            cfg.deepCopy ? "bg-primary" : "bg-muted-foreground/30")}>
                          <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                            cfg.deepCopy ? "translate-x-4" : "translate-x-0.5")} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* STEP 3 — Complete */}
        {step === 3 && (
          <div className="px-5 py-6 text-center space-y-4">
            <div className="size-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
              <IconCheck className="size-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Duplication Complete!</h3>
              <p className="text-sm text-muted-foreground">
                Successfully created {results.length} campaign{results.length !== 1 ? "s" : ""} with {results.reduce((sum, c) => sum + (c.adSets?.length || 0), 0)} ad set{results.reduce((sum, c) => sum + (c.adSets?.length || 0), 0) !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="border rounded-lg overflow-hidden text-left bg-blue-50/50 dark:bg-blue-950/10">
              {results.map((c, i) => (
                <div key={c.id}>
                  <div className="px-3 py-2.5 flex items-center gap-2 border-b">
                    <span className="size-7 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <IconBrandMeta className="size-4 text-[#0064E0]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">Campaign ID: {c.id}</p>
                    </div>
                    <a href={`https://www.facebook.com/adsmanager/manage/campaigns?act=${adAccountId}&selected_campaign_ids=${c.id}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0">
                      View Campaign <IconExternalLink className="size-3" />
                    </a>
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase px-3 py-1.5">AD SETS ({c.adSets?.length || 0})</p>
                  {(c.adSets || []).map((a: any) => (
                    <div key={a.id} className="px-3 py-1.5 flex items-center gap-2 text-xs border-t">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      <span className="font-medium truncate flex-1">{a.name}</span>
                      <span className="text-muted-foreground font-mono">ID: {a.id}</span>
                      <a href="#" className="text-primary hover:underline flex items-center gap-0.5">View <IconExternalLink className="size-2.5" /></a>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && step !== 3 && (
          <div className="mx-5 mb-3 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-2">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t flex items-center justify-between">
          {step === 3 ? (
            <Button onClick={onClose} className="w-full h-10 bg-emerald-500 hover:bg-emerald-600 text-white">
              <IconCheck className="size-4 mr-1" />Done
            </Button>
          ) : (
            <>
              <button onClick={() => {
                if (step === 2) setStep(1)
                else { setSelectedCampaignId(""); setCampaignName(""); setSelectedAdSetIds(new Set()) }
              }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <IconRefresh className="size-3" />Reset
              </button>
              <div className="flex items-center gap-2">
                {step === 2 && (
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <IconArrowLeft className="size-3.5 mr-1" />Back
                  </Button>
                )}
                {step === 1 ? (
                  <Button onClick={goToStep2} disabled={!selectedCampaignId || !campaignName.trim()}>
                    Create {campaignCount} Campaign{campaignCount > 1 ? "s" : ""}<IconArrowRight className="size-3.5 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={handleCreate} disabled={selectedAdSetIds.size === 0 || creating} className="min-w-[180px]">
                    {creating ? <><IconLoader2 className="size-4 animate-spin mr-1" />Duplicating...</> : `Duplicate ${totalAdSetsToCreate} Ad Set${totalAdSetsToCreate !== 1 ? "s" : ""}`}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Ad Sets Panel ────────────────────────────────────────────────────────────

function AdSetsPanel({ adAccountId, selectedAdSets, onSelect, onRemove }: {
  adAccountId: string; selectedAdSets: AdSet[]
  onSelect: (a: AdSet) => void; onRemove: (id: string) => void
}) {
  const [search, setSearch] = useState("")
  const [allAdSets, setAllAdSets] = useState<AdSet[]>([])
  const [results, setResults] = useState<AdSet[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false)
  const [duplicateCampaignOpen, setDuplicateCampaignOpen] = useState(false)
  const selectedIds = new Set(selectedAdSets.map(a => a.id))

  const fetchAdSets = useCallback(() => {
    if (!adAccountId) return
    setLoading(true)
    fetch(`/api/facebook/adsets?ad_account_id=${encodeURIComponent(adAccountId)}`)
      .then(r => r.json())
      .then(d => setAllAdSets(d.adSets || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [adAccountId])

  useEffect(() => { fetchAdSets() }, [fetchAdSets])

  useEffect(() => {
    const q = search.toLowerCase()
    setResults(!q ? allAdSets.slice(0, 25) : allAdSets.filter(a => a.name.toLowerCase().includes(q) || a.id.includes(q)).slice(0, 25))
  }, [search, allAdSets])

  return (
    <div className="border rounded-xl bg-card">
      <DuplicateAdSetModal
        open={duplicateModalOpen}
        onClose={() => setDuplicateModalOpen(false)}
        allAdSets={allAdSets}
        onDuplicated={(newAdSets) => {
          setAllAdSets(prev => [...newAdSets, ...prev])
          newAdSets.forEach(a => onSelect(a))
        }}
      />
      <DuplicateCampaignModal
        open={duplicateCampaignOpen}
        onClose={() => setDuplicateCampaignOpen(false)}
        adAccountId={adAccountId}
        onDuplicated={(newAdSets) => {
          setAllAdSets(prev => [...newAdSets, ...prev])
          newAdSets.forEach(a => onSelect(a))
        }}
      />
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold">Ad Sets</span>
          <span className="text-destructive text-xs font-bold">*</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setDuplicateModalOpen(true)}
            disabled={allAdSets.length === 0}
          >
            <IconCopy className="size-3" />Duplicate Ad Set
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setDuplicateCampaignOpen(true)}
            disabled={!adAccountId}
          >
            <IconCopy className="size-3" />Duplicate Campaign
          </Button>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {selectedAdSets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedAdSets.map(a => (
              <span key={a.id} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                {a.name}
                <button onClick={() => onRemove(a.id)} className="hover:text-destructive rounded-full p-0.5">
                  <IconX className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="Search by Ad Set name or ID"
            className="w-full pl-9 pr-16 py-2 text-sm bg-muted/40 border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/40 font-mono">Ctrl+K</span>

          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
              {loading ? (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                  <IconLoader2 className="size-3.5 animate-spin" />Loading...
                </div>
              ) : results.length === 0 ? (
                <div className="px-3 py-3 text-sm text-muted-foreground">No ad sets found</div>
              ) : results.map(a => (
                <button key={a.id}
                  onMouseDown={() => { if (!selectedIds.has(a.id)) onSelect(a); setSearch("") }}
                  className={cn("w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-accent transition-colors",
                    selectedIds.has(a.id) && "opacity-50")}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground">{a.id}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      a.effective_status === "ACTIVE" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground")}>
                      {a.effective_status}
                    </span>
                    {selectedIds.has(a.id) && <IconCheck className="size-3.5 text-primary" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={fetchAdSets}>
          <IconRefresh className={cn("size-3", loading && "animate-spin")} />Ad Set Refresh
        </Button>
      </div>
    </div>
  )
}

// ─── Default Ad Settings Modal ────────────────────────────────────────────────

const DYNAMIC_TAGS = [
  "id", "counter", "creator", "filename",
  "dimensions", "filetype", "creativeType", "landingPage",
  "webLink", "adSetName", "campaignName", "aiName",
  "pageName",
]
const AI_NAME_TAGS = ["aiName"]
const DATE_FORMATS = [
  { value: "yyyy-mm-dd", label: "yyyy-mm-dd (2025-10-17)" },
  { value: "mm-dd-yyyy", label: "mm-dd-yyyy (10-17-2025)" },
  { value: "dd-mm-yyyy", label: "dd-mm-yyyy (17-10-2025)" },
  { value: "mmm-dd", label: "mmm-dd (Oct-17)" },
  { value: "dd-mmm-yy", label: "dd-mmm-yy (17-Oct-25)" },
  { value: "yyyymmdd", label: "yyyymmdd (20251017)" },
  { value: "mmm-dd-yyyy", label: "mmm-dd-yyyy (Oct-17-2025)" },
  { value: "dd/mm/yyyy", label: "dd/mm/yyyy (17/10/2025)" },
  { value: "mm/dd/yyyy", label: "mm/dd/yyyy (10/17/2025)" },
  { value: "WwwYyy", label: "WwwYyy (W42Y25)" },
  { value: "Www", label: "Www (W42)" },
  { value: "Yyy", label: "Yyy (Y25)" },
]
const SEPARATORS = [
  { value: "none", label: "None (no separator)", char: "" },
  { value: "underscore", label: "Underscore _", char: "_" },
  { value: "hyphen", label: "Hyphen -", char: "-" },
  { value: "space", label: "Space", char: " " },
  { value: "pipe", label: "Pipe |", char: "|" },
  { value: "double_dots", label: "Double Dots ..", char: ".." },
  { value: "double_colons", label: "Double Colons ::", char: "::" },
]

interface NamingConvention {
  tags: string[]              // e.g. ["filename", "_separator_", "creator"]
  dateFormat: string
  customTexts: { name: string; value: string }[]
  options: {
    removeDimensions: boolean
    preserveUnderscores: boolean
    useStaticForImages: boolean
    extendedIdFormat: boolean
    spacesAroundSeparator: boolean
  }
  separator: string
  aiNameSchema: string[]
}

interface CreativeEnhancements {
  metaCreativeEnhancements: boolean
  optimiseTextPerPerson: boolean
  images: Record<string, boolean>
  videos: Record<string, boolean>
  carousel: Record<string, boolean>
}

interface LaunchSettings {
  multiAdvertiser: boolean
  websiteDestOpt: boolean
  sitelinks: boolean
  browserAdOns: boolean
  tagBasedLocalization: boolean
  hidePromoCode: boolean
  autoUploadCaptions: boolean
  fastUpload: boolean
  launchAsPaused: boolean
  oneAdPerAdset: boolean
  launchAsPostId: boolean
  trackingSpecs: boolean
}

interface AdCopyDefaults {
  primaryText: string
  primaryVariations: string[]
  headline: string
  headlineVariations: string[]
  description: string
  cta: string
}

interface WebAppLinks {
  webLink: string
  displayLink: string
  androidLink: string
  iosAppStoreLink: string
  appDeeplink: string
  customProductPage: string
  utmParameters: string
}

interface DefaultAdSettings {
  naming: NamingConvention
  enhancements: CreativeEnhancements
  launch: LaunchSettings
  adCopy: AdCopyDefaults
  links: WebAppLinks
}

const DEFAULT_SETTINGS: DefaultAdSettings = {
  naming: {
    tags: ["filename"],
    dateFormat: "mmm-dd",
    customTexts: [],
    options: {
      removeDimensions: true,
      preserveUnderscores: false,
      useStaticForImages: false,
      extendedIdFormat: false,
      spacesAroundSeparator: false,
    },
    separator: "underscore",
    aiNameSchema: ["Style", "Asset Type", "Length", "Creator Age", "Hook", "Dimensions"],
  },
  enhancements: {
    metaCreativeEnhancements: true,
    optimiseTextPerPerson: true,
    images: {
      textTranslation: true, showSummary: true, revealDetails: true, addOverlays: true,
      adjustBrightness: true, music: true, imageAnimation: true, addSiteLinks: true,
      enhanceCTA: true, addDetailsToAd: true, flexibleMedia: true, advantagePlus: true,
      profileExtension: true, storeLocation: true, businessAI: true, showSpotlights: true,
      createStickerCTA: true,
    },
    videos: {
      textTranslation: true, addVideoEffects: true, addSiteLinks: true, enhanceCTA: true,
      addDetailsToAd: true, flexibleMedia: true, advantagePlus: true, videoToImage: true,
      profileExtension: true, storeLocation: true, businessAI: true, showSpotlights: true,
      createStickerCTA: true,
    },
    carousel: {
      relevantComments: true, profileAndCard: true, highlightCarouselCard: true,
      formatAutomation: true, dynamicDescription: true, enhanceCTA: true,
      adaptMultiImage: true, advantagePlus: true, photosToVideo: true, profileExtension: true,
      storeLocation: true, businessAI: true,
    },
  },
  launch: {
    multiAdvertiser: true,
    websiteDestOpt: false,
    sitelinks: false,
    browserAdOns: false,
    tagBasedLocalization: false,
    hidePromoCode: true,
    autoUploadCaptions: false,
    fastUpload: true,
    launchAsPaused: false,
    oneAdPerAdset: false,
    launchAsPostId: false,
    trackingSpecs: false,
  },
  adCopy: { primaryText: "", primaryVariations: [], headline: "", headlineVariations: [], description: "", cta: "SHOP_NOW" },
  links: { webLink: "", displayLink: "", androidLink: "", iosAppStoreLink: "", appDeeplink: "", customProductPage: "", utmParameters: "" },
}

const ENHANCEMENT_LABELS = {
  images: [
    ["textTranslation", "Text translation"], ["showSummary", "Show summary"],
    ["revealDetails", "Reveal details over time"], ["addOverlays", "Add overlays"],
    ["adjustBrightness", "Adjust brightness and contrast"], ["music", "Music"],
    ["imageAnimation", "Image animation"], ["addSiteLinks", "Add site links"],
    ["enhanceCTA", "Enhance CTA"], ["addDetailsToAd", "Add details to ad layout"],
    ["flexibleMedia", "Flexible Media"], ["advantagePlus", "Advantage+ Creative"],
    ["profileExtension", "Profile extension"], ["storeLocation", "Store location"],
    ["businessAI", "Business AI"], ["showSpotlights", "Show spotlights"],
    ["createStickerCTA", "Create sticker CTA"],
  ],
  videos: [
    ["textTranslation", "Text translation"], ["addVideoEffects", "Add video effects"],
    ["addSiteLinks", "Add site links"], ["enhanceCTA", "Enhance CTA"],
    ["addDetailsToAd", "Add details to ad layout"], ["flexibleMedia", "Flexible Media"],
    ["advantagePlus", "Advantage+ Creative"], ["videoToImage", "Video to image"],
    ["profileExtension", "Profile extension"], ["storeLocation", "Store location"],
    ["businessAI", "Business AI"], ["showSpotlights", "Show spotlights"],
    ["createStickerCTA", "Create sticker CTA"],
  ],
  carousel: [
    ["relevantComments", "Relevant comments"], ["profileAndCard", "Profile and card"],
    ["highlightCarouselCard", "Highlight carousel card"], ["formatAutomation", "Format automation"],
    ["dynamicDescription", "Dynamic description"], ["enhanceCTA", "Enhance CTA"],
    ["adaptMultiImage", "Adapt multi-image format"], ["advantagePlus", "Advantage+ Creative"],
    ["photosToVideo", "Photos to video"], ["profileExtension", "Profile extension"],
    ["storeLocation", "Store location"], ["businessAI", "Business AI"],
  ],
}

const LAUNCH_SETTING_DEFS: { key: keyof LaunchSettings; label: string; desc: string }[] = [
  { key: "multiAdvertiser", label: "Multi Advertiser", desc: "Automatically enable multi advertiser optimization" },
  { key: "websiteDestOpt", label: "Website Destination Optimization", desc: "Allow Meta to optimize landing page destinations" },
  { key: "sitelinks", label: "Sitelinks", desc: "Add sitelinks to your ads with custom URLs and display labels" },
  { key: "browserAdOns", label: "Browser Ad Ons", desc: "Add an additional contact method in the browser" },
  { key: "tagBasedLocalization", label: "Tag Based Localization", desc: "Show Tag Based matcher in launch and save MultiLang" },
  { key: "hidePromoCode", label: "Hide Promo Code & Email Sign Up", desc: "Prevent promo codes from being used" },
  { key: "autoUploadCaptions", label: "Auto Upload Captions (Meta)", desc: "Auto-transcribe and upload captions to improve Meta performance for viewers who watch without sound" },
  { key: "fastUpload", label: "Fast Upload", desc: "Pre-queue videos to upload to ad account when media is loaded" },
  { key: "launchAsPaused", label: "Launch Ads as Paused", desc: "Create ads in paused state as default (instead of active)" },
  { key: "oneAdPerAdset", label: "Launch 1 ad per adset (Special Ad Testing)", desc: "Enable special ad testing features. This will be visible as a toggle on the launch page after an ad set is selected" },
  { key: "launchAsPostId", label: "Launch ads as POST_ID when launched", desc: "Use POST_ID when recreating ads" },
  { key: "trackingSpecs", label: "Tracking Specs", desc: "Enable tracking specs to monitor both website events and app installs" },
]

function SettingsModal({
  open, onClose, adAccountId, adAccountName, orgName,
}: {
  open: boolean
  onClose: () => void
  adAccountId: string
  adAccountName: string
  orgName: string
}) {
  const STORAGE_KEY = `default_ad_settings_${adAccountId}`
  const [activeTab, setActiveTab] = useState<"naming" | "enhancements" | "launch" | "adCopy" | "links">("naming")
  const [settings, setSettings] = useState<DefaultAdSettings>(DEFAULT_SETTINGS)
  const [originalSettings, setOriginalSettings] = useState<DefaultAdSettings>(DEFAULT_SETTINGS)
  const [launchSearch, setLaunchSearch] = useState("")
  const [customTextDialogOpen, setCustomTextDialogOpen] = useState(false)
  const [newCustomText, setNewCustomText] = useState("")

  // Load on open
  useEffect(() => {
    if (!open) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      const loaded = saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS
      setSettings(loaded)
      setOriginalSettings(loaded)
      setActiveTab("naming")
    } catch {
      setSettings(DEFAULT_SETTINGS)
      setOriginalSettings(DEFAULT_SETTINGS)
    }
  }, [open, adAccountId])

  const updateNaming = (patch: Partial<NamingConvention>) =>
    setSettings(s => ({ ...s, naming: { ...s.naming, ...patch } }))
  const updateOptions = (patch: Partial<NamingConvention["options"]>) =>
    setSettings(s => ({ ...s, naming: { ...s.naming, options: { ...s.naming.options, ...patch } } }))

  const addTag = (tag: string) => updateNaming({ tags: [...settings.naming.tags, tag] })
  const removeTag = (idx: number) => updateNaming({ tags: settings.naming.tags.filter((_, i) => i !== idx) })

  // Live preview of naming convention
  const previewName = settings.naming.tags.length === 0
    ? "(empty)"
    : settings.naming.tags.map((t, i) => {
        if (t === "filename") return i === 0 ? "newHookAd" : "hookAd"
        if (t === "creator") return "Tuan"
        if (t === "id") return "12345"
        if (t === "counter") return "001"
        if (t === "dimensions") return "1080x1920"
        if (t === "filetype") return "mp4"
        if (t === "creativeType") return "VID"
        if (t === "landingPage") return "Protocol"
        if (t === "webLink") return "wellnessnest"
        if (t === "adSetName") return "AdSet1"
        if (t === "campaignName") return "Campaign1"
        if (t === "aiName") return "Hero-Style"
        if (t === "pageName") return "Magnali"
        return t
      }).join(SEPARATORS.find(s => s.value === settings.naming.separator)?.char || "")

  const handleSave = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch {}
    setOriginalSettings(settings)
    onClose()
  }
  const resetDefaults = () => {
    if (confirm("Reset Naming Convention to defaults?")) {
      updateNaming(DEFAULT_SETTINGS.naming)
    }
  }

  const TABS = [
    { key: "naming" as const, label: "Naming Convention" },
    { key: "enhancements" as const, label: "Creative Enhancements" },
    { key: "launch" as const, label: "Launch Settings" },
    { key: "adCopy" as const, label: "Ad Copy Defaults" },
    { key: "links" as const, label: "Web & App Links" },
  ]

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="text-base font-bold">Default Ad Settings: {adAccountName}</DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Manage naming convention, creative enhancements, launch settings, ad copy defaults, and web/app links</p>
          <p className="text-[11px] text-muted-foreground/70 font-mono mt-1">Business ID: {adAccountId} | Workspace: {orgName}</p>
        </div>

        {/* Body: sidebar + content */}
        <div className="grid grid-cols-[200px_1fr] flex-1 min-h-0 overflow-hidden">
          {/* Sidebar */}
          <div className="border-r overflow-y-auto py-3">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  "w-full text-left px-4 py-2.5 text-sm transition-colors",
                  activeTab === t.key ? "bg-muted/60 font-bold border-l-2 border-primary" : "text-muted-foreground hover:bg-muted/30"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="overflow-y-auto p-5">
            {/* TAB: NAMING CONVENTION */}
            {activeTab === "naming" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-base font-bold">Naming Convention</h3>
                    <IconInfoCircle className="size-3.5 text-muted-foreground" />
                  </div>
                  <button onClick={resetDefaults} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <IconRefresh className="size-3" />Reset Defaults
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="border rounded-xl p-3">
                    <p className="text-sm font-bold mb-2">Your Convention</p>
                    <div className="border rounded-lg px-2 py-2 bg-muted/20 min-h-[44px] flex flex-wrap items-center gap-1">
                      {settings.naming.tags.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic px-2">Click tags below to build...</span>
                      ) : settings.naming.tags.map((t, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background border text-xs font-mono">
                          <IconArrowLeft className="size-2.5 opacity-30" />
                          {`{{${t}}}`}
                          <button onClick={() => removeTag(i)} className="hover:text-destructive ml-0.5">
                            <IconX className="size-2.5" />
                          </button>
                          <IconArrowRight className="size-2.5 opacity-30" />
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="border rounded-xl p-3">
                    <div className="flex items-center gap-1 mb-2">
                      <p className="text-sm font-bold">Preview</p>
                      <IconInfoCircle className="size-3.5 text-muted-foreground" />
                    </div>
                    <div className="border rounded-lg px-3 py-2 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 text-sm font-mono text-emerald-800 dark:text-emerald-300 min-h-[44px] flex items-center break-all">
                      {previewName}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_280px] gap-4">
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        <p className="text-sm font-bold">Dynamic Tags</p>
                        <IconInfoCircle className="size-3 text-muted-foreground" />
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {DYNAMIC_TAGS.map(t => (
                          <button
                            key={t}
                            onClick={() => addTag(t)}
                            className={cn(
                              "px-2 py-1.5 text-[11px] font-mono border rounded-md hover:bg-muted/40 transition-colors",
                              AI_NAME_TAGS.includes(t) && "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/30 dark:border-purple-900"
                            )}
                          >
                            {AI_NAME_TAGS.includes(t) && "✨ "}{`{{${t}}}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-1 mb-1.5">
                        <p className="text-sm font-bold">Date Format</p>
                        <IconInfoCircle className="size-3 text-muted-foreground" />
                      </div>
                      <div className="flex gap-2">
                        <Select value={settings.naming.dateFormat} onValueChange={v => updateNaming({ dateFormat: v })}>
                          <SelectTrigger className="h-9 text-sm bg-background flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {DATE_FORMATS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                            <SelectItem value="custom">Custom...</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="icon" className="size-9" onClick={() => addTag("date")}>
                          <IconPlus className="size-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-1 mb-1.5">
                        <p className="text-sm font-bold">Custom Text</p>
                        <IconInfoCircle className="size-3 text-muted-foreground" />
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={newCustomText}
                          onChange={e => setNewCustomText(e.target.value)}
                          placeholder="Enter text..."
                          className="flex-1 px-3 py-1.5 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                        />
                        <Button size="icon" className="size-9" onClick={() => {
                          if (newCustomText.trim()) {
                            updateNaming({ customTexts: [...settings.naming.customTexts, { name: newCustomText, value: newCustomText }] })
                            setNewCustomText("")
                          }
                        }}>
                          <IconPlus className="size-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="size-9" onClick={() => setCustomTextDialogOpen(true)}>
                          <IconChevronDown className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="border rounded-xl p-3 space-y-3">
                    <p className="text-sm font-bold">Options</p>
                    {([
                      ["removeDimensions", "Remove dimensions"],
                      ["preserveUnderscores", "Preserve underscores and tildes"],
                      ["useStaticForImages", 'Use "Static" for images'],
                      ["extendedIdFormat", "Extended ID format (X.YYY)"],
                      ["spacesAroundSeparator", "Spaces around separator"],
                    ] as const).map(([key, label]) => (
                      <div key={key} className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium">{label}</span>
                          <IconInfoCircle className="size-3 text-muted-foreground" />
                        </div>
                        <button
                          onClick={() => updateOptions({ [key]: !settings.naming.options[key] } as any)}
                          className={cn("relative inline-flex h-5 w-9 items-center rounded-full shrink-0",
                            settings.naming.options[key] ? "bg-primary" : "bg-muted-foreground/30")}
                        >
                          <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                            settings.naming.options[key] ? "translate-x-4" : "translate-x-0.5")} />
                        </button>
                      </div>
                    ))}

                    <div>
                      <p className="text-xs font-medium mb-1">Separator</p>
                      <Select value={settings.naming.separator} onValueChange={v => updateNaming({ separator: v })}>
                        <SelectTrigger className="h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SEPARATORS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold">✨ AI Name</span>
                          <IconInfoCircle className="size-3 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="border rounded-lg p-2 bg-muted/20">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-medium text-muted-foreground">Current Schema</span>
                          <button className="text-[10px] text-primary hover:underline">Edit →</button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {settings.naming.aiNameSchema.map(s => (
                            <span key={s} className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 rounded">{s}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: CREATIVE ENHANCEMENTS */}
            {activeTab === "enhancements" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-xl">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold">Meta <span className="text-blue-600">Creative Enhancements</span></span>
                    <IconInfoCircle className="size-3.5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground italic">Toggle all enhancements on/off</span>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, enhancements: { ...s.enhancements, metaCreativeEnhancements: !s.enhancements.metaCreativeEnhancements } }))}
                    className={cn("relative inline-flex h-5 w-9 items-center rounded-full",
                      settings.enhancements.metaCreativeEnhancements ? "bg-primary" : "bg-muted-foreground/30")}
                  >
                    <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                      settings.enhancements.metaCreativeEnhancements ? "translate-x-4" : "translate-x-0.5")} />
                  </button>
                </div>

                <div className="flex items-start justify-between p-3 border rounded-xl">
                  <div>
                    <p className="text-sm font-medium">Optimise text per person</p>
                    <p className="text-[11px] text-muted-foreground">Independent of individual creative enhancement switches; maps to the same setting the launcher sends to Meta</p>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, enhancements: { ...s.enhancements, optimiseTextPerPerson: !s.enhancements.optimiseTextPerPerson } }))}
                    className={cn("relative inline-flex h-5 w-9 items-center rounded-full shrink-0",
                      settings.enhancements.optimiseTextPerPerson ? "bg-primary" : "bg-muted-foreground/30")}
                  >
                    <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                      settings.enhancements.optimiseTextPerPerson ? "translate-x-4" : "translate-x-0.5")} />
                  </button>
                </div>

                <p className="text-[11px] text-muted-foreground italic">Standard enhancements are deprecated in Marketing API v22.0. Use individual Advantage+ Creative features instead.</p>

                <div className="grid grid-cols-3 gap-4">
                  {(["images", "videos", "carousel"] as const).map(group => (
                    <div key={group} className="border rounded-xl p-4">
                      <p className="text-base font-bold capitalize mb-3 flex items-center gap-2">
                        {group === "images" ? <IconPhoto className="size-4" /> : group === "videos" ? <IconVideo className="size-4" /> : <IconLayout className="size-4" />}
                        {group}
                      </p>
                      <div className="space-y-2.5">
                        {ENHANCEMENT_LABELS[group].map(([key, label]) => (
                          <div key={key} className="flex items-center justify-between gap-3">
                            <span className="text-xs flex items-center gap-1 leading-snug">
                              {label}
                              <IconInfoCircle className="size-3 text-muted-foreground/50 shrink-0" />
                            </span>
                            <button
                              onClick={() => setSettings(s => ({
                                ...s,
                                enhancements: { ...s.enhancements, [group]: { ...s.enhancements[group], [key]: !s.enhancements[group][key] } },
                              }))}
                              className={cn("relative inline-flex h-5 w-9 items-center rounded-full shrink-0 transition-colors",
                                settings.enhancements[group][key] ? "bg-primary" : "bg-muted-foreground/30")}
                            >
                              <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                                settings.enhancements[group][key] ? "translate-x-4" : "translate-x-0.5")} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <details className="mt-3">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                          <IconChevronDown className="size-3" />Deprecated Fields
                        </summary>
                        <p className="text-[11px] text-muted-foreground italic mt-1.5 pl-4">Legacy fields no longer needed in v22.0+</p>
                      </details>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: LAUNCH SETTINGS */}
            {activeTab === "launch" && (
              <div className="space-y-3">
                <h3 className="text-base font-bold">Launch Settings</h3>
                <div className="relative">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                  <input
                    value={launchSearch}
                    onChange={e => setLaunchSearch(e.target.value)}
                    placeholder="Search settings..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1">
                  {LAUNCH_SETTING_DEFS.filter(s => !launchSearch || s.label.toLowerCase().includes(launchSearch.toLowerCase()) || s.desc.toLowerCase().includes(launchSearch.toLowerCase())).map(def => (
                    <div key={def.key} className="flex items-start justify-between gap-3 p-3 border rounded-lg hover:bg-muted/20">
                      <div className="flex-1">
                        <p className="text-sm font-medium flex items-center gap-1">{def.label} <IconInfoCircle className="size-3 text-muted-foreground" /></p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{def.desc}</p>
                      </div>
                      <button
                        onClick={() => setSettings(s => ({ ...s, launch: { ...s.launch, [def.key]: !s.launch[def.key] } }))}
                        className={cn("relative inline-flex h-5 w-9 items-center rounded-full shrink-0 mt-0.5",
                          settings.launch[def.key] ? "bg-primary" : "bg-muted-foreground/30")}
                      >
                        <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                          settings.launch[def.key] ? "translate-x-4" : "translate-x-0.5")} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: AD COPY DEFAULTS */}
            {activeTab === "adCopy" && (
              <div className="space-y-4">
                <h3 className="text-base font-bold">Default Ad Copy</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <label className="text-sm font-bold">Primary Text</label>
                      <IconInfoCircle className="size-3 text-muted-foreground" />
                    </div>
                    <textarea
                      value={settings.adCopy.primaryText}
                      onChange={e => setSettings(s => ({ ...s, adCopy: { ...s.adCopy, primaryText: e.target.value } }))}
                      rows={5}
                      placeholder="Enter your default primary text..."
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring resize-none"
                    />
                    <button className="mt-1 text-xs text-primary hover:underline flex items-center gap-1">
                      Show Variations <IconPlus className="size-3 rounded-full border border-primary" />
                    </button>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <label className="text-sm font-bold">Headline</label>
                      <IconInfoCircle className="size-3 text-muted-foreground" />
                    </div>
                    <input
                      value={settings.adCopy.headline}
                      onChange={e => setSettings(s => ({ ...s, adCopy: { ...s.adCopy, headline: e.target.value } }))}
                      placeholder="Enter default headline..."
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button className="mt-1 text-xs text-primary hover:underline flex items-center gap-1">
                      Show Variations <IconPlus className="size-3 rounded-full border border-primary" />
                    </button>
                  </div>
                  <div>
                    <label className="text-sm font-bold block mb-1.5">Description</label>
                    <textarea
                      value={settings.adCopy.description}
                      onChange={e => setSettings(s => ({ ...s, adCopy: { ...s.adCopy, description: e.target.value } }))}
                      rows={3}
                      placeholder="Enter your ad description here"
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold block mb-1.5">Call To Action</label>
                    <Select value={settings.adCopy.cta} onValueChange={v => setSettings(s => ({ ...s, adCopy: { ...s.adCopy, cta: v } }))}>
                      <SelectTrigger className="h-9 text-sm bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CTA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: WEB & APP LINKS */}
            {activeTab === "links" && (
              <div className="space-y-4">
                <h3 className="text-base font-bold">Default Web & App Links</h3>
                <div className="grid grid-cols-2 gap-4">
                  {([
                    ["webLink", "Web Link", "https://..."],
                    ["displayLink", "Display Link", "Enter your display link here (e.g., example.com)"],
                    ["androidLink", "Android Link", "Enter your Android link here"],
                    ["iosAppStoreLink", "iOS App Store Link", "Enter your iOS App Store link here"],
                    ["appDeeplink", "App Deeplink (Android Only)", "Enter your Android deeplink here"],
                    ["customProductPage", "Custom Product Page", "Enter your custom product page ID"],
                  ] as const).map(([key, label, placeholder]) => (
                    <div key={key}>
                      <label className="text-sm font-bold block mb-1.5">{label}</label>
                      <input
                        value={settings.links[key]}
                        onChange={e => setSettings(s => ({ ...s, links: { ...s.links, [key]: e.target.value } }))}
                        placeholder={placeholder}
                        className="w-full px-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-bold">UTM Parameters</label>
                      <button className="text-xs text-primary hover:underline">Add recommended tags</button>
                    </div>
                    <textarea
                      value={settings.links.utmParameters}
                      onChange={e => setSettings(s => ({ ...s, links: { ...s.links, utmParameters: e.target.value } }))}
                      rows={3}
                      placeholder="Enter your UTM params i.e utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.name}} or select from suggestions"
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring resize-none font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t flex items-center justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>

        {/* Custom Text dialog */}
        {customTextDialogOpen && (
          <div className="absolute inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setCustomTextDialogOpen(false)}>
            <div className="bg-popover border rounded-xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold">Custom Text</h3>
                <button onClick={() => setCustomTextDialogOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <IconX className="size-4" />
                </button>
              </div>
              <div className="flex gap-2 mb-3">
                <input
                  value={newCustomText}
                  onChange={e => setNewCustomText(e.target.value)}
                  placeholder="New category name..."
                  className="flex-1 px-3 py-2 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                />
                <Button size="icon" onClick={() => {
                  if (newCustomText.trim()) {
                    updateNaming({ customTexts: [...settings.naming.customTexts, { name: newCustomText, value: newCustomText }] })
                    setNewCustomText("")
                  }
                }}>
                  <IconPlus className="size-4" />
                </Button>
              </div>
              {settings.naming.customTexts.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <p>No custom text saved yet.</p>
                  <p className="text-xs">Add your first one using the input above.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {settings.naming.customTexts.map((ct, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 border rounded-lg">
                      <span className="text-sm">{ct.name}</span>
                      <button onClick={() => updateNaming({ customTexts: settings.naming.customTexts.filter((_, j) => j !== i) })}>
                        <IconX className="size-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Ad Setup Panel ───────────────────────────────────────────────────────────

function AdSetupPanel({
  primaryTexts, setPrimaryTexts,
  headlines, setHeadlines,
  description, setDescription,
  cta, setCta,
  webLink, setWebLink,
  launchAsActive, setLaunchAsActive,
  adAccountId, adAccountName, orgName,
}: {
  primaryTexts: string[]; setPrimaryTexts: (v: string[]) => void
  headlines: string[]; setHeadlines: (v: string[]) => void
  description: string; setDescription: (v: string) => void
  cta: string; setCta: (v: string) => void
  webLink: string; setWebLink: (v: string) => void
  launchAsActive: boolean; setLaunchAsActive: (v: boolean) => void
  adAccountId: string
  adAccountName: string
  orgName: string
}) {
  const [showDesc, setShowDesc] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const updateText = (idx: number, val: string) => {
    const next = [...primaryTexts]; next[idx] = val; setPrimaryTexts(next)
  }
  const addText = () => setPrimaryTexts([...primaryTexts, ""])
  const removeText = (idx: number) => setPrimaryTexts(primaryTexts.filter((_, i) => i !== idx))

  const updateHeadline = (idx: number, val: string) => {
    const next = [...headlines]; next[idx] = val; setHeadlines(next)
  }
  const addHeadline = () => setHeadlines([...headlines, ""])
  const removeHeadline = (idx: number) => setHeadlines(headlines.filter((_, i) => i !== idx))

  return (
    <div className="border rounded-xl bg-card">
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        adAccountId={adAccountId}
        adAccountName={adAccountName}
        orgName={orgName}
      />
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold">Ad Setup</span>
          <span className="text-destructive text-xs font-bold">*</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setSettingsOpen(true)}>
            <IconSettings className="size-3" />Settings<IconChevronDown className="size-3" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
            <IconTextCaption className="size-3" />Load Copy
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Primary Texts */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Primary Text</label>
          {primaryTexts.map((text, idx) => (
            <div key={idx} className={cn("relative", idx > 0 && "mt-2")}>
              <textarea value={text} onChange={e => updateText(idx, e.target.value)}
                placeholder="Write your primary ad text..."
                rows={idx === 0 ? 4 : 2}
                className="w-full px-3 py-2.5 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring resize-none placeholder:text-muted-foreground/50 pr-8" />
              {primaryTexts.length > 1 && (
                <button onClick={() => removeText(idx)}
                  className="absolute top-2 right-2 text-muted-foreground/40 hover:text-destructive transition-colors">
                  <IconMinus className="size-3.5" />
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-3 mt-1.5">
            <button onClick={addText} className="text-xs text-primary hover:underline flex items-center gap-0.5">
              <IconPlus className="size-3" />Add more primary texts
              {primaryTexts.length > 1 && <span className="ml-1 text-muted-foreground">({primaryTexts.length - 1} additional)</span>}
            </button>
            <span className="text-muted-foreground/40">|</span>
            <button className="text-xs text-primary hover:underline">AI Variations</button>
          </div>
        </div>

        {/* Headlines */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Headline</label>
          {headlines.map((h, idx) => (
            <div key={idx} className={cn("relative", idx > 0 && "mt-2")}>
              <input type="text" value={h} onChange={e => updateHeadline(idx, e.target.value)}
                placeholder="Enter headline..." maxLength={125}
                className="w-full px-3 py-2.5 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 pr-20" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground/45">{h.length}/125</span>
                {headlines.length > 1 && (
                  <button onClick={() => removeHeadline(idx)} className="text-muted-foreground/40 hover:text-destructive transition-colors">
                    <IconMinus className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3 mt-1.5">
            <button onClick={addHeadline} className="text-xs text-primary hover:underline flex items-center gap-0.5">
              <IconPlus className="size-3" />Add more headlines
              {headlines.length > 1 && <span className="ml-1 text-muted-foreground">({headlines.length - 1} additional)</span>}
            </button>
          </div>
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <button onClick={() => setShowDesc(!showDesc)}
              className="text-xs text-primary hover:underline">
              {showDesc ? "— Hide description" : "+ Add description"}
            </button>
          </div>
          {showDesc && (
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Enter description (optional)..." rows={2}
              className="w-full px-3 py-2.5 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring resize-none placeholder:text-muted-foreground/50" />
          )}
        </div>

        {/* CTA + Active toggle */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Call to Action</label>
            <Select value={cta} onValueChange={setCta}>
              <SelectTrigger className="h-9 text-sm bg-muted/30"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CTA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Launch ads as</span>
            <button onClick={() => setLaunchAsActive(!launchAsActive)}
              className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                launchAsActive ? "bg-primary" : "bg-muted-foreground/30")}>
              <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                launchAsActive ? "translate-x-4" : "translate-x-0.5")} />
            </button>
            <span className="text-xs font-medium">{launchAsActive ? "Active" : "Paused"}</span>
          </div>
        </div>

        {/* Web Link */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Web Link</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <IconWorld className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
              <input type="url" value={webLink} onChange={e => setWebLink(e.target.value)}
                placeholder="https://..."
                className="w-full pl-8 pr-3 py-2.5 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50" />
            </div>
            <Button variant="outline" size="icon" className="size-9 shrink-0"><IconPlus className="size-3.5" /></Button>
          </div>
        </div>

        {/* Shop & Catalog */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Shop & Catalog Selector</label>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-9 text-xs text-muted-foreground">Select Storefront</Button>
            <Button variant="outline" size="sm" className="flex-1 h-9 text-xs text-muted-foreground">Select from Catalog</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Gallery Media Panel ──────────────────────────────────────────────────────

// ─── Upload Dock (floating progress panel) ────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`
}
function formatETA(seconds: number): string {
  if (!isFinite(seconds) || seconds < 1) return "—"
  if (seconds < 60) return `${Math.round(seconds)}s left`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s left`
}
function formatSpeed(bytesPerSec: number): string {
  if (!isFinite(bytesPerSec) || bytesPerSec < 1) return "—"
  return `${formatBytes(bytesPerSec)}/s`
}

function UploadDock({ uploads, onCancel, onClear, onClose }: {
  uploads: UploadItem[]
  onCancel: (id: string) => void
  onClear: () => void
  onClose: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [tab, setTab] = useState<"all" | "completed" | "cancelled">("all")

  const filtered = uploads.filter(u =>
    tab === "all" ? true : tab === "completed" ? u.status === "completed" : u.status === "cancelled"
  )
  const uploadingCount = uploads.filter(u => u.status === "uploading").length
  const totalEta = Math.max(...uploads.filter(u => u.status === "uploading").map(u => u.eta), 0)

  if (uploads.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] w-[380px] bg-popover border rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-background">
        <button onClick={() => setCollapsed(c => !c)} className="flex items-center gap-1.5 text-sm font-semibold hover:opacity-70">
          Uploads
          <IconChevronUp className={cn("size-3.5 text-muted-foreground transition-transform", collapsed && "rotate-180")} />
        </button>
        <div className="flex items-center gap-1">
          {uploads.every(u => u.status !== "uploading") && (
            <button onClick={onClear} className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5">
              Clear
            </button>
          )}
          <button onClick={onClose} className="size-6 flex items-center justify-center rounded hover:bg-muted/60">
            <IconX className="size-3.5" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-2 px-3 pt-2 border-b">
            {([
              { key: "all" as const, label: "All uploads" },
              { key: "completed" as const, label: "Completed" },
              { key: "cancelled" as const, label: "Cancelled" },
            ]).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn(
                  "px-3 py-1 text-xs rounded-full transition-colors mb-2",
                  tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
                )}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Status summary */}
          {uploadingCount > 0 && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-b">
              {uploadingCount} uploading
              {totalEta > 0 && <span> · About {formatETA(totalEta)}</span>}
            </div>
          )}

          {/* Items */}
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">No items in this view</div>
            ) : filtered.map(u => {
              const pct = u.fileSize > 0 ? Math.min(100, (u.uploaded / u.fileSize) * 100) : 0
              const isDone = u.status === "completed"
              const isError = u.status === "error"
              const isCancelled = u.status === "cancelled"
              return (
                <div key={u.id} className="px-4 py-2.5 border-b last:border-b-0">
                  <div className="flex items-start gap-2">
                    <div className={cn(
                      "size-2 rounded-full shrink-0 mt-1.5",
                      isDone ? "bg-green-500" :
                      isError ? "bg-red-500" :
                      isCancelled ? "bg-gray-400" :
                      "bg-blue-500 animate-pulse"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" title={u.filename}>{u.filename}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {u.fileTypeShort}
                        {" "}{formatBytes(u.uploaded)} / {formatBytes(u.fileSize)}
                        {u.status === "uploading" && (
                          <>
                            {" · "}{formatSpeed(u.speed)}
                            {" · "}{formatETA(u.eta)}
                          </>
                        )}
                        {isDone && " · Done"}
                        {isError && ` · ${u.error || "Error"}`}
                        {isCancelled && " · Cancelled"}
                      </p>
                      {!isDone && !isCancelled && !isError && (
                        <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                    {u.status === "uploading" ? (
                      <button onClick={() => onCancel(u.id)} className="text-muted-foreground hover:text-destructive shrink-0" title="Cancel">
                        <IconX className="size-3.5" />
                      </button>
                    ) : isDone ? (
                      <IconCircleCheck className="size-3.5 text-green-500 shrink-0" />
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}


function GalleryMediaPanel({ selectedCreatives, onOpenModal, onDeselect, onRemoveAll, onUploadFiles, uploading, uploadProgress, adNameOverrides, onAdNameChange }: {
  selectedCreatives: Creative[]; onOpenModal: () => void
  onDeselect: (id: string) => void; onRemoveAll: () => void
  onUploadFiles: (files: FileList | File[]) => void
  uploading: boolean
  uploadProgress: { done: number; total: number; current: string }
  adNameOverrides: Record<string, string>
  onAdNameChange: (id: string, name: string) => void
}) {
  const [editingNameId, setEditingNameId] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(e.target.files)
      e.target.value = ""
    }
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files: File[] = []
    if (e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i]
        if (item.kind === "file") {
          const f = item.getAsFile()
          if (f) files.push(f)
        }
      }
    } else {
      for (let i = 0; i < e.dataTransfer.files.length; i++) files.push(e.dataTransfer.files[i])
    }
    if (files.length > 0) onUploadFiles(files)
  }

  if (selectedCreatives.length === 0) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-10"
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileChange} />
        <input ref={folderInputRef} type="file" multiple className="hidden" onChange={handleFileChange} {...({ webkitdirectory: "", directory: "" } as any)} />

        {uploading ? (
          <>
            <IconLoader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Uploading {uploadProgress.done + 1}/{uploadProgress.total}...</p>
            <p className="text-xs text-muted-foreground truncate max-w-xs">{uploadProgress.current}</p>
          </>
        ) : (
          <>
            <div className="relative">
              <div className="size-14 rounded-2xl bg-background border flex items-center justify-center shadow-sm">
                <IconPhoto className="size-7 text-muted-foreground/30" />
              </div>
              <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                <span className="text-[10px] font-bold text-muted-foreground">0</span>
              </div>
            </div>
            <p className="text-sm font-medium text-foreground/70">No media assets selected</p>
            <Button onClick={onOpenModal} className="gap-2 px-6 rounded-full">
              <IconUpload className="size-4" />Load Media
              <span className="ml-0.5 text-primary-foreground/70">+</span>
            </Button>
            <div className="flex items-center gap-3 w-full max-w-[260px]">
              <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
              <span className="text-xs text-muted-foreground/50">or</span>
              <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
            </div>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "w-full max-w-[260px] border border-dashed rounded-2xl py-5 text-sm cursor-pointer transition-colors",
                dragOver
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground/60 hover:bg-muted/40 hover:text-muted-foreground"
              )}
            >
              {dragOver ? "Drop files here" : "Drag and drop to upload"}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-full" onClick={() => fileInputRef.current?.click()}>
                <IconUpload className="size-3.5" />Upload New
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-full" onClick={() => folderInputRef.current?.click()}>
                <IconFolder className="size-3.5" />Upload Folder
              </Button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn("flex-1 overflow-y-auto p-3 relative", dragOver && "ring-2 ring-primary ring-inset")}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileChange} />
      <input ref={folderInputRef} type="file" multiple className="hidden" onChange={handleFileChange} {...({ webkitdirectory: "", directory: "" } as any)} />
      {dragOver && (
        <div className="absolute inset-0 z-10 bg-primary/10 flex items-center justify-center pointer-events-none">
          <div className="bg-background border-2 border-dashed border-primary rounded-2xl px-6 py-4 text-sm font-semibold text-primary">
            Drop to upload
          </div>
        </div>
      )}
      {uploading && (
        <div className="mb-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-lg flex items-center gap-2 text-xs">
          <IconLoader2 className="size-3.5 animate-spin text-primary" />
          <span className="font-medium">Uploading {uploadProgress.done + 1}/{uploadProgress.total}:</span>
          <span className="text-muted-foreground truncate flex-1">{uploadProgress.current}</span>
        </div>
      )}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs text-muted-foreground font-medium">{selectedCreatives.length} ad{selectedCreatives.length !== 1 ? "s" : ""}</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => fileInputRef.current?.click()}>
            <IconUpload className="size-3" />Upload
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={onOpenModal}>
            <IconPlus className="size-3" />Add More
          </Button>
        </div>
      </div>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 160px))" }}
      >
        {selectedCreatives.map(c => {
          const thumb = c.media_type === "video" ? c.fb_thumbnail_url : (c.fb_image_url || c.file_url)
          const isReady = !!(c.fb_image_hash || c.fb_video_id)
          const isVideo = c.media_type === "video"
          const customName = adNameOverrides[c.id]
          const displayName = customName ?? c.file_name.replace(/\.[^/.]+$/, "")
          const duration = (c as any).duration as string | undefined
          const isEditing = editingNameId === c.id

          return (
            <div key={c.id} className="rounded-xl border bg-background shadow-sm overflow-hidden">
              {/* Media */}
              <div className="group relative aspect-[4/5] bg-muted overflow-hidden">
                {/* Red X always visible top-left */}
                <button
                  onClick={() => onDeselect(c.id)}
                  className="absolute top-2 left-2 z-10 size-5 rounded-md bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md"
                  title="Remove from ads"
                >
                  <IconX className="size-3" />
                </button>

                <CreativeCardMedia creative={c} className="w-full h-full object-cover" />

                {/* Play button overlay (video only) — fades on hover */}
                {isVideo && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity group-hover:opacity-0">
                    <div className="size-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                      <IconPlayerPlay className="size-5 text-foreground translate-x-0.5" />
                    </div>
                  </div>
                )}

                {/* Duration badge bottom-left for video */}
                {isVideo && duration && (
                  <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/70 text-white text-[10px] font-bold rounded">
                    {duration}
                  </div>
                )}

                {/* Not ready badge */}
                {!isReady && (
                  <div className="absolute bottom-2 right-2 text-[9px] text-white font-semibold bg-amber-500/90 px-1.5 py-0.5 rounded">
                    Not Uploaded
                  </div>
                )}
              </div>

              {/* Body — ad name */}
              <div className="p-2.5">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-[11px] font-semibold text-foreground">Ad Name</span>
                  <button
                    onClick={() => setEditingNameId(c.id)}
                    className="text-muted-foreground hover:text-foreground"
                    title="Rename"
                  >
                    <IconPencil className="size-2.5" />
                  </button>
                </div>
                {isEditing ? (
                  <input
                    autoFocus
                    value={displayName}
                    onChange={e => onAdNameChange(c.id, e.target.value)}
                    onBlur={() => setEditingNameId("")}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setEditingNameId("") }}
                    className="w-full text-xs bg-muted/30 border rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-ring"
                  />
                ) : (
                  <p className="text-xs text-foreground/80 line-clamp-2 break-all" title={displayName}>{displayName}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Launch Result Banner ─────────────────────────────────────────────────────

function LaunchResultBanner({ result, onDismiss }: { result: LaunchResult; onDismiss: () => void }) {
  const isSuccess = result.failed === 0
  const isPartial = result.created > 0 && result.failed > 0

  return (
    <div className={cn("mx-3 mb-3 rounded-xl border p-4",
      isSuccess ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" :
      isPartial ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800" :
      "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800")}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2.5">
          {isSuccess ? <IconCircleCheck className="size-5 text-green-600 shrink-0 mt-0.5" />
            : isPartial ? <IconAlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            : <IconAlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />}
          <div>
            <p className={cn("text-sm font-semibold",
              isSuccess ? "text-green-800 dark:text-green-300" :
              isPartial ? "text-amber-800 dark:text-amber-300" : "text-red-800 dark:text-red-300")}>
              {isSuccess ? `${result.created} ads launched successfully!` :
               isPartial ? `${result.created} ads created, ${result.failed} failed` : "Launch failed"}
              {result.durationMs > 0 && (
                <span className="ml-2 text-xs font-normal opacity-70">({formatDuration(result.durationMs)})</span>
              )}
            </p>
            {result.errors.slice(0, 3).map((e, i) => (
              <p key={i} className="text-xs text-muted-foreground mt-1 truncate max-w-xs">{e.fileName}: {e.error}</p>
            ))}
            {result.errors.length > 3 && (
              <p className="text-xs text-muted-foreground mt-0.5">...and {result.errors.length - 3} more errors</p>
            )}
          </div>
        </div>
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
          <IconX className="size-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Creative Thumbs Stack ────────────────────────────────────────────────────

function ThumbStack({ thumbs, count }: { thumbs: string[]; count: number }) {
  const shown = thumbs.slice(0, 2)
  const extra = count - shown.length

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((url, i) => (
        <div key={i} className="size-9 rounded-lg overflow-hidden border-2 border-background bg-muted shrink-0"
          style={{ zIndex: shown.length - i }}>
          <img src={url} alt="" className="w-full h-full object-cover" />
        </div>
      ))}
      {extra > 0 && (
        <div className="size-9 rounded-lg border-2 border-background bg-muted flex items-center justify-center shrink-0">
          <span className="text-[10px] font-semibold text-muted-foreground">+{extra}</span>
        </div>
      )}
      {shown.length === 0 && (
        <div className="size-9 rounded-lg bg-muted flex items-center justify-center">
          <IconPhoto className="size-4 text-muted-foreground/40" />
        </div>
      )}
    </div>
  )
}

// ─── User Avatar ──────────────────────────────────────────────────────────────

function UserAvatar({ name }: { name: string }) {
  const initials = name ? name.slice(0, 1).toUpperCase() : "?"
  const colors = ["bg-teal-500", "bg-blue-500", "bg-purple-500", "bg-orange-500", "bg-pink-500"]
  const color = colors[name.charCodeAt(0) % colors.length]

  return (
    <div className={cn("size-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0", color)}>
      {initials}
    </div>
  )
}

// ─── Launch History Section ───────────────────────────────────────────────────

function LaunchHistorySection({ reloadTrigger }: { reloadTrigger: number }) {
  const [tab, setTab] = useState<"launches" | "drafts" | "scheduled">("launches")
  const [batches, setBatches] = useState<LaunchBatch[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== "all") params.set("status", statusFilter)
    fetch(`/api/launch-history?${params}`)
      .then(r => r.json())
      .then(d => setBatches(d.batches || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load, reloadTrigger])

  const filtered = batches.filter(b => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      b.adset_names?.some(n => n.toLowerCase().includes(q)) ||
      b.ad_account_name?.toLowerCase().includes(q) ||
      b.user_name?.toLowerCase().includes(q)
    )
  })

  const TABS = [
    { key: "launches" as const, label: "Ad Launches", Icon: IconClock },
    { key: "drafts" as const, label: "Launch Drafts", Icon: IconPencil },
    { key: "scheduled" as const, label: "Scheduled Ads", Icon: IconCalendar },
  ]

  return (
    <div className="border-t flex flex-col">
      <div className="flex items-center border-b px-4 shrink-0 gap-0">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn("flex items-center gap-1.5 px-0 py-2.5 mr-6 text-sm border-b-2 transition-colors",
              tab === key ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <Icon className="size-3.5" />{label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 py-2">
          <div className="relative">
            <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/50" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by ad set, ad name or batch..."
              className="pl-7 pr-3 py-1.5 text-xs bg-muted/40 border rounded-lg outline-none focus:ring-1 focus:ring-ring w-52 placeholder:text-muted-foreground/50" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="h-7 px-2 text-xs border rounded-lg bg-background outline-none">
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="partial">Partial</option>
            <option value="failed">Failed</option>
          </select>
          <Button variant="ghost" size="icon" className="size-7" onClick={load}>
            <IconRefresh className={cn("size-3.5 text-muted-foreground", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Table header */}
      <div className="grid text-[10px] font-semibold text-muted-foreground/55 uppercase tracking-wide border-b px-4 py-1.5 shrink-0"
        style={{ gridTemplateColumns: "140px 1fr 1.2fr 50px 60px 1.4fr 100px 80px 80px 100px" }}>
        <span>CREATIVES</span>
        <span>ADSETS</span>
        <span>ACCOUNT</span>
        <span>ADS</span>
        <span>ADSETS</span>
        <span>DATE</span>
        <span>USER</span>
        <span>TIME</span>
        <span>STATUS</span>
        <span>ACTIONS</span>
      </div>

      <div>
        {tab !== "launches" ? (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground/50">
            {tab === "drafts" ? "No drafts saved" : "No scheduled ads"}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-10">
            <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground/50">
            No launches yet
          </div>
        ) : filtered.map(b => (
          <div key={b.id}
            className="grid items-center px-4 py-2 border-b text-sm hover:bg-muted/20 transition-colors"
            style={{ gridTemplateColumns: "140px 1fr 1.2fr 50px 60px 1.4fr 100px 80px 80px 100px" }}>

            {/* Creatives */}
            <ThumbStack thumbs={b.creative_thumbs || []} count={b.creative_ids?.length || 0} />

            {/* Ad Sets */}
            <span className="text-xs text-muted-foreground truncate pr-2">
              {b.adset_names?.slice(0, 2).join(", ")}
              {(b.adset_names?.length || 0) > 2 && ` +${(b.adset_names?.length || 0) - 2}`}
            </span>

            {/* Account */}
            <div className="flex items-center gap-1.5 min-w-0">
              <IconBrandMeta className="size-3.5 text-[#1877F2] shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{b.ad_account_name || b.ad_account_id}</span>
            </div>

            {/* Ads count */}
            <span className="text-xs font-medium">{b.total_ads}</span>

            {/* AdSets count */}
            <span className="text-xs font-medium">{b.adset_ids?.length || 0}</span>

            {/* Date */}
            <span className="text-xs text-muted-foreground">{formatDate(b.created_at)}</span>

            {/* User */}
            <div className="flex items-center gap-1.5">
              <UserAvatar name={b.user_name || "?"} />
              <span className="text-xs text-muted-foreground truncate">{b.user_name}</span>
            </div>

            {/* Time taken */}
            <span className="text-xs text-muted-foreground">
              {b.duration_ms ? formatDuration(b.duration_ms) : "—"}
            </span>

            {/* Status */}
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-semibold w-fit",
              b.status === "success" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
              b.status === "partial" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
              "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400")}>
              {b.status === "success" ? "Success" : b.status === "partial" ? "Partial" : "Failed"}
            </span>

            {/* Actions */}
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-0.5">
              View Details<IconExternalLink className="size-3 ml-0.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Table Mode ───────────────────────────────────────────────────────────────

function TableMode({ rows, adSets, onAddRow, onUpdateRow, onDeleteRow }: {
  rows: TableRow[]; adSets: AdSet[]
  onAddRow: () => void; onUpdateRow: (id: string, field: keyof TableRow, value: any) => void; onDeleteRow: (id: string) => void
}) {
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm border-collapse min-w-[1000px]">
        <thead>
          <tr className="border-b bg-muted/20 sticky top-0">
            <th className="w-8 px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">#</th>
            <th className="w-36 px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">CREATIVE</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">AD NAME</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">PRIMARY TEXT</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">HEADLINE</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">DESCRIPTION</th>
            <th className="w-48 px-3 py-2.5 text-left text-xs">
              <span className="font-semibold text-muted-foreground">AD SETS </span>
              <span className="text-destructive font-bold">REQUIRED</span>
            </th>
            <th className="w-8 px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} className="border-b hover:bg-muted/20 group">
              <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
              <td className="px-3 py-2">
                {row.creative ? (
                  <div className="flex items-center gap-2">
                    <div className="size-10 rounded overflow-hidden bg-muted shrink-0">
                      {(row.creative.fb_thumbnail_url || row.creative.fb_image_url || row.creative.file_url)
                        ? <img src={row.creative.media_type === "video" ? row.creative.fb_thumbnail_url! : (row.creative.fb_image_url || row.creative.file_url)} className="w-full h-full object-cover" alt="" />
                        : <div className="w-full h-full flex items-center justify-center"><IconPhoto className="size-4 text-muted-foreground/40" /></div>}
                    </div>
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-muted rounded">SINGLE</span>
                  </div>
                ) : (
                  <div className="size-10 rounded border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                    <IconPlus className="size-4 text-muted-foreground/40" />
                  </div>
                )}
              </td>
              <td className="px-3 py-2">
                <input value={row.adName} onChange={e => onUpdateRow(row.id, "adName", e.target.value)}
                  placeholder="Untitled" className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground/40 focus:bg-muted/30 rounded px-1 py-0.5" />
              </td>
              <td className="px-3 py-2">
                <textarea value={row.primaryText} onChange={e => onUpdateRow(row.id, "primaryText", e.target.value)}
                  placeholder="Primary text..." rows={2} className="w-full text-sm bg-transparent outline-none resize-none placeholder:text-muted-foreground/40 focus:bg-muted/30 rounded px-1 py-0.5" />
              </td>
              <td className="px-3 py-2">
                <input value={row.headline} onChange={e => onUpdateRow(row.id, "headline", e.target.value)}
                  placeholder="Headline..." className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground/40 focus:bg-muted/30 rounded px-1 py-0.5" />
              </td>
              <td className="px-3 py-2">
                <input value={row.description} onChange={e => onUpdateRow(row.id, "description", e.target.value)}
                  placeholder="Description..." className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground/40 focus:bg-muted/30 rounded px-1 py-0.5" />
              </td>
              <td className="px-3 py-2">
                <Select value={row.adSetIds[0] || ""} onValueChange={v => onUpdateRow(row.id, "adSetIds", [v])}>
                  <SelectTrigger className="h-8 text-xs bg-muted/30"><SelectValue placeholder="Select ad sets..." /></SelectTrigger>
                  <SelectContent>{adSets.map(a => <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </td>
              <td className="px-3 py-2">
                <button onClick={() => onDeleteRow(row.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                  <IconTrash className="size-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={onAddRow} className="flex items-center gap-1.5 px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 w-full transition-colors">
        <IconPlus className="size-3.5" />Add New Row
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LaunchPage() {
  const { selectedAccountId, selectedAccount, adAccounts, setSelectedAccountId } = useAdAccount()

  const [mode, setMode] = useState<"gallery" | "table">("gallery")

  const [pages, setPages] = useState<FacebookPage[]>([])
  const [selectedPageId, setSelectedPageId] = useState("")
  const [selectedIgPageId, setSelectedIgPageId] = useState("")
  const [igAccountCache, setIgAccountCache] = useState<Record<string, IgAccount[]>>({})
  const [adProfilesOpen, setAdProfilesOpen] = useState(false)

  // Lưu page/IG preference cho từng ad account
  const PAGE_PREFS_KEY = "launch_page_prefs"
  const getPagePrefs = (): Record<string, { pageId: string; igId: string }> => {
    try { return JSON.parse(localStorage.getItem(PAGE_PREFS_KEY) || "{}") } catch { return {} }
  }
  const savePagePref = (accountId: string, pageId: string, igId: string) => {
    const prefs = getPagePrefs()
    prefs[accountId] = { pageId, igId }
    localStorage.setItem(PAGE_PREFS_KEY, JSON.stringify(prefs))
  }

  const [selectedAdSets, setSelectedAdSets] = useState<AdSet[]>([])
  const [primaryTexts, setPrimaryTexts] = useState<string[]>([""])
  const [headlines, setHeadlines] = useState<string[]>([""])
  const [description, setDescription] = useState("")
  const [cta, setCta] = useState("LEARN_MORE")
  const [webLink, setWebLink] = useState("")
  const [launchAsActive, setLaunchAsActive] = useState(false)
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set())
  const [selectedCreatives, setSelectedCreatives] = useState<Creative[]>([])
  const [adNameOverrides, setAdNameOverrides] = useState<Record<string, string>>({})

  // ─── Persistence: save selected creative IDs per ad account in localStorage ───
  const SELECTION_KEY = "launch_selected_creatives"

  // Restore selection when ad account is set / changed
  useEffect(() => {
    if (!selectedAccountId) return
    try {
      const all = JSON.parse(localStorage.getItem(SELECTION_KEY) || "{}")
      const saved = all[selectedAccountId] as { ids: string[]; names: Record<string, string> } | undefined
      if (!saved || !saved.ids?.length) {
        setSelectedMediaIds(new Set())
        setSelectedCreatives([])
        setAdNameOverrides({})
        return
      }
      fetch(`/api/creatives?ad_account_id=${encodeURIComponent(selectedAccountId)}`)
        .then(r => r.json())
        .then(d => {
          const list: Creative[] = d.creatives || []
          const byId = new Map(list.map(c => [c.id, c]))
          const restored = saved.ids.map(id => byId.get(id)).filter(Boolean) as Creative[]
          setSelectedCreatives(restored)
          setSelectedMediaIds(new Set(restored.map(c => c.id)))
          setAdNameOverrides(saved.names || {})
        })
        .catch(() => {})
    } catch {}
  }, [selectedAccountId])

  // Continuous polling for missing thumbnails in selected creatives
  useEffect(() => {
    const pending = selectedCreatives.filter(c => 
      c.media_type === "video" && 
      c.fb_video_id && 
      !(c.fb_thumbnail_url && /^https?:/.test(c.fb_thumbnail_url)) &&
      !c.id.startsWith("temp_")
    )
    if (pending.length === 0) return

    const interval = setInterval(async () => {
      // Check first 3 pending to be polite
      const toCheck = pending.slice(0, 3)
      for (const c of toCheck) {
        try {
          const res = await fetch(`/api/creatives/${c.id}/thumbnail`, { method: "POST" })
          const data = await res.json()
          if (data.thumbnail_url || data.source_url) {
            setSelectedCreatives(prev => prev.map(x => 
              x.id === c.id 
                ? { 
                    ...x, 
                    fb_thumbnail_url: data.thumbnail_url || x.fb_thumbnail_url,
                    file_url: data.source_url || x.file_url || data.thumbnail_url
                  } 
                : x
            ))
          }
        } catch {}
      }
    }, 5000)
    
    return () => clearInterval(interval)
  }, [selectedCreatives])

  // Save selection whenever creatives or names change (debounced via effect cycle)
  useEffect(() => {
    if (!selectedAccountId) return
    try {
      const all = JSON.parse(localStorage.getItem(SELECTION_KEY) || "{}")
      // Only persist creatives that have a real DB ID (not temp_ blob previews)
      const realIds = selectedCreatives.filter(c => !c.id.startsWith("temp_") && !c.id.startsWith("existing_")).map(c => c.id)
      if (realIds.length === 0) {
        delete all[selectedAccountId]
      } else {
        all[selectedAccountId] = { ids: realIds, names: adNameOverrides }
      }
      localStorage.setItem(SELECTION_KEY, JSON.stringify(all))
    } catch {}
  }, [selectedAccountId, selectedCreatives, adNameOverrides])

  const [tableRows, setTableRows] = useState<TableRow[]>([
    { id: "1", creative: null, adName: "", primaryText: "", headline: "", description: "", adSetIds: [] }
  ])
  const [allAdSets, setAllAdSets] = useState<AdSet[]>([])

  const [mediaModalOpen, setMediaModalOpen] = useState(false)
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [partnershipModalOpen, setPartnershipModalOpen] = useState(false)
  const [partnership, setPartnership] = useState<PartnershipState>({
    enabled: false,
    partnerPageId: "",
    partnerIgId: "",
    displayMode: "both",
    partnerFirstInDisplay: false,
  })
  const [multilanguageOpen, setMultilanguageOpen] = useState(false)
  const [multilanguage, setMultilanguage] = useState<MultilanguageState>({
    enabled: false,
    defaultLanguage: "en_US",
    translations: [],
  })
  const [adFormatPopoverOpen, setAdFormatPopoverOpen] = useState(false)
  const [collectionModalOpen, setCollectionModalOpen] = useState(false)
  const [catalogModalOpen, setCatalogModalOpen] = useState(false)
  const [adFormat, setAdFormat] = useState<AdFormatState>({ type: "single" })
  const [collectionAds, setCollectionAds] = useState<CollectionAdsState>({
    enabled: false,
    catalogId: "", catalogName: "", catalogVertical: "",
    productSetId: "", productSetName: "",
    order: "dynamic",
    productHeadlineChips: ["product_name"],
    productDescriptionChips: ["current_price"],
    buttonLabel: "",
    destinationUrl: "",
  })
  const [catalogAds, setCatalogAds] = useState<CatalogAdsState>({
    enabled: false,
    formatMode: "automatic",
    format: "single",
    frameImageUrl: "",
    dynamicMedia: { optimizedMediaSelection: false, automaticVideoCropping: false, prioritizeVideo: false },
    catalogId: "", catalogName: "",
    productSetId: "", productSetName: "",
    hideAutoCreatedSets: false,
  })
  const [carouselModalOpen, setCarouselModalOpen] = useState(false)
  const [carouselAds, setCarouselAds] = useState<CarouselAdsState>({
    enabled: false,
    carousels: [],
  })
  const [flexibleModalOpen, setFlexibleModalOpen] = useState(false)
  const [flexibleAds, setFlexibleAds] = useState<FlexibleAdsState>({
    enabled: false,
    flexibleAds: [],
  })
  const [multiPlacementModalOpen, setMultiPlacementModalOpen] = useState(false)
  const [multiPlacementAds, setMultiPlacementAds] = useState<MultiPlacementAdsState>({
    enabled: false,
    manualPlacements: false,
    groups: [],
  })
  const adFormatRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (adFormatRef.current && !adFormatRef.current.contains(e.target as Node)) setAdFormatPopoverOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const [launching, setLaunching] = useState(false)
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null)
  const [historyReload, setHistoryReload] = useState(0)
  const [error, setError] = useState("")

  // Upload dock state — per-file progress tracking
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [uploadDockOpen, setUploadDockOpen] = useState(false)
  // Map from tempCreativeId → canvas thumbnail blob; uploaded to Supabase after video upload
  const pendingThumbBlobsRef = useRef<Map<string, Blob>>(new Map())

  const updateUpload = (id: string, patch: Partial<UploadItem>) => {
    setUploads(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u))
  }

  const cancelUpload = (id: string) => {
    setUploads(prev => prev.map(u => {
      if (u.id !== id) return u
      u.xhr?.abort()
      return { ...u, status: "cancelled", xhr: undefined }
    }))
  }
  const clearUploads = () => {
    setUploads(prev => prev.filter(u => u.status === "uploading"))
  }
  const closeUploadDock = () => {
    // Cancel all in-progress and clear
    uploads.forEach(u => u.xhr?.abort())
    setUploads([])
    setUploadDockOpen(false)
  }

  const uploadOneFile = (item: UploadItem): Promise<Creative | null> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()
      // Snapshot current form values so creative inherits them in DB → reusable later
      const currentPrimary = primaryTexts.find(t => t.trim()) || ""
      const currentHeadline = headlines.find(h => h.trim()) || ""
      const params = new URLSearchParams({
        filename: item.file.name,
        type: item.file.type,
        size: String(item.file.size),
        ad_account_id: selectedAccountId,
      })
      if (currentPrimary) params.set("primary_text", currentPrimary)
      if (currentHeadline) params.set("headline", currentHeadline)
      if (description) params.set("description", description)
      if (webLink) params.set("link_url", webLink)
      if (cta) params.set("cta", cta)
      xhr.open("POST", `/api/creatives/upload-binary?${params}`)
      xhr.setRequestHeader("Content-Type", item.file.type || "application/octet-stream")

      // Progress
      const startTime = Date.now()
      let lastTick = startTime
      let lastLoaded = 0
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return
        const now = Date.now()
        const dt = (now - lastTick) / 1000
        const dl = e.loaded - lastLoaded
        const speed = dt > 0 ? dl / dt : 0
        const remaining = e.total - e.loaded
        const eta = speed > 0 ? remaining / speed : 0
        lastTick = now
        lastLoaded = e.loaded
        updateUpload(item.id, { uploaded: e.loaded, fileSize: e.total, speed, eta })
      }

      xhr.onload = async () => {
        try {
          const data = JSON.parse(xhr.responseText || "{}")
          if (xhr.status >= 200 && xhr.status < 300 && data.creative) {
            const creative: Creative = data.creative
            updateUpload(item.id, { status: "completed", uploaded: item.fileSize, eta: 0, speed: 0, creativeId: creative.id })

            // For videos: poll Meta for HD thumbnail in background; upgrade local frame when ready
            if (creative.media_type === "video" && creative.fb_video_id) {
              ;(async () => {
                for (let attempt = 0; attempt < 6; attempt++) {
                  await new Promise(r => setTimeout(r, attempt === 0 ? 2000 : 4000))
                  try {
                    const tRes = await fetch(`/api/creatives/${creative.id}/thumbnail`, { method: "POST" })
                    const tData = await tRes.json()
                    if (tData.thumbnail_url || tData.source_url) {
                      // Upgrade by REAL creative id (swap already happened in handleUploadFiles)
                      setSelectedCreatives(prev => prev.map(c =>
                        c.id === creative.id
                          ? { 
                              ...c, 
                              fb_thumbnail_url: tData.thumbnail_url || c.fb_thumbnail_url,
                              file_url: tData.source_url || c.file_url || tData.thumbnail_url 
                            }
                          : c
                      ))
                      if (tData.thumbnail_url && tData.source_url) break
                    }
                  } catch {}
                }
              })()
            }
            resolve(creative)
          } else {
            updateUpload(item.id, { status: "error", error: data.error || `HTTP ${xhr.status}` })
            resolve(null)
          }
        } catch (e: any) {
          updateUpload(item.id, { status: "error", error: e.message })
          resolve(null)
        }
      }
      xhr.onerror = () => {
        updateUpload(item.id, { status: "error", error: "Network error" })
        resolve(null)
      }
      xhr.onabort = () => {
        updateUpload(item.id, { status: "cancelled" })
        resolve(null)
      }

      // Store XHR ref so cancel works
      updateUpload(item.id, { xhr })
      xhr.send(item.file)
    })
  }

  // Generate instant local preview (image objectURL OR video frame extracted via canvas)
  // Returns BOTH the blob URL (for instant display) AND the blob itself (to upload to storage)
  const generateLocalPreview = (file: File): Promise<{ thumb: string; blob?: Blob; duration?: string }> => {
    return new Promise((resolve) => {
      if (file.type.startsWith("image/")) {
        return resolve({ thumb: URL.createObjectURL(file), blob: file })
      }
      if (!file.type.startsWith("video/")) return resolve({ thumb: "" })

      const video = document.createElement("video")
      video.preload = "auto"
      video.muted = true
      video.playsInline = true
      video.style.position = "fixed"
      video.style.left = "-9999px"
      video.style.top = "0"
      video.style.width = "1px"
      video.style.height = "1px"
      video.style.opacity = "0"
      const url = URL.createObjectURL(file)
      video.src = url
      // Append to DOM — some browsers won't decode frames for off-DOM video
      document.body.appendChild(video)

      let duration = ""
      let captured = false
      const cleanup = () => {
        try { video.pause() } catch {}
        try { URL.revokeObjectURL(url) } catch {}
        try { document.body.removeChild(video) } catch {}
      }
      const finish = (thumb: string, blob?: Blob) => {
        if (captured) return
        captured = true
        cleanup()
        resolve({ thumb, blob, duration })
      }

      const timeoutId = setTimeout(() => finish(""), 15000)

      const captureFrame = () => {
        if (captured) return
        if (video.videoWidth === 0 || video.videoHeight === 0) return
        try {
          const canvas = document.createElement("canvas")
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext("2d")
          if (!ctx) return finish("")
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          canvas.toBlob(blob => {
            clearTimeout(timeoutId)
            if (blob) finish(URL.createObjectURL(blob), blob)
            else finish("")
          }, "image/jpeg", 0.9)
        } catch (e) {
          console.warn("[preview] drawImage failed:", e)
          clearTimeout(timeoutId)
          finish("")
        }
      }

      const captureWhenFrameReady = () => {
        const hasRVFC = "requestVideoFrameCallback" in video
        if (hasRVFC) {
          // Most reliable: wait for actually-rendered frame
          ;(video as any).requestVideoFrameCallback(() => {
            // Frame is decoded and rendered now — safe to drawImage
            captureFrame()
          })
        } else {
          // Older browser fallback — wait a bit then capture
          setTimeout(captureFrame, 200)
        }
      }

      video.addEventListener("loadedmetadata", () => {
        const d = video.duration
        if (isFinite(d) && d > 0) {
          const m = Math.floor(d / 60)
          const s = Math.floor(d % 60)
          duration = `${m}:${String(s).padStart(2, "0")}`
        }

        // Strategy: play() to actually decode frames, capture when first frame arrives, pause
        video.play().then(() => {
          captureWhenFrameReady()
          // Pause shortly after to avoid actually playing audio/wasting CPU
          setTimeout(() => { try { video.pause() } catch {} }, 300)
        }).catch(() => {
          // play() blocked — fallback to seek
          try { video.currentTime = Math.min(1, video.duration / 4 || 0) } catch {}
          // Try capture directly on seeked
          video.addEventListener("seeked", captureWhenFrameReady, { once: true })
        })
      }, { once: true })

      video.addEventListener("error", () => {
        clearTimeout(timeoutId)
        console.warn("[preview] video error", video.error)
        finish("")
      }, { once: true })

      // Trigger load
      video.load()
    })
  }

  const handleUploadFiles = async (filesIn: FileList | File[]) => {
    if (!selectedAccountId) { setError("Select an ad account first"); return }
    const files = Array.from(filesIn).filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"))
    if (files.length === 0) { setError("No valid image/video files selected"); return }
    setError("")
    setUploadDockOpen(true)

    // INSTANT preview strategy:
    // - Image: blob URL of file → renders in <img>
    // - Video: blob URL of file → renders in <video> tag (browser auto-shows poster frame)
    // Also kick off canvas frame extraction in background as a backup thumbnail
    const fileUrls = files.map(f => URL.createObjectURL(f))

    // Create temporary creatives — show in panel IMMEDIATELY (no waiting)
    const tempCreatives: Creative[] = files.map((file, i) => {
      const isVid = file.type.startsWith("video/")
      return {
        id: `temp_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        file_name: file.name,
        file_url: fileUrls[i],
        media_type: isVid ? "video" : "image",
        headline: "",
        primary_text: "",
        cta: "LEARN_MORE",
        link_url: "",
        fb_image_url: !isVid ? fileUrls[i] : undefined,
        fb_thumbnail_url: !isVid ? fileUrls[i] : undefined, // video thumb fills in async below
        created_at: new Date().toISOString(),
      } as Creative
    })

    setSelectedCreatives(prev => [...prev, ...tempCreatives])
    setSelectedMediaIds(prev => { const s = new Set(prev); tempCreatives.forEach(c => s.add(c.id)); return s })

    // Background: extract canvas thumbnail blob for videos (for instant local display)
    // Also stored to upload to Supabase Storage AFTER video upload completes
    // → permanent storage so future loads don't need Meta API calls
    const thumbBlobByTempId = new Map<string, Blob>()
    files.forEach((file, i) => {
      if (!file.type.startsWith("video/")) return
      const tempId = tempCreatives[i].id
      generateLocalPreview(file).then(p => {
        if (p.blob) thumbBlobByTempId.set(tempId, p.blob)
        if (p.thumb) {
          setSelectedCreatives(prev => prev.map(c => c.id === tempId
            ? { ...c, fb_thumbnail_url: p.thumb, ...(p.duration ? ({ duration: p.duration } as any) : {}) }
            : c
          ))
        }
      })
    })
    // Expose to swap logic below via outer closure
    pendingThumbBlobsRef.current = thumbBlobByTempId

    // Add items to dock with the temp ID for tracking
    const items: UploadItem[] = files.map((file, i) => ({
      id: tempCreatives[i].id,
      file,
      filename: file.name,
      fileSize: file.size,
      fileTypeShort: (file.name.split(".").pop() || file.type.split("/").pop() || "FILE").toUpperCase(),
      status: "uploading",
      uploaded: 0,
      speed: 0,
      eta: 0,
      startedAt: Date.now(),
    }))
    setUploads(prev => [...prev, ...items])

    // Upload sequentially in background; swap temp creative → real creative when done
    for (const item of items) {
      const real = await uploadOneFile(item)
      if (real) {
        // Swap temp → real, but ALWAYS keep local blob URL for instant preview
        setSelectedCreatives(prev => prev.map(c => {
          if (c.id !== item.id) return c
          const localBlob = c.file_url
          return {
            ...real,
            file_url: localBlob || real.fb_thumbnail_url || real.fb_image_url || "",
            fb_image_url: real.fb_image_url || c.fb_image_url,
            fb_thumbnail_url: real.fb_thumbnail_url || c.fb_thumbnail_url,
          }
        }))
        setSelectedMediaIds(prev => {
          const s = new Set(prev)
          s.delete(item.id)
          s.add(real.id)
          return s
        })

        // Upload canvas thumbnail blob to Supabase Storage (permanent, no Meta API needed)
        const thumbBlob = pendingThumbBlobsRef.current.get(item.id)
        if (thumbBlob && real.media_type === "video") {
          fetch(`/api/creatives/${real.id}/save-thumbnail`, {
            method: "POST",
            body: thumbBlob,
            headers: { "Content-Type": "image/jpeg" },
          })
            .then(r => r.json())
            .then(d => {
              if (d.thumbnail_url) {
                setSelectedCreatives(prev => prev.map(c => c.id === real.id
                  ? { ...c, fb_thumbnail_url: d.thumbnail_url, file_url: d.thumbnail_url }
                  : c
                ))
                console.log(`[thumbnail] Saved to Supabase: ${real.file_name}`)
              }
            })
            .catch(e => console.warn(`[thumbnail] Save failed for ${real.file_name}:`, e))
            .finally(() => pendingThumbBlobsRef.current.delete(item.id))
        }
        // Migrate ad name override to real ID
        setAdNameOverrides(prev => {
          if (!prev[item.id]) return prev
          const n = { ...prev }
          n[real.id] = n[item.id]
          delete n[item.id]
          return n
        })
      } else {
        // Failed → remove the temp creative
        setSelectedCreatives(prev => prev.filter(c => c.id !== item.id))
        setSelectedMediaIds(prev => { const s = new Set(prev); s.delete(item.id); return s })
      }
    }
  }

  // Legacy props for GalleryMediaPanel — kept for backward compat (now empty)
  const uploading = uploads.some(u => u.status === "uploading")
  const uploadProgress = { done: 0, total: 0, current: "" }

  // Fetch pages 1 lần khi mount — cache 10 min in sessionStorage to avoid rate limits
  const [pagesError, setPagesError] = useState<string>("")
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const PAGES_CACHE_KEY = "fb_pages_cache"
  const PAGES_CACHE_TTL = 10 * 60 * 1000 // 10 minutes
  useEffect(() => {
    // Try cache first
    try {
      const cached = sessionStorage.getItem(PAGES_CACHE_KEY)
      if (cached) {
        const { ts, pages: cachedPages } = JSON.parse(cached)
        if (Date.now() - ts < PAGES_CACHE_TTL && Array.isArray(cachedPages)) {
          console.log(`[pages] Using cache (${cachedPages.length} pages)`)
          setPages(cachedPages)
          return
        }
      }
    } catch {}

    fetch("/api/facebook/pages")
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok || d.error) {
          console.error(`[pages] API ${r.status}:`, d.error || r.statusText)
          // Special handling for rate limit
          if (/request limit|rate limit|too many|#4/i.test(d.error || "")) {
            setPagesError("Facebook API rate limit reached. Please wait 5-10 minutes and refresh.")
          } else {
            setPagesError(d.error || `HTTP ${r.status}`)
          }
          if (d.needsReconnect) setNeedsReconnect(true)
          return
        }
        const p: FacebookPage[] = d.pages || []
        console.log(`[pages] Loaded ${p.length} pages`)
        setPages(p)
        // Cache for 10 min
        try { sessionStorage.setItem(PAGES_CACHE_KEY, JSON.stringify({ ts: Date.now(), pages: p })) } catch {}
        if (p.length === 0) {
          setPagesError("No Facebook pages found. Your account must be admin of at least one page.")
        }
      })
      .catch(e => {
        console.error("[pages] Fetch error:", e)
        setPagesError(e.message || "Failed to load pages")
      })
  }, [])

  // Khi pages load xong hoặc account đổi → apply saved pref cho account đó
  useEffect(() => {
    if (!selectedAccountId || pages.length === 0) return
    const pref = getPagePrefs()[selectedAccountId]
    const savedPage = pref && pages.find(pg => pg.id === pref.pageId)
    if (savedPage) {
      setSelectedPageId(savedPage.id)
      setSelectedIgPageId(pref.igId)
    } else {
      setSelectedPageId(pages[0].id)
      setSelectedIgPageId(`fb_${pages[0].id}`)
    }
  }, [selectedAccountId, pages])

  useEffect(() => {
    if (!selectedAccountId) return
    fetch(`/api/facebook/adsets?ad_account_id=${encodeURIComponent(selectedAccountId)}`)
      .then(r => r.json())
      .then(d => setAllAdSets(d.adSets || []))
      .catch(() => {})
  }, [selectedAccountId])

  // Poll for missing thumbnails/sources in selectedCreatives
  useEffect(() => {
    const videosMissingMeta = selectedCreatives.filter(c => 
      c.media_type === "video" && 
      c.fb_video_id && 
      (!c.fb_thumbnail_url || (!c.file_url?.startsWith("http") && !c.file_url?.startsWith("blob")))
    )
    
    videosMissingMeta.forEach(c => {
      let attempts = 0
      const poll = async () => {
        if (attempts >= 5) return
        try {
          const res = await fetch(`/api/creatives/${c.id}/thumbnail`, { method: "POST" })
          const data = await res.json()
          if (data.thumbnail_url || data.source_url) {
            setSelectedCreatives(prev => prev.map(x => 
              x.id === c.id ? { 
                ...x, 
                fb_thumbnail_url: data.thumbnail_url || x.fb_thumbnail_url,
                file_url: data.source_url || x.file_url || data.thumbnail_url
              } : x
            ))
            // If we got everything, stop. Else continue polling a few more times.
            if (data.thumbnail_url && data.source_url) return
          }
        } catch {}
        attempts++
        setTimeout(poll, 4000 * attempts)
      }
      poll()
    })
  }, [selectedCreatives.length]) // Only trigger when the count changes (e.g. added from library)

  const validate = () => {
    if (selectedAdSets.length === 0) { setError("Select at least one ad set"); return false }
    if (selectedMediaIds.size === 0) { setError("Select at least one media asset"); return false }
    if (!webLink.trim()) { setError("Web link (URL) is required"); return false }
    if (!/^https?:\/\//.test(webLink.trim())) { setError("URL must start with http:// or https://"); return false }
    if (!selectedPageId) { setError("Select a Facebook Page"); return false }
    setError("")
    return true
  }

  const doLaunch = async (scheduledTime?: string) => {
    if (!validate()) return
    setLaunching(true)
    setLaunchResult(null)
    try {
      const primaryText = primaryTexts.find(t => t.trim()) || ""
      const headline = headlines.find(h => h.trim()) || ""

      const res = await fetch("/api/facebook/launch-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adAccountId: selectedAccountId,
          adAccountName: selectedAccount?.name || selectedAccountId,
          adSetIds: selectedAdSets.map(a => a.id),
          adSetNames: selectedAdSets.map(a => a.name),
          creativeIds: Array.from(selectedMediaIds),
          pageId: selectedPageId,
          headline: headline.trim(),
          primaryText: primaryText.trim(),
          cta,
          webLink: webLink.trim(),
          createPaused: !launchAsActive,
          startTime: scheduledTime,
          partnerPageId: partnership.enabled && partnership.partnerPageId ? partnership.partnerPageId : undefined,
          partnershipDisplayMode: partnership.enabled && partnership.partnerPageId ? partnership.displayMode : undefined,
          multilanguage: multilanguage.enabled && multilanguage.translations.length > 0
            ? { defaultLanguage: multilanguage.defaultLanguage, translations: multilanguage.translations }
            : undefined,
          catalogAds: catalogAds.enabled && catalogAds.catalogId
            ? {
                catalogId: catalogAds.catalogId,
                productSetId: catalogAds.productSetId || undefined,
                formatMode: catalogAds.formatMode,
                format: catalogAds.format,
                frameImageUrl: catalogAds.frameImageUrl || undefined,
                dynamicMedia: catalogAds.dynamicMedia,
              }
            : undefined,
          carouselAds: carouselAds.enabled
            ? carouselAds.carousels.filter(c => c.cards.length >= 2).map(c => ({
                name: c.name,
                showAsCollectionTiles: c.showAsCollectionTiles,
                showAsSingleMedia: c.showAsSingleMedia,
                cards: c.cards.map(card => ({
                  creativeId: card.creativeId,
                  headline: card.headline || "",
                  description: card.description || "",
                  linkUrl: card.linkUrl || "",
                  cta: card.cta || "",
                })),
              }))
            : undefined,
          flexibleAds: flexibleAds.enabled
            ? flexibleAds.flexibleAds.filter(a => a.groups.some(g => g.creativeIds.length > 0)).map(a => ({
                name: a.name,
                groups: a.groups.filter(g => g.creativeIds.length > 0).map(g => ({ creativeIds: g.creativeIds })),
              }))
            : undefined,
          multiPlacementAds: multiPlacementAds.enabled
            ? {
                manualPlacements: multiPlacementAds.manualPlacements,
                groups: multiPlacementAds.groups
                  .filter(g => g.creativeIds.length >= 2)
                  .map(g => ({ name: g.name, creativeIds: g.creativeIds, placements: g.placements || {} })),
              }
            : undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) { setError(data.error || "Launch failed"); return }

      const result: LaunchResult = {
        created: data.created?.length ?? 0,
        failed: data.errors?.length ?? 0,
        durationMs: data.durationMs ?? 0,
        errors: data.errors || [],
      }
      setLaunchResult(result)
      setHistoryReload(n => n + 1)

      if (result.failed === 0) {
        setSelectedMediaIds(new Set())
        setSelectedCreatives([])
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLaunching(false)
    }
  }

  const addTableRow = () => {
    setTableRows(prev => [...prev, { id: String(Date.now()), creative: null, adName: "", primaryText: "", headline: "", description: "", adSetIds: [] }])
  }
  const updateTableRow = (id: string, field: keyof TableRow, value: any) => {
    setTableRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }
  const deleteTableRow = (id: string) => {
    setTableRows(prev => prev.filter(r => r.id !== id))
  }

  const selectedPage = pages.find(p => p.id === selectedPageId)

  return (
    <>
      <LoadMediaModal open={mediaModalOpen} onClose={() => setMediaModalOpen(false)}
        adAccountId={selectedAccountId} adAccounts={adAccounts} alreadySelected={selectedMediaIds}
        onConfirm={(ids, creatives) => {
          setSelectedMediaIds(new Set(ids))
          setSelectedCreatives(creatives)
          // Auto-fill empty form fields from first creative's saved metadata
          // (so preview & launch have proper text/CTA/URL when picking from Media Library)
          const first = creatives.find(c => c.headline || c.primary_text || c.link_url)
          if (first) {
            // Only fill fields that are currently empty
            if (!primaryTexts.some(t => t.trim()) && first.primary_text) {
              setPrimaryTexts([first.primary_text])
            }
            if (!headlines.some(h => h.trim()) && first.headline) {
              setHeadlines([first.headline])
            }
            if (!description && (first as any).description) {
              setDescription((first as any).description)
            }
            if (!webLink && first.link_url) {
              setWebLink(first.link_url)
            }
            if (cta === "LEARN_MORE" && first.cta && first.cta !== "LEARN_MORE") {
              setCta(first.cta)
            }
          }
        }} />
      <ScheduleModal open={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)}
        onConfirm={dt => doLaunch(dt)} />
      <AdProfilesModal
        open={adProfilesOpen}
        onClose={() => setAdProfilesOpen(false)}
        pages={pages}
        selectedPageId={selectedPageId}
        selectedIgId={selectedIgPageId}
        onConfirm={(pageId, igId, igCache) => {
          setSelectedPageId(pageId)
          setSelectedIgPageId(igId)
          setIgAccountCache(igCache)
          if (selectedAccountId) savePagePref(selectedAccountId, pageId, igId)
        }}
      />
      <PartnershipAdsModal
        open={partnershipModalOpen}
        onClose={() => setPartnershipModalOpen(false)}
        pages={pages}
        selectedPageId={selectedPageId}
        selectedIgId={selectedIgPageId}
        igAccountCache={igAccountCache}
        value={partnership}
        onConfirm={setPartnership}
      />
      <MultilanguageAdsModal
        open={multilanguageOpen}
        onClose={() => setMultilanguageOpen(false)}
        value={multilanguage}
        onConfirm={setMultilanguage}
        basePrimaryText={primaryTexts.find(t => t.trim()) || ""}
        baseHeadline={headlines.find(h => h.trim()) || ""}
        baseDescription={description}
      />
      <CollectionAdsModal
        open={collectionModalOpen}
        onClose={() => setCollectionModalOpen(false)}
        value={collectionAds}
        onConfirm={(v) => { setCollectionAds(v); setAdFormat({ type: v.enabled ? "collection" : "single" }) }}
        baseHeadline={headlines.find(h => h.trim()) || ""}
        baseWebLink={webLink}
        onLoadMedia={() => { setCollectionModalOpen(false); setMediaModalOpen(true) }}
        adAccountId={selectedAccountId}
      />
      <CatalogAdsModal
        open={catalogModalOpen}
        onClose={() => setCatalogModalOpen(false)}
        value={catalogAds}
        onConfirm={(v) => { setCatalogAds(v); setAdFormat({ type: v.enabled ? "catalog" : "single" }) }}
        adAccountId={selectedAccountId}
      />
      <CarouselAdsModal
        open={carouselModalOpen}
        onClose={() => setCarouselModalOpen(false)}
        value={carouselAds}
        onConfirm={setCarouselAds}
        availableCreatives={selectedCreatives}
        baseHeadline={headlines.find(h => h.trim()) || ""}
        baseLinkUrl={webLink}
        baseCta={cta}
      />
      <FlexibleAdsModal
        open={flexibleModalOpen}
        onClose={() => setFlexibleModalOpen(false)}
        value={flexibleAds}
        onConfirm={setFlexibleAds}
        availableCreatives={selectedCreatives}
      />
      <MultiPlacementAdsModal
        open={multiPlacementModalOpen}
        onClose={() => setMultiPlacementModalOpen(false)}
        value={multiPlacementAds}
        onConfirm={setMultiPlacementAds}
        availableCreatives={selectedCreatives}
      />

      {uploadDockOpen && (
        <UploadDock
          uploads={uploads}
          onCancel={cancelUpload}
          onClear={clearUploads}
          onClose={closeUploadDock}
        />
      )}

      <PreviewModal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        creatives={selectedCreatives}
        page={selectedPage}
        primaryText={primaryTexts.find(t => t.trim()) || ""}
        headline={headlines.find(h => h.trim()) || ""}
        webLink={webLink}
        cta={cta}
        adNameOverrides={adNameOverrides}
        onUpdateCreative={(c) => setSelectedCreatives(prev => prev.map(x => x.id === c.id ? c : x))}
      />

      <div className="flex flex-col">
        {/* ── Top bar ─────────────────────────────────────────────── */}
        <div className="flex items-end gap-4 px-4 pt-2 pb-2.5 border-b shrink-0 bg-background sticky top-0 z-10">

          {/* Ad Account custom dropdown */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground font-medium tracking-wide">Ad Account •</span>
              <PlatformStatusPopover />
            </div>
            <AdAccountDropdown
              accounts={adAccounts}
              selectedId={selectedAccountId}
              onSelect={setSelectedAccountId}
            />
          </div>

          {/* Divider */}
          <div className="w-px bg-border mb-1" style={{ height: 32 }} />

          {/* Facebook page pill → opens Ad Profiles modal */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <IconBrandFacebook className="size-3 text-[#1877F2]" />
              <span className="text-[10px] text-muted-foreground">Facebook</span>
              {pagesError && (
                needsReconnect ? (
                  <a href="/connect" className="text-[10px] text-red-600 hover:underline" title={pagesError}>
                    Reconnect ⚠
                  </a>
                ) : (
                  <span title={pagesError} className="text-[10px] text-amber-600 cursor-help">⚠</span>
                )
              )}
            </div>
            <button
              onClick={() => setAdProfilesOpen(true)}
              title={pagesError || (selectedPage?.name) || "Select Facebook page"}
              className={cn(
                "h-8 flex items-center gap-1.5 px-2.5 rounded-full border bg-background hover:bg-muted/40 transition-colors min-w-[140px] max-w-[200px]",
                pagesError && "border-amber-300"
              )}
            >
              {selectedPage?.picture?.data?.url ? (
                <img src={selectedPage.picture.data.url} className="size-5 rounded-full shrink-0 object-cover" alt="" />
              ) : (
                <div className="size-5 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-rose-400">{selectedPage?.name?.slice(0, 1) || "P"}</span>
                </div>
              )}
              <span className="text-sm truncate flex-1 text-left">
                {selectedPage?.name || (pagesError ? "No pages" : "Select page...")}
              </span>
              <IconChevronDown className="size-3.5 text-muted-foreground shrink-0" />
            </button>
          </div>

          {/* Instagram pill → same Ad Profiles modal */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <IconBrandInstagram className="size-3 text-[#E1306C]" />
              <span className="text-[10px] text-muted-foreground">Instagram</span>
            </div>
            <button
              onClick={() => setAdProfilesOpen(true)}
              className="h-8 flex items-center gap-1.5 px-2.5 rounded-full border bg-background hover:bg-muted/40 transition-colors min-w-[140px] max-w-[200px]"
            >
              {(() => {
                const isFbActor = selectedIgPageId.startsWith("fb_")
                if (isFbActor && selectedPage?.picture?.data?.url) {
                  return <img src={selectedPage.picture.data.url} className="size-5 rounded-full shrink-0 object-cover" alt="" />
                }
                const igAccount = Object.values(igAccountCache).flat().find(ig => ig.id === selectedIgPageId)
                if (igAccount?.profile_pic) {
                  return <img src={igAccount.profile_pic} className="size-5 rounded-full shrink-0 object-cover" alt="" />
                }
                return (
                  <div className="size-5 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-purple-400">I</span>
                  </div>
                )
              })()}
              <span className="text-sm truncate flex-1 text-left">
                {(() => {
                  const isFbActor = selectedIgPageId.startsWith("fb_")
                  if (isFbActor) return "Use Facebook Page"
                  const igAccount = Object.values(igAccountCache).flat().find(ig => ig.id === selectedIgPageId)
                  if (igAccount?.username) return `@${igAccount.username}`
                  if (selectedIgPageId) return selectedIgPageId
                  return "Select account..."
                })()}
              </span>
              <IconChevronDown className="size-3.5 text-muted-foreground shrink-0" />
            </button>
          </div>

          {/* Load Media */}
          <Button size="sm" className="gap-1.5 h-8" onClick={() => setMediaModalOpen(true)}>
            <IconUpload className="size-3.5" />
            Load Media
            {selectedMediaIds.size > 0 && (
              <span className="ml-0.5 bg-primary-foreground/20 text-primary-foreground text-[10px] px-1.5 rounded-full font-bold">
                {selectedMediaIds.size}
              </span>
            )}
          </Button>

          {/* Right: mode toggle */}
          <div className="ml-auto">
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"
              onClick={() => setMode(mode === "gallery" ? "table" : "gallery")}>
              {mode === "gallery"
                ? <><IconTable className="size-3.5" />Edit in Table Mode</>
                : <><IconLayoutGrid className="size-3.5" />Edit in Gallery Mode</>}
            </Button>
          </div>
        </div>

        {/* ── Main area ─────────────────────────────────────────── */}
        {mode === "gallery" ? (
          <div className="flex flex-col">
            <div className="flex" style={{ minHeight: 'calc(100vh - 80px)' }}>
            {/* Left panel */}
            <div className="w-[540px] shrink-0 flex flex-col gap-3 p-4 overflow-y-auto border-r" style={{ maxHeight: 'calc(100vh - 80px)' }}>
              <AdSetsPanel
                adAccountId={selectedAccountId}
                selectedAdSets={selectedAdSets}
                onSelect={a => setSelectedAdSets(prev => [...prev, a])}
                onRemove={id => setSelectedAdSets(prev => prev.filter(a => a.id !== id))}
              />
              <AdSetupPanel
                primaryTexts={primaryTexts} setPrimaryTexts={setPrimaryTexts}
                headlines={headlines} setHeadlines={setHeadlines}
                description={description} setDescription={setDescription}
                cta={cta} setCta={setCta}
                webLink={webLink} setWebLink={setWebLink}
                launchAsActive={launchAsActive} setLaunchAsActive={setLaunchAsActive}
                adAccountId={selectedAccountId}
                adAccountName={selectedAccount?.name || selectedAccountId}
                orgName="tuanquang269"
              />
            </div>

            {/* Right panel */}
            <div className="flex-1 flex flex-col min-w-0 border-l overflow-hidden" style={{ maxHeight: 'calc(100vh - 80px)' }}>
              <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
                <span className="text-sm font-semibold">Ads {selectedCreatives.length > 0 && <span className="text-muted-foreground font-normal">({selectedCreatives.length})</span>}</span>
                {selectedCreatives.length > 0 && (
                  <button
                    onClick={() => { setSelectedMediaIds(new Set()); setSelectedCreatives([]); setAdNameOverrides({}) }}
                    className="flex items-center justify-center size-5 rounded-md bg-red-500 hover:bg-red-600 transition-colors"
                    title="Clear all ads"
                  >
                    <IconX className="size-3 text-white" />
                  </button>
                )}
                <div className="ml-auto flex items-center gap-0.5">
                  {/* Partnership Ads */}
                  <button title="Partnership Ads" onClick={() => setPartnershipModalOpen(true)}
                    className={cn("size-7 flex items-center justify-center rounded hover:bg-muted/60 transition-colors relative",
                      partnership.enabled && !!partnership.partnerPageId ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")}>
                    <IconUsers className="size-4" />
                    {partnership.enabled && !!partnership.partnerPageId && <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />}
                  </button>

                  {/* Multilanguage */}
                  <button title="Multilanguage Ads" onClick={() => setMultilanguageOpen(true)}
                    className={cn("size-7 flex items-center justify-center rounded hover:bg-muted/60 transition-colors relative",
                      multilanguage.enabled && multilanguage.translations.length > 0 ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")}>
                    <IconLanguage className="size-4" />
                    {multilanguage.enabled && multilanguage.translations.length > 0 && <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />}
                  </button>

                  {/* Ad Format popover */}
                  <div ref={adFormatRef} className="relative">
                    <button title="Ad Format" onClick={() => setAdFormatPopoverOpen(o => !o)}
                      className={cn("size-7 flex items-center justify-center rounded hover:bg-muted/60 transition-colors relative",
                        adFormat.type !== "single" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")}>
                      <IconBuildingStore className="size-4" />
                      {adFormat.type !== "single" && <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />}
                    </button>
                    {adFormatPopoverOpen && (
                      <div className="absolute top-full right-0 mt-1.5 w-52 bg-popover border rounded-xl shadow-lg z-50 overflow-hidden p-1">
                        <button
                          onClick={() => { setAdFormatPopoverOpen(false); setCollectionModalOpen(true) }}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left",
                            adFormat.type === "collection" && "bg-primary/5"
                          )}
                        >
                          <IconShoppingBag className="size-4 text-muted-foreground" />
                          <span className="text-sm">Collection ads</span>
                          {adFormat.type === "collection" && <IconCheck className="size-3.5 text-primary ml-auto" />}
                        </button>
                        <button
                          onClick={() => { setAdFormatPopoverOpen(false); setCatalogModalOpen(true) }}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left",
                            adFormat.type === "catalog" && "bg-primary/5"
                          )}
                        >
                          <IconBox className="size-4 text-muted-foreground" />
                          <span className="text-sm">Catalog Ads</span>
                          {adFormat.type === "catalog" && <IconCheck className="size-3.5 text-primary ml-auto" />}
                        </button>
                        {adFormat.type !== "single" && (
                          <>
                            <div className="border-t my-1" />
                            <button
                              onClick={() => { setAdFormatPopoverOpen(false); setAdFormat({ type: "single" }) }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left text-muted-foreground"
                            >
                              <IconX className="size-3.5" />
                              <span className="text-sm">Reset to Single Image/Video</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Carousel Ads */}
                  <button title="Create Carousel Ads" onClick={() => setCarouselModalOpen(true)}
                    className={cn("size-7 flex items-center justify-center rounded hover:bg-muted/60 transition-colors relative",
                      carouselAds.enabled && carouselAds.carousels.some(c => c.cards.length >= 2) ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")}>
                    <IconLayout className="size-4" />
                    {carouselAds.enabled && carouselAds.carousels.some(c => c.cards.length >= 2) && <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />}
                  </button>

                  {/* Flexible Ads */}
                  <button title="Flexible Ads (Group Media)" onClick={() => setFlexibleModalOpen(true)}
                    className={cn("size-7 flex items-center justify-center rounded hover:bg-muted/60 transition-colors relative",
                      flexibleAds.enabled && flexibleAds.flexibleAds.length > 0 ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")}>
                    <IconStack2 className="size-4" />
                    {flexibleAds.enabled && flexibleAds.flexibleAds.length > 0 && <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />}
                  </button>

                  {/* Multi Placement Ads */}
                  <button title="Multi Placement Ads" onClick={() => setMultiPlacementModalOpen(true)}
                    className={cn("size-7 flex items-center justify-center rounded hover:bg-muted/60 transition-colors relative",
                      multiPlacementAds.enabled && multiPlacementAds.groups.length > 0 ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")}>
                    <IconLayoutGrid className="size-4" />
                    {multiPlacementAds.enabled && multiPlacementAds.groups.length > 0 && <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />}
                  </button>
                </div>
              </div>

              {launchResult && (
                <LaunchResultBanner result={launchResult} onDismiss={() => setLaunchResult(null)} />
              )}

              <GalleryMediaPanel
                selectedCreatives={selectedCreatives}
                onOpenModal={() => setMediaModalOpen(true)}
                onDeselect={id => {
                  setSelectedMediaIds(prev => { const s = new Set(prev); s.delete(id); return s })
                  setSelectedCreatives(prev => prev.filter(c => c.id !== id))
                  setAdNameOverrides(prev => { const n = { ...prev }; delete n[id]; return n })
                }}
                onRemoveAll={() => { setSelectedMediaIds(new Set()); setSelectedCreatives([]); setAdNameOverrides({}) }}
                onUploadFiles={handleUploadFiles}
                uploading={uploading}
                uploadProgress={uploadProgress}
                adNameOverrides={adNameOverrides}
                onAdNameChange={(id, name) => setAdNameOverrides(prev => ({ ...prev, [id]: name }))}
              />

              {error && (
                <div className="flex items-center gap-1.5 text-xs text-destructive px-4 pb-1">
                  <IconAlertCircle className="size-3.5 shrink-0" />{error}
                </div>
              )}

              <div className="flex items-center gap-2 px-4 py-3 border-t shrink-0">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setPreviewModalOpen(true)} disabled={selectedCreatives.length === 0}><IconEye className="size-3.5" />Preview</Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs"><IconBookmark className="size-3.5" />Save</Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                  onClick={() => { if (validate()) setScheduleModalOpen(true) }}>
                  <IconCalendar className="size-3.5" />Schedule
                </Button>
                <Button className="flex-1 gap-2 font-medium" onClick={() => doLaunch()} disabled={launching}>
                  {launching ? <IconLoader2 className="size-4 animate-spin" /> : <IconRocket className="size-4" />}
                  {launching ? "Launching..." : "Launch Ads"}
                </Button>
              </div>
            </div>
            </div>
            <LaunchHistorySection reloadTrigger={historyReload} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
              <span className="text-sm font-medium text-muted-foreground">Table ({tableRows.length} {tableRows.length === 1 ? "ad" : "ads"})</span>
              <Button variant="outline" size="sm" className="h-7 text-xs">CSV</Button>
              <div className="relative">
                <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/50" />
                <input placeholder="Search by ad name or copy..." className="pl-7 pr-3 py-1.5 text-xs bg-muted/40 border rounded-lg outline-none focus:ring-1 focus:ring-ring w-44 placeholder:text-muted-foreground/50" />
              </div>
              <div className="ml-auto flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">Bulk Edit <IconChevronDown className="size-3" /></Button>
              </div>
            </div>

            <TableMode rows={tableRows} adSets={allAdSets} onAddRow={addTableRow} onUpdateRow={updateTableRow} onDeleteRow={deleteTableRow} />

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-destructive px-4 py-1">
                <IconAlertCircle className="size-3.5" />{error}
              </div>
            )}

            <div className="flex items-center gap-2 px-4 py-3 border-t shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setPreviewModalOpen(true)} disabled={selectedCreatives.length === 0}><IconEye className="size-3.5" />Preview Ads</Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs"><IconBookmark className="size-3.5" />Save</Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setScheduleModalOpen(true)}>
                <IconCalendar className="size-3.5" />Schedule
              </Button>
              <Button className="flex-1 gap-2 font-medium" onClick={() => doLaunch()} disabled={launching}>
                {launching ? <IconLoader2 className="size-4 animate-spin" /> : <IconRocket className="size-4" />}
                {launching ? "Launching..." : "Launch Ads"}
              </Button>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
