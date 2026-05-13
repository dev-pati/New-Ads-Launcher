"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { IconSearch, IconChevronDown, IconChevronRight } from "@tabler/icons-react"
import {
  BREAKDOWN_GROUPS, POPULAR_BREAKDOWNS, ALL_BREAKDOWN_OPTIONS,
  BreakdownOption,
} from "@/lib/breakdown-config"

// ─── Radio dot ────────────────────────────────────────────────────────────────

function RadioDot({ active }: { active: boolean }) {
  return (
    <span className={cn(
      "shrink-0 size-[14px] rounded-full border-2 flex items-center justify-center transition-colors",
      active ? "border-[#1877f2]" : "border-[#ccd0d5] dark:border-gray-500"
    )}>
      {active && <span className="size-[6px] rounded-full bg-[#1877f2]" />}
    </span>
  )
}

// ─── Submenu panel ────────────────────────────────────────────────────────────

function BreakdownSubmenu({
  options, selected, onSelect,
}: {
  options: BreakdownOption[]
  selected: string
  onSelect: (id: string) => void
}) {
  return (
    <div
      className="bg-white dark:bg-card border rounded-xl shadow-xl overflow-y-auto"
      style={{ width: 248, maxHeight: 420 }}
    >
      <div className="py-1.5">
        {options.map(opt => (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            className={cn(
              "w-full flex flex-col items-start px-3 py-[7px] text-left transition-colors hover:bg-[#f5f6f7] dark:hover:bg-muted/40",
              selected === opt.id && "bg-[#e7f3ff] dark:bg-blue-950/30"
            )}
          >
            <span className="flex items-center gap-2.5 text-[13px] text-[#1c2b33] dark:text-foreground">
              <RadioDot active={selected === opt.id} />
              {opt.label}
            </span>
            {opt.description && (
              <span className="text-[11px] text-muted-foreground mt-0.5 pl-[22px]">
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
  selected: string
  onChange: (id: string) => void
}

export function BreakdownDropdown({ selected, onChange }: Props) {
  const [open,        setOpen]        = useState(false)
  const [search,      setSearch]      = useState("")
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const wrapRef        = useRef<HTMLDivElement>(null)
  const searchRef      = useRef<HTMLInputElement>(null)
  const closeTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        setOpen(false)
        setActiveGroup(null)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  // Auto-focus search when opened
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
    else { setSearch(""); setActiveGroup(null) }
  }, [open])

  const selectOption = (id: string) => {
    onChange(id)
    setOpen(false)
    setActiveGroup(null)
    setSearch("")
  }

  // Derived
  const activeGroupData = BREAKDOWN_GROUPS.find(g => g.id === activeGroup)
  const searchResults   = search.trim()
    ? ALL_BREAKDOWN_OPTIONS.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : null

  const selectedLabel = (() => {
    if (selected === "none") return null
    return ALL_BREAKDOWN_OPTIONS.find(o => o.id === selected)?.label ?? null
  })()

  const isActive = selected !== "none"

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
        {/* Stacked bars icon */}
        <svg className="size-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="2.5"  width="12" height="2" rx="1"/>
          <rect x="2" y="7"    width="8"  height="2" rx="1"/>
          <rect x="2" y="11.5" width="5"  height="2" rx="1"/>
        </svg>
        <span className="whitespace-nowrap">
          {isActive ? "Breakdown: 1 Selected" : "Breakdown"}
        </span>
        <IconChevronDown className="size-3 shrink-0 opacity-60" />
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-[60] flex items-start gap-1"
        >
          {/* Submenu — to the LEFT of main dropdown */}
          {activeGroup && !search && activeGroupData && (
            <div onMouseEnter={cancelCloseGroup} onMouseLeave={scheduleCloseGroup}>
              <BreakdownSubmenu
                options={activeGroupData.options}
                selected={selected}
                onSelect={selectOption}
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
                  className="w-full pl-8 pr-3 py-1.5 text-[13px] border rounded-lg outline-none focus:ring-1 focus:ring-ring bg-muted/20 dark:bg-muted/30"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-1.5">
              {searchResults ? (
                /* Search results */
                searchResults.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground text-center py-8">No results</p>
                ) : (
                  searchResults.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => selectOption(opt.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-[7px] text-[13px] text-left transition-colors hover:bg-[#f5f6f7] dark:hover:bg-muted/40",
                        selected === opt.id && "bg-[#e7f3ff] dark:bg-blue-950/30"
                      )}
                    >
                      <RadioDot active={selected === opt.id} />
                      <span className="text-[#1c2b33] dark:text-foreground">{opt.label}</span>
                    </button>
                  ))
                )
              ) : (
                <>
                  {/* "View breakdown charts" — disabled */}
                  <button
                    disabled
                    className="w-full flex items-center gap-2 px-3 py-[7px] text-[13px] text-muted-foreground/50 cursor-not-allowed"
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
                  <p className="px-3 pt-1 pb-0.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Popular
                  </p>
                  {POPULAR_BREAKDOWNS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => selectOption(opt.id)}
                      onMouseEnter={scheduleCloseGroup}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-[7px] text-[13px] text-left transition-colors hover:bg-[#f5f6f7] dark:hover:bg-muted/40",
                        selected === opt.id && "bg-[#e7f3ff] dark:bg-blue-950/30"
                      )}
                    >
                      <RadioDot active={selected === opt.id} />
                      <span className="text-[#1c2b33] dark:text-foreground">{opt.label}</span>
                    </button>
                  ))}

                  <div className="mx-2.5 my-1 border-t" />

                  {/* Groups */}
                  {BREAKDOWN_GROUPS.map(group => {
                    const hasSelected = group.options.some(o => o.id === selected)
                    return (
                      <button
                        key={group.id}
                        onMouseEnter={() => { cancelCloseGroup(); setActiveGroup(group.id) }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-[7px] text-[13px] text-left transition-colors",
                          activeGroup === group.id
                            ? "bg-[#f0f2f5] dark:bg-muted/60"
                            : "hover:bg-[#f5f6f7] dark:hover:bg-muted/40",
                          hasSelected && "text-[#1877f2]"
                        )}
                      >
                        <span className="text-[#1c2b33] dark:text-foreground"
                          style={hasSelected ? { color: "#1877f2" } : undefined}
                        >
                          {group.label}
                        </span>
                        <IconChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                      </button>
                    )
                  })}

                  <div className="mx-2.5 my-1 border-t" />

                  {/* Value rules — disabled */}
                  <div className="px-3 py-1.5 select-none">
                    <label className="flex items-center gap-2 opacity-40 cursor-not-allowed">
                      <input type="checkbox" disabled className="size-3.5 rounded border accent-[#1877f2]" />
                      <span className="text-[13px] text-[#1c2b33] dark:text-foreground">Value rules</span>
                    </label>
                    <p className="text-[11px] text-muted-foreground mt-0.5 pl-[22px]">
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
