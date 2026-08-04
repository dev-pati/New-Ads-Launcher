"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import type { AppNotification } from "@/hooks/use-notifications"
import { FAILURE_TYPES, iconForType } from "@/lib/notifications/types"
import { IconBellOff, IconCheck, IconLoader2 } from "@tabler/icons-react"

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString()
}

/** Today / Yesterday / Earlier — the [Time] part of the message, made scannable. */
function bucketOf(dateStr: string): "Today" | "Yesterday" | "Earlier" {
  const then = new Date(dateStr)
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const t = then.getTime()
  if (t >= startOfToday) return "Today"
  if (t >= startOfToday - 86_400_000) return "Yesterday"
  return "Earlier"
}

function NotifItem({
  n,
  onRead,
  onClose,
}: {
  n: AppNotification
  onRead: (id: string) => void
  onClose: () => void
}) {
  const router = useRouter()
  const isFailure = FAILURE_TYPES.has(n.type)

  const handleClick = () => {
    if (!n.is_read) onRead(n.id)
    if (n.link) {
      router.push(n.link)
      onClose()
    }
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full text-left px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer",
        "hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
        !n.is_read && "bg-primary/[0.06] dark:bg-primary/[0.10]"
      )}
    >
      <span className="text-base shrink-0 mt-0.5 leading-none">{iconForType(n.type)}</span>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm leading-snug text-popover-foreground",
            !n.is_read && "font-semibold",
            isFailure && "text-destructive"
          )}
        >
          {n.title}
        </p>

        {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}

        {/* The old → new pairs, when the row carries them. Kept to two so the item
            stays one glance; the full list lives in the object's change history. */}
        {Array.isArray(n.changes) && n.changes.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {n.changes.slice(0, 2).map(c => (
              <li key={c.field} className="text-xs text-muted-foreground flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 text-muted-foreground/70">{c.label}</span>
                {c.from !== null && (
                  <span className="line-through truncate max-w-[6rem] text-muted-foreground/60">{c.from}</span>
                )}
                <span className="text-muted-foreground/40">→</span>
                <span className="truncate max-w-[7rem] font-medium text-popover-foreground/80">
                  {c.to ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</p>
      </div>

      {!n.is_read && <span className="size-1.5 rounded-full bg-primary shrink-0 mt-1.5" />}
    </button>
  )
}

const PANEL_WIDTH = 340
const GAP = 8

interface Props {
  /** The bell button. The panel is positioned against it and clicks on it are ignored
      by the outside-click handler, so the button keeps working as a toggle. */
  anchorRef: React.RefObject<HTMLElement | null>
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean
  live: boolean
  onRead: (id: string) => void
  onReadAll: () => void
  onRefresh: () => void
  onClose: () => void
}

export function NotificationsDropdown({
  anchorRef,
  notifications,
  unreadCount,
  loading,
  live,
  onRead,
  onReadAll,
  onRefresh,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  // The sidebar is `overflow-hidden`, so an absolutely-positioned panel would be
  // clipped. Fixed + measured beats the old hardcoded `left-[210px] top-12`, which
  // broke the moment the sidebar was collapsed.
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null)

  useLayoutEffect(() => {
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      const left = Math.min(rect.right + GAP, window.innerWidth - PANEL_WIDTH - GAP)
      setPos({
        left: Math.max(GAP, left),
        bottom: Math.max(GAP, window.innerHeight - rect.bottom),
      })
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [anchorRef])

  // Realtime keeps this fresh, but opening the panel is an explicit "show me now".
  useEffect(() => { onRefresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (anchorRef.current?.contains(target)) return
      if (ref.current && !ref.current.contains(target)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [onClose, anchorRef])

  const groups = useMemo(() => {
    const out: { label: string; items: AppNotification[] }[] = []
    for (const n of notifications) {
      const label = bucketOf(n.created_at)
      const last = out[out.length - 1]
      if (last && last.label === label) last.items.push(n)
      else out.push({ label, items: [n] })
    }
    return out
  }, [notifications])

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Notifications"
      // Anchored to the bell in the sidebar footer: opens upward and to the right, so
      // it never covers the button and never runs off the bottom of the viewport.
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl",
        !pos && "invisible"
      )}
      style={{
        left: pos?.left ?? 0,
        bottom: pos?.bottom ?? 0,
        width: PANEL_WIDTH,
        maxWidth: "calc(100vw - 16px)",
        maxHeight: "min(480px, calc(100vh - 32px))",
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <span className="text-xs font-semibold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
              {unreadCount}
            </span>
          )}
          {/* Silent staleness is the failure mode this replaces — say when it is off. */}
          {!live && (
            <span
              className="text-xs text-muted-foreground/70"
              title="Live updates are not connected — the list refreshes every minute"
            >
              offline
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={onReadAll}
            className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
          >
            <IconCheck className="size-3" />Mark all read
          </button>
        )}
      </div>

      <div className="overflow-y-auto flex-1">
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <IconLoader2 className="size-5 text-muted-foreground animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
            <IconBellOff className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={`${group.label}-${group.items[0].id}`}>
              <div className="sticky top-0 z-10 bg-popover/95 backdrop-blur px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground/70 border-b border-border/50">
                {group.label}
              </div>
              <div className="divide-y divide-border/50">
                {group.items.map(n => (
                  <NotifItem key={n.id} n={n} onRead={onRead} onClose={onClose} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
