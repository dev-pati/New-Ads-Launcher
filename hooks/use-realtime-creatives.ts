"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

interface UseRealtimeCreativesOptions {
  orgId: string
  onInsert: (record: any) => void
  onUpdate: (record: any) => void
  onDelete: (oldRecord: any) => void
}

export function useRealtimeCreatives({
  orgId,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeCreativesOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!orgId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`org:${orgId}:creatives`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "creatives",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => onInsert(payload.new)
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "creatives",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => onUpdate(payload.new)
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "creatives",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => onDelete(payload.old)
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orgId])

  return channelRef
}
