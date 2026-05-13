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
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, actor_name, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(30)
    if (error) console.error("[notifications] fetch error:", error)
    setNotifications(data || [])
    setLoading(false)
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Supabase Realtime subscription — INSERT prepends, UPDATE patches in place
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id
      if (!userId) return

      channel = supabase
        .channel("notifications:user")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
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
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const updated = payload.new as AppNotification
            setNotifications(prev =>
              prev.map(x => x.id === updated.id ? { ...x, ...updated } : x)
            )
          }
        )
        .subscribe()
    })

    return () => {
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
