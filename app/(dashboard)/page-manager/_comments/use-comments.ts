"use client"

import { useCallback, useState } from "react"
import {
  PAGE_MANAGER_AUTOMATION_CACHE_TTL_MS,
  PAGE_MANAGER_COMMENT_CACHE_TTL_MS,
  readCachedValue,
  writeCachedValue,
} from "../_shared/cache"
import type { CommentAnalytics, CommentAutomation, ManagedComment } from "./types"

type UseCommentsDataParams = {
  selectedPage: { id: string } | null
  selectedAdAccountId: string
}

/**
 * Comments + comment-automations state, shared between the Comments tab (page-manager/_comments)
 * and the Inbox tab's "Facebook Comment" thread view — both read the same `comments` rows.
 * Call once in page.tsx; never call a second time inside _comments.
 */
export function useCommentsData({ selectedPage, selectedAdAccountId }: UseCommentsDataParams) {
  const [comments, setComments] = useState<ManagedComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsError, setCommentsError] = useState("")
  const [commentsSyncing, setCommentsSyncing] = useState(false)
  const [commentsAnalytics, setCommentsAnalytics] = useState<CommentAnalytics | null>(null)
  const [commentsAnalyticsLoading, setCommentsAnalyticsLoading] = useState(false)
  const [commentAutomations, setCommentAutomations] = useState<CommentAutomation[]>([])
  const [commentActionLoading, setCommentActionLoading] = useState(false)

  const loadComments = useCallback(async (forceRefresh = false) => {
    const pageId = selectedPage?.id
    if (!pageId) return

    setCommentsLoading(true)
    setCommentsAnalyticsLoading(true)
    setCommentsError("")

    try {
      const cacheKey = `page_manager_comments:${pageId}`
      if (!forceRefresh) {
        const cached = readCachedValue<{ comments: ManagedComment[]; analytics: CommentAnalytics | null }>(
          cacheKey,
          PAGE_MANAGER_COMMENT_CACHE_TTL_MS
        )
        if (cached) {
          setComments(cached.comments || [])
          setCommentsAnalytics(cached.analytics || null)
          setCommentAutomations(prev => prev.length ? prev : [])
          return
        }
      }

      const [commentsRes, analyticsRes] = await Promise.all([
        fetch(`/api/comments?page_id=${encodeURIComponent(pageId)}&limit=200`),
        fetch(`/api/comments/analytics?page_id=${encodeURIComponent(pageId)}&range=last_30d`),
      ])

      const commentsData = await commentsRes.json().catch(() => ({}))
      const analyticsData = await analyticsRes.json().catch(() => ({}))

      if (!commentsRes.ok) {
        throw new Error(commentsData.error || "Unable to load comments.")
      }

      const fetchedComments = Array.isArray(commentsData.comments) ? commentsData.comments : []
      setComments(fetchedComments)

      if (analyticsRes.ok && !analyticsData.error) {
        setCommentsAnalytics(analyticsData as CommentAnalytics)
      } else {
        setCommentsAnalytics(null)
      }

      if (fetchedComments.length || !forceRefresh) {
        writeCachedValue(cacheKey, {
          comments: fetchedComments,
          analytics: analyticsRes.ok && !analyticsData.error ? (analyticsData as CommentAnalytics) : null,
        })
      }
    } catch (err: any) {
      setComments([])
      setCommentsAnalytics(null)
      setCommentAutomations([])
      setCommentsError(err?.message || "Unable to load comments.")
    } finally {
      setCommentsLoading(false)
      setCommentsAnalyticsLoading(false)
    }
  }, [selectedPage?.id])

  const loadCommentAutomations = useCallback(async (forceRefresh = false) => {
    const cacheKey = "page_manager_comment_automations"
    if (!forceRefresh) {
      const cached = readCachedValue<CommentAutomation[]>(cacheKey, PAGE_MANAGER_AUTOMATION_CACHE_TTL_MS)
      if (cached) {
        setCommentAutomations(cached)
        return
      }
    }

    try {
      const res = await fetch("/api/comments/automations")
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Unable to load automations.")
      const automations = Array.isArray(data.automations) ? data.automations : []
      setCommentAutomations(automations)
      writeCachedValue(cacheKey, automations)
    } catch {
      setCommentAutomations([])
    }
  }, [])

  const syncComments = useCallback(async () => {
    const pageId = selectedPage?.id
    if (!pageId || commentsSyncing) return

    // Skip sync for demo/mock page IDs — they cannot be synced from Meta
    if (/^p-\d+$/.test(pageId)) return

    setCommentsSyncing(true)
    setCommentsError("")
    try {
      const res = await fetch("/api/comments/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId, ad_account_id: selectedAdAccountId || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        let errorMsg = data.error || "Unable to sync comments."
        if (data.needsReconnect || data.type === "object_unavailable" || data.type === "token") {
          try { sessionStorage.removeItem("page_manager_pages_cache") } catch { }
          errorMsg = "This Page is no longer accessible with the current token. Reconnect Facebook, refresh the Page list, then select the Page again."
        } else if (data.type === "permission" || errorMsg.includes("pages_read_engagement") || errorMsg.includes("Public Content Access")) {
          errorMsg = "Couldn't load comments. This Page may need extra Facebook access before comments can be synced."
        }
        throw new Error(errorMsg)
      }
      try { sessionStorage.removeItem(`page_manager_comments:${pageId}`) } catch { }
      await loadComments(true)
    } catch (err: any) {
      setCommentsError(err?.message || "Unable to sync comments.")
    } finally {
      setCommentsSyncing(false)
    }
  }, [commentsSyncing, loadComments, selectedAdAccountId, selectedPage?.id])

  return {
    comments,
    setComments,
    commentsLoading,
    commentsError,
    setCommentsError,
    commentsSyncing,
    commentsAnalytics,
    commentsAnalyticsLoading,
    commentAutomations,
    setCommentAutomations,
    commentActionLoading,
    setCommentActionLoading,
    loadComments,
    loadCommentAutomations,
    syncComments,
  }
}

export type CommentsData = ReturnType<typeof useCommentsData>
