"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { cn } from "@/lib/utils"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts"
import {
  IconLoader2, IconRefresh, IconSearch, IconChevronDown, IconCheck, IconX,
  IconArrowsUpDown, IconBell, IconMessage, IconChartBar, IconBolt,
  IconHistory, IconPlus, IconThumbUp, IconEye, IconEyeOff,
  IconArrowBackUp, IconDotsVertical, IconInbox,
} from "@tabler/icons-react"
import { useAdAccount } from "@/lib/ad-account-context"

// ─── Types ────────────────────────────────────────────────────────────────────

type CommentTab  = "inbox" | "analytics" | "automation" | "history"
type InboxFilter = "all" | "unreplied" | "positive" | "neutral" | "negative"
type SortType    = "positive-to-negative" | "negative-to-positive" | "newest" | "oldest" | "most-liked"

interface Comment {
  id: string
  fb_comment_id: string
  fb_post_id: string
  fb_post_message: string
  page_id: string
  message: string
  from_name: string
  from_id: string
  sentiment: "positive" | "neutral" | "negative"
  sentiment_score: number
  themes: string[]
  like_count: number
  is_hidden: boolean
  is_replied: boolean
  draft_reply?: string
  fb_created_time: string
}

interface PageItem { id: string; fb_page_id: string; name: string; picture_url: string }
interface Automation {
  id: string; name: string; description: string; trigger_type: string
  trigger_value: string; action_type: string; action_value: string
  is_active: boolean; template_name: string; run_count: number
}

// ─── Automation templates ─────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: "thank-kind", name: "Thank kind comments",
    trigger: "WHEN tone is positive · THEN AI drafts a thank-you reply",
    desc: "Spot upbeat comments and reply with a warm, on-brand thank-you. Great for boosting engagement on top-performing creatives.",
    time: "~30 seconds to set up", popular: true, icon: "❤️",
    trigger_type: "sentiment_positive", action_type: "ai_reply", trigger_value: "",
  },
  {
    id: "auto-hide-spam", name: "Auto-hide spam",
    trigger: "WHEN comment contains spam keywords · THEN hide it from public view",
    desc: "Quietly hide common spam patterns (links, scams, promo bait) so your ad creatives stay clean.",
    time: "~30 seconds to set up", popular: false, icon: "🛡️",
    trigger_type: "keyword", action_type: "hide", trigger_value: "spam,scam,click here,free money,DM me,WhatsApp",
  },
  {
    id: "catch-complaints", name: "Catch complaints",
    trigger: "WHEN tone is negative · THEN AI drafts an empathetic reply",
    desc: "Catch unhappy comments early and draft an empathetic, problem-solving reply for your team to approve before sending.",
    time: "~1 minute to set up", popular: false, icon: "😕",
    trigger_type: "sentiment_negative", action_type: "draft_reply", trigger_value: "",
  },
  {
    id: "answer-faqs", name: "Answer FAQs",
    trigger: "WHEN comment asks a question · THEN AI drafts an answer",
    desc: "Detect questions and draft AI answers grounded in your product info — you approve before anything goes live.",
    time: "~1 minute to set up", popular: false, icon: "😊",
    trigger_type: "question", action_type: "draft_reply", trigger_value: "",
  },
  {
    id: "promote-positive", name: "Promote on positive",
    trigger: "WHEN tone is positive · THEN reply with a discount code",
    desc: "Reward fans who leave positive comments with a discount code or link — a low-effort upsell on warm traffic.",
    time: "~1 minute to set up", popular: false, icon: "🎁",
    trigger_type: "sentiment_positive", action_type: "custom_reply", trigger_value: "",
  },
  {
    id: "hide-off-topic", name: "Hide off-topic",
    trigger: "WHEN comment contains off-topic keywords · THEN hide it",
    desc: "Keep ad threads on-topic by quietly hiding tangential or trolling comments.",
    time: "~30 seconds to set up", popular: false, icon: "🚫",
    trigger_type: "keyword", action_type: "hide", trigger_value: "politics,religion,hate,competitor",
  },
]

const SORT_LABELS: Record<SortType, string> = {
  "positive-to-negative": "Positive to Negative",
  "negative-to-positive": "Negative to Positive",
  newest:   "Newest First",
  oldest:   "Oldest First",
  "most-liked": "Most Liked",
}

