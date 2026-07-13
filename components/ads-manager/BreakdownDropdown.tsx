"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { IconSearch, IconChevronDown, IconChevronRight, IconX } from "@tabler/icons-react"
import {
  BREAKDOWN_GROUPS, POPULAR_BREAKDOWNS, ALL_BREAKDOWN_OPTIONS,
  BreakdownOption,
} from "@/lib/breakdown-config"

// Time breakdown IDs are mutually exclusive (only one time_increment at a time)
const TIME_IDS = new Set(
  (BREAKDOWN_GROUPS.find(g => g.id === "time")?.options ?? [])
    .filter(o => o.id !== "none")
    .map(o => o.id)
)

// ─── Checkbox dot ─────────────────────────────────────────────────────────────

function CheckBox({ active }: { active: boolean }) {
  return (
    <span className={cn(
      "shrink-0 size-[14px] rounded border-2 flex items-center justify-center transition-colors",
      active
        ? "border-[#1877f2] bg-[#1877f2]"
        : "border-[#ccd0d5] dark:border-gray-500 bg-white dark:bg-card"
    )}>
      {active && (
        <svg viewBox="0 0 10 8" className="size-[8px]" fill="none" stroke="white"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 4L3.5 6.5L9 1.5" />
        </svg>
      )}
    </span>
  )
}

// ─── Submenu panel ────────────────────────────────────────────────────────────

