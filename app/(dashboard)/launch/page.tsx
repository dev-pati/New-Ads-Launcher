"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
  IconChevronLeft, IconChevronRight,
  IconSparkles,
} from "@tabler/icons-react"
import { CreativeCardMedia } from "@/components/creative-card-media"
import { SheetsImportDialog, type ImportedRow } from "@/components/sheets-import-dialog"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdSet { id: string; name: string; status: string; effective_status: string; campaign_id: string; daily_budget?: string }
interface Creative { id: string; file_name: string; file_url: string; media_type: "image" | "video"; headline?: string; primary_text?: string; cta?: string; link_url?: string; fb_image_url?: string; fb_thumbnail_url?: string; fb_image_hash?: string; fb_video_id?: string; created_at?: string; transcript?: string; tags?: string[]; status?: "processing" | "ready" | "error" }
interface FbMediaItem { id: string; fb_id: string; name: string; media_type: "image" | "video"; duration?: number | null; width?: number; height?: number; dimensions?: string | null; date_added?: string; status?: string | null; thumbnail_url?: string; fb_video_id?: string; fb_image_hash?: string; fb_image_url?: string }
interface IgAccount { id: string; username?: string; profile_pic?: string }
interface FacebookPage { id: string; name: string; picture?: { data: { url: string } }; instagram_accounts?: { data: IgAccount[] } }
interface AdAccountItem { id: string; name: string; account_id?: string }
interface TableRow { id: string; creative: Creative | null; adName: string; primaryText: string; headline: string; description: string; adSetIds: string[]; primaryTextVariations?: string[]; headlineVariations?: string[]; descriptionVariations?: string[]; cta?: string; webLink?: string; urlTags?: string; promoCode?: string; launchAsActive?: boolean; pageId?: string; igId?: string }
interface CreatedAd { adId: string; adSetId: string; adSetName: string; creativeId?: string; fileName?: string; thumbnailUrl?: string | null; mediaType?: "image" | "video"; mode?: string; multiGroup?: string; flexibleAd?: string; carousel?: string }
interface LaunchMeta { cta: string; webLink: string; headline: string; primaryText: string; pageId: string; pageName?: string; adAccountId: string; adAccountName: string; timestamp: string }
interface LaunchResult { created: number; failed: number; durationMs: number; errors: { adSetId: string; fileName: string; error: string }[]; scheduled?: { at: string; end: string | null } | null; createdAds: CreatedAd[]; batchId?: string | null; launchMeta?: LaunchMeta }
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
  templateType: "storefront" | "lookbook" | "customer_acquisition"
  catalogId: string
  catalogName: string
  catalogVertical: string
  productSetId: string
  productSetName: string
  productCount: number
  order: "dynamic" | "specific"
  productHeadlineChips: string[]
  productDescriptionChips: string[]
  ieHeadline: string
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
  cta?: string
  web_link?: string
  page_id?: string
  status: "success" | "partial" | "failed"
  total_ads: number
  failed_ads: number
  duration_ms: number
  created_at: string
  errors: any[]
  created_ads?: CreatedAd[]
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

  // Check once on mount — polling every 5 min was hitting /api/facebook/ad-accounts too frequently
  useEffect(() => { checkStatus() }, [])

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

const IE_TEMPLATES: { value: CollectionAdsState["templateType"]; label: string; desc: string }[] = [
  { value: "storefront", label: "Instant Storefront", desc: "Shows catalog products in a scrollable grid. Best for e-commerce." },
  { value: "lookbook", label: "Instant Lookbook", desc: "Lifestyle images with product tags. Best for fashion & lifestyle brands." },
  { value: "customer_acquisition", label: "Customer Acquisition", desc: "Highlights key features with a sign-up form or website link." },
]

