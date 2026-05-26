"use client"

import { useState, useEffect, useCallback } from "react"

export type AppNotification = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  actor_name: string | null
  is_read: boolean
  created_at: string
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)

  const fetchNotifications = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true)
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications || [])
    } catch (err) {
      console.error("[notifications] fetch error:", err)
    } finally {
      if (!options?.silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    const refreshSilently = () => {
      if (document.visibilityState === "visible") {
        fetchNotifications({ silent: true })
      }
    }

    const interval = window.setInterval(refreshSilently, 2000)
    window.addEventListener("focus", refreshSilently)
    document.addEventListener("visibilitychange", refreshSilently)
    window.addEventListener("adlauncher:notifications:refresh", refreshSilently)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", refreshSilently)
      document.removeEventListener("visibilitychange", refreshSilently)
      window.removeEventListener("adlauncher:notifications:refresh", refreshSilently)
    }
  }, [fetchNotifications])

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

  const unreadCount = notifications.filter(n => !n.is_read).length

  return { notifications, unreadCount, loading, markRead, markAllRead, refresh: fetchNotifications }
}
