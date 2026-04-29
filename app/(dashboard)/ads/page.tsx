"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import Spreadsheet, { type CellBase, type Matrix } from "react-spreadsheet"
import { Button } from "@/components/ui/button"
import { PresenceAvatars } from "@/components/presence-avatars"
import { useOrg } from "@/lib/org-context"
import { useRealtimeCreatives } from "@/hooks/use-realtime-creatives"
import { useCreativesPresence, type PresenceUser } from "@/hooks/use-presence"
import { createClient } from "@/lib/supabase/client"
import {
  IconPlus,
  IconPhoto,
  IconLoader2,
  IconVideo,
  IconTrash,
  IconCopy,
  IconClipboard,
  IconRowInsertBottom,
  IconClearAll,
  IconSearch,
  IconFilter,
} from "@tabler/icons-react"
import { Input } from "@/components/ui/input"
import { useUserSettings } from "@/hooks/use-user-settings"
import { useTheme } from "next-themes"

interface Creative {
  id: string
  file_name: string
  file_url: string
  media_type: "image" | "video"
  file_size: number
  headline: string
  primary_text: string
  description: string
  cta: string
  link_url: string
  fb_thumbnail_url?: string
  fb_image_hash?: string
  fb_video_id?: string
  status?: string
  created_at: string
}

interface CTAOption {
  value: string
  label: string
}

interface PageLink {
  id: string
  name: string
  url: string
}

const FIELDS = [
  "file_preview",
  "file_name",
  "headline",
  "primary_text",
  "description",
  "cta",
  "link_url",
  "status",
] as const
const HEADERS = [
  "File",
  "Name",
  "Headline",
  "Primary Text",
  "Description",
  "CTA",
  "Link URL",
  "Status",
]

// Presence helpers
function buildPresenceMap(others: PresenceUser[]) {
  const map = new Map<string, PresenceUser>()
  for (const u of others) {
    if (u.editingCell) {
      map.set(`${u.editingCell.rowId}:${u.editingCell.colField}`, u)
    }
  }
  return map
}

const injectedColors = new Set<string>()
function ensurePresenceStyle(color: string) {
  const cls = `presence-${color.replace("#", "")}`
  if (typeof document === "undefined" || injectedColors.has(cls)) return cls
  injectedColors.add(cls)
  const style = document.createElement("style")
  style.textContent = `
    .${cls} { box-shadow: inset 0 0 0 2px ${color} !important; position: relative; }
    .${cls}::after {
      content: attr(data-presence-user);
      position: absolute; top: -16px; left: 0;
      background: ${color}; color: white;
      font-size: 10px; padding: 0 5px; border-radius: 3px 3px 0 0;
      white-space: nowrap; z-index: 10; pointer-events: none;
    }
  `
  document.head.appendChild(style)
  return cls
}

// Multi-line text editor (textarea) — auto-resizes to fit content
function TextAreaEditor({
  cell,
  onChange,
  exitEditMode,
}: {
  cell: CellBase | undefined
  onChange: (cell: CellBase) => void
  exitEditMode: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const val = String(cell?.value || "")

  const autoResize = useCallback(() => {
    const ta = ref.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.max(ta.scrollHeight, 83)}px`
  }, [])

  useEffect(() => {
    if (ref.current) {
      ref.current.focus()
      ref.current.setSelectionRange(val.length, val.length)
      autoResize()
    }
  }, [])

  return (
    <textarea
      ref={ref}
      defaultValue={val}
      onChange={(e) => {
        onChange({ ...cell, value: e.target.value })
        autoResize()
      }}
      onPaste={(e) => {
        e.stopPropagation()
        requestAnimationFrame(autoResize)
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          exitEditMode()
        }
        if (e.key === "Tab") {
          exitEditMode()
        }
        e.stopPropagation()
      }}
      className="absolute -top-0.5 -left-0.5 z-50 w-[calc(100%+4px)] border-2 border-primary bg-background text-foreground p-2 text-sm outline-none"
      style={{ lineHeight: "1.5em", resize: "none", overflow: "hidden" }}
    />
  )
}

// Multi-line text viewer (preserves line breaks)
function TextAreaViewer({ cell }: { cell: CellBase | undefined }) {
  const val = String(cell?.value || "")
  return (
    <div
      className="multiline-cell"
      style={{
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        overflow: "hidden",
        maxHeight: "4.5em",
        lineHeight: "1.5em",
      }}
    >
      {val}
    </div>
  )
}

// CTA chip viewer
function CTAViewer({ cell }: { cell: CellBase | undefined }) {
  const val = String(cell?.value || "LEARN_MORE")
  const label = val.replace(/_/g, " ")
  return (
    <div className="flex h-full items-center justify-center">
      <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
        {label}
      </span>
    </div>
  )
}

// CTA select editor - receives ctaOptions via closure
function createCTAEditor(ctaOptions: CTAOption[]) {
  return function CTAEditor({
    cell,
    onChange,
  }: {
    cell: CellBase | undefined
    onChange: (cell: CellBase) => void
  }) {
    const val = String(cell?.value || "LEARN_MORE")
    return (
      <select
        value={val}
        onChange={(e) => onChange({ ...cell, value: e.target.value })}
        autoFocus
        className="h-full w-full border-none bg-background text-foreground px-2 text-sm outline-none"
      >
        {ctaOptions.map((cta) => (
          <option key={cta.value} value={cta.value}>
            {cta.label}
          </option>
        ))}
      </select>
    )
  }
}

// Status chip viewer
function StatusViewer({ cell }: { cell: CellBase | undefined }) {
  const val = String(cell?.value || "ready")
  const styles: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    ready: "bg-blue-100 text-blue-700",
    launched: "bg-green-100 text-green-700",
  }
  const cls = styles[val] || styles.ready
  return (
    <div className="flex h-full items-center justify-center">
      <span
        className={`inline-block cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}
      >
        {val}
      </span>
    </div>
  )
}

