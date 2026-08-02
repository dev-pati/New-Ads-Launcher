"use client"

import { useEffect, useState } from "react"

import type { MetaAssignmentProgress } from "@/lib/meta-assignment-progress"

const POLL_INTERVAL_MS = 2500
const ITEMS_PER_TICK = 6

export function useMetaAssignmentProgress(creativeIds: string[], enabled = true) {
  const key = [...new Set(creativeIds)].join(",")
  const [progressById, setProgressById] = useState<Record<string, MetaAssignmentProgress>>({})

  useEffect(() => {
    if (!enabled || !key) return

    const ids = key.split(",")
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let cursor = 0
    const terminalIds = new Set<string>()

    const poll = async () => {
      try {
        const activeIds = ids.filter(id => !terminalIds.has(id))
        if (activeIds.length === 0) return
        const batchSize = Math.min(ITEMS_PER_TICK, activeIds.length)
        const batch = Array.from(
          { length: batchSize },
          (_, offset) => activeIds[(cursor + offset) % activeIds.length],
        )
        cursor = (cursor + batchSize) % activeIds.length
        const response = await fetch("/api/creatives/meta-progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creative_ids: batch }),
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "Failed to load Meta progress")
        const nextItems = Array.isArray(payload.items)
          ? payload.items as MetaAssignmentProgress[]
          : []
        if (cancelled) return
        for (const item of nextItems) {
          if (item.phase === "ready" || item.phase === "error") terminalIds.add(item.creativeId)
        }
        setProgressById(previous => {
          const next = { ...previous }
          for (const item of nextItems) next[item.creativeId] = item
          return next
        })

        if (terminalIds.size < ids.length) {
          timer = setTimeout(poll, POLL_INTERVAL_MS)
        }
      } catch {
        if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS)
      }
    }

    void poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [enabled, key])

  return progressById
}
