"use client"

import { useState, useRef, useEffect } from "react"
import { IconAdjustmentsHorizontal, IconChevronDown, IconCheck, IconX } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { SortOption } from "@/types/inspo"
import { hasActiveFilters, type FilterState } from "@/types/inspo"

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recommended",     label: "Recommended" },
  { value: "most_views",      label: "Most Views" },
  { value: "newest",          label: "Newest First" },
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
    <div className="flex items-center gap-1.5 shrink-0">
      {filtersActive && (
        <button
          onClick={onClearFilters}
          className="flex items-center gap-1 h-9 px-3 text-sm rounded-xl border border-border/60 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <IconX className="size-3.5" />
          Clear filters
        </button>
      )}
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(p => !p)}
          className="flex items-center gap-1.5 h-9 px-3 text-sm rounded-xl border border-border/60 bg-muted/50 hover:bg-muted transition-colors"
        >
          <IconAdjustmentsHorizontal className="size-4 text-muted-foreground" />
          <span className="text-foreground/80">{currentLabel}</span>
          <IconChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className="absolute top-full right-0 mt-1.5 z-50 bg-popover border border-border/80 rounded-xl shadow-xl min-w-[180px] py-1.5 overflow-hidden">
            <p className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sort by</p>
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onSortChange(opt.value); setOpen(false) }}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted text-left transition-colors",
                  sort === opt.value ? "text-primary font-medium" : "text-foreground/80"
                )}
              >
                <span className={cn("size-4 flex items-center justify-center shrink-0")}>
                  {sort === opt.value && <IconCheck className="size-3.5" />}
                </span>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
