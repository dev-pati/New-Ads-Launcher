"use client"

import { useEffect, useRef } from "react"
import { useOrg } from "@/lib/org-context"
import { createClient, getClientToken } from "@/lib/supabase/client"

type LaunchBatchEvent = "INSERT" | "UPDATE" | "DELETE"

export function useLaunchBatchesRealtime(
  onChange: (event: LaunchBatchEvent) => void
) {
  const { activeOrgId } = useOrg()
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!activeOrgId) return

    const supabase = createClient()
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const subscribe = async () => {
      const token = getClientToken()
      if (token) await supabase.realtime.setAuth(token)
      if (cancelled) return

      channel = supabase
        .channel(`launch-batches:${activeOrgId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "ads_launcher",
            table: "launch_batches",
            filter: `org_id=eq.${activeOrgId}`,
          },
          payload => onChangeRef.current(payload.eventType as LaunchBatchEvent)
        )
        .subscribe()
    }

    void subscribe()
    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [activeOrgId])
}
