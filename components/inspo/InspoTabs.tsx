"use client"

import { cn } from "@/lib/utils"

export type InspoTab = "explore" | "following"

interface Props {
  active: InspoTab
  onChange: (t: InspoTab) => void
}

export function InspoTabs({ active, onChange }: Props) {
  return (
    <div className="flex items-center gap-0 border-b border-border">
      {(["explore", "following"] as InspoTab[]).map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={cn(
            "px-4 py-2.5 text-sm font-medium capitalize transition-colors relative",
            active === tab
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
          {active === tab && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
          )}
        </button>
      ))}
    </div>
  )
}
