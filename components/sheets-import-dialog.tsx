"use client"

import { useState, useRef, useCallback, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  IconLoader2,
  IconCheck,
  IconX,
  IconChevronRight,
  IconTable,
  IconBrandGoogleDrive,
  IconAlertCircle,
  IconFileSpreadsheet,
  IconLink,
  IconArrowsMaximize,
  IconArrowsMinimize,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Creative {
  id: string
  file_name: string
  file_url: string
  media_type: "image" | "video"
  fb_image_url?: string
  fb_thumbnail_url?: string
  fb_image_hash?: string
  fb_video_id?: string
  status?: "processing" | "ready" | "error"
}

export interface ImportedRow {
  adName: string
  primaryText: string
  headline: string
  description: string
  cta: string
  webLink: string
  urlTags: string
  promoCode: string
  launchAsActive: boolean | undefined
  creative: Creative | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  adAccountId: string
  onImport: (rows: ImportedRow[]) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

type FieldKey = "creative_url" | "ad_name" | "primary_text" | "headline" | "description" | "cta" | "web_link" | "url_tags" | "promo_code" | "launch_status"

const AD_FIELDS: Array<{ key: FieldKey; label: string }> = [
  { key: "creative_url",  label: "Creative (Drive URL)" },
  { key: "ad_name",       label: "Ad Name" },
  { key: "primary_text",  label: "Primary Text" },
  { key: "headline",      label: "Headline" },
  { key: "description",   label: "Description" },
  { key: "cta",           label: "CTA" },
  { key: "web_link",      label: "Link (Destination URL)" },
  { key: "url_tags",      label: "URL Tags (UTM)" },
  { key: "promo_code",    label: "Promo Code" },
  { key: "launch_status", label: "Launch Status (active/paused)" },
]

// Keyword patterns for auto-detect column → field mapping
const AUTO_DETECT: Record<FieldKey, string[]> = {
  creative_url:  ["creative", "drive", "media", "image", "video", "file", "url creative", "creative url"],
  ad_name:       ["ad name", "name", "tên", "tên quảng cáo", "ad title"],
  primary_text:  ["primary text", "body", "body copy", "text", "caption", "nội dung", "primary", "copy"],
  headline:      ["headline", "title", "tiêu đề", "heading"],
  description:   ["description", "mô tả", "desc"],
  cta:           ["cta", "call to action", "button", "action"],
  web_link:      ["link", "destination", "website", "web link", "landing", "web url", "url"],
  url_tags:      ["url tags", "utm", "url parameters", "tracking", "tags", "query"],
  promo_code:    ["promo", "promo code", "coupon", "discount code", "offer code"],
  launch_status: ["status", "launch status", "active", "paused", "trạng thái"],
}

function autoDetect(headers: string[]): Record<FieldKey, number | null> {
  const result = {} as Record<FieldKey, number | null>
  const usedIdx = new Set<number>()
  for (const { key } of AD_FIELDS) {
    const keywords = AUTO_DETECT[key]
    let found: number | null = null
    for (let i = 0; i < headers.length; i++) {
      if (usedIdx.has(i)) continue
      const h = headers[i].toLowerCase()
      if (keywords.some(k => h.includes(k))) { found = i; break }
    }
    result[key] = found
    if (found !== null) usedIdx.add(found)
  }
  return result
}

function extractDriveFileId(url: string): string | null {
  const s = url.trim()
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]{15,})/,
    /[?&]id=([a-zA-Z0-9_-]{15,})/,
    /\/open\?id=([a-zA-Z0-9_-]{15,})/,
  ]
  for (const p of patterns) {
    const m = s.match(p)
    if (m) return m[1]
  }
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s
  return null
}

function extractSpreadsheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (m) return m[1]
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url.trim())) return url.trim()
  return null
}

