"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getGlossaryEntry } from "@/lib/help-glossary"
import { useHelp } from "@/lib/help-context"
import { cn } from "@/lib/utils"

export function HelpTerm({
  term,
  children,
  className,
}: {
  term: string
  children: React.ReactNode
  className?: string
}) {
  const { openHelp } = useHelp()
  const entry = getGlossaryEntry(term)
  if (!entry) return <>{children}</>

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span className={cn("cursor-help underline decoration-dotted decoration-muted-foreground/60 underline-offset-4", className)}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs space-y-1.5 bg-popover text-popover-foreground border px-3 py-2">
        <p className="font-semibold">{entry.term}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{entry.tooltip}</p>
        <button
          onClick={() => openHelp(entry.key)}
          className="text-xs font-medium text-primary hover:underline"
        >
          Learn more
        </button>
      </TooltipContent>
    </Tooltip>
  )
}
