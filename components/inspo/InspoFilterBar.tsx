"use client"

import { useState, useRef, useEffect } from "react"
import { IconChevronDown, IconCheck } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { FilterState } from "@/types/inspo"
import { MOCK_ADS } from "@/lib/inspo-mock-data"

const unique = (arr: (string | undefined)[]) =>
  Array.from(new Set(arr.filter(Boolean))) as string[]

const FILTER_OPTIONS = {
  company:    unique(MOCK_ADS.map(a => a.brandName)).sort(),
  language:   ["English", "Vietnamese", "Spanish", "French", "German", "Portuguese"],
  categories: unique(MOCK_ADS.map(a => a.category)).sort(),
  cta:        unique(MOCK_ADS.map(a => a.cta)).sort(),
  platform:   ["Facebook", "Instagram", "TikTok"],
  format:     ["Image", "Video", "Carousel"],
  usp:        unique(MOCK_ADS.map(a => a.usp)).sort(),
  angle:      unique(MOCK_ADS.map(a => a.angle)).sort(),
  desire:     unique(MOCK_ADS.map(a => a.desire)).sort(),
  emotion:    unique(MOCK_ADS.map(a => a.emotion)).sort(),
  theme:      unique(MOCK_ADS.map(a => a.theme)).sort(),
}

const VIEW_OPTIONS = [
  { value: "all",        label: "All Views" },
  { value: "under_100k", label: "Under 100K" },
  { value: "100k_1m",    label: "100K – 1M" },
  { value: "over_1m",    label: "Over 1M" },
]

const FILTER_LABELS: Record<keyof FilterState, string> = {
  company: "Company", language: "Language", categories: "Categories",
  cta: "CTA", platform: "Platform", format: "Format",
  usp: "USP", angle: "Ad Angle", desire: "Desire",
  emotion: "Emotion", theme: "Theme", views: "Views",
}

interface DropdownProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}

function MultiSelectDropdown({ label, options, selected, onChange }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])
  }

  const active = selected.length > 0

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className={cn(
          "flex items-center gap-1 h-7 px-2.5 text-[12px] rounded-lg border whitespace-nowrap transition-colors font-medium",
          active
            ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/15"
            : "bg-muted/40 hover:bg-muted border-border/60 text-foreground/70 hover:text-foreground"
        )}
      >
        {label}
        {active && (
          <span className="inline-flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold leading-none">
            {selected.length}
          </span>
        )}
        <IconChevronDown className={cn("size-3 transition-transform text-current opacity-60", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-popover border border-border/80 rounded-xl shadow-xl min-w-[160px] max-h-60 overflow-y-auto py-1.5">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted text-left transition-colors"
            >
              <span className={cn(
                "size-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors",
                selected.includes(opt) ? "bg-primary border-primary" : "border-border"
              )}>
                {selected.includes(opt) && <IconCheck className="size-3 text-primary-foreground" />}
              </span>
              <span className="text-foreground/85">{opt}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface ViewsDropdownProps {
  value: string
  onChange: (v: string) => void
}

function ViewsDropdown({ value, onChange }: ViewsDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const label = VIEW_OPTIONS.find(o => o.value === value)?.label || "Views"

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className={cn(
          "flex items-center gap-1 h-7 px-2.5 text-[12px] rounded-lg border whitespace-nowrap transition-colors font-medium",
          value !== "all"
            ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/15"
            : "bg-muted/40 hover:bg-muted border-border/60 text-foreground/70 hover:text-foreground"
        )}
      >
        {label}
        <IconChevronDown className={cn("size-3 transition-transform opacity-60", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-popover border border-border/80 rounded-xl shadow-xl min-w-[140px] py-1.5">
          {VIEW_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted text-left transition-colors",
                value === opt.value ? "text-primary font-medium" : "text-foreground/80"
              )}
            >
              <span className="size-4 flex items-center justify-center shrink-0">
                {value === opt.value && <IconCheck className="size-3.5" />}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  filters: FilterState
  onChange: (f: FilterState) => void
}

export function InspoFilterBar({ filters, onChange }: Props) {
  const set = (key: keyof FilterState, val: any) => onChange({ ...filters, [key]: val })

  const multiFilters: (keyof typeof FILTER_OPTIONS)[] = [
    "company", "language", "categories", "cta", "platform",
    "format", "usp", "angle", "desire", "emotion", "theme",
  ]

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {multiFilters.map(key => (
        <MultiSelectDropdown
          key={key}
          label={FILTER_LABELS[key]}
          options={FILTER_OPTIONS[key]}
          selected={filters[key] as string[]}
          onChange={v => set(key, v)}
        />
      ))}
      <ViewsDropdown value={filters.views} onChange={v => set("views", v)} />
    </div>
  )
}
