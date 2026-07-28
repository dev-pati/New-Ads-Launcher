"use client"

import { cn } from "@/lib/utils"

export type InspoTab = "explore" | "following"

interface Props {
  active: InspoTab
  onChange: (t: InspoTab) => void
}

export function InspoTabs({ active, onChange }: Props) {
  return (
    <div className="flex items-center gap-5">
      {(["explore", "following"] as InspoTab[]).map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={cn(
            "px-0 py-3.5 text-sm font-semibold capitalize transition-colors relative",
            active === tab
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
          {active === tab && (
            <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary rounded-t-full" />
          )}
        </button>
      ))}
    </div>
  )
}
