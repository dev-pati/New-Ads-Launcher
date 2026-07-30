"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { IconSearch, IconChevronDown, IconCheck, IconArrowsUpDown, IconRefresh, IconLoader2, IconMessage, IconArrowBackUp, IconEye, IconEyeOff, IconThumbUp } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { CommentsData } from "./use-comments"
import { commentHasPhone, commentIsCompetitor, type CommentFilter, type CommentSort, type ManagedComment } from "./types"

const SENT_DOT: Record<string, string> = {
  all: "#94a3b8", unreplied: "#3b82f6", needs: "#eab308", positive: "#10b981", neutral: "#94a3b8", negative: "#ef4444", has_phone: "#f97316", competitor: "#ec4899", ad_comments: "#6366f1"
}
const SENT_BADGE: Record<string, string> = {
  positive: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  neutral:  "bg-muted/50 text-muted-foreground",
  negative: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
}
const SORT_LABELS: Record<CommentSort, string> = {
  newest: "Newest First", oldest: "Oldest First", "most-liked": "Most Liked", "positive-to-negative": "Positive to Negative", "negative-to-positive": "Negative to Positive"
}

const FILTER_GROUPS = [
  { label: "Work", items: [{ id: "all", label: "All comments" }, { id: "unreplied", label: "Unreplied" }, { id: "needs", label: "Needs human" }] },
  { label: "Tone", items: [{ id: "positive", label: "Positive" }, { id: "neutral", label: "Neutral" }, { id: "negative", label: "Negative" }] },
  { label: "Signals", items: [{ id: "has_phone", label: "Has phone" }, { id: "competitor", label: "Competitor / spam" }, { id: "ad_comments", label: "Ad comments" }] },
]

function commentTime(c: ManagedComment) { return c.fb_created_time ? new Date(c.fb_created_time).getTime() : 0 }

type CommentQueueSectionProps = {
  selectedPage: { id: string; name?: string | null } | null
  competitorKeywords: string[]
  commentsData: CommentsData
}

