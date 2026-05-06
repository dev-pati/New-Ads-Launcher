"use client"

import { useState, useEffect, useRef } from "react"
import { useAdAccount } from "@/lib/ad-account-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  IconSearch,
  IconUpload,
  IconFolder,
  IconRefresh,
  IconLoader2,
  IconPhoto,
  IconVideo,
  IconLayoutGrid,
  IconList,
  IconFilter,
  IconChevronDown,
  IconPlus,
  IconCheck,
  IconDotsVertical,
  IconPlayerPlay,
  IconCalendar,
  IconUser,
  IconTag,
  IconX,
} from "@tabler/icons-react"

interface Creative {
  id: string
  file_name: string
  file_url: string
  media_type: "image" | "video"
  headline?: string
  primary_text?: string
  cta?: string
  link_url?: string
  fb_image_url?: string
  fb_thumbnail_url?: string
  fb_image_hash?: string
  fb_video_id?: string
  created_at?: string
}

type ViewMode = "grid" | "list"
type SubTab = "all" | "boards" | "my-uploads"

const STATUS_FILTERS = ["All", "Not Launched", "Launched", "Processing"]

export default function AssetsPage() {
  const { selectedAccountId } = useAdAccount()
  const [subTab, setSubTab] = useState<SubTab>("all")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!selectedAccountId) return
    setLoading(true)
    fetch(`/api/creatives?ad_account_id=${encodeURIComponent(selectedAccountId)}`)
      .then(r => r.json())
      .then(d => setCreatives(d.creatives || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedAccountId])

  const filtered = creatives.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q || c.file_name.toLowerCase().includes(q)
    const isLaunched = !!(c.fb_image_hash || c.fb_video_id)
    const matchStatus =
      statusFilter === "All" ? true :
      statusFilter === "Launched" ? isLaunched :
      statusFilter === "Not Launched" ? !isLaunched :
      true
    return matchSearch && matchStatus
  })

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div>
          <h1 className="font-heading text-xl font-bold">Assets</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filtered.length} asset{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          )}
          <Button size="sm" className="gap-1.5 h-8">
            <IconUpload className="size-3.5" />
            Upload
          </Button>
        </div>
      </div>

      {/* Sub tabs */}
      <div className="flex items-center gap-0 px-6 border-b shrink-0">
        {[
          { id: "all", label: "All Assets" },
          { id: "boards", label: "Boards" },
          { id: "my-uploads", label: "My Uploads" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id as SubTab)}
            className={cn(
              "px-0 py-3 mr-6 text-sm border-b-2 transition-colors",
              subTab === t.id
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b shrink-0">
        <div className="relative flex-1 max-w-sm">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, smart tag or ID..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-muted/40 border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <IconX className="size-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5">
          {["Status", "File Type", "Dimensions", "Date added"].map(f => (
            <Button key={f} variant="outline" size="sm" className="h-8 text-xs gap-1 text-muted-foreground">
              {f} <IconChevronDown className="size-3" />
            </Button>
          ))}
        </div>

        {/* View toggle */}
        <div className="ml-auto flex items-center gap-1 border rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("grid")}
            className={cn("p-1.5 rounded transition-colors", viewMode === "grid" ? "bg-muted" : "text-muted-foreground hover:text-foreground")}
          >
            <IconLayoutGrid className="size-3.5" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn("p-1.5 rounded transition-colors", viewMode === "list" ? "bg-muted" : "text-muted-foreground hover:text-foreground")}
          >
            <IconList className="size-3.5" />
          </button>
        </div>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
          <IconRefresh className="size-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center">
              <IconPhoto className="size-7 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-sm font-medium">No assets found</p>
              <p className="text-xs text-muted-foreground mt-1">Upload your first creative to get started</p>
            </div>
            <Button size="sm" className="gap-1.5">
              <IconUpload className="size-3.5" />
              Upload Media
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map(c => {
              const isSelected = selected.has(c.id)
              const isReady = !!(c.fb_image_hash || c.fb_video_id)
              const thumb = c.media_type === "video" ? c.fb_thumbnail_url : (c.fb_image_url || c.file_url)
              return (
                <div
                  key={c.id}
                  className={cn(
                    "group relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all",
                    isSelected ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-muted-foreground/20"
                  )}
                  onClick={() => toggleSelect(c.id)}
                >
                  {thumb ? (
                    <img src={thumb} alt={c.file_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      {c.media_type === "video"
                        ? <IconVideo className="size-8 text-muted-foreground/30" />
                        : <IconPhoto className="size-8 text-muted-foreground/30" />
                      }
                    </div>
                  )}

                  {/* Select indicator */}
                  <div className={cn(
                    "absolute top-2 left-2 size-5 rounded-full border-2 flex items-center justify-center transition-all",
                    isSelected
                      ? "bg-primary border-primary"
                      : "bg-background/80 border-muted-foreground/30 opacity-0 group-hover:opacity-100"
                  )}>
                    {isSelected && <IconCheck className="size-3 text-primary-foreground" />}
                  </div>

                  {/* Video indicator */}
                  {c.media_type === "video" && (
                    <div className="absolute bottom-2 left-2 size-5 rounded-full bg-black/60 flex items-center justify-center">
                      <IconPlayerPlay className="size-2.5 text-white" />
                    </div>
                  )}

                  {/* Status badge */}
                  <div className={cn(
                    "absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full font-semibold",
                    isReady
                      ? "bg-green-500/90 text-white"
                      : "bg-muted/90 text-muted-foreground"
                  )}>
                    {isReady ? "Ready" : "Pending"}
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>
              )
            })}
          </div>
        ) : (
          /* List view */
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="w-8 px-4 py-3"></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">NAME</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">DIMENSIONS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">TYPE</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">STATUS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">DATE ADDED</th>
                  <th className="w-8 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const isSelected = selected.has(c.id)
                  const isReady = !!(c.fb_image_hash || c.fb_video_id)
                  const thumb = c.media_type === "video" ? c.fb_thumbnail_url : (c.fb_image_url || c.file_url)
                  return (
                    <tr
                      key={c.id}
                      className={cn("border-b hover:bg-muted/30 cursor-pointer", isSelected && "bg-primary/5")}
                      onClick={() => toggleSelect(c.id)}
                    >
                      <td className="px-4 py-2.5">
                        <div className={cn(
                          "size-5 rounded border-2 flex items-center justify-center",
                          isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                        )}>
                          {isSelected && <IconCheck className="size-3 text-primary-foreground" />}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-lg overflow-hidden bg-muted shrink-0">
                            {thumb
                              ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center">
                                  {c.media_type === "video" ? <IconVideo className="size-4 text-muted-foreground/40" /> : <IconPhoto className="size-4 text-muted-foreground/40" />}
                                </div>
                            }
                          </div>
                          <span className="text-sm font-medium truncate max-w-[200px]">{c.file_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">1:1</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground capitalize">{c.media_type}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-medium",
                          isReady ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"
                        )}>
                          {isReady ? "Ready" : "Not Launched"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Button variant="ghost" size="icon" className="size-6" onClick={e => e.stopPropagation()}>
                          <IconDotsVertical className="size-3.5 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-4 py-2 text-xs text-muted-foreground border-t">
              {filtered.length} of {creatives.length} row(s).
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
