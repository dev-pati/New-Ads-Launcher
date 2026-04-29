"use client"

import { useEffect, useState, useCallback, useRef } from "react"

export interface UserSettings {
  theme: string // 'light' | 'dark' | 'system'
  ads_filter: {
    status?: string // 'all' | 'draft' | 'ready' | 'launched'
    search?: string
  }
  ads_column_widths: Record<string, number> // field name -> width in px
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: "system",
  ads_filter: {},
  ads_column_widths: {},
}

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestPatch = useRef<Partial<UserSettings>>({})

  useEffect(() => {
    let cancelled = false

    async function fetchSettings() {
      try {
        const res = await fetch("/api/user-settings")
        if (!res.ok) throw new Error("Failed to fetch user settings")
        const data = await res.json()
        const s = data.settings || data
        if (!cancelled) {
          setSettings({ ...DEFAULT_SETTINGS, ...s })
        }
      } catch {
        if (!cancelled) {
          setSettings(DEFAULT_SETTINGS)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchSettings()
    return () => {
      cancelled = true
    }
  }, [])

  const flushPatch = useCallback(() => {
    const patch = latestPatch.current
    latestPatch.current = {}

    fetch("/api/user-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {
      // Silently ignore – optimistic UI already applied
    })
  }, [])

  const updateSettings = useCallback(
    (partial: Partial<UserSettings>) => {
      // Optimistic local update
      setSettings((prev) => {
        if (!prev) return { ...DEFAULT_SETTINGS, ...partial }
        return { ...prev, ...partial }
      })

      // Accumulate patches so the debounced PATCH includes all recent changes
      latestPatch.current = { ...latestPatch.current, ...partial }

      // Debounce the PATCH call (500ms)
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
      debounceTimer.current = setTimeout(flushPatch, 500)
    },
    [flushPatch]
  )

  // Clean up timer on unmount and flush any pending patch
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
        // Flush pending changes on unmount so nothing is lost
        if (Object.keys(latestPatch.current).length > 0) {
          flushPatch()
        }
      }
    }
  }, [flushPatch])

  return { settings, loading, updateSettings }
}
