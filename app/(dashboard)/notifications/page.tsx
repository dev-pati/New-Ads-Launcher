"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useNotifications, type AppNotification } from "@/hooks/use-notifications"
import {
  NOTIFICATION_CATEGORIES,
  notificationCategoryForType,
  type NotificationCategory,
} from "@/lib/notifications/category"
import { FAILURE_TYPES, iconForType } from "@/lib/notifications/types"
import {
  IconAlertCircle,
  IconArchive,
  IconArchiveOff,
  IconArrowLeft,
  IconBellOff,
  IconCheck,
  IconDotsVertical,
  IconLoader2,
  IconRefresh,
  IconSettings,
  IconTrash,
} from "@tabler/icons-react"

type CategoryFilter = "all" | NotificationCategory
type NotificationView = "inbox" | "archived"

const categoryLabels: Record<CategoryFilter, string> = {
  all: "All",
  business: "Business",
  ads: "Ads",
  profiles: "Profiles",
  apps: "Apps",
}

const categoryDescriptions: Record<NotificationCategory, string> = {
  business: "Requests, templates, and organization activity.",
  ads: "Ads, campaigns, ad sets, and launch outcomes.",
  profiles: "Team membership and role changes.",
  apps: "Assets, media, creatives, and automations.",
}

function timeAgo(date: string) {
  const seconds = (Date.now() - new Date(date).getTime()) / 1_000
  if (seconds < 60) return "just now"
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`
  return new Date(date).toLocaleDateString()
}

function bucketOf(date: string): "Today" | "Yesterday" | "Earlier" {
  const timestamp = new Date(date).getTime()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (timestamp >= today) return "Today"
  if (timestamp >= today - 86_400_000) return "Yesterday"
  return "Earlier"
}

function NotificationRow({
  notification,
  archived,
  onRead,
  onArchive,
  onRestore,
  onDelete,
}: {
  notification: AppNotification
  archived: boolean
  onRead: (id: string) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onDelete: (notification: AppNotification) => void
}) {
  const router = useRouter()
  const failure = FAILURE_TYPES.has(notification.type)

  const openNotification = () => {
    if (!notification.is_read) onRead(notification.id)
    if (notification.link) router.push(notification.link)
  }

  return (
    <article
      className={cn(
        "group flex gap-3 border-b border-border/50 px-4 py-4 transition-colors hover:bg-muted/40",
        !notification.is_read && "bg-primary/[0.045]"
      )}
    >
      <button onClick={openNotification} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border bg-background text-base">
          {iconForType(notification.type)}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-sm leading-snug text-foreground",
              !notification.is_read && "font-semibold",
              failure && "text-destructive"
            )}
          >
            {notification.title}
          </span>
          {notification.body && (
            <span className="mt-1 block max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {notification.body}
            </span>
          )}
          <span className="mt-1.5 block text-xs text-muted-foreground/70">{timeAgo(notification.created_at)}</span>
        </span>
        {!notification.is_read && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100">
            <IconDotsVertical className="size-4" />
            <span className="sr-only">Notification actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!notification.is_read && (
            <DropdownMenuItem onClick={() => onRead(notification.id)}>
              <IconCheck className="size-4" /> Mark as read
            </DropdownMenuItem>
          )}
          {archived ? (
            <DropdownMenuItem onClick={() => onRestore(notification.id)}>
              <IconArchiveOff className="size-4" /> Restore to inbox
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onArchive(notification.id)}>
              <IconArchive className="size-4" /> Archive
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(notification)}>
            <IconTrash className="size-4" /> Delete forever
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </article>
  )
}

export default function NotificationsPage() {
  const [view, setView] = useState<NotificationView>("inbox")
  const [filter, setFilter] = useState<CategoryFilter>("all")
  const [showPreferences, setShowPreferences] = useState(false)
  const [preferences, setPreferences] = useState<Record<NotificationCategory, boolean> | null>(null)
  const [preferencesError, setPreferencesError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AppNotification | null>(null)
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markRead,
    markAllRead,
    archive,
    restore,
    deleteNotification,
    refresh,
  } = useNotifications({ view })

  useEffect(() => {
    fetch("/api/notification-preferences")
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load preferences")
        setPreferences(data.preferences)
      })
      .catch(err => setPreferencesError(err instanceof Error ? err.message : "Failed to load preferences"))
  }, [])

  const visibleNotifications = useMemo(
    () => filter === "all"
      ? notifications
      : notifications.filter(notification => notificationCategoryForType(notification.type) === filter),
    [filter, notifications]
  )

  const groups = useMemo(() => {
    const output: Array<{ label: string; items: AppNotification[] }> = []
    for (const notification of visibleNotifications) {
      const label = bucketOf(notification.created_at)
      const group = output.at(-1)
      if (group?.label === label) group.items.push(notification)
      else output.push({ label, items: [notification] })
    }
    return output
  }, [visibleNotifications])

  const updatePreference = async (category: NotificationCategory, enabled: boolean) => {
    const previous = preferences
    setPreferences(current => current ? { ...current, [category]: enabled } : current)
    setPreferencesError(null)

    const response = await fetch("/api/notification-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, inAppEnabled: enabled }),
    }).catch(() => null)

    if (!response?.ok) {
      setPreferences(previous)
      setPreferencesError("Could not save this preference. Please try again.")
    }
  }

  if (showPreferences) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-6 lg:px-8">
        <button onClick={() => setShowPreferences(false)} className="mb-6 flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <IconArrowLeft className="size-4" /> Notifications
        </button>
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold">Notification preferences</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose which categories appear in your in-app inbox.</p>
        </div>
        {preferencesError && <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{preferencesError}</p>}
        <div className="overflow-hidden rounded-xl border bg-card">
          {NOTIFICATION_CATEGORIES.map(category => {
            const enabled = preferences?.[category] ?? true
            return (
              <div key={category} className="flex items-center justify-between gap-4 border-b p-4 last:border-b-0">
                <div>
                  <p className="text-sm font-semibold">{categoryLabels[category]}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{categoryDescriptions[category]}</p>
                </div>
                <button
                  type="button"
                  aria-pressed={enabled}
                  aria-label={`${enabled ? "Disable" : "Enable"} ${categoryLabels[category]} in-app alerts`}
                  onClick={() => updatePreference(category, !enabled)}
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    enabled ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                >
                  <span className={cn("absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform", enabled ? "translate-x-5" : "translate-x-0")} />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-6 py-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold">Notifications</h1>
            {unreadCount > 0 && view === "inbox" && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{unreadCount}</span>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Review updates assigned to your active organization.</p>
        </div>
        <div className="flex items-center gap-2">
          {view === "inbox" && unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}><IconCheck className="size-4" /> Mark all read</Button>
          )}
          <Button variant="outline" size="icon-sm" onClick={() => refresh()}><IconRefresh className="size-4" /><span className="sr-only">Refresh</span></Button>
          <Button variant="outline" size="icon-sm" onClick={() => setShowPreferences(true)}><IconSettings className="size-4" /><span className="sr-only">Notification preferences</span></Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", ...NOTIFICATION_CATEGORIES] as CategoryFilter[]).map(category => (
          <Button key={category} variant={filter === category ? "default" : "outline"} size="sm" onClick={() => setFilter(category)}>
            {categoryLabels[category]}
          </Button>
        ))}
        <span className="mx-1 h-8 border-l" />
        <Button variant={view === "archived" ? "secondary" : "ghost"} size="sm" onClick={() => setView(current => current === "inbox" ? "archived" : "inbox")}>
          <IconArchive className="size-4" /> {view === "archived" ? "Archived" : "View archived"}
        </Button>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-16 text-center">
          <IconAlertCircle className="size-7 text-destructive" />
          <div>
            <p className="font-medium">Could not load notifications</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refresh()}><IconRefresh className="size-4" /> Try again</Button>
        </div>
      ) : loading && notifications.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-20"><IconLoader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : visibleNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
          {view === "archived" ? <IconArchive className="size-8 text-muted-foreground/40" /> : <IconBellOff className="size-8 text-muted-foreground/40" />}
          <p className="mt-3 font-medium">{view === "archived" ? "No archived notifications" : "You are all caught up"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{filter === "all" ? "New updates will appear here." : `No ${categoryLabels[filter]} updates in this view.`}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {groups.map(group => (
            <section key={group.label}>
              <h2 className="border-b bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{group.label}</h2>
              {group.items.map(notification => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  archived={view === "archived"}
                  onRead={markRead}
                  onArchive={archive}
                  onRestore={restore}
                  onDelete={setPendingDelete}
                />
              ))}
            </section>
          ))}
        </div>
      )}

      <Dialog open={!!pendingDelete} onOpenChange={open => !open && setPendingDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete notification?</DialogTitle>
            <DialogDescription>This permanently removes this notification from your inbox. It cannot be restored.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              if (pendingDelete) deleteNotification(pendingDelete.id)
              setPendingDelete(null)
            }}><IconTrash className="size-4" /> Delete forever</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
