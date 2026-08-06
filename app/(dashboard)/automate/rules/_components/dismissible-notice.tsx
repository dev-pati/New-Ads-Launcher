"use client"

import { useEffect, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { IconX } from "@tabler/icons-react"

const KEY = (id: string) => `automate-rules:notice:${id}`

/**
 * A banner the operator can close for good.
 *
 * `level` is what keeps the amber warning honest. Without it, dismissing "3 rules are turned
 * off" would silence the page permanently, and a rule that breaks next week would land in the
 * silence — which is trap T7 with a nicer UI. With it, the dismissal records how bad things
 * were when the operator said "I know", and the banner comes back only when it gets worse.
 * Same count, or better: stays quiet. Omit `level` for notices that are pure explanation —
 * those never need to come back.
 */
export function DismissibleNotice({
  id, level, tone, icon, children,
}: {
  id: string
  level?: number
  tone: "info" | "warn"
  icon: ReactNode
  children: ReactNode
}) {
  // Rendered only after localStorage has been read: drawing the banner and then yanking it
  // away is worse than showing it a frame late.
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY(id))
      setDismissedAt(raw === null ? null : Number(raw))
    } catch {
      // private mode, blocked storage — the banner just stays dismissible per page load
    }
    setReady(true)
  }, [id])

  if (!ready) return null
  if (dismissedAt !== null && (level === undefined || level <= dismissedAt)) return null

  const dismiss = () => {
    const at = level ?? 0
    setDismissedAt(at)
    try {
      window.localStorage.setItem(KEY(id), String(at))
    } catch {
      // keeping it closed for this page load is still the right answer
    }
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 pr-2 rounded-lg border text-sm",
        tone === "info"
          ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400"
          : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-400"
      )}
    >
      {icon}
      <span className="flex-1">{children}</span>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        title={level === undefined ? "Dismiss" : "Dismiss — comes back if more rules stop running"}
        className="flex-shrink-0 p-1 rounded-md opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition"
      >
        <IconX className="size-4" />
      </button>
    </div>
  )
}
