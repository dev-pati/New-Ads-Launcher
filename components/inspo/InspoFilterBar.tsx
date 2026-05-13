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
          "flex items-center gap-1 h-8 px-3 text-sm rounded-lg border whitespace-nowrap transition-colors",
          active
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background hover:bg-muted border-border text-foreground"
        )}
      >
        {label}
        {active && <span className="ml-0.5 text-xs font-bold">({selected.length})</span>}
        <IconChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-xl shadow-lg min-w-[160px] max-h-60 overflow-y-auto py-1">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted text-left"
            >
              <span className={cn(
                "size-4 rounded border flex items-center justify-center shrink-0",
                selected.includes(opt) ? "bg-primary border-primary" : "border-border"
              )}>
                {selected.includes(opt) && <IconCheck className="size-3 text-primary-foreground" />}
              </span>
              {opt}
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
          "flex items-center gap-1 h-8 px-3 text-sm rounded-lg border whitespace-nowrap transition-colors",
          value !== "all"
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background hover:bg-muted border-border text-foreground"
        )}
      >
        {label}
        <IconChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-xl shadow-lg min-w-[140px] py-1">
          {VIEW_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted text-left",
                value === opt.value && "text-primary font-medium"
              )}
            >
              {value === opt.value && <IconCheck className="size-3.5" />}
              {value !== opt.value && <span className="size-3.5" />}
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
