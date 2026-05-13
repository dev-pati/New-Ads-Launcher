"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export interface SchemaOption {
  id: string
  value: string
}

export interface SchemaCategory {
  id: string
  name: string
  description: string
  isAI: boolean
  autoDetect: boolean
  options: SchemaOption[]
}

export function useNamingSchema() {
  const [categories, setCategories] = useState<SchemaCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/naming-schema")
      if (!res.ok) throw new Error("Failed to load schema")
      const d = await res.json()
      setCategories(d.categories || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const saveToServer = useCallback(async (cats: SchemaCategory[]) => {
    setSaving(true)
    try {
      const res = await fetch("/api/naming-schema", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: cats }),
      })
      if (!res.ok) throw new Error("Failed to save")
      setLastSaved(new Date())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }, [])

  const updateCategories = useCallback(
    (updater: (prev: SchemaCategory[]) => SchemaCategory[]) => {
      setCategories(prev => {
        const next = updater(prev)
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => saveToServer(next), 800)
        return next
      })
    },
    [saveToServer]
  )

  const addCategory = useCallback(
    (cat: Omit<SchemaCategory, "id">) => {
      updateCategories(prev => [...prev, { ...cat, id: crypto.randomUUID() }])
    },
    [updateCategories]
  )

  const updateCategory = useCallback(
    (id: string, patch: Partial<SchemaCategory>) => {
      updateCategories(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)))
    },
    [updateCategories]
  )

  const removeCategory = useCallback(
    (id: string) => {
      updateCategories(prev => prev.filter(c => c.id !== id))
    },
    [updateCategories]
  )

  const reorderCategories = useCallback(
    (fromIdx: number, toIdx: number) => {
      updateCategories(prev => {
        const next = [...prev]
        const [moved] = next.splice(fromIdx, 1)
        next.splice(toIdx, 0, moved)
        return next
      })
    },
    [updateCategories]
  )

  const addOption = useCallback(
    (categoryId: string, value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return
      updateCategories(prev =>
        prev.map(c =>
          c.id === categoryId
            ? { ...c, options: [...c.options, { id: crypto.randomUUID(), value: trimmed }] }
            : c
        )
      )
    },
    [updateCategories]
  )

  const removeOption = useCallback(
    (categoryId: string, optionId: string) => {
      updateCategories(prev =>
        prev.map(c =>
          c.id === categoryId ? { ...c, options: c.options.filter(o => o.id !== optionId) } : c
        )
      )
    },
    [updateCategories]
  )

  const updateOption = useCallback(
    (categoryId: string, optionId: string, value: string) => {
      updateCategories(prev =>
        prev.map(c =>
          c.id === categoryId
            ? { ...c, options: c.options.map(o => (o.id === optionId ? { ...o, value } : o)) }
            : c
        )
      )
    },
    [updateCategories]
  )

  const formatPreview =
    categories.length > 0 ? categories.map(c => c.name).join("_") + ".ext" : "—"

  return {
    categories,
    loading,
    saving,
    error,
    lastSaved,
    formatPreview,
    addCategory,
    updateCategory,
    removeCategory,
    reorderCategories,
    addOption,
    removeOption,
    updateOption,
    reload: load,
  }
}
