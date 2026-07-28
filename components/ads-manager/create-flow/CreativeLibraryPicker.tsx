"use client"

import { useEffect, useState } from "react"
import { IconLoader2, IconPhoto, IconUpload, IconVideo, IconX } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { CreativeAssetOption } from "./types"

interface Props {
  open: boolean
  onClose: () => void
  adAccountId?: string
  onPick: (creative: CreativeAssetOption) => void
  /** pass-through upload handler so the picker can upload then immediately select */
  onUploadFile?: (file: File) => Promise<CreativeAssetOption | null>
}

// Minimal "Load media" picker — reuses the same /api/creatives library as Ad Launcher,
// without the full Google Drive / existing-ads surface. Single-select.
export function CreativeLibraryPicker({ open, onClose, adAccountId, onPick, onUploadFile }: Props) {
  const [items, setItems] = useState<CreativeAssetOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError("")
    const params = new URLSearchParams({ limit: "100" })
    if (adAccountId) params.set("ad_account_id", adAccountId)
    fetch(`/api/creatives?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (!Array.isArray(d.creatives)) {
          setError(d.error || "Failed to load media")
          setItems([])
        } else {
          setItems(d.creatives as CreativeAssetOption[])
        }
      })
      .catch(() => !cancelled && setError("Failed to load media"))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open, adAccountId])

  const filtered = search
    ? items.filter((c) => c.file_name?.toLowerCase().includes(search.toLowerCase()))
    : items

  const handleUpload = async (file: File | null) => {
    if (!file || !onUploadFile) return
    setUploading(true)
    setError("")
    try {
      const creative = await onUploadFile(file)
      if (creative) {
        setItems((prev) => [creative, ...prev.filter((c) => c.id !== creative.id)])
        onPick(creative)
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const previewUrl = (c: CreativeAssetOption) =>
    c.media_type === "video"
      ? c.fb_thumbnail_url || c.file_url || ""
      : c.fb_thumbnail_url || c.fb_image_url || c.file_url || ""

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Load media</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search media..."
            className="h-9 flex-1 rounded border border-[#ccd0d5] bg-white px-3 text-xs outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
          />
          {onUploadFile && (
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded border border-dashed border-[#ccd0d5] bg-white px-3 text-xs font-medium hover:border-[#1877f2] hover:text-[#1877f2] dark:border-gray-700 dark:bg-background">
              <IconUpload className="size-4" />
              <span>{uploading ? "Uploading..." : "Upload new"}</span>
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  handleUpload(e.target.files?.[0] || null)
                  e.target.value = ""
                }}
              />
            </label>
          )}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
              <IconLoader2 className="size-4 animate-spin" /> Loading media...
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-xs text-muted-foreground">
              No media yet. Upload a file to get started.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {filtered.map((c) => {
                const url = previewUrl(c)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onPick(c)
                      onClose()
                    }}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-[#e4e6eb] bg-muted/30 transition-colors hover:border-[#1877f2] dark:border-gray-800"
                    title={c.file_name}
                  >
                    {url ? (
                      c.media_type === "video" ? (
                        <video
                          src={url}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={c.file_name} className="h-full w-full object-cover" />
                      )
                    ) : c.media_type === "video" ? (
                      <div className="flex h-full items-center justify-center">
                        <IconVideo className="size-6 text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <IconPhoto className="size-6 text-muted-foreground" />
                      </div>
                    )}
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100">
                      {c.file_name}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            <IconX className="mr-1.5 size-4" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
