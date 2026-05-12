"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

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

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    console.log("[notifications] session uid:", session?.user?.id ?? "NO SESSION")
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, actor_name, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(30)
    console.log("[notifications] result:", { count: data?.length, error, rows: data })
    if (error) console.error("[notifications] fetch error:", error)
    setNotifications(data || [])
    setLoading(false)
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Poll every 30s
  useEffect(() => {
    const interval = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    const supabase = createClient()
    await supabase.from("notifications").update({ is_read: true }).eq("id", id)
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    const supabase = createClient()
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false)
  }, [])

  const unreadCount = notifications.filter(n => !n.is_read).length

  return { notifications, unreadCount, loading, markRead, markAllRead, refresh: fetchNotifications }
}
