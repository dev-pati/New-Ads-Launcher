"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
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
  IconCopy,
  IconCheck,
  IconBulb,
  IconTarget,
  IconThumbUp,
  IconThumbDown,
  IconStar,
  IconRefresh,
  IconQuote,
  IconRoute,
  IconWorld,
  IconVideo,
  IconFileText,
  IconPlayerPlay,
} from "@tabler/icons-react"
import { BoardSidebar, type InspoSection } from "@/components/inspo/BoardSidebar"
import { InspoDiscoveryPage } from "@/components/inspo/InspoDiscoveryPage"
import { BrandSpyPage } from "@/components/inspo/BrandSpyPage"
import type { InspoBoard, DiscoveryAd } from "@/types/inspo"

// ─── Types ──────────────────────────────────────────────────────────────────

type SubTab = "adscan" | "ai" | "create" | "brand-spy" | "saved"
type AiMode = "text" | "url" | "video"
type AiSubMode = "analyze" | "generate"
type GenMode = "url" | "video"

interface Generated {
  product_name: string
  target_audience: string
  primary_texts: Array<{ angle: string; text: string }>
  headlines: string[]
  descriptions: string[]
  cta: string
}

interface Creative {
  id: string
  file_name: string
  file_url: string
  media_type: "image" | "video"
  fb_thumbnail_url?: string
}

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

interface Analysis {
  hook: { text: string; type: string; why_works: string }
  framework: { name: string; explanation: string }
  audience: string
  emotion: string
  cta: string
  strengths: string[]
  weaknesses: string[]
  score: number
  score_reason: string
  variations: Array<{ hook: string; angle: string }>
}

// ─── Constants ───────────────────────────────────────────────────────────────

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

