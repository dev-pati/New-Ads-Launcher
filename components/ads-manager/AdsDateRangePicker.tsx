"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { IconCalendar, IconChevronDown, IconChevronLeft, IconChevronRight } from "@tabler/icons-react"

// ─── Presets (matches Facebook API date_preset values) ────────────────────────

export const DATE_PICKER_PRESETS = [
  { value: "today",       label: "Today"         },
  { value: "yesterday",   label: "Yesterday"     },
  { value: "last_7d",     label: "Last 7 days"   },
  { value: "last_14d",    label: "Last 14 days"  },
  { value: "last_30d",    label: "Last 30 days"  },
  { value: "last_90d",    label: "Last 90 days"  },
  { value: "this_month",  label: "Month to date" },
  { value: "last_month",  label: "Last month"    },
  { value: "this_year",   label: "Year to date"  },
  { value: "last_year",   label: "Last year"     },
  { value: "maximum",     label: "Maximum"       },
]

// Fallback lower bound for "Maximum" before the account's created_time loads.
const MAXIMUM_FALLBACK_START = new Date(2018, 0, 1)

export function getPresetRange(preset: string, maximumStart?: Date): { start: Date; end: Date } {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = (n: number) => { const x = new Date(today); x.setDate(x.getDate() + n); return x }
  switch (preset) {
    case "maximum": return { start: maximumStart ?? MAXIMUM_FALLBACK_START, end: today }
    case "today":      return { start: today,   end: today }
    case "yesterday":  return { start: d(-1),   end: d(-1) }
    case "last_7d":    return { start: d(-6),   end: today }
    case "last_14d":   return { start: d(-13),  end: today }
    case "last_30d":   return { start: d(-29),  end: today }
    case "last_90d":   return { start: d(-89),  end: today }
    case "this_month": return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today }
    case "last_month": {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const e = new Date(today.getFullYear(), today.getMonth(), 0)
      return { start: s, end: e }
    }
    case "this_year":  return { start: new Date(today.getFullYear(), 0, 1), end: today }
    case "last_year": {
      const s = new Date(today.getFullYear() - 1, 0, 1)
      const e = new Date(today.getFullYear() - 1, 11, 31)
      return { start: s, end: e }
    }
    default:           return { start: d(-6),   end: today }
  }
}

