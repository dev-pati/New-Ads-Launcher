"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient, getClientToken, getUserIdFromClientToken } from "@/lib/supabase/client"
import type { FieldChange } from "@/lib/notifications/types"

export type AppNotification = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  actor_name: string | null
  is_read: boolean
  created_at: string
  // v2 — absent until 20260803_notifications_v2.sql is applied.
  object_type?: string | null
  object_id?: string | null
  object_name?: string | null
  action?: string | null
  changes?: FieldChange[] | null
  read_at?: string | null
  archived_at?: string | null
}

type NotificationView = "inbox" | "archived"

/**
 * Live notification feed.
 *
 * The realtime publication has existed since 20260513_notifications_realtime.sql and
 * nothing ever subscribed to it — the client polled `/api/notifications` every 2
 * seconds instead, about 450 requests a minute for a five-person org with three tabs
 * each, and still took up to two seconds to show anything.
 *
 * The subscription filters on `user_id`, not `org_id`. Fan-out already happened on the
 * server, so a row exists per recipient; filtering by org would push teammates' rows to
 * this browser for RLS to reject, which leaks who-was-told-what and wastes the socket.
 *
 * Duplicates are prevented at three levels: `dedupe_key` stops the row being created
 * twice, merging by row `id` here stops a reconnect replay showing twice, and each tab
 * holds its own channel and its own copy of state so multiple tabs never compound.
 */
const SAFETY_REFETCH_MS = 60_000

export function useNotifications({ view = "inbox" }: { view?: NotificationView } = {}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [live, setLive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNotifications = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true)
    try {
      const res = await fetch(`/api/notifications?view=${view}`, { cache: "no-store" })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to load notifications")
      }
      const data = await res.json()
      setNotifications(data.notifications || [])
      setError(null)
    } catch (err) {
      console.error("[notifications] fetch error:", err)
      setError(err instanceof Error ? err.message : "Failed to load notifications")
    } finally {
      if (!options?.silent) setLoading(false)
    }
  }, [view])

  const fetchRef = useRef(fetchNotifications)
  fetchRef.current = fetchNotifications

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    const userId = getUserIdFromClientToken()
    if (!userId) return

    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null
    let cancelled = false

    const merge = (row: AppNotification) => {
      setNotifications(prev => {
        const at = prev.findIndex(n => n.id === row.id)
        if (at === -1) return [row, ...prev].slice(0, 50)
        const next = [...prev]
        next[at] = { ...next[at], ...row }
        return next
      })
    }

    ;(async () => {
      const supabase = createClient()
      const token = getClientToken()
      // RLS on `notifications` reads the custom JWT — without this the socket
      // authenticates as anon and silently receives nothing.
      if (token) await supabase.realtime.setAuth(token)
      if (cancelled) return

      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "ads_launcher",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          payload => {
            if (payload.eventType === "DELETE") {
              const gone = (payload.old as { id?: string })?.id
              if (gone) setNotifications(prev => prev.filter(n => n.id !== gone))
              return
            }
            const row = payload.new as AppNotification
            if ((view === "inbox" && row.archived_at) || (view === "archived" && !row.archived_at)) {
              setNotifications(prev => prev.filter(n => n.id !== row.id))
              return
            }
            merge(row)
          }
        )
        .subscribe(status => {
          const connected = status === "SUBSCRIBED"
          setLive(connected)
          // Anything missed while the socket was down is caught by a refetch on
          // (re)connect. Without this, a laptop lid closing loses events outright.
          if (connected) fetchRef.current({ silent: true })
        })
    })()

    return () => {
      cancelled = true
      if (channel) createClient().removeChannel(channel)
    }
  }, [view])

  // Safety net, not the delivery mechanism: covers a socket that reports SUBSCRIBED
  // but has gone quiet, and any row written while the tab was in the background.
  useEffect(() => {
    const refreshSilently = () => {
      if (document.visibilityState === "visible") fetchRef.current({ silent: true })
    }

    const interval = window.setInterval(refreshSilently, SAFETY_REFETCH_MS)
    window.addEventListener("focus", refreshSilently)
    document.addEventListener("visibilitychange", refreshSilently)
    window.addEventListener("adlauncher:notifications:refresh", refreshSilently)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", refreshSilently)
      document.removeEventListener("visibilitychange", refreshSilently)
      window.removeEventListener("adlauncher:notifications:refresh", refreshSilently)
    }
  }, [])

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    }).catch(() => {})
  }, [])

  const updateLifecycle = useCallback(async (id: string, action: "archive" | "restore") => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    }).catch(() => null)
    if (!res?.ok) fetchNotifications({ silent: true })
  }, [fetchNotifications])

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    const res = await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => null)
    if (!res?.ok) fetchNotifications({ silent: true })
  }, [fetchNotifications])

  const unreadCount = notifications.filter(n => !n.is_read).length

  return {
    notifications,
    unreadCount,
    loading,
    live,
    error,
    markRead,
    markAllRead,
    archive: (id: string) => updateLifecycle(id, "archive"),
    restore: (id: string) => updateLifecycle(id, "restore"),
    deleteNotification,
    refresh: fetchNotifications,
  }
}