export function CommentQueueSection({ selectedPage, competitorKeywords, commentsData }: CommentQueueSectionProps) {
  const { comments, commentsLoading, commentsSyncing, syncComments, loadComments, setCommentsError, commentActionLoading, setCommentActionLoading } = commentsData

  const [filter, setFilter] = useState<CommentFilter>("all")
  const [sort, setSort] = useState<CommentSort>("newest")
  const [search, setSearch] = useState("")
  const [sortOpen, setSortOpen] = useState(false)

  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")

  const sortRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false) }
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
  }, [])

  const counts = useMemo(() => ({
    all: comments.length,
    unreplied: comments.filter(c => !c.is_replied).length,
    needs: comments.filter(c => Boolean(c.needs_human)).length,
    positive: comments.filter(c => c.sentiment === "positive").length,
    neutral: comments.filter(c => c.sentiment === "neutral").length,
    negative: comments.filter(c => c.sentiment === "negative").length,
    has_phone: comments.filter(commentHasPhone).length,
    competitor: comments.filter(c => commentIsCompetitor(c, competitorKeywords)).length,
    ad_comments: comments.filter(c => Boolean(c.fb_post_id)).length,
  }), [comments, competitorKeywords])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = comments.filter(c => {
      if (filter === "unreplied" && c.is_replied) return false
      if (filter === "needs" && !c.needs_human) return false
      if (filter === "has_phone" && !commentHasPhone(c)) return false
      if (filter === "competitor" && !commentIsCompetitor(c, competitorKeywords)) return false
      if (filter === "ad_comments" && !c.fb_post_id) return false
      if (["positive", "neutral", "negative"].includes(filter) && c.sentiment !== filter) return false
      if (!q) return true
      return [c.from_name, c.message, c.fb_post_message, c.themes?.join(" ")].filter(Boolean).join(" ").toLowerCase().includes(q)
    })

    if (sort === "oldest") list.sort((a, b) => commentTime(a) - commentTime(b))
    else if (sort === "most-liked") list.sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
    else if (sort === "positive-to-negative") list.sort((a, b) => (b.sentiment_score ?? 0) - (a.sentiment_score ?? 0))
    else if (sort === "negative-to-positive") list.sort((a, b) => (a.sentiment_score ?? 0) - (b.sentiment_score ?? 0))
    else list.sort((a, b) => commentTime(b) - commentTime(a))
    return list
  }, [comments, filter, sort, search, competitorKeywords])

  const submitReply = async (commentId: string) => {
    if (!replyText.trim() || !selectedPage?.id) return
    setCommentActionLoading(true); setCommentsError("")
    try {
      const res = await fetch(`/api/comments/${commentId}/reply`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText, page_id: selectedPage.id }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || "Unable to send reply.")
      try { sessionStorage.removeItem(`page_manager_comments:${selectedPage.id}`) } catch { }
      await loadComments(true)
      setReplyingTo(null); setReplyText("")
    } catch (err) { setCommentsError(err instanceof Error ? err.message : "Reply failed") }
    finally { setCommentActionLoading(false) }
  }

  const toggleHide = async (c: ManagedComment) => {
    if (!selectedPage?.id) return
    setCommentActionLoading(true); setCommentsError("")
    try {
      const res = await fetch(`/api/comments/${c.id}/hide`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_hidden: !c.is_hidden, page_id: selectedPage.id }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || "Unable to update visibility.")
      try { sessionStorage.removeItem(`page_manager_comments:${selectedPage.id}`) } catch { }
      await loadComments(true)
    } catch (err) { setCommentsError(err instanceof Error ? err.message : "Hide failed") }
    finally { setCommentActionLoading(false) }
  }

  return (
    <div className="flex flex-1 overflow-hidden h-[calc(100vh-140px)] -mx-5 -mb-5 border-t">
      {/* Left sidebar */}
      <div className="w-48 shrink-0 border-r overflow-y-auto py-3 px-2 bg-sidebar space-y-4">
        {FILTER_GROUPS.map(g => (
          <div key={g.label} className="space-y-0.5">
            <p className="px-2.5 pb-1 text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider">{g.label}</p>
            {g.items.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id as CommentFilter)}
                className={cn("flex items-center justify-between w-full px-2.5 py-1.5 text-sm rounded-md transition-colors",
                  filter === f.id ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}>
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: SENT_DOT[f.id] || "#94a3b8" }} />
                  <span>{f.label}</span>
                </div>
                {counts[f.id as keyof typeof counts] > 0 && (
                  <span className="text-xs tabular-nums bg-muted/70 px-1.5 py-0.5 rounded-full leading-none">
                    {counts[f.id as keyof typeof counts]}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Main panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0 bg-background">
          <div className="flex items-center gap-2 flex-1 bg-muted/30 rounded-lg px-3 py-1.5 min-w-0 border border-transparent focus-within:border-primary/30">
            <IconSearch className="size-3.5 text-muted-foreground/50 shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search comments, ads, themes..."
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40 min-w-0" />
          </div>

          <div className="relative shrink-0" ref={sortRef}>
            <button onClick={() => setSortOpen(v => !v)}
              className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border hover:bg-muted/50 transition-colors whitespace-nowrap">
              <IconArrowsUpDown className="size-3.5 text-muted-foreground" /> Sort: {SORT_LABELS[sort]} <IconChevronDown className="size-3.5 text-muted-foreground" />
            </button>
            {sortOpen && (
              <div className="absolute top-full right-0 mt-1 z-40 bg-popover border rounded-lg shadow-lg py-1 min-w-[200px]">
                {(Object.entries(SORT_LABELS) as [CommentSort, string][]).map(([k, v]) => (
                  <button key={k} onClick={() => { setSort(k); setSortOpen(false) }}
                    className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between", sort === k && "text-primary font-medium")}>
                    {v} {sort === k && <IconCheck className="size-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{filtered.length}/{comments.length}</span>

          <button onClick={() => void syncComments()} disabled={commentsSyncing || !selectedPage?.id}
            className="h-8 px-3 text-sm rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-40">
            {commentsSyncing ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconRefresh className="size-3.5" />}
            {commentsSyncing ? "Syncing…" : "Sync"}
          </button>
        </div>

        {commentsLoading ? (
          <div className="flex-1 flex items-center justify-center"><IconLoader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-sm text-muted-foreground gap-3">
            <IconMessage className="size-8 text-muted-foreground/30" />
            <p>No comments match this filter.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y bg-background">
            {filtered.map(c => {
              const isReplying = replyingTo === c.id
              const initials = c.from_name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?"
              const timeStr = c.fb_created_time ? new Date(c.fb_created_time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""

              return (
                <div key={c.id} className={cn("px-5 py-4 hover:bg-muted/10 transition-colors group", c.is_hidden && "opacity-60")}>
                  <div className="flex gap-3">
                    <div className="size-9 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center shrink-0 select-none">{initials}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{c.from_name || "Unknown"}</span>
                        <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full capitalize", SENT_BADGE[c.sentiment])}>{c.sentiment}</span>
                        {c.is_hidden && <span className="text-xs bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-full">Hidden</span>}
                        {c.is_replied && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 px-1.5 py-0.5 rounded-full">Replied</span>}
                        {c.needs_human && <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 px-1.5 py-0.5 rounded-full">Needs human</span>}
                        <span className="text-xs text-muted-foreground ml-auto">{timeStr}</span>
                      </div>

                      {c.fb_post_message && <p className="text-xs text-muted-foreground/50 mt-0.5 truncate">On: {c.fb_post_message}</p>}
                      <p className="text-sm mt-1.5 text-foreground/80 leading-relaxed">{c.message}</p>

                      {c.themes?.length > 0 && (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {c.themes.slice(0, 3).map(t => <span key={t} className="text-xs px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">{t}</span>)}
                        </div>
                      )}

                      {c.draft_reply && !c.is_replied && (
                        <div className="mt-2 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                          <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 mb-0.5">AI Draft Reply</p>
                          <p className="text-xs text-foreground/70">{c.draft_reply}</p>
                        </div>
                      )}

                      <div className={cn("flex items-center gap-3 transition-all", isReplying ? "mt-3 opacity-100" : "mt-2 opacity-0 group-hover:opacity-100")}>
                        <button onClick={() => { setReplyingTo(isReplying ? null : c.id); setReplyText(isReplying ? "" : c.draft_reply || "") }}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                          <IconArrowBackUp className="size-3.5" /> Reply
                        </button>
                        <button onClick={() => void toggleHide(c)} disabled={commentActionLoading}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors disabled:opacity-50">
                          {c.is_hidden ? <><IconEye className="size-3.5" /> Show</> : <><IconEyeOff className="size-3.5" /> Hide</>}
                        </button>
                        {c.like_count > 0 && <span className="text-xs text-muted-foreground flex items-center gap-1"><IconThumbUp className="size-3" /> {c.like_count}</span>}
                      </div>

                      {isReplying && (
                        <div className="mt-3 flex gap-2">
                          <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply..." rows={2}
                            className="flex-1 text-sm rounded-lg border bg-background px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-primary/30" />
                          <div className="flex flex-col gap-1.5">
                            <button onClick={() => void submitReply(c.id)} disabled={commentActionLoading || !replyText.trim()}
                              className="h-8 px-3 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1 font-medium transition-colors">
                              {commentActionLoading ? <IconLoader2 className="size-3 animate-spin" /> : "Send"}
                            </button>
                            <button onClick={() => { setReplyingTo(null); setReplyText("") }}
                              className="h-8 px-3 text-xs rounded-lg border hover:bg-muted/50 transition-colors">Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
