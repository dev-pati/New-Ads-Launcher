"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useOrg } from "@/lib/org-context"

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
  const { activeOrg } = useOrg()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)

  const fetchNotifications = useCallback(async () => {
    if (!activeOrg?.id) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, actor_name, is_read, created_at")
      .eq("org_id", activeOrg.id)
      .order("created_at", { ascending: false })
      .limit(30)
    setNotifications(data || [])
    setLoading(false)
  }, [activeOrg?.id])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Realtime: new notifications appear instantly
  useEffect(() => {
    if (!activeOrg?.id) return
    const supabase = createClient()
    const channel = supabase
      .channel(`notif_${activeOrg.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `org_id=eq.${activeOrg.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as AppNotification, ...prev].slice(0, 30))
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "notifications",
        filter: `org_id=eq.${activeOrg.id}`,
      }, (payload) => {
        setNotifications(prev =>
          prev.map(n => n.id === payload.new.id ? { ...n, ...(payload.new as AppNotification) } : n)
        )
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeOrg?.id])

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    const supabase = createClient()
    await supabase.from("notifications").update({ is_read: true }).eq("id", id)
  }, [])

  const markAllRead = useCallback(async () => {
    if (!activeOrg?.id) return
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    const supabase = createClient()
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("org_id", activeOrg.id)
      .eq("is_read", false)
  }, [activeOrg?.id])

  const unreadCount = notifications.filter(n => !n.is_read).length

  return { notifications, unreadCount, loading, markRead, markAllRead, refresh: fetchNotifications }
}
