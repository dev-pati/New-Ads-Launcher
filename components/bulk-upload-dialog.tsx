"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  IconUpload, IconLoader2, IconCheck, IconVideo,
  IconDownload, IconCopy, IconGripVertical,
} from "@tabler/icons-react"

interface PendingRow {
  id: string
  file: File
  previewUrl: string
  headline: string
  primary_text: string
  description: string
  cta: string
  link_url: string
  status: "pending" | "uploading" | "done" | "error"
  error?: string
}

interface Props {
  open: boolean
  onClose: () => void
  files: File[]
  ctaOptions: { value: string; label: string }[]
  pageLinks: { id: string; name: string; url: string }[]
  defaultPageUrl: string
  onComplete: (creatives: any[]) => void
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else field += ch
    } else {
      if (ch === '"' && field === "") inQuotes = true
      else if (ch === ",") { row.push(field); field = "" }
      else if (ch === "\n" || ch === "\r") {
        row.push(field); field = ""
        if (row.some(c => c !== "")) rows.push(row)
        row = []
        if (ch === "\r" && text[i + 1] === "\n") i++
      } else field += ch
    }
  }
  row.push(field)
  if (row.some(c => c !== "")) rows.push(row)
  return rows
}

export function BulkUploadDialog({ open, onClose, files, ctaOptions, pageLinks, defaultPageUrl, onComplete }: Props) {
  const [rows, setRows] = useState<PendingRow[]>([])
  const [uploading, setUploading] = useState(false)
  const csvRef = useRef<HTMLInputElement>(null)
  const dragIdx = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  useEffect(() => {
    if (!open || !files.length) return
    const next: PendingRow[] = files.map((file, i) => ({
      id: `${i}-${file.name}-${file.size}`,
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
      headline: "",
      primary_text: "",
      description: "",
      cta: "LEARN_MORE",
      link_url: defaultPageUrl,
      status: "pending",
    }))
    setRows(next)
    return () => next.forEach(r => { if (r.previewUrl) URL.revokeObjectURL(r.previewUrl) })
  }, [open, files, defaultPageUrl])

  const update = (id: string, field: keyof PendingRow, value: string) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))

  const applyToAll = (field: "cta" | "link_url" | "headline" | "primary_text" | "description", value: string) =>
    setRows(prev => prev.map(r => ({ ...r, [field]: value })))

  const handleDragStart = (i: number) => { dragIdx.current = i }
  const handleDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOverIdx(i) }
  const handleDrop = (i: number) => {
    if (dragIdx.current === null || dragIdx.current === i) { setDragOverIdx(null); return }
    setRows(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIdx.current!, 1)
      next.splice(i, 0, moved)
      return next
    })
    dragIdx.current = null
    setDragOverIdx(null)
  }
  const handleDragEnd = () => { dragIdx.current = null; setDragOverIdx(null) }

  const copyFirstDown = () => {
    setRows(prev => {
      if (prev.length < 2) return prev
      const src = prev[0]
      return prev.map((r, i) => i === 0 ? r : {
        ...r,
        headline: src.headline,
        primary_text: src.primary_text,
        description: src.description,
        cta: src.cta,
        link_url: src.link_url,
      })
    })
  }

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const parsed = parseCSV(ev.target?.result as string)
      if (parsed.length < 2) return
      const headers = parsed[0].map(h => h.trim().toLowerCase().replace(/\s+/g, "_"))
      const dataRows = parsed.slice(1)
      const idx = (name: string) => headers.indexOf(name)
      const hasFilename = idx("file_name") !== -1 || idx("filename") !== -1

      setRows(prev => prev.map((row, i) => {
        let cols: string[] | undefined
        if (hasFilename) {
          const nameIdx = idx("file_name") !== -1 ? idx("file_name") : idx("filename")
          const match = dataRows.find(dr => dr[nameIdx]?.trim() === row.file.name)
          cols = match
        } else {
          cols = dataRows[i]
        }
        if (!cols) return row
        const get = (field: string) => { const j = idx(field); return j !== -1 ? (cols![j] || "").trim() : "" }
        return {
          ...row,
          headline: get("headline") || row.headline,
          primary_text: get("primary_text") || row.primary_text,
          description: get("description") || row.description,
          cta: get("cta") || row.cta,
          link_url: get("link_url") || row.link_url,
        }
      }))
    }
    reader.readAsText(file)
    if (csvRef.current) csvRef.current.value = ""
  }

  const downloadTemplate = () => {
    const header = "file_name,headline,primary_text,description,cta,link_url"
    const body = rows.map(r => `"${r.file.name}",,,,LEARN_MORE,`).join("\n")
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = "metadata_template.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  const handleUploadAll = async () => {
    setUploading(true)
    let credRes: Response
    try {
      // Find the adAccountId from localStorage since we don't have it in props
      const selectedId = localStorage.getItem("selected_ad_account_id") || ""
      const url = selectedId ? `/api/facebook/upload-credentials?adAccountId=${selectedId}` : "/api/facebook/upload-credentials"
      credRes = await fetch(url)
      if (!credRes.ok) throw new Error("Cannot get credentials")
    } catch (err: any) {
      setUploading(false)
      return
    }
    const { accessToken, adAccountId } = await credRes.json()
    const cleanId = adAccountId.replace(/^act_/, "")
    const completed: any[] = []

    for (const row of rows) {
      if (row.status === "done") continue
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: "uploading" } : r))
      try {
        const isVideo = row.file.type.startsWith("video/")
        let fbImageHash = null, fbImageUrl = null, fbThumbnailUrl = null, fbVideoId = null
        const metaForm = new FormData()

        if (isVideo) {
          metaForm.append("source", row.file)
          metaForm.append("title", row.file.name)
          const res = await fetch(
            `https://graph-video.facebook.com/v25.0/act_${cleanId}/advideos`,
            { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: metaForm }
          )
          const d = await res.json()
          if (d.error) throw new Error(d.error.message)
          fbVideoId = d.id
        } else {
          metaForm.append("filename", row.file)
          const res = await fetch(
            `https://graph.facebook.com/v25.0/act_${cleanId}/adimages`,
            { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: metaForm }
          )
          const d = await res.json()
          if (d.error) throw new Error(d.error.message)
          const imgVals = d.images ? Object.values(d.images) : []
          const img: any = imgVals.length > 0 ? imgVals[0] : null
          fbImageHash = img?.hash || null
          fbImageUrl = img?.url || null
          fbThumbnailUrl = img?.url_128 || img?.url || null
        }

        const dbRes = await fetch("/api/creatives", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_name: row.file.name,
            file_size: row.file.size,
            media_type: isVideo ? "video" : "image",
            headline: row.headline,
            primary_text: row.primary_text,
            description: row.description,
            cta: row.cta || "LEARN_MORE",
            link_url: row.link_url || "",
            fb_image_hash: fbImageHash,
            fb_image_url: fbImageUrl,
            fb_thumbnail_url: fbThumbnailUrl,
            fb_video_id: fbVideoId,
          }),
        })
        if (!dbRes.ok) throw new Error("Failed to save")
        const data = await dbRes.json()
        completed.push(data.creative)
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: "done" } : r))
      } catch (err: any) {
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: "error", error: err.message } : r))
      }
    }

    setUploading(false)
    if (completed.length > 0) onComplete(completed)
    if (completed.length === rows.length) setTimeout(onClose, 600)
  }

  const doneCount = rows.filter(r => r.status === "done").length
  const allDone = doneCount === rows.length && rows.length > 0
  const hasError = rows.some(r => r.status === "error")

  return (
    <Dialog open={open} onOpenChange={uploading ? undefined : onClose}>
      <DialogContent className="w-[98vw] max-w-[98vw] h-[92vh] max-h-[92vh] p-0 flex flex-col gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Upload {rows.length} Creative{rows.length !== 1 ? "s" : ""}</DialogTitle>
          <p className="text-sm text-muted-foreground">Fill in metadata, then click Upload All. Use toolbar to apply values across rows.</p>
        </DialogHeader>

        {/* Toolbar */}
        <div className="px-4 py-2.5 border-b shrink-0 flex items-center gap-3 flex-wrap bg-muted/30">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={copyFirstDown}>
            <IconCopy className="size-3.5" /> Copy row 1 down
          </Button>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">CTA for all:</span>
            <select onChange={e => applyToAll("cta", e.target.value)} defaultValue=""
              className="h-7 rounded border bg-background px-2 text-xs cursor-pointer">
              <option value="" disabled>Select…</option>
              {ctaOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">Link for all:</span>
            <select onChange={e => applyToAll("link_url", e.target.value)} defaultValue=""
              className="h-7 rounded border bg-background px-2 text-xs cursor-pointer">
              <option value="" disabled>Select…</option>
              {pageLinks.map(p => <option key={p.id} value={p.url}>{p.name}</option>)}
            </select>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={downloadTemplate}>
              <IconDownload className="size-3.5" /> Template CSV
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => csvRef.current?.click()}>
              <IconUpload className="size-3.5" /> Import CSV
            </Button>
            <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
              <tr className="border-b">
                <th className="w-8 px-2 py-2" />
                <th className="w-10 px-3 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
                <th className="w-16 px-2 py-2 text-left text-xs font-medium text-muted-foreground">Preview</th>
                <th className="w-[160px] px-2 py-2 text-left text-xs font-medium text-muted-foreground">File Name</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">Headline</th>
                <th className="w-[22%] px-2 py-2 text-left text-xs font-medium text-muted-foreground">Primary Text</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
                <th className="w-[130px] px-2 py-2 text-left text-xs font-medium text-muted-foreground">CTA</th>
                <th className="w-[140px] px-2 py-2 text-left text-xs font-medium text-muted-foreground">Link URL</th>
                <th className="w-20 px-2 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id}
                  draggable={row.status !== "uploading" && row.status !== "done"}
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={e => handleDragOver(e, i)}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={handleDragEnd}
                  className={`border-b transition-colors ${dragOverIdx === i ? "bg-primary/10 border-primary" : "hover:bg-muted/20"}`}>
                  <td className="px-2 py-2">
                    <IconGripVertical className="size-4 text-muted-foreground/40 cursor-grab active:cursor-grabbing" />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground text-center font-medium">{i + 1}</td>
                  <td className="px-2 py-2">
                    {row.previewUrl
                      ? <img src={row.previewUrl} alt="" className="size-12 rounded object-cover border" />
                      : <div className="size-12 rounded bg-muted border flex items-center justify-center"><IconVideo className="size-5 text-muted-foreground" /></div>}
                  </td>
                  <td className="px-2 py-2">
                    <p className="text-xs truncate max-w-[150px] text-muted-foreground" title={row.file.name}>{row.file.name}</p>
                    <p className="text-[10px] text-muted-foreground/60">{(row.file.size / 1024).toFixed(0)} KB</p>
                  </td>
                  <td className="px-2 py-2">
                    <Input value={row.headline} onChange={e => update(row.id, "headline", e.target.value)}
                      className="h-8 text-xs" placeholder="Headline…" disabled={row.status === "uploading" || row.status === "done"} />
                  </td>
                  <td className="px-2 py-2">
                    <textarea value={row.primary_text} onChange={e => update(row.id, "primary_text", e.target.value)}
                      className="w-full min-h-[56px] rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary resize-none disabled:opacity-50"
                      placeholder="Primary text…" disabled={row.status === "uploading" || row.status === "done"} />
                  </td>
                  <td className="px-2 py-2">
                    <Input value={row.description} onChange={e => update(row.id, "description", e.target.value)}
                      className="h-8 text-xs" placeholder="Description…" disabled={row.status === "uploading" || row.status === "done"} />
                  </td>
                  <td className="px-2 py-2">
                    <select value={row.cta} onChange={e => update(row.id, "cta", e.target.value)}
                      disabled={row.status === "uploading" || row.status === "done"}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50">
                      {ctaOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select value={row.link_url} onChange={e => update(row.id, "link_url", e.target.value)}
                      disabled={row.status === "uploading" || row.status === "done"}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50">
                      <option value="">— None —</option>
                      {pageLinks.map(p => <option key={p.id} value={p.url}>{p.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    {row.status === "pending" && <span className="text-xs text-muted-foreground">Pending</span>}
                    {row.status === "uploading" && <IconLoader2 className="size-4 animate-spin text-primary" />}
                    {row.status === "done" && <IconCheck className="size-4 text-green-500" />}
                    {row.status === "error" && (
                      <span className="text-xs text-destructive" title={row.error}>Error</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 flex items-center justify-between shrink-0">
          <div className="text-sm text-muted-foreground">
            {uploading
              ? `Uploading… ${doneCount}/${rows.length}`
              : allDone
              ? <span className="text-green-600 font-medium">All {rows.length} creatives uploaded!</span>
              : hasError
              ? <span className="text-destructive">{rows.filter(r => r.status === "error").length} failed</span>
              : `${rows.length} file${rows.length !== 1 ? "s" : ""} ready`}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose} disabled={uploading}>Cancel</Button>
            {hasError && !uploading && (
              <Button variant="outline" onClick={handleUploadAll}>
                Retry Failed
              </Button>
            )}
            <Button onClick={handleUploadAll} disabled={uploading || allDone}>
              {uploading
                ? <><IconLoader2 className="size-4 animate-spin mr-1.5" />Uploading…</>
                : <><IconUpload className="size-4 mr-1.5" />Upload All ({rows.length})</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
