"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useOrg } from "@/lib/org-context"
import { cn } from "@/lib/utils"
import {
  IconSearch, IconLoader2, IconX, IconPhoto, IconVideo,
  IconFileDescription, IconRocket, IconClock, IconBulb,
  IconFolder, IconChevronRight,
} from "@tabler/icons-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type ResultType = "creative" | "template" | "batch" | "inspo"

interface SearchResult {
  id: string
  type: ResultType
  title: string
  subtitle?: string
  meta?: string
  href: string
  thumb?: string | null
  mediaType?: "image" | "video"
}

const STORAGE_KEY = "adlauncher_recent_searches"
const MAX_RECENT = 6

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") } catch { return [] }
}
function saveRecent(q: string) {
  const prev = getRecent().filter(s => s !== q)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)))
}
function removeRecent(q: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getRecent().filter(s => s !== q)))
}
function timeAgo(dateStr: string) {
  const d = new Date(dateStr)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString()
}

// ─── Result Row ───────────────────────────────────────────────────────────────

function ResultRow({ r, onClick }: { r: SearchResult; onClick: () => void }) {
  const Icon =
    r.type === "creative" ? (r.mediaType === "video" ? IconVideo : IconPhoto)
    : r.type === "template" ? IconFileDescription
    : r.type === "inspo" ? IconBulb
    : IconRocket

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left group"
    >
      <div className="size-9 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0 border">
        {r.thumb
          ? <img src={r.thumb} alt={r.title} className="w-full h-full object-cover" />
          : <Icon className="size-4 text-muted-foreground" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{r.title}</p>
        {r.subtitle && <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {r.meta && <span className="text-xs text-muted-foreground">{r.meta}</span>}
        <IconChevronRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  )
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-5 pb-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{label}</span>
      <span className="text-[10px] text-muted-foreground/40">({count})</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const router = useRouter()
  const { activeOrg } = useOrg()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    setRecent(getRecent())
    inputRef.current?.focus()
  }, [])

  const search = useCallback(async (q: string) => {
    if (!q.trim() || !activeOrg?.id) return
    setLoading(true)
    setSearched(true)
    const supabase = createClient()
    const like = `%${q.trim()}%`

    const [creativesRes, templatesRes, batchesRes, inspoRes] = await Promise.all([
      supabase
        .from("creatives")
        .select("id, file_name, media_type, fb_thumbnail_url, fb_image_url, headline, primary_text, created_at")
        .eq("org_id", activeOrg.id)
        .or(`file_name.ilike.${like},headline.ilike.${like},primary_text.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("ad_copy_templates")
        .select("id, name, primary_text, created_at")
        .eq("org_id", activeOrg.id)
        .or(`name.ilike.${like},primary_text.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("launch_batches")
        .select("id, created_at, total_ads, successful_ads")
        .eq("org_id", activeOrg.id)
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("inspo_saved_ads")
        .select("id, page_name, ad_body, ad_title, ad_snapshot_url, created_at")
        .eq("org_id", activeOrg.id)
        .or(`page_name.ilike.${like},ad_body.ilike.${like},ad_title.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(5),
    ])

    const out: SearchResult[] = []

    for (const c of creativesRes.data || []) {
      out.push({
        id: c.id,
        type: "creative",
        title: c.file_name,
        subtitle: c.headline || c.primary_text?.slice(0, 80) || undefined,
        meta: timeAgo(c.created_at),
        href: `/assets?q=${encodeURIComponent(c.file_name)}`,
        thumb: c.fb_thumbnail_url || c.fb_image_url || null,
        mediaType: c.media_type,
      })
    }

    for (const t of templatesRes.data || []) {
      out.push({
        id: t.id,
        type: "template",
        title: t.name,
        subtitle: t.primary_text?.slice(0, 80) || undefined,
        meta: timeAgo(t.created_at),
        href: `/templates?q=${encodeURIComponent(t.name)}`,
      })
    }

    for (const b of batchesRes.data || []) {
      out.push({
        id: b.id,
        type: "batch",
        title: "Launch batch",
        subtitle: `${b.successful_ads ?? 0} / ${b.total_ads ?? 0} ads successful`,
        meta: timeAgo(b.created_at),
        href: `/ads-manager?batch=${b.id}`,
      })
    }

    for (const s of inspoRes.data || []) {
      out.push({
        id: s.id,
        type: "inspo",
        title: s.ad_title || s.page_name || "Saved ad",
        subtitle: s.ad_body?.slice(0, 80) || s.page_name || undefined,
        meta: timeAgo(s.created_at),
        href: `/inspo?tab=saved&q=${encodeURIComponent(s.page_name || s.ad_title || "")}`,
        thumb: s.ad_snapshot_url || null,
      })
    }

    setResults(out)
    setLoading(false)
  }, [activeOrg?.id])

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearched(false); return }
    const t = setTimeout(() => search(query), 280)
    return () => clearTimeout(t)
  }, [query, search])

  const handleSelect = (r: SearchResult) => {
    saveRecent(query.trim())
    setRecent(getRecent())
    router.push(r.href)
  }

  const groups = {
    creative: results.filter(r => r.type === "creative"),
    template: results.filter(r => r.type === "template"),
    batch: results.filter(r => r.type === "batch"),
    inspo: results.filter(r => r.type === "inspo"),
  }

  const hasResults = results.length > 0

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Search bar */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="relative">
            {loading
              ? <IconLoader2 className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground animate-spin" />
              : <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            }
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search creatives, templates, inspo, launches…"
              className="w-full h-12 pl-12 pr-12 rounded-xl border-2 bg-muted/30 text-base outline-none focus:border-primary focus:bg-background transition-all placeholder:text-muted-foreground/50"
              onKeyDown={e => {
                if (e.key === "Escape") { setQuery(""); inputRef.current?.blur() }
                if (e.key === "Enter" && query.trim()) { saveRecent(query.trim()); setRecent(getRecent()) }
              }}
            />
            {query && (
              <button
                onClick={() => { setQuery(""); setResults([]); setSearched(false); inputRef.current?.focus() }}
                className="absolute right-4 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/30 transition-colors"
              >
                <IconX className="size-3" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Search across creatives, templates, inspo saved ads, and launch history
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto">

          {!query && (
            <div className="px-4 py-6">
              {recent.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Recent</span>
                    <button onClick={() => { localStorage.removeItem(STORAGE_KEY); setRecent([]) }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Clear all
                    </button>
                  </div>
                  <div className="space-y-0.5">
                    {recent.map(q => (
                      <div key={q} className="flex items-center gap-2 group">
                        <button onClick={() => { setQuery(q); inputRef.current?.focus() }} className="flex-1 flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-left">
                          <IconClock className="size-3.5 text-muted-foreground/50 shrink-0" />
                          <span className="text-sm text-foreground/80">{q}</span>
                        </button>
                        <button onClick={() => { removeRecent(q); setRecent(getRecent()) }} className="size-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all">
                          <IconX className="size-3 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">Quick nav</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Assets", sub: "Creatives & media", href: "/assets", Icon: IconPhoto },
                    { label: "Templates", sub: "Saved ad copy", href: "/templates", Icon: IconFileDescription },
                    { label: "Ads Manager", sub: "Active campaigns", href: "/ads-manager", Icon: IconRocket },
                    { label: "Inspo", sub: "Ad inspiration", href: "/inspo", Icon: IconFolder },
                  ].map(({ label, sub, href, Icon }) => (
                    <button key={href} onClick={() => router.push(href)} className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/40 transition-colors text-left">
                      <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="size-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground truncate">{sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {query && !loading && searched && !hasResults && (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="size-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <IconSearch className="size-6 text-muted-foreground/50" />
              </div>
              <p className="font-medium mb-1">No results for "{query}"</p>
              <p className="text-sm text-muted-foreground">Try different keywords or browse from the sidebar</p>
            </div>
          )}

          {hasResults && (
            <div className="py-2 divide-y divide-border/50">
              {groups.creative.length > 0 && (
                <div>
                  <SectionLabel label="Creatives" count={groups.creative.length} />
                  {groups.creative.map(r => <ResultRow key={r.id} r={r} onClick={() => handleSelect(r)} />)}
                </div>
              )}
              {groups.template.length > 0 && (
                <div>
                  <SectionLabel label="Templates" count={groups.template.length} />
                  {groups.template.map(r => <ResultRow key={r.id} r={r} onClick={() => handleSelect(r)} />)}
                </div>
              )}
              {groups.inspo.length > 0 && (
                <div>
                  <SectionLabel label="Inspo Saved" count={groups.inspo.length} />
                  {groups.inspo.map(r => <ResultRow key={r.id} r={r} onClick={() => handleSelect(r)} />)}
                </div>
              )}
              {groups.batch.length > 0 && (
                <div>
                  <SectionLabel label="Launch History" count={groups.batch.length} />
                  {groups.batch.map(r => <ResultRow key={r.id} r={r} onClick={() => handleSelect(r)} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
