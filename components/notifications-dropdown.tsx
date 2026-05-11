"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useNotifications, type AppNotification } from "@/hooks/use-notifications"
import { IconBellOff, IconCheck, IconLoader2 } from "@tabler/icons-react"

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString()
}

const TYPE_ICON: Record<string, string> = {
  ad_launched:      "🚀",
  template_created: "📋",
  asset_uploaded:   "🖼️",
  member_joined:    "👋",
  inspo_saved:      "💡",
}

function NotifItem({ n, onRead }: { n: AppNotification; onRead: (id: string) => void }) {
  const router = useRouter()

  const handleClick = () => {
    onRead(n.id)
    if (n.link) router.push(n.link)
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors",
        !n.is_read && "bg-primary/5"
      )}
    >
      <span className="text-base shrink-0 mt-0.5">{TYPE_ICON[n.type] ?? "🔔"}</span>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm leading-snug", !n.is_read && "font-semibold")}>{n.title}</p>
        {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
        <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</p>
      </div>
      {!n.is_read && (
        <span className="size-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
      )}
    </button>
  )
}

interface Props {
  onClose: () => void
}

export function NotificationsDropdown({ onClose }: Props) {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed left-[210px] top-12 z-50 w-80 rounded-xl border bg-popover shadow-lg overflow-hidden flex flex-col"
      style={{ maxHeight: "min(480px, calc(100vh - 60px))" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <IconCheck className="size-3" />Mark all read
          </button>
        )}
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1 divide-y divide-border/50">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <IconLoader2 className="size-5 text-muted-foreground animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
            <IconBellOff className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          notifications.map(n => (
            <NotifItem key={n.id} n={n} onRead={markRead} />
          ))
        )}
      </div>
    </div>
  )
}
