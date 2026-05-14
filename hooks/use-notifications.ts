"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient, getUserIdFromClientToken } from "@/lib/supabase/client"

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
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, actor_name, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(30)
    if (error) console.error("[notifications] fetch error:", error)
    setNotifications(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Realtime — mount guard prevents React StrictMode double-invoke from subscribing
  // to an already-subscribed channel (which would throw "cannot add callbacks after subscribe")
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let mounted = true

    const userId = getUserIdFromClientToken()
    if (!mounted || !userId) return

    const dbSchema = process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "ads_launcher"

    channel = supabase
      .channel(`notifs-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: dbSchema, table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as AppNotification
          setNotifications(prev => {
            if (prev.some(x => x.id === n.id)) return prev
            return [n, ...prev].slice(0, 30)
          })
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: dbSchema, table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as AppNotification
          setNotifications(prev =>
            prev.map(x => x.id === updated.id ? { ...x, ...updated } : x)
          )
        }
      )
      .subscribe()

    return () => {
      mounted = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

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
