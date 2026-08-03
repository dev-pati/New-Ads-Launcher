import { IconAlertCircle, IconCheck } from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import type { MetaAssignmentProgress } from "@/lib/meta-assignment-progress"

interface MetaAssignmentStatusProps {
  progress?: MetaAssignmentProgress
  fallbackStatus?: string | null
  ready?: boolean
  compact?: boolean
  className?: string
}

export function MetaAssignmentStatus({
  progress,
  fallbackStatus,
  ready = false,
  compact = false,
  className,
}: MetaAssignmentStatusProps) {
  const phase = progress?.phase
    || (ready || fallbackStatus === "ready" ? "ready" : fallbackStatus === "error" ? "error" : "assigning")

  if (phase === "ready") {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", className)}>
        <IconCheck className="size-3" /> Ready
      </span>
    )
  }

  if (phase === "error") {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400", className)} title={progress?.error}>
        <IconAlertCircle className="size-3" /> Error
      </span>
    )
  }

  // No percent label: Meta's per-item progress is indeterminate for images and for
  // the pre-fb_video_id phase (see lib/meta-assignment-progress.ts), so a number here
  // was either missing or misleadingly precise. Keep one loading state until ready.
  return (
    <div className={cn("min-w-[96px]", className)} title="Assigning to Meta">
      <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-400">
        <span>{"Assigning…"}</span>
      </div>
      {!compact && (
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950/60">
          <div className="meta-assignment-progress-indicator h-full bg-blue-500" />
        </div>
      )}
    </div>
  )
}
