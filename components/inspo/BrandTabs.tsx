"use client"

import { useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

export type BrandTab =
  | "overview" | "ad-copies" | "headlines" | "landing-pages"
  | "timeline" | "usp" | "ad-angle" | "desire" | "emotion"
  | "theme" | "ad-format"

const TABS: { id: BrandTab; label: string }[] = [
  { id: "overview",      label: "Overview" },
  { id: "ad-copies",     label: "Ad Copies" },
  { id: "headlines",     label: "Headlines" },
  { id: "landing-pages", label: "Landing Pages" },
  { id: "timeline",      label: "Timeline" },
  { id: "usp",           label: "USP" },
  { id: "ad-angle",      label: "Ad Angle" },
  { id: "desire",        label: "Desire" },
  { id: "emotion",       label: "Emotion" },
  { id: "theme",         label: "Theme" },
  { id: "ad-format",     label: "Ad Format" },
]

interface Props {
  active: BrandTab
  onChange: (t: BrandTab) => void
}

export function BrandTabs({ active, onChange }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll active tab into view
  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-tab="${active}"]`) as HTMLElement | null
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" })
  }, [active])

  return (
    <div
      ref={scrollRef}
      className="flex items-end gap-0 border-b border-border overflow-x-auto scrollbar-none px-6 shrink-0 bg-background sticky top-0 z-10"
    >
      {TABS.map(tab => (
        <button
          key={tab.id}
          data-tab={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative flex-shrink-0 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors",
            active === tab.id
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
          {active === tab.id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
          )}
        </button>
      ))}
    </div>
  )
}