function BreakdownSubmenu({
  options, selected, onToggle,
}: {
  options: BreakdownOption[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div
      className="bg-white dark:bg-card border rounded-xl shadow-xl overflow-y-auto"
      style={{ width: 248, maxHeight: 420 }}
    >
      <div className="py-1.5">
        {options.filter(o => o.id !== "none").map(opt => (
          <button
            key={opt.id}
            onClick={() => onToggle(opt.id)}
            className={cn(
              "w-full flex flex-col items-start px-3 py-[7px] text-left transition-colors hover:bg-[#f5f6f7] dark:hover:bg-muted/40",
              selected.includes(opt.id) && "bg-[#e7f3ff] dark:bg-blue-950/30"
            )}
          >
            <span className="flex items-center gap-2.5 text-xs text-[#1c2b33] dark:text-foreground">
              <CheckBox active={selected.includes(opt.id)} />
              {opt.label}
            </span>
            {opt.description && (
              <span className="text-xs text-muted-foreground mt-0.5 pl-[22px]">
                {opt.description}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  selected: string[]
  onChange: (ids: string[]) => void
}

export function BreakdownDropdown({ selected, onChange }: Props) {
  const [open,        setOpen]        = useState(false)
  const [search,      setSearch]      = useState("")
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const wrapRef       = useRef<HTMLDivElement>(null)
  const searchRef     = useRef<HTMLInputElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleCloseGroup = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => setActiveGroup(null), 200)
  }
  const cancelCloseGroup = () => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null }
  }
  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current) }, [])

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false); setActiveGroup(null); setSearch("")
      }
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
    else { setSearch(""); setActiveGroup(null) }
  }, [open])

  const toggleOption = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id))
    } else {
      // Time breakdowns are mutually exclusive
      if (TIME_IDS.has(id)) {
        onChange([...selected.filter(s => !TIME_IDS.has(s)), id])
      } else {
        onChange([...selected, id])
      }
    }
    // Keep dropdown open for multi-select
  }

  const clearAll = () => { onChange([]); setOpen(false) }

  const isActive       = selected.length > 0
  const activeGroupData = BREAKDOWN_GROUPS.find(g => g.id === activeGroup)
  const searchResults   = search.trim()
    ? ALL_BREAKDOWN_OPTIONS.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : null

  return (
    <div ref={wrapRef} className="relative">
      {/* ── Trigger button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex items-center gap-1.5 h-7 px-2.5 text-xs border rounded-lg transition-colors",
          isActive
            ? "bg-[#e7f3ff] border-[#1877f2]/50 text-[#1877f2]"
            : open
              ? "bg-muted/60"
              : "hover:bg-muted/50 text-[#1c2b33] dark:text-foreground"
        )}
      >
        <svg className="size-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="2.5"  width="12" height="2" rx="1"/>
          <rect x="2" y="7"    width="8"  height="2" rx="1"/>
          <rect x="2" y="11.5" width="5"  height="2" rx="1"/>
        </svg>
        <span className="whitespace-nowrap">
          {isActive ? `Breakdown: ${selected.length} Selected` : "Breakdown"}
        </span>
        {isActive ? (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); clearAll() }}
            className="size-3.5 flex items-center justify-center rounded-full hover:bg-[#1877f2]/20 transition-colors"
          >
            <IconX className="size-2.5" />
          </span>
        ) : (
          <IconChevronDown className="size-3 shrink-0 opacity-60" />
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-[60] flex items-start gap-1">
          {/* Submenu — to the LEFT */}
          {activeGroup && !search && activeGroupData && (
            <div onMouseEnter={cancelCloseGroup} onMouseLeave={scheduleCloseGroup}>
              <BreakdownSubmenu
                options={activeGroupData.options}
                selected={selected}
                onToggle={toggleOption}
              />
            </div>
          )}

          {/* Main dropdown */}
          <div
            className="bg-white dark:bg-card border rounded-xl shadow-xl flex flex-col overflow-hidden"
            style={{ width: 248, maxHeight: 500 }}
          >
            {/* Search */}
            <div className="px-2.5 pt-2.5 pb-2 shrink-0">
              <div className="relative">
                <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50 pointer-events-none" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => { setSearch(e.target.value); setActiveGroup(null) }}
                  placeholder="Search"
                  className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg outline-none focus:ring-1 focus:ring-ring bg-muted/20 dark:bg-muted/30"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-1.5">
              {searchResults ? (
                searchResults.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No results</p>
                ) : (
                  searchResults.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => toggleOption(opt.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-[7px] text-xs text-left transition-colors hover:bg-[#f5f6f7] dark:hover:bg-muted/40",
                        selected.includes(opt.id) && "bg-[#e7f3ff] dark:bg-blue-950/30"
                      )}
                    >
                      <CheckBox active={selected.includes(opt.id)} />
                      <span className="text-[#1c2b33] dark:text-foreground">{opt.label}</span>
                    </button>
                  ))
                )
              ) : (
                <>
                  {/* View breakdown charts — disabled */}
                  <button
                    disabled
                    className="w-full flex items-center gap-2 px-3 py-[7px] text-xs text-muted-foreground/50 cursor-not-allowed"
                  >
                    <svg className="size-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="1" y="10" width="3" height="5" rx="0.5" opacity=".35"/>
                      <rect x="6" y="6.5" width="3" height="8.5" rx="0.5" opacity=".35"/>
                      <rect x="11" y="3" width="3" height="12" rx="0.5" opacity=".35"/>
                    </svg>
                    View breakdown charts
                  </button>

                  <div className="mx-2.5 my-1 border-t" />

                  {/* Popular */}
                  <p className="px-3 pt-1 pb-0.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Popular
                  </p>
                  {POPULAR_BREAKDOWNS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => toggleOption(opt.id)}
                      onMouseEnter={scheduleCloseGroup}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-[7px] text-xs text-left transition-colors hover:bg-[#f5f6f7] dark:hover:bg-muted/40",
                        selected.includes(opt.id) && "bg-[#e7f3ff] dark:bg-blue-950/30"
                      )}
                    >
                      <CheckBox active={selected.includes(opt.id)} />
                      <span className="text-[#1c2b33] dark:text-foreground">{opt.label}</span>
                    </button>
                  ))}

                  <div className="mx-2.5 my-1 border-t" />

                  {/* Groups */}
                  {BREAKDOWN_GROUPS.map(group => {
                    const selCount = group.options.filter(o => o.id !== "none" && selected.includes(o.id)).length
                    return (
                      <button
                        key={group.id}
                        onMouseEnter={() => { cancelCloseGroup(); setActiveGroup(group.id) }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-[7px] text-xs text-left transition-colors",
                          activeGroup === group.id
                            ? "bg-[#f0f2f5] dark:bg-muted/60"
                            : "hover:bg-[#f5f6f7] dark:hover:bg-muted/40",
                        )}
                      >
                        <span
                          className="text-[#1c2b33] dark:text-foreground"
                          style={selCount > 0 ? { color: "#1877f2" } : undefined}
                        >
                          {group.label}
                        </span>
                        <span className="flex items-center gap-1">
                          {selCount > 0 && (
                            <span className="text-xs text-[#1877f2] font-bold">{selCount}</span>
                          )}
                          <IconChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                        </span>
                      </button>
                    )
                  })}

                  <div className="mx-2.5 my-1 border-t" />

                  {/* Value rules — disabled */}
                  <div className="px-3 py-1.5 select-none">
                    <label className="flex items-center gap-2 opacity-40 cursor-not-allowed">
                      <input type="checkbox" disabled className="size-3.5 rounded border accent-[#1877f2]" />
                      <span className="text-xs text-[#1c2b33] dark:text-foreground">Value rules</span>
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5 pl-[22px]">
                      Ads and ad sets only
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