const HOOK_TYPES: Record<string, { label: string; color: string }> = {
  curiosity:     { label: "Curiosity",     color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  fear:          { label: "Fear",          color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  social_proof:  { label: "Social Proof",  color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  transformation:{ label: "Transformation",color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  urgency:       { label: "Urgency",       color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  humor:         { label: "Humor",         color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
  authority:     { label: "Authority",     color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" },
}

const FRAMEWORK_COLORS: Record<string, string> = {
  PAS:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  AIDA:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  BAB:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  PASTOR:"bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  DIC:   "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "4Ps": "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

function formatDate(dateStr?: string) {
  if (!dateStr) return null
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", year: "numeric" })
  } catch { return null }
}

// ─── Shared Components ────────────────────────────────────────────────────────

function PlatformPill({ platform }: { platform: string }) {
  if (platform === "facebook") return (
    <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
      <IconBrandFacebook className="size-3" />Facebook
    </span>
  )
  if (platform === "instagram") return (
    <span className="flex items-center gap-1 text-xs text-pink-600 bg-pink-50 dark:bg-pink-950/30 dark:text-pink-400 px-2 py-0.5 rounded-full font-medium">
      <IconBrandInstagram className="size-3" />Instagram
    </span>
  )
  return <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize font-medium">{platform}</span>
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
  onAnalyze?: () => void
}

function AdCard({ pageName, body, title, snapshotUrl, startTime, platforms, isSaved, isSaving, onSave, onUnsave, onAnalyze }: AdCardProps) {
  return (
    <div className="border rounded-xl bg-card hover:shadow-md transition-all flex flex-col overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        <div className={cn("size-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0", avatarColor(pageName))}>
          {pageName[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{pageName}</p>
          {startTime && <p className="text-xs text-muted-foreground">Since {formatDate(startTime)}</p>}
        </div>
      </div>

      <div className="px-4 pb-3 flex-1">
        {body
          ? <p className="text-sm text-muted-foreground line-clamp-4 leading-relaxed">{body}</p>
          : <p className="text-sm text-muted-foreground/40 italic">No ad copy</p>
        }
        {title && <p className="text-sm font-medium mt-2 line-clamp-2">{title}</p>}
      </div>

      {platforms && platforms.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {platforms.slice(0, 3).map(p => <PlatformPill key={p} platform={p} />)}
        </div>
      )}

      <div className="px-4 py-3 border-t flex items-center gap-2">
        <Button size="sm" variant={isSaved ? "default" : "outline"} className="gap-1.5 text-xs flex-1"
          onClick={isSaved ? onUnsave : onSave} disabled={isSaving}>
          {isSaving ? <IconLoader2 className="size-3 animate-spin" />
            : isSaved ? <IconBookmarkFilled className="size-3" />
            : <IconBookmark className="size-3" />}
          {isSaved ? "Saved" : "Save"}
        </Button>
        {onAnalyze && body && (
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs px-2" onClick={onAnalyze} title="Analyze with AI">
            <IconSparkles className="size-3.5" />
          </Button>
        )}
        {snapshotUrl && (
          <Button size="sm" variant="ghost" className="px-2.5" onClick={() => window.open(snapshotUrl, "_blank")} title="View on Meta Ad Library">
            <IconExternalLink className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Analysis Result Components ──────────────────────────────────────────────

function AnalysisCard({ title, icon, children, className }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("border rounded-xl bg-card p-4 space-y-3", className)}>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      </div>
      {children}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <IconCheck className="size-3.5 text-green-500" /> : <IconCopy className="size-3.5" />}
    </button>
  )
}

function GenerateResult({ generated, onReset }: { generated: Generated; onReset: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{generated.product_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{generated.target_audience}</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onReset}>
          <IconRefresh className="size-3.5" />Generate another
        </Button>
      </div>

      {/* Primary Texts */}
      <AnalysisCard title="Primary Texts — 3 variations" icon={<IconFileText className="size-4" />}>
        <div className="space-y-3">
          {generated.primary_texts.map((pt, i) => (
            <div key={i} className="rounded-lg bg-muted/40 border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">V{i + 1} · {pt.angle}</span>
                <CopyButton text={pt.text} />
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{pt.text}</p>
            </div>
          ))}
        </div>
      </AnalysisCard>

      {/* Headlines + Descriptions + CTA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AnalysisCard title="Headlines" icon={<IconQuote className="size-4" />}>
          <div className="space-y-2">
            {generated.headlines.map((h, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border">
                <p className="text-sm font-medium flex-1">{h}</p>
                <CopyButton text={h} />
              </div>
            ))}
          </div>
        </AnalysisCard>

        <AnalysisCard title="Descriptions" icon={<IconBulb className="size-4" />}>
          <div className="space-y-2">
            {generated.descriptions.map((d, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border">
                <p className="text-sm flex-1">{d}</p>
                <CopyButton text={d} />
              </div>
            ))}
          </div>
        </AnalysisCard>

        <AnalysisCard title="Call to Action" icon={<IconTarget className="size-4" />}>
          <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm font-bold tracking-wide text-primary">{generated.cta}</p>
            <CopyButton text={generated.cta} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Recommended CTA based on your content</p>
        </AnalysisCard>
      </div>
    </div>
  )
}

function AnalysisResult({ analysis, onReset }: { analysis: Analysis; onReset: () => void }) {
  const hookMeta = HOOK_TYPES[analysis.hook.type] ?? { label: analysis.hook.type, color: "bg-muted text-muted-foreground" }
  const frameworkColor = FRAMEWORK_COLORS[analysis.framework.name] ?? "bg-muted text-muted-foreground"
  const scoreColor = analysis.score >= 8 ? "text-emerald-600" : analysis.score >= 6 ? "text-amber-500" : "text-red-500"
  const scoreBg = analysis.score >= 8 ? "bg-emerald-500" : analysis.score >= 6 ? "bg-amber-400" : "bg-red-400"

  return (
    <div className="space-y-4">
      {/* Top actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Analysis complete</p>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onReset}>
          <IconRefresh className="size-3.5" />
          Analyze another
        </Button>
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Hook */}
        <AnalysisCard title="Hook" icon={<IconQuote className="size-4" />}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", hookMeta.color)}>
              {hookMeta.label}
            </span>
          </div>
          <p className="text-sm font-medium leading-snug">"{analysis.hook.text}"</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{analysis.hook.why_works}</p>
        </AnalysisCard>

        {/* Framework */}
        <AnalysisCard title="Copywriting Framework" icon={<IconRoute className="size-4" />}>
          <span className={cn("inline-block text-sm font-bold px-3 py-1 rounded-lg", frameworkColor)}>
            {analysis.framework.name}
          </span>
          <p className="text-xs text-muted-foreground leading-relaxed">{analysis.framework.explanation}</p>
        </AnalysisCard>

        {/* Audience + Emotion */}
        <AnalysisCard title="Audience & Emotion" icon={<IconTarget className="size-4" />}>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Target</p>
            <p className="text-sm leading-snug">{analysis.audience}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Primary emotion</p>
            <p className="text-sm leading-snug">{analysis.emotion}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">CTA</p>
            <p className="text-sm leading-snug">{analysis.cta}</p>
          </div>
        </AnalysisCard>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Strengths */}
        <AnalysisCard title="Strengths" icon={<IconThumbUp className="size-4" />}>
          <ul className="space-y-1.5">
            {analysis.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </AnalysisCard>

        {/* Weaknesses */}
        <AnalysisCard title="Weaknesses" icon={<IconThumbDown className="size-4" />}>
          <ul className="space-y-1.5">
            {analysis.weaknesses.length > 0
              ? analysis.weaknesses.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-amber-500 mt-0.5 shrink-0">!</span>
                  <span>{w}</span>
                </li>
              ))
              : <li className="text-sm text-muted-foreground">No major weaknesses identified</li>
            }
          </ul>
        </AnalysisCard>

        {/* Score */}
        <AnalysisCard title="Performance Score" icon={<IconStar className="size-4" />}>
          <div className="flex items-baseline gap-2">
            <span className={cn("text-4xl font-black", scoreColor)}>{analysis.score}</span>
            <span className="text-lg text-muted-foreground font-medium">/10</span>
          </div>
          {/* Score bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", scoreBg)} style={{ width: `${analysis.score * 10}%` }} />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{analysis.score_reason}</p>
        </AnalysisCard>
      </div>

      {/* Variations */}
      <AnalysisCard title="3 Hook Variations to Test" icon={<IconBulb className="size-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {analysis.variations.map((v, i) => (
            <div key={i} className="rounded-lg bg-muted/40 border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">V{i + 1} · {v.angle}</span>
                <CopyButton text={v.hook} />
              </div>
              <p className="text-sm leading-snug font-medium">"{v.hook}"</p>
            </div>
          ))}
        </div>
      </AnalysisCard>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InspoPage() {
  const searchParams = useSearchParams()
  const [activeSection, setActiveSection] = useState<InspoSection>(() => {
    const tab = searchParams.get("tab")
    if (tab === "ai")    return "ai"
    if (tab === "saved") return "saved"
    return "discovery"
  })
  const [savedSearch, setSavedSearch] = useState(() => searchParams.get("q") || "")

  // Ad Scan state
  const [query, setQuery] = useState("")
  const [country, setCountry] = useState("VN")
  const [adStatus, setAdStatus] = useState("ACTIVE")
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchErrSubcode, setSearchErrSubcode] = useState<number | null>(null)
  const [results, setResults] = useState<AdResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  // Saved Ads state
  const [savedAds, setSavedAds] = useState<SavedAd[]>([])
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())

  // AI tab state
  const [aiSubMode, setAiSubMode] = useState<AiSubMode>("analyze")
  const [aiMode, setAiMode] = useState<AiMode>("text")
  const [aiBody, setAiBody] = useState("")
  const [aiTitle, setAiTitle] = useState("")
  const [aiUrl, setAiUrl] = useState("")
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null)
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [loadingCreatives, setLoadingCreatives] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeStep, setAnalyzeStep] = useState("")
  const [aiError, setAiError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)

  // Generate tab state
  const [genMode, setGenMode] = useState<GenMode>("url")
  const [genUrl, setGenUrl] = useState("")
  const [genCreative, setGenCreative] = useState<Creative | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateStep, setGenerateStep] = useState("")
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generated, setGenerated] = useState<Generated | null>(null)

  const loadSavedAds = useCallback(async () => {
    setLoadingSaved(true)
    try {
      const res = await fetch("/api/inspo/saved")
      const data = await res.json()
      if (data.ads) {
        setSavedAds(data.ads)
        setSavedIds(new Set(data.ads.map((a: SavedAd) => a.ad_archive_id)))
      }
    } catch { /* silent */ }
    finally { setLoadingSaved(false) }
  }, [])

  useEffect(() => { loadSavedAds() }, [loadSavedAds])

  const loadCreatives = useCallback(async () => {
    setLoadingCreatives(true)
    try {
      const res = await fetch("/api/creatives?media_type=video")
      const data = await res.json()
      setCreatives(data.creatives || [])
    } catch { /* silent */ }
    finally { setLoadingCreatives(false) }
  }, [])

  useEffect(() => {
    if ((aiSubMode === "analyze" && aiMode === "video") || (aiSubMode === "generate" && genMode === "video")) {
      loadCreatives()
    }
  }, [aiMode, aiSubMode, genMode, loadCreatives])

  // ── Boards (Discovery) state ──────────────────────────────────────────────
  const [boards,        setBoards]        = useState<InspoBoard[]>([])
  const [boardsLoading, setBoardsLoading] = useState(true)
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null)
  const [activeBrand,   setActiveBrand]   = useState<string | null>(null)
  // savedMap: adId → Set of boardIds where saved
  const [savedMap, setSavedMap] = useState<Map<string, Set<string>>>(new Map())

  const loadBoards = useCallback(async () => {
    setBoardsLoading(true)
    try {
      const [boardsRes, savesRes] = await Promise.all([
        fetch("/api/inspo/boards"),
        fetch("/api/inspo/boards/all-saves").catch(() => null),
      ])
      const boardsData = await boardsRes.json()
      setBoards(boardsData.boards || [])

      // Build savedMap from all board saves if available
      if (savesRes?.ok) {
        const savesData = await savesRes.json()
        const map = new Map<string, Set<string>>()
        for (const { board_id, ad_id } of savesData.saves || []) {
          if (!map.has(ad_id)) map.set(ad_id, new Set())
          map.get(ad_id)!.add(board_id)
        }
        setSavedMap(map)
      }
    } catch { /* silent */ }
    finally { setBoardsLoading(false) }
  }, [])

  useEffect(() => { loadBoards() }, [loadBoards])

  const handleCreateBoard = useCallback(async (name: string): Promise<InspoBoard> => {
    const res  = await fetch("/api/inspo/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Failed to create board")
    setBoards(prev => [...prev, data.board])
    return data.board
  }, [])

  const handleDiscoverySave = useCallback(async (ad: DiscoveryAd, boardId: string) => {
    await fetch(`/api/inspo/boards/${boardId}/saves`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ad }),
    })
    setSavedMap(prev => {
      const next = new Map(prev)
      if (!next.has(ad.id)) next.set(ad.id, new Set())
      next.get(ad.id)!.add(boardId)
      return next
    })
    setBoards(prev => prev.map(b => b.id === boardId ? { ...b, ad_count: (b.ad_count || 0) + 1 } : b))
  }, [])

  const handleDiscoveryUnsave = useCallback(async (adId: string, boardId: string) => {
    await fetch(`/api/inspo/boards/${boardId}/saves?ad_id=${adId}`, { method: "DELETE" })
    setSavedMap(prev => {
      const next = new Map(prev)
      next.get(adId)?.delete(boardId)
      if (next.get(adId)?.size === 0) next.delete(adId)
      return next
    })
    setBoards(prev => prev.map(b => b.id === boardId ? { ...b, ad_count: Math.max(0, (b.ad_count || 1) - 1) } : b))
  }, [])

  const handleSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    setSearchError(null)
    setSearchErrSubcode(null)
    setHasSearched(true)
    try {
      const params = new URLSearchParams({ q: query.trim(), country, status: adStatus })
      const res = await fetch(`/api/inspo/adscan?${params}`)
      const data = await res.json()
      if (data.error) {
        setSearchError(data.error)
        setSearchErrSubcode(data.error_subcode ?? null)
        setResults([])
      } else {
        setResults(data.ads || [])
      }
    } catch {
      setSearchError("Network error. Please try again.")
      setResults([])
    } finally { setSearching(false) }
  }

  const handleSave = async (ad: AdResult) => {
    setSavingIds(prev => new Set(prev).add(ad.id))
    try {
      const res = await fetch("/api/inspo/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad_archive_id: ad.id, page_name: ad.page_name, page_id: ad.page_id,
          ad_body: ad.ad_creative_bodies?.[0], ad_title: ad.ad_creative_link_titles?.[0],
          ad_snapshot_url: ad.ad_snapshot_url, ad_delivery_start_time: ad.ad_delivery_start_time,
          publisher_platforms: ad.publisher_platforms,
        }),
      })
      if (res.ok) { setSavedIds(prev => new Set(prev).add(ad.id)); loadSavedAds() }
    } finally { setSavingIds(prev => { const n = new Set(prev); n.delete(ad.id); return n }) }
  }

  const handleUnsave = async (archiveId: string, dbId?: string) => {
    setSavingIds(prev => new Set(prev).add(archiveId))
    try {
      const id = dbId || savedAds.find(a => a.ad_archive_id === archiveId)?.id
      if (!id) return
      const res = await fetch(`/api/inspo/saved/${id}`, { method: "DELETE" })
      if (res.ok) {
        setSavedIds(prev => { const n = new Set(prev); n.delete(archiveId); return n })
        setSavedAds(prev => prev.filter(a => a.id !== id))
      }
    } finally { setSavingIds(prev => { const n = new Set(prev); n.delete(archiveId); return n }) }
  }

  const handleAnalyzeAd = (body?: string, title?: string) => {
    if (!body) return
    setAiBody(body)
    setAiTitle(title || "")
    setAnalysis(null)
    setAiError(null)
    setActiveSection("ai")
  }

  const handleAnalyze = async () => {
    setAnalyzing(true)
    setAiError(null)
    setAnalysis(null)
    try {
      if (aiMode === "video") {
        if (!selectedCreative) { setAiError("Please select a video"); return }
        setAnalyzeStep("Uploading to AI...")
        const res = await fetch("/api/inspo/ai/analyze/video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: selectedCreative.file_url }),
        })
        setAnalyzeStep("Analyzing video...")
        const data = await res.json()
        if (data.error) setAiError(data.error)
        else setAnalysis(data.analysis)
      } else if (aiMode === "url") {
        if (!aiUrl.trim()) { setAiError("Please enter a URL"); return }
        setAnalyzeStep("Fetching page...")
        const res = await fetch("/api/inspo/ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "url", url: aiUrl.trim() }),
        })
        setAnalyzeStep("Analyzing...")
        const data = await res.json()
        if (data.error) setAiError(data.error)
        else setAnalysis(data.analysis)
      } else {
        if (!aiBody.trim()) { setAiError("Please enter ad copy"); return }
        setAnalyzeStep("Analyzing...")
        const res = await fetch("/api/inspo/ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "text", ad_body: aiBody.trim(), ad_title: aiTitle.trim() || undefined }),
        })
        const data = await res.json()
        if (data.error) setAiError(data.error)
        else setAnalysis(data.analysis)
      }
    } catch { setAiError("Network error. Please try again.") }
    finally { setAnalyzing(false); setAnalyzeStep("") }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setGenerateError(null)
    setGenerated(null)
    try {
      if (genMode === "url") {
        if (!genUrl.trim()) { setGenerateError("Please enter a URL"); return }
        setGenerateStep("Fetching page...")
        const res = await fetch("/api/inspo/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "url", url: genUrl.trim() }),
        })
        setGenerateStep("Generating ad copy...")
        const data = await res.json()
        if (data.error) setGenerateError(data.error)
        else setGenerated(data.generated)
      } else {
        if (!genCreative) { setGenerateError("Please select a video"); return }
        setGenerateStep("Uploading video to AI...")
        const res = await fetch("/api/inspo/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "video", url: genCreative.file_url }),
        })
        setGenerateStep("Generating ad copy...")
        const data = await res.json()
        if (data.error) setGenerateError(data.error)
        else setGenerated(data.generated)
      }
    } catch { setGenerateError("Network error. Please try again.") }
    finally { setGenerating(false); setGenerateStep("") }
  }

  const isPermissionError = (err: string) => err.toLowerCase().includes("permission")
  const metaLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&is_targeted_country=false&media_type=all&q=${encodeURIComponent(query)}&search_type=keyword_unordered`

  const selectClass = "h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b shrink-0">
        <h1 className="font-heading text-xl font-bold">Inspo</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Research competitors, scan winning ads, and generate creative inspiration.</p>
      </div>

      {/* Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        <BoardSidebar
          activeSection={activeSection}
          onSectionChange={s => { setActiveSection(s); if (s !== "discovery") setActiveBoardId(null) }}
          activeBoardId={activeBoardId}
          onBoardSelect={id => { setActiveBoardId(id); setActiveSection("discovery") }}
          boards={boards}
          boardsLoading={boardsLoading}
          onCreateBoard={handleCreateBoard}
        />

      <div className="flex-1 overflow-hidden">

        {/* ── Discovery ── */}
        {activeSection === "discovery" && (
          <InspoDiscoveryPage
            boards={boards}
            savedMap={savedMap}
            onSave={handleDiscoverySave}
            onUnsave={handleDiscoveryUnsave}
            onCreateBoard={handleCreateBoard}
            activeBoardId={activeBoardId}
            onAnalyzeAd={handleAnalyzeAd}
            onBrandClick={name => { setActiveBrand(name); setActiveSection("brand-spy") }}
          />
        )}

        {/* ── Ad Scan (hidden behind Discovery, keep for backward compat) ── */}
        {activeSection === ("adscan" as any) && (
          <div className="h-full flex flex-col">
            <div className="px-6 py-4 border-b shrink-0">
              <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input placeholder="Search by brand or keyword..." value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                    className="pl-9" />
                </div>
                <select value={country} onChange={e => setCountry(e.target.value)} className={selectClass}>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
                <select value={adStatus} onChange={e => setAdStatus(e.target.value)} className={selectClass}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <Button onClick={handleSearch} disabled={searching || !query.trim()} className="gap-2 shrink-0">
                  {searching ? <IconLoader2 className="size-4 animate-spin" /> : <IconSearch className="size-4" />}
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
                <div className="flex flex-col items-center justify-center min-h-64 gap-4 text-center py-8">
                  <IconAlertCircle className="size-10 text-amber-400" />
                  <div>
                    <p className="font-semibold">
                      {searchErrSubcode === 2332002 ? "Chưa chấp nhận điều khoản Ad Library API" : "Không thể truy cập Meta Ad Library API"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">{searchError}</p>
                  </div>
                  <div className="border rounded-xl bg-muted/30 p-5 max-w-md w-full text-left space-y-4">
                    {searchErrSubcode === 2332002 ? (
                      <div>
                        <p className="text-sm font-semibold mb-2">Cách fix (cần làm 1 lần):</p>
                        <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside mb-4">
                          <li>Đăng nhập Facebook bằng tài khoản quản lý app</li>
                          <li>Vào <strong className="text-foreground">facebook.com/ads/library/api</strong></li>
                          <li>Click <strong className="text-foreground">"Access the API"</strong></li>
                          <li>Trong Graph API Explorer, click <strong className="text-foreground">"Generate Access Token"</strong> → chọn permission <strong className="text-foreground">ads_library</strong> → Accept</li>
                          <li>Quay lại đây và <strong className="text-foreground">Reconnect tài khoản Meta</strong> trong trang Connect</li>
                        </ol>
                        <Button
                          className="w-full gap-2 mb-2"
                          variant="default"
                          onClick={() => window.open("https://www.facebook.com/ads/library/api/", "_blank")}
                        >
                          <IconExternalLink className="size-4" />
                          Mở facebook.com/ads/library/api
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold mb-2">Tìm kiếm trực tiếp trên Meta Ad Library</p>
                        <p className="text-xs text-muted-foreground mb-3">Kết quả tương tự, đầy đủ dữ liệu — mở trong tab mới.</p>
                      </div>
                    )}
                    <Button className="w-full gap-2" variant={searchErrSubcode === 2332002 ? "outline" : "default"} onClick={() => window.open(metaLibraryUrl, "_blank")}>
                      <IconExternalLink className="size-4" />
                      Tìm &quot;{query}&quot; trên Meta Ad Library
                    </Button>
                  </div>
                </div>
              ) : !hasSearched ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
                  <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <IconScan className="size-8 text-muted-foreground/40" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Scan competitor ads</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                      Search by brand name or keyword to discover active ads
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
                      <AdCard key={ad.id}
                        archiveId={ad.id} pageName={ad.page_name}
                        body={ad.ad_creative_bodies?.[0]} title={ad.ad_creative_link_titles?.[0]}
                        snapshotUrl={ad.ad_snapshot_url} startTime={ad.ad_delivery_start_time}
                        platforms={ad.publisher_platforms}
                        isSaved={savedIds.has(ad.id)} isSaving={savingIds.has(ad.id)}
                        onSave={() => handleSave(ad)} onUnsave={() => handleUnsave(ad.id)}
                        onAnalyze={() => handleAnalyzeAd(ad.ad_creative_bodies?.[0], ad.ad_creative_link_titles?.[0])}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── AI Tab ── */}
        {activeSection === "ai" && (
          <div className="h-full flex flex-col overflow-y-auto">
            <div className="flex-1 p-6 space-y-6 max-w-5xl mx-auto w-full">

              {/* Analyze / Generate top switcher */}
              <div className="flex gap-1 p-1 rounded-xl bg-muted w-fit">
                {([
                  { id: "analyze",  label: "Analyze",  icon: IconSparkles },
                  { id: "generate", label: "Generate", icon: IconBulb },
                ] as const).map(m => (
                  <button key={m.id}
                    onClick={() => { setAiSubMode(m.id); setAiError(null); setAnalysis(null); setGenerateError(null); setGenerated(null) }}
                    className={cn("flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                      aiSubMode === m.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}>
                    <m.icon className="size-3.5" />{m.label}
                  </button>
                ))}
              </div>

              {/* ── Analyze sub-tab ── */}
              {aiSubMode === "analyze" && (
                !analysis ? (
                  <>
                    <div className="flex gap-1 p-1 rounded-xl bg-muted/60 w-fit border">
                      {([
                        { id: "text",  label: "Ad Copy",  icon: IconFileText },
                        { id: "url",   label: "Website",  icon: IconWorld },
                        { id: "video", label: "Video",    icon: IconVideo },
                      ] as const).map(m => (
                        <button key={m.id} onClick={() => { setAiMode(m.id); setAiError(null) }}
                          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                            aiMode === m.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                          )}>
                          <m.icon className="size-3.5" />{m.label}
                        </button>
                      ))}
                    </div>

                    <div className="border rounded-xl bg-card p-5 space-y-4">
                      {aiMode === "text" && (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Ad copy / body text <span className="text-destructive">*</span></label>
                            <textarea value={aiBody} onChange={e => setAiBody(e.target.value)}
                              placeholder="Paste the ad body copy here..."
                              rows={6}
                              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Headline <span className="font-normal">(optional)</span></label>
                            <Input value={aiTitle} onChange={e => setAiTitle(e.target.value)} placeholder="Ad headline..." />
                          </div>
                        </div>
                      )}

                      {aiMode === "url" && (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Landing page / product URL <span className="text-destructive">*</span></label>
                            <Input value={aiUrl} onChange={e => setAiUrl(e.target.value)}
                              placeholder="https://example.com/product" type="url" />
                          </div>
                          <p className="text-xs text-muted-foreground">AI đọc nội dung trang web và phân tích value proposition, messaging, CTA.</p>
                        </div>
                      )}

                      {aiMode === "video" && (
                        <div className="space-y-3">
                          <label className="text-xs font-medium text-muted-foreground block">Chọn video từ Assets <span className="text-destructive">*</span></label>
                          {loadingCreatives ? (
                            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
                              <IconLoader2 className="size-4 animate-spin" />Loading videos...
                            </div>
                          ) : creatives.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground border rounded-lg bg-muted/20">
                              No videos found. Upload videos in Assets first.
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                              {creatives.map(c => (
                                <button key={c.id} onClick={() => setSelectedCreative(c)}
                                  className={cn("relative rounded-lg overflow-hidden border-2 transition-all aspect-video bg-muted",
                                    selectedCreative?.id === c.id ? "border-primary ring-1 ring-primary" : "border-transparent hover:border-muted-foreground/40"
                                  )}>
                                  {c.fb_thumbnail_url
                                    ? <img src={c.fb_thumbnail_url} alt={c.file_name} className="w-full h-full object-cover" loading="lazy" onError={e => { e.currentTarget.style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement)?.style.setProperty("display", "flex") }} />
                                    : null
                                  }
                                  <div style={{ display: c.fb_thumbnail_url ? "none" : "flex" }} className="w-full h-full items-center justify-center"><IconPlayerPlay className="size-5 text-muted-foreground/40" /></div>
                                  {selectedCreative?.id === c.id && (
                                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                      <IconCheck className="size-5 text-primary" />
                                    </div>
                                  )}
                                  <p className="absolute bottom-0 left-0 right-0 text-[9px] truncate px-1 py-0.5 bg-black/50 text-white">{c.file_name}</p>
                                </button>
                              ))}
                            </div>
                          )}
                          {selectedCreative && (
                            <p className="text-xs text-muted-foreground">Selected: <strong className="text-foreground">{selectedCreative.file_name}</strong></p>
                          )}
                          <p className="text-xs text-muted-foreground">AI xem từng frame và audio để phân tích hook, messaging, và hiệu quả của video ad.</p>
                        </div>
                      )}

                      {aiError && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                          <IconAlertCircle className="size-4 shrink-0" />{aiError}
                        </div>
                      )}

                      <Button onClick={handleAnalyze} disabled={analyzing ||
                        (aiMode === "text" && !aiBody.trim()) ||
                        (aiMode === "url" && !aiUrl.trim()) ||
                        (aiMode === "video" && !selectedCreative)
                      } className="gap-2">
                        {analyzing
                          ? <><IconLoader2 className="size-4 animate-spin" />{analyzeStep || "Analyzing..."}</>
                          : <><IconSparkles className="size-4" />Analyze with AI</>
                        }
                      </Button>
                    </div>

                    {aiMode === "text" && savedAds.length > 0 && (
                      <div className="border rounded-xl p-4 space-y-3">
                        <p className="text-sm font-semibold">Quick analyze from Saved Ads</p>
                        <div className="flex flex-wrap gap-2">
                          {savedAds.slice(0, 5).filter(a => a.ad_body).map(ad => (
                            <button key={ad.id} onClick={() => handleAnalyzeAd(ad.ad_body, ad.ad_title)}
                              className="text-xs px-3 py-1.5 rounded-full border bg-background hover:bg-muted transition-colors truncate max-w-[200px]">
                              {ad.page_name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <AnalysisResult analysis={analysis} onReset={() => { setAnalysis(null); setAiBody(""); setAiTitle("") }} />
                )
              )}

              {/* ── Generate sub-tab ── */}
              {aiSubMode === "generate" && (
                !generated ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">AI viết primary text, headline, description và CTA hoàn chỉnh từ landing page hoặc video của bạn.</p>
                    </div>

                    <div className="flex gap-1 p-1 rounded-xl bg-muted/60 w-fit border">
                      {([
                        { id: "url",   label: "Landing Page",  icon: IconWorld },
                        { id: "video", label: "Video",         icon: IconVideo },
                      ] as const).map(m => (
                        <button key={m.id} onClick={() => { setGenMode(m.id); setGenerateError(null) }}
                          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                            genMode === m.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                          )}>
                          <m.icon className="size-3.5" />{m.label}
                        </button>
                      ))}
                    </div>

                    <div className="border rounded-xl bg-card p-5 space-y-4">
                      {genMode === "url" && (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                              Landing page URL <span className="text-destructive">*</span>
                            </label>
                            <Input value={genUrl} onChange={e => setGenUrl(e.target.value)}
                              placeholder="https://example.com/product" type="url" />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            AI đọc landing page và tạo ra 3 primary text, 3 headlines, 2 descriptions và CTA phù hợp với ngôn ngữ của trang.
                          </p>
                        </div>
                      )}

                      {genMode === "video" && (
                        <div className="space-y-3">
                          <label className="text-xs font-medium text-muted-foreground block">Chọn video từ Assets <span className="text-destructive">*</span></label>
                          {loadingCreatives ? (
                            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
                              <IconLoader2 className="size-4 animate-spin" />Loading videos...
                            </div>
                          ) : creatives.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground border rounded-lg bg-muted/20">
                              No videos found. Upload videos in Assets first.
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                              {creatives.map(c => (
                                <button key={c.id} onClick={() => setGenCreative(c)}
                                  className={cn("relative rounded-lg overflow-hidden border-2 transition-all aspect-video bg-muted",
                                    genCreative?.id === c.id ? "border-primary ring-1 ring-primary" : "border-transparent hover:border-muted-foreground/40"
                                  )}>
                                  {c.fb_thumbnail_url
                                    ? <img src={c.fb_thumbnail_url} alt={c.file_name} className="w-full h-full object-cover" loading="lazy" onError={e => { e.currentTarget.style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement)?.style.setProperty("display", "flex") }} />
                                    : null
                                  }
                                  <div style={{ display: c.fb_thumbnail_url ? "none" : "flex" }} className="w-full h-full items-center justify-center"><IconPlayerPlay className="size-5 text-muted-foreground/40" /></div>
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
                            <p className="text-xs text-muted-foreground">Selected: <strong className="text-foreground">{genCreative.file_name}</strong></p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            AI xem video và tạo ra ad copy hoàn chỉnh dựa trên nội dung, sản phẩm và ngôn ngữ trong video.
                          </p>
                        </div>
                      )}

                      {generateError && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                          <IconAlertCircle className="size-4 shrink-0" />{generateError}
                        </div>
                      )}

                      <Button onClick={handleGenerate} disabled={generating ||
                        (genMode === "url" && !genUrl.trim()) ||
                        (genMode === "video" && !genCreative)
                      } className="gap-2">
                        {generating
                          ? <><IconLoader2 className="size-4 animate-spin" />{generateStep || "Generating..."}</>
                          : <><IconBulb className="size-4" />Generate Ad Copy</>
                        }
                      </Button>
                    </div>
                  </>
                ) : (
                  <GenerateResult generated={generated} onReset={() => { setGenerated(null); setGenUrl(""); setGenCreative(null) }} />
                )
              )}

            </div>
          </div>
        )}

        {/* ── Saved Ads ── */}
        {activeSection === "saved" && (
          <div className="h-full flex flex-col">
            <div className="px-6 py-4 border-b shrink-0 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">Saved Ads</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{savedAds.length} ad{savedAds.length !== 1 ? "s" : ""} saved</p>
              </div>
              <div className="relative">
                <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                <input
                  value={savedSearch}
                  onChange={e => setSavedSearch(e.target.value)}
                  placeholder="Filter saved ads…"
                  className="h-8 pl-8 pr-3 text-xs rounded-lg border bg-muted/30 outline-none focus:ring-1 focus:ring-ring w-44 placeholder:text-muted-foreground/50"
                />
              </div>
              {savedAds.length > 0 && (
                <Button size="sm" variant="outline" className="gap-2 text-xs shrink-0" onClick={() => setActiveSection("discovery")}>
                  <IconScan className="size-3.5" />Discover more
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
                    <p className="text-sm text-muted-foreground mt-1">Scan competitors and save ads that inspire you</p>
                  </div>
                  <Button size="sm" variant="outline" className="gap-2 mt-1" onClick={() => setActiveSection("discovery")}>
                    <IconScan className="size-3.5" />Go to Discovery
                  </Button>
                </div>
              ) : (() => {
                const filtered = savedSearch.trim()
                  ? savedAds.filter(ad =>
                      (ad.page_name || "").toLowerCase().includes(savedSearch.toLowerCase()) ||
                      (ad.ad_body || "").toLowerCase().includes(savedSearch.toLowerCase()) ||
                      (ad.ad_title || "").toLowerCase().includes(savedSearch.toLowerCase())
                    )
                  : savedAds
                return filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-2 text-center">
                    <p className="text-sm text-muted-foreground">No saved ads match "{savedSearch}"</p>
                    <button onClick={() => setSavedSearch("")} className="text-xs text-primary hover:underline">Clear filter</button>
                  </div>
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filtered.map(ad => (
                    <AdCard key={ad.id}
                      archiveId={ad.ad_archive_id} pageName={ad.page_name}
                      body={ad.ad_body} title={ad.ad_title}
                      snapshotUrl={ad.ad_snapshot_url} startTime={ad.ad_delivery_start_time}
                      platforms={ad.publisher_platforms}
                      isSaved={true} isSaving={savingIds.has(ad.ad_archive_id)}
                      onSave={() => {}} onUnsave={() => handleUnsave(ad.ad_archive_id, ad.id)}
                      onAnalyze={() => handleAnalyzeAd(ad.ad_body, ad.ad_title)}
                    />
                  ))}
                </div>
                )
              })()}
            </div>
          </div>
        )}

        {/* ── Brand Spy ── */}
        {activeSection === "brand-spy" && (
          <BrandSpyPage
            initialBrand={activeBrand}
            onBrandChange={name => setActiveBrand(name)}
          />
        )}

        {/* ── Coming Soon ── */}
        {activeSection === "create" && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center">
              <IconPencil className="size-8 text-muted-foreground/40" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Coming Soon</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                Generate ad creatives and copy directly from your saved inspiration
              </p>
            </div>
          </div>
        )}

      </div>{/* end main content */}
      </div>{/* end sidebar+content row */}
    </div>
  )
}
