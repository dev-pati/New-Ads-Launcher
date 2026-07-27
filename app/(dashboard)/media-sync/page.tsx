"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAdAccount } from "@/lib/ad-account-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DismissibleBanner } from "@/components/ui/dismissible-banner"
import { CreativeCardMedia } from "@/components/creative-card-media"
import {
  IconRefresh, IconLoader2, IconPhoto, IconAlertCircle,
  IconExclamationCircle, IconUpload, IconCheck,
} from "@tabler/icons-react"

// ponytail: source/portal columns pending migration 20260727_creatives_portal.sql.
// Until then "Source" tile is derived from storage_path prefix (r2://pati-videos/creative-portal → Portal).

interface Creative {
  id: string
  file_name: string
  file_url: string
  media_type: "image" | "video"
  fb_image_hash?: string
  fb_video_id?: string
  fb_thumbnail_url?: string
  status?: "pending" | "processing" | "ready" | "error"
  created_at?: string
  storage_path?: string
}

function formatDate(s?: string) {
  if (!s) return "—"
  return new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function MediaSyncPage() {
  const { selectedAccountId, adAccounts, setSelectedAccountId } = useAdAccount()
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastSync, setLastSync] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!selectedAccountId) { setCreatives([]); setLoading(false); return }
    setLoading(true); setError("")
    try {
      const res = await fetch(`/api/creatives?ad_account_id=${encodeURIComponent(selectedAccountId)}&limit=50`)
      const d = await res.json()
      if (!res.ok || d.error) throw new Error(d.error || "Failed to load media")
      setCreatives(d.creatives || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load media")
    } finally {
      setLoading(false)
    }
  }, [selectedAccountId])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const portal = creatives.filter(c => c.storage_path?.includes("creative-portal")).length
    const local = creatives.length - portal
    const ready = creatives.filter(c => !!(c.fb_image_hash || c.fb_video_id)).length
    const processing = creatives.filter(c => c.status === "processing" || c.status === "pending").length
    return { total: creatives.length, portal, local, ready, processing }
  }, [creatives])

  const onSync = async () => {
    // Creative Portal writes approved assets directly into ads_launcher.creatives (handoff).
    // "Sync Latest" re-fetches the current view from DB; storage_path is source of truth for origin.
    setSyncing(true)
    await load()
    setLastSync(new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }))
    setSyncing(false)
  }

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-[1400px] px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Media Control</h1>
            <p className="mt-1 text-sm text-muted-foreground">
Review media assets by Ad Account. Sync all media from Creative Portal here, then select assets to promote to the Media Library.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" disabled title="Brokered via Creative Portal — pending API (TechPlan §4)">
              <IconUpload className="size-4" /> Upload Custom
            </Button>
            <Button variant="outline" className="gap-2" disabled={selected.size === 0} title={selected.size === 0 ? "Select assets first" : "Promote selected assets to the Media Library"}>
              <IconCheck className="size-4" /> Add to Media Library ({selected.size})
            </Button>
            <Button className="gap-2" onClick={onSync} disabled={syncing || !selectedAccountId}>
              {syncing
                ? <><IconLoader2 className="size-4 animate-spin" /> Syncing…</>
                : <><IconRefresh className="size-4" /> Sync Latest</>}
            </Button>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Ad Account</label>
            <div className="relative">
              <select
                value={selectedAccountId || ""}
                onChange={e => setSelectedAccountId?.(e.target.value)}
                className="h-10 w-full appearance-none rounded-lg border border-input bg-background pl-3 pr-9 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Select Ad Account —</option>
                {adAccounts?.map((a: { id: string; name?: string; account_id?: string }) => (
                  <option key={a.id} value={a.id}>{a.name || a.account_id || a.id}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" className="gap-2 h-10" onClick={load} disabled={loading || !selectedAccountId}>
              <IconRefresh className={cn("size-4", loading && "animate-spin")} /> Refresh
            </Button>
          </div>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Total assets" value={stats.total} />
          <Tile label="From Portal" value={stats.portal} className="text-primary" />
          <Tile label="Local fallback" value={stats.local} />
          <Tile label="Last sync" value={lastSync || "—"} small />
        </div>

        {/* Error */}
        {error && (
          <DismissibleBanner onDismiss={() => setError("")}>
            <span className="flex items-start gap-2">
              <IconAlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
            </span>
          </DismissibleBanner>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-[40px] px-4 py-3 font-medium"></th>
                <th className="w-[88px] px-4 py-3 font-medium">Preview</th>
                <th className="px-4 py-3 font-medium">File name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><IconLoader2 className="mx-auto size-5 animate-spin" /></td></tr>
              ) : creatives.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <IconPhoto className="mx-auto size-8 text-muted-foreground/30" />
                    <p className="mt-2 text-sm font-medium">No media yet</p>
                    <p className="text-xs text-muted-foreground">{selectedAccountId ? "Sync from Creative Portal or upload custom to get started." : "Select an Ad Account to view media."}</p>
                  </td>
                </tr>
              ) : creatives.map(c => {
                const isPortal = c.storage_path?.includes("creative-portal")
                const isReady = !!(c.fb_image_hash || c.fb_video_id)
                return (
                  <tr key={c.id} className={cn("hover:bg-muted/20", selected.has(c.id) && "bg-primary/5")}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelected(c.id)}
                        aria-label={`Select ${c.file_name}`}
                        className="size-4 rounded border-input accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="grid size-14 place-items-center overflow-hidden rounded-md bg-muted">
                        <CreativeCardMedia creative={c} className="h-full w-full object-cover" compact />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium truncate max-w-[280px]">{c.file_name}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[280px]">{c.id}</div>
                    </td>
                    <td className="px-4 py-3 capitalize">{c.media_type}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                        isPortal ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground")}>
                        {isPortal ? "Portal" : "Local"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                        isReady ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : c.status === "error" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400")}>
                        {isReady ? <><IconCheck className="size-3" /> Ready</> : c.status === "error" ? <><IconExclamationCircle className="size-3" /> Error</> : "Processing"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(c.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            <span>Showing {creatives.length} asset{creatives.length !== 1 ? "s" : ""}</span>
            {lastSync && <span>Last sync: {lastSync}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function Tile({ label, value, className, small }: { label: string; value: number | string; className?: string; small?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-bold", small ? "text-sm" : "text-2xl", className)}>{value}</p>
    </div>
  )
}