const SENT_DOT: Record<string, string> = {
  all: "#94a3b8", unreplied: "#3b82f6", positive: "#10b981", neutral: "#94a3b8", negative: "#ef4444",
}
const SENT_BADGE: Record<string, string> = {
  positive: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  neutral:  "bg-muted/50 text-muted-foreground",
  negative: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div className="fixed top-4 right-4 z-50 bg-foreground text-background px-4 py-2.5 rounded-xl text-sm shadow-xl animate-in slide-in-from-top-2">
      {msg}
    </div>
  )
}

function AnalyticsKpi({ label, value, icon, trend, sub, isScore }: {
  label: string; value: number; icon: React.ReactNode; trend?: number; sub?: string; isScore?: boolean
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span className="text-muted-foreground/40">{icon}</span>
      </div>
      <p className="text-2xl font-bold">{isScore ? value.toFixed(2) : value.toLocaleString()}</p>
      {trend !== undefined && (
        <p className={cn("text-xs mt-0.5 flex items-center gap-1", trend >= 0 ? "text-emerald-500" : "text-rose-500")}>
          {trend >= 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}% vs previous period
        </p>
      )}
      {sub && <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  )
}

function CommentCard({ comment, replyingTo, replyText, replyLoading, onReply, onCancelReply, onSubmitReply, onReplyTextChange, onToggleHide }: {
  comment: Comment; replyingTo: string | null; replyText: string; replyLoading: boolean
  onReply: () => void; onCancelReply: () => void; onSubmitReply: () => void
  onReplyTextChange: (v: string) => void; onToggleHide: () => void
}) {
  const isReplying = replyingTo === comment.id
  const initials   = comment.from_name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?"
  const timeStr    = comment.fb_created_time
    ? new Date(comment.fb_created_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : ""

  return (
    <div className={cn("px-5 py-4 hover:bg-muted/10 transition-colors group", comment.is_hidden && "opacity-60")}>
      <div className="flex gap-3">
        <div className="size-9 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center shrink-0 select-none">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{comment.from_name || "Unknown"}</span>
            <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full capitalize", SENT_BADGE[comment.sentiment])}>
              {comment.sentiment}
            </span>
            {comment.is_hidden  && <span className="text-xs bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-full">Hidden</span>}
            {comment.is_replied && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 px-1.5 py-0.5 rounded-full">Replied</span>}
            <span className="text-xs text-muted-foreground ml-auto">{timeStr}</span>
          </div>

          {comment.fb_post_message && (
            <p className="text-xs text-muted-foreground/50 mt-0.5 truncate">
              On: {comment.fb_post_message}
            </p>
          )}

          <p className="text-sm mt-1.5 text-foreground/80 leading-relaxed">{comment.message}</p>

          {comment.themes?.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {comment.themes.slice(0, 3).map(t => (
                <span key={t} className="text-xs px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">{t}</span>
              ))}
            </div>
          )}

          {comment.draft_reply && !comment.is_replied && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
              <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 mb-0.5">✨ AI Draft Reply</p>
              <p className="text-xs text-foreground/70">{comment.draft_reply}</p>
            </div>
          )}

          <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onReply}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <IconArrowBackUp className="size-3.5" /> Reply
            </button>
            <button onClick={onToggleHide}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              {comment.is_hidden
                ? <><IconEye className="size-3.5" /> Show</>
                : <><IconEyeOff className="size-3.5" /> Hide</>}
            </button>
            {comment.like_count > 0 && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <IconThumbUp className="size-3" /> {comment.like_count}
              </span>
            )}
          </div>

          {isReplying && (
            <div className="mt-3 flex gap-2">
              <textarea
                value={replyText}
                onChange={e => onReplyTextChange(e.target.value)}
                placeholder="Write a reply..."
                rows={2}
                className="flex-1 text-sm rounded-lg border bg-background px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-primary/30"
              />
              <div className="flex flex-col gap-1.5">
                <button onClick={onSubmitReply} disabled={replyLoading || !replyText.trim()}
                  className="h-8 px-3 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1 font-medium transition-colors">
                  {replyLoading ? <IconLoader2 className="size-3 animate-spin" /> : "Send"}
                </button>
                <button onClick={onCancelReply}
                  className="h-8 px-3 text-xs rounded-lg border hover:bg-muted/50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main CommentsView ─────────────────────────────────────────────────────────

export function CommentsView() {
  const [commentTab,      setCommentTab]      = useState<CommentTab>("inbox")
  const [inboxFilter,     setInboxFilter]     = useState<InboxFilter>("all")
  const [pages,           setPages]           = useState<PageItem[]>([])
  const [selectedPageId,  setSelectedPageId]  = useState("")
  const [pagePickerOpen,  setPagePickerOpen]  = useState(false)
  const [comments,        setComments]        = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [syncing,         setSyncing]         = useState(false)
  const [search,          setSearch]          = useState("")
  const [sort,            setSort]            = useState<SortType>("newest")
  const [sortOpen,        setSortOpen]        = useState(false)
  const [replyingTo,      setReplyingTo]      = useState<string | null>(null)
  const [replyText,       setReplyText]       = useState("")
  const [replyLoading,    setReplyLoading]    = useState(false)
  const [analytics,       setAnalytics]       = useState<any>(null)
  const [analyticsLoading,setAnalyticsLoading]= useState(false)
  const [analyticsRange,  setAnalyticsRange]  = useState("last_30d")
  const [automations,     setAutomations]     = useState<Automation[]>([])
  const [autoLoading,     setAutoLoading]     = useState(false)
  const [history,         setHistory]         = useState<any[]>([])
  const [historyLoading,  setHistoryLoading]  = useState(false)
  const [toast,           setToast]           = useState("")
  const pickerRef = useRef<HTMLDivElement>(null)
  const sortRef   = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPagePickerOpen(false)
      if (sortRef.current   && !sortRef.current.contains(e.target as Node))   setSortOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  // Auto-clear toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(""), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // Load pages on mount
  useEffect(() => {
    fetch("/api/comments/pages")
      .then(r => r.json())
      .then(d => {
        if (d.pages?.length) { setPages(d.pages); setSelectedPageId(d.pages[0].fb_page_id) }
      })
  }, [])

  // Load comments
  const loadComments = useCallback(() => {
    if (!selectedPageId) return
    setCommentsLoading(true)
    const p = new URLSearchParams({ page_id: selectedPageId })
    if (inboxFilter !== "all" && inboxFilter !== "unreplied") p.set("sentiment", inboxFilter)
    if (inboxFilter === "unreplied") p.set("unreplied", "1")
    fetch(`/api/comments?${p}`)
      .then(r => r.json())
      .then(d => { if (d.comments) setComments(d.comments) })
      .finally(() => setCommentsLoading(false))
  }, [selectedPageId, inboxFilter])

  useEffect(() => { if (commentTab === "inbox") loadComments() }, [commentTab, loadComments])

  // Load analytics
  useEffect(() => {
    if (commentTab !== "analytics" || !selectedPageId) return
    setAnalyticsLoading(true)
    fetch(`/api/comments/analytics?page_id=${selectedPageId}&range=${analyticsRange}`)
      .then(r => r.json()).then(setAnalytics).finally(() => setAnalyticsLoading(false))
  }, [commentTab, selectedPageId, analyticsRange])

  // Load automations
  useEffect(() => {
    if (commentTab !== "automation") return
    setAutoLoading(true)
    fetch("/api/comments/automations")
      .then(r => r.json()).then(d => { if (d.automations) setAutomations(d.automations) })
      .finally(() => setAutoLoading(false))
  }, [commentTab])

  // Load history
  useEffect(() => {
    if (commentTab !== "history") return
    setHistoryLoading(true)
    fetch("/api/comments/history")
      .then(r => r.json()).then(d => { if (d.runs) setHistory(d.runs) })
      .finally(() => setHistoryLoading(false))
  }, [commentTab])

  // Sync comments
  const syncComments = async () => {
    if (!selectedPageId || syncing) return
    setSyncing(true)
    try {
      const res = await fetch("/api/comments/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: selectedPageId }),
      })
      const d = await res.json()
      if (d.error) { setToast("Sync failed: " + d.error); return }
      setToast(`Synced ${d.new_count || 0} new comments`)
      loadComments()
    } catch { setToast("Sync failed") }
    finally { setSyncing(false) }
  }

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...comments]
    if (search) list = list.filter(c =>
      c.message.toLowerCase().includes(search.toLowerCase()) ||
      c.from_name.toLowerCase().includes(search.toLowerCase())
    )
    if      (sort === "positive-to-negative") list.sort((a, b) => b.sentiment_score - a.sentiment_score)
    else if (sort === "negative-to-positive") list.sort((a, b) => a.sentiment_score - b.sentiment_score)
    else if (sort === "newest")               list.sort((a, b) => new Date(b.fb_created_time).getTime() - new Date(a.fb_created_time).getTime())
    else if (sort === "oldest")               list.sort((a, b) => new Date(a.fb_created_time).getTime() - new Date(b.fb_created_time).getTime())
    else if (sort === "most-liked")           list.sort((a, b) => b.like_count - a.like_count)
    return list
  }, [comments, search, sort])

  const counts = useMemo(() => ({
    all:       comments.length,
    unreplied: comments.filter(c => !c.is_replied).length,
    positive:  comments.filter(c => c.sentiment === "positive").length,
    neutral:   comments.filter(c => c.sentiment === "neutral").length,
    negative:  comments.filter(c => c.sentiment === "negative").length,
  }), [comments])

  const submitReply = async (commentId: string) => {
    if (!replyText.trim()) return
    setReplyLoading(true)
    try {
      const res = await fetch(`/api/comments/${commentId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText, page_id: selectedPageId }),
      })
      const d = await res.json()
      if (d.error) { setToast("Reply failed: " + d.error); return }
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, is_replied: true } : c))
      setReplyingTo(null); setReplyText("")
      setToast("Reply sent!")
    } catch { setToast("Reply failed") }
    finally { setReplyLoading(false) }
  }

  const toggleHide = async (comment: Comment) => {
    try {
      await fetch(`/api/comments/${comment.id}/hide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_hidden: !comment.is_hidden, page_id: selectedPageId }),
      })
      setComments(prev => prev.map(c => c.id === comment.id ? { ...c, is_hidden: !c.is_hidden } : c))
    } catch {}
  }

  const useTemplate = async (template: typeof TEMPLATES[0]) => {
    const res = await fetch("/api/comments/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: template.name, description: template.desc,
        trigger_type: template.trigger_type, trigger_value: template.trigger_value,
        action_type: template.action_type, template_name: template.id,
      }),
    })
    const d = await res.json()
    if (d.automation) { setAutomations(prev => [d.automation, ...prev]); setToast(`"${template.name}" added!`) }
  }

  const toggleAuto = async (id: string, is_active: boolean) => {
    await fetch(`/api/comments/automations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    })
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, is_active } : a))
  }

  const deleteAuto = async (id: string) => {
    await fetch(`/api/comments/automations/${id}`, { method: "DELETE" })
    setAutomations(prev => prev.filter(a => a.id !== id))
    setToast("Automation removed")
  }

  const selectedPage = pages.find(p => p.fb_page_id === selectedPageId)

  const TAB_ITEMS: { id: CommentTab; label: string; icon: any }[] = [
    { id: "inbox",      label: "Inbox",      icon: IconInbox },
    { id: "analytics",  label: "Analytics",  icon: IconChartBar },
    { id: "automation", label: "Automation", icon: IconBolt },
    { id: "history",    label: "History",    icon: IconHistory },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Toast msg={toast} />

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b shrink-0 gap-3 bg-background">
        <h1 className="text-base font-semibold flex items-center gap-2">
          <IconMessage className="size-4" /> Comments
        </h1>
        <div className="flex items-center gap-2">
          {/* Page picker */}
          <div className="relative" ref={pickerRef}>
            <button onClick={() => setPagePickerOpen(v => !v)}
              className="flex items-center gap-2 h-8 px-3 text-sm rounded-lg border bg-background hover:bg-muted/50 transition-colors min-w-[160px] max-w-[220px]">
              {selectedPage ? (
                <>
                  {selectedPage.picture_url && (
                    <img src={selectedPage.picture_url} className="size-4 rounded-full object-cover shrink-0" alt="" />
                  )}
                  <span className="truncate flex-1 text-left">{selectedPage.name}</span>
                </>
              ) : (
                <span className="text-muted-foreground flex-1 text-left">Select a page</span>
              )}
              <IconChevronDown className="size-3.5 text-muted-foreground shrink-0" />
            </button>
            {pagePickerOpen && pages.length > 0 && (
              <div className="absolute top-full right-0 mt-1 z-50 bg-popover border rounded-xl shadow-xl min-w-[200px] overflow-hidden">
                <div className="py-1">
                  {pages.map(p => (
                    <button key={p.fb_page_id}
                      onClick={() => { setSelectedPageId(p.fb_page_id); setPagePickerOpen(false) }}
                      className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors",
                        p.fb_page_id === selectedPageId && "text-primary font-medium")}>
                      {p.picture_url && <img src={p.picture_url} className="size-5 rounded-full shrink-0" alt="" />}
                      <span className="truncate flex-1 text-left">{p.name}</span>
                      {p.fb_page_id === selectedPageId && <IconCheck className="size-3.5 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button className="h-8 w-8 flex items-center justify-center rounded-lg border hover:bg-muted/50 transition-colors">
            <IconDotsVertical className="size-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center border-b shrink-0 px-5 bg-background">
        {TAB_ITEMS.map(t => (
          <button key={t.id} onClick={() => setCommentTab(t.id)}
            className={cn("flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-colors",
              commentTab === t.id
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground")}>
            <t.icon className="size-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════ INBOX ══════════════════════ */}
      {commentTab === "inbox" && (
        <div className="flex flex-1 overflow-hidden">

          {/* Left filter sidebar */}
          <div className="w-44 shrink-0 border-r overflow-y-auto py-3 px-2 space-y-0.5 bg-sidebar">
            {(["all", "unreplied", "positive", "neutral", "negative"] as InboxFilter[]).map(f => (
              <button key={f} onClick={() => setInboxFilter(f)}
                className={cn("flex items-center justify-between w-full px-2.5 py-2 text-sm rounded-md transition-colors",
                  inboxFilter === f
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: SENT_DOT[f] }} />
                  <span className="capitalize">{f}</span>
                </div>
                {counts[f] > 0 && (
                  <span className="text-xs tabular-nums bg-muted/70 px-1.5 py-0.5 rounded-full leading-none">
                    {counts[f]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Comment list panel */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0 bg-background">
              <div className="flex items-center gap-2 flex-1 bg-muted/30 rounded-lg px-3 py-1.5 min-w-0">
                <IconSearch className="size-3.5 text-muted-foreground/50 shrink-0" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search comments, ads, users..."
                  className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40 min-w-0" />
                <span className="text-xs text-muted-foreground/40 bg-muted/60 px-1.5 py-0.5 rounded shrink-0">⌘K</span>
              </div>

              {/* Sort */}
              <div className="relative shrink-0" ref={sortRef}>
                <button onClick={() => setSortOpen(v => !v)}
                  className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border hover:bg-muted/50 transition-colors whitespace-nowrap">
                  <IconArrowsUpDown className="size-3.5 text-muted-foreground" />
                  Sort: {SORT_LABELS[sort]}
                  <IconChevronDown className="size-3.5 text-muted-foreground" />
                </button>
                {sortOpen && (
                  <div className="absolute top-full right-0 mt-1 z-40 bg-popover border rounded-lg shadow-lg py-1 min-w-[200px]">
                    {(Object.entries(SORT_LABELS) as [SortType, string][]).map(([k, v]) => (
                      <button key={k} onClick={() => { setSort(k); setSortOpen(false) }}
                        className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between",
                          sort === k && "text-primary font-medium")}>
                        {v} {sort === k && <IconCheck className="size-3.5" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                {filtered.length}/{comments.length}
              </span>

              <button onClick={syncComments} disabled={syncing || !selectedPageId}
                className="h-8 px-3 text-sm rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-40">
                {syncing ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconRefresh className="size-3.5" />}
                {syncing ? "Syncing…" : "Sync"}
              </button>
            </div>

            {/* Empty: no page selected */}
            {!selectedPageId && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                <div className="size-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <IconBell className="size-8 text-amber-500" />
                </div>
                <div className="text-center max-w-sm">
                  <h3 className="text-base font-semibold">Enable Real-Time Comments</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Subscribe to automatically receive new comments in real-time. No more manual syncing needed.
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-center">
                  <button className="h-9 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium flex items-center gap-2 transition-colors">
                    <IconBell className="size-4" /> Subscribe to Real-Time Comments
                  </button>
                  <span className="text-sm text-muted-foreground">or sync manually</span>
                </div>
              </div>
            )}

            {/* Loading */}
            {selectedPageId && commentsLoading && (
              <div className="flex-1 flex items-center justify-center">
                <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Empty: no comments */}
            {selectedPageId && !commentsLoading && filtered.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                <div className="size-14 rounded-full bg-muted/30 flex items-center justify-center">
                  <IconMessage className="size-7 text-muted-foreground/30" />
                </div>
                <div className="text-center">
                  <h3 className="text-base font-semibold">No comments found</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    No comments available. Select a specific page to view comments.
                  </p>
                </div>
                <button onClick={syncComments} disabled={syncing}
                  className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
                  {syncing ? <IconLoader2 className="size-4 animate-spin" /> : <IconRefresh className="size-4" />}
                  Sync Comments
                </button>
              </div>
            )}

            {/* Comment list */}
            {selectedPageId && !commentsLoading && filtered.length > 0 && (
              <div className="flex-1 overflow-y-auto divide-y">
                {filtered.map(comment => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    replyingTo={replyingTo}
                    replyText={replyText}
                    replyLoading={replyLoading}
                    onReply={() => { setReplyingTo(comment.id); setReplyText(comment.draft_reply || "") }}
                    onCancelReply={() => { setReplyingTo(null); setReplyText("") }}
                    onSubmitReply={() => submitReply(comment.id)}
                    onReplyTextChange={setReplyText}
                    onToggleHide={() => toggleHide(comment)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ ANALYTICS ══════════════════════ */}
      {commentTab === "analytics" && (
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Time Range</span>
            <div className="flex items-center gap-2">
              <select value={analyticsRange} onChange={e => setAnalyticsRange(e.target.value)}
                className="h-8 px-3 text-sm rounded-lg border bg-background cursor-pointer">
                <option value="last_7d">Last 7 days</option>
                <option value="last_30d">Last 30 days</option>
                <option value="last_12_months">Last 12 months</option>
              </select>
              <button onClick={() => {
                setAnalyticsLoading(true)
                fetch(`/api/comments/analytics?page_id=${selectedPageId}&range=${analyticsRange}`)
                  .then(r => r.json()).then(setAnalytics).finally(() => setAnalyticsLoading(false))
              }} className="h-8 w-8 flex items-center justify-center rounded-lg border hover:bg-muted/50 transition-colors">
                <IconRefresh className="size-3.5" />
              </button>
            </div>
          </div>

          {analyticsLoading && (
            <div className="flex justify-center py-20">
              <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!analyticsLoading && !analytics && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <IconMessage className="size-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Sync comments first to see analytics.</p>
            </div>
          )}

          {!analyticsLoading && analytics && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <AnalyticsKpi label="Total Comments"    value={analytics.total || 0}         icon={<IconMessage className="size-4" />}   trend={analytics.trend?.total} />
                <AnalyticsKpi label="Avg. Sentiment"    value={analytics.avgSentiment || 0}  icon={<IconThumbUp className="size-4" />}   trend={analytics.trend?.sentiment} isScore />
                <AnalyticsKpi label="Positive Comments" value={analytics.positive || 0}      icon={<IconChartBar className="size-4" />}  sub={`${analytics.total > 0 ? ((analytics.positive / analytics.total) * 100).toFixed(0) : 0}% of total`} />
                <AnalyticsKpi label="Total Reactions"   value={analytics.totalReactions || 0} icon={<IconThumbUp className="size-4" />} />
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">Sentiment Trend</h3>
                  {analytics.trend_data?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={analytics.trend_data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                        <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} formatter={(v: any) => [v.toFixed(1), "Score"]} />
                        <Line type="monotone" dataKey="score" name="Score" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
                  )}
                </div>

                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">Comment Volume</h3>
                  {analytics.volume_data?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analytics.volume_data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                        <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 9 }} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                        <Bar dataKey="count" name="Comments" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
                  )}
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-4">Sentiment Distribution</h3>
                  <div className="flex justify-around items-end">
                    {[
                      { label: "Positive", value: analytics.positive || 0,  color: "#10b981" },
                      { label: "Neutral",  value: analytics.neutral  || 0,  color: "#94a3b8" },
                      { label: "Negative", value: analytics.negative || 0,  color: "#ef4444" },
                    ].map(s => (
                      <div key={s.label} className="flex flex-col items-center gap-2">
                        <span className="text-2xl font-bold">{s.value}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className="text-xs text-muted-foreground">{s.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">Top Themes</h3>
                  {analytics.themes?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {analytics.themes.slice(0, 12).map((t: any) => (
                        <span key={t.theme}
                          className="px-2.5 py-1 rounded-full text-xs bg-primary/10 text-primary flex items-center gap-1">
                          {t.theme}
                          {t.count > 1 && <span className="opacity-60 text-xs">×{t.count}</span>}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No themes yet. Sync comments first.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════ AUTOMATION ══════════════════════ */}
      {commentTab === "automation" && (
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Comment automation</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Automations that watch your comments and react for you. Pick one to start, or build your own.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => {
                setAutoLoading(true)
                fetch("/api/comments/automations").then(r => r.json())
                  .then(d => { if (d.automations) setAutomations(d.automations) })
                  .finally(() => setAutoLoading(false))
              }} className="h-8 w-8 flex items-center justify-center rounded-lg border hover:bg-muted/50 transition-colors">
                <IconRefresh className="size-3.5" />
              </button>
              <button className="h-8 px-3 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 font-medium transition-colors">
                <IconPlus className="size-3.5" /> New automation
              </button>
            </div>
          </div>

          {/* Active automations */}
          {autoLoading && (
            <div className="flex justify-center py-6">
              <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!autoLoading && automations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Automations</p>
              {automations.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3.5 rounded-xl border bg-card hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("size-2.5 rounded-full shrink-0", a.is_active ? "bg-emerald-500" : "bg-muted-foreground/30")} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.run_count} run{a.run_count !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggleAuto(a.id, !a.is_active)}
                      className={cn("h-7 px-2.5 text-xs rounded-lg border font-medium transition-colors",
                        a.is_active
                          ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20"
                          : "text-muted-foreground hover:bg-muted/50")}>
                      {a.is_active ? "Active" : "Inactive"}
                    </button>
                    <button onClick={() => deleteAuto(a.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors">
                      <IconX className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Templates hero */}
          <div className="rounded-xl border bg-muted/20 p-8 text-center">
            <div className="inline-flex items-center gap-1.5 text-violet-600 dark:text-violet-400 text-xs font-semibold bg-violet-100 dark:bg-violet-900/30 px-3 py-1 rounded-full mb-4">
              ✨ Get started in 30 seconds
            </div>
            <h3 className="text-xl font-bold">Pick a template to get your first automation running</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
              Templates are pre-built automations for common situations. They're tested, ready to go, and you can tweak them later.
            </p>
          </div>

          {/* Template grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TEMPLATES.map(t => {
              const added = automations.some(a => a.template_name === t.id)
              return (
                <div key={t.id} className="rounded-xl border bg-card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <span className="text-2xl leading-none">{t.icon}</span>
                    {t.popular && (
                      <span className="text-xs font-bold bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full">
                        Popular
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.trigger}</p>
                  </div>
                  <p className="text-xs text-muted-foreground flex-1 leading-relaxed">{t.desc}</p>
                  <div className="flex items-center justify-between pt-1 border-t">
                    <span className="text-xs text-muted-foreground/60">{t.time}</span>
                    <button onClick={() => !added && useTemplate(t)}
                      className={cn("text-xs font-medium flex items-center gap-1 transition-colors",
                        added ? "text-muted-foreground/40 cursor-default" : "text-primary hover:text-primary/70")}>
                      {added ? "Added ✓" : "Use this template →"}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-center text-sm text-muted-foreground pb-4">
            Want full control?{" "}
            <button className="text-primary hover:underline">Build a custom automation →</button>
          </p>
        </div>
      )}

      {/* ══════════════════════ HISTORY ══════════════════════ */}
      {commentTab === "history" && (
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{history.length} total run{history.length !== 1 ? "s" : ""}</p>
            <button onClick={() => {
              setHistoryLoading(true)
              fetch("/api/comments/history").then(r => r.json())
                .then(d => { if (d.runs) setHistory(d.runs) })
                .finally(() => setHistoryLoading(false))
            }} className="h-8 px-3 text-sm rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-1.5">
              <IconRefresh className="size-3.5" /> Refresh
            </button>
          </div>

          {historyLoading && (
            <div className="flex justify-center py-20">
              <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!historyLoading && history.length === 0 && (
            <div className="rounded-xl border bg-card p-16 flex flex-col items-center gap-3">
              <IconHistory className="size-14 text-muted-foreground/20" />
              <p className="text-base font-semibold">No automation history yet</p>
              <p className="text-sm text-muted-foreground">History will appear here once automation rules have been executed</p>
            </div>
          )}

          {!historyLoading && history.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Automation</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Action</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Result</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(r => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{r.automation_name}</td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{r.action_taken?.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[220px] truncate">{r.result}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
                          r.status === "success" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                            : r.status === "skipped" ? "bg-muted/60 text-muted-foreground"
                            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400")}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {new Date(r.run_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
