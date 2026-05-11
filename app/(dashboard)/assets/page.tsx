"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAdAccount } from "@/lib/ad-account-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  IconSearch, IconUpload, IconFolder, IconFolderPlus, IconRefresh,
  IconLoader2, IconPhoto, IconVideo, IconLayoutGrid, IconList,
  IconChevronDown, IconPlus, IconCheck, IconDotsVertical,
  IconPlayerPlay, IconX, IconTrash, IconPencil, IconArrowLeft,
  IconClipboardList, IconUser, IconAlertCircle, IconCircleCheck,
  IconClock, IconCloudUpload,
} from "@tabler/icons-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Creative {
  id: string
  user_id: string
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
  tags?: string[]
  created_at?: string
  ad_account_id?: string
}

interface Board {
  id: string
  name: string
  description?: string
  asset_count: number
  created_at: string
}

interface CreativeRequest {
  id: string
  title: string
  description?: string
  status: "open" | "in_progress" | "completed" | "cancelled"
  due_date?: string
  created_at: string
}

interface UploadItem {
  id: string
  file: File
  status: "pending" | "uploading" | "done" | "error"
  error?: string
}

type Section = "all" | "boards" | "requests" | "upload" | "my-uploads" | `board_${string}`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function thumbOf(c: Creative) {
  if (c.media_type === "video") return c.fb_thumbnail_url || null
  return c.fb_image_url || c.file_url || null
}

