"use client"

import { useState, useRef, useEffect } from "react"
import { IconArrowsSort, IconChevronDown, IconCheck, IconX } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { SortOption } from "@/types/inspo"
import { hasActiveFilters, type FilterState } from "@/types/inspo"
import { DEFAULT_FILTERS } from "@/types/inspo"

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recommended",     label: "Recommended" },
  { value: "most_views",      label: "Most Views" },
  { value: "newest",          label: "Newest" },
  { value: "longest_running", label: "Longest Running" },
]

interface Props {
  sort: SortOption
  onSortChange: (s: SortOption) => void
  filters: FilterState
  onClearFilters: () => void
}

export function InspoSortControl({ sort, onSortChange, filters, onClearFilters }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const currentLabel = SORT_OPTIONS.find(o => o.value === sort)?.label || "Recommended"
  const filtersActive = hasActiveFilters(filters)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div className="flex items-center gap-2">
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(p => !p)}
          className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border bg-background hover:bg-muted border-border transition-colors"
        >
          <IconArrowsSort className="size-3.5 text-muted-foreground" />
          <span>Sort: {currentLabel}</span>
          <IconChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-xl shadow-lg min-w-[180px] py-1">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onSortChange(opt.value); setOpen(false) }}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted text-left",
                  sort === opt.value && "text-primary font-medium"
                )}
              >
                {sort === opt.value ? <IconCheck className="size-3.5" /> : <span className="size-3.5" />}
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtersActive && (
        <button
          onClick={onClearFilters}
          className="flex items-center gap-1 h-8 px-3 text-sm rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground transition-colors"
        >
          <IconX className="size-3.5" />
          Clear
        </button>
      )}
    </div>
  )
}