function fmt(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function fmtInput(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

// ─── Calendar grid ────────────────────────────────────────────────────────────

const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"]
const DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"]

function todayMidnight() {
  const t = new Date(); t.setHours(0, 0, 0, 0)
  return t
}

function CalGrid({
  year, month, startDate, endDate, hoverDate, onDay, onHover,
}: {
  year: number; month: number
  startDate: Date | null; endDate: Date | null; hoverDate: Date | null
  onDay: (d: Date) => void
  onHover: (d: Date | null) => void
}) {
  const firstDow   = new Date(year, month, 1).getDay()
  const daysInMo   = new Date(year, month + 1, 0).getDate()
  const todayDate  = todayMidnight()
  const effEnd     = endDate ?? hoverDate

  const dayClass = (d: Date) => {
    const sel     = (startDate && sameDay(d, startDate)) || (effEnd && sameDay(d, effEnd))
    const inRange = (() => {
      if (!startDate || !effEnd) return false
      const [lo, hi] = startDate <= effEnd ? [startDate, effEnd] : [effEnd, startDate]
      return d > lo && d < hi
    })()
    const isStart = !!(startDate && sameDay(d, startDate))
    const isEnd   = !!(effEnd && sameDay(d, effEnd))
    const isToday = sameDay(d, todayDate)

    if (sel) {
      return cn(
        "bg-[#1877f2] text-white font-semibold z-10 relative",
        isStart && effEnd && !sameDay(startDate!, effEnd) && "rounded-l-full",
        isEnd   && startDate && !sameDay(startDate, effEnd) && "rounded-r-full",
        (!effEnd || sameDay(startDate!, effEnd)) && "rounded-full"
      )
    }
    if (inRange) return "bg-[#e7f3ff] text-[#1877f2]"
    if (isToday) return "border border-[#1877f2] text-[#1877f2] font-semibold rounded-full"
    return "text-[#1c2b33] dark:text-foreground hover:bg-muted/50 rounded-full"
  }

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMo }, (_, i) => i + 1),
  ]

  return (
    <div className="w-[210px] select-none">
      <p className="text-center text-xs font-semibold mb-3 text-[#1c2b33] dark:text-white">
        {MONTHS[month]} {year}
      </p>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] text-muted-foreground font-medium uppercase py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />
          const date = new Date(year, month, day)
          const isFuture = date > todayDate
          return (
            <div
              key={i}
              onClick={() => { if (!isFuture) onDay(date) }}
              onMouseEnter={() => { if (!isFuture) onHover(date) }}
              onMouseLeave={() => onHover(null)}
              className={cn(
                "h-8 flex items-center justify-center text-xs cursor-pointer transition-colors",
                isFuture && "text-muted-foreground/30 pointer-events-none",
                dayClass(date)
              )}
            >
              {day}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main picker ──────────────────────────────────────────────────────────────

interface Props {
  preset: string
  customStart?: Date
  customEnd?: Date
  accountId?: string
  onChange: (preset: string, customStart?: Date, customEnd?: Date) => void
}

type Mode = "preset" | "custom"

export function AdsDateRangePicker({ preset, customStart, customEnd, accountId, onChange }: Props) {
  const [maxStart, setMaxStart] = useState<Date | null>(null)
  const [open,        setOpen]        = useState(false)
  // pending mode + selection (not applied until Apply)
  const [mode,        setMode]        = useState<Mode>(preset === "custom" ? "custom" : "preset")
  const [pending,     setPending]     = useState(preset === "custom" ? "" : preset)
  const [rangeStart,  setRangeStart]  = useState<Date | null>(null)
  const [rangeEnd,    setRangeEnd]    = useState<Date | null>(null)
  const [hoverDate,   setHoverDate]   = useState<Date | null>(null)
  const [leftYear,    setLeftYear]    = useState(new Date().getFullYear())
  const [leftMonth,   setLeftMonth]   = useState(new Date().getMonth())
  const wrapRef = useRef<HTMLDivElement>(null)

  const rightYear  = leftMonth === 11 ? leftYear + 1 : leftYear
  const rightMonth = leftMonth === 11 ? 0 : leftMonth + 1

  // Sync pending state from props whenever the popover opens.
  useEffect(() => {
    if (!open) return
    if ((preset === "custom" || preset === "maximum") && customStart && customEnd) {
      setMode(preset === "custom" ? "custom" : "preset")
      setPending(preset === "maximum" ? "maximum" : "")
      setRangeStart(customStart)
      setRangeEnd(customEnd)
      setLeftYear(customStart.getFullYear())
      setLeftMonth(customStart.getMonth())
    } else {
      setMode("preset")
      setPending(preset)
      const { start, end } = getPresetRange(preset, maxStart ?? undefined)
      setRangeStart(start)
      setRangeEnd(end)
      setLeftYear(start.getFullYear())
      setLeftMonth(start.getMonth())
    }
  }, [open]) // eslint-disable-line

  // Once account created_time arrives, refresh Maximum range if selected.
  useEffect(() => {
    if (!maxStart) return
    if (pending === "maximum" || preset === "maximum") {
      const { start, end } = getPresetRange("maximum", maxStart)
      setRangeStart(start)
      setRangeEnd(end)
    }
  }, [maxStart]) // eslint-disable-line

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  // Lazy-fetch the account's created_time so "Maximum" spans from creation to today.
  useEffect(() => {
    if (!open || !accountId || maxStart) return
    let cancelled = false
    fetch(`/api/facebook/ad-accounts/created-time?ad_account_id=${encodeURIComponent(accountId)}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled || !d.created_time) return
        const parsed = new Date(d.created_time)
        if (!isNaN(parsed.getTime())) setMaxStart(parsed)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [open, accountId, maxStart])

  const selectPreset = (p: string) => {
    setMode("preset")
    setPending(p)
    const { start, end } = getPresetRange(p, maxStart ?? undefined)
    setRangeStart(start)
    setRangeEnd(end)
    setLeftYear(start.getFullYear())
    setLeftMonth(start.getMonth())
  }

  const switchToCustom = () => {
    setMode("custom")
    setPending("")
  }

  const handleDay = (d: Date) => {
    const todayDate = todayMidnight()
    if (d > todayDate) return
    setMode("custom")
    setPending("")
    // First click sets start; second click sets end.
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(d); setRangeEnd(null)
    } else {
      if (d < rangeStart) { setRangeEnd(rangeStart); setRangeStart(d) }
      else setRangeEnd(d)
    }
  }

  const apply = () => {
    if (mode === "preset" && pending) {
      // Meta's API doesn't reliably support date_preset=maximum; send the resolved
      // account-created-time range while keeping the UI preset label as Maximum.
      if (pending === "maximum" && rangeStart) onChange("maximum", rangeStart, rangeEnd ?? rangeStart)
      else onChange(pending)
    } else if (rangeStart) {
      onChange("custom", rangeStart, rangeEnd ?? rangeStart)
    }
    setOpen(false)
  }

  const reset = () => {
    setMode("preset")
    selectPreset("last_7d")
  }

  const prevMonth = () => {
    if (leftMonth === 0) { setLeftMonth(11); setLeftYear(y => y - 1) }
    else setLeftMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (leftMonth === 11) { setLeftMonth(0); setLeftYear(y => y + 1) }
    else setLeftMonth(m => m + 1)
  }

  const today = new Date()
  const disableNextMonth = rightYear > today.getFullYear() || (rightYear === today.getFullYear() && rightMonth >= today.getMonth())

  // Header label reflects applied state (props), not pending.
  const btnLabel = (() => {
    if (preset === "custom" && customStart && customEnd)
      return `${fmt(customStart)} – ${fmt(customEnd)}`
    if (preset === "maximum" && customStart && customEnd)
      return `Maximum: ${fmt(customStart)} – ${fmt(customEnd)}`
    const p = DATE_PICKER_PRESETS.find(x => x.value === preset)
    if (!p) return "Select range"
    const { start, end } = getPresetRange(preset, maxStart ?? undefined)
    return `${p.label}: ${fmt(start)} – ${fmt(end)}`
  })()

  const isCustomValid = mode === "custom" && rangeStart
  const canApply = (mode === "preset" && !!pending) || isCustomValid

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 h-8 px-3 text-xs border rounded-lg hover:bg-muted/50 transition-colors whitespace-nowrap"
      >
        <IconCalendar className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-[#1c2b33] dark:text-foreground">{btnLabel}</span>
        <IconChevronDown className="size-3 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <>
          {/* click-away shield */}
          <div className="fixed inset-0 z-[59]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-[60] bg-white dark:bg-card border rounded-xl shadow-2xl overflow-hidden">
            <div className="flex">
              {/* ── Left: presets + custom + footer ── */}
              <div className="w-[180px] border-r shrink-0 flex flex-col bg-white dark:bg-card">
                <div className="py-1.5 flex-1">
                  {DATE_PICKER_PRESETS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => selectPreset(p.value)}
                      className={cn(
                        "w-full text-left px-4 py-[7px] text-xs transition-colors",
                        mode === "preset" && pending === p.value
                          ? "bg-[#e7f3ff] text-[#1877f2] font-semibold"
                          : "text-[#1c2b33] dark:text-foreground hover:bg-muted/40"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                  <div className="border-t my-1.5" />
                  <button
                    onClick={switchToCustom}
                    className={cn(
                      "w-full text-left px-4 py-[7px] text-xs transition-colors",
                      mode === "custom"
                        ? "bg-[#e7f3ff] text-[#1877f2] font-semibold"
                        : "text-[#1c2b33] dark:text-foreground hover:bg-muted/40"
                    )}
                  >
                    Custom range
                  </button>
                </div>

                {/* From / To inputs (visible in custom mode) */}
                {mode === "custom" && (
                  <div className="px-3 pb-3 space-y-2 border-t pt-3">
                    <label className="block">
                      <span className="text-[10px] uppercase font-medium text-muted-foreground">From</span>
                      <input
                        type="date"
                        max={fmtInput(todayMidnight())}
                        value={rangeStart ? fmtInput(rangeStart) : ""}
                        onChange={e => {
                          const v = e.target.value
                          if (!v) return
                          const d = new Date(v + "T00:00:00")
                          if (d > todayMidnight()) return
                          setRangeStart(d)
                          if (rangeEnd && d > rangeEnd) setRangeEnd(null)
                        }}
                        className="mt-1 w-full h-8 px-2 text-xs border rounded-md bg-background"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] uppercase font-medium text-muted-foreground">To</span>
                      <input
                        type="date"
                        max={fmtInput(todayMidnight())}
                        value={rangeEnd ? fmtInput(rangeEnd) : ""}
                        onChange={e => {
                          const v = e.target.value
                          if (!v) return
                          const d = new Date(v + "T00:00:00")
                          if (d > todayMidnight()) return
                          setRangeEnd(d)
                          if (rangeStart && d < rangeStart) setRangeStart(d)
                        }}
                        className="mt-1 w-full h-8 px-2 text-xs border rounded-md bg-background"
                      />
                    </label>
                  </div>
                )}

                {/* Footer actions */}
                <div className="flex items-center justify-end gap-2 p-3 border-t">
                  <button
                    onClick={reset}
                    className="h-8 px-3 text-xs border rounded-lg hover:bg-muted/50 transition-colors font-medium text-[#1c2b33] dark:text-foreground"
                  >
                    Reset
                  </button>
                  <button
                    onClick={apply}
                    disabled={!canApply}
                    className={cn(
                      "h-8 px-4 text-xs rounded-lg font-semibold transition-colors",
                      canApply
                        ? "bg-[#1877f2] text-white hover:bg-[#1464d8]"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* ── Right: two-month calendar ── */}
              <div className="flex flex-col p-4 bg-white dark:bg-card">
                <div className="flex items-start gap-4 relative">
                  <button
                    onClick={prevMonth}
                    className="absolute left-0 top-[1px] p-1 rounded hover:bg-muted/50 transition-colors"
                    aria-label="Previous month"
                  >
                    <IconChevronLeft className="size-4 text-muted-foreground" />
                  </button>

                  <div className="pl-7">
                    <CalGrid
                      year={leftYear} month={leftMonth}
                      startDate={rangeStart} endDate={rangeEnd} hoverDate={hoverDate}
                      onDay={handleDay} onHover={setHoverDate}
                    />
                  </div>

                  <CalGrid
                    year={rightYear} month={rightMonth}
                    startDate={rangeStart} endDate={rangeEnd} hoverDate={hoverDate}
                    onDay={handleDay} onHover={setHoverDate}
                  />

                  <button
                    onClick={nextMonth}
                    disabled={disableNextMonth}
                    className={cn(
                      "absolute right-0 top-[1px] p-1 rounded transition-colors",
                      disableNextMonth ? "opacity-30 cursor-not-allowed" : "hover:bg-muted/50"
                    )}
                    aria-label="Next month"
                  >
                    <IconChevronRight className="size-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
