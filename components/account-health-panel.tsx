"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import Link from "next/link"
import { useAdAccount } from "@/lib/ad-account-context"
import { cn } from "@/lib/utils"
import {
  IconActivityHeartbeat,
  IconAlertTriangle,
  IconBell,
  IconCircleCheck,
  IconExternalLink,
  IconHistory,
  IconLoader2,
  IconRefresh,
  IconX,
} from "@tabler/icons-react"

type AccountHealth = {
  id: string
  name: string
  statusCode: number
  status: string
  disableReasonCode: number
  disableReason: string
  metaNotificationsEnabled: boolean | null
  healthy: boolean
}

type AccountActivity = {
  time: string
  type: string
  actor: string | null
  objectName: string | null
  summary: string
}

function timeAgo(date: string) {
  const seconds = (Date.now() - new Date(date).getTime()) / 1_000
  if (seconds < 60) return "just now"
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`
  return new Date(date).toLocaleDateString()
}

export function AccountHealthPanel({
  anchorRef,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const { selectedAccount, selectedAccountId, loading: accountsLoading } = useAdAccount()
  const [health, setHealth] = useState<AccountHealth | null>(null)
  const [activities, setActivities] = useState<AccountActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [left, setLeft] = useState(64)

  useLayoutEffect(() => {
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      setLeft(Math.min(rect.right + 8, Math.max(8, window.innerWidth - 420 - 8)))
    }
    place()
    window.addEventListener("resize", place)
    return () => window.removeEventListener("resize", place)
  }, [anchorRef])

  const load = useCallback(async () => {
    if (!selectedAccountId) {
      setHealth(null)
      setActivities([])
      setLoading(false)
      setMessage(accountsLoading ? null : "No ad account is selected.")
      return
    }

    setLoading(true)
    setMessage(null)
    const query = encodeURIComponent(selectedAccountId)
    const [healthResponse, activitiesResponse] = await Promise.all([
      fetch(`/api/facebook/account-health?adAccountId=${query}`, { cache: "no-store" }),
      fetch(`/api/insights/activities?adAccountId=${query}&datePreset=last_30d`, { cache: "no-store" }),
    ]).catch(() => [null, null] as const)

    if (!healthResponse || !activitiesResponse) {
      setMessage("Could not reach Meta. Try again.")
      setLoading(false)
      return
    }

    const [healthData, activitiesData] = await Promise.all([
      healthResponse.json().catch(() => ({})),
      activitiesResponse.json().catch(() => ({})),
    ])

    setHealth(healthData.available ? healthData.account : null)
    setActivities(activitiesData.available ? (activitiesData.events || []).slice(0, 8) : [])
    setMessage(
      healthData.available
        ? activitiesData.available === false
          ? activitiesData.message || "Recent activity is unavailable."
          : null
        : healthData.message || "Account health is unavailable."
    )
    setLoading(false)
  }, [accountsLoading, selectedAccountId])

  useEffect(() => {
    const timeout = window.setTimeout(load, 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (anchorRef.current?.contains(target)) return
      if (panelRef.current && !panelRef.current.contains(target)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [anchorRef, onClose])

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Account health"
      className="fixed bottom-2 top-2 z-50 flex w-[420px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl"
      style={{ left }}
    >
      <header className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <IconActivityHeartbeat className="size-5 text-primary" />
            <h2 className="font-heading text-lg font-bold">Account health</h2>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Read only</span>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {selectedAccount?.name || "Selected ad account"}
          </p>
        </div>
        <button onClick={onClose} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
          <IconX className="size-4" />
          <span className="sr-only">Close account health</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center"><IconLoader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : !health ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <IconAlertTriangle className="size-8 text-amber-500" />
            <p className="mt-3 font-medium">Account health unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">{message || "Select an ad account and try again."}</p>
            <button onClick={load} className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <IconRefresh className="size-4" /> Try again
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <section className={cn("rounded-xl border p-4", health.healthy ? "border-emerald-500/25 bg-emerald-500/[0.06]" : "border-amber-500/30 bg-amber-500/[0.07]") }>
              <div className="flex items-start gap-3">
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", health.healthy ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600") }>
                  {health.healthy ? <IconCircleCheck className="size-5" /> : <IconAlertTriangle className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{health.status}</p>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", health.healthy ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300") }>
                      Status {health.statusCode}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {health.disableReasonCode === 0 ? "Meta reports no account disable reason." : health.disableReason}
                  </p>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <IconBell className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Meta notifications</span>
                </div>
                <span className={cn("text-xs font-semibold", health.metaNotificationsEnabled === false ? "text-amber-600" : "text-emerald-600") }>
                  {health.metaNotificationsEnabled === null ? "Unknown" : health.metaNotificationsEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                This is Meta&apos;s notification-enabled flag. Meta does not expose policy bulletin content through the public API.
              </p>
            </section>

            <section className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <IconHistory className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Recent account activity</h3>
                </div>
                <button onClick={load} className="text-muted-foreground hover:text-foreground"><IconRefresh className="size-4" /><span className="sr-only">Refresh account health</span></button>
              </div>
              {activities.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">No account activity in the last 30 days.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {activities.map((activity, index) => (
                    <div key={`${activity.time}-${activity.type}-${index}`} className="px-4 py-3">
                      <p className="text-sm font-medium leading-snug">{activity.summary}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[activity.objectName, activity.actor, timeAgo(activity.time)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {message && <p className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-700 dark:text-amber-300">{message}</p>}
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t px-4 py-3">
        <Link href="/ad-accounts" onClick={onClose} className="flex items-center justify-center gap-1.5 text-sm font-medium text-primary hover:underline">
          Open Ad Accounts <IconExternalLink className="size-4" />
        </Link>
      </footer>
    </div>
  )
}
