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
  campaign_name: string
  adset_name: string
  headline: string
  primary_text: string
  description: string
  cta: string
  link_url: string
  status: "pending" | "uploading" | "done" | "error"
  error?: string
  uploadProgress?: number
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
  // Strip UTF-8 BOM added by Excel when saving CSV
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
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
  const [uploadError, setUploadError] = useState("")
  const [importSummary, setImportSummary] = useState("")
  const csvRef = useRef<HTMLInputElement>(null)
  const dragIdx = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  useEffect(() => {
    if (!open || !files.length) return
    const next: PendingRow[] = files.map((file, i) => ({
      id: `${i}-${file.name}-${file.size}`,
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
      campaign_name: "",
      adset_name: "",
      headline: "",
      primary_text: "",
      description: "",
      cta: "LEARN_MORE",
      link_url: "",
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

  const applyImportedRows = (parsed: string[][]) => {
    if (parsed.length < 2) { setImportSummary("File không có dữ liệu."); return }
    const headers = parsed[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, "_"))
    const dataRows = parsed.slice(1).filter(r => r.some(c => String(c).trim()))
    const idx = (name: string) => headers.indexOf(name)

    const fileNameIdx = idx("file_name") !== -1 ? idx("file_name") : idx("filename") !== -1 ? idx("filename") : -1
    // Cột "3️⃣ Ads" chứa tên đầy đủ của file (không đuôi)
    const adsColIdx = headers.findIndex(h => h.includes("ads") && (h.includes("3") || h.includes("️⃣")))
    const linkIdx = idx("link")

    const stripExt = (s: string) => s.replace(/\.[^/.]+$/, "")

    let matched = 0
    const updated = (prev: PendingRow[]) => prev.map((row, i) => {
      const normName = stripExt(row.file.name.trim().toLowerCase())
      let cols: string[] | undefined
      if (fileNameIdx !== -1) {
        cols = dataRows.find(dr => stripExt(String(dr[fileNameIdx] ?? "").trim().toLowerCase()) === normName)
      } else if (adsColIdx !== -1) {
        // Ưu tiên khớp theo cột "3️⃣ Ads" — chứa tên file đầy đủ không có đuôi
        cols = dataRows.find(dr => stripExt(String(dr[adsColIdx] ?? "").trim().toLowerCase()) === normName)
      }
      // Fallback: khớp theo cột "link"
      if (!cols && linkIdx !== -1) {
        cols = dataRows.find(dr => {
          const baseName = (String(dr[linkIdx] ?? "").trim().toLowerCase().split(/[/\\]/).pop() || "")
          return stripExt(baseName) === normName
        })
      }
      if (!cols && adsColIdx === -1 && fileNameIdx === -1) {
        cols = dataRows[i]
      }
      if (!cols) return row
      matched++
      const get = (field: string) => { const j = idx(field); return j !== -1 ? String(cols![j] ?? "").trim() : "" }
      const linkUrl = get("link_ad_setting") || get("link_url")
      const campIdx2 = headers.findIndex(h => h.includes("campaign") && !h.includes("ads_account"))
      const adsetIdx2 = headers.findIndex(h => h.includes("ad_set"))
      return {
        ...row,
        campaign_name: (campIdx2  !== -1 ? String(cols![campIdx2]  ?? "").trim() : "") || row.campaign_name,
        adset_name:    (adsetIdx2 !== -1 ? String(cols![adsetIdx2] ?? "").trim() : "") || row.adset_name,
        headline:     get("headline")     || row.headline,
        primary_text: get("primary_text") || row.primary_text,
        description:  get("description")  || row.description,
        cta:          get("cta")          || row.cta,
        link_url:     linkUrl             || row.link_url,
      }
    })
    setRows(prev => {
      const result = updated(prev)
      const count = result.filter((r, i) => r !== prev[i]).length
      setImportSummary(count > 0
        ? `✅ Khớp ${count}/${prev.length} file — headline, description, primary text, link đã được điền`
        : `⚠ Không khớp file nào — kiểm tra tên file trong cột 'link' phải trùng với file đang upload`)
      return result
    })
  }

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isExcel = /\.(xlsx|xls)$/i.test(file.name)

    if (isExcel) {
      const reader = new FileReader()
      reader.onload = async ev => {
        try {
          const XLSX = await import("xlsx")
          const data = ev.target?.result
          const wb = XLSX.read(data, { type: "array" })
          const ws = wb.Sheets[wb.SheetNames[0]]
          // Convert all cells to string and strip leading/trailing whitespace
          const parsed = (XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "", raw: false }) as any[][])
            .map(row => row.map(cell => String(cell ?? "").trim()))
          applyImportedRows(parsed)
        } catch {
          // ignore
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = ev => {
        const parsed = parseCSV(ev.target?.result as string)
        applyImportedRows(parsed)
      }
      reader.readAsText(file)
    }

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

  const uploadVideo = async (
    file: File,
    cleanId: string,
    accessToken: string,
    onProgress: (pct: number) => void
  ): Promise<string> => {
    const FB = `https://graph.facebook.com/v25.0/act_${cleanId}/advideos`
    const headers = { Authorization: `Bearer ${accessToken}` }
    const DIRECT_LIMIT = 100 * 1024 * 1024 // dưới 100MB: direct upload
    const CHUNK_SIZE   = 50 * 1024 * 1024  // trên 100MB: chunk 50MB

    // --- Direct upload cho file nhỏ ---
    if (file.size <= DIRECT_LIMIT) {
      const form = new FormData()
      form.append("source", file)
      form.append("title", file.name)
      onProgress(30)
      const res = await fetch(FB, { method: "POST", headers, body: form })
      const d = await res.json()
      if (d.error) throw new Error(d.error.message)
      onProgress(100)
      return d.id
    }

    // --- Resumable upload cho file lớn (50MB chunk) ---
    const startForm = new FormData()
    startForm.append("upload_phase", "start")
    startForm.append("file_size", String(file.size))
    const startRes = await fetch(FB, { method: "POST", headers, body: startForm })
    const startData = await startRes.json()
    if (startData.error) throw new Error(startData.error.message)
    const { upload_session_id, video_id } = startData
    let startOffset = parseInt(startData.start_offset || "0")
    let endOffset = parseInt(startData.end_offset || String(Math.min(CHUNK_SIZE, file.size)))

    while (startOffset < file.size) {
      const chunk = file.slice(startOffset, endOffset)
      const chunkForm = new FormData()
      chunkForm.append("upload_phase", "transfer")
      chunkForm.append("upload_session_id", upload_session_id)
      chunkForm.append("start_offset", String(startOffset))
      chunkForm.append("video_file_chunk", chunk, file.name)
      const chunkRes = await fetch(FB, { method: "POST", headers, body: chunkForm })
      const chunkData = await chunkRes.json()
      if (chunkData.error) throw new Error(chunkData.error.message)
      startOffset = parseInt(chunkData.start_offset)
      endOffset = parseInt(chunkData.end_offset)
      onProgress(Math.round((startOffset / file.size) * 95))
    }

    const finishForm = new FormData()
    finishForm.append("upload_phase", "finish")
    finishForm.append("upload_session_id", upload_session_id)
    finishForm.append("title", file.name)
    const finishRes = await fetch(FB, { method: "POST", headers, body: finishForm })
    const finishData = await finishRes.json()
    if (finishData.error) throw new Error(finishData.error.message)

    onProgress(100)
    return video_id
  }

  const handleUploadAll = async () => {
    setUploading(true)
    setUploadError("")
    let credRes: Response
    try {
      const selectedId = localStorage.getItem("selected_ad_account_id") || ""
      const url = selectedId ? `/api/facebook/upload-credentials?adAccountId=${selectedId}` : "/api/facebook/upload-credentials"
      credRes = await fetch(url)
      if (!credRes.ok) {
        const errData = await credRes.json().catch(() => ({}))
        throw new Error(errData.error || `Lỗi ${credRes.status}: Không lấy được credentials`)
      }
    } catch (err: any) {
      setUploadError(err.message || "Không lấy được credentials — kiểm tra kết nối Facebook")
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
          fbVideoId = await uploadVideo(row.file, cleanId, accessToken, (pct) => {
            setRows(prev => prev.map(r => r.id === row.id ? { ...r, uploadProgress: pct } : r))
          })
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
            ad_account_id: adAccountId || null,
            file_name: row.file.name,
            file_size: row.file.size,
            media_type: isVideo ? "video" : "image",
            campaign_name: row.campaign_name || null,
            adset_name: row.adset_name || null,
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
            <input
              type="url"
              placeholder="https://..."
              className="h-7 rounded border bg-background px-2 text-xs w-48"
              onBlur={e => { if (e.target.value) applyToAll("link_url", e.target.value) }}
              onKeyDown={e => { if (e.key === "Enter" && (e.target as HTMLInputElement).value) applyToAll("link_url", (e.target as HTMLInputElement).value) }}
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={downloadTemplate}>
              <IconDownload className="size-3.5" /> Template CSV
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => csvRef.current?.click()}>
              <IconUpload className="size-3.5" /> Import CSV/Excel
            </Button>
            <input ref={csvRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleCsvImport} />
          </div>
        </div>

        {/* Import summary */}
        {importSummary && (
          <div className={`px-4 py-1.5 text-xs font-medium shrink-0 ${importSummary.startsWith("✅") ? "bg-green-50 text-green-700 border-b border-green-200" : "bg-amber-50 text-amber-700 border-b border-amber-200"}`}>
            {importSummary}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
              <tr className="border-b">
                <th className="w-8 px-2 py-2" />
                <th className="w-10 px-3 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
                <th className="w-16 px-2 py-2 text-left text-xs font-medium text-muted-foreground">Preview</th>
                <th className="w-[160px] px-2 py-2 text-left text-xs font-medium text-muted-foreground">File Name</th>
                <th className="w-[160px] px-2 py-2 text-left text-xs font-medium text-muted-foreground">Campaign / Ad Set</th>
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
                    {row.campaign_name || row.adset_name ? (
                      <div className="space-y-1">
                        {row.campaign_name && (
                          <p className="text-[10px] leading-tight bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 truncate max-w-[150px]"
                            title={row.campaign_name}>
                            <span className="font-semibold">C:</span> {row.campaign_name}
                          </p>
                        )}
                        {row.adset_name && (
                          <p className="text-[10px] leading-tight bg-violet-50 text-violet-700 border border-violet-200 rounded px-1.5 py-0.5 truncate max-w-[150px]"
                            title={row.adset_name}>
                            <span className="font-semibold">A:</span> {row.adset_name}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40 italic">—</span>
                    )}
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
                    <Input
                      type="url"
                      value={row.link_url}
                      onChange={e => update(row.id, "link_url", e.target.value)}
                      className="h-8 text-xs"
                      placeholder="https://..."
                      disabled={row.status === "uploading" || row.status === "done"}
                    />
                  </td>
                  <td className="px-2 py-2">
                    {row.status === "pending" && <span className="text-xs text-muted-foreground">Pending</span>}
                    {row.status === "uploading" && (
                      <div className="flex flex-col gap-1 min-w-[60px]">
                        <IconLoader2 className="size-4 animate-spin text-primary" />
                        {row.uploadProgress !== undefined && row.uploadProgress > 0 && (
                          <div className="w-full">
                            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-primary transition-all" style={{ width: `${row.uploadProgress}%` }} />
                            </div>
                            <span className="text-[10px] text-primary">{row.uploadProgress}%</span>
                          </div>
                        )}
                      </div>
                    )}
                    {row.status === "done" && <IconCheck className="size-4 text-green-500" />}
                    {row.status === "error" && (
                      <span className="text-xs text-destructive leading-tight" title={row.error}>
                        Lỗi<br/>
                        <span className="text-[10px] opacity-70 break-all">{row.error?.slice(0, 60)}</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 flex flex-col gap-2 shrink-0">
          {uploadError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive font-medium">
              ⚠ {uploadError}
            </div>
          )}
          <div className="flex items-center justify-between">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