function getMimeGuess(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || ""
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg"
  if (ext === "png") return "image/png"
  if (ext === "gif") return "image/gif"
  if (ext === "webp") return "image/webp"
  if (ext === "mp4") return "video/mp4"
  if (ext === "mov") return "video/quicktime"
  return "image/jpeg"
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SheetsImportDialog({ open, onOpenChange, adAccountId, onImport }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1: auth + pick
  const [pastedUrl, setPastedUrl] = useState("")
  const [loadingSheet, setLoadingSheet] = useState(false)
  const [pickError, setPickError] = useState("")

  // Google OAuth
  const gScriptsReady = useRef(false)
  const gTokenRef = useRef<string | null>(null)

  // Sheet data
  const [spreadsheetId, setSpreadsheetId] = useState("")
  const [spreadsheetTitle, setSpreadsheetTitle] = useState("")
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<string[][]>([])

  // Step 2: column mapping
  const [mapping, setMapping] = useState<Record<FieldKey, number | null>>({
    creative_url: null, ad_name: null, primary_text: null,
    headline: null, description: null, cta: null, web_link: null,
    url_tags: null, promo_code: null, launch_status: null,
  })

  // Step 3: selection + import
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 })
  const [importError, setImportError] = useState("")
  const [tableExpanded, setTableExpanded] = useState(false)
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set())

  // Drag-to-scroll
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const dragState = useRef({ dragging: false, startX: 0, scrollLeft: 0 })

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = tableScrollRef.current
    if (!el) return
    dragState.current = { dragging: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft }
    el.style.cursor = "grabbing"
    el.style.userSelect = "none"
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragState.current.dragging) return
    const el = tableScrollRef.current
    if (!el) return
    const x = e.pageX - el.offsetLeft
    const walk = (x - dragState.current.startX) * 1.2
    el.scrollLeft = dragState.current.scrollLeft - walk
  }, [])

  const onMouseUp = useCallback(() => {
    dragState.current.dragging = false
    if (tableScrollRef.current) {
      tableScrollRef.current.style.cursor = "grab"
      tableScrollRef.current.style.userSelect = ""
    }
  }, [])

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const loadGoogleScript = (src: string) => new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement("script")
    s.src = src; s.async = true
    s.onload = () => resolve(); s.onerror = reject
    document.head.appendChild(s)
  })

  const getGoogleToken = useCallback(() => new Promise<string>((resolve, reject) => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""
    const tc = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: [
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/spreadsheets.readonly",
      ].join(" "),
      callback: (resp: any) => {
        if (resp.error) { reject(new Error(resp.error)); return }
        gTokenRef.current = resp.access_token
        resolve(resp.access_token)
      },
    })
    tc.requestAccessToken({ prompt: gTokenRef.current ? "" : "consent" })
  }), [])

  const ensureGoogleScripts = useCallback(async () => {
    if (gScriptsReady.current) return
    await Promise.all([
      loadGoogleScript("https://apis.google.com/js/api.js"),
      loadGoogleScript("https://accounts.google.com/gsi/client"),
    ])
    gScriptsReady.current = true
  }, [])

  const loadSheetData = useCallback(async (sheetId: string, token: string) => {
    setLoadingSheet(true)
    setPickError("")
    try {
      const res = await fetch("/api/google/read-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token, spreadsheetId: sheetId }),
      })
      const data = await res.json()
      if (!res.ok) { setPickError(data.error || "Failed to read sheet"); return }
      if (!data.headers?.length) { setPickError("Sheet is empty or has no header row"); return }

      setSpreadsheetId(sheetId)
      setSpreadsheetTitle(data.spreadsheetTitle || "Sheet")
      setHeaders(data.headers)
      setRawRows(data.rows || [])

      const detected = autoDetect(data.headers)
      setMapping(detected)

      const allIdx = new Set<number>((data.rows || []).map((_: any, i: number) => i))
      setSelectedRows(allIdx)
      setStep(2)
    } catch (err: any) {
      setPickError(err.message || "Failed to read sheet")
    } finally {
      setLoadingSheet(false)
    }
  }, [])

  // ─── Open Google Picker (Spreadsheets view) ───────────────────────────────

  const openPicker = useCallback(async () => {
    setPickError("")
    setLoadingSheet(true)
    try {
      await ensureGoogleScripts()
      const token = gTokenRef.current || await getGoogleToken()
      await new Promise<void>(resolve => (window as any).gapi.load("picker", resolve))

      const P = (window as any).google.picker
      const picker = new P.PickerBuilder()
        .addView(
          new P.DocsView(P.ViewId.SPREADSHEETS)
            .setMimeTypes("application/vnd.google-apps.spreadsheet")
        )
        .setOAuthToken(token)
        .setCallback(async (data: any) => {
          if (data.action !== P.Action.PICKED) { setLoadingSheet(false); return }
          const doc = data.docs[0]
          await loadSheetData(doc.id, token)
        })
        .build()
      picker.setVisible(true)
      setLoadingSheet(false)
    } catch (err: any) {
      setPickError(err.message || "Google auth failed")
      setLoadingSheet(false)
    }
  }, [ensureGoogleScripts, getGoogleToken, loadSheetData])

  // ─── Load from pasted URL ─────────────────────────────────────────────────

  const loadFromUrl = useCallback(async () => {
    const sheetId = extractSpreadsheetId(pastedUrl.trim())
    if (!sheetId) { setPickError("Invalid Google Sheets URL"); return }
    setPickError("")
    setLoadingSheet(true)
    try {
      await ensureGoogleScripts()
      const token = gTokenRef.current || await getGoogleToken()
      await loadSheetData(sheetId, token)
    } catch (err: any) {
      setPickError(err.message || "Auth failed")
      setLoadingSheet(false)
    }
  }, [pastedUrl, ensureGoogleScripts, getGoogleToken, loadSheetData])

  // ─── Step 3: do import ────────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    const rowsToImport = rawRows.filter((_, i) => selectedRows.has(i))
    if (!rowsToImport.length) return

    setImporting(true)
    setImportError("")
    setImportProgress({ done: 0, total: rowsToImport.length })

    const getCell = (row: string[], colIdx: number | null): string =>
      colIdx !== null ? String(row[colIdx] ?? "").trim() : ""

    const results: ImportedRow[] = []

    for (let i = 0; i < rowsToImport.length; i++) {
      const row = rowsToImport[i]
      const creativeUrl = getCell(row, mapping.creative_url)
      let creative: Creative | null = null

      if (creativeUrl && adAccountId) {
        const fileId = extractDriveFileId(creativeUrl)
        if (fileId) {
          try {
            const token = gTokenRef.current
            if (token) {
              const fileName = creativeUrl.split("/").pop() || `creative_${i + 1}`
              const mimeType = getMimeGuess(fileName)
              const res = await fetch("/api/google/import-drive", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  accessToken: token,
                  fileId,
                  fileName,
                  mimeType,
                  adAccountId,
                }),
              })
              if (res.ok) {
                const d = await res.json()
                creative = d.creative || null
              }
            }
          } catch {
            // creative stays null — user can assign manually
          }
        }
      }

      // Parse launch_status: "active"/"paused"/"true"/"false"/1/0
      const launchStatusRaw = getCell(row, mapping.launch_status).toLowerCase()
      let launchAsActive: boolean | undefined = undefined
      if (launchStatusRaw) {
        launchAsActive = ["active", "true", "1", "yes", "on"].includes(launchStatusRaw)
      }

      results.push({
        adName:       getCell(row, mapping.ad_name),
        primaryText:  getCell(row, mapping.primary_text),
        headline:     getCell(row, mapping.headline),
        description:  getCell(row, mapping.description),
        cta:          getCell(row, mapping.cta).toUpperCase().replace(/ /g, "_") || "",
        webLink:      getCell(row, mapping.web_link),
        urlTags:      getCell(row, mapping.url_tags),
        promoCode:    getCell(row, mapping.promo_code),
        launchAsActive,
        creative,
      })

      setImportProgress({ done: i + 1, total: rowsToImport.length })
    }

    setImporting(false)
    onImport(results)
    handleClose()
  }, [rawRows, selectedRows, mapping, adAccountId, onImport])

  // ─── Reset on close ───────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    setStep(1)
    setPastedUrl("")
    setPickError("")
    setLoadingSheet(false)
    setSpreadsheetId("")
    setSpreadsheetTitle("")
    setHeaders([])
    setRawRows([])
    setSelectedRows(new Set())
    setImporting(false)
    setImportError("")
    setTableExpanded(false)
    setExpandedCells(new Set())
    onOpenChange(false)
  }, [onOpenChange])

  // ─── Row preview helpers ──────────────────────────────────────────────────

  const toggleRow = (i: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedRows.size === rawRows.length) setSelectedRows(new Set())
    else setSelectedRows(new Set(rawRows.map((_, i) => i)))
  }

  const previewCols = AD_FIELDS.filter(f => mapping[f.key] !== null)

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <IconTable className="size-4 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-base">Import from Google Sheets</DialogTitle>
              {step > 1 && spreadsheetTitle && (
                <p className="text-xs text-muted-foreground mt-0.5">{spreadsheetTitle}</p>
              )}
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-3">
            {(["Pick Sheet", "Map Columns", "Preview & Import"] as const).map((label, idx) => {
              const n = idx + 1
              const active = step === n
              const done = step > n
              return (
                <div key={n} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className={cn(
                      "size-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                      done  ? "bg-emerald-500 text-white" :
                      active ? "bg-primary text-primary-foreground" :
                               "bg-muted text-muted-foreground"
                    )}>
                      {done ? <IconCheck className="size-3" /> : n}
                    </div>
                    <span className={cn("text-xs", active ? "font-medium" : "text-muted-foreground")}>{label}</span>
                  </div>
                  {idx < 2 && <IconChevronRight className="size-3 text-muted-foreground" />}
                </div>
              )
            })}
          </div>
        </DialogHeader>

        {/* ── Step 1: Pick Sheet ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6 min-h-0">
            <div className="text-center">
              <div className="size-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <IconFileSpreadsheet className="size-7 text-emerald-600" />
              </div>
              <h3 className="font-semibold mb-1">Connect Google Sheets</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Pick a spreadsheet from Google Drive or paste a sheet URL. We'll read the headers and map them to ad fields.
              </p>
            </div>

            <Button
              size="lg"
              className="gap-2 min-w-[220px]"
              onClick={openPicker}
              disabled={loadingSheet}
            >
              {loadingSheet ? (
                <><IconLoader2 className="size-4 animate-spin" />Connecting…</>
              ) : (
                <><IconBrandGoogleDrive className="size-4" />Pick from Google Drive</>
              )}
            </Button>

            <div className="flex items-center gap-3 w-full max-w-md">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or paste URL</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="flex gap-2 w-full max-w-md">
              <div className="flex-1 flex items-center gap-2 border rounded-lg px-3 h-9">
                <IconLink className="size-3.5 text-muted-foreground shrink-0" />
                <input
                  value={pastedUrl}
                  onChange={e => setPastedUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  onKeyDown={e => e.key === "Enter" && loadFromUrl()}
                />
              </div>
              <Button variant="outline" onClick={loadFromUrl} disabled={!pastedUrl.trim() || loadingSheet}>
                Load
              </Button>
            </div>

            {pickError && (
              <div className="flex items-center gap-1.5 text-sm text-destructive">
                <IconAlertCircle className="size-4" />{pickError}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Map Columns ────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {rawRows.length} rows found. Map your sheet columns to ad fields.
                </p>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {headers.length} columns detected
                </span>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_16px_1fr] gap-0">
                  <div className="bg-muted/50 px-4 py-2.5 text-xs font-semibold text-muted-foreground">Ad Field</div>
                  <div className="bg-muted/50" />
                  <div className="bg-muted/50 px-4 py-2.5 text-xs font-semibold text-muted-foreground">Sheet Column</div>
                </div>
                {AD_FIELDS.map(({ key, label }, idx) => (
                  <div
                    key={key}
                    className={cn(
                      "grid grid-cols-[1fr_16px_1fr] items-center gap-0",
                      idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                    )}
                  >
                    <div className="px-4 py-3 text-sm font-medium">{label}</div>
                    <div className="flex items-center justify-center">
                      <IconChevronRight className="size-3 text-muted-foreground" />
                    </div>
                    <div className="px-3 py-2">
                      <Select
                        value={mapping[key] !== null ? String(mapping[key]) : "__skip__"}
                        onValueChange={v => setMapping(prev => ({
                          ...prev,
                          [key]: v === "__skip__" ? null : Number(v),
                        }))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="— skip —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__skip__">— skip —</SelectItem>
                          {headers.map((h, i) => (
                            <SelectItem key={i} value={String(i)}>
                              {h || `Column ${i + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>

              {mapping.primary_text === null && mapping.headline === null && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <IconAlertCircle className="size-3.5 shrink-0" />
                  Map at least Primary Text or Headline to create meaningful ads
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Preview ────────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-4">
              {importing ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <IconLoader2 className="size-8 text-primary animate-spin" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Importing rows…</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {importProgress.done} / {importProgress.total}
                      {mapping.creative_url !== null ? " (uploading creatives to Meta)" : ""}
                    </p>
                  </div>
                  <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{selectedRows.size}</span> of {rawRows.length} rows selected
                    </p>
                    <button
                      onClick={toggleAll}
                      className="text-xs text-primary hover:underline"
                    >
                      {selectedRows.size === rawRows.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  {/* Table toolbar */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-muted-foreground">
                      {previewCols.length} column{previewCols.length !== 1 ? "s" : ""} mapped
                      {tableExpanded ? " · expanded" : " · compact"}
                    </span>
                    <button
                      onClick={() => setTableExpanded(v => !v)}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted/50"
                      title={tableExpanded ? "Compact view" : "Expand cells"}
                    >
                      {tableExpanded
                        ? <><IconArrowsMinimize className="size-3" />Compact</>
                        : <><IconArrowsMaximize className="size-3" />Expand</>
                      }
                    </button>
                  </div>

                  <div
                    ref={tableScrollRef}
                    className="border rounded-xl overflow-x-auto select-none"
                    style={{ cursor: "grab" }}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                  >
                    <table className="text-xs border-collapse" style={{ minWidth: "max-content" }}>
                      <thead>
                        <tr className="border-b bg-muted/50">
                          {/* Sticky checkbox + # */}
                          <th className="sticky left-0 z-10 bg-muted/50 w-8 px-3 py-2.5 text-left border-r border-border/40">
                            <input
                              type="checkbox"
                              checked={selectedRows.size === rawRows.length && rawRows.length > 0}
                              onChange={toggleAll}
                              onClick={e => e.stopPropagation()}
                              className="rounded"
                            />
                          </th>
                          <th className="sticky left-8 z-10 bg-muted/50 px-2 py-2.5 text-left font-semibold text-muted-foreground border-r border-border/40 w-8">#</th>
                          {previewCols.map(f => (
                            <th
                              key={f.key}
                              className="px-3 py-2.5 text-left font-semibold text-muted-foreground whitespace-nowrap border-r border-border/20 last:border-r-0"
                              style={{ minWidth: tableExpanded ? 240 : 160 }}
                            >
                              {f.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rawRows.slice(0, 200).map((row, i) => (
                          <tr
                            key={i}
                            onClick={() => toggleRow(i)}
                            className={cn(
                              "border-b last:border-0 cursor-pointer transition-colors group",
                              selectedRows.has(i) ? "bg-primary/[0.04]" : "hover:bg-muted/30"
                            )}
                          >
                            {/* Sticky checkbox */}
                            <td
                              className={cn(
                                "sticky left-0 z-10 px-3 py-2 border-r border-border/40",
                                selectedRows.has(i) ? "bg-primary/[0.04]" : "bg-background group-hover:bg-muted/30"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={selectedRows.has(i)}
                                onChange={() => toggleRow(i)}
                                onClick={e => e.stopPropagation()}
                                className="rounded"
                              />
                            </td>
                            {/* Sticky row number */}
                            <td
                              className={cn(
                                "sticky left-8 z-10 px-2 py-2 text-muted-foreground border-r border-border/40 text-center",
                                selectedRows.has(i) ? "bg-primary/[0.04]" : "bg-background group-hover:bg-muted/30"
                              )}
                            >
                              {i + 1}
                            </td>
                            {previewCols.map(f => {
                              const val = mapping[f.key] !== null ? String(row[mapping[f.key]!] ?? "").trim() : ""
                              const cellKey = `${i}-${f.key}`
                              const isExpanded = expandedCells.has(cellKey)
                              return (
                                <td
                                  key={f.key}
                                  className="px-3 py-2 border-r border-border/20 last:border-r-0 align-top"
                                  style={{ minWidth: tableExpanded ? 240 : 160 }}
                                  onClick={e => {
                                    e.stopPropagation()
                                    setExpandedCells(prev => {
                                      const next = new Set(prev)
                                      next.has(cellKey) ? next.delete(cellKey) : next.add(cellKey)
                                      return next
                                    })
                                  }}
                                >
                                  {!val ? (
                                    <span className="text-muted-foreground/40 italic text-[11px]">—</span>
                                  ) : f.key === "creative_url" ? (
                                    <span
                                      className={cn(
                                        "text-primary text-[11px] cursor-pointer",
                                        !isExpanded && !tableExpanded && "block truncate"
                                      )}
                                      style={!isExpanded && !tableExpanded ? { maxWidth: 150 } : undefined}
                                      title={val}
                                    >
                                      {val}
                                    </span>
                                  ) : (
                                    <span
                                      className={cn(
                                        "text-[11px] leading-relaxed cursor-pointer",
                                        !isExpanded && !tableExpanded && "line-clamp-2"
                                      )}
                                      title={!isExpanded && !tableExpanded ? val : undefined}
                                    >
                                      {val}
                                    </span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rawRows.length > 200 && (
                      <div className="px-4 py-2 text-xs text-muted-foreground border-t bg-muted/30">
                        Showing first 200 of {rawRows.length} rows
                      </div>
                    )}
                  </div>

                  {mapping.creative_url !== null && (
                    <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                      <IconBrandGoogleDrive className="size-3.5 text-blue-500 mt-0.5 shrink-0" />
                      <span>
                        Creative URLs will be uploaded to Meta during import.
                        Rows without a valid Drive URL will be imported without a creative — you can assign one manually in the table.
                      </span>
                    </div>
                  )}

                  {importError && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
                      <IconAlertCircle className="size-3.5" />{importError}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        {!importing && (
          <div className="px-6 py-4 border-t flex items-center justify-between shrink-0">
            <Button variant="ghost" size="sm" onClick={handleClose} className="gap-1.5 text-xs">
              <IconX className="size-3.5" />Cancel
            </Button>
            <div className="flex items-center gap-2">
              {step > 1 && (
                <Button variant="outline" size="sm" onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)}>
                  Back
                </Button>
              )}
              {step === 1 && (
                <Button size="sm" variant="outline" onClick={openPicker} disabled={loadingSheet}>
                  {loadingSheet ? <IconLoader2 className="size-3.5 animate-spin mr-1" /> : null}
                  Connect Google Drive
                </Button>
              )}
              {step === 2 && (
                <Button
                  size="sm"
                  onClick={() => setStep(3)}
                  disabled={Object.values(mapping).every(v => v === null)}
                >
                  Preview {rawRows.length} rows
                  <IconChevronRight className="size-3.5 ml-1" />
                </Button>
              )}
              {step === 3 && (
                <Button
                  size="sm"
                  onClick={handleImport}
                  disabled={selectedRows.size === 0}
                  className="gap-1.5"
                >
                  <IconCheck className="size-3.5" />
                  Import {selectedRows.size} row{selectedRows.size !== 1 ? "s" : ""} to Table
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
