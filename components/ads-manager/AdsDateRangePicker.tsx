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
]

export function getPresetRange(preset: string): { start: Date; end: Date } {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = (n: number) => { const x = new Date(today); x.setDate(x.getDate() + n); return x }
  switch (preset) {
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

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

// ─── Calendar grid ────────────────────────────────────────────────────────────

const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"]
const DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"]

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
  const todayDate  = new Date(); todayDate.setHours(0,0,0,0)
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
    <div className="w-[196px] select-none">
      <p className="text-center text-xs font-semibold mb-3 text-[#1c2b33] dark:text-white">
        {MONTHS[month]} {year}
      </p>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />
          const date = new Date(year, month, day)
          return (
            <div
              key={i}
              onClick={() => onDay(date)}
              onMouseEnter={() => onHover(date)}
              onMouseLeave={() => onHover(null)}
              className={cn(
                "h-7 flex items-center justify-center text-xs cursor-pointer transition-colors",
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
  onChange: (preset: string, customStart?: Date, customEnd?: Date) => void
}

export function AdsDateRangePicker({ preset, customStart, customEnd, onChange }: Props) {
  const [open,        setOpen]        = useState(false)
  const [pending,     setPending]     = useState(preset)
  const [rangeStart,  setRangeStart]  = useState<Date | null>(null)
  const [rangeEnd,    setRangeEnd]    = useState<Date | null>(null)
  const [hoverDate,   setHoverDate]   = useState<Date | null>(null)
  const [needEnd,     setNeedEnd]     = useState(false)
  const [leftYear,    setLeftYear]    = useState(new Date().getFullYear())
  const [leftMonth,   setLeftMonth]   = useState(new Date().getMonth())
  const wrapRef = useRef<HTMLDivElement>(null)

  const rightYear  = leftMonth === 11 ? leftYear + 1 : leftYear
  const rightMonth = leftMonth === 11 ? 0 : leftMonth + 1

  useEffect(() => {
    if (!open) return
    setPending(preset)
    setNeedEnd(false)
    if (preset === "custom" && customStart && customEnd) {
      setRangeStart(customStart)
      setRangeEnd(customEnd)
      setLeftYear(customStart.getFullYear())
      setLeftMonth(customStart.getMonth())
    } else {
      const { start, end } = getPresetRange(preset)
      setRangeStart(start)
      setRangeEnd(end)
      setLeftYear(start.getFullYear())
      setLeftMonth(start.getMonth())
    }
  }, [open]) // eslint-disable-line

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const selectPreset = (p: string) => {
    setPending(p)
    const { start, end } = getPresetRange(p)
    setRangeStart(start)
    setRangeEnd(end)
    setNeedEnd(false)
    setLeftYear(start.getFullYear())
    setLeftMonth(start.getMonth())
  }

  const handleDay = (d: Date) => {
    setPending("custom")
    if (!needEnd || (rangeStart && rangeEnd)) {
      setRangeStart(d); setRangeEnd(null); setNeedEnd(true)
    } else {
      if (rangeStart && d < rangeStart) {
        setRangeEnd(rangeStart); setRangeStart(d)
      } else {
        setRangeEnd(d)
      }
      setNeedEnd(false)
    }
  }

  const apply = () => {
    if (pending !== "custom") {
      onChange(pending)
    } else if (rangeStart) {
      onChange("custom", rangeStart, rangeEnd ?? rangeStart)
    }
    setOpen(false)
  }

  const reset = () => selectPreset("last_7d")

  const prevMonth = () => {
    if (leftMonth === 0) { setLeftMonth(11); setLeftYear(y => y - 1) }
    else setLeftMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (leftMonth === 11) { setLeftMonth(0); setLeftYear(y => y + 1) }
    else setLeftMonth(m => m + 1)
  }

  const btnLabel = (() => {
    if (preset === "custom" && customStart && customEnd)
      return `${fmt(customStart)} – ${fmt(customEnd)}`
    const p = DATE_PICKER_PRESETS.find(x => x.value === preset)
    if (!p) return "Select range"
    const { start, end } = getPresetRange(preset)
    return `${p.label}: ${fmt(start)} – ${fmt(end)}`
  })()

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 h-7 px-2.5 text-xs border rounded-lg hover:bg-muted/50 transition-colors whitespace-nowrap"
      >
        <IconCalendar className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-[#1c2b33] dark:text-foreground">{btnLabel}</span>
        <IconChevronDown className="size-3 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-[60] bg-white dark:bg-card border rounded-xl shadow-2xl flex overflow-hidden"
          style={{ minWidth: 580 }}
        >
          {/* Presets */}
          <div className="w-[148px] border-r shrink-0 py-1.5 bg-white dark:bg-card">
            {DATE_PICKER_PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => selectPreset(p.value)}
                className={cn(
                  "w-full text-left px-4 py-[7px] text-xs transition-colors",
                  pending === p.value
                    ? "bg-[#e7f3ff] text-[#1877f2] font-semibold"
                    : "text-[#1c2b33] dark:text-foreground hover:bg-muted/40"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Calendars */}
          <div className="flex flex-col p-4 gap-3 bg-white dark:bg-card">
            <div className="flex items-start gap-4 relative">
              <button
                onClick={prevMonth}
                className="absolute left-0 top-[1px] p-1 rounded hover:bg-muted/50 transition-colors"
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
                className="absolute right-0 top-[1px] p-1 rounded hover:bg-muted/50 transition-colors"
              >
                <IconChevronRight className="size-4 text-muted-foreground" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                onClick={reset}
                className="h-8 px-4 text-sm border rounded-lg hover:bg-muted/50 transition-colors font-medium text-[#1c2b33] dark:text-foreground"
              >
                Reset
              </button>
              <button
                onClick={apply}
                className="h-8 px-5 text-sm bg-[#1877f2] text-white rounded-lg hover:bg-[#1464d8] transition-colors font-semibold"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
