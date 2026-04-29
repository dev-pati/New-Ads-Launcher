"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

const USER_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6",
]

function getColorForUser(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}

export interface PresenceUser {
  userId: string
  userName: string
  color: string
  editingCell: { rowId: string; colField: string } | null
}

interface UsePresenceOptions {
  orgId: string
  userId: string
  userName: string
}

export function useCreativesPresence({ orgId, userId, userName }: UsePresenceOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [others, setOthers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!orgId || !userId) return

    const supabase = createClient()
    const channel = supabase.channel(`presence:org:${orgId}:creatives`, {
      config: { presence: { key: userId } },
    })

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState()
        const users: PresenceUser[] = []
        for (const [key, presences] of Object.entries(state)) {
          if (key === userId) continue
          const p = (presences as any[])[0]
          if (p) {
            users.push({
              userId: p.userId,
              userName: p.userName,
              color: p.color,
              editingCell: p.editingCell,
            })
          }
        }
        setOthers(users)
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId,
            userName,
            color: getColorForUser(userId),
            editingCell: null,
          })
        }
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orgId, userId, userName])

  const updateMyCell = useCallback(
    (rowId: string, colField: string) => {
      channelRef.current?.track({
        userId,
        userName,
        color: getColorForUser(userId),
        editingCell: { rowId, colField },
      })
    },
    [userId, userName]
  )

  const clearMyCell = useCallback(() => {
    channelRef.current?.track({
      userId,
      userName,
      color: getColorForUser(userId),
      editingCell: null,
    })
  }, [userId, userName])

  return { others, updateMyCell, clearMyCell }
}