// Status editor
function StatusEditor({
  cell,
  onChange,
}: {
  cell: CellBase | undefined
  onChange: (cell: CellBase) => void
}) {
  const val = String(cell?.value || "ready")
  return (
    <select
      value={val}
      onChange={(e) => onChange({ ...cell, value: e.target.value })}
      autoFocus
      className="h-full w-full border-none bg-white px-2 text-center text-sm outline-none"
    >
      <option value="draft">Draft</option>
      <option value="ready">Ready</option>
    </select>
  )
}

// Link URL viewer (show page name instead of raw URL)
function createLinkViewer(pageLinks: PageLink[]) {
  return function LinkViewer({ cell }: { cell: CellBase | undefined }) {
    const url = String(cell?.value || "")
    if (!url) return <span className="text-muted-foreground">—</span>
    const page = pageLinks.find((p) => p.url === url)
    return (
      <span className="text-sm" title={url}>
        {page ? page.name : url}
      </span>
    )
  }
}

// Link URL editor (select from page links)
function createLinkEditor(pageLinks: PageLink[]) {
  return function LinkEditor({
    cell,
    onChange,
  }: {
    cell: CellBase | undefined
    onChange: (cell: CellBase) => void
  }) {
    const val = String(cell?.value || "")
    return (
      <select
        value={val}
        onChange={(e) => onChange({ ...cell, value: e.target.value })}
        autoFocus
        className="h-full w-full border-none bg-background text-foreground px-2 text-sm outline-none"
      >
        {pageLinks.map((p) => (
          <option key={p.id} value={p.url}>
            {p.name}
          </option>
        ))}
      </select>
    )
  }
}

// CSV-aware paste parser: handles quoted fields with embedded newlines/tabs
function parseTSVWithQuotes(text: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else {
      if (ch === '"' && field === "") {
        inQuotes = true
      } else if (ch === "\t") {
        currentRow.push(field)
        field = ""
      } else if (ch === "\n") {
        currentRow.push(field)
        rows.push(currentRow)
        currentRow = []
        field = ""
      } else if (ch === "\r") {
        // skip \r, handle \r\n
      } else {
        field += ch
      }
    }
  }
  currentRow.push(field)
  if (currentRow.length > 0) rows.push(currentRow)
  return rows
}

// Encode cell values as TSV with CSV quoting for multi-line values
function toTSVWithQuotes(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((val) =>
          val.includes("\n") || val.includes("\t") || val.includes('"')
            ? `"${val.replace(/"/g, '""')}"`
            : val
        )
        .join("\t")
    )
    .join("\n")
}

// Image preview viewer
function ImageViewer({ cell }: { cell: CellBase | undefined }) {
  const url = String(cell?.value || "")
  if (!url) {
    return (
      <div className="flex h-full items-center justify-center">
        <IconPhoto className="size-5 text-muted-foreground" />
      </div>
    )
  }
  if (url === "video") {
    return (
      <div className="flex h-full items-center justify-center">
        <IconVideo className="size-5 text-muted-foreground" />
      </div>
    )
  }
  return (
    <div className="flex h-full items-center justify-center">
      <img src={url} alt="" className="size-9 rounded object-cover" />
    </div>
  )
}

