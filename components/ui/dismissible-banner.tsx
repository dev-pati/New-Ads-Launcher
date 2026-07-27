"use client"

import { useEffect, type ReactNode } from "react"
import { IconX } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

// Reusable error/message banner: auto-dismiss after 5s + manual close (X).
// ponytail: no toast system exists yet in this app — this is a plain inline banner,
// not a stacking toast. Add sonner/radix-toast if concurrent multi-message stacking is needed.
export function DismissibleBanner({
  children,
  onDismiss,
  variant = "error",
  autoDismissMs = 5000,
  className,
}: {
  children: ReactNode
  onDismiss: () => void
  variant?: "error" | "success" | "warning"
  autoDismissMs?: number
  className?: string
}) {
  useEffect(() => {
    if (!autoDismissMs) return
    const t = setTimeout(onDismiss, autoDismissMs)
    return () => clearTimeout(t)
  }, [onDismiss, autoDismissMs])

  const styles = {
    error: "border-destructive/20 bg-destructive/5 text-destructive",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
    warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
  }[variant]

  return (
    <div className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", styles, className)}>
      <div className="flex-1">{children}</div>
      <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 opacity-60 hover:opacity-100">
        <IconX className="size-4" />
      </button>
    </div>
  )
}