function CollectionAdsModal({
  open, onClose, value, onConfirm, baseWebLink, adAccountId,
}: {
  open: boolean
  onClose: () => void
  value: CollectionAdsState
  onConfirm: (v: CollectionAdsState) => void
  baseWebLink: string
  adAccountId?: string
}) {
  const [local, setLocal] = useState<CollectionAdsState>(value)
  const [saveError, setSaveError] = useState<string[]>([])
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

  useEffect(() => {
    if (open) {
      setSaveError([])
      setLocal({ ...value, destinationUrl: value.destinationUrl || baseWebLink || "" })
    }
  }, [open])

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
  if (!local.catalogId) requiredMissing.push("Chọn một catalog")
  if (!local.productSetId) requiredMissing.push("Chọn một product set")
  if (!local.destinationUrl.trim()) requiredMissing.push("Nhập Destination URL")
  const isValid = requiredMissing.length === 0

  const handleSave = () => {
    if (local.enabled && !isValid) {
      setSaveError(requiredMissing)
      return
    }
    setSaveError([])
    onConfirm({ ...local })
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
                  {/* IE Template selector */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-sm font-semibold">Instant Experience Template</p>
                      <IconInfoCircle className="size-3.5 text-muted-foreground" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {IE_TEMPLATES.map(t => (
                        <button
                          key={t.value}
                          onClick={() => setLocal(s => ({ ...s, templateType: t.value }))}
                          className={cn(
                            "border rounded-xl p-3 text-left transition-colors",
                            local.templateType === t.value
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "hover:border-muted-foreground/40"
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold">{t.label}</span>
                            {local.templateType === t.value && <IconCheck className="size-3.5 text-primary" />}
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-relaxed">{t.desc}</p>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      One instant experience will be created per media item. Cover media is taken from your selected creatives.
                    </p>
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
                                ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                                : <div className="w-full h-full flex items-center justify-center"><IconPhoto className="size-4 text-muted-foreground/40" /></div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Order + Product count + Cover media */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border rounded-xl p-3 space-y-3">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="text-sm font-semibold">Order</span>
                          <IconInfoCircle className="size-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {([
                            { value: "dynamic" as const, label: "Order dynamically" },
                            { value: "specific" as const, label: "Choose a specific order" },
                          ]).map(opt => (
                            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
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
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-xs font-medium">Number of products to show</span>
                          <IconInfoCircle className="size-3 text-muted-foreground" />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={local.productCount}
                            onChange={e => setLocal(s => ({ ...s, productCount: Math.min(50, Math.max(1, Number(e.target.value))) }))}
                            className="w-20 px-2 py-1.5 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring text-center"
                          />
                          <span className="text-xs text-muted-foreground">Max 50, default 4</span>
                        </div>
                      </div>
                    </div>
                    <div className="border-2 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl p-3 flex items-start gap-2">
                      <IconInfoCircle className="size-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold">Cover media</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Automatically uses your selected creatives as the instant experience cover. One IE is created per creative.
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

                  {/* IE Headline + Destination URL */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-xs font-medium">IE Headline</span>
                        <span className="text-muted-foreground text-[10px]">(optional)</span>
                        <IconInfoCircle className="size-3 text-muted-foreground" />
                      </div>
                      <input
                        value={local.ieHeadline}
                        onChange={e => setLocal(s => ({ ...s, ieHeadline: e.target.value }))}
                        placeholder="Headline shown inside the Instant Experience"
                        className="w-full px-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Shown at the top of the Instant Experience (separate from main ad headline)</p>
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
                        placeholder="https://..."
                        className={cn(
                          "w-full px-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring",
                          saveError.length > 0 && !local.destinationUrl.trim() && "border-destructive"
                        )}
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Landing page URL when users tap the "See more" button</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 px-5 py-3 border-t bg-background shrink-0">
          {saveError.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
              <p className="text-xs text-destructive font-medium mb-1">Vui lòng điền đầy đủ trước khi lưu:</p>
              {saveError.map((e, i) => <p key={i} className="text-xs text-destructive ml-2">• {e}</p>)}
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose}><IconX className="size-3.5 mr-1" />Cancel</Button>
            <Button onClick={handleSave}><IconCheck className="size-3.5 mr-1" />Save Confirm</Button>
          </div>
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
                              {thumb ? <img src={thumb} className="w-full h-full object-cover" alt="" onError={e => e.currentTarget.style.display="none"} />
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
  description?: string
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
  const duration = (creative as any).duration as string | undefined
  return (
    <div className={cn("relative bg-black group/media overflow-hidden", aspect, roundBottom && "rounded-b-xl")}>
      {thumb && (
        <img
          src={thumb}
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60 pointer-events-none"
          alt=""
          onError={e => e.currentTarget.style.display="none"}
        />
      )}
      <div className="relative w-full h-full z-10">
        <CreativeCardMedia creative={creative} className="w-full h-full object-contain bg-transparent" />
      </div>
      {/* Duration badge top-left (matches admanage.ai reference) */}
      {isVideo && duration && (
        <div className="absolute top-2 left-2 z-30 px-2 py-0.5 rounded-md bg-black/70 text-white text-[11px] font-semibold tracking-wide pointer-events-none">
          {duration}
        </div>
      )}
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
function MetaMockup({ page, creative, thumb, isVideo, primaryText, headline, description, webLink, ctaLabel, primaryExpanded, setPrimaryExpanded, placement }: MockupProps) {
  if (placement === "story") {
    return (
      <div className="w-full max-w-[300px] bg-black rounded-[20px] overflow-hidden shadow-xl relative" style={{ aspectRatio: "9/16" }}>
        {/* Progress bars */}
        <div className="absolute top-2 left-2 right-2 z-30 flex gap-1">
          {[0.4, 0, 0].map((fill, i) => (
            <div key={i} className="flex-1 h-[2px] bg-white/40 rounded-full overflow-hidden">
              {fill > 0 && <div className="h-full bg-white rounded-full" style={{ width: `${fill * 100}%` }} />}
            </div>
          ))}
        </div>
        {/* Header overlay */}
        <div className="absolute top-5 left-0 right-0 z-30 flex items-center gap-2 px-3">
          {page?.picture?.data?.url
            ? <img src={page.picture.data.url} className="size-8 rounded-full object-cover border-2 border-white shrink-0" alt="" />
            : <div className="size-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0 border-2 border-white"><span className="text-xs font-bold text-white">{(page?.name || "P").slice(0, 1)}</span></div>}
          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] font-semibold leading-tight truncate">{page?.name || "Your Page"}</p>
            <p className="text-white/70 text-[11px]">Sponsored</p>
          </div>
          <button className="text-white/90 p-1"><IconDotsVertical className="size-4" /></button>
          <button className="text-white/90 p-1"><IconX className="size-4" /></button>
        </div>
        {/* Media fills full */}
        <div className="absolute inset-0">
          <CreativeCardMedia creative={creative} className="w-full h-full object-cover" />
        </div>
        {/* Bottom gradient + text + CTA */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-3 pb-5 pt-14 bg-gradient-to-t from-black/75 to-transparent">
          {primaryText && (
            <div className="mb-2.5">
              <p className={cn("text-white text-[13px] leading-snug", primaryExpanded ? "" : "line-clamp-2")}>{primaryText}</p>
              {primaryText.length > 80 && (
                <button onClick={() => setPrimaryExpanded(!primaryExpanded)} className="text-white/60 text-[11px] flex items-center gap-0.5 mt-0.5">
                  {primaryExpanded ? <IconChevronDown className="size-3" /> : <IconChevronUp className="size-3" />}
                </button>
              )}
            </div>
          )}
          <button className="w-full bg-white text-black font-bold text-[14px] py-2.5 rounded-full">{ctaLabel}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[340px] bg-background border rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {page?.picture?.data?.url
          ? <img src={page.picture.data.url} className="size-9 rounded-full shrink-0 object-cover border" alt="" />
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
      <MediaArea thumb={thumb} creative={creative} isVideo={isVideo} aspect="aspect-square" />
      <div className="flex items-center justify-between px-3 py-2.5 bg-muted/30 border-t">
        <div className="flex-1 min-w-0">
          {headline
            ? <p className="text-[14px] font-semibold truncate leading-tight text-foreground/90">{headline}</p>
            : <p className="text-[14px] font-semibold truncate leading-tight text-muted-foreground/50 italic">No headline</p>}
          {description && <p className="text-[12px] text-[#65676B] truncate leading-tight mt-0.5">{description}</p>}
        </div>
        <Button size="sm" variant="outline" className="h-8 px-4 text-[13px] font-bold bg-[#E4E6EB] hover:bg-[#D8DADF] border-none text-[#050505] shrink-0 ml-3 rounded-lg">{ctaLabel}</Button>
      </div>
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
function InstagramMockup({ page, creative, thumb, isVideo, primaryText, ctaLabel, primaryExpanded, setPrimaryExpanded, placement }: MockupProps) {
  if (placement === "story") {
    return (
      <div className="w-full max-w-[300px] bg-black rounded-[20px] overflow-hidden shadow-xl relative" style={{ aspectRatio: "9/16" }}>
        {/* Progress bars */}
        <div className="absolute top-2 left-2 right-2 z-30 flex gap-1">
          {[0, 0.5, 0].map((fill, i) => (
            <div key={i} className="flex-1 h-[2px] bg-white/40 rounded-full overflow-hidden">
              {fill > 0 && <div className="h-full bg-white rounded-full" style={{ width: `${fill * 100}%` }} />}
            </div>
          ))}
        </div>
        {/* Header overlay */}
        <div className="absolute top-5 left-0 right-0 z-30 flex items-center gap-2 px-3">
          {page?.picture?.data?.url
            ? <div className="size-8 rounded-full overflow-hidden border-2 border-white shrink-0"><img src={page.picture.data.url} className="w-full h-full object-cover" alt="" /></div>
            : <div className="size-8 rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 p-[2px] shrink-0"><div className="size-full rounded-full bg-black/40 flex items-center justify-center text-white text-xs font-bold">{(page?.name || "P").slice(0, 1)}</div></div>}
          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] font-semibold leading-tight truncate">{page?.name || "Your Page"}</p>
            <p className="text-white/70 text-[11px]">Ad</p>
          </div>
          <button className="text-white/90 p-1"><IconDotsVertical className="size-4" /></button>
          <button className="text-white/90 p-1"><IconX className="size-4" /></button>
        </div>
        {/* Media */}
        <div className="absolute inset-0">
          <CreativeCardMedia creative={creative} className="w-full h-full object-cover" />
        </div>
        {/* Bottom */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-3 pb-5 pt-14 bg-gradient-to-t from-black/75 to-transparent">
          {primaryText && (
            <div className="mb-2.5">
              <p className={cn("text-white text-[13px] leading-snug", primaryExpanded ? "" : "line-clamp-2")}>{primaryText}</p>
              {primaryText.length > 80 && (
                <button onClick={() => setPrimaryExpanded(!primaryExpanded)} className="text-white/60 text-[11px] flex items-center gap-0.5 mt-0.5">
                  {primaryExpanded ? <IconChevronDown className="size-3" /> : <IconChevronUp className="size-3" />}
                </button>
              )}
            </div>
          )}
          <button className="w-full bg-white text-black font-bold text-[14px] py-2.5 rounded-full">{ctaLabel}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[340px] bg-background border rounded-xl overflow-hidden shadow-sm">
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
  open, onClose, creatives, page, primaryText, headline, description, webLink, cta, adNameOverrides, onUpdateCreative,
}: {
  open: boolean
  onClose: () => void
  creatives: Creative[]
  page?: FacebookPage
  primaryText: string
  headline: string
  description?: string
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
  // Clamp activeIdx whenever the creatives list shrinks
  useEffect(() => {
    if (activeIdx >= creatives.length && creatives.length > 0) setActiveIdx(0)
  }, [creatives.length, activeIdx])

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

  // Clamp activeIdx in case the creatives list shrank (e.g. user removed one)
  const safeIdx = Math.min(activeIdx, creatives.length - 1)
  const creative = creatives[safeIdx] ?? creatives[0]
  if (!creative) {
    return (
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-md p-6">
          <DialogTitle>Preview</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">No creative to preview.</p>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }
  const customName = adNameOverrides[creative.id]
  const adName = customName ?? creative.file_name.replace(/\.[^/.]+$/, "")
  const isVideo = creative.media_type === "video"
  const thumb = creative.fb_thumbnail_url || creative.fb_image_url || creative.file_url
  // Fallback to creative's saved metadata if main form fields are empty
  const effectivePrimaryText = primaryText
  const effectiveHeadline = headline
  const effectiveWebLink = webLink
  const effectiveCta = cta || "LEARN_MORE"
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
      <DialogContent className="max-w-5xl !h-[92vh] !max-h-[92vh] p-0 gap-0 overflow-hidden flex flex-row">
        {/* LEFT: Mockup area — scrolls independently, mockup centered */}
        <div className="flex-1 min-w-0 h-full overflow-y-auto bg-[#F0F2F5] dark:bg-zinc-900/60 flex flex-col items-center justify-center px-6 py-6">
          <div className="flex flex-col items-center gap-2 w-full max-w-[380px]">
            {/* Carousel nav for multiple ads */}
            {creatives.length > 1 && (
              <div className="flex items-center gap-2 self-start">
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
              description={description}
              webLink={effectiveWebLink}
              ctaLabel={ctaLabel}
              primaryExpanded={primaryExpanded}
              setPrimaryExpanded={setPrimaryExpanded}
            />
          </div>
        </div>

        {/* RIGHT: Details panel */}
        <div className="w-[340px] shrink-0 border-l flex flex-col overflow-hidden">
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

                  <div className="flex items-center justify-between px-3 py-2 border-b text-xs gap-2">
                    <span className="text-muted-foreground shrink-0">Thumbnail URL</span>
                    <div className="flex items-center gap-1 min-w-0">
                      <a href={thumb} target="_blank" rel="noopener noreferrer" title={thumb} className="text-primary hover:underline truncate max-w-[140px]">{thumb || "—"}</a>
                      <button onClick={refreshThumbnail} className={cn("text-muted-foreground hover:text-foreground shrink-0", refreshing && "animate-spin")}>
                        <IconRefresh className="size-3" />
                      </button>
                    </div>
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
                          {ct ? <img src={ct} alt="" className="w-full h-full object-cover" loading="lazy" /> :
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

// ─── Drive Link Tab ───────────────────────────────────────────────────────────

function DriveLinkTab({ gdriveToken, onRequestAuth, adAccountId, onImported }: {
  gdriveToken: string | null
  onRequestAuth: () => void
  adAccountId: string
  onImported: (creatives: Creative[]) => void
}) {
  const [links, setLinks] = useState("")
  const [includeSubfolders, setIncludeSubfolders] = useState(false)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<{ name: string; status: "done" | "error"; error?: string }[]>([])

  const extractFileId = (url: string): { id: string; type: "file" | "folder" } | null => {
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
    if (fileMatch) return { id: fileMatch[1], type: "file" }
    const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
    if (folderMatch) return { id: folderMatch[1], type: "folder" }
    return null
  }

  // List all media files in a folder, with pagination and optional recursion into subfolders
  const listFilesInFolder = async (folderId: string, recursive: boolean, token: string): Promise<{ id: string; name: string; mimeType: string }[]> => {
    const all: { id: string; name: string; mimeType: string }[] = []

    // Fetch all media files (paginated)
    let pageToken: string | undefined
    do {
      const q = encodeURIComponent(`'${folderId}' in parents and (mimeType contains 'image/' or mimeType contains 'video/') and trashed = false`)
      const qs = `q=${q}&fields=nextPageToken,files(id,name,mimeType)&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ""}`
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      all.push(...(data.files || []))
      pageToken = data.nextPageToken
    } while (pageToken)

    if (recursive) {
      // Fetch all subfolders (paginated)
      const subfolders: { id: string }[] = []
      let subPageToken: string | undefined
      do {
        const q = encodeURIComponent(`'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`)
        const qs = `q=${q}&fields=nextPageToken,files(id,name,mimeType)&pageSize=1000${subPageToken ? `&pageToken=${subPageToken}` : ""}`
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        subfolders.push(...(data.files || []))
        subPageToken = data.nextPageToken
      } while (subPageToken)

      // Recurse into each subfolder
      for (const sub of subfolders) {
        const subFiles = await listFilesInFolder(sub.id, true, token)
        all.push(...subFiles)
      }
    }

    return all
  }

  const handleViewContents = async () => {
    if (!gdriveToken) { onRequestAuth(); return }
    const urls = links.split("\n").map(l => l.trim()).filter(Boolean)
    if (urls.length === 0) return
    setImporting(true)
    setResults([])
    const newCreatives: Creative[] = []

    await Promise.allSettled(urls.map(async (url) => {
      const parsed = extractFileId(url)
      if (!parsed) { setResults(p => [...p, { name: url, status: "error", error: "Invalid Drive URL" }]); return }

      if (parsed.type === "file") {
        try {
          const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${parsed.id}?fields=id,name,mimeType`, {
            headers: { Authorization: `Bearer ${gdriveToken}` }
          })
          const meta = await metaRes.json()
          if (!metaRes.ok) throw new Error(meta.error?.message || "Failed to get file info")
          const res = await fetch("/api/google/import-drive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken: gdriveToken, fileId: meta.id, fileName: meta.name, mimeType: meta.mimeType, adAccountId }),
          })
          const d = await res.json()
          if (!res.ok) throw new Error(d.error || "Import failed")
          newCreatives.push(d.creative)
          setResults(p => [...p, { name: meta.name, status: "done" }])
        } catch (e: any) {
          setResults(p => [...p, { name: url, status: "error", error: e.message }])
        }
      } else {
        // Folder: list all files with pagination + optional recursion, then import in parallel
        try {
          const files = await listFilesInFolder(parsed.id, includeSubfolders, gdriveToken)
          await Promise.allSettled(files.map(async (file) => {
            try {
              const res = await fetch("/api/google/import-drive", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accessToken: gdriveToken, fileId: file.id, fileName: file.name, mimeType: file.mimeType, adAccountId }),
              })
              const d = await res.json()
              if (!res.ok) throw new Error(d.error || "Import failed")
              newCreatives.push(d.creative)
              setResults(p => [...p, { name: file.name, status: "done" }])
            } catch (e: any) {
              setResults(p => [...p, { name: file.name, status: "error", error: e.message }])
            }
          }))
        } catch (e: any) {
          setResults(p => [...p, { name: url, status: "error", error: e.message }])
        }
      }
    }))

    if (newCreatives.length > 0) onImported(newCreatives)
    setImporting(false)
  }

  return (
    <div className="flex-1 flex flex-col p-6 gap-4 overflow-y-auto">
      <div>
        <h3 className="text-sm font-semibold mb-1">Import from Google Drive</h3>
        <p className="text-xs text-muted-foreground">
          Paste <strong>one or multiple</strong> Google Drive links below. When using multiple links,{" "}
          <strong>put each link on a separate line</strong> to batch import from multiple folders.
        </p>
      </div>
      <textarea
        value={links}
        onChange={e => setLinks(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); handleViewContents() } }}
        rows={5}
        placeholder={"https://drive.google.com/drive/folders/...\nhttps://drive.google.com/file/d/...\nhttps://drive.google.com/drive/folders/..."}
        className="w-full px-3 py-2.5 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring resize-none font-mono placeholder:text-muted-foreground/40"
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <IconFolderOpen className="size-4 text-muted-foreground" />
          Include files from subfolders
          <button
            role="switch"
            onClick={() => setIncludeSubfolders(v => !v)}
            className={cn("relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
              includeSubfolders ? "bg-primary" : "bg-muted")}
          >
            <span className={cn("pointer-events-none inline-block size-4 rounded-full bg-white shadow transition-transform",
              includeSubfolders ? "translate-x-4" : "translate-x-0")} />
          </button>
        </label>
        <Button
          onClick={handleViewContents}
          disabled={!links.trim() || importing}
          className="gap-2 bg-[#4285F4] hover:bg-[#3574E2] text-white px-6"
        >
          <IconFolderOpen className="size-4" />
          {importing ? "Importing..." : "View Contents"}
          {!importing && <span className="text-xs opacity-70 ml-1">Ctrl↵</span>}
        </Button>
      </div>
      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/30 border">
              {r.status === "done"
                ? <IconCheck className="size-3.5 text-green-500 shrink-0" />
                : <IconX className="size-3.5 text-destructive shrink-0" />
              }
              <span className="truncate flex-1">{r.name}</span>
              {r.error && <span className="text-destructive shrink-0">{r.error}</span>}
            </div>
          ))}
        </div>
      )}
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
  open, onClose, adAccountId, adAccounts, alreadySelected, onConfirm, refreshSignal,
}: {
  open: boolean; onClose: () => void; adAccountId: string
  adAccounts?: AdAccountItem[]
  alreadySelected: Set<string>; onConfirm: (ids: string[], creatives: Creative[]) => void
  // Increment from parent to force re-fetch (e.g. after a new upload completes)
  refreshSignal?: number
}) {
  // ── Existing Ads tab state ──────────────────────────────────────
  const [existingAds, setExistingAds] = useState<ExistingAdRow[]>([])
  const [existingLoading, setExistingLoading] = useState(false)
  const [existingError, setExistingError] = useState<string>("")
  const existingAbortRef = useRef<AbortController | null>(null)
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
  const libThumbRetryCounts = useRef<Map<string, number>>(new Map())
  // Client-side cache: avoid re-fetching creatives if modal reopened within 90s
  const creativesCache = useRef<{ accountId: string; data: Creative[]; at: number } | null>(null)
  const CREATIVES_CACHE_TTL = 90_000
  // FB Media Library (from Facebook ad account)
  const [fbMedia, setFbMedia] = useState<FbMediaItem[]>([])
  const [fbMediaLoading, setFbMediaLoading] = useState(false)
  const [fbMediaLoaded, setFbMediaLoaded] = useState(false)
  const [fbMediaHasMore, setFbMediaHasMore] = useState(false)
  const [fbMediaError, setFbMediaError] = useState<string | null>(null)
  const [fbMediaSaving, setFbMediaSaving] = useState(false)
  const [fbMediaTypeFilter, setFbMediaTypeFilter] = useState<"all" | "image" | "video">("all")
  const [fbMediaSort, setFbMediaSort] = useState<{ field: string; dir: "asc" | "desc" }>({ field: "date", dir: "desc" })
  const FB_MEDIA_PAGE = 20
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
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const uploadFileRef = useRef<HTMLInputElement>(null)
  const uploadFolderRef = useRef<HTMLInputElement>(null)

  // ── Google Drive state ──────────────────────────────────────────
  const GDRIVE_LS_KEY = "gdrive_token_cache"
  const loadCachedToken = (): string | null => {
    try {
      const raw = localStorage.getItem(GDRIVE_LS_KEY)
      if (!raw) return null
      const { token, expiresAt } = JSON.parse(raw)
      if (Date.now() > expiresAt) { localStorage.removeItem(GDRIVE_LS_KEY); return null }
      return token
    } catch { return null }
  }
  const saveCachedToken = (token: string) => {
    localStorage.setItem(GDRIVE_LS_KEY, JSON.stringify({ token, expiresAt: Date.now() + 55 * 60 * 1000 }))
  }
  const clearCachedToken = () => localStorage.removeItem(GDRIVE_LS_KEY)

  const [gdriveToken, setGdriveToken] = useState<string | null>(() => loadCachedToken())
  const [gdriveQueue, setGdriveQueue] = useState<{ id: string; name: string; mimeType: string; status: "pending" | "importing" | "done" | "error"; error?: string }[]>([])
  const [gdriveImporting, setGdriveImporting] = useState(false)
  const [gdriveError, setGdriveError] = useState<string | null>(null)
  const gdriveTokenRef = useRef<string | null>(loadCachedToken())
  const gdriveScriptsReady = useRef(false)

  useEffect(() => {
    if (!open || !adAccountId) return
    setSelected(new Set(alreadySelected))
    fetchCreatives()
    setFbMediaLoaded(false)
    setFbMedia([])
  }, [open, adAccountId])

  // Load FB media when library tab is active
  useEffect(() => {
    if (!open || mediaTab !== "library" || fbMediaLoaded || fbMediaLoading) return
    fetchFbMedia()
  }, [open, mediaTab, adAccountId])

  // Preload Google scripts when modal opens so they're ready before user clicks
  useEffect(() => {
    if (!open || gdriveScriptsReady.current) return
    const loadScript = (src: string) => new Promise<void>((resolve) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
      const s = document.createElement("script")
      s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = () => resolve()
      document.head.appendChild(s)
    })
    Promise.all([
      loadScript("https://apis.google.com/js/api.js"),
      loadScript("https://accounts.google.com/gsi/client"),
    ]).then(() => { gdriveScriptsReady.current = true })
  }, [open])

  // Re-fetch when parent signals new upload completed — always force-refresh cache
  useEffect(() => {
    if (!open || !adAccountId || !refreshSignal) return
    creativesCache.current = null
    fetchCreatives(true)
  }, [refreshSignal])

  // Polling for missing thumbnails in Library tab (max 12 retries per video ~2min)
  useEffect(() => {
    if (!open || mediaTab !== "library" || allCreatives.length === 0) return
    const MAX_RETRIES = 12
    const pending = allCreatives.filter(c =>
      c.media_type === "video"
      && (!c.fb_thumbnail_url || (!/^https?:/.test(c.fb_thumbnail_url) && !c.fb_thumbnail_url.startsWith("/api/creatives/")))
      && (libThumbRetryCounts.current.get(c.id) ?? 0) < MAX_RETRIES
    )
    if (pending.length === 0) return

    const tick = async () => {
      if (document.hidden) return  // pause when tab is not visible
      const toCheck = pending.slice(0, 2)
      for (const c of toCheck) {
        libThumbRetryCounts.current.set(c.id, (libThumbRetryCounts.current.get(c.id) ?? 0) + 1)
        try {
          const res = await fetch(`/api/creatives/${c.id}/thumbnail`, { method: "POST" })
          const data = await res.json()
          if (data.thumbnail_url || data.source_url) {
            setAllCreatives(prev => prev.map(x =>
              x.id === c.id
                ? { ...x, fb_thumbnail_url: data.thumbnail_url || x.fb_thumbnail_url, file_url: data.source_url || x.file_url || data.thumbnail_url }
                : x
            ))
          }
        } catch {}
      }
    }

    const interval = setInterval(tick, 15000)
    // Resume immediately when user returns to this tab (don't wait up to 15s)
    const onVisible = () => { if (!document.hidden) tick() }
    document.addEventListener("visibilitychange", onVisible)

    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible) }
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
    // Cancel previous in-flight request when filter changes
    existingAbortRef.current?.abort()
    const ctrl = new AbortController()
    existingAbortRef.current = ctrl

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
      console.log(`[existing-ads] fetch reset=${reset} preset=${existingDatePreset} activeOnly=${existingActiveOnly}`)
      const res = await fetch(`/api/facebook/existing-ads?${params}`, { signal: ctrl.signal })
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
      if (e.name === "AbortError") return // silently ignore cancelled requests
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

  // ── Google Drive Picker ──────────────────────────────────────────
  const loadGoogleScript = (src: string) => new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement("script")
    s.src = src; s.async = true
    s.onload = () => resolve(); s.onerror = reject
    document.head.appendChild(s)
  })

  const openGoogleDrivePicker = async () => {
    setGdriveError(null)
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""

    // If scripts not preloaded yet, load them now (fallback)
    if (!gdriveScriptsReady.current) {
      await Promise.all([
        loadGoogleScript("https://apis.google.com/js/api.js"),
        loadGoogleScript("https://accounts.google.com/gsi/client"),
      ])
      gdriveScriptsReady.current = true
    }

    try {

    const getToken = () => new Promise<string>((resolve, reject) => {
      const tc = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.readonly",
        callback: (resp: any) => {
          if (resp.error) { reject(new Error(resp.error)); return }
          gdriveTokenRef.current = resp.access_token
          setGdriveToken(resp.access_token)
          saveCachedToken(resp.access_token)
          resolve(resp.access_token)
        },
      })
      tc.requestAccessToken({ prompt: gdriveTokenRef.current ? "" : "consent" })
    })

    const token = gdriveTokenRef.current || await getToken()

    await new Promise<void>(resolve => (window as any).gapi.load("picker", resolve))

    // Radix Dialog sets pointer-events:none on body — override while Picker is open
    document.body.style.pointerEvents = "auto"

    const P = (window as any).google.picker
    const picker = new P.PickerBuilder()
      .addView(
        new P.DocsView()
          .setIncludeFolders(true)
          .setMimeTypes("image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/x-msvideo")
      )
      .addView(new P.DocsView(P.ViewId.DOCS_IMAGES_AND_VIDEOS))
      .setOAuthToken(token)
      .enableFeature(P.Feature.MULTISELECT_ENABLED)
      .setCallback(async (data: any) => {
        // Restore pointer-events when picker is dismissed or files picked
        if (data.action === P.Action.CANCEL || data.action === P.Action.PICKED) {
          document.body.style.pointerEvents = ""
        }
        if (data.action !== P.Action.PICKED) return
        const files = data.docs as { id: string; name: string; mimeType: string }[]
        const queue = files.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType, status: "pending" as const }))
        setGdriveQueue(queue)
        setGdriveImporting(true)

        const newImported: Creative[] = []
        let newAllCreatives = [...allCreatives]

        for (let i = 0; i < files.length; i++) {
          const f = files[i]
          setGdriveQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: "importing" } : q))
          try {
            const res = await fetch("/api/google/import-drive", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                accessToken: gdriveTokenRef.current,
                fileId: f.id,
                fileName: f.name,
                mimeType: f.mimeType,
                adAccountId,
              }),
            })
            const d = await res.json()
            if (!res.ok) throw new Error(d.error || "Import failed")
            const creative: Creative = d.creative
            
            newImported.push(creative)
            newAllCreatives = [creative, ...newAllCreatives.filter(c => c.id !== creative.id)]
            setAllCreatives(newAllCreatives)
            setSelected(prev => new Set([...prev, creative.id]))
            setGdriveQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: "done" } : q))
          } catch (err: any) {
            setGdriveQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: "error", error: err.message } : q))
          }
        }
        setGdriveImporting(false)

        // Auto-confirm and close the dialog if we successfully imported files,
        // so they instantly appear in the main Ads view (mimicking competitor UX).
        if (newImported.length > 0) {
          setTimeout(() => {
            setSelected(prev => {
              const finalSelectedIds = Array.from(prev)
              const selectedObjects = newAllCreatives.filter(c => prev.has(c.id))
              // Call onConfirm in the next microtask to avoid side-effects in setState
              Promise.resolve().then(() => {
                onConfirm(finalSelectedIds, selectedObjects)
                onClose()
              })
              return prev
            })
          }, 800) // Brief delay so user can see the "Done" state before it closes
        }
      })
      .build()
    picker.setVisible(true)
    } catch (err: any) {
      document.body.style.pointerEvents = ""
      const msg = err.message || "Google Drive connection failed"
      setGdriveError(msg)
    }
  }

  const fetchCreatives = (forceRefresh = false) => {
    const cached = creativesCache.current
    if (!forceRefresh && cached && cached.accountId === adAccountId && (Date.now() - cached.at) < CREATIVES_CACHE_TTL) {
      console.log(`[creatives] client cache HIT (${Math.round((Date.now() - cached.at) / 1000)}s old) account=${adAccountId}`)
      setAllCreatives(cached.data)
      return
    }
    setLoading(true)
    fetch(`/api/creatives?ad_account_id=${encodeURIComponent(adAccountId)}&limit=20`)
      .then(r => r.json())
      .then(d => {
        const list: Creative[] = d.creatives || []
        creativesCache.current = { accountId: adAccountId, data: list, at: Date.now() }
        console.log(`[creatives] fetched count=${list.length} total=${d.total ?? "?"} hasMore=${d.hasMore}`)
        setAllCreatives(list)
        // Background refresh: ONLY for videos that genuinely need it
        // (recent uploads OR no thumbnail at all). Throttled to 1 at a time
        // with 1.5s delay between calls to avoid Meta rate limits.
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
        const videosToRefresh = list.filter(c => {
          if (c.media_type !== "video" || !c.fb_video_id) return false
          const hasGoodThumb =
            !!c.fb_thumbnail_url &&
            (/^https?:/.test(c.fb_thumbnail_url) || c.fb_thumbnail_url.startsWith("/api/creatives/"))
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

  const fetchFbMedia = (append = false) => {
    if (!adAccountId) return
    setFbMediaLoading(true)
    setFbMediaError(null)
    const offset = append ? fbMedia.length : 0
    fetch(`/api/facebook/ad-media?ad_account_id=${encodeURIComponent(adAccountId)}&limit=${FB_MEDIA_PAGE}&offset=${offset}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setFbMediaError(d.error); return }
        const incoming: FbMediaItem[] = d.media || []
        setFbMedia(prev => append ? [...prev, ...incoming] : incoming)
        setFbMediaHasMore(incoming.length === FB_MEDIA_PAGE)
        setFbMediaLoaded(true)
      })
      .catch(() => setFbMediaError("Failed to load media"))
      .finally(() => setFbMediaLoading(false))
  }

  const dimsOf = (c: Creative) => (c as any).dimensions || (c.media_type === "video" ? "9:16" : "1:1")
  const durationOf = (c: Creative) => (c as any).duration || (c.media_type === "video" ? "0:30" : "—")
  const uploaderOf = (c: Creative) => (c as any).uploader || (c as any).user_email || "—"
  const workspaceOf = (c: Creative) => (c as any).workspace_id || "—"

  // Build dynamic chip options from data
  const uniq = (arr: any[]) => Array.from(new Set(arr.filter(Boolean)))
  const filterOptions = {
    uploader:   [] as string[],
    status:     uniq(fbMedia.map(m => typeof m.status === "object" ? (m.status as any)?.value : m.status)) as string[],
    channels:   [] as string[],
    fileType:   ["image", "video"],
    dimensions: uniq(fbMedia.map(m => {
      if (m.dimensions) return m.dimensions
      if (m.width && m.height) {
        const g = (a: number, b: number): number => b === 0 ? a : g(b, a % b)
        const d = g(m.width, m.height)
        return `${m.width / d}:${m.height / d}`
      }
      return null
    })) as string[],
    workspace:  [] as string[],
    source:     [] as string[],
    dateAdded:  ["today", "week", "month", "year"],
  }

  // Media Library uses fbMedia (from Facebook ad account)
  const fmtDuration = (sec?: number | null) => {
    if (!sec) return "—"
    const m = Math.floor(sec / 60), s = sec % 60
    return `${m}:${String(s).padStart(2, "0")}`
  }
  const fmtDims = (m: FbMediaItem) => {
    if (m.dimensions) return m.dimensions
    if (m.width && m.height) {
      const g = (a: number, b: number): number => b === 0 ? a : g(b, a % b)
      const d = g(m.width, m.height)
      return `${m.width / d}:${m.height / d}`
    }
    return m.media_type === "video" ? "9:16" : "—"
  }

  const filtered = fbMedia.filter(m => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.fb_id?.includes(search)
    if (!matchSearch) return false
    if (filters.fileType !== "all" && m.media_type !== filters.fileType) return false
    if (filters.status !== "all") {
      const mStatus = typeof m.status === "object" ? (m.status as any)?.value : m.status
      if (mStatus !== filters.status) return false
    }
    if (filters.dimensions !== "all" && fmtDims(m) !== filters.dimensions) return false
    if (filters.dateAdded !== "all" && m.date_added) {
      const ms = Date.now() - new Date(m.date_added).getTime()
      const day = 86400000
      if (filters.dateAdded === "today" && ms > day) return false
      if (filters.dateAdded === "week" && ms > 7 * day) return false
      if (filters.dateAdded === "month" && ms > 30 * day) return false
      if (filters.dateAdded === "year" && ms > 365 * day) return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    let va: any, vb: any
    switch (sortField) {
      case "name": va = a.name; vb = b.name; break
      case "ad_id": va = a.fb_id || ""; vb = b.fb_id || ""; break
      case "dimensions": va = fmtDims(a); vb = fmtDims(b); break
      case "duration": va = a.duration || 0; vb = b.duration || 0; break
      case "date": va = a.date_added || ""; vb = b.date_added || ""; break
      case "status": va = String(a.status || ""); vb = String(b.status || ""); break
      case "user": va = ""; vb = ""; break
      case "workspace": va = ""; vb = ""; break
      default: va = a.date_added || ""; vb = b.date_added || ""; break
    }
    if (typeof va === "number") return sortDir === "asc" ? va - vb : vb - va
    return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
  })

  const toggle = (id: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  const toggleAll = () => {
    setSelected(prev => prev.size === sorted.length ? new Set() : new Set(sorted.map(m => m.id)))
  }
  const handleConfirm = async () => {
    const selectedMedia = fbMedia.filter(m => selected.has(m.id))
    if (selectedMedia.length === 0) { onClose(); return }

    setFbMediaSaving(true)
    try {
      const res = await fetch("/api/facebook/ad-media/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad_account_id: adAccountId,
          items: selectedMedia.map(m => ({
            id: m.id,
            name: m.name,
            media_type: m.media_type,
            thumbnail_url: m.thumbnail_url,
            fb_image_hash: m.fb_image_hash,
            fb_image_url: m.fb_image_url,
            fb_video_id: m.fb_video_id,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.creatives?.length) {
        setFbMediaError(data.error || "Failed to save media")
        return
      }
      const creatives: Creative[] = data.creatives
      onConfirm(creatives.map((c: any) => c.id), creatives)
      onClose()
    } catch (err: any) {
      setFbMediaError(err.message || "Failed to save media")
    } finally {
      setFbMediaSaving(false)
    }
  }
  const handlePasteSubmit = () => {
    const ids = pasteText.split(/[\s,;\n]+/).map(s => s.trim()).filter(Boolean)
    const matched = fbMedia.filter(m => ids.includes(m.id) || ids.includes(m.fb_id))
    setSelected(prev => { const s = new Set(prev); matched.forEach(m => s.add(m.id)); return s })
    setPasteText("")
    setPasteOpen(false)
  }
  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortField(f); setSortDir("asc") }
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !adAccountId) return
    const fileArr = Array.from(files)
    setUploading(true)
    setUploadProgress({ current: 0, total: fileArr.length })
    let done = 0
    for (const file of fileArr) {
      try {
        await fetch(
          `/api/creatives/upload-binary?filename=${encodeURIComponent(file.name)}&type=${encodeURIComponent(file.type)}&size=${file.size}&ad_account_id=${encodeURIComponent(adAccountId)}`,
          { method: "POST", body: file }
        )
      } catch {}
      done++
      setUploadProgress({ current: done, total: fileArr.length })
    }
    setUploading(false)
    setUploadProgress(null)
    fetchFbMedia()
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
            <div className="flex flex-wrap items-center gap-2 px-6 py-2 border-b shrink-0">
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
              {Object.entries(filters).some(([k, v]) => v !== "all") && (
                <button
                  onClick={() => setFilters({ uploader: "all", status: "all", channels: "all", fileType: "all", dimensions: "all", workspace: "all", source: "all", dateAdded: "all" })}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-lg border border-dashed transition-colors"
                >
                  <IconX className="size-3" />
                  Clear filters
                </button>
              )}
            </div>

            {/* Toolbar actions */}
            <div className="flex items-center justify-end gap-2 px-6 py-2 border-b shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => uploadFileRef.current?.click()} disabled={uploading}>
                {uploading && uploadProgress
                  ? <><IconLoader2 className="size-3.5 animate-spin" />{uploadProgress.current}/{uploadProgress.total}</>
                  : <><IconUpload className="size-3.5" />Upload New Media</>
                }
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => uploadFolderRef.current?.click()} disabled={uploading}>
                <IconFolder className="size-3.5" />Upload Folder
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fetchFbMedia()} disabled={fbMediaLoading}>
                <IconRefresh className={cn("size-3.5", fbMediaLoading && "animate-spin")} />Refresh list
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
              <button onClick={toggleAll} className={cn("size-4 rounded border-2 flex items-center justify-center transition-colors",
                selected.size > 0 ? "bg-primary border-primary" : "border-muted-foreground/30 hover:border-muted-foreground/60")}>
                {selected.size > 0 && selected.size === sorted.length && <IconCheck className="size-2.5 text-primary-foreground" />}
                {selected.size > 0 && selected.size < sorted.length && <IconMinus className="size-2.5 text-primary-foreground" />}
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
              {fbMediaLoading ? (
                <div className="flex items-center justify-center h-40">
                  <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : fbMediaError ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                  <IconPhoto className="size-8 opacity-30" />
                  <p className="text-sm text-destructive">{fbMediaError}</p>
                  <Button size="sm" variant="outline" onClick={() => fetchFbMedia()}>Retry</Button>
                </div>
              ) : sorted.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                  <IconPhoto className="size-8 opacity-30" />
                  <p className="text-sm">No media assets found</p>
                </div>
              ) : (
                sorted.map(m => {
                  const isSelected = selected.has(m.id)
                  const statusRaw = String(m.status || "active").toLowerCase()
                  const statusLabel = statusRaw.replace(/_/g, " ")
                  const statusColor = statusRaw === "active" || statusRaw === "ready"
                    ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                    : statusRaw === "paused"
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                    : statusRaw.includes("disapprove") || statusRaw.includes("reject")
                    ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                    : statusRaw.includes("process") || statusRaw.includes("pending")
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                    : "bg-muted/60 text-muted-foreground"
                  return (
                    <div key={m.id} onClick={() => toggle(m.id)}
                      className={cn("grid items-center px-6 py-2.5 border-b cursor-pointer hover:bg-muted/30 transition-colors",
                        isSelected && "bg-primary/5 hover:bg-primary/10")}
                      style={{ gridTemplateColumns: "28px 2.5fr 80px 100px 80px 120px 1.6fr 120px 120px" }}>
                      <div className={cn("size-4 rounded border-2 flex items-center justify-center shrink-0",
                        isSelected ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                        {isSelected && <IconCheck className="size-2.5 text-primary-foreground" />}
                      </div>
                      <div className="flex items-center gap-2.5 min-w-0 pr-3">
                        <div className="size-9 rounded overflow-hidden bg-muted shrink-0 relative">
                          {m.thumbnail_url
                            ? <img src={m.thumbnail_url} className="w-full h-full object-cover" alt="" loading="lazy" onError={e => e.currentTarget.style.display="none"} />
                            : <div className="w-full h-full flex items-center justify-center"><IconPhoto className="size-4 text-muted-foreground/40" /></div>
                          }
                          {m.media_type === "video" && (
                            <div className="absolute bottom-0 right-0 size-3.5 rounded-tl bg-black/60 flex items-center justify-center pointer-events-none">
                              <IconPlayerPlay className="size-2 text-white" />
                            </div>
                          )}
                        </div>
                        <span className="text-sm truncate" title={m.name}>{m.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{m.fb_id?.slice(-6) || "—"}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted/50 w-fit">{fmtDims(m)}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted/50 w-fit">{m.media_type === "video" ? fmtDuration(m.duration) : "—"}</span>
                      <span className="text-xs text-muted-foreground">
                        {m.date_added ? new Date(m.date_added).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </span>
                      <span className={cn("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full w-fit max-w-full", statusColor)}>
                        <span className="truncate capitalize">{statusLabel}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">—</span>
                      <span className="text-xs text-muted-foreground truncate font-mono">{adAccountId.replace("act_", "").slice(0, 12)}</span>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="border-t shrink-0">
              <div className="px-6 pt-2 pb-1 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {filtered.length !== fbMedia.length
                    ? `${filtered.length} of ${fbMedia.length}${fbMediaHasMore ? "+" : ""} row(s)`
                    : `${fbMedia.length}${fbMediaHasMore ? "+" : ""} row(s)`}
                </span>
                {fbMediaHasMore && (
                  <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => fetchFbMedia(true)} disabled={fbMediaLoading}>
                    {fbMediaLoading ? <IconLoader2 className="size-3 animate-spin mr-1" /> : null}
                    Load more
                  </Button>
                )}
              </div>
              <Button
                onClick={handleConfirm}
                disabled={selected.size === 0 || fbMediaSaving}
                className="w-full h-12 rounded-none rounded-b-xl text-base font-semibold"
              >
                {fbMediaSaving ? <><IconLoader2 className="size-4 animate-spin mr-2" />Saving...</> : `Add ${selected.size > 0 ? `${selected.size} ` : "New "}Creatives`}
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
                              {ad.thumb_url ? <img src={ad.thumb_url} className="w-full h-full object-cover" alt="" loading="lazy" onError={e => e.currentTarget.style.display="none"} />
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
        ) : mediaTab === "drive_link" ? (
          <DriveLinkTab gdriveToken={gdriveToken} onRequestAuth={openGoogleDrivePicker} adAccountId={adAccountId}
            onImported={(creatives) => {
              const newAllCreatives = [...creatives.filter(c => !allCreatives.some(p => p.id === c.id)), ...allCreatives]
              setAllCreatives(newAllCreatives)
              
              setSelected(prev => {
                const nextIds = new Set([...prev, ...creatives.map(c => c.id)])
                const finalSelectedIds = Array.from(nextIds)
                const selectedObjects = newAllCreatives.filter(c => nextIds.has(c.id))
                Promise.resolve().then(() => {
                  onConfirm(finalSelectedIds, selectedObjects)
                  onClose()
                })
                return nextIds
              })
            }} />
        ) : mediaTab === "gdrive" || mediaTab === "drive_browser" ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {gdriveQueue.length > 0 ? (
              /* Import progress list */
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">
                    {gdriveImporting ? "Importing from Google Drive..." : `Done — ${gdriveQueue.filter(q => q.status === "done").length}/${gdriveQueue.length} imported`}
                  </p>
                  {!gdriveImporting && (
                    <button onClick={() => { setGdriveQueue([]); setMediaTab("library") }}
                      className="text-xs text-primary hover:underline">
                      View in library
                    </button>
                  )}
                </div>
                {gdriveQueue.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 border rounded-lg bg-muted/20">
                    <IconBrandGoogleDrive className="size-4 shrink-0 text-[#4285F4]" />
                    <span className="text-sm flex-1 truncate">{f.name}</span>
                    {f.status === "pending" && <span className="text-xs text-muted-foreground">Waiting...</span>}
                    {f.status === "importing" && <IconLoader2 className="size-4 animate-spin text-primary shrink-0" />}
                    {f.status === "done" && <IconCheck className="size-4 text-green-500 shrink-0" />}
                    {f.status === "error" && (
                      <span className="text-xs text-destructive truncate max-w-[120px]" title={f.error}>{f.error}</span>
                    )}
                  </div>
                ))}
                {!gdriveImporting && (
                  <Button variant="outline" size="sm" className="w-full mt-2 gap-1.5" onClick={openGoogleDrivePicker}>
                    <IconBrandGoogleDrive className="size-3.5" />Import more files
                  </Button>
                )}
              </div>
            ) : (
              /* Empty state */
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="size-16 rounded-2xl bg-muted/40 flex items-center justify-center">
                  <IconBrandGoogleDrive className="size-8 text-[#4285F4]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Import from Google Drive</p>
                  <p className="text-xs mt-1">Select images or videos — they'll be uploaded to Meta and added to your library</p>
                </div>
                {gdriveToken ? (
                  <div className="flex flex-col items-center gap-2 mt-1">
                    <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                      <div className="size-1.5 rounded-full bg-green-500" />
                      Connected to Google Drive
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="gap-1.5" onClick={openGoogleDrivePicker}>
                        <IconBrandGoogleDrive className="size-3.5" />Open Google Drive
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => {
                        clearCachedToken()
                        gdriveTokenRef.current = null
                        setGdriveToken(null)
                      }}>
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" className="mt-1 gap-1.5" onClick={openGoogleDrivePicker}>
                    <IconBrandGoogleDrive className="size-3.5" />Connect Google Drive
                  </Button>
                )}
                {gdriveError && (
                  <p className="text-xs text-destructive mt-1 text-center max-w-xs">{gdriveError}</p>
                )}
              </div>
            )}
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

        {/* Hidden file inputs for upload */}
        <input
          ref={uploadFileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={e => { handleUpload(e.target.files); e.target.value = "" }}
        />
        <input
          ref={uploadFolderRef}
          type="file"
          accept="image/*,video/*"
          multiple
          // @ts-ignore
          webkitdirectory=""
          className="hidden"
          onChange={e => { handleUpload(e.target.files); e.target.value = "" }}
        />
      </DialogContent>
    </Dialog>
  )
}

// ─── Schedule Modal ───────────────────────────────────────────────────────────

function ScheduleModal({ open, onClose, onConfirm }: {
  open: boolean
  onClose: () => void
  onConfirm: (start: string, end?: string) => void
}) {
  const [date, setDate] = useState("")
  const [time, setTime] = useState("09:00")
  const [hasEnd, setHasEnd] = useState(false)
  const [endDate, setEndDate] = useState("")
  const [endTime, setEndTime] = useState("23:59")
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const today = new Date().toISOString().split("T")[0]
  const inputCls = "w-full px-3 py-2 text-sm border rounded-lg bg-muted/30 outline-none focus:ring-1 focus:ring-ring"

  const handleConfirm = () => {
    if (!date) return
    const start = new Date(`${date}T${time}:00`).toISOString()
    const end = hasEnd && endDate ? new Date(`${endDate}T${endTime}:00`).toISOString() : undefined
    onConfirm(start, end)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule Ads</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">Timezone: {tz}</p>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Start Date</label>
              <input type="date" value={date} min={today}
                onChange={e => setDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Start Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className={inputCls} />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={hasEnd} onChange={e => setHasEnd(e.target.checked)}
              className="rounded border-input" />
            <span className="text-sm">Set end date (optional)</span>
          </label>

          {hasEnd && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">End Date</label>
                <input type="date" value={endDate} min={date || today}
                  onChange={e => setEndDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">End Time</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputCls} />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1 gap-1.5" disabled={!date} onClick={handleConfirm}>
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

  const sourceAdSet = allAdSets.find(a => a.id === selectedSourceId)
  const filtered = allAdSets.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.id.includes(search)
  )

  const selectSource = (a: AdSet) => {
    setSelectedSourceId(a.id)
    setNewName(`${a.name.replace(/\s*[-–]\s*Copy\s*\d*\s*$/i, "").replace(/\s*\(copy\)\s*$/i, "")} - Copy`)
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
        const suffix = count > 1 ? ` ${i + 1}` : ""
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
            <Popover open={searchOpen && !sourceAdSet} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <div className="flex items-center gap-2 px-2.5 py-2 border rounded-lg bg-muted/20 min-h-[40px] cursor-text">
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
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={4}
                onOpenAutoFocus={e => e.preventDefault()}
                className="p-0 gap-0 w-[var(--radix-popover-trigger-width)] max-w-none max-h-60 overflow-y-auto"
              >
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
              </PopoverContent>
            </Popover>
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
  // Custom attribution window values (days). "0" = disabled. Maps to Meta attribution_spec.
  attrViewDays: string       // "0" | "1"
  attrClickDays: string      // "1" | "7" | "28"
  attrEngagedViewDays: string // "0" | "1"  (video only)
  deepCopy: boolean
  // Granular ad selection for deep copy. Empty array = copy all (uses deep_copy=true on /copies).
  selectedAdIds: string[]
  duplicatedAdsStatus: "ACTIVE" | "PAUSED"
  // Cached ads list for the source ad set
  adsList: { id: string; name: string; effective_status: string }[]
  adsLoading: boolean
  adsLoaded: boolean
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
  // Newly-created (empty) campaigns from Step 1, used as targets in Step 2
  const [newCampaigns, setNewCampaigns] = useState<{ id: string; name: string }[]>([])
  // Step 3 results
  const [results, setResults] = useState<any[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")
  const [warnings, setWarnings] = useState<string[]>([])

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
    setNewCampaigns([])
    setResults([])
    setError("")
    setWarnings([])
    fetchCampaigns()
  }, [open, adAccountId])

  const fetchCampaigns = async () => {
    if (!adAccountId) return
    setCampaignsLoading(true)
    try {
      const res = await fetch(`/api/facebook/campaigns?ad_account_id=${encodeURIComponent(adAccountId)}`)
      const d = await res.json()
      const raw: any[] = d.campaigns || []
      setCampaigns(raw.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        effective_status: c.effective_status,
        objective: c.objective,
        daily_budget: c.daily_budget,
        lifetime_budget: c.lifetime_budget,
        _adset_count: c.adsets?.summary?.total_count ?? undefined,
        _spend: parseFloat(c.insights?.data?.[0]?.spend || "0"),
      })))
    } catch {}
    setCampaignsLoading(false)
  }

  const selectCampaign = (c: CampaignItem) => {
    setSelectedCampaignId(c.id)
    // Meta convention: "Name - Copy" — strip existing trailing copy suffix to avoid stacking
    const baseName = c.name.replace(/\s*[-–]\s*Copy\s*\d*\s*$/i, "").replace(/\s*\(copy\)\s*$/i, "")
    setCampaignName(`${baseName} - Copy`)
    // Inherit budget from source campaign (Meta returns budget in cents → convert to dollars)
    const sc = c as any
    if (sc.daily_budget) {
      setBudgetType("daily")
      setBudgetAmount((parseInt(sc.daily_budget) / 100).toFixed(2))
    } else if (sc.lifetime_budget) {
      setBudgetType("lifetime")
      setBudgetAmount((parseInt(sc.lifetime_budget) / 100).toFixed(2))
    } else {
      // CBO without budget set, or campaign with adset-level budgets (ABO)
      setBudgetAmount("")
    }
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

  // Step 1 → Step 2: actually creates EMPTY campaigns in Meta, then loads source ad sets to configure
  const createCampaignsAndContinue = async () => {
    if (!selectedCampaignId || !campaignName.trim()) return
    setCreating(true)
    setError("")
    try {
      // 1) Create the empty campaign(s) in Meta
      const cRes = await fetch(`/api/facebook/campaigns/${selectedCampaignId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customName: campaignName,
          count: campaignCount,
          launchAsActive,
          dailyBudget: budgetType === "daily" && budgetAmount ? budgetAmount : undefined,
          lifetimeBudget: budgetType === "lifetime" && budgetAmount ? budgetAmount : undefined,
          bidStrategy: bidStrategy === "inherit" ? undefined : bidStrategy,
          adSetConfigs: [], // empty — only create campaign shells
        }),
      })
      const cData = await cRes.json()
      if (!cRes.ok) {
        setError(cData.error || `HTTP ${cRes.status}`)
        setCreating(false)
        return
      }
      const created = (cData.campaigns || []) as { id: string; name: string }[]
      setNewCampaigns(created)
      if (Array.isArray(cData.warnings) && cData.warnings.length > 0) {
        setWarnings(cData.warnings)
      }

      // 2) Fetch source ad sets to configure
      setAdSetsLoading(true)
      try {
        const res = await fetch(`/api/facebook/adsets?ad_account_id=${encodeURIComponent(adAccountId)}&campaign_id=${selectedCampaignId}`)
        const d = await res.json()
        const list: AdSet[] = d.adSets || []
        setSourceAdSets(list)
        const ids = new Set(list.map(a => a.id))
        setSelectedAdSetIds(ids)
        const cfgs: Record<string, AdSetCfg> = {}
        list.forEach(a => {
          // Meta convention: "<original> - Copy". Strip trailing " - Copy" / " (copy)" first to avoid stacking.
          const baseName = a.name.replace(/\s*[-–]\s*Copy\s*\d*\s*$/i, "").replace(/\s*\(copy\)\s*$/i, "")
          cfgs[a.id] = {
            id: a.id,
            sourceName: a.name,
            sourceStatus: a.effective_status,
            customName: `${baseName} - Copy`,
            copies: 1,
            statusActive: a.effective_status === "ACTIVE",
            startTime: "",
            endTime: "",
            customAttribution: false,
            attrViewDays: "1",         // 1d_view
            attrClickDays: "7",        // 7d_click (Meta default)
            attrEngagedViewDays: "0",  // disabled
            deepCopy: false,
            selectedAdIds: [],
            duplicatedAdsStatus: "PAUSED",
            adsList: [],
            adsLoading: false,
            adsLoaded: false,
            copyCurrentSettings: true,
          }
        })
        setAdSetConfigs(cfgs)
      } catch {}
      setAdSetsLoading(false)
      setStep(2)
    } catch (e: any) {
      setError(e.message || "Failed to create campaigns")
    }
    setCreating(false)
  }

  // Step 2: add ad sets into the already-created campaigns
  const handleCreate = async () => {
    if (newCampaigns.length === 0) {
      setError("No created campaigns. Go back to Step 1.")
      return
    }
    setCreating(true)
    setError("")
    try {
      const adSetConfigsArr = Array.from(selectedAdSetIds).map(id => adSetConfigs[id]).filter(Boolean)
      const res = await fetch(`/api/facebook/campaigns/duplicate-adsets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCampaignIds: newCampaigns.map(c => c.id),
          adSetConfigs: adSetConfigsArr,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
        setCreating(false)
        return
      }
      const allWarnings = [
        ...(Array.isArray(data.warnings) ? data.warnings : []),
        ...(Array.isArray(data.errors) ? data.errors : []),
      ]
      if (allWarnings.length > 0) setWarnings(prev => [...prev, ...allWarnings])
      // Merge: results campaigns only have ids — enrich with names from newCampaigns
      const enriched = (data.campaigns || []).map((c: any) => ({
        ...c,
        name: newCampaigns.find(nc => nc.id === c.id)?.name || c.id,
      }))
      setResults(enriched)
      // Push all new ad sets to parent
      const allNewAdSets: AdSet[] = []
      for (const cmp of enriched) {
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

  const totalAdSetsToCreate = Array.from(selectedAdSetIds).reduce((sum, id) => sum + (adSetConfigs[id]?.copies || 1), 0) * newCampaigns.length

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl w-full p-0 max-h-[92vh] flex flex-col gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b shrink-0">
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

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">

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
            <div className="flex gap-2 items-start">
              <div className="flex-1 space-y-1">
                <button
                  onClick={() => setCampaignDropdownOpen(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 border rounded-lg bg-background hover:bg-muted/30 text-left"
                >
                  {sourceCampaign ? (
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <IconBrandMeta className="size-4 text-[#0064E0] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate">{sourceCampaign.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {sourceCampaign._adset_count ?? "—"} ad sets | {(sourceCampaign.objective || "").replace(/_/g, " ")} | spend: ${(sourceCampaign._spend || 0).toFixed(0)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Select a campaign...</span>
                  )}
                  <IconSelector className="size-4 text-muted-foreground shrink-0 ml-2" />
                </button>
                {campaignDropdownOpen && (
                  <div className="border rounded-lg bg-background overflow-hidden shadow-sm">
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
                    <div className="max-h-56 overflow-y-auto">
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
                              Ad Sets: {c._adset_count ?? "—"} | {(c.objective || "").replace(/_/g, " ")} | spend: ${(c._spend || 0).toFixed(0)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={fetchCampaigns} className="size-10 border rounded-lg flex items-center justify-center hover:bg-muted/30 shrink-0">
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
                      <IconClock className="size-3" />${(sourceCampaign._spend || 0).toFixed(2)} spend
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
                        <Select
                          value={budgetType}
                          onValueChange={v => {
                            const t = v as "daily" | "lifetime"
                            setBudgetType(t)
                            // Re-inherit from source when switching type
                            const sc = sourceCampaign as any
                            const src = t === "daily" ? sc?.daily_budget : sc?.lifetime_budget
                            setBudgetAmount(src ? (parseInt(src) / 100).toFixed(2) : "")
                          }}
                        >
                          <SelectTrigger className="h-9 text-sm bg-background"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily Budget</SelectItem>
                            <SelectItem value="lifetime">Lifetime Budget</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-sm font-bold">{budgetType === "daily" ? "Daily Budget" : "Lifetime Budget"}</label>
                          {(() => {
                            const sc = sourceCampaign as any
                            const sourceBudget = budgetType === "daily" ? sc?.daily_budget : sc?.lifetime_budget
                            if (!sourceBudget) return null
                            const sourceVal = (parseInt(sourceBudget) / 100).toFixed(2)
                            return (
                              <button
                                type="button"
                                onClick={() => setBudgetAmount(sourceVal)}
                                className="text-[11px] text-primary hover:underline flex items-center gap-1"
                                title="Use source campaign's budget"
                              >
                                <IconRefresh className="size-3" />Source: ${sourceVal}
                              </button>
                            )
                          })()}
                        </div>
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
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {budgetType === "daily" ? "Amount to spend each day" : "Total amount over campaign lifetime"}
                          {budgetAmount && sourceCampaign && (() => {
                            const sc = sourceCampaign as any
                            const src = budgetType === "daily" ? sc.daily_budget : sc.lifetime_budget
                            if (!src) return null
                            const sourceVal = parseInt(src) / 100
                            const inputVal = parseFloat(budgetAmount) || 0
                            if (Math.abs(sourceVal - inputVal) < 0.01) {
                              return <span className="ml-1 text-emerald-600 dark:text-emerald-400">• Inherited from source</span>
                            }
                            return <span className="ml-1 text-amber-600 dark:text-amber-400">• Overridden (source: ${sourceVal.toFixed(2)})</span>
                          })()}
                        </p>
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
            {newCampaigns.length > 0 && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-lg px-3 py-2.5 text-xs">
                <div className="flex items-start gap-2">
                  <IconCircleCheck className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-emerald-700 dark:text-emerald-400">
                      Created {newCampaigns.length} campaign{newCampaigns.length > 1 ? "s" : ""} in Meta
                    </p>
                    <ul className="mt-1 space-y-0.5 text-emerald-700/80 dark:text-emerald-400/80">
                      {newCampaigns.map(c => (
                        <li key={c.id} className="truncate">• {c.name} <span className="font-mono opacity-60">({c.id})</span></li>
                      ))}
                    </ul>
                    <p className="mt-1.5 text-emerald-700/70 dark:text-emerald-400/70 italic">Add ad sets below, or close to leave empty.</p>
                  </div>
                </div>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded-lg px-3 py-2.5 text-xs">
                <div className="flex items-start gap-2">
                  <IconAlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-amber-800 dark:text-amber-300">
                      {warnings.length} warning{warnings.length > 1 ? "s" : ""} from Meta
                    </p>
                    <ul className="mt-1 space-y-0.5 text-amber-800/90 dark:text-amber-300/90 max-h-32 overflow-y-auto">
                      {warnings.map((w, i) => (
                        <li key={i} className="break-words">• {w}</li>
                      ))}
                    </ul>
                    <button onClick={() => setWarnings([])} className="mt-1.5 text-[11px] underline opacity-70 hover:opacity-100">Dismiss</button>
                  </div>
                </div>
              </div>
            )}

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
              const fetchAdsForCfg = async () => {
                if (cfg.adsLoaded || cfg.adsLoading) return
                updateCfg({ adsLoading: true })
                try {
                  const r = await fetch(`/api/facebook/adsets/${adset.id}/ads`)
                  const d = await r.json()
                  const list = (d.ads || []).map((a: any) => ({
                    id: a.id, name: a.name, effective_status: a.effective_status,
                  }))
                  // Default: all ads selected
                  setAdSetConfigs(prev => ({
                    ...prev,
                    [adset.id]: {
                      ...prev[adset.id],
                      adsList: list,
                      adsLoaded: true,
                      adsLoading: false,
                      selectedAdIds: list.map((a: any) => a.id),
                    },
                  }))
                } catch {
                  updateCfg({ adsLoading: false })
                }
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
                      {(() => {
                        const a = adset as any
                        const daily = a.daily_budget ? `$${(parseInt(a.daily_budget) / 100).toFixed(2)}/day` : null
                        const lifetime = a.lifetime_budget ? `$${(parseInt(a.lifetime_budget) / 100).toFixed(2)} lifetime` : null
                        const budget = daily || lifetime || "Inherits from campaign (CBO)"
                        const statusLabel = a.effective_status === "ACTIVE" ? "Active"
                          : a.effective_status === "PAUSED" ? "Paused"
                          : a.effective_status === "CAMPAIGN_PAUSED" ? "Paused (campaign off)"
                          : a.effective_status === "ARCHIVED" ? "Archived"
                          : a.effective_status === "DELETED" ? "Deleted"
                          : (a.effective_status || "—")
                        const schedule = a.start_time
                          ? `from ${new Date(a.start_time).toLocaleDateString()}${a.end_time ? ` to ${new Date(a.end_time).toLocaleDateString()}` : ""}`
                          : "Run continuously"
                        return (
                          <p className="text-[11px] text-muted-foreground">
                            <span className="font-medium">Budget:</span> {budget} <span className="opacity-50">•</span>{" "}
                            <span className="font-medium">Status:</span> {statusLabel} <span className="opacity-50">•</span>{" "}
                            <span className="font-medium">Schedule:</span> {schedule}
                          </p>
                        )
                      })()}

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

                      {/* Custom Attribution Window */}
                      <div className="border-t pt-2">
                        <div className="flex items-start justify-between gap-2 py-1">
                          <div>
                            <p className="text-sm font-medium">Set Custom Attribution Window</p>
                            <p className="text-[11px] text-muted-foreground">{cfg.customAttribution ? "Override the source ad set's attribution settings" : "Using original ad set's attribution settings"}</p>
                          </div>
                          <button onClick={() => updateCfg({ customAttribution: !cfg.customAttribution })}
                            className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 mt-0.5",
                              cfg.customAttribution ? "bg-primary" : "bg-muted-foreground/30")}>
                            <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                              cfg.customAttribution ? "translate-x-4" : "translate-x-0.5")} />
                          </button>
                        </div>
                        {cfg.customAttribution && (
                          <div className="space-y-2 mt-2 pl-1">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[11px] font-medium block mb-1 flex items-center gap-1">
                                  View-through Days <IconInfoCircle className="size-3 text-muted-foreground" />
                                </label>
                                <Select value={cfg.attrViewDays} onValueChange={v => updateCfg({ attrViewDays: v })}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="0">Disabled (0 days)</SelectItem>
                                    <SelectItem value="1">1 day</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <label className="text-[11px] font-medium block mb-1 flex items-center gap-1">
                                  Click-through Days <IconInfoCircle className="size-3 text-muted-foreground" />
                                </label>
                                <Select value={cfg.attrClickDays} onValueChange={v => updateCfg({ attrClickDays: v })}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">1 day</SelectItem>
                                    <SelectItem value="7">7 days</SelectItem>
                                    <SelectItem value="28">28 days</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div>
                              <label className="text-[11px] font-medium block mb-1 flex items-center gap-1">
                                Engaged-view Days <span className="text-muted-foreground">(Video ads only)</span> <IconInfoCircle className="size-3 text-muted-foreground" />
                              </label>
                              <Select value={cfg.attrEngagedViewDays} onValueChange={v => updateCfg({ attrEngagedViewDays: v })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0">Disabled (0 days)</SelectItem>
                                  <SelectItem value="1">1 day</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-2 text-[11px] text-amber-800 dark:text-amber-300">
                              <p className="font-bold flex items-center gap-1 mb-0.5">
                                <IconAlertTriangle className="size-3" />Attribution Window Limitations
                              </p>
                              <p className="mb-1">Facebook restricts attribution window combinations based on campaign objective and optimization goal. If you receive an error, try different combinations or keep the original attribution settings.</p>
                              <p>Common valid combinations: 1d_view, 1d_click, 7d_click, 1d_view + 1d_click, 1d_view + 7d_click. Engaged-view is only available for video ads.</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Duplicate ads from original ad set */}
                      <div className="border-t pt-2">
                        <div className={cn("flex items-start justify-between gap-2 rounded-lg p-2",
                          cfg.deepCopy ? "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900" : "bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900")}>
                          <div className="flex-1">
                            <p className="text-sm font-medium flex items-center gap-1">
                              Duplicate ads from original ad set
                              <IconInfoCircle className="size-3 text-muted-foreground" />
                              {cfg.deepCopy && (
                                <span className="ml-2 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                                  ✓ Will copy {cfg.selectedAdIds.length} ad{cfg.selectedAdIds.length !== 1 ? "s" : ""}
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{cfg.deepCopy ? `${cfg.selectedAdIds.length} ad${cfg.selectedAdIds.length !== 1 ? "s" : ""} from original ad set will be copied` : "Copy all existing ads to new ad set"}</p>
                          </div>
                          <button onClick={() => {
                            const next = !cfg.deepCopy
                            updateCfg({ deepCopy: next })
                            if (next) fetchAdsForCfg()
                          }}
                            className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 mt-0.5",
                              cfg.deepCopy ? "bg-emerald-500" : "bg-muted-foreground/30")}>
                            <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                              cfg.deepCopy ? "translate-x-4" : "translate-x-0.5")} />
                          </button>
                        </div>
                        {cfg.deepCopy && (
                          <div className="space-y-2 mt-2">
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-[11px] font-medium">Duplicated ads status <span className="text-muted-foreground italic">Ads will be created as {cfg.duplicatedAdsStatus}</span></label>
                              <Select value={cfg.duplicatedAdsStatus} onValueChange={v => updateCfg({ duplicatedAdsStatus: v as "ACTIVE" | "PAUSED" })}>
                                <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="PAUSED">PAUSED</SelectItem>
                                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b text-[11px]">
                                <button
                                  onClick={() => {
                                    const allSelected = cfg.adsList.length > 0 && cfg.selectedAdIds.length === cfg.adsList.length
                                    updateCfg({ selectedAdIds: allSelected ? [] : cfg.adsList.map(a => a.id) })
                                  }}
                                  className="font-medium flex items-center gap-1.5 hover:text-foreground"
                                >
                                  <input
                                    type="checkbox"
                                    readOnly
                                    checked={cfg.adsList.length > 0 && cfg.selectedAdIds.length === cfg.adsList.length}
                                    ref={el => { if (el) el.indeterminate = cfg.selectedAdIds.length > 0 && cfg.selectedAdIds.length < cfg.adsList.length }}
                                    className="size-3.5"
                                  />
                                  Choose ads to copy <span className="text-muted-foreground">{cfg.selectedAdIds.length}/{cfg.adsList.length}</span>
                                </button>
                                <div className="flex items-center gap-3 text-muted-foreground">
                                  <span>None</span>
                                  <span>Use only</span>
                                  <span>All</span>
                                  <IconChevronDown className="size-3" />
                                </div>
                              </div>
                              <div className="max-h-40 overflow-y-auto">
                                {cfg.adsLoading ? (
                                  <div className="px-3 py-3 text-xs text-muted-foreground flex items-center gap-2">
                                    <IconLoader2 className="size-3 animate-spin" />Loading ads...
                                  </div>
                                ) : cfg.adsList.length === 0 ? (
                                  <div className="px-3 py-3 text-xs text-muted-foreground italic">No ads in this ad set</div>
                                ) : cfg.adsList.map(ad => {
                                  const checked = cfg.selectedAdIds.includes(ad.id)
                                  return (
                                    <label key={ad.id} className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-muted/20 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={e => {
                                          updateCfg({
                                            selectedAdIds: e.target.checked
                                              ? [...cfg.selectedAdIds, ad.id]
                                              : cfg.selectedAdIds.filter(id => id !== ad.id),
                                          })
                                        }}
                                        className="size-3.5"
                                      />
                                      <IconBrandMeta className="size-3.5 text-[#0064E0]" />
                                      <span className="flex-1 truncate text-xs font-medium">{ad.name}</span>
                                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold border",
                                        ad.effective_status === "ACTIVE"
                                          ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                                          : "bg-muted text-muted-foreground border-border"
                                      )}>
                                        {ad.effective_status}
                                      </span>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        )}
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

        </div>{/* end scrollable body */}

        {/* Footer */}
        <div className="px-5 py-3 border-t flex items-center justify-between shrink-0">
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
                {step === 1 ? (
                  <Button
                    onClick={createCampaignsAndContinue}
                    disabled={!selectedCampaignId || !campaignName.trim() || creating}
                    className="min-w-[200px]"
                  >
                    {creating
                      ? <><IconLoader2 className="size-4 animate-spin mr-1" />Creating...</>
                      : <>Create {campaignCount} Campaign{campaignCount > 1 ? "s" : ""} & Continue<IconArrowRight className="size-3.5 ml-1" /></>
                    }
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
        if (t === "date") {
          const fmt = settings.naming.dateFormat
          if (fmt === "yyyy-mm-dd") return "2025-10-17"
          if (fmt === "mm-dd-yyyy") return "10-17-2025"
          if (fmt === "dd-mm-yyyy") return "17-10-2025"
          if (fmt === "mmm-dd") return "Oct-17"
          if (fmt === "dd-mmm-yy") return "17-Oct-25"
          if (fmt === "yyyymmdd") return "20251017"
          if (fmt === "mmm-dd-yyyy") return "Oct-17-2025"
          if (fmt === "dd/mm/yyyy") return "17/10/2025"
          if (fmt === "mm/dd/yyyy") return "10/17/2025"
          if (fmt === "WwwYyy") return "W42Y25"
          if (fmt === "Www") return "W42"
          if (fmt === "Yyy") return "Y25"
          return "Oct-17"
        }
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
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={() => setSettings(s => ({ ...s, links: { ...s.links, utmParameters: "utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}" } }))}
                      >Add recommended tags</button>
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

// ─── Ad Copy Templates ────────────────────────────────────────────────────────

interface AdCopyTemplate {
  id: string
  name: string
  primaryText: string
  headline: string
  description?: string
  link?: string
  cta: string
  createdAt: string
}

function AdCopyTemplateModal({
  open, onClose, adAccountId, adAccountName,
  onApply,
  currentPrimaryText, currentHeadline, currentDescription, currentLink, currentCta,
}: {
  open: boolean; onClose: () => void
  adAccountId: string; adAccountName: string
  onApply: (t: Omit<AdCopyTemplate, "id" | "name" | "createdAt">) => void
  currentPrimaryText: string; currentHeadline: string
  currentDescription: string; currentLink: string; currentCta: string
}) {
  const [templates, setTemplates] = useState<AdCopyTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<"newest" | "oldest">("newest")
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  // Create/Edit state
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AdCopyTemplate | null>(null)
  const [formName, setFormName] = useState("")
  const [formPrimaryText, setFormPrimaryText] = useState("")
  const [formHeadline, setFormHeadline] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formLink, setFormLink] = useState("")
  const [formCta, setFormCta] = useState("SHOP_NOW")

  // Load from Ad Set state
  const [loadOpen, setLoadOpen] = useState(false)
  const [loadSearch, setLoadSearch] = useState("")
  const [loadingAds, setLoadingAds] = useState(false)
  const [existingAds, setExistingAds] = useState<any[]>([])

  // Expanded rows
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(["__default__"]))

  const dbToLocal = (t: any): AdCopyTemplate => ({
    id: t.id,
    name: t.name,
    primaryText: t.primary_text || "",
    headline: t.headline || "",
    description: t.description || "",
    link: t.link || "",
    cta: t.cta || "SHOP_NOW",
    createdAt: t.created_at,
  })

  useEffect(() => {
    if (!open) return
    setSearch(""); setPage(1)
    setLoadingTemplates(true)
    fetch(`/api/templates`)
      .then(r => r.json())
      .then(d => setTemplates((d.templates || []).map(dbToLocal)))
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false))
  }, [open])

  // Read Default Settings
  const defaultCopy = useMemo(() => {
    try {
      const raw = localStorage.getItem(`default_ad_settings_${adAccountId}`)
      if (!raw) return null
      const s: DefaultAdSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
      return s.adCopy
    } catch { return null }
  }, [open, adAccountId])

  const defaultLinks = useMemo(() => {
    try {
      const raw = localStorage.getItem(`default_ad_settings_${adAccountId}`)
      if (!raw) return null
      const s: DefaultAdSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
      return s.links
    } catch { return null }
  }, [open, adAccountId])

  const filtered = useMemo(() => {
    let ts = [...templates]
    if (search) {
      const q = search.toLowerCase()
      ts = ts.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.primaryText.toLowerCase().includes(q) ||
        t.headline.toLowerCase().includes(q)
      )
    }
    ts.sort((a, b) =>
      sort === "newest"
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    return ts
  }, [templates, search, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleExpand = (id: string) =>
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const openCreate = (prefill?: Partial<AdCopyTemplate>) => {
    setEditTarget(null)
    setFormName(prefill?.name || "")
    setFormPrimaryText(prefill?.primaryText ?? currentPrimaryText)
    setFormHeadline(prefill?.headline ?? currentHeadline)
    setFormDescription(prefill?.description ?? currentDescription)
    setFormLink(prefill?.link ?? currentLink)
    setFormCta(prefill?.cta ?? (currentCta || "SHOP_NOW"))
    setCreateOpen(true)
  }

  const openEdit = (t: AdCopyTemplate) => {
    setEditTarget(t)
    setFormName(t.name)
    setFormPrimaryText(t.primaryText)
    setFormHeadline(t.headline)
    setFormDescription(t.description || "")
    setFormLink(t.link || "")
    setFormCta(t.cta)
    setCreateOpen(true)
  }

  const handleSaveTemplate = async () => {
    if (!formName.trim() || !adAccountId) return
    setSaving(true)
    try {
      if (editTarget) {
        const r = await fetch(`/api/templates/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName, primary_text: formPrimaryText, headline: formHeadline, description: formDescription, link: formLink, cta: formCta }),
        })
        if (r.ok) {
          const d = await r.json()
          setTemplates(prev => prev.map(t => t.id === editTarget.id ? dbToLocal(d.template) : t))
        }
      } else {
        const r = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ad_account_id: adAccountId, name: formName.trim(), primary_text: formPrimaryText, headline: formHeadline, description: formDescription, link: formLink, cta: formCta }),
        })
        if (r.ok) {
          const d = await r.json()
          setTemplates(prev => [dbToLocal(d.template), ...prev])
        }
      }
      setCreateOpen(false)
    } finally { setSaving(false) }
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return
    setTemplates(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/templates/${id}`, { method: "DELETE" })
  }

  const applyDefault = () => {
    onApply({
      primaryText: defaultCopy?.primaryText || "",
      headline: defaultCopy?.headline || "",
      description: defaultCopy?.description || "",
      link: defaultLinks?.webLink || "",
      cta: defaultCopy?.cta || "SHOP_NOW",
    })
    onClose()
  }

  const applyTemplate = (t: AdCopyTemplate) => {
    onApply({ primaryText: t.primaryText, headline: t.headline, description: t.description, link: t.link, cta: t.cta })
    onClose()
  }

  const fetchExistingAds = async () => {
    setLoadingAds(true)
    try {
      const res = await fetch(`/api/facebook/existing-ads?ad_account_id=${encodeURIComponent(adAccountId)}&active_only=1&limit=100`)
      const data = await res.json()
      const adsWithCopy = (data.ads || []).filter((a: any) => a.primaryText || a.headline)
      
      const seen = new Set<string>()
      const uniqueAds = adsWithCopy.filter((a: any) => {
        const key = `${(a.primaryText || "").trim()}|||${(a.headline || "").trim()}|||${(a.link || "").trim()}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      
      setExistingAds(uniqueAds)
    } catch {}
    setLoadingAds(false)
  }

  const openLoadFromAdSet = () => {
    setLoadSearch("")
    setLoadOpen(true)
    if (existingAds.length === 0) fetchExistingAds()
  }

  const filteredAds = useMemo(() => {
    if (!loadSearch) return existingAds
    const q = loadSearch.toLowerCase()
    return existingAds.filter(a =>
      a.name?.toLowerCase().includes(q) ||
      a.primaryText?.toLowerCase().includes(q) ||
      a.headline?.toLowerCase().includes(q)
    )
  }, [existingAds, loadSearch])

  const applyFromAd = (ad: any) => {
    onApply({ primaryText: ad.primaryText || "", headline: ad.headline || "", description: ad.description, link: ad.link, cta: ad.cta || "LEARN_MORE" })
    onClose()
  }

  const saveAdAsTemplate = (ad: any) => {
    openCreate({ name: ad.name || "", primaryText: ad.primaryText || "", headline: ad.headline || "", description: ad.description, link: ad.link, cta: ad.cta || "LEARN_MORE" })
    setLoadOpen(false)
  }

  const formattedDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden [&>button:last-of-type]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
          <DialogTitle className="text-base font-bold">Select The Ad Copy Template</DialogTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={openLoadFromAdSet}>
              <IconCopy className="size-3.5" />Load from Ad Set
              <IconInfoCircle className="size-3.5 text-muted-foreground" />
            </Button>
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => openCreate()}>
              <IconPlus className="size-3.5" />Create Ad Copy Template
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b shrink-0 bg-muted/20">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search Ad Copy Templates..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-background border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
            />
          </div>
          <Select value={sort} onValueChange={v => setSort(v as any)}>
            <SelectTrigger className="h-9 w-28 text-xs bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 h-9 px-3 border rounded-lg bg-background text-xs text-muted-foreground">
            <IconBuildingStore className="size-3.5" />
            <span className="truncate max-w-[120px]">{adAccountName}</span>
          </div>
        </div>

        {/* Template list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {loadingTemplates && (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <IconLoader2 className="size-4 animate-spin" /><span className="text-sm">Loading templates...</span>
            </div>
          )}
          {/* Default Settings card */}
          {!search && (
            <div className="border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => toggleExpand("__default__")}
                  className={cn("size-7 rounded-lg border flex items-center justify-center shrink-0 hover:bg-muted/40 transition-colors",
                    expandedIds.has("__default__") && "bg-muted/40")}
                >
                  <IconChevronDown className={cn("size-3.5 transition-transform", expandedIds.has("__default__") && "rotate-180")} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Default Settings</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 font-medium">Default</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {[defaultCopy?.headline, defaultCopy?.cta, defaultLinks?.webLink ? new URL(defaultLinks.webLink.startsWith("http") ? defaultLinks.webLink : `https://${defaultLinks.webLink}`).hostname : null].filter(Boolean).join(" · ") || "No defaults configured"}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formattedDate(new Date().toISOString())}
                </span>
                <Button size="sm" className="h-8 px-4 shrink-0" onClick={applyDefault}
                  disabled={!defaultCopy?.primaryText && !defaultCopy?.headline}>
                  Apply
                </Button>
                <button onClick={() => {/* open settings */}} className="text-muted-foreground hover:text-foreground p-1">
                  <IconSettings className="size-4" />
                </button>
              </div>
              {expandedIds.has("__default__") && (
                <div className="border-t px-4 py-3 bg-muted/20 space-y-2">
                  {defaultCopy?.primaryText && (
                    <div className="grid grid-cols-[120px_1fr] gap-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pt-0.5">Primary Text</span>
                      <p className="text-xs leading-relaxed line-clamp-4">{defaultCopy.primaryText}</p>
                    </div>
                  )}
                  {defaultCopy?.headline && (
                    <div className="grid grid-cols-[120px_1fr] gap-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Headline</span>
                      <p className="text-xs">{defaultCopy.headline}</p>
                    </div>
                  )}
                  {defaultLinks?.webLink && (
                    <div className="grid grid-cols-[120px_1fr] gap-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Link</span>
                      <p className="text-xs text-muted-foreground truncate">{defaultLinks.webLink}</p>
                    </div>
                  )}
                  {defaultCopy?.cta && (
                    <div className="grid grid-cols-[120px_1fr] gap-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">CTA</span>
                      <p className="text-xs">{defaultCopy.cta}</p>
                    </div>
                  )}
                  {!defaultCopy?.primaryText && !defaultCopy?.headline && (
                    <p className="text-xs text-muted-foreground italic">No defaults set. Configure in Settings → Ad Copy Defaults.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* User templates */}
          {pageItems.map(t => (
            <div key={t.id} className="border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => toggleExpand(t.id)}
                  className={cn("size-7 rounded-lg border flex items-center justify-center shrink-0 hover:bg-muted/40 transition-colors",
                    expandedIds.has(t.id) && "bg-muted/40")}
                >
                  <IconChevronDown className={cn("size-3.5 transition-transform", expandedIds.has(t.id) && "rotate-180")} />
                </button>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold">{t.name}</span>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {[t.headline, t.cta, t.link ? (() => { try { return new URL(t.link).hostname } catch { return t.link } })() : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{formattedDate(t.createdAt)}</span>
                <Button size="sm" className="h-8 px-4 shrink-0" onClick={() => applyTemplate(t)}>Apply</Button>
                <div className="relative group">
                  <button className="text-muted-foreground hover:text-foreground p-1">
                    <IconSettings className="size-4" />
                  </button>
                  <div className="absolute right-0 top-full mt-1 bg-popover border rounded-lg shadow-lg z-50 hidden group-hover:block w-36">
                    <button onClick={() => openEdit(t)} className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2">
                      <IconPencil className="size-3.5" />Edit
                    </button>
                    <button onClick={() => deleteTemplate(t.id)} className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-accent flex items-center gap-2">
                      <IconTrash className="size-3.5" />Delete
                    </button>
                  </div>
                </div>
              </div>
              {expandedIds.has(t.id) && (
                <div className="border-t px-4 py-3 bg-muted/20 space-y-2">
                  {t.primaryText && (
                    <div className="grid grid-cols-[120px_1fr] gap-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pt-0.5">Primary Text</span>
                      <p className="text-xs leading-relaxed whitespace-pre-wrap line-clamp-4">{t.primaryText}</p>
                    </div>
                  )}
                  {t.headline && (
                    <div className="grid grid-cols-[120px_1fr] gap-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Headline</span>
                      <p className="text-xs">{t.headline}</p>
                    </div>
                  )}
                  {t.link && (
                    <div className="grid grid-cols-[120px_1fr] gap-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Link</span>
                      <p className="text-xs text-muted-foreground truncate">{t.link}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">CTA</span>
                    <p className="text-xs">{t.cta}</p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && !search && templates.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <p className="font-medium mb-1">No templates yet</p>
              <p className="text-xs">Click "Create Ad Copy Template" to save your first one.</p>
            </div>
          )}
          {filtered.length === 0 && search && (
            <div className="text-center py-10 text-sm text-muted-foreground">No templates match "{search}"</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t shrink-0 bg-background">
          <p className="text-xs text-muted-foreground">Viewing <span className="font-medium">{filtered.length}</span> Template{filtered.length !== 1 ? "s" : ""}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <IconChevronLeft className="size-3.5 mr-1" />Previous
            </Button>
            <span className="text-sm font-medium px-2">{page}</span>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              Next<IconChevronRight className="size-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Create / Edit dialog */}
      <Dialog open={createOpen} onOpenChange={v => !v && setCreateOpen(false)}>
        <DialogContent className="max-w-lg max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
          <div className="px-5 py-4 border-b shrink-0">
            <DialogTitle className="text-sm font-bold">{editTarget ? "Edit Template" : "Create Ad Copy Template"}</DialogTitle>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Template Name <span className="text-destructive">*</span></label>
              <input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Black Friday Sale 2025"
                className="w-full px-3 py-2 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Primary Text</label>
              <textarea
                value={formPrimaryText}
                onChange={e => setFormPrimaryText(e.target.value)}
                rows={5}
                placeholder="Write your primary ad text..."
                className="w-full px-3 py-2.5 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Headline</label>
              <input
                value={formHeadline}
                onChange={e => setFormHeadline(e.target.value)}
                placeholder="Enter headline..."
                className="w-full px-3 py-2 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Description (optional)</label>
              <input
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="Enter description..."
                className="w-full px-3 py-2 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Web Link (optional)</label>
                <input
                  type="url"
                  value={formLink}
                  onChange={e => setFormLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">CTA</label>
                <Select value={formCta} onValueChange={setFormCta}>
                  <SelectTrigger className="h-9 text-sm bg-muted/30"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CTA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t shrink-0">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSaveTemplate} disabled={!formName.trim() || saving}>
              {saving && <IconLoader2 className="size-3.5 mr-1.5 animate-spin" />}
              {editTarget ? "Save Changes" : "Create Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Load from Ad Set dialog */}
      <Dialog open={loadOpen} onOpenChange={v => !v && setLoadOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
          <div className="px-5 py-4 border-b shrink-0">
            <DialogTitle className="text-sm font-bold">Load from Ad Set</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Select an active ad to import its copy</p>
          </div>
          <div className="px-5 py-3 border-b shrink-0">
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
              <input
                value={loadSearch}
                onChange={e => setLoadSearch(e.target.value)}
                placeholder="Search ads by name or copy..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {loadingAds && (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <IconLoader2 className="size-4 animate-spin" />
                <span className="text-sm">Loading active ads...</span>
              </div>
            )}
            {!loadingAds && filteredAds.length === 0 && (
              <div className="text-center py-10 text-sm text-muted-foreground">
                {loadSearch ? `No ads match "${loadSearch}"` : "No active ads with copy found in this account"}
              </div>
            )}
            {!loadingAds && filteredAds.map((ad: any) => (
              <div key={ad.id} className="border rounded-lg p-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{ad.name}</p>
                    <p className="text-[11px] text-muted-foreground">{ad.effective_status}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => saveAdAsTemplate(ad)}>
                      <IconBookmark className="size-3" />Save
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={() => applyFromAd(ad)}>Apply</Button>
                  </div>
                </div>
                <div className="space-y-1">
                  {ad.primaryText && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{ad.primaryText}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {ad.headline && <span className="text-[11px] font-medium">{ad.headline}</span>}
                    {ad.cta && <span className="text-[11px] text-muted-foreground">{ad.cta}</span>}
                    {ad.link && <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">{(() => { try { return new URL(ad.link).hostname } catch { return ad.link } })()}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

// ─── Ad Setup Panel ───────────────────────────────────────────────────────────

// ─── Web Link + UTM + Display Link ────────────────────────────────────────────

const META_DYNAMIC_PARAMS = [
  { label: "Campaign Name",  value: "{{campaign.name}}" },
  { label: "Campaign ID",    value: "{{campaign.id}}" },
  { label: "Ad Set Name",    value: "{{adset.name}}" },
  { label: "Ad Set ID",      value: "{{adset.id}}" },
  { label: "Ad Name",        value: "{{ad.name}}" },
  { label: "Ad ID",          value: "{{ad.id}}" },
  { label: "Platform",       value: "{{site_source_name}}" },
  { label: "Placement",      value: "{{placement}}" },
]

const UTM_SUGGESTIONS = [
  {
    label: "Standard Facebook",
    value: "utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}",
  },
  {
    label: "Full tracking",
    value: "utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&utm_id={{ad.id}}",
  },
  {
    label: "Simple",
    value: "utm_source=facebook&utm_medium=cpc",
  },
]

function WebLinkSection({ webLink, setWebLink, utmParams, setUtmParams, displayLink, setDisplayLink }: {
  webLink: string; setWebLink: (v: string) => void
  utmParams: string; setUtmParams: (v: string) => void
  displayLink: string; setDisplayLink: (v: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [dynOpen, setDynOpen] = useState(false)
  const [utmSugOpen, setUtmSugOpen] = useState(false)
  const utmRef = useRef<HTMLInputElement>(null)

  const insertAtCursor = (text: string) => {
    const el = utmRef.current
    if (!el) { setUtmParams((utmParams ? utmParams + "&" : "") + text); return }
    const start = el.selectionStart ?? utmParams.length
    const end = el.selectionEnd ?? utmParams.length
    const next = utmParams.slice(0, start) + text + utmParams.slice(end)
    setUtmParams(next)
    setTimeout(() => { el.focus(); el.setSelectionRange(start + text.length, start + text.length) }, 0)
  }

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1.5">Web Link</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <IconWorld className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
          <input type="url" value={webLink} onChange={e => setWebLink(e.target.value)}
            placeholder="https://..."
            className="w-full pl-8 pr-3 py-2.5 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50" />
        </div>
        <Button
          variant="outline" size="icon"
          className="size-9 shrink-0"
          onClick={() => setExpanded(v => !v)}
          title={expanded ? "Hide UTM & Display Link" : "Add UTM Parameters & Display Link"}
        >
          {expanded ? <IconMinus className="size-3.5" /> : <IconPlus className="size-3.5" />}
        </Button>
      </div>

      {expanded && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {/* UTM Parameters */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium text-primary">UTM Parameters</label>
              <div className="flex items-center gap-1">
                {/* Dynamic params */}
                <Popover open={dynOpen} onOpenChange={setDynOpen}>
                  <PopoverTrigger asChild>
                    <button className="text-[10px] px-1.5 py-0.5 border rounded font-mono text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
                      {"{ }"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-1" align="end">
                    <p className="text-[10px] text-muted-foreground px-2 py-1 font-medium">Meta Dynamic Params</p>
                    {META_DYNAMIC_PARAMS.map(p => (
                      <button key={p.value} onClick={() => { insertAtCursor(p.value); setDynOpen(false) }}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">{p.label}</span>
                        <span className="font-mono text-[10px] text-primary truncate">{p.value}</span>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
                {/* Suggestions */}
                <Popover open={utmSugOpen} onOpenChange={setUtmSugOpen}>
                  <PopoverTrigger asChild>
                    <button className="text-[10px] text-primary hover:underline">from suggest</button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-1" align="end">
                    <p className="text-[10px] text-muted-foreground px-2 py-1 font-medium">UTM Templates</p>
                    {UTM_SUGGESTIONS.map(s => (
                      <button key={s.label} onClick={() => { setUtmParams(s.value); setUtmSugOpen(false) }}
                        className="w-full text-left px-2 py-2 hover:bg-muted rounded">
                        <p className="text-xs font-medium mb-0.5">{s.label}</p>
                        <p className="text-[10px] text-muted-foreground font-mono break-all leading-tight">{s.value}</p>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <input
              ref={utmRef}
              type="text"
              value={utmParams}
              onChange={e => setUtmParams(e.target.value)}
              placeholder="utm_source=facebook&utm_medium=paid"
              className="w-full px-3 py-2 text-xs bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40 font-mono"
            />
            {utmParams && webLink && (
              <p className="text-[10px] text-muted-foreground/60 mt-1 truncate font-mono">
                → {webLink}{webLink.includes("?") ? "&" : "?"}{utmParams}
              </p>
            )}
          </div>

          {/* Display Link */}
          <div>
            <label className="text-[11px] font-medium text-primary block mb-1">Display Link</label>
            <input
              type="text"
              value={displayLink}
              onChange={e => setDisplayLink(e.target.value)}
              placeholder="e.g. wellnessnest.co/shop"
              className="w-full px-3 py-2 text-xs bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40"
            />
            <p className="text-[10px] text-muted-foreground/60 mt-1 leading-tight">
              Short URL shown in the ad (does not affect destination)
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

type AdSourceMode = "new_ad" | "post_id" | "creative_id"

function AdSetupPanel({
  primaryTexts, setPrimaryTexts,
  headlines, setHeadlines,
  description, setDescription,
  cta, setCta,
  webLink, setWebLink,
  utmParams, setUtmParams,
  displayLink, setDisplayLink,
  launchAsActive, setLaunchAsActive,
  adAccountId, adAccountName, orgName,
  selectedCreatives,
  adSourceMode, setAdSourceMode,
  adSourceIds, setAdSourceIds,
}: {
  primaryTexts: string[]; setPrimaryTexts: (v: string[]) => void
  headlines: string[]; setHeadlines: (v: string[]) => void
  description: string; setDescription: (v: string) => void
  cta: string; setCta: (v: string) => void
  webLink: string; setWebLink: (v: string) => void
  utmParams: string; setUtmParams: (v: string) => void
  displayLink: string; setDisplayLink: (v: string) => void
  launchAsActive: boolean; setLaunchAsActive: (v: boolean) => void
  adAccountId: string
  adAccountName: string
  orgName: string
  selectedCreatives: Creative[]
  adSourceMode: AdSourceMode
  setAdSourceMode: (v: AdSourceMode) => void
  adSourceIds: Record<string, string>
  setAdSourceIds: (v: Record<string, string>) => void
}) {
  const [showDesc, setShowDesc] = useState(() => !!description)
  useEffect(() => { if (description) setShowDesc(true) }, [description])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [copyTemplateOpen, setCopyTemplateOpen] = useState(false)
  const [showAiVariations, setShowAiVariations] = useState(false)
  const [aiVariations, setAiVariations] = useState<{ angle: string; text: string }[]>([])
  const [loadingAiVariations, setLoadingAiVariations] = useState(false)
  const [aiVariationsError, setAiVariationsError] = useState<string | null>(null)
  const [addedVariations, setAddedVariations] = useState<Set<number>>(new Set())

  // Generate from URL/Video state
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [genMode, setGenMode] = useState<"url" | "video">("url") // kept for compat, unused
  const [genUrl, setGenUrl] = useState("")
  const [genCreative, setGenCreative] = useState<Creative | null>(null)
  const [generatingCopy, setGeneratingCopy] = useState(false)
  const [generateCopyStep, setGenerateCopyStep] = useState("")
  const [generateCopyError, setGenerateCopyError] = useState<string | null>(null)

  const updateText = (idx: number, val: string) => {
    const next = [...primaryTexts]; next[idx] = val; setPrimaryTexts(next)
  }
  const addText = () => setPrimaryTexts([...primaryTexts, ""])
  const removeText = (idx: number) => setPrimaryTexts(primaryTexts.filter((_, i) => i !== idx))

  const handleOpenAiVariations = async (sourceOverride?: string) => {
    const sourceText = sourceOverride ?? primaryTexts[0]?.trim()
    setShowAiVariations(true)
    if (!sourceText) return
    setAiVariations([])
    setAiVariationsError(null)
    setAddedVariations(new Set())
    setLoadingAiVariations(true)
    try {
      const res = await fetch("/api/launch/ai-variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText, headline: headlines[0] }),
      })
      const data = await res.json()
      if (data.error) setAiVariationsError(data.error)
      else setAiVariations(data.variations || [])
    } catch {
      setAiVariationsError("Network error. Please try again.")
    } finally {
      setLoadingAiVariations(false)
    }
  }

  const handleAddVariation = (text: string, idx: number) => {
    setPrimaryTexts([...primaryTexts.filter(t => t.trim()), text])
    setAddedVariations(prev => new Set(prev).add(idx))
  }

  const handleReplaceWithVariation = (text: string, idx: number) => {
    const next = [...primaryTexts]; next[0] = text; setPrimaryTexts(next)
    setAddedVariations(prev => new Set(prev).add(idx))
  }

  const updateHeadline = (idx: number, val: string) => {
    const next = [...headlines]; next[idx] = val; setHeadlines(next)
  }
  const addHeadline = () => setHeadlines([...headlines, ""])
  const removeHeadline = (idx: number) => setHeadlines(headlines.filter((_, i) => i !== idx))

  const openGenerateModal = () => {
    setShowGenerateModal(true)
    setGenerateCopyError(null)
  }

  const handleGenerateCopy = async () => {
    const hasUrl = !!genUrl.trim()
    const hasVideo = !!genCreative
    if (!hasUrl && !hasVideo) { setGenerateCopyError("Nhập URL hoặc chọn video để generate"); return }
    setGeneratingCopy(true)
    setGenerateCopyError(null)
    try {
      let body: Record<string, string>
      if (hasUrl && hasVideo) {
        body = { type: "both", url: genUrl.trim(), videoUrl: genCreative!.file_url }
        setGenerateCopyStep("Đang phân tích URL & video...")
      } else if (hasUrl) {
        body = { type: "url", url: genUrl.trim() }
        setGenerateCopyStep("Fetching page...")
      } else {
        body = { type: "video", url: genCreative!.file_url }
        setGenerateCopyStep("Uploading video...")
      }
      const res = await fetch("/api/inspo/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      setGenerateCopyStep("Generating copy...")
      const data = await res.json()
      if (data.error) { setGenerateCopyError(data.error); return }
      const g = data.generated
      setPrimaryTexts(g.primary_texts.map((p: { text: string }) => p.text))
      setHeadlines(g.headlines)
      if (g.descriptions?.[0]) setDescription(g.descriptions[0])
      if (g.cta) setCta(g.cta)
      if (hasUrl) setWebLink(genUrl.trim())
      setShowGenerateModal(false)
      setGenUrl("")
      setGenCreative(null)
    } catch { setGenerateCopyError("Network error. Please try again.") }
    finally { setGeneratingCopy(false); setGenerateCopyStep("") }
  }

  return (
    <div className="border rounded-xl bg-card">
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        adAccountId={adAccountId}
        adAccountName={adAccountName}
        orgName={orgName}
      />
      {/* AI Variations Modal */}
      <Dialog open={showAiVariations} onOpenChange={(open) => { setShowAiVariations(open); if (!open) { setAiVariations([]); setAiVariationsError(null) } }}>
        <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconSparkles className="size-4 text-primary" />
              AI Variations
            </DialogTitle>
          </DialogHeader>

          {/* No source text → ask user to enter text first */}
          {!primaryTexts[0]?.trim() && !loadingAiVariations && aiVariations.length === 0 && !aiVariationsError ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Nhập primary text để AI tạo 5 variations:</p>
              <textarea
                placeholder="Write your primary ad text..."
                rows={5}
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
                onChange={e => { const next = [...primaryTexts]; next[0] = e.target.value; setPrimaryTexts(next) }}
              />
              <Button className="w-full gap-2" onClick={() => handleOpenAiVariations(primaryTexts[0]?.trim())}
                disabled={!primaryTexts[0]?.trim()}>
                <IconSparkles className="size-4" />Generate variations
              </Button>
            </div>
          ) : (
            <>
              {/* Source text preview */}
              {primaryTexts[0]?.trim() && (
                <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs text-muted-foreground border shrink-0">
                  <span className="font-medium text-foreground">Source: </span>
                  {primaryTexts[0]?.slice(0, 120)}{(primaryTexts[0]?.length ?? 0) > 120 ? "…" : ""}
                </div>
              )}

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {loadingAiVariations ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <IconLoader2 className="size-7 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Generating variations...</p>
              </div>
            ) : aiVariationsError ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <IconAlertCircle className="size-7 text-destructive/50" />
                <p className="text-sm text-muted-foreground">{aiVariationsError}</p>
                <Button size="sm" variant="outline" onClick={() => handleOpenAiVariations()}>Try again</Button>
              </div>
            ) : (
              aiVariations.map((v, i) => (
                <div key={i} className="border rounded-xl p-3.5 space-y-2 bg-card">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {v.angle}
                    </span>
                    {addedVariations.has(i) && (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                        <IconCheck className="size-3" />Added
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">{v.text}</p>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="text-xs gap-1.5 flex-1"
                      onClick={() => handleAddVariation(v.text, i)}>
                      <IconPlus className="size-3" />Add
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs gap-1.5 flex-1"
                      onClick={() => handleReplaceWithVariation(v.text, i)}>
                      <IconRefresh className="size-3" />Replace
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AdCopyTemplateModal
        open={copyTemplateOpen}
        onClose={() => setCopyTemplateOpen(false)}
        adAccountId={adAccountId}
        adAccountName={adAccountName}
        currentPrimaryText={primaryTexts[0] || ""}
        currentHeadline={headlines[0] || ""}
        currentDescription={description}
        currentLink={webLink}
        currentCta={cta}
        onApply={t => {
          if (t.primaryText) setPrimaryTexts([t.primaryText])
          if (t.headline) setHeadlines([t.headline])
          if (t.description) setDescription(t.description)
          if (t.link) setWebLink(t.link)
          if (t.cta) setCta(t.cta)
        }}
      />

      {/* Generate Copy from URL/Video Modal */}
      <Dialog open={showGenerateModal} onOpenChange={(open) => { setShowGenerateModal(open); if (!open) { setGenerateCopyError(null) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconSparkles className="size-4 text-primary" />
              Generate Ad Copy with AI
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">AI sẽ tạo primary text, headline, description và CTA — tự điền vào các field bên dưới.</p>

          {/* Combined mode badge */}
          {genUrl.trim() && genCreative && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary font-medium w-fit">
              <IconSparkles className="size-3.5" />Kết hợp URL + Video — kết quả tốt nhất
            </div>
          )}

          {/* URL input — always shown */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium flex items-center gap-1.5">
              <IconWorld className="size-3.5 text-muted-foreground" />
              Landing Page URL
              <span className="text-muted-foreground/50 font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={genUrl}
              onChange={e => { setGenUrl(e.target.value); setWebLink(e.target.value) }}
              placeholder="https://example.com/product"
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
              onKeyDown={e => e.key === "Enter" && handleGenerateCopy()}
            />
          </div>

          {/* Video picker — always shown */}
          {(() => {
            const sessionVideos = selectedCreatives.filter(c => c.media_type === "video")
            return (
              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-1.5">
                  <IconVideo className="size-3.5 text-muted-foreground" />
                  Video
                  <span className="text-muted-foreground/50 font-normal">(optional)</span>
                </label>
                {sessionVideos.length === 0 ? (
                  <div className="py-4 text-center text-xs text-muted-foreground border rounded-lg bg-muted/20">
                    Chưa có video nào. Thêm video vào ads trước.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto">
                    {sessionVideos.map(c => (
                      <button key={c.id} onClick={() => setGenCreative(genCreative?.id === c.id ? null : c)}
                        className={cn("relative rounded-lg overflow-hidden border-2 transition-all aspect-video bg-muted",
                          genCreative?.id === c.id ? "border-primary ring-1 ring-primary" : "border-transparent hover:border-muted-foreground/40"
                        )}>
                        <CreativeCardMedia creative={c} compact />
                        {genCreative?.id === c.id && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <IconCheck className="size-5 text-primary" />
                          </div>
                        )}
                        <p className="absolute bottom-0 left-0 right-0 text-[9px] truncate px-1 py-0.5 bg-black/50 text-white">{c.file_name}</p>
                      </button>
                    ))}
                  </div>
                )}
                {genCreative && (
                  <p className="text-xs text-muted-foreground">Đã chọn: <strong className="text-foreground">{genCreative.file_name}</strong>
                    <button onClick={() => setGenCreative(null)} className="ml-2 text-destructive hover:underline">Bỏ chọn</button>
                  </p>
                )}
              </div>
            )
          })()}

          {generateCopyError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              <IconAlertCircle className="size-4 shrink-0" />{generateCopyError}
            </div>
          )}

          <Button className="w-full gap-2" onClick={handleGenerateCopy}
            disabled={generatingCopy || (!genUrl.trim() && !genCreative)}>
            {generatingCopy
              ? <><IconLoader2 className="size-4 animate-spin" />{generateCopyStep || "Generating..."}</>
              : <><IconSparkles className="size-4" />Generate & Fill Fields</>
            }
          </Button>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold">Ad Setup</span>
          <span className="text-destructive text-xs font-bold">*</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/5" onClick={openGenerateModal}>
            <IconSparkles className="size-3" />Generate
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setSettingsOpen(true)}>
            <IconSettings className="size-3" />Settings<IconChevronDown className="size-3" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setCopyTemplateOpen(true)}>
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
            <button
              className="text-xs text-primary hover:underline flex items-center gap-1"
              onClick={() => handleOpenAiVariations()}
            >
              <IconSparkles className="size-3" />
              AI Variations
            </button>
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
        <WebLinkSection
          webLink={webLink} setWebLink={setWebLink}
          utmParams={utmParams} setUtmParams={setUtmParams}
          displayLink={displayLink} setDisplayLink={setDisplayLink}
        />

        {/* Ad Source — shown when media is loaded */}
        {selectedCreatives.length > 0 && (() => {
          const resolvedCount = selectedCreatives.filter(c =>
            adSourceMode === "post_id"
              ? !!adSourceIds[c.id]
              : adSourceMode === "creative_id"
                ? !!adSourceIds[c.id]
                : !!(c.fb_video_id || c.fb_image_hash)
          ).length

          const AD_SOURCE_OPTIONS: { value: AdSourceMode; label: string; desc: string }[] = [
            { value: "post_id",     label: "Post ID",      desc: "Full copy · includes engagement" },
            { value: "creative_id", label: "Creative ID",  desc: "Creative only · no engagement"   },
            { value: "new_ad",      label: "New ad",       desc: "Launch fresh · no reused ID"     },
          ]

          return (
            <div className="border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
                <div className="flex items-center gap-1.5">
                  <IconStack2 className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold">Ad Source</span>
                  <IconInfoCircle className="size-3 text-muted-foreground/50" title="How ads reference your creative on Meta" />
                  {adSourceMode === "new_ad"
                    ? <span className="text-[10px] text-green-600 font-medium">{resolvedCount}/{selectedCreatives.length} resolved</span>
                    : resolvedCount > 0
                      ? <span className="text-[10px] text-green-600 font-medium">{resolvedCount}/{selectedCreatives.length} resolved</span>
                      : <span className="text-[10px] text-amber-500 font-medium">0/{selectedCreatives.length} resolved</span>
                  }
                </div>
                <button
                  onClick={() => setAdSourceMode("new_ad")}
                  title="Reset to New ad"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <IconRefresh className="size-3.5" />
                </button>
              </div>

              {/* 3 options */}
              <div className="grid grid-cols-3 gap-1.5 p-2">
                {AD_SOURCE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setAdSourceMode(opt.value)}
                    className={cn(
                      "flex flex-col items-start px-2.5 py-2 rounded-lg border text-left transition-all",
                      adSourceMode === opt.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-muted-foreground/40"
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div className={cn(
                        "size-3 rounded-full border-2 flex items-center justify-center shrink-0",
                        adSourceMode === opt.value ? "border-primary" : "border-muted-foreground/40"
                      )}>
                        {adSourceMode === opt.value && <div className="size-1.5 rounded-full bg-primary" />}
                      </div>
                      <span className="text-[11px] font-semibold leading-tight">{opt.label}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground leading-tight pl-[18px]">{opt.desc}</span>
                  </button>
                ))}
              </div>

              {/* Per-creative ID inputs (Post ID / Creative ID modes) */}
              {(adSourceMode === "post_id" || adSourceMode === "creative_id") && (
                <div className="px-2 pb-2 space-y-1.5">
                  {selectedCreatives.map(c => {
                    const val = adSourceIds[c.id] || ""
                    const isResolved = !!val
                    return (
                      <div key={c.id} className="flex items-center gap-2">
                        <div className="relative size-8 rounded overflow-hidden bg-muted shrink-0">
                          <CreativeCardMedia creative={c} compact className="w-full h-full object-cover" />
                          {isResolved && (
                            <div className="absolute inset-0 bg-green-500/20 flex items-end justify-end p-0.5">
                              <div className="size-3 rounded-full bg-green-500 flex items-center justify-center">
                                <IconCheck className="size-2 text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                        <input
                          type="text"
                          value={val}
                          onChange={e => setAdSourceIds({ ...adSourceIds, [c.id]: e.target.value.trim() })}
                          placeholder={adSourceMode === "post_id" ? "Paste Post ID (e.g. 123_456)" : "Paste Creative ID"}
                          className="flex-1 px-2 py-1 text-[11px] bg-muted/30 border rounded-md outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40"
                        />
                      </div>
                    )
                  })}
                  <p className="text-[10px] text-muted-foreground px-0.5">
                    {adSourceMode === "post_id"
                      ? "Find Post ID in Meta Ads Manager → Ad → Creative → Post ID"
                      : "Find Creative ID in Meta Ads Manager → Ad → Creative → Creative ID"}
                  </p>
                </div>
              )}

              {/* Thumbnails row for new_ad mode */}
              {adSourceMode === "new_ad" && (
                <div className="px-3 pb-3 flex gap-2 flex-wrap">
                  {selectedCreatives.map(c => {
                    const ready = c.media_type === "video" ? (!!c.fb_video_id && c.status === "ready") : !!c.fb_image_hash
                    return (
                      <div key={c.id} className="relative" title={c.file_name}>
                        <div className="size-10 rounded overflow-hidden bg-muted border">
                          <CreativeCardMedia creative={c} compact className="w-full h-full object-cover" />
                        </div>
                        <div className={cn(
                          "absolute -bottom-1 -right-1 size-3.5 rounded-full border border-background flex items-center justify-center",
                          ready ? "bg-green-500" : "bg-amber-400"
                        )}>
                          {ready ? <IconCheck className="size-2 text-white" /> : <IconLoader2 className="size-2 text-white animate-spin" />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}

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
                  className="absolute top-2 left-2 z-1 size-5 rounded-md bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md"
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

// ─── Launch Result Modal ──────────────────────────────────────────────────────

function DetailItem({ label, value, copyable, mono }: { label: string; value: string; copyable?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <span className="text-muted-foreground shrink-0 w-24 text-[11px]">{label}</span>
      <span className={cn("flex-1 text-foreground text-[11px] truncate", mono && "font-mono text-[10px]")} title={value}>{value}</span>
      {copyable && (
        <button onClick={() => navigator.clipboard.writeText(value)} className="text-muted-foreground hover:text-foreground shrink-0">
          <IconCopy className="size-3" />
        </button>
      )}
    </div>
  )
}

function AdResultRow({ index, ad, status, expanded, onToggle, launchMeta }: {
  index: number; ad: CreatedAd; status?: string; expanded: boolean; onToggle: () => void; launchMeta?: LaunchMeta
}) {
  const displayName = ad.fileName?.replace(/\.[^/.]+$/, "") || ad.multiGroup || ad.flexibleAd || ad.carousel || `Ad ${index}`
  const actId = launchMeta?.adAccountId?.replace("act_", "") || ""
  const metaUrl = `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${actId}&filter_set=SEARCH_BY_AD_IDS-STRING_SET%1E${ad.adId}`
  return (
    <>
      <tr className={cn("border-b last:border-0 hover:bg-muted/20 cursor-pointer select-none", expanded && "bg-muted/30")} onClick={onToggle}>
        <td className="px-2 py-1.5 text-muted-foreground w-8">
          <div className="flex items-center gap-0.5 text-xs">{expanded ? <IconChevronDown className="size-3" /> : <IconChevronRight className="size-3" />}{index}</div>
        </td>
        <td className="px-1 py-1.5 w-10">
          {ad.thumbnailUrl
            ? <img src={ad.thumbnailUrl} className="size-8 rounded object-cover" onError={e => e.currentTarget.style.display="none"} />
            : <div className="size-8 rounded bg-muted flex items-center justify-center">{ad.mediaType === "video" ? <IconVideo className="size-3 text-muted-foreground" /> : <IconPhoto className="size-3 text-muted-foreground" />}</div>}
        </td>
        <td className="px-2 py-1.5 text-xs font-medium max-w-[140px] truncate" title={displayName}>{displayName}</td>
        <td className="px-2 py-1.5 w-28">
          {status
            ? <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase", status === "ACTIVE" ? "bg-green-100 text-green-700" : status === "PAUSED" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500")}>{status}</span>
            : <span className="flex items-center gap-1 text-green-600 text-[10px] font-medium"><IconCircleCheck className="size-3" />Success</span>}
        </td>
        <td className="px-2 py-1.5 w-40">
          <div className="flex items-center gap-1">
            <span className="font-mono text-[10px] text-muted-foreground">{ad.adId.slice(0, 15)}…</span>
            <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(ad.adId) }} className="text-muted-foreground hover:text-foreground"><IconCopy className="size-3" /></button>
            <a href={metaUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-500 hover:text-blue-600"><IconExternalLink className="size-3" /></a>
          </div>
        </td>
        <td className="px-2 py-1.5 text-xs text-muted-foreground truncate max-w-[120px]" title={ad.adSetName}>{ad.adSetName}</td>
      </tr>
      {expanded && (
        <tr className="bg-muted/10 border-b">
          <td colSpan={6} className="px-5 py-2.5">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              {launchMeta?.adAccountName && <DetailItem label="Account" value={launchMeta.adAccountName} />}
              <DetailItem label="Ad Set" value={ad.adSetName} />
              {launchMeta?.cta && <DetailItem label="CTA" value={launchMeta.cta} />}
              {launchMeta?.webLink && <DetailItem label="Web Link" value={launchMeta.webLink} copyable />}
              <DetailItem label="Ad ID" value={ad.adId} copyable mono />
              {ad.thumbnailUrl && <DetailItem label="Media URL" value={ad.thumbnailUrl} copyable />}
              {launchMeta?.pageId && <DetailItem label="Page" value={launchMeta.pageName || launchMeta.pageId} />}
              {launchMeta?.headline && <DetailItem label="Headline" value={launchMeta.headline} />}
              {launchMeta?.primaryText && <DetailItem label="Primary Text" value={launchMeta.primaryText} />}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function LaunchResultModal({ result, onClose }: { result: LaunchResult; onClose: () => void }) {
  const [tab, setTab] = useState<"launched" | "performance">("launched")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [adStatuses, setAdStatuses] = useState<Record<string, string>>({})
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [insights, setInsights] = useState<any[]>([])
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [datePreset, setDatePreset] = useState("last_30d")
  const [fetchMs, setFetchMs] = useState<number | null>(null)

  const isSuccess = result.failed === 0
  const isPartial = result.created > 0 && result.failed > 0
  const batchShort = result.batchId
    ? result.batchId.replace(/-/g, "").slice(-6).toUpperCase()
    : Math.floor(Math.random() * 900000 + 100000).toString()

  const adIds = result.createdAds.map(a => a.adId).filter(Boolean)
  const hasAdIds = adIds.length > 0

  const loadStatus = async () => {
    if (!hasAdIds || !result.launchMeta?.adAccountId) return
    setLoadingStatus(true)
    try {
      const res = await fetch("/api/facebook/ads-insights", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adAccountId: result.launchMeta.adAccountId, adIds, statusOnly: true }),
      })
      const data = await res.json()
      const map: Record<string, string> = {}
      for (const r of data.insights || []) map[r.adId] = r.effectiveStatus
      setAdStatuses(map)
    } finally { setLoadingStatus(false) }
  }

  const loadInsights = async () => {
    if (!hasAdIds || !result.launchMeta?.adAccountId) return
    setLoadingInsights(true)
    const t = Date.now()
    try {
      const res = await fetch("/api/facebook/ads-insights", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adAccountId: result.launchMeta.adAccountId, adIds, datePreset }),
      })
      const data = await res.json()
      setInsights(data.insights || [])
      setFetchMs(Date.now() - t)
    } finally { setLoadingInsights(false) }
  }

  useEffect(() => { if (tab === "performance") loadInsights() }, [tab, datePreset])

  const totals = useMemo(() => {
    let spend = 0, impressions = 0, clicks = 0, reach = 0, actions = 0
    for (const r of insights) { spend += r.spend; impressions += r.impressions; clicks += r.clicks; reach += r.reach; actions += r.actions }
    return { spend, impressions, clicks, reach, actions, costPerAction: actions > 0 ? spend / actions : 0 }
  }, [insights])

  const actId = result.launchMeta?.adAccountId?.replace("act_", "") || ""

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden [&>button:last-of-type]:hidden">
        <DialogTitle className="sr-only">Launch Result</DialogTitle>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b shrink-0">
          <div className={cn("size-8 rounded-full flex items-center justify-center shrink-0", isSuccess ? "bg-green-100" : isPartial ? "bg-amber-100" : "bg-red-100")}>
            {isSuccess ? <IconCircleCheck className="size-5 text-green-600" /> : isPartial ? <IconAlertTriangle className="size-5 text-amber-600" /> : <IconAlertCircle className="size-5 text-red-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold">{result.scheduled ? "Ads Scheduled" : "Launch completed"}</h2>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", isSuccess ? "bg-green-100 text-green-700" : isPartial ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
                ● {result.created} of {result.created + result.failed} succeeded
              </span>
              <button className="flex items-center gap-1 text-xs border rounded px-2 py-0.5 hover:bg-muted font-mono" onClick={() => navigator.clipboard.writeText(batchShort)}>
                BATCH #{batchShort}<IconCopy className="size-3 ml-0.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {result.launchMeta?.timestamp && new Date(result.launchMeta.timestamp).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}
              {result.launchMeta?.adAccountName && ` · ${result.launchMeta.adAccountName}`}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0 ml-2"><IconX className="size-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-5 shrink-0">
          {(["launched", "performance"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={cn("pb-2 pt-2.5 px-1 mr-5 text-sm font-medium border-b-2 transition-colors capitalize", tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t === "launched" ? "Launched" : "Performance"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Launched tab ── */}
          {tab === "launched" && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <IconBrandMeta className="size-4 text-[#1877F2]" />
                  Meta Ads ({result.created} succeeded)
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => {
                    const links = adIds.map(id => `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${actId}&filter_set=SEARCH_BY_AD_IDS-STRING_SET%1E${id}`).join("\n")
                    navigator.clipboard.writeText(links)
                  }}><IconEye className="size-3" />Preview Links</Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => navigator.clipboard.writeText(adIds.join("\n"))}>
                    <IconCopy className="size-3" />Copy Ad IDs
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={loadStatus} disabled={loadingStatus || !hasAdIds} title={!hasAdIds ? "No ad IDs — launch again to enable" : undefined}>
                    {loadingStatus ? <IconLoader2 className="size-3 animate-spin" /> : <IconRefresh className="size-3" />}Load Status
                  </Button>
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr className="text-xs text-muted-foreground">
                      <th className="text-left px-2 py-2 w-8">#</th>
                      <th className="text-left px-1 py-2 w-10">Thumb</th>
                      <th className="text-left px-2 py-2">Name</th>
                      <th className="text-left px-2 py-2 w-28">Status</th>
                      <th className="text-left px-2 py-2 w-40">Ad ID</th>
                      <th className="text-left px-2 py-2 w-32">Ad Set</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.createdAds.map((ad, i) => {
                      const rowKey = ad.adId || `row-${i}`
                      return (
                        <AdResultRow key={rowKey} index={i + 1} ad={ad}
                          status={adStatuses[ad.adId]}
                          expanded={expandedId === rowKey}
                          onToggle={() => setExpandedId(p => p === rowKey ? null : rowKey)}
                          launchMeta={result.launchMeta} />
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-3 space-y-1">
                  {result.errors.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded px-3 py-1.5">
                      <IconAlertCircle className="size-3 shrink-0 mt-0.5" />
                      <span className="font-medium truncate">{e.fileName}:</span>
                      <span className="text-muted-foreground">{e.error}</span>
                    </div>
                  ))}
                </div>
              )}
              {result.scheduled && (
                <div className="mt-3 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded px-3 py-2 flex items-center gap-2">
                  <IconClock className="size-3.5 shrink-0" />
                  Activates: {new Date(result.scheduled.at).toLocaleString()}
                  {result.scheduled.end && ` · Ends: ${new Date(result.scheduled.end).toLocaleString()}`}
                </div>
              )}
            </div>
          )}

          {/* ── Performance tab ── */}
          {tab === "performance" && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <IconTrendingUp className="size-4" />
                  Performance
                  {insights.length > 0 && <span className="text-muted-foreground font-normal text-xs">({insights.filter((r: any) => r.spend > 0).length}/{result.createdAds.length} ads with data)</span>}
                  {fetchMs && <span className="text-muted-foreground font-normal text-xs">{(fetchMs / 1000).toFixed(1)}s</span>}
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <Select value={datePreset} onValueChange={setDatePreset}>
                    <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="last_7d">Last 7 days</SelectItem>
                      <SelectItem value="last_30d">Last 30 days</SelectItem>
                      <SelectItem value="this_month">This month</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={loadInsights} disabled={loadingInsights}>
                    {loadingInsights ? <IconLoader2 className="size-3 animate-spin" /> : <IconRefresh className="size-3" />}Refresh
                  </Button>
                </div>
              </div>

              {insights.length > 0 && (
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {[
                    { label: "Total Spend", value: `$${totals.spend.toFixed(2)}`, icon: IconCurrencyDollar },
                    { label: "Avg Cost/Action", value: totals.actions > 0 ? `$${totals.costPerAction.toFixed(2)}` : "—", icon: IconTrendingUp },
                    { label: "Impressions", value: totals.impressions.toLocaleString(), icon: IconEye },
                    { label: "Clicks", value: totals.clicks.toLocaleString(), icon: IconTarget },
                    { label: "Reach", value: totals.reach.toLocaleString(), icon: IconUsers },
                  ].map(m => (
                    <div key={m.label} className="bg-muted/30 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1"><m.icon className="size-3" />{m.label}</div>
                      <p className="text-base font-semibold">{m.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {loadingInsights ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                  <IconLoader2 className="size-4 animate-spin" />Loading insights…
                </div>
              ) : insights.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                  <IconTrendingUp className="size-8 opacity-20" />
                  No performance data yet. Ads need to run first.
                </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b text-muted-foreground">
                      <tr>
                        <th className="text-left px-2 py-2 w-8">#</th>
                        <th className="text-left px-1 py-2 w-10">Thumb</th>
                        <th className="text-left px-2 py-2">Ad Name</th>
                        <th className="text-left px-2 py-2 w-24">Status</th>
                        <th className="text-right px-2 py-2 w-20">Spend</th>
                        <th className="text-right px-2 py-2 w-20">Cost/Act.</th>
                        <th className="text-right px-2 py-2 w-16">Actions</th>
                        <th className="text-right px-2 py-2 w-16">CTR</th>
                        <th className="text-right px-2 py-2 w-16">Impr.</th>
                        <th className="text-right px-2 py-2 w-16">Clicks</th>
                        <th className="text-right px-2 py-2 w-16">CPC</th>
                        <th className="text-right px-2 py-2 w-16">CPM</th>
                        <th className="text-right px-2 py-2 w-16">Reach</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.map((row: any, i: number) => {
                        const createdAd = result.createdAds.find(a => a.adId === row.adId)
                        const ctrGood = row.ctr >= 3, ctrBad = row.ctr < 2 && row.impressions > 100
                        return (
                          <tr key={row.adId} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                            <td className="px-1 py-1.5">
                              {createdAd?.thumbnailUrl
                                ? <img src={createdAd.thumbnailUrl} className="size-8 rounded object-cover" onError={e => e.currentTarget.style.display="none"} />
                                : <div className="size-8 rounded bg-muted" />}
                            </td>
                            <td className="px-2 py-1.5 font-medium max-w-[140px] truncate" title={row.name}>{row.name}</td>
                            <td className="px-2 py-1.5">
                              <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase", row.effectiveStatus === "ACTIVE" ? "bg-green-100 text-green-700" : row.effectiveStatus === "PAUSED" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500")}>{row.effectiveStatus}</span>
                            </td>
                            <td className="px-2 py-1.5 text-right">${row.spend.toFixed(2)}</td>
                            <td className="px-2 py-1.5 text-right">{row.costPerAction > 0 ? `$${row.costPerAction.toFixed(2)}` : "—"}</td>
                            <td className="px-2 py-1.5 text-right">{row.actions || 0}</td>
                            <td className={cn("px-2 py-1.5 text-right font-medium", ctrGood ? "text-green-600 bg-green-50 dark:bg-green-900/20" : ctrBad ? "text-red-600 bg-red-50 dark:bg-red-900/20" : "")}>
                              {row.impressions > 0 ? `${row.ctr.toFixed(2)}%` : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-right">{row.impressions.toLocaleString()}</td>
                            <td className="px-2 py-1.5 text-right">{row.clicks}</td>
                            <td className="px-2 py-1.5 text-right">{row.cpc > 0 ? `$${row.cpc.toFixed(2)}` : "—"}</td>
                            <td className={cn("px-2 py-1.5 text-right", row.cpm > 80 ? "text-red-500" : row.cpm > 0 && row.cpm < 40 ? "text-green-600" : "")}>{row.cpm > 0 ? `$${row.cpm.toFixed(2)}` : "—"}</td>
                            <td className="px-2 py-1.5 text-right">{row.reach.toLocaleString()}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconClock className="size-3.5" />Completed in {formatDuration(result.durationMs)}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs">Load as Draft</Button>
            <a href={`https://adsmanager.facebook.com/adsmanager/manage/ads?act=${actId}`} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="text-xs gap-1.5 bg-[#1877F2] hover:bg-[#1877F2]/90">
                View Meta Ads Manager<IconBrandMeta className="size-3.5" />
              </Button>
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
          <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
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

// ─── Batch Detail Modal ────────────────────────────────────────────────────────

function BatchDetailModal({ batch, open, onClose, onRelaunch }: {
  batch: LaunchBatch | null
  open: boolean
  onClose: () => void
  onRelaunch: (b: LaunchBatch) => void
}) {
  if (!batch) return null
  const accountNumId = batch.ad_account_id?.replace("act_", "")
  const amsBase = `https://adsmanager.facebook.com/adsmanager/manage`
  const ctaLabel = CTA_OPTIONS.find(o => o.value === batch.cta)?.label || batch.cta || "—"

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b">
          <DialogTitle className="text-base font-semibold">Launch Details</DialogTitle>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold",
            batch.status === "success" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
            batch.status === "partial" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
            "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400")}>
            {batch.status === "success" ? "Success" : batch.status === "partial" ? "Partial" : "Failed"}
          </span>
          <span className="text-xs text-muted-foreground ml-auto">{new Date(batch.created_at).toLocaleString()} · {batch.user_name}</span>
        </div>

        <div className="overflow-y-auto max-h-[70vh] p-5 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Ads Created", value: batch.total_ads, color: "text-foreground" },
              { label: "Failed", value: batch.failed_ads, color: batch.failed_ads > 0 ? "text-red-500" : "text-muted-foreground" },
              { label: "Ad Sets", value: batch.adset_ids?.length || 0, color: "text-foreground" },
              { label: "Creatives", value: batch.creative_ids?.length || 0, color: "text-foreground" },
            ].map(s => (
              <div key={s.label} className="text-center bg-muted/30 rounded-xl py-3">
                <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Creatives */}
          {batch.creative_thumbs?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Creatives</p>
              <div className="flex gap-2 flex-wrap">
                {batch.creative_thumbs.map((thumb, i) => (
                  <div key={i} className="size-16 rounded-lg overflow-hidden bg-muted border shrink-0">
                    {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" onError={e => e.currentTarget.style.display="none"} /> :
                      <div className="w-full h-full flex items-center justify-center"><IconVideo className="size-4 text-muted-foreground/40" /></div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ad copy */}
          <div className="grid grid-cols-2 gap-4">
            {batch.primary_text && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Primary Text</p>
                <p className="text-sm bg-muted/30 rounded-lg p-3 leading-relaxed border">{batch.primary_text}</p>
              </div>
            )}
            <div className="space-y-3">
              {batch.headline && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Headline</p>
                  <p className="text-sm font-medium">{batch.headline}</p>
                </div>
              )}
              <div className="flex gap-4">
                {batch.cta && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">CTA</p>
                    <span className="text-xs px-2 py-0.5 rounded bg-muted font-medium">{ctaLabel}</span>
                  </div>
                )}
                {batch.duration_ms && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Duration</p>
                    <p className="text-xs font-medium">{formatDuration(batch.duration_ms)}</p>
                  </div>
                )}
              </div>
              {batch.web_link && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Destination URL</p>
                  <a href={batch.web_link} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline break-all">{batch.web_link}</a>
                </div>
              )}
            </div>
          </div>

          {/* Ad Sets */}
          {batch.adset_names?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ad Sets Targeted</p>
              <div className="flex flex-wrap gap-1.5">
                {batch.adset_names.map((name, i) => (
                  <a
                    key={i}
                    href={`${amsBase}/adsets?act=${accountNumId}&selected_adset_ids=${batch.adset_ids?.[i] || ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded-md hover:bg-blue-100 border border-blue-200 dark:border-blue-800/50 transition-colors"
                  >
                    {name}<IconExternalLink className="size-3" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {batch.errors?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-2">Errors ({batch.errors.length})</p>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {batch.errors.map((err: any, i: number) => (
                  <div key={i} className="text-xs bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg px-3 py-2">
                    <span className="font-semibold text-red-700 dark:text-red-400">{err.fileName || err.adSetId}</span>
                    <span className="text-red-600 dark:text-red-400/80"> — {err.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 px-5 py-3 border-t bg-muted/10">
          <a
            href={`${amsBase}/ads?act=${accountNumId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="gap-1.5">
              <IconBrandMeta className="size-3.5 text-[#1877F2]" />
              View in Meta Ads Manager
              <IconExternalLink className="size-3" />
            </Button>
          </a>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            <Button size="sm" className="gap-1.5" onClick={() => { onRelaunch(batch); onClose() }}>
              <IconRocket className="size-3.5" />Re-launch
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Launch History Section ───────────────────────────────────────────────────

function LaunchHistorySection({ reloadTrigger, onRelaunch, pages = [] }: { reloadTrigger: number; onRelaunch: (b: LaunchBatch) => void; pages?: any[] }) {
  const [tab, setTab] = useState<"launches" | "drafts" | "scheduled">("launches")
  const [batches, setBatches] = useState<LaunchBatch[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [resultModal, setResultModal] = useState<LaunchResult | null>(null)
  const [displayCount, setDisplayCount] = useState(10)

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
  useEffect(() => { setDisplayCount(10) }, [search, statusFilter])

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

  const openDetails = (b: LaunchBatch) => {
    // For old batches without per-ad data, synthesise CreatedAd[] from thumbs × adsets
    const createdAds: CreatedAd[] = b.created_ads?.length
      ? b.created_ads
      : (b.creative_thumbs || []).flatMap((thumb, _ci) =>
          (b.adset_ids || []).map((adSetId, ai) => ({
            adId: "",
            adSetId,
            adSetName: b.adset_names?.[ai] || adSetId,
            thumbnailUrl: thumb || null,
            mediaType: "image" as const,
          }))
        ).slice(0, b.total_ads || 1)

    setResultModal({
      created: b.total_ads,
      failed: b.failed_ads,
      durationMs: b.duration_ms,
      errors: b.errors || [],
      createdAds,
      batchId: b.id,
      launchMeta: {
        cta: b.cta || "",
        webLink: b.web_link || "",
        headline: b.headline || "",
        primaryText: b.primary_text || "",
        pageId: b.page_id || "",
        pageName: pages.find(p => p.id === b.page_id)?.name || "",
        adAccountId: b.ad_account_id,
        adAccountName: b.ad_account_name,
        timestamp: b.created_at,
      },
    })
  }

  return (
    <div className="border-t flex flex-col">
      {resultModal && <LaunchResultModal result={resultModal} onClose={() => setResultModal(null)} />}
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
        ) : <>
          {filtered.slice(0, displayCount).map(b => (
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
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost" size="sm"
                  className="h-6 text-xs gap-0.5 px-2"
                  onClick={() => openDetails(b)}
                >
                  Details
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  title="Re-launch this batch"
                  onClick={() => onRelaunch(b)}
                >
                  <IconRocket className="size-3" />
                </Button>
              </div>
            </div>
          ))}
          {displayCount < filtered.length && (
            <div className="flex justify-center py-3 border-t">
              <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => setDisplayCount(c => c + 15)}>
                <IconChevronDown className="size-3.5" />
                Load more ({filtered.length - displayCount} more)
              </Button>
            </div>
          )}
        </>}
      </div>
    </div>
  )
}

// ─── Table Mode ───────────────────────────────────────────────────────────────

function TableMode({
  rows, adSets, onAddRow, onUpdateRow, onDeleteRow, onDuplicateRow,
  selectedPage, igAccountCache, selectedIgPageId, searchQuery, launchAsActive, pages,
}: {
  rows: TableRow[]
  adSets: AdSet[]
  onAddRow: () => void
  onUpdateRow: (id: string, field: keyof TableRow, value: any) => void
  onDeleteRow: (id: string) => void
  onDuplicateRow: (id: string) => void
  selectedPage?: FacebookPage
  igAccountCache: Record<string, IgAccount[]>
  selectedIgPageId: string
  searchQuery: string
  launchAsActive: boolean
  pages: FacebookPage[]
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedVar, setExpandedVar] = useState<Record<string, { primary: boolean; headline: boolean; description: boolean }>>({})
  const [sortField, setSortField] = useState<"adName" | "primaryText" | "headline" | "description" | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [profilePopoverRow, setProfilePopoverRow] = useState<string | null>(null)
  const profilePopoverRef = useRef<HTMLDivElement>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragScrollLeft = useRef(0)

  const onTableMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest("input,textarea,select,button,[role=combobox],[data-radix-popper-content-wrapper]")) return
    isDragging.current = true
    dragStartX.current = e.pageX
    dragScrollLeft.current = tableScrollRef.current?.scrollLeft || 0
    if (tableScrollRef.current) tableScrollRef.current.style.cursor = "grabbing"
  }
  const onTableMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !tableScrollRef.current) return
    e.preventDefault()
    tableScrollRef.current.scrollLeft = dragScrollLeft.current - (e.pageX - dragStartX.current)
  }
  const onTableMouseUp = () => {
    isDragging.current = false
    if (tableScrollRef.current) tableScrollRef.current.style.cursor = ""
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profilePopoverRef.current && !profilePopoverRef.current.contains(e.target as Node))
        setProfilePopoverRow(null)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const toggleSort = (field: "adName" | "primaryText" | "headline" | "description") => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("asc") }
  }

  const SortIcon = ({ field }: { field: "adName" | "primaryText" | "headline" | "description" }) => {
    if (sortField !== field) return <IconArrowsUpDown className="size-3 opacity-30 ml-0.5" />
    return sortDir === "asc" ? <IconArrowUp className="size-3 text-primary ml-0.5" /> : <IconArrowDown className="size-3 text-primary ml-0.5" />
  }

  const filteredRows = useMemo(() => {
    let list = rows
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(r =>
        r.adName.toLowerCase().includes(q) ||
        r.primaryText.toLowerCase().includes(q) ||
        r.headline.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      )
    }
    if (sortField) {
      list = [...list].sort((a, b) => {
        const av = ((a as any)[sortField] || "").toLowerCase()
        const bv = ((b as any)[sortField] || "").toLowerCase()
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    }
    return list
  }, [rows, searchQuery, sortField, sortDir])

  const allSelected = filteredRows.length > 0 && filteredRows.every(r => selectedIds.has(r.id))
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredRows.map(r => r.id)))
  }
  const toggleRow = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const igAccount = useMemo(() => {
    if (!selectedIgPageId) return null
    for (const accounts of Object.values(igAccountCache)) {
      const found = accounts.find(a => a.id === selectedIgPageId)
      if (found) return found
    }
    return null
  }, [igAccountCache, selectedIgPageId])

  const getExpanded = (id: string) => expandedVar[id] || { primary: false, headline: false, description: false }
  const setExpanded = (id: string, patch: Partial<{ primary: boolean; headline: boolean; description: boolean }>) =>
    setExpandedVar(prev => ({ ...prev, [id]: { ...getExpanded(id), ...patch } }))

  const selectedCount = selectedIds.size

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div
        ref={tableScrollRef}
        className="flex-1 overflow-auto select-none"
        style={{ cursor: "grab" }}
        onMouseDown={onTableMouseDown}
        onMouseMove={onTableMouseMove}
        onMouseUp={onTableMouseUp}
        onMouseLeave={onTableMouseUp}
      >
        <table className="w-full text-sm border-collapse" style={{ minWidth: 1340 }}>
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="border-b">
              <th className="w-10 px-3 py-2.5 text-left">
                <input type="checkbox" className="rounded size-3.5 accent-blue-600" checked={allSelected} onChange={toggleAll} />
              </th>
              <th className="w-7 px-1 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">#</th>
              <th className="w-32 px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Creative</th>
              <th
                className="w-52 px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground"
                onClick={() => toggleSort("adName")}
              >
                <span className="flex items-center gap-0.5">Ad Name <SortIcon field="adName" /></span>
              </th>
              <th
                className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground min-w-[260px]"
                onClick={() => toggleSort("primaryText")}
              >
                <span className="flex items-center gap-0.5">Primary Text <SortIcon field="primaryText" /></span>
              </th>
              <th
                className="w-56 px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground"
                onClick={() => toggleSort("headline")}
              >
                <span className="flex items-center gap-0.5">Headline <SortIcon field="headline" /></span>
              </th>
              <th
                className="w-52 px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground"
                onClick={() => toggleSort("description")}
              >
                <span className="flex items-center gap-0.5">Description <SortIcon field="description" /></span>
              </th>
              <th className="w-48 px-3 py-2.5 text-left">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Ad Sets <span className="text-[9px] font-medium text-amber-500 normal-case tracking-normal">required</span>
                  <IconArrowsUpDown className="size-3 opacity-30 ml-0.5" />
                </span>
              </th>
              <th className="w-40 px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Ad Profiles</th>
              <th className="w-28 px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">CTA</th>
              <th className="w-52 px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Link</th>
              <th className="w-52 px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">URL Tags</th>
              <th className="w-28 px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Launch Status</th>
              <th className="w-14 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, i) => {
              const isSelected = selectedIds.has(row.id)
              const exp = getExpanded(row.id)
              const ptVars = row.primaryTextVariations || []
              const hlVars = row.headlineVariations || []
              const descVars = row.descriptionVariations || []
              const mediaSrc = row.creative
                ? (row.creative.media_type === "video"
                    ? row.creative.fb_thumbnail_url
                    : (row.creative.fb_image_url || row.creative.file_url))
                : null

              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b group transition-colors align-top",
                    isSelected ? "bg-blue-50/60 dark:bg-blue-950/20" : "hover:bg-muted/20"
                  )}
                >
                  {/* Checkbox */}
                  <td className="px-3 pt-3 pb-2">
                    <input type="checkbox" className="rounded size-3.5 accent-blue-600" checked={isSelected} onChange={() => toggleRow(row.id)} />
                  </td>

                  {/* # */}
                  <td className="px-1 pt-3 pb-2 text-[11px] text-muted-foreground">{i + 1}</td>

                  {/* CREATIVE */}
                  <td className="px-3 py-2">
                    <div className="relative size-14 rounded-lg overflow-hidden bg-muted/60 border border-border/50 shrink-0">
                      {mediaSrc
                        ? <img src={mediaSrc} className="w-full h-full object-cover" alt="" loading="lazy" />
                        : <div className="w-full h-full flex items-center justify-center">
                            {row.creative
                              ? <IconPhoto className="size-5 text-muted-foreground/40" />
                              : <IconPlus className="size-5 text-muted-foreground/30" />
                            }
                          </div>
                      }
                      {row.creative?.media_type === "video" && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="size-5 bg-black/50 rounded-full flex items-center justify-center">
                            <IconPlayerPlay className="size-2.5 text-white fill-white" />
                          </div>
                        </div>
                      )}
                      {/* Format badge overlaid bottom */}
                      <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[8px] font-bold text-center py-0.5 leading-none tracking-wide">
                        SINGLE
                      </div>
                    </div>
                  </td>

                  {/* AD NAME (separate column) */}
                  <td className="px-3 py-2 align-top">
                    <textarea
                      value={row.adName}
                      onChange={e => onUpdateRow(row.id, "adName", e.target.value)}
                      placeholder="Ad name..."
                      rows={2}
                      className="w-full text-xs bg-muted/20 border border-transparent focus:border-border rounded px-2 py-1.5 outline-none resize-y placeholder:text-muted-foreground/40 leading-relaxed"
                    />
                  </td>

                  {/* PRIMARY TEXT */}
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <textarea
                        value={row.primaryText}
                        onChange={e => onUpdateRow(row.id, "primaryText", e.target.value)}
                        placeholder="Primary text..."
                        rows={2}
                        className="w-full text-xs bg-muted/20 border border-transparent focus:border-border rounded px-2 py-1.5 outline-none resize-y placeholder:text-muted-foreground/40 leading-relaxed"
                      />
                      {exp.primary && ptVars.map((v, vi) => (
                        <div key={vi} className="flex items-start gap-1">
                          <textarea
                            value={v}
                            onChange={e => {
                              const arr = [...ptVars]; arr[vi] = e.target.value
                              onUpdateRow(row.id, "primaryTextVariations", arr)
                            }}
                            rows={2}
                            placeholder={`Variation ${vi + 2}...`}
                            className="flex-1 text-xs bg-muted/20 border border-transparent focus:border-border rounded px-2 py-1.5 outline-none resize-y placeholder:text-muted-foreground/40"
                          />
                          <button
                            onClick={() => {
                              const arr = ptVars.filter((_, j) => j !== vi)
                              onUpdateRow(row.id, "primaryTextVariations", arr)
                              if (arr.length === 0) setExpanded(row.id, { primary: false })
                            }}
                            className="mt-1 text-muted-foreground hover:text-destructive"
                          >
                            <IconX className="size-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          onUpdateRow(row.id, "primaryTextVariations", [...ptVars, ""])
                          setExpanded(row.id, { primary: true })
                        }}
                        className="text-[10px] text-blue-600 hover:text-blue-700 text-left font-medium"
                      >
                        Primary Text Variations {ptVars.length > 0 ? `${ptVars.length + 1} ` : ""}+
                      </button>
                    </div>
                  </td>

                  {/* HEADLINE */}
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <textarea
                        value={row.headline}
                        onChange={e => onUpdateRow(row.id, "headline", e.target.value)}
                        placeholder="Headline..."
                        rows={2}
                        className="w-full text-xs bg-muted/20 border border-transparent focus:border-border rounded px-2 py-1.5 outline-none resize-y placeholder:text-muted-foreground/40 leading-relaxed"
                      />
                      {exp.headline && hlVars.map((v, vi) => (
                        <div key={vi} className="flex items-center gap-1">
                          <input
                            value={v}
                            onChange={e => {
                              const arr = [...hlVars]; arr[vi] = e.target.value
                              onUpdateRow(row.id, "headlineVariations", arr)
                            }}
                            placeholder={`Variation ${vi + 2}...`}
                            className="flex-1 text-xs bg-muted/20 border border-transparent focus:border-border rounded px-2 py-1.5 outline-none placeholder:text-muted-foreground/40"
                          />
                          <button
                            onClick={() => {
                              const arr = hlVars.filter((_, j) => j !== vi)
                              onUpdateRow(row.id, "headlineVariations", arr)
                              if (arr.length === 0) setExpanded(row.id, { headline: false })
                            }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <IconX className="size-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          onUpdateRow(row.id, "headlineVariations", [...hlVars, ""])
                          setExpanded(row.id, { headline: true })
                        }}
                        className="text-[10px] text-blue-600 hover:text-blue-700 text-left font-medium"
                      >
                        Headline Variations {hlVars.length > 0 ? `${hlVars.length + 1} ` : ""}+
                      </button>
                    </div>
                  </td>

                  {/* DESCRIPTION */}
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <textarea
                        value={row.description}
                        onChange={e => onUpdateRow(row.id, "description", e.target.value)}
                        placeholder="Description..."
                        rows={2}
                        className="w-full text-xs bg-muted/20 border border-transparent focus:border-border rounded px-2 py-1.5 outline-none resize-y placeholder:text-muted-foreground/40 leading-relaxed"
                      />
                      {exp.description && descVars.map((v, vi) => (
                        <div key={vi} className="flex items-center gap-1">
                          <input
                            value={v}
                            onChange={e => {
                              const arr = [...descVars]; arr[vi] = e.target.value
                              onUpdateRow(row.id, "descriptionVariations", arr)
                            }}
                            placeholder={`Variation ${vi + 2}...`}
                            className="flex-1 text-xs bg-muted/20 border border-transparent focus:border-border rounded px-2 py-1.5 outline-none placeholder:text-muted-foreground/40"
                          />
                          <button
                            onClick={() => {
                              const arr = descVars.filter((_, j) => j !== vi)
                              onUpdateRow(row.id, "descriptionVariations", arr)
                              if (arr.length === 0) setExpanded(row.id, { description: false })
                            }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <IconX className="size-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          onUpdateRow(row.id, "descriptionVariations", [...descVars, ""])
                          setExpanded(row.id, { description: true })
                        }}
                        className="text-[10px] text-blue-600 hover:text-blue-700 text-left font-medium"
                      >
                        Description Variations {descVars.length > 0 ? `${descVars.length + 1} ` : ""}+
                      </button>
                    </div>
                  </td>

                  {/* AD SETS */}
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1.5">
                      {row.adSetIds.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {row.adSetIds.map(id => {
                            const as = adSets.find(a => a.id === id)
                            if (!as) return null
                            return (
                              <span key={id} className="inline-flex items-center gap-0.5 text-[10px] bg-muted/80 border border-border/50 px-1.5 py-0.5 rounded-full">
                                <span className="max-w-[90px] truncate">{as.name}</span>
                                <button
                                  onClick={() => onUpdateRow(row.id, "adSetIds", row.adSetIds.filter(x => x !== id))}
                                  className="text-muted-foreground hover:text-foreground ml-0.5"
                                >
                                  <IconX className="size-2.5" />
                                </button>
                              </span>
                            )
                          })}
                        </div>
                      )}
                      <Select value="" onValueChange={v => {
                        if (v && !row.adSetIds.includes(v)) onUpdateRow(row.id, "adSetIds", [...row.adSetIds, v])
                      }}>
                        <SelectTrigger className="h-7 text-[11px] border-dashed">
                          <SelectValue placeholder="+ Add ad set" />
                        </SelectTrigger>
                        <SelectContent>
                          {adSets.filter(a => !row.adSetIds.includes(a.id)).map(a => (
                            <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>
                          ))}
                          {adSets.filter(a => !row.adSetIds.includes(a.id)).length === 0 && (
                            <div className="text-xs text-muted-foreground px-2 py-1.5">All ad sets added</div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </td>

                  {/* AD PROFILE — per-row selectable */}
                  <td className="px-3 pt-2 pb-2">
                    {(() => {
                      const rowPageId = row.pageId || selectedPage?.id
                      const rowPage = pages.find(p => p.id === rowPageId) || selectedPage
                      const rowIgId = row.igId || selectedIgPageId
                      const rowIgAccounts = igAccountCache[rowPageId || ""] || []
                      const rowIg = rowIgAccounts.find(a => a.id === rowIgId) || igAccount
                      const isOpen = profilePopoverRow === row.id
                      return (
                        <div className="relative" ref={isOpen ? profilePopoverRef : undefined}>
                          <button
                            onClick={() => setProfilePopoverRow(isOpen ? null : row.id)}
                            className="flex flex-col gap-1 hover:opacity-80 transition-opacity group/profile min-w-0 w-full"
                            title="Click to change page / IG account"
                          >
                            {/* FB Page row */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="size-5 rounded-full overflow-hidden bg-blue-100 shrink-0 ring-1 ring-border/60 group-hover/profile:ring-primary transition-all">
                                {rowPage?.picture?.data?.url
                                  ? <img src={rowPage.picture.data.url} className="w-full h-full object-cover" alt={rowPage.name} />
                                  : <div className="w-full h-full flex items-center justify-center"><IconBrandFacebook className="size-3 text-blue-600" /></div>}
                              </div>
                              <span className="text-[11px] truncate max-w-[100px] text-foreground/80">
                                {rowPage ? rowPage.name : <span className="text-muted-foreground/40">No page</span>}
                              </span>
                            </div>
                            {/* IG row */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="size-5 rounded-full overflow-hidden shrink-0 ring-1 ring-border/60 group-hover/profile:ring-primary transition-all bg-gradient-to-br from-pink-500 to-purple-600">
                                {rowIg?.profile_pic
                                  ? <img src={rowIg.profile_pic} className="w-full h-full object-cover" alt={rowIg.username || "IG"} />
                                  : <div className="w-full h-full flex items-center justify-center"><IconBrandInstagram className="size-3 text-white" /></div>}
                              </div>
                              <span className="text-[11px] truncate max-w-[100px] text-foreground/60">
                                {rowIg ? `@${rowIg.username || rowIg.id}` : <span className="text-muted-foreground/40">@Use Facebook</span>}
                              </span>
                            </div>
                          </button>

                          {isOpen && (
                            <div
                              ref={profilePopoverRef}
                              className="absolute left-0 bottom-full mb-1 z-50 bg-popover border rounded-xl shadow-xl w-64 py-1 overflow-hidden max-h-80 overflow-y-auto"
                            >
                              {/* FB Pages */}
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-3 py-1.5">Facebook Page</p>
                              {pages.length === 0 && (
                                <p className="text-xs text-muted-foreground px-3 py-2">No pages available</p>
                              )}
                              {pages.map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => {
                                    onUpdateRow(row.id, "pageId", p.id)
                                    onUpdateRow(row.id, "igId", undefined)
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors text-left",
                                    (row.pageId === p.id || (!row.pageId && selectedPage?.id === p.id)) && "bg-primary/5 font-medium"
                                  )}
                                >
                                  <div className="size-6 rounded-full overflow-hidden bg-blue-100 shrink-0">
                                    {p.picture?.data?.url
                                      ? <img src={p.picture.data.url} className="w-full h-full object-cover" alt={p.name} />
                                      : <div className="w-full h-full flex items-center justify-center"><IconBrandFacebook className="size-3 text-blue-600" /></div>}
                                  </div>
                                  <span className="truncate">{p.name}</span>
                                  {(row.pageId === p.id || (!row.pageId && selectedPage?.id === p.id)) && (
                                    <IconCheck className="size-3 text-primary ml-auto shrink-0" />
                                  )}
                                </button>
                              ))}

                              {/* IG Accounts for selected page */}
                              {(() => {
                                const selPageId = row.pageId || selectedPage?.id || ""
                                const igAccounts = igAccountCache[selPageId] || []
                                if (!igAccounts.length) return null
                                return (
                                  <>
                                    <div className="border-t my-1" />
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-3 py-1.5">Instagram Account</p>
                                    {igAccounts.map(ig => (
                                      <button
                                        key={ig.id}
                                        onClick={() => onUpdateRow(row.id, "igId", ig.id)}
                                        className={cn(
                                          "w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors text-left",
                                          (row.igId === ig.id || (!row.igId && selectedIgPageId === ig.id)) && "bg-primary/5 font-medium"
                                        )}
                                      >
                                        <div className="size-6 rounded-full overflow-hidden bg-gradient-to-br from-pink-500 to-purple-600 shrink-0">
                                          {ig.profile_pic
                                            ? <img src={ig.profile_pic} className="w-full h-full object-cover" alt={ig.username || "IG"} />
                                            : <div className="w-full h-full flex items-center justify-center"><IconBrandInstagram className="size-3 text-white" /></div>}
                                        </div>
                                        <span className="truncate">@{ig.username || ig.id}</span>
                                        {(row.igId === ig.id || (!row.igId && selectedIgPageId === ig.id)) && (
                                          <IconCheck className="size-3 text-primary ml-auto shrink-0" />
                                        )}
                                      </button>
                                    ))}
                                  </>
                                )
                              })()}

                              <div className="border-t mt-1 px-3 py-1.5">
                                <button
                                  onClick={() => {
                                    onUpdateRow(row.id, "pageId", undefined)
                                    onUpdateRow(row.id, "igId", undefined)
                                    setProfilePopoverRow(null)
                                  }}
                                  className="text-[11px] text-muted-foreground hover:text-foreground"
                                >
                                  Reset to gallery default
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </td>

                  {/* CTA */}
                  <td className="px-3 py-2">
                    <Select
                      value={row.cta || "__inherit__"}
                      onValueChange={v => onUpdateRow(row.id, "cta", v === "__inherit__" ? undefined : v)}
                    >
                      <SelectTrigger className="h-7 text-xs w-full">
                        <SelectValue placeholder="From gallery" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__inherit__" className="text-xs text-muted-foreground">From gallery</SelectItem>
                        {CTA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>

                  {/* LINK */}
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.webLink || ""}
                      onChange={e => onUpdateRow(row.id, "webLink", e.target.value)}
                      placeholder="https://..."
                      className="w-full text-xs bg-muted/20 border border-transparent focus:border-border rounded px-2 py-1.5 outline-none placeholder:text-muted-foreground/40 truncate"
                    />
                  </td>

                  {/* URL TAGS */}
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.urlTags || ""}
                      onChange={e => onUpdateRow(row.id, "urlTags", e.target.value)}
                      placeholder="utm_source=fb..."
                      className="w-full text-xs bg-muted/20 border border-transparent focus:border-border rounded px-2 py-1.5 outline-none placeholder:text-muted-foreground/40 truncate"
                    />
                  </td>

                  {/* LAUNCH STATUS */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onUpdateRow(row.id, "launchAsActive", row.launchAsActive === false ? true : row.launchAsActive === true ? false : !launchAsActive)}
                        className={cn(
                          "relative inline-flex h-4 w-8 items-center rounded-full transition-colors shrink-0",
                          (row.launchAsActive ?? launchAsActive) ? "bg-blue-500" : "bg-muted-foreground/30"
                        )}
                        title={(row.launchAsActive ?? launchAsActive) ? "Active" : "Paused"}
                      >
                        <span className={cn(
                          "inline-block size-3 rounded-full bg-white shadow-sm transition-transform",
                          (row.launchAsActive ?? launchAsActive) ? "translate-x-[18px]" : "translate-x-0.5"
                        )} />
                      </button>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {(row.launchAsActive ?? launchAsActive) ? "Active" : "Paused"}
                      </span>
                    </div>
                  </td>

                  {/* ACTIONS */}
                  <td className="px-3 pt-3 pb-2">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onDuplicateRow(row.id)} className="text-muted-foreground hover:text-foreground" title="Duplicate row">
                        <IconCopy className="size-3.5" />
                      </button>
                      <button onClick={() => onDeleteRow(row.id)} className="text-muted-foreground hover:text-destructive" title="Delete row">
                        <IconTrash className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <button
          onClick={onAddRow}
          className="flex items-center gap-1.5 px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 w-full transition-colors border-b"
        >
          <IconPlus className="size-3.5" />Add New Row
        </button>
      </div>

      {/* Bulk selection bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/20 border-t border-blue-200 dark:border-blue-800/50 shrink-0">
          <span className="text-xs text-blue-700 dark:text-blue-400 font-medium">
            {selectedCount} of {filteredRows.length} row{filteredRows.length !== 1 ? "s" : ""} selected
          </span>
          <button
            onClick={() => { Array.from(selectedIds).forEach(id => onDuplicateRow(id)); setSelectedIds(new Set()) }}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            Duplicate {selectedCount} Row{selectedCount !== 1 ? "s" : ""}
          </button>
          <button
            onClick={() => { Array.from(selectedIds).forEach(id => onDeleteRow(id)); setSelectedIds(new Set()) }}
            className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            Remove {selectedCount} Row{selectedCount !== 1 ? "s" : ""}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-muted-foreground hover:text-foreground">
            <IconX className="size-3.5" />
          </button>
        </div>
      )}
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
  const [adSourceMode, setAdSourceMode] = useState<AdSourceMode>("new_ad")
  const [adSourceIds, setAdSourceIds] = useState<Record<string, string>>({})
  const [utmParams, setUtmParams] = useState("")
  const [displayLink, setDisplayLink] = useState("")
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set())
  const [selectedCreatives, setSelectedCreatives] = useState<Creative[]>([])
  const [adNameOverrides, setAdNameOverrides] = useState<Record<string, string>>({})
  const thumbRetryCounts = useRef<Map<string, number>>(new Map())

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

  // Load Default Ad Settings when account changes → pre-fill empty form fields
  useEffect(() => {
    if (!selectedAccountId) return
    try {
      const raw = localStorage.getItem(`default_ad_settings_${selectedAccountId}`)
      if (!raw) return
      const s: DefaultAdSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
      // Pre-fill ad copy only when fields are empty (don't overwrite user input)
      if (!primaryTexts[0]?.trim() && s.adCopy.primaryText) setPrimaryTexts([s.adCopy.primaryText])
      if (!headlines[0]?.trim() && s.adCopy.headline) setHeadlines([s.adCopy.headline])
      if (!description && s.adCopy.description) setDescription(s.adCopy.description)
      if (s.adCopy.cta) setCta(s.adCopy.cta)
      // Pre-fill web/app links
      if (!webLink && s.links.webLink) setWebLink(s.links.webLink)
      if (!utmParams && s.links.utmParameters) setUtmParams(s.links.utmParameters)
      if (!displayLink && s.links.displayLink) setDisplayLink(s.links.displayLink)
      // Apply launch defaults
      setLaunchAsActive(!s.launch.launchAsPaused)
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId])

  // Polling for missing thumbnails in selected creatives (max 10 retries per video ~2.5min at 15s)
  useEffect(() => {
    const MAX_RETRIES = 10
    const pending = selectedCreatives.filter(c =>
      c.media_type === "video" &&
      c.fb_video_id &&
      !(c.fb_thumbnail_url && (/^https?:/.test(c.fb_thumbnail_url) || c.fb_thumbnail_url.startsWith("/api/creatives/"))) &&
      !c.id.startsWith("temp_") &&
      (thumbRetryCounts.current.get(c.id) ?? 0) < MAX_RETRIES
    )
    if (pending.length === 0) return

    const tick = async () => {
      if (document.hidden) return  // pause when tab is not visible
      const toCheck = pending.slice(0, 2)
      for (const c of toCheck) {
        thumbRetryCounts.current.set(c.id, (thumbRetryCounts.current.get(c.id) ?? 0) + 1)
        try {
          const res = await fetch(`/api/creatives/${c.id}/thumbnail`, { method: "POST" })
          const data = await res.json()
          if (data.thumbnail_url || data.source_url) {
            setSelectedCreatives(prev => prev.map(x =>
              x.id === c.id
                ? { ...x, fb_thumbnail_url: data.thumbnail_url || x.fb_thumbnail_url, file_url: data.source_url || x.file_url || data.thumbnail_url }
                : x
            ))
          }
        } catch {}
      }
    }

    const interval = setInterval(tick, 15000)
    // Resume immediately when user returns to this tab (don't wait up to 15s)
    const onVisible = () => { if (!document.hidden) tick() }
    document.addEventListener("visibilitychange", onVisible)

    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible) }
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

  const [sheetsImportOpen, setSheetsImportOpen] = useState(false)
  const [mediaModalOpen, setMediaModalOpen] = useState(false)
  // Increment to force LoadMediaModal Library tab to re-fetch (used after a new upload completes)
  const [mediaRefreshSignal, setMediaRefreshSignal] = useState(0)
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
    templateType: "storefront",
    catalogId: "", catalogName: "", catalogVertical: "",
    productSetId: "", productSetName: "",
    productCount: 4,
    order: "dynamic",
    productHeadlineChips: ["product_name"],
    productDescriptionChips: ["current_price"],
    ieHeadline: "",
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
  const [relaunchBanner, setRelaunchBanner] = useState("")

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

  // Direct video upload: client → Facebook in 1 request (no chunking needed).
  // Server only handles auth (get token) and DB save. No Vercel body limit applies
  // because the large payload goes client → Facebook directly.
  const uploadVideoChunked = async (item: UploadItem): Promise<Creative | null> => {
    const currentPrimary = primaryTexts.find(t => t.trim()) || ""
    const currentHeadline = headlines.find(h => h.trim()) || ""
    let CHUNK_SIZE = 4 * 1024 * 1024 // 4MB
    if (item.file.size > 150 * 1024 * 1024) {
      CHUNK_SIZE = 20 * 1024 * 1024 // 20MB
    } else if (item.file.size > 50 * 1024 * 1024) {
      CHUNK_SIZE = 10 * 1024 * 1024 // 10MB
    }
    try {
      // 1. Get credentials
      const credRes = await fetch(`/api/facebook/upload-credentials?adAccountId=${selectedAccountId}`)
      if (!credRes.ok) throw new Error("Failed to get upload credentials")
      const { accessToken, adAccountId: normAccountId } = await credRes.json()
      const cleanId = normAccountId.replace(/^act_/, "")
      const FB_API = `https://graph.facebook.com/v25.0/act_${cleanId}/advideos`

      // 2. Start session
      const startFormData = new FormData()
      startFormData.append("upload_phase", "start")
      startFormData.append("file_size", String(item.file.size))
      startFormData.append("access_token", accessToken)

      const startRes = await fetch(FB_API, { method: "POST", body: startFormData })
      const startData = await startRes.json()
      if (startData.error) throw new Error(startData.error.message || "Failed to start upload")

      const { upload_session_id, video_id } = startData
      let startOffset = Number(startData.start_offset || "0")

      // 3. Transfer chunks
      updateUpload(item.id, { uploaded: 0, fileSize: item.file.size })
      const startedAt = Date.now()
      let lastTick = startedAt
      let lastLoaded = 0

      while (startOffset < item.file.size) {
        const endOffset = Math.min(startOffset + CHUNK_SIZE, item.file.size)
        const chunk = item.file.slice(startOffset, endOffset)

        const transferFormData = new FormData()
        transferFormData.append("upload_phase", "transfer")
        transferFormData.append("upload_session_id", upload_session_id)
        transferFormData.append("start_offset", String(startOffset))
        transferFormData.append("access_token", accessToken)
        transferFormData.append("video_file_chunk", chunk, item.file.name)

        const transferRes = await fetch(FB_API, { method: "POST", body: transferFormData })
        const transferData = await transferRes.json()
        if (transferData.error) throw new Error(transferData.error.message || "Chunk upload failed")

        startOffset = Number(transferData.start_offset)
        
        // Update progress
        const now = Date.now()
        const dt = (now - lastTick) / 1000
        const dl = startOffset - lastLoaded
        const speed = dt > 0 ? dl / dt : 0
        const remaining = item.file.size - startOffset
        const eta = speed > 0 ? remaining / speed : 0
        lastTick = now
        lastLoaded = startOffset
        updateUpload(item.id, { uploaded: startOffset, fileSize: item.file.size, speed, eta })
      }

      // 4. Finish session on Meta
      const finishMetaFormData = new FormData()
      finishMetaFormData.append("upload_phase", "finish")
      finishMetaFormData.append("upload_session_id", upload_session_id)
      finishMetaFormData.append("access_token", accessToken)
      finishMetaFormData.append("title", item.file.name)

      const finishMetaRes = await fetch(FB_API, { method: "POST", body: finishMetaFormData })
      const finishMetaData = await finishMetaRes.json()
      if (finishMetaData.error) throw new Error(finishMetaData.error.message || "Failed to finalize Meta upload")

      // 5. Save to our DB via our server's finish route
      const finishRes = await fetch("/api/facebook/video-upload/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad_account_id: selectedAccountId,
          video_id,
          file_name: item.file.name,
          file_size: item.file.size,
          headline: currentHeadline || null,
          primary_text: currentPrimary || null,
          description: description || null,
          link_url: webLink || null,
          cta: cta || "LEARN_MORE",
        }),
      })
      const finishData = await finishRes.json()
      if (!finishRes.ok) throw new Error(finishData.error || "Failed to save creative to database")

      const creative: Creative = finishData.creative
      const totalDurationSeconds = Math.max((Date.now() - startedAt) / 1000, 1)
      updateUpload(item.id, {
        status: "completed",
        uploaded: item.fileSize,
        eta: 0,
        speed: item.file.size / totalDurationSeconds,
        creativeId: creative.id,
      })

      // Poll Meta for thumbnail in background
      ;(async () => {
        for (let attempt = 0; attempt < 8; attempt++) {
          await new Promise(r => setTimeout(r, attempt === 0 ? 3000 : 5000))
          try {
            const tRes = await fetch(`/api/creatives/${creative.id}/thumbnail`, { method: "POST" })
            const tData = await tRes.json()
            if (tData.status === "ready" || tData.thumbnail_url || tData.source_url) {
              setSelectedCreatives(prev => prev.map(c =>
                c.id === creative.id
                  ? { 
                      ...c, 
                      fb_thumbnail_url: tData.thumbnail_url || c.fb_thumbnail_url, 
                      file_url: tData.source_url || c.file_url || tData.thumbnail_url,
                      status: tData.status || "ready"
                    }
                  : c
              ))
              if (tData.status === "ready") break
            }
          } catch {}
        }
      })()

      return creative
    } catch (err: any) {
      console.error("Direct upload error:", err)
      updateUpload(item.id, { status: "error", error: err.message || "Upload failed" })
      return null
    }
  }

  const uploadOneFile = (item: UploadItem): Promise<Creative | null> => {
    // Large videos (>3MB) use Facebook Resumable Upload API (chunked) to bypass Vercel body limit
    if (item.file.type.startsWith("video/") && item.file.size > 3 * 1024 * 1024) {
      return uploadVideoChunked(item)
    }

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
            const errMsg = data.error || `Upload failed (HTTP ${xhr.status})`
            updateUpload(item.id, { status: "error", error: errMsg })
            resolve(null)
          }
        } catch (e: any) {
          updateUpload(item.id, { status: "error", error: "Server returned invalid response" })
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

    // Upload all files in parallel; swap temp creative → real creative when done
    let anyUploaded = false
    await Promise.allSettled(items.map(async (item) => {
      const real = await uploadOneFile(item)
      if (real) {
        anyUploaded = true
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
                setSelectedCreatives(prev => prev.map(c => {
                  if (c.id !== real.id) return c
                  // Update thumbnail only — DO NOT overwrite file_url, otherwise the video URL
                  // is replaced by the JPEG thumbnail URL → <video> element no longer renders → no hover play.
                  return { ...c, fb_thumbnail_url: d.thumbnail_url }
                }))
                // Tell Library tab to re-fetch so the new thumbnail shows there too
                setMediaRefreshSignal(s => s + 1)
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
    }))
    // Refresh Library tab so freshly uploaded items appear with thumbnails
    if (anyUploaded) setMediaRefreshSignal(s => s + 1)
  }

  // Legacy props for GalleryMediaPanel — kept for backward compat (now empty)
  const uploading = uploads.some(u => u.status === "uploading")
  const uploadProgress = { done: 0, total: 0, current: "" }

  // Fetch pages 1 lần khi mount — cache 10 min in sessionStorage to avoid rate limits
  const [pagesError, setPagesError] = useState<string>("")
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const PAGES_CACHE_KEY    = "fb_pages_cache"
  const PAGES_CACHE_TTL    = 10 * 60 * 1000 // 10 minutes
  const PAGES_RL_KEY       = "fb_pages_ratelimit"
  const PAGES_RL_COOLDOWN  = 5 * 60 * 1000  // 5 minutes — don't re-hit after 429
  useEffect(() => {
    // Respect active rate-limit cooldown (avoids hammering Facebook on rapid refreshes)
    try {
      const rl = sessionStorage.getItem(PAGES_RL_KEY)
      if (rl) {
        const since = Date.now() - parseInt(rl, 10)
        if (since < PAGES_RL_COOLDOWN) {
          const remaining = Math.ceil((PAGES_RL_COOLDOWN - since) / 1000 / 60)
          setPagesError(`Facebook API rate limit active. Try again in ~${remaining} min.`)
          return
        }
        sessionStorage.removeItem(PAGES_RL_KEY)
      }
    } catch {}

    // Try page cache first
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
          if (r.status === 429 || d.rateLimited || /request limit|rate limit|too many|#4/i.test(d.error || "")) {
            try { sessionStorage.setItem(PAGES_RL_KEY, String(Date.now())) } catch {}
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
      c.media_type === "video"
      && c.fb_video_id
      && (
        !c.fb_thumbnail_url
        || (
          !/^https?:/.test(c.fb_thumbnail_url)
          && !c.fb_thumbnail_url.startsWith("/api/creatives/")
        )
      )
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
            if (data.thumbnail_url) return
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

  const handleRelaunch = (batch: LaunchBatch) => {
    if (batch.primary_text) setPrimaryTexts([batch.primary_text])
    if (batch.headline) setHeadlines([batch.headline])
    if (batch.cta) setCta(batch.cta)
    if (batch.web_link) setWebLink(batch.web_link)
    setRelaunchBanner(`Settings restored from launch on ${new Date(batch.created_at).toLocaleDateString()} — re-select your ad sets and creatives, then launch.`)
    setTimeout(() => setRelaunchBanner(""), 8000)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const doLaunch = async (scheduledTime?: string, scheduleEndTime?: string) => {
    if (!validate()) return
    setLaunching(true)
    setLaunchResult(null)
    try {
      const primaryText = primaryTexts.find(t => t.trim()) || ""
      const headline = headlines.find(h => h.trim()) || ""

      // Read saved Default Ad Settings so enhancements + launch flags reach the API
      let savedEnhancements: DefaultAdSettings["enhancements"] | undefined
      let savedLaunchSettings: DefaultAdSettings["launch"] | undefined
      try {
        const raw = localStorage.getItem(`default_ad_settings_${selectedAccountId}`)
        if (raw) {
          const s: DefaultAdSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
          savedEnhancements = s.enhancements
          savedLaunchSettings = s.launch
        }
      } catch {}

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
          webLink: utmParams.trim()
            ? `${webLink.trim()}${webLink.includes("?") ? "&" : "?"}${utmParams.trim()}`
            : webLink.trim(),
          displayLink: displayLink.trim() || undefined,
          createPaused: !launchAsActive,
          startTime: scheduledTime,
          endTime: scheduleEndTime,
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
          adSourceMode,
          adSourceIds: Object.keys(adSourceIds).length > 0 ? adSourceIds : undefined,
          enhancements: savedEnhancements,
          launchSettings: savedLaunchSettings,
          collectionAds: collectionAds.enabled && collectionAds.catalogId && collectionAds.productSetId
            ? {
                templateType: collectionAds.templateType,
                catalogId: collectionAds.catalogId,
                productSetId: collectionAds.productSetId,
                productCount: collectionAds.productCount,
                order: collectionAds.order,
                ieHeadline: collectionAds.ieHeadline || undefined,
                destinationUrl: collectionAds.destinationUrl,
                productHeadlineChips: collectionAds.productHeadlineChips,
                productDescriptionChips: collectionAds.productDescriptionChips,
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
        scheduled: data.scheduled ?? null,
        createdAds: data.created || [],
        batchId: data.batchId || null,
        launchMeta: {
          cta,
          webLink: webLink.trim(),
          headline: headlines.find((h: string) => h.trim()) || "",
          primaryText: primaryTexts.find((t: string) => t.trim()) || "",
          pageId: selectedPageId || "",
          pageName: pages.find(p => p.id === selectedPageId)?.name || "",
          adAccountId: selectedAccountId || "",
          adAccountName: selectedAccount?.name || selectedAccountId || "",
          timestamp: new Date().toISOString(),
        },
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

  const [tableSearchQuery, setTableSearchQuery] = useState("")
  const [tableAutoSync, setTableAutoSync] = useState(false)
  const [tableBulkOpen, setTableBulkOpen] = useState(false)
  const [tableMoreOpen, setTableMoreOpen] = useState(false)
  const tableBulkRef = useRef<HTMLDivElement>(null)
  const tableMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (tableBulkRef.current && !tableBulkRef.current.contains(e.target as Node)) setTableBulkOpen(false)
      if (tableMoreRef.current && !tableMoreRef.current.contains(e.target as Node)) setTableMoreOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const syncTableFromGallery = useCallback(() => {
    const sharedPt = primaryTexts.find(t => t.trim()) || ""
    const sharedHl = headlines.find(h => h.trim()) || ""
    const adSetIdList = selectedAdSets.map((a: AdSet) => a.id)
    setTableRows(prev => prev.map(r => ({
      ...r,
      ...(sharedPt ? { primaryText: sharedPt } : {}),
      ...(sharedHl ? { headline: sharedHl } : {}),
      ...(description ? { description } : {}),
      ...(adSetIdList.length > 0 ? { adSetIds: adSetIdList } : {}),
      ...(cta ? { cta } : {}),
      ...(webLink ? { webLink } : {}),
    })))
  }, [primaryTexts, headlines, description, cta, webLink, selectedAdSets])

  // Auto-sync when gallery values change (only while auto-sync is on and in table mode)
  useEffect(() => {
    if (!tableAutoSync || mode !== "table") return
    syncTableFromGallery()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableAutoSync, primaryTexts, headlines, description, cta, webLink, selectedAdSets])

  const addTableRow = () => {
    setTableRows(prev => [...prev, { id: String(Date.now()), creative: null, adName: "", primaryText: "", headline: "", description: "", adSetIds: [] }])
  }
  const updateTableRow = (id: string, field: keyof TableRow, value: any) => {
    setTableRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }
  const deleteTableRow = (id: string) => {
    setTableRows(prev => prev.filter(r => r.id !== id))
  }
  const duplicateTableRow = (id: string) => {
    setTableRows(prev => {
      const idx = prev.findIndex(r => r.id === id)
      if (idx < 0) return prev
      const copy = { ...prev[idx], id: String(Date.now()), adName: prev[idx].adName ? `${prev[idx].adName} (copy)` : "" }
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]
    })
  }

  // Table mode: launch each row individually using per-row settings
  const doTableLaunch = useCallback(async (scheduledTime?: string, scheduleEndTime?: string) => {
    const validRows = tableRows.filter(r => r.creative?.id && r.adSetIds.length > 0)
    if (!validRows.length) {
      setError("No rows with both a creative and ad sets selected")
      return
    }

    setLaunching(true)
    setLaunchResult(null)
    setError("")

    let savedEnhancements: DefaultAdSettings["enhancements"] | undefined
    let savedLaunchSettings: DefaultAdSettings["launch"] | undefined
    try {
      const raw = localStorage.getItem(`default_ad_settings_${selectedAccountId}`)
      if (raw) {
        const s: DefaultAdSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
        savedEnhancements = s.enhancements
        savedLaunchSettings = s.launch
      }
    } catch {}

    const globalPrimaryText = primaryTexts.find(t => t.trim()) || ""
    const globalHeadline = headlines.find(h => h.trim()) || ""

    let totalCreated = 0
    let totalFailed = 0
    const allErrors: { adSetId: string; fileName: string; error: string }[] = []
    const allCreatedAds: CreatedAd[] = []
    let lastBatchId: string | null = null

    for (const row of validRows) {
      const rowLink = (row.webLink || webLink).trim()
      const rowUtm = (row.urlTags || utmParams).trim()
      const rowWebLink = rowUtm
        ? `${rowLink}${rowLink.includes("?") ? "&" : "?"}${rowUtm}`
        : rowLink

      try {
        const res = await fetch("/api/facebook/launch-direct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adAccountId: selectedAccountId,
            adAccountName: selectedAccount?.name || selectedAccountId,
            adSetIds: row.adSetIds,
            adSetNames: row.adSetIds.map(id => allAdSets.find(a => a.id === id)?.name || id),
            creativeIds: [row.creative!.id],
            pageId: row.pageId || selectedPageId,
            instagramAccountId: row.igId || selectedIgPageId || undefined,
            headline: (row.headline || globalHeadline).trim(),
            primaryText: (row.primaryText || globalPrimaryText).trim(),
            cta: row.cta || cta,
            webLink: rowWebLink,
            createPaused: row.launchAsActive !== undefined ? !row.launchAsActive : !launchAsActive,
            startTime: scheduledTime,
            endTime: scheduleEndTime,
            enhancements: savedEnhancements,
            launchSettings: savedLaunchSettings,
          }),
        })
        const data = await res.json()
        if (res.ok) {
          totalCreated += data.created?.length ?? 0
          totalFailed += data.errors?.length ?? 0
          allErrors.push(...(data.errors || []))
          allCreatedAds.push(...(data.created || []))
          if (data.batchId) lastBatchId = data.batchId
        } else {
          totalFailed += row.adSetIds.length
          allErrors.push({ adSetId: row.adSetIds[0] || "", fileName: row.creative?.file_name || "", error: data.error || "Launch failed" })
        }
      } catch (err: any) {
        totalFailed += row.adSetIds.length
        allErrors.push({ adSetId: row.adSetIds[0] || "", fileName: row.creative?.file_name || "", error: err.message || "Network error" })
      }
    }

    const result: LaunchResult = {
      created: totalCreated,
      failed: totalFailed,
      durationMs: 0,
      errors: allErrors,
      scheduled: scheduledTime ? { at: scheduledTime, end: scheduleEndTime || null } : null,
      createdAds: allCreatedAds,
      batchId: lastBatchId,
      launchMeta: {
        cta,
        webLink: webLink.trim(),
        headline: globalHeadline,
        primaryText: globalPrimaryText,
        pageId: selectedPageId || "",
        pageName: pages.find(p => p.id === selectedPageId)?.name || "",
        adAccountId: selectedAccountId || "",
        adAccountName: selectedAccount?.name || selectedAccountId || "",
        timestamp: new Date().toISOString(),
      },
    }
    setLaunchResult(result)
    setHistoryReload(n => n + 1)
    setLaunching(false)
  }, [tableRows, selectedAccountId, selectedAccount, selectedPageId, primaryTexts, headlines, cta, webLink, utmParams, launchAsActive, allAdSets, pages])

  const handleSheetsImport = useCallback((rows: ImportedRow[]) => {
    const newRows = rows.map(r => ({
      id: String(Date.now() + Math.random()),
      creative: r.creative,
      adName: r.adName,
      primaryText: r.primaryText,
      headline: r.headline,
      description: r.description,
      adSetIds: selectedAdSets.map((a: AdSet) => a.id),
      cta: r.cta || undefined,
      webLink: r.webLink || undefined,
      urlTags: r.urlTags || undefined,
      promoCode: r.promoCode || undefined,
      launchAsActive: r.launchAsActive,
    }))
    setTableRows(prev => {
      const hasContent = prev.some(r => r.creative || r.adName.trim() || r.primaryText.trim())
      return hasContent ? [...prev, ...newRows] : newRows
    })
    setMode("table")
  }, [selectedAdSets, cta, webLink])

  const exportTableCSV = () => {
    const headers = ["Ad Name", "Primary Text", "Headline", "Description", "Ad Sets", "CTA", "Web Link"]
    const csv = [
      headers.join(","),
      ...tableRows.map(r => [
        JSON.stringify(r.adName),
        JSON.stringify(r.primaryText),
        JSON.stringify(r.headline),
        JSON.stringify(r.description),
        JSON.stringify(r.adSetIds.map(id => allAdSets.find(a => a.id === id)?.name || id).join(";")),
        JSON.stringify(r.cta || ""),
        JSON.stringify(r.webLink || ""),
      ].join(","))
    ].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "ads-table.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  const selectedPage = pages.find(p => p.id === selectedPageId)

  return (
    <>
      <LoadMediaModal open={mediaModalOpen} onClose={() => setMediaModalOpen(false)}
        adAccountId={selectedAccountId} adAccounts={adAccounts} alreadySelected={selectedMediaIds}
        refreshSignal={mediaRefreshSignal}
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
        onConfirm={(start, end) => doLaunch(start, end)} />
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
        baseWebLink={webLink}
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
        description={description}
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

          {/* Right: mode toggle */}
          <div className="ml-auto">
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"
              onClick={() => {
                if (mode === "gallery") {
                  // Sync gallery state → table rows when switching to table mode
                  const sharedPt = primaryTexts.find(t => t.trim()) || ""
                  const sharedHl = headlines.find(h => h.trim()) || ""
                  const adSetIdList = selectedAdSets.map(a => a.id)
                  if (selectedCreatives.length > 0) {
                    setTableRows(selectedCreatives.map((c, i) => ({
                      id: `tr_${c.id}_${i}`,
                      creative: c,
                      adName: adNameOverrides[c.id] || c.file_name || "",
                      primaryText: sharedPt,
                      headline: sharedHl,
                      description,
                      adSetIds: adSetIdList,
                      cta,
                      webLink,
                    })))
                  } else {
                    // No creatives selected: just fill one empty row with form data
                    setTableRows([{
                      id: "tr_empty",
                      creative: null,
                      adName: "",
                      primaryText: sharedPt,
                      headline: sharedHl,
                      description,
                      adSetIds: adSetIdList,
                      cta,
                      webLink,
                    }])
                  }
                  setMode("table")
                } else {
                  setMode("gallery")
                }
              }}>
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
                utmParams={utmParams} setUtmParams={setUtmParams}
                displayLink={displayLink} setDisplayLink={setDisplayLink}
                adAccountId={selectedAccountId}
                adAccountName={selectedAccount?.name || selectedAccountId}
                orgName="tuanquang269"
                selectedCreatives={selectedCreatives}
                adSourceMode={adSourceMode} setAdSourceMode={setAdSourceMode}
                adSourceIds={adSourceIds} setAdSourceIds={setAdSourceIds}
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
                <LaunchResultModal result={launchResult} onClose={() => setLaunchResult(null)} />
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
            {relaunchBanner && (
              <div className="mx-4 mb-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg text-xs text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <IconCircleCheck className="size-3.5 shrink-0" />
                {relaunchBanner}
              </div>
            )}
            <LaunchHistorySection reloadTrigger={historyReload} onRelaunch={handleRelaunch} pages={pages} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Table toolbar */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 border-b shrink-0 flex-wrap">
              {/* Title + CSV + Search */}
              <span className="text-sm font-semibold whitespace-nowrap">Table ({tableRows.length} {tableRows.length === 1 ? "ad" : "ads"})</span>
              <button
                onClick={exportTableCSV}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border/60 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                title="Export to CSV"
              >
                <IconDownload className="size-3" />CSV
              </button>
              <div className="relative">
                <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/50" />
                <input
                  value={tableSearchQuery}
                  onChange={e => setTableSearchQuery(e.target.value)}
                  placeholder="Search by ad name or copy..."
                  className="pl-7 pr-3 py-1.5 text-xs bg-muted/40 border rounded-lg outline-none focus:ring-1 focus:ring-ring w-48 placeholder:text-muted-foreground/50"
                />
                {tableSearchQuery && (
                  <button onClick={() => setTableSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <IconX className="size-3" />
                  </button>
                )}
              </div>

              {/* Divider */}
              <div className="h-5 w-px bg-border mx-0.5" />

              {/* Auto-sync toggle */}
              <div className="flex items-center gap-1.5" title={tableAutoSync ? "Auto-sync ON: gallery changes propagate to all rows" : "Auto-sync OFF"}>
                <button
                  onClick={() => setTableAutoSync(s => !s)}
                  className={cn("relative inline-flex h-[18px] w-8 items-center rounded-full transition-colors shrink-0",
                    tableAutoSync ? "bg-primary" : "bg-muted-foreground/30")}
                >
                  <span className={cn("inline-block size-3 rounded-full bg-white shadow-sm transition-transform",
                    tableAutoSync ? "translate-x-[18px]" : "translate-x-0.5")} />
                </button>
              </div>

              {/* Ad Profile button */}
              <button
                onClick={() => setAdProfilesOpen(true)}
                className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                title="Ad Profile (Facebook & Instagram)"
              >
                <IconUsers className="size-3.5" />
              </button>

              {/* Sync button */}
              <button
                onClick={syncTableFromGallery}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                title="Sync ad copy from Gallery Mode to all table rows"
              >
                <IconRefresh className="size-3.5" />Sync
              </button>

              {/* Configure columns */}
              <button
                className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                title="Configure columns"
              >
                <IconArrowsSort className="size-3.5" />
              </button>

              {/* Right section */}
              <div className="ml-auto flex items-center gap-1">
                {/* AI Group */}
                <button className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="AI Group">
                  <IconWorldPin className="size-3.5" />AI Group
                </button>

                {/* Column view buttons */}
                <button className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground" title="Single column view">
                  <IconLayout className="size-3.5" />
                </button>
                <button className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground" title="Stacked view">
                  <IconStack2 className="size-3.5" />
                </button>
                <button className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground" title="Grid view">
                  <IconLayoutGrid className="size-3.5" />
                </button>
                <button className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground" title="Side-by-side view">
                  <IconSelector className="size-3.5" />
                </button>

                {/* Bulk Edit dropdown */}
                <div ref={tableBulkRef} className="relative">
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1 px-2.5"
                    onClick={() => setTableBulkOpen(o => !o)}
                  >
                    <IconPencil className="size-3" />Bulk Edit<IconChevronDown className="size-3" />
                  </Button>
                  {tableBulkOpen && (
                    <div className="absolute right-0 top-full mt-1 bg-popover border rounded-xl shadow-lg z-50 w-52 overflow-hidden py-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-3 py-1.5">Apply to all rows</p>
                      {[
                        { label: "Primary Text from Gallery", action: () => { const pt = primaryTexts.find(t => t.trim()) || ""; if (pt) setTableRows(prev => prev.map(r => ({ ...r, primaryText: pt }))); setTableBulkOpen(false) } },
                        { label: "Headline from Gallery", action: () => { const hl = headlines.find(h => h.trim()) || ""; if (hl) setTableRows(prev => prev.map(r => ({ ...r, headline: hl }))); setTableBulkOpen(false) } },
                        { label: "Description from Gallery", action: () => { if (description) setTableRows(prev => prev.map(r => ({ ...r, description }))); setTableBulkOpen(false) } },
                        { label: "Ad Sets from Gallery", action: () => { const ids = selectedAdSets.map((a: AdSet) => a.id); if (ids.length) setTableRows(prev => prev.map(r => ({ ...r, adSetIds: ids }))); setTableBulkOpen(false) } },
                        { label: "CTA from Gallery", action: () => { if (cta) setTableRows(prev => prev.map(r => ({ ...r, cta }))); setTableBulkOpen(false) } },
                      ].map(item => (
                        <button key={item.label} onClick={item.action} className="w-full px-3 py-2 text-xs text-left hover:bg-accent transition-colors">
                          {item.label}
                        </button>
                      ))}
                      <div className="border-t my-1" />
                      <button onClick={() => { setTableRows(prev => prev.map(r => ({ ...r, adSetIds: [] }))); setTableBulkOpen(false) }} className="w-full px-3 py-2 text-xs text-left hover:bg-accent transition-colors text-destructive">
                        Clear all Ad Sets
                      </button>
                    </div>
                  )}
                </div>

                {/* 3-dot more menu */}
                <div ref={tableMoreRef} className="relative">
                  <button
                    onClick={() => setTableMoreOpen(o => !o)}
                    className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                    title="More options"
                  >
                    <IconDotsVertical className="size-4" />
                  </button>
                  {tableMoreOpen && (
                    <div className="absolute right-0 top-full mt-1 bg-popover border rounded-xl shadow-lg z-50 w-44 overflow-hidden py-1">
                      <button onClick={() => { addTableRow(); setTableMoreOpen(false) }} className="w-full px-3 py-2 text-xs text-left hover:bg-accent transition-colors flex items-center gap-2">
                        <IconPlus className="size-3.5" />Add new row
                      </button>
                      <button onClick={() => { exportTableCSV(); setTableMoreOpen(false) }} className="w-full px-3 py-2 text-xs text-left hover:bg-accent transition-colors flex items-center gap-2">
                        <IconDownload className="size-3.5" />Export CSV
                      </button>
                      <button onClick={() => { setSheetsImportOpen(true); setTableMoreOpen(false) }} className="w-full px-3 py-2 text-xs text-left hover:bg-accent transition-colors flex items-center gap-2">
                        <IconTable className="size-3.5 text-emerald-600" />Import from Google Sheets
                      </button>
                      <button onClick={() => { syncTableFromGallery(); setTableMoreOpen(false) }} className="w-full px-3 py-2 text-xs text-left hover:bg-accent transition-colors flex items-center gap-2">
                        <IconRefresh className="size-3.5" />Sync from Gallery
                      </button>
                      <div className="border-t my-1" />
                      <button onClick={() => { setTableRows([{ id: String(Date.now()), creative: null, adName: "", primaryText: "", headline: "", description: "", adSetIds: [] }]); setTableMoreOpen(false) }} className="w-full px-3 py-2 text-xs text-left hover:bg-accent transition-colors flex items-center gap-2 text-destructive">
                        <IconTrash className="size-3.5" />Clear all rows
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <TableMode
              rows={tableRows}
              adSets={allAdSets}
              onAddRow={addTableRow}
              onUpdateRow={updateTableRow}
              onDeleteRow={deleteTableRow}
              onDuplicateRow={duplicateTableRow}
              selectedPage={selectedPage}
              igAccountCache={igAccountCache}
              selectedIgPageId={selectedIgPageId}
              searchQuery={tableSearchQuery}
              launchAsActive={launchAsActive}
              pages={pages}
            />

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
              <Button
                className="flex-1 gap-2 font-medium"
                onClick={() => {
                  const hasRowCreatives = tableRows.some(r => r.creative?.id && r.adSetIds.length > 0)
                  hasRowCreatives ? doTableLaunch() : doLaunch()
                }}
                disabled={launching}
              >
                {launching ? <IconLoader2 className="size-4 animate-spin" /> : <IconRocket className="size-4" />}
                {launching ? "Launching..." : "Launch Ads"}
              </Button>
            </div>
          </div>
        )}

      </div>

      <SheetsImportDialog
        open={sheetsImportOpen}
        onOpenChange={setSheetsImportOpen}
        adAccountId={selectedAccountId || ""}
        onImport={handleSheetsImport}
      />
    </>
  )
}