function creativesToMatrix(
  creatives: Creative[],
  presenceMap: Map<string, PresenceUser>,
  ctaEditor: React.ComponentType<any>,
  linkViewer: React.ComponentType<any>,
  linkEditor: React.ComponentType<any>,
  defaultPageUrl: string
): Matrix<CellBase> {
  return creatives.map((c) =>
    FIELDS.map((field) => {
      const key = `${c.id}:${field}`
      const presence = presenceMap.get(key)

      let cell: CellBase

      if (field === "file_preview") {
        const url =
          c.media_type === "video"
            ? "video"
            : c.fb_thumbnail_url || c.file_url || ""
        cell = { value: url, readOnly: true, DataViewer: ImageViewer }
      } else if (field === "cta") {
        cell = {
          value: c.cta || "LEARN_MORE",
          DataViewer: CTAViewer,
          DataEditor: ctaEditor,
        }
      } else if (field === "link_url") {
        cell = {
          value: c.link_url || defaultPageUrl,
          DataViewer: linkViewer,
          DataEditor: linkEditor,
        }
      } else if (field === "status") {
        cell = {
          value: c.status || "ready",
          DataViewer: StatusViewer,
          DataEditor: StatusEditor,
        }
      } else if (
        field === "primary_text" ||
        field === "description" ||
        field === "headline"
      ) {
        cell = {
          value: (c as any)[field] || "",
          DataViewer: TextAreaViewer,
          DataEditor: TextAreaEditor,
        }
      } else {
        cell = { value: (c as any)[field] || "" }
      }

      if (presence) {
        const OrigViewer = cell.DataViewer
        cell.className = ensurePresenceStyle(presence.color)
        cell.DataViewer = (props: any) => (
          <span data-presence-user={presence.userName}>
            {OrigViewer ? (
              <OrigViewer {...props} />
            ) : (
              String(props.cell?.value || "")
            )}
          </span>
        )
      }

      return cell
    })
  )
}