function formatDate(s?: string) {
  if (!s) return "—"
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const STATUS_COLORS: Record<CreativeRequest["status"], string> = {
  open:        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  completed:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled:   "bg-muted text-muted-foreground",
}
const STATUS_LABEL: Record<CreativeRequest["status"], string> = {
  open: "Open", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled",
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const { selectedAccountId, adAccounts } = useAdAccount()
  const [section, setSection]           = useState<Section>("all")
  const [viewMode, setViewMode]         = useState<"grid" | "list">("grid")
  const [creatives, setCreatives]       = useState<Creative[]>([])
  const [boardCreatives, setBoardCreatives] = useState<Creative[]>([])
  const [boards, setBoards]             = useState<Board[]>([])
  const [requests, setRequests]         = useState<CreativeRequest[]>([])
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const searchParams = useSearchParams()
  const [search, setSearch]             = useState(() => searchParams.get("q") || "")
  const [filterType, setFilterType]     = useState<"" | "image" | "video">("")
  const [filterStatus, setFilterStatus] = useState<"" | "ready" | "pending">("")
  const [loadingCreatives, setLoadingCreatives] = useState(true)
  const [loadingBoards, setLoadingBoards]       = useState(false)
  const [loadingRequests, setLoadingRequests]   = useState(false)
  const [loadingBoard, setLoadingBoard]         = useState(false)
  const [currentUserId, setCurrentUserId]       = useState<string | null>(null)

  // Upload state
  const [uploadItems, setUploadItems]   = useState<UploadItem[]>([])
  const [isDragging, setIsDragging]     = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Dialog state
  const [createBoardOpen, setCreateBoardOpen]     = useState(false)
  const [boardName, setBoardName]                 = useState("")
  const [boardDesc, setBoardDesc]                 = useState("")
  const [savingBoard, setSavingBoard]             = useState(false)

  const [createReqOpen, setCreateReqOpen]         = useState(false)
  const [reqTitle, setReqTitle]                   = useState("")
  const [reqDesc, setReqDesc]                     = useState("")
  const [reqDue, setReqDue]                       = useState("")
  const [savingReq, setSavingReq]                 = useState(false)

  const [deleteConfirm, setDeleteConfirm]         = useState<{ type: "creative" | "board" | "request"; id: string; name: string } | null>(null)
  const [deleting, setDeleting]                   = useState(false)

  const [addToBoardOpen, setAddToBoardOpen]       = useState(false)
  const [addingToBoard, setAddingToBoard]         = useState<string | null>(null)
  const [contextMenu, setContextMenu]             = useState<{ id: string; x: number; y: number } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // Saved searches (localStorage)
  const [savedSearches, setSavedSearches]         = useState<{ label: string; query: string }[]>([])

  const currentBoardId = section.startsWith("board_") ? section.slice(6) : null
  const currentBoard   = boards.find(b => b.id === currentBoardId)

  // ── Load helpers ──────────────────────────────────────────────────────────

  const loadCreatives = useCallback(() => {
    if (!selectedAccountId) { setLoadingCreatives(false); return }
    setLoadingCreatives(true)
    fetch(`/api/creatives?ad_account_id=${encodeURIComponent(selectedAccountId)}`)
      .then(r => r.json())
      .then(d => setCreatives(d.creatives || []))
      .catch(() => {})
      .finally(() => setLoadingCreatives(false))
  }, [selectedAccountId])

  const loadBoards = useCallback(() => {
    setLoadingBoards(true)
    fetch("/api/assets/boards")
      .then(r => r.json())
      .then(d => setBoards(d.boards || []))
      .catch(() => {})
      .finally(() => setLoadingBoards(false))
  }, [])

  const loadRequests = useCallback(() => {
    setLoadingRequests(true)
    fetch("/api/assets/requests")
      .then(r => r.json())
      .then(d => setRequests(d.requests || []))
      .catch(() => {})
      .finally(() => setLoadingRequests(false))
  }, [])

  const loadBoardCreatives = useCallback((boardId: string) => {
    setLoadingBoard(true)
    fetch(`/api/assets/boards/${boardId}`)
      .then(r => r.json())
      .then(d => setBoardCreatives(d.creatives || []))
      .catch(() => {})
      .finally(() => setLoadingBoard(false))
  }, [])

  // ── Initial loads ─────────────────────────────────────────────────────────

  useEffect(() => { loadCreatives() }, [loadCreatives])
  useEffect(() => { loadBoards() }, [loadBoards])

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null))
    const stored = localStorage.getItem("assets_saved_searches")
    if (stored) setSavedSearches(JSON.parse(stored))
  }, [])

  useEffect(() => {
    if (section === "requests" && requests.length === 0) loadRequests()
  }, [section, requests.length, loadRequests])

  useEffect(() => {
    if (currentBoardId) loadBoardCreatives(currentBoardId)
  }, [currentBoardId, loadBoardCreatives])

  // Close context menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filterCreatives = (list: Creative[]) => {
    const q = search.toLowerCase()
    return list.filter(c => {
      if (q && !c.file_name.toLowerCase().includes(q)) return false
      if (filterType && c.media_type !== filterType) return false
      if (filterStatus === "ready" && !(c.fb_image_hash || c.fb_video_id)) return false
      if (filterStatus === "pending" && !!(c.fb_image_hash || c.fb_video_id)) return false
      return true
    })
  }

  const displayList = (() => {
    if (section === "my-uploads") return filterCreatives(creatives.filter(c => c.user_id === currentUserId))
    if (currentBoardId) return filterCreatives(boardCreatives)
    return filterCreatives(creatives)
  })()

  const adAccountName = adAccounts?.find((a: any) => a.id === selectedAccountId)?.name || selectedAccountId || "—"

  // ── Selection ─────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const selectAll = () => setSelected(new Set(displayList.map(c => c.id)))
  const clearSelected = () => setSelected(new Set())

  // ── CRUD: Board ───────────────────────────────────────────────────────────

  const handleCreateBoard = async () => {
    if (!boardName.trim()) return
    setSavingBoard(true)
    const res = await fetch("/api/assets/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: boardName.trim(), description: boardDesc }),
    })
    const d = await res.json()
    if (d.board) setBoards(prev => [d.board, ...prev])
    setBoardName(""); setBoardDesc(""); setCreateBoardOpen(false); setSavingBoard(false)
  }

  const handleAddToBoard = async (boardId: string) => {
    if (selected.size === 0) return
    setAddingToBoard(boardId)
    await fetch(`/api/assets/boards/${boardId}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creative_ids: Array.from(selected) }),
    })
    setAddingToBoard(null)
    setAddToBoardOpen(false)
    clearSelected()
    loadBoards()
    if (currentBoardId === boardId) loadBoardCreatives(boardId)
  }

  const handleRemoveFromBoard = async (creativeId: string) => {
    if (!currentBoardId) return
    await fetch(`/api/assets/boards/${currentBoardId}/assets?creative_id=${creativeId}`, { method: "DELETE" })
    setBoardCreatives(prev => prev.filter(c => c.id !== creativeId))
    loadBoards()
  }

  // ── CRUD: Request ─────────────────────────────────────────────────────────

  const handleCreateRequest = async () => {
    if (!reqTitle.trim()) return
    setSavingReq(true)
    const res = await fetch("/api/assets/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: reqTitle.trim(), description: reqDesc, due_date: reqDue || null }),
    })
    const d = await res.json()
    if (d.request) setRequests(prev => [d.request, ...prev])
    setReqTitle(""); setReqDesc(""); setReqDue(""); setCreateReqOpen(false); setSavingReq(false)
  }

  const handleUpdateRequestStatus = async (id: string, status: CreativeRequest["status"]) => {
    await fetch(`/api/assets/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    const { type, id } = deleteConfirm
    if (type === "creative") {
      await fetch(`/api/creatives/${id}`, { method: "DELETE" })
      setCreatives(prev => prev.filter(c => c.id !== id))
      setBoardCreatives(prev => prev.filter(c => c.id !== id))
    } else if (type === "board") {
      await fetch(`/api/assets/boards/${id}`, { method: "DELETE" })
      setBoards(prev => prev.filter(b => b.id !== id))
      if (currentBoardId === id) setSection("all")
    } else if (type === "request") {
      await fetch(`/api/assets/requests/${id}`, { method: "DELETE" })
      setRequests(prev => prev.filter(r => r.id !== id))
    }
    setDeleting(false)
    setDeleteConfirm(null)
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  const ACCEPTED = "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/x-msvideo,video/webm"

  const processFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => ACCEPTED.split(",").some(t => f.type === t || f.type.startsWith(t.split("/")[0] + "/")))
    const items: UploadItem[] = arr.map(f => ({ id: crypto.randomUUID(), file: f, status: "pending" }))
    setUploadItems(prev => [...prev, ...items])
    items.forEach(item => uploadFile(item))
  }

  const uploadFile = async (item: UploadItem) => {
    if (!selectedAccountId) {
      setUploadItems(prev => prev.map(i => i.id === item.id ? { ...i, status: "error", error: "No ad account selected" } : i))
      return
    }
    setUploadItems(prev => prev.map(i => i.id === item.id ? { ...i, status: "uploading" } : i))
    try {
      const params = new URLSearchParams({
        filename: item.file.name,
        type: item.file.type,
        size: String(item.file.size),
        ad_account_id: selectedAccountId,
      })
      const res = await fetch(`/api/creatives/upload-binary?${params}`, {
        method: "POST",
        headers: { "Content-Type": item.file.type },
        body: item.file,
      })
      const d = await res.json()
      if (d.creative) {
        setCreatives(prev => [d.creative, ...prev])
        setUploadItems(prev => prev.map(i => i.id === item.id ? { ...i, status: "done" } : i))
      } else {
        setUploadItems(prev => prev.map(i => i.id === item.id ? { ...i, status: "error", error: d.error || "Upload failed" } : i))
      }
    } catch (e: any) {
      setUploadItems(prev => prev.map(i => i.id === item.id ? { ...i, status: "error", error: e.message } : i))
    }
  }

  // ── Saved searches ────────────────────────────────────────────────────────

  const saveSearch = () => {
    if (!search.trim()) return
    const next = [{ label: search, query: search }, ...savedSearches.filter(s => s.query !== search)].slice(0, 5)
    setSavedSearches(next)
    localStorage.setItem("assets_saved_searches", JSON.stringify(next))
  }

  const removeSavedSearch = (query: string) => {
    const next = savedSearches.filter(s => s.query !== query)
    setSavedSearches(next)
    localStorage.setItem("assets_saved_searches", JSON.stringify(next))
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const isAssetSection = section === "all" || section === "my-uploads" || !!currentBoardId

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-52 border-r flex flex-col shrink-0 overflow-y-auto bg-sidebar">
        <div className="p-3 space-y-0.5">
          {([
            { id: "all",        icon: IconLayoutGrid,    label: "All Assets",   count: creatives.length },
            { id: "boards",     icon: IconFolder,        label: "Boards",       count: boards.length },
            { id: "requests",   icon: IconClipboardList, label: "Requests",     count: requests.filter(r => r.status === "open").length || undefined },
            { id: "upload",     icon: IconUpload,        label: "Upload" },
            { id: "my-uploads", icon: IconUser,          label: "My Uploads" },
          ] as { id: Section; icon: any; label: string; count?: number }[]).map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={cn(
                "flex items-center gap-2.5 w-full px-2.5 py-2 text-sm rounded-md transition-colors",
                section === item.id
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
                <span className="text-[10px] bg-muted/80 text-muted-foreground rounded-full px-1.5 py-0.5 leading-none">
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Saved Searches */}
        <div className="px-4 mt-3">
          <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1.5">Saved Searches</p>
          {savedSearches.length === 0 ? (
            <p className="text-xs text-muted-foreground/40 py-1">No saved searches yet</p>
          ) : savedSearches.map(s => (
            <div key={s.query} className="flex items-center gap-1 group">
              <button
                onClick={() => { setSection("all"); setSearch(s.query) }}
                className="flex-1 text-xs text-left py-1 text-muted-foreground hover:text-foreground truncate"
              >
                {s.label}
              </button>
              <button onClick={() => removeSavedSearch(s.query)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                <IconX className="size-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Boards list */}
        <div className="px-4 mt-4 flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Boards</p>
            <button onClick={() => setCreateBoardOpen(true)} className="text-muted-foreground hover:text-foreground">
              <IconPlus className="size-3.5" />
            </button>
          </div>
          {loadingBoards ? (
            <div className="py-1"><IconLoader2 className="size-3.5 animate-spin text-muted-foreground/40" /></div>
          ) : boards.length === 0 ? (
            <p className="text-xs text-muted-foreground/40 py-1">No boards yet</p>
          ) : boards.map(b => (
            <button
              key={b.id}
              onClick={() => setSection(`board_${b.id}` as Section)}
              className={cn(
                "flex items-center gap-2 w-full py-1.5 text-xs rounded transition-colors group",
                section === `board_${b.id}` ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <IconFolder className="size-3.5 shrink-0" />
              <span className="flex-1 text-left truncate">{b.name}</span>
              <span className="text-[10px] opacity-60">{b.asset_count}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Upload Section ─────────────────────────────────────────────── */}
        {section === "upload" && (
          <div className="flex-1 overflow-auto p-8">
            <div className="max-w-2xl mx-auto">
              <h1 className="text-3xl font-bold text-center mb-2">Upload Your Videos or Images</h1>
              <p className="text-sm text-muted-foreground text-center mb-8">
                Uploading to <span className="text-foreground font-medium">{adAccountName}</span>
              </p>

              {!selectedAccountId && (
                <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                  <IconAlertCircle className="size-4 shrink-0" />
                  Select an ad account in the sidebar before uploading.
                </div>
              )}

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => {
                  e.preventDefault(); setIsDragging(false)
                  if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files)
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors",
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/20"
                )}
              >
                <IconCloudUpload className="size-10 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-sm text-muted-foreground">
                  Drag & drop or{" "}
                  <span className="text-primary font-medium underline underline-offset-2">upload files</span>
                </p>
                <input ref={fileInputRef} type="file" accept={ACCEPTED} multiple className="hidden"
                  onChange={e => { if (e.target.files) processFiles(e.target.files) }} />
              </div>

              <p className="text-xs text-muted-foreground text-center mt-3">
                <span className="font-medium">Supported:</span> jpg, jpeg, png, gif, webp, mp4, mov, avi, webm
              </p>

              {/* Upload queue */}
              {uploadItems.length > 0 && (
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{uploadItems.length} file{uploadItems.length > 1 ? "s" : ""}</p>
                    <button onClick={() => setUploadItems([])} className="text-xs text-muted-foreground hover:text-foreground">Clear all</button>
                  </div>
                  {uploadItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                      <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        {item.file.type.startsWith("video/") ? <IconVideo className="size-4 text-muted-foreground/50" /> : <IconPhoto className="size-4 text-muted-foreground/50" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(item.file.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                      <div className="shrink-0">
                        {item.status === "pending"   && <IconClock className="size-4 text-muted-foreground/40" />}
                        {item.status === "uploading" && <IconLoader2 className="size-4 animate-spin text-primary" />}
                        {item.status === "done"      && <IconCircleCheck className="size-4 text-emerald-500" />}
                        {item.status === "error"     && (
                          <div className="flex items-center gap-1">
                            <IconAlertCircle className="size-4 text-destructive" />
                            <span className="text-xs text-destructive">{item.error}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {uploadItems.every(i => i.status === "done" || i.status === "error") && (
                    <Button size="sm" className="w-full mt-2" onClick={() => { setSection("all"); setUploadItems([]) }}>
                      View All Assets
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Boards Section ─────────────────────────────────────────────── */}
        {section === "boards" && (
          <div className="flex-1 overflow-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Boards</h2>
              <Button size="sm" onClick={() => setCreateBoardOpen(true)}>
                <IconPlus className="size-4" /> New Board
              </Button>
            </div>

            {loadingBoards ? (
              <div className="flex items-center justify-center h-48">
                <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : boards.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <IconFolder className="size-8 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="font-medium">No boards yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Create a board to organize your assets</p>
                </div>
                <Button onClick={() => setCreateBoardOpen(true)}>
                  <IconPlus className="size-4" /> Create Board
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {boards.map(b => (
                  <div
                    key={b.id}
                    className="group relative rounded-xl border bg-card hover:shadow-md transition-all cursor-pointer overflow-hidden"
                    onClick={() => setSection(`board_${b.id}` as Section)}
                  >
                    <div className="aspect-video bg-muted/40 flex items-center justify-center">
                      <IconFolder className="size-10 text-muted-foreground/20" />
                    </div>
                    <div className="p-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{b.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{b.asset_count} asset{b.asset_count !== 1 ? "s" : ""}</p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteConfirm({ type: "board", id: b.id, name: b.name }) }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <IconTrash className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Requests Section ───────────────────────────────────────────── */}
        {section === "requests" && (
          <div className="flex-1 overflow-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">Creative Requests</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {requests.filter(r => r.status === "open").length} open request{requests.filter(r => r.status === "open").length !== 1 ? "s" : ""}
                </p>
              </div>
              <Button size="sm" onClick={() => setCreateReqOpen(true)}>
                <IconPlus className="size-4" /> New Request
              </Button>
            </div>

            {loadingRequests ? (
              <div className="flex items-center justify-center h-48">
                <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <IconClipboardList className="size-8 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="font-medium">No creative requests yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Create a request to assign creative work to team members.</p>
                </div>
                <Button onClick={() => setCreateReqOpen(true)}>
                  <IconPlus className="size-4" /> New Request
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map(r => (
                  <div key={r.id} className="group flex items-start gap-4 p-4 rounded-xl border bg-card hover:shadow-sm transition-all">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{r.title}</p>
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[r.status])}>
                          {STATUS_LABEL[r.status]}
                        </span>
                      </div>
                      {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
                      <p className="text-xs text-muted-foreground/60 mt-1.5">
                        Created {formatDate(r.created_at)}
                        {r.due_date && <> · Due {formatDate(r.due_date)}</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Status cycle button */}
                      {r.status !== "completed" && r.status !== "cancelled" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handleUpdateRequestStatus(r.id, r.status === "open" ? "in_progress" : "completed")}
                        >
                          {r.status === "open" ? "Start" : "Complete"}
                        </Button>
                      )}
                      <button
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                        onClick={() => setDeleteConfirm({ type: "request", id: r.id, name: r.title })}
                      >
                        <IconTrash className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Asset Grid (All / My Uploads / Board) ──────────────────────── */}
        {isAssetSection && (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
              {currentBoardId && (
                <button
                  onClick={() => setSection("boards")}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mr-1"
                >
                  <IconArrowLeft className="size-4" />
                </button>
              )}

              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/40" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveSearch()}
                  placeholder="Search by name, smart tag or ID..."
                  className="w-full pl-9 pr-8 py-2 text-sm bg-muted/40 border rounded-lg outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <IconX className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Filters */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Type */}
                <div className="relative group">
                  <button className={cn(
                    "flex items-center gap-1 h-8 px-3 text-xs rounded-lg border transition-colors",
                    filterType ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground hover:text-foreground"
                  )}>
                    Type {filterType ? `: ${filterType}` : ""} <IconChevronDown className="size-3" />
                  </button>
                  <div className="absolute top-full left-0 mt-1 z-20 bg-popover border rounded-lg shadow-md p-1 min-w-[120px] hidden group-hover:block">
                    {(["", "image", "video"] as const).map(v => (
                      <button key={v} onClick={() => setFilterType(v)}
                        className={cn("w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted flex items-center gap-2",
                          filterType === v && "text-primary"
                        )}>
                        {filterType === v && <IconCheck className="size-3" />}
                        {v === "" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className="relative group">
                  <button className={cn(
                    "flex items-center gap-1 h-8 px-3 text-xs rounded-lg border transition-colors",
                    filterStatus ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground hover:text-foreground"
                  )}>
                    Status {filterStatus ? `: ${filterStatus}` : ""} <IconChevronDown className="size-3" />
                  </button>
                  <div className="absolute top-full left-0 mt-1 z-20 bg-popover border rounded-lg shadow-md p-1 min-w-[120px] hidden group-hover:block">
                    {(["", "ready", "pending"] as const).map(v => (
                      <button key={v} onClick={() => setFilterStatus(v)}
                        className={cn("w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted flex items-center gap-2",
                          filterStatus === v && "text-primary"
                        )}>
                        {filterStatus === v && <IconCheck className="size-3" />}
                        {v === "" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {(filterType || filterStatus) && (
                  <button onClick={() => { setFilterType(""); setFilterStatus("") }}
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 border rounded-lg">
                    <IconX className="size-3" /> Clear
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="ml-auto flex items-center gap-2">
                {selected.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                    {!currentBoardId && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddToBoardOpen(true)}>
                        <IconFolderPlus className="size-3.5" /> Add to Board
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={clearSelected}>
                      Deselect
                    </Button>
                  </div>
                )}

                {selected.size === 0 && (
                  <button onClick={selectAll} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/50">
                    Select All
                  </button>
                )}

                <button onClick={loadCreatives} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50">
                  <IconRefresh className="size-4" />
                </button>

                {/* View toggle */}
                <div className="flex items-center border rounded-lg p-0.5">
                  <button onClick={() => setViewMode("grid")} className={cn("p-1.5 rounded transition-colors", viewMode === "grid" ? "bg-muted" : "text-muted-foreground hover:text-foreground")}>
                    <IconLayoutGrid className="size-3.5" />
                  </button>
                  <button onClick={() => setViewMode("list")} className={cn("p-1.5 rounded transition-colors", viewMode === "list" ? "bg-muted" : "text-muted-foreground hover:text-foreground")}>
                    <IconList className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Count bar */}
            <div className="px-4 py-2 text-xs text-muted-foreground border-b shrink-0 flex items-center justify-between">
              <span>
                {currentBoardId && currentBoard ? (
                  <span className="font-medium text-foreground">{currentBoard.name}</span>
                ) : section === "my-uploads" ? "My Uploads" : "All Assets"}
                {" — "}{displayList.length} of {currentBoardId ? boardCreatives.length : creatives.length} assets
              </span>
              {search && (
                <button onClick={saveSearch} className="text-primary hover:underline">Save search</button>
              )}
            </div>

            {/* Grid / List content */}
            <div className="flex-1 overflow-auto px-4 py-4">
              {(loadingCreatives || loadingBoard) ? (
                <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {[...Array(12)].map((_, i) => <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />)}
                </div>
              ) : displayList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <IconPhoto className="size-7 text-muted-foreground/30" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {search || filterType || filterStatus ? "No assets match the current filters" : "No assets found"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {search || filterType || filterStatus
                        ? "Clear the active filters to see all assets in this view."
                        : "Upload your first creative to get started."}
                    </p>
                  </div>
                  {(search || filterType || filterStatus) ? (
                    <Button size="sm" variant="outline" onClick={() => { setSearch(""); setFilterType(""); setFilterStatus("") }}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setSection("upload")}>
                      <IconUpload className="size-3.5" /> Upload Media
                    </Button>
                  )}
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {displayList.map(c => {
                    const isSelected = selected.has(c.id)
                    const isReady    = !!(c.fb_image_hash || c.fb_video_id)
                    const thumb      = thumbOf(c)
                    return (
                      <div
                        key={c.id}
                        className={cn(
                          "group relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all",
                          isSelected ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-muted-foreground/20"
                        )}
                        onClick={() => toggleSelect(c.id)}
                        onContextMenu={e => { e.preventDefault(); setContextMenu({ id: c.id, x: e.clientX, y: e.clientY }) }}
                      >
                        {thumb
                          ? <img src={thumb} alt={c.file_name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-muted flex items-center justify-center">
                              {c.media_type === "video"
                                ? <IconVideo className="size-8 text-muted-foreground/30" />
                                : <IconPhoto className="size-8 text-muted-foreground/30" />}
                            </div>
                        }
                        {/* Checkbox */}
                        <div className={cn(
                          "absolute top-2 left-2 size-5 rounded-full border-2 flex items-center justify-center transition-all",
                          isSelected ? "bg-primary border-primary" : "bg-background/80 border-muted-foreground/30 opacity-0 group-hover:opacity-100"
                        )}>
                          {isSelected && <IconCheck className="size-3 text-primary-foreground" />}
                        </div>
                        {/* Video indicator */}
                        {c.media_type === "video" && (
                          <div className="absolute bottom-2 left-2 size-5 rounded-full bg-black/60 flex items-center justify-center">
                            <IconPlayerPlay className="size-2.5 text-white" />
                          </div>
                        )}
                        {/* Status */}
                        <div className={cn(
                          "absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full font-semibold",
                          isReady ? "bg-emerald-500/90 text-white" : "bg-black/40 text-white/80"
                        )}>
                          {isReady ? "Ready" : "Pending"}
                        </div>
                        {/* Context menu trigger */}
                        <button
                          onClick={e => { e.stopPropagation(); setContextMenu({ id: c.id, x: e.clientX, y: e.clientY }) }}
                          className="absolute bottom-2 right-2 size-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <IconDotsVertical className="size-3 text-white" />
                        </button>
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
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
                        <th className="w-8 px-3 py-2.5">
                          <div
                            onClick={() => selected.size === displayList.length ? clearSelected() : selectAll()}
                            className={cn("size-4 rounded border cursor-pointer flex items-center justify-center",
                              selected.size === displayList.length ? "bg-primary border-primary" : "border-muted-foreground/30")}
                          >
                            {selected.size === displayList.length && <IconCheck className="size-2.5 text-primary-foreground" />}
                          </div>
                        </th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Date Added</th>
                        <th className="w-8 px-3 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayList.map(c => {
                        const isSelected = selected.has(c.id)
                        const isReady    = !!(c.fb_image_hash || c.fb_video_id)
                        const thumb      = thumbOf(c)
                        return (
                          <tr key={c.id} className={cn("border-b last:border-0 hover:bg-muted/20 cursor-pointer", isSelected && "bg-primary/5")} onClick={() => toggleSelect(c.id)}>
                            <td className="px-3 py-2.5">
                              <div className={cn("size-4 rounded border flex items-center justify-center", isSelected ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                                {isSelected && <IconCheck className="size-2.5 text-primary-foreground" />}
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-3">
                                <div className="size-9 rounded-lg overflow-hidden bg-muted shrink-0">
                                  {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      {c.media_type === "video" ? <IconVideo className="size-4 text-muted-foreground/30" /> : <IconPhoto className="size-4 text-muted-foreground/30" />}
                                    </div>
                                  )}
                                </div>
                                <span className="text-sm font-medium truncate max-w-[200px]">{c.file_name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground capitalize">{c.media_type}</td>
                            <td className="px-3 py-2.5">
                              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
                                isReady ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                              )}>
                                {isReady ? "Ready" : "Pending"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatDate(c.created_at)}</td>
                            <td className="px-3 py-2.5">
                              <button
                                onClick={e => { e.stopPropagation(); setContextMenu({ id: c.id, x: e.clientX, y: e.clientY }) }}
                                className="p-1 rounded hover:bg-muted text-muted-foreground"
                              >
                                <IconDotsVertical className="size-3.5" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div className="px-4 py-2 text-xs text-muted-foreground border-t bg-muted/10">
                    {displayList.length} row{displayList.length !== 1 ? "s" : ""}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Context Menu ─────────────────────────────────────────────────── */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-popover border rounded-lg shadow-lg py-1 min-w-[160px]"
        >
          {!currentBoardId ? (
            <>
              <button
                onClick={() => { setSelected(new Set([contextMenu.id])); setAddToBoardOpen(true); setContextMenu(null) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50"
              >
                <IconFolderPlus className="size-4 text-muted-foreground" /> Add to Board
              </button>
              <div className="h-px bg-border my-1" />
            </>
          ) : (
            <>
              <button
                onClick={() => { handleRemoveFromBoard(contextMenu.id); setContextMenu(null) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50"
              >
                <IconFolder className="size-4 text-muted-foreground" /> Remove from Board
              </button>
              <div className="h-px bg-border my-1" />
            </>
          )}
          <button
            onClick={() => {
              const c = creatives.find(x => x.id === contextMenu.id) || boardCreatives.find(x => x.id === contextMenu.id)
              setDeleteConfirm({ type: "creative", id: contextMenu.id, name: c?.file_name || "this asset" })
              setContextMenu(null)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
          >
            <IconTrash className="size-4" /> Delete
          </button>
        </div>
      )}

      {/* ── Add to Board Dialog ───────────────────────────────────────────── */}
      <Dialog open={addToBoardOpen} onOpenChange={setAddToBoardOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to Board</DialogTitle>
          </DialogHeader>
          {boards.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">No boards yet. Create one first.</p>
              <Button size="sm" onClick={() => { setAddToBoardOpen(false); setCreateBoardOpen(true) }}>
                <IconPlus className="size-4" /> Create Board
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5 py-2 max-h-64 overflow-y-auto">
              {boards.map(b => (
                <button
                  key={b.id}
                  onClick={() => handleAddToBoard(b.id)}
                  disabled={!!addingToBoard}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <IconFolder className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{b.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{b.asset_count}</span>
                    {addingToBoard === b.id && <IconLoader2 className="size-3.5 animate-spin" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Board Dialog ───────────────────────────────────────────── */}
      <Dialog open={createBoardOpen} onOpenChange={setCreateBoardOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create Board</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="board-name">Board Name</Label>
              <Input
                id="board-name"
                value={boardName}
                onChange={e => setBoardName(e.target.value)}
                placeholder="e.g. Summer Campaign"
                onKeyDown={e => e.key === "Enter" && handleCreateBoard()}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="board-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input id="board-desc" value={boardDesc} onChange={e => setBoardDesc(e.target.value)} placeholder="What's this board for?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateBoardOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateBoard} disabled={!boardName.trim() || savingBoard}>
              {savingBoard ? <IconLoader2 className="size-4 animate-spin" /> : <IconPlus className="size-4" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Request Dialog ─────────────────────────────────────────── */}
      <Dialog open={createReqOpen} onOpenChange={setCreateReqOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Creative Request</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="req-title">Title</Label>
              <Input
                id="req-title"
                value={reqTitle}
                onChange={e => setReqTitle(e.target.value)}
                placeholder="e.g. Product video for June sale"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <textarea
                id="req-desc"
                value={reqDesc}
                onChange={e => setReqDesc(e.target.value)}
                placeholder="Describe what you need..."
                rows={3}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none placeholder:text-muted-foreground/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-due">Due Date <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input id="req-due" type="date" value={reqDue} onChange={e => setReqDue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateReqOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateRequest} disabled={!reqTitle.trim() || savingReq}>
              {savingReq ? <IconLoader2 className="size-4 animate-spin" /> : <IconPlus className="size-4" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Delete {deleteConfirm?.type === "creative" ? "Asset" : deleteConfirm?.type === "board" ? "Board" : "Request"}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete <span className="font-medium text-foreground">"{deleteConfirm?.name}"</span>?
            {deleteConfirm?.type === "creative" && " This will also remove it from any boards."}
            {deleteConfirm?.type === "board" && " The assets inside will not be deleted."}
            {" "}This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <IconLoader2 className="size-4 animate-spin" /> : <IconTrash className="size-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
