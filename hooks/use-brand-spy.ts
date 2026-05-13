"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { MOCK_ADS } from "@/lib/inspo-mock-data"
import {
  getBrandAnalytics,
  getAllBrandSummaries,
  type BrandAnalytics,
  type BrandSummary,
} from "@/lib/brand-spy-analytics"

// ─── Filters shared across tabs ───────────────────────────────────────────────

export type TimeRange  = "7d" | "30d" | "90d" | "all"
export type AdStatus   = "all" | "active" | "inactive"
export type AdTypeFilter = "all" | "image" | "video" | "carousel"

export interface BrandFilters {
  timeRange:  TimeRange
  status:     AdStatus
  type:       AdTypeFilter
  language:   string   // "all" or specific language
}

export const DEFAULT_FILTERS: BrandFilters = {
  timeRange: "all",
  status:    "all",
  type:      "all",
  language:  "all",
}

// ─── useBrandAnalytics ────────────────────────────────────────────────────────

export function useBrandAnalytics(brandName: string | null) {
  const [analytics, setAnalytics] = useState<BrandAnalytics | null>(null)
  const [loading,   setLoading]   = useState(false)
  const loadingRef = useRef(false)

  useEffect(() => {
    if (!brandName || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)

    // Simulate async load (cache hit is synchronous, but we want a loading flash)
    const timer = setTimeout(() => {
      const data = getBrandAnalytics(brandName, MOCK_ADS)
      setAnalytics(data)
      setLoading(false)
      loadingRef.current = false
    }, 300)

    return () => { clearTimeout(timer); loadingRef.current = false }
  }, [brandName])

  return { analytics, loading }
}

// ─── useBrandList ─────────────────────────────────────────────────────────────

export function useBrandList() {
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")

  // Debounce search input (300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const allSummaries = useMemo(() => getAllBrandSummaries(MOCK_ADS), [])

  const filtered = useMemo(() => {
    if (!debounced.trim()) return allSummaries
    const q = debounced.toLowerCase()
    return allSummaries.filter(b =>
      b.brandName.toLowerCase().includes(q) ||
      b.categories.some(c => c.toLowerCase().includes(q))
    )
  }, [allSummaries, debounced])

  return { brands: filtered, search, setSearch, total: allSummaries.length }
}

// ─── useBrandFilters ──────────────────────────────────────────────────────────

export function useBrandFilters() {
  const [filters, setFilters] = useState<BrandFilters>(DEFAULT_FILTERS)

  const update = useCallback((patch: Partial<BrandFilters>) => {
    setFilters(prev => ({ ...prev, ...patch }))
  }, [])

  const reset = useCallback(() => setFilters(DEFAULT_FILTERS), [])

  const hasActive = useMemo(() =>
    filters.timeRange !== "all" ||
    filters.status    !== "all" ||
    filters.type      !== "all" ||
    filters.language  !== "all",
  [filters])

  return { filters, update, reset, hasActive }
}