export default function AdsManagerPage() {
  const { activeOrgId } = useOrg()
  const { resolvedTheme } = useTheme()
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [ctaOptions, setCtaOptions] = useState<CTAOption[]>([])
  const [pageLinks, setPageLinks] = useState<PageLink[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [userId, setUserId] = useState("")
  const [userName, setUserName] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingEditsRef = useRef<Set<string>>(new Set())
  const saveTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  )
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    rowIdx: number
    colIdx: number
  } | null>(null)
  const clipboardRef = useRef<string[][] | null>(null)
  const creativesRef = useRef<Creative[]>(creatives)
  creativesRef.current = creatives
  const selectedRangeRef = useRef<{
    startRow: number
    startCol: number
    endRow: number
    endCol: number
  } | null>(null)

  // User settings (filter, column widths)
  const { settings, updateSettings } = useUserSettings()
  const [filterStatus, setFilterStatus] = useState<string>("ready")
  const [filterSearch, setFilterSearch] = useState<string>("")
  const [filterCta, setFilterCta] = useState<string>("all")
  const [filterPage, setFilterPage] = useState<string>("all")

  // Sync saved status filter on load (only status is persisted)
  useEffect(() => {
    if (settings?.ads_filter?.status) {
      setFilterStatus(settings.ads_filter.status)
    }
  }, [settings?.ads_filter?.status])

  // Undo history
  const undoStackRef = useRef<Creative[][]>([])
  const pushUndo = useCallback(() => {
    undoStackRef.current.push(JSON.parse(JSON.stringify(creativesRef.current)))
    if (undoStackRef.current.length > 50) undoStackRef.current.shift()
  }, [])

  // Resizable columns
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  useEffect(() => {
    if (settings?.ads_column_widths && Object.keys(settings.ads_column_widths).length > 0) {
      setColumnWidths(settings.ads_column_widths)
    }
  }, [settings?.ads_column_widths])

  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        setUserName(
          user.user_metadata?.full_name || user.email?.split("@")[0] || "User"
        )
      }
    }
    getUser()
  }, [])

  // Fetch CTA options from API (Meta official list)
  useEffect(() => {
    async function fetchCTA() {
      try {
        const res = await fetch("/api/meta/cta")
        const data = await res.json()
        setCtaOptions(data.cta_options || [])
      } catch {
        /* ignore */
      }
    }
    fetchCTA()
  }, [])

  // Fetch page links
  useEffect(() => {
    async function fetchPageLinks() {
      try {
        const res = await fetch("/api/page-links")
        const data = await res.json()
        setPageLinks(data.pageLinks || [])
      } catch {
        /* ignore */
      }
    }
    fetchPageLinks()
  }, [])

  const fetchCreatives = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/creatives")
      const data = await res.json()
      setCreatives(data.creatives || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCreatives()
  }, [])

  // Realtime
  useRealtimeCreatives({
    orgId: activeOrgId || "",
    onInsert: useCallback((record: any) => {
      if (pendingEditsRef.current.has(`insert:${record.id}`)) {
        pendingEditsRef.current.delete(`insert:${record.id}`)
        return
      }
      setCreatives((prev) => [...prev, record])
    }, []),
    onUpdate: useCallback((record: any) => {
      if (pendingEditsRef.current.has(`update:${record.id}`)) {
        pendingEditsRef.current.delete(`update:${record.id}`)
        return
      }
      setCreatives((prev) =>
        prev.map((c) => (c.id === record.id ? { ...c, ...record } : c))
      )
    }, []),
    onDelete: useCallback((oldRecord: any) => {
      if (pendingEditsRef.current.has(`delete:${oldRecord.id}`)) {
        pendingEditsRef.current.delete(`delete:${oldRecord.id}`)
        return
      }
      setCreatives((prev) => prev.filter((c) => c.id !== oldRecord.id))
    }, []),
  })

  // Presence
  const { others, updateMyCell } = useCreativesPresence({
    orgId: activeOrgId || "",
    userId,
    userName,
  })

  const presenceMap = useMemo(() => buildPresenceMap(others), [others])

  // Create CTA editor with fetched options
  const CTAEditorComponent = useMemo(
    () => createCTAEditor(ctaOptions),
    [ctaOptions]
  )

  // Create Link viewer/editor with fetched page links
  const LinkViewerComponent = useMemo(
    () => createLinkViewer(pageLinks),
    [pageLinks]
  )
  const LinkEditorComponent = useMemo(
    () => createLinkEditor(pageLinks),
    [pageLinks]
  )

  // Debounced auto-save
  const saveCell = useCallback(
    async (creativeId: string, field: string, value: string) => {
      pendingEditsRef.current.add(`update:${creativeId}`)
      setTimeout(
        () => pendingEditsRef.current.delete(`update:${creativeId}`),
        5000
      )
      try {
        await fetch(`/api/creatives/${creativeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        })
      } catch {
        /* ignore */
      }
    },
    []
  )

  const debouncedSave = useCallback(
    (creativeId: string, field: string, value: string) => {
      const key = `${creativeId}:${field}`
      const existing = saveTimerRef.current.get(key)
      if (existing) clearTimeout(existing)
      saveTimerRef.current.set(
        key,
        setTimeout(() => {
          saveCell(creativeId, field, value)
          saveTimerRef.current.delete(key)
        }, 500)
      )
    },
    [saveCell]
  )

  // Filtered creatives
  const filteredCreatives = useMemo(() => {
    let result = creatives
    if (filterStatus && filterStatus !== "all") {
      result = result.filter((c) => (c.status || "ready") === filterStatus)
    }
    if (filterCta && filterCta !== "all") {
      result = result.filter((c) => (c.cta || "LEARN_MORE") === filterCta)
    }
    if (filterPage && filterPage !== "all") {
      result = result.filter((c) => c.link_url === filterPage)
    }
    if (filterSearch) {
      const q = filterSearch.toLowerCase()
      result = result.filter(
        (c) =>
          c.file_name?.toLowerCase().includes(q) ||
          c.headline?.toLowerCase().includes(q) ||
          c.primary_text?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q)
      )
    }
    return result
  }, [creatives, filterStatus, filterSearch, filterCta, filterPage])

  // Handle spreadsheet changes (maps filtered rows back to full creatives array)
  const handleChange = useCallback(
    (newData: Matrix<CellBase>) => {
      pushUndo()
      setCreatives((prev) => {
        const updated = [...prev]
        // Build filtered->original index map
        const filteredIds = filteredCreatives.map((c) => c.id)
        for (let row = 0; row < newData.length; row++) {
          if (row >= filteredIds.length) break
          const originalIdx = updated.findIndex((c) => c.id === filteredIds[row])
          if (originalIdx === -1) continue
          const creative = updated[originalIdx]
          for (let col = 0; col < FIELDS.length; col++) {
            const field = FIELDS[col]
            if (field === "file_preview") continue
            const newValue = newData[row]?.[col]?.value?.toString() || ""
            const oldValue = (creative as any)[field] || ""
            if (newValue !== oldValue) {
              ;(updated[originalIdx] as any) = { ...updated[originalIdx], [field]: newValue }
              debouncedSave(creative.id, field, newValue)
            }
          }
        }
        return updated
      })
    },
    [debouncedSave, filteredCreatives, pushUndo]
  )

  // Track active cell for presence + selection range for copy/paste
  const handleSelect = useCallback(
    (selected: any) => {
      if (selected?.range) {
        const { start, end } = selected.range
        selectedRangeRef.current = {
          startRow: Math.min(start.row, end.row),
          startCol: Math.min(start.column, end.column),
          endRow: Math.max(start.row, end.row),
          endCol: Math.max(start.column, end.column),
        }
        if (start.row < creatives.length && start.column < FIELDS.length) {
          updateMyCell(creatives[start.row].id, FIELDS[start.column])
        }
      } else {
        selectedRangeRef.current = null
      }
    },
    [creatives, updateMyCell]
  )


  // Custom paste via native DOM listener (capture phase) to intercept before react-spreadsheet
  const spreadsheetContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const container = spreadsheetContainerRef.current
      if (!container || !container.contains(e.target as Node)) return

      const tag = (e.target as HTMLElement).tagName
      if (tag === "TEXTAREA" || tag === "INPUT") return

      const range = selectedRangeRef.current
      if (!range) return

      e.preventDefault()
      e.stopImmediatePropagation()

      const text = e.clipboardData?.getData("text/plain") || ""

      let pasteData: string[][]
      const internalText = clipboardRef.current ? toTSVWithQuotes(clipboardRef.current) : null
      if (clipboardRef.current && internalText === text) {
        pasteData = clipboardRef.current
      } else {
        const isSingleCell = range.startRow === range.endRow && range.startCol === range.endCol
        if (isSingleCell && !text.includes("\t")) {
          pasteData = [[text]]
        } else {
          pasteData = parseTSVWithQuotes(text)
        }
      }

      // Push undo before paste
      undoStackRef.current.push(JSON.parse(JSON.stringify(creativesRef.current)))
      if (undoStackRef.current.length > 50) undoStackRef.current.shift()

      const startRow = range.startRow
      const startCol = range.startCol

      setCreatives((prev) => {
        const updated = [...prev]
        for (let r = 0; r < pasteData.length; r++) {
          const targetRow = startRow + r
          if (targetRow >= updated.length) break
          for (let c = 0; c < pasteData[r].length; c++) {
            let targetCol = startCol + c
            // Skip file_preview column when pasting
            if (FIELDS[targetCol] === "file_preview") targetCol++
            if (targetCol >= FIELDS.length) break
            const field = FIELDS[targetCol]
            if (field === "file_preview") continue
            const value = pasteData[r][c]
            updated[targetRow] = { ...updated[targetRow], [field]: value }
            debouncedSave(updated[targetRow].id, field, value)
          }
        }
        return updated
      })
    }

    const handleCopy = (e: ClipboardEvent) => {
      const container = spreadsheetContainerRef.current
      if (!container || !container.contains(e.target as Node)) return

      const tag = (e.target as HTMLElement).tagName
      if (tag === "TEXTAREA" || tag === "INPUT") return

      const range = selectedRangeRef.current
      if (!range) return

      e.preventDefault()
      e.stopImmediatePropagation()

      const rows: string[][] = []
      const currentCreatives = creativesRef.current
      for (let r = range.startRow; r <= range.endRow; r++) {
        if (r >= currentCreatives.length) break
        const row: string[] = []
        for (let c = range.startCol; c <= range.endCol; c++) {
          const field = FIELDS[c]
          // Skip file_preview when copying
          if (field === "file_preview") continue
          const val = String((currentCreatives[r] as any)[field] || "")
          row.push(val)
        }
        rows.push(row)
      }

      const text = toTSVWithQuotes(rows)
      clipboardRef.current = rows
      e.clipboardData?.setData("text/plain", text)
    }

    // Ctrl+Z undo handler
    const handleKeyDown = (e: KeyboardEvent) => {
      const container = spreadsheetContainerRef.current
      if (!container || !container.contains(e.target as Node)) return

      const tag = (e.target as HTMLElement).tagName
      if (tag === "TEXTAREA" || tag === "INPUT") return

      const isUndo = (e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey
      if (isUndo) {
        e.preventDefault()
        e.stopImmediatePropagation()
        const prev = undoStackRef.current.pop()
        if (prev) {
          setCreatives(prev)
          // Save all changed fields back to DB
          const current = creativesRef.current
          for (const c of prev) {
            const old = current.find((o) => o.id === c.id)
            if (!old) continue
            for (const field of FIELDS) {
              if (field === "file_preview") continue
              if ((c as any)[field] !== (old as any)[field]) {
                debouncedSave(c.id, field, (c as any)[field] || "")
              }
            }
          }
        }
      }
    }

    document.addEventListener("paste", handlePaste, true)
    document.addEventListener("copy", handleCopy, true)
    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("paste", handlePaste, true)
      document.removeEventListener("copy", handleCopy, true)
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [debouncedSave])

  // Context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()

      const target = e.target as HTMLElement
      const row = target.closest("tr")
      if (!row) return

      // Check row has a "row" attribute (data rows have row="0", row="1", etc.)
      const rowAttr = row.getAttribute("row")
      if (rowAttr === null) return // Header row doesn't have "row" attr

      const rowIdx = parseInt(rowAttr)
      if (isNaN(rowIdx) || rowIdx < 0 || rowIdx >= creatives.length) return

      setContextMenu({ x: e.clientX, y: e.clientY, rowIdx, colIdx: 0 })
    },
    [creatives.length]
  )

  // Close context menu on click/scroll anywhere
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    // Delay to avoid closing immediately on the same click
    const timer = setTimeout(() => {
      document.addEventListener("click", close)
      document.addEventListener("scroll", close, true)
    }, 10)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("click", close)
      document.removeEventListener("scroll", close, true)
    }
  }, [contextMenu])

  // Delete row
  const handleDeleteRow = useCallback(
    async (rowIdx: number) => {
      if (rowIdx < 0 || rowIdx >= creatives.length) return
      const creative = creatives[rowIdx]
      pendingEditsRef.current.add(`delete:${creative.id}`)
      setCreatives((prev) => prev.filter((_, i) => i !== rowIdx))
      setContextMenu(null)
      try {
        await fetch(`/api/creatives/${creative.id}`, { method: "DELETE" })
      } catch {
        /* ignore */
      }
    },
    [creatives]
  )

  // Copy selected cells
  const handleCopyRow = useCallback(
    (rowIdx: number) => {
      if (rowIdx < 0 || rowIdx >= creatives.length) return
      const c = creatives[rowIdx]
      const text = FIELDS.filter((f) => f !== "file_preview")
        .map((f) => (c as any)[f] || "")
        .join("\t")
      navigator.clipboard.writeText(text)
      setContextMenu(null)
    },
    [creatives]
  )

  // Clear row (keep the row, clear text fields)
  const handleClearRow = useCallback(
    async (rowIdx: number) => {
      if (rowIdx < 0 || rowIdx >= creatives.length) return
      const creative = creatives[rowIdx]
      const cleared = {
        headline: "",
        primary_text: "",
        description: "",
        link_url: "",
      }
      setCreatives((prev) =>
        prev.map((c, i) => (i === rowIdx ? { ...c, ...cleared } : c))
      )
      setContextMenu(null)
      pendingEditsRef.current.add(`update:${creative.id}`)
      setTimeout(
        () => pendingEditsRef.current.delete(`update:${creative.id}`),
        5000
      )
      try {
        await fetch(`/api/creatives/${creative.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cleared),
        })
      } catch {
        /* ignore */
      }
    },
    [creatives]
  )

  // Duplicate row
  const handleDuplicateRow = useCallback(
    async (rowIdx: number) => {
      if (rowIdx < 0 || rowIdx >= creatives.length) return
      const src = creatives[rowIdx]
      setContextMenu(null)

      // Need to re-upload the file to Meta - for now, create with same data
      const formData = new FormData()
      // We need the original file, but we don't have it - create a copy via API
      // For now duplicate the DB record by fetching the image URL
      try {
        const imgRes = await fetch(src.fb_thumbnail_url || src.file_url)
        const blob = await imgRes.blob()
        const file = new File([blob], src.file_name, { type: blob.type })

        formData.append("file", file)
        formData.append("headline", src.headline || "")
        formData.append("primary_text", src.primary_text || "")
        formData.append("description", src.description || "")
        formData.append("cta", src.cta || "LEARN_MORE")
        formData.append("link_url", src.link_url || "")

        const res = await fetch("/api/creatives", {
          method: "POST",
          body: formData,
        })
        if (res.ok) {
          const data = await res.json()
          pendingEditsRef.current.add(`insert:${data.creative.id}`)
          setCreatives((prev) => [...prev, data.creative])
        }
      } catch {
        /* ignore */
      }
    },
    [creatives]
  )

  // File upload
  const handleNewUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("headline", "")
      formData.append("primary_text", "")
      formData.append("description", "")
      formData.append("cta", "LEARN_MORE")
      formData.append("link_url", pageLinks[0]?.url || "")
      const res = await fetch("/api/creatives", {
        method: "POST",
        body: formData,
      })
      if (res.ok) {
        const data = await res.json()
        pendingEditsRef.current.add(`insert:${data.creative.id}`)
        setCreatives((prev) => [...prev, data.creative])
      }
    } catch {
      /* ignore */
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // Spreadsheet data (uses filteredCreatives)
  const data = useMemo(
    () =>
      creativesToMatrix(
        filteredCreatives,
        presenceMap,
        CTAEditorComponent,
        LinkViewerComponent,
        LinkEditorComponent,
        pageLinks[0]?.url || ""
      ),
    [
      filteredCreatives,
      presenceMap,
      CTAEditorComponent,
      LinkViewerComponent,
      LinkEditorComponent,
      pageLinks,
    ]
  )
  const rowLabels = useMemo(
    () => filteredCreatives.map((_, i) => `${i + 1}`),
    [filteredCreatives]
  )

  // Filter handlers
  const handleFilterStatus = useCallback((status: string) => {
    setFilterStatus(status)
    updateSettings({ ads_filter: { status } })
  }, [updateSettings])

  // Column resize handler
  const handleColumnResize = useCallback((colIndex: number, newWidth: number) => {
    setColumnWidths((prev) => {
      const field = FIELDS[colIndex - 1] // colIndex includes row label column (nth-child is 1-indexed + row label)
      if (!field) return prev
      const updated = { ...prev, [field]: newWidth }
      updateSettings({ ads_column_widths: updated })
      return updated
    })
  }, [updateSettings])

  // Generate column width CSS from state
  const columnWidthCSS = useMemo(() => {
    const defaultWidths: Record<string, string> = {
      file_preview: "80px",
      file_name: "13%",
      headline: "14%",
      primary_text: "20%",
      description: "13%",
      cta: "13%",
      link_url: "14%",
      status: "90px",
    }
    return FIELDS.map((field, i) => {
      const w = columnWidths[field] ? `${columnWidths[field]}px` : defaultWidths[field] || "13%"
      const nth = i + 2 // nth-child(1) is row label, nth-child(2) is first data col
      return `.Spreadsheet th:nth-child(${nth}), .Spreadsheet td:nth-child(${nth}) { width: ${w}; min-width: 60px; }`
    }).join("\n")
  }, [columnWidths])

  // Column resize: inject drag handles into header cells
  useEffect(() => {
    const container = spreadsheetContainerRef.current
    if (!container) return

    const headers = container.querySelectorAll<HTMLTableCellElement>(".Spreadsheet th")
    const handles: HTMLDivElement[] = []

    headers.forEach((th, i) => {
      if (i === 0) return // skip row label column
      const handle = document.createElement("div")
      handle.className = "col-resize-handle"
      th.appendChild(handle)
      handles.push(handle)

      let startX = 0
      let startWidth = 0

      const onMouseMove = (e: MouseEvent) => {
        const newWidth = Math.max(60, startWidth + (e.clientX - startX))
        th.style.width = `${newWidth}px`
        const colIdx = i
        container.querySelectorAll<HTMLTableCellElement>(`.Spreadsheet td:nth-child(${colIdx + 1})`).forEach((td) => {
          td.style.width = `${newWidth}px`
        })
      }

      const onMouseUp = (e: MouseEvent) => {
        handle.classList.remove("active")
        document.removeEventListener("mousemove", onMouseMove)
        document.removeEventListener("mouseup", onMouseUp)
        const finalWidth = Math.max(60, startWidth + (e.clientX - startX))
        handleColumnResize(i, finalWidth)
      }

      handle.addEventListener("mousedown", (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        handle.classList.add("active")
        startX = e.clientX
        startWidth = th.offsetWidth
        document.addEventListener("mousemove", onMouseMove)
        document.addEventListener("mouseup", onMouseUp)
      })
    })

    return () => {
      handles.forEach((h) => h.remove())
    }
  }, [data, handleColumnResize])

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Ads Manager</h1>
          <p className="text-sm text-muted-foreground">
            Select, copy & paste like a spreadsheet. Changes auto-save.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PresenceAvatars users={others} />
          <Button size="sm" onClick={handleNewUpload} disabled={uploading}>
            {uploading ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconPlus className="size-4" />
            )}
            Upload Creative
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Filter bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative">
          <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search creatives..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="h-8 w-56 pl-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-1">
          <IconFilter className="size-4 text-muted-foreground" />
          {["all", "draft", "ready", "launched"].map((s) => (
            <Button
              key={s}
              variant={filterStatus === s ? "default" : "outline"}
              size="sm"
              className="h-7 px-2.5 text-xs capitalize"
              onClick={() => handleFilterStatus(s)}
            >
              {s}
            </Button>
          ))}
        </div>
        {/* CTA filter */}
        <select
          value={filterCta}
          onChange={(e) => setFilterCta(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          <option value="all">All CTA</option>
          {ctaOptions.map((cta) => (
            <option key={cta.value} value={cta.value}>{cta.label}</option>
          ))}
        </select>
        {/* Page filter */}
        <select
          value={filterPage}
          onChange={(e) => setFilterPage(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          <option value="all">All Pages</option>
          {pageLinks.map((p) => (
            <option key={p.id} value={p.url}>{p.name}</option>
          ))}
        </select>
        {(filterStatus !== "all" || filterSearch || filterCta !== "all" || filterPage !== "all") && (
          <span className="text-xs text-muted-foreground">
            {filteredCreatives.length} of {creatives.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <IconLoader2 className="size-5 animate-spin" />
        </div>
      ) : creatives.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <IconPhoto className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">No creatives yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Click &quot;Upload Creative&quot; to add your first one.
            </p>
          </div>
        </div>
      ) : (
        <div
          ref={spreadsheetContainerRef}
          className="flex-1 overflow-auto rounded-lg border"
          onContextMenu={handleContextMenu}
        >
          <style>{`
            .Spreadsheet { width: 100% !important; }
            .Spreadsheet table { width: 100% !important; table-layout: fixed; }
            .Spreadsheet th { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; position: relative; }
            .Spreadsheet td { overflow: hidden; padding:5px 10px; }
            .Spreadsheet td .Spreadsheet__data-viewer {
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .Spreadsheet td .multiline-cell {
              white-space: pre-wrap !important;
            }
            .Spreadsheet th:nth-child(1), .Spreadsheet td:nth-child(1) { width: 40px; text-align: center; }
            ${columnWidthCSS}
            .Spreadsheet .Spreadsheet__table tr { min-height: 40px; }
            .col-resize-handle {
              position: absolute;
              right: 0;
              top: 0;
              bottom: 0;
              width: 4px;
              cursor: col-resize;
              z-index: 5;
            }
            .col-resize-handle:hover,
            .col-resize-handle.active {
              background: var(--primary);
            }
            /* Theme-aware: map react-spreadsheet CSS vars to Tailwind theme */
            .Spreadsheet {
              --background-color: var(--background) !important;
              --text-color: var(--foreground) !important;
              --readonly-text-color: var(--muted-foreground) !important;
              --border-color: var(--border) !important;
              --header-background-color: var(--muted) !important;
              --outline-color: var(--primary) !important;
              --outline-background-color: color-mix(in srgb, var(--primary) 10%, transparent) !important;
            }
            .Spreadsheet__header--selected {
              background: var(--primary) !important;
              color: var(--primary-foreground) !important;
            }
          `}</style>
          <Spreadsheet
            data={data}
            darkMode={resolvedTheme === "dark"}
            columnLabels={HEADERS}
            rowLabels={rowLabels}
            onChange={handleChange}
            onSelect={handleSelect}
          />

          {/* Add row button */}
          <button
            onClick={handleNewUpload}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 border-t py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {uploading ? <IconLoader2 className="size-4 animate-spin" /> : <IconPlus className="size-4" />}
            Add Creative
          </button>

          {/* Context Menu */}
          {contextMenu && (
            <div
              className="fixed z-50 min-w-[180px] rounded-lg border bg-popover p-1 shadow-lg"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                onClick={() => handleCopyRow(contextMenu.rowIdx)}
              >
                <IconCopy className="size-4" />
                Copy Row
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                onClick={() => handleDuplicateRow(contextMenu.rowIdx)}
              >
                <IconRowInsertBottom className="size-4" />
                Duplicate Row
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                onClick={() => handleClearRow(contextMenu.rowIdx)}
              >
                <IconClearAll className="size-4" />
                Clear Row
              </button>
              <div className="my-1 h-px bg-border" />
              <button
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                onClick={() => handleDeleteRow(contextMenu.rowIdx)}
              >
                <IconTrash className="size-4" />
                Delete Row
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
