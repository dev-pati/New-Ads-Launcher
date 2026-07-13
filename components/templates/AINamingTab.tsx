"use client"

import { useState, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import { useNamingSchema, type SchemaCategory, type SchemaOption } from "@/hooks/use-naming-schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  IconGripVertical, IconPencil, IconX, IconPlus, IconSparkles,
  IconLoader2, IconCheck, IconUpload, IconLink, IconCopy,
  IconCloudDownload, IconAlertCircle,
} from "@tabler/icons-react"

// ── Suggested categories shown as ghost cards (not yet in active schema) ──────

const SUGGESTED_CATEGORIES: Omit<SchemaCategory, "id">[] = [
  {
    name: "OriginalFilename",
    description: "The original filename of the uploaded asset (without extension). Auto-derived from upload.",
    isAI: false,
    autoDetect: true,
    options: [],
  },
  {
    name: "Benefit",
    description: "Primary user benefit or value proposition shown in the ad (e.g., SavesTime, SavesMoney, LooksYounger...).",
    isAI: true,
    autoDetect: false,
    options: [],
  },
]

// ── Detect dimensions from image/video file (browser-side) ────────────────────

function detectDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve => {
    if (file.type.startsWith("image/")) {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload  = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }) }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
      img.src = url
    } else if (file.type.startsWith("video/")) {
      const vid = document.createElement("video")
      const url = URL.createObjectURL(file)
      vid.preload = "metadata"
      vid.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve({ width: vid.videoWidth, height: vid.videoHeight }) }
      vid.onerror           = () => { URL.revokeObjectURL(url); resolve(null) }
      vid.src = url
    } else {
      resolve(null)
    }
  })
}

function detectVideoDuration(file: File): Promise<number | null> {
  return new Promise(resolve => {
    if (!file.type.startsWith("video/")) { resolve(null); return }
    const vid = document.createElement("video")
    const url = URL.createObjectURL(file)
    vid.preload = "metadata"
    vid.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(vid.duration) }
    vid.onerror           = () => { URL.revokeObjectURL(url); resolve(null) }
    vid.src = url
  })
}

function dimensionLabel(w: number, h: number): string {
  const ratio = w / h
  if (Math.abs(ratio - 9 / 16) < 0.05) return "9x16"
  if (Math.abs(ratio - 4 / 5)  < 0.05) return "4x5"
  if (Math.abs(ratio - 1)      < 0.05) return "1x1"
  if (Math.abs(ratio - 16 / 9) < 0.05) return "16x9"
  return "NonStandard"
}

function durationLabel(secs: number): string {
  if (secs < 10)  return "Under10s"
  if (secs < 20)  return "10-20s"
  if (secs < 30)  return "20-30s"
  if (secs < 45)  return "30-45s"
  if (secs < 60)  return "45s-1m"
  if (secs < 90)  return "1m-1m30s"
  return "1m30s+"
}

// ── Schema category card ───────────────────────────────────────────────────────

function CategoryCard({
  cat,
  index,
  onEdit,
  onRemove,
  onAddOption,
  onRemoveOption,
  dragProps,
}: {
  cat: SchemaCategory
  index: number
  onEdit: (id: string, patch: Partial<SchemaCategory>) => void
  onRemove: (id: string) => void
  onAddOption: (catId: string, value: string) => void
  onRemoveOption: (catId: string, optId: string) => void
  dragProps: {
    draggable: boolean
    onDragStart: () => void
    onDragOver: (e: React.DragEvent) => void
    onDrop: () => void
    onDragEnd: () => void
    isDragTarget: boolean
  }
}) {
  const [editing,    setEditing]    = useState(false)
  const [editName,   setEditName]   = useState(cat.name)
  const [editDesc,   setEditDesc]   = useState(cat.description)
  const [addingOpt,  setAddingOpt]  = useState(false)
  const [optInput,   setOptInput]   = useState("")
  const optRef = useRef<HTMLInputElement>(null)

  function commitEdit() {
    if (editName.trim()) onEdit(cat.id, { name: editName.trim(), description: editDesc.trim() })
    setEditing(false)
  }

  function commitOption() {
    if (optInput.trim()) { onAddOption(cat.id, optInput.trim()); setOptInput("") }
    setAddingOpt(false)
  }

  return (
    <div
      className={cn(
        "border rounded-xl p-4 bg-white dark:bg-card transition-colors",
        dragProps.isDragTarget && "border-blue-400 bg-blue-50 dark:bg-blue-950/20"
      )}
      draggable={dragProps.draggable}
      onDragOver={dragProps.onDragOver}
      onDrop={dragProps.onDrop}
      onDragEnd={dragProps.onDragEnd}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <div
          className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground/70 shrink-0"
          draggable={dragProps.draggable}
          onDragStart={dragProps.onDragStart}
        >
          <IconGripVertical className="size-4" />
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-1.5">
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="h-7 text-xs font-semibold"
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false) }}
              />
              <Input
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                className="h-7 text-xs"
                placeholder="Description..."
                onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false) }}
                onBlur={commitEdit}
              />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="size-5 rounded-full bg-slate-100 dark:bg-muted text-xs font-bold text-slate-500 dark:text-muted-foreground flex items-center justify-center shrink-0">
                  {index + 1}
                </span>
                <p className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                  {cat.name}
                </p>
                {cat.isAI && (
                  <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
                    AI
                  </span>
                )}
                {cat.autoDetect && (
                  <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400">
                    Auto
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-muted-foreground mt-0.5 line-clamp-2">
                {cat.description}
              </p>
            </>
          )}
        </div>

        {!editing && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => { setEditName(cat.name); setEditDesc(cat.description); setEditing(true) }}
              className="size-6 flex items-center justify-center rounded hover:bg-muted/50 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <IconPencil className="size-3" />
            </button>
            <button
              onClick={() => onRemove(cat.id)}
              className="size-6 flex items-center justify-center rounded hover:bg-red-50 text-muted-foreground/60 hover:text-red-500 transition-colors"
            >
              <IconX className="size-3" />
            </button>
          </div>
        )}
      </div>

      {/* Options */}
      {!cat.isAI && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {cat.options.map(opt => (
            <span
              key={opt.id}
              className="group/opt flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-muted text-xs text-slate-700 dark:text-slate-300"
            >
              {opt.value}
              <button
                onClick={() => onRemoveOption(cat.id, opt.id)}
                className="opacity-0 group-hover/opt:opacity-100 transition-opacity"
              >
                <IconX className="size-2.5 text-slate-400 hover:text-red-500" />
              </button>
            </span>
          ))}

          {addingOpt ? (
            <input
              ref={optRef}
              value={optInput}
              onChange={e => setOptInput(e.target.value)}
              autoFocus
              placeholder="Option..."
              className="h-6 w-24 px-2 text-xs border rounded-full outline-none focus:ring-1 focus:ring-primary bg-background"
              onKeyDown={e => { if (e.key === "Enter") commitOption(); if (e.key === "Escape") { setAddingOpt(false); setOptInput("") } }}
              onBlur={commitOption}
            />
          ) : (
            <button
              onClick={() => { setAddingOpt(true); setTimeout(() => optRef.current?.focus(), 0) }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed text-xs text-slate-400 hover:text-slate-600 hover:border-slate-400 transition-colors"
            >
              <IconPlus className="size-3" />Add option...
            </button>
          )}
        </div>
      )}

      {cat.isAI && (
        <p className="mt-2 text-xs text-purple-500 dark:text-purple-400 italic">
          AI-generated values
        </p>
      )}
    </div>
  )
}

// ── Test AI Naming ─────────────────────────────────────────────────────────────

interface TestFile {
  id: string
  name: string             // original filename without ext
  ext: string
  type: "image" | "video" | "other"
  dimensions?: string
  length?: string
  selections: Record<string, string>   // categoryId → selected value
  aiValues: Record<string, string>     // categoryName → AI-generated value
  aiLoading: boolean
  aiError: string | null
}

function buildFilename(categories: SchemaCategory[], file: TestFile): string {
  const parts = categories.map(cat => {
    if (cat.autoDetect && cat.name === "OriginalFilename") return file.name
    if (cat.autoDetect && cat.name === "Length")           return file.length || "n/a"
    if (cat.autoDetect && cat.name === "Dimensions")       return file.dimensions || "NonStandard"
    if (cat.isAI)  return file.aiValues[cat.name] || `[${cat.name}]`
    return file.selections[cat.id] || `[${cat.name}]`
  })
  return parts.join("_") + (file.ext ? `.${file.ext}` : "")
}

function TestNamingSection({ categories }: { categories: SchemaCategory[] }) {
  const [files,       setFiles]      = useState<TestFile[]>([])
  const [urlInput,    setUrlInput]   = useState("")
  const [draggingOver, setDragOver] = useState(false)
  const [copiedId,    setCopied]    = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const aiCategories = categories.filter(c => c.isAI)

  async function processFile(rawFile: File) {
    const dotIdx     = rawFile.name.lastIndexOf(".")
    const name = dotIdx > 0 ? rawFile.name.slice(0, dotIdx) : rawFile.name
    const ext  = dotIdx > 0 ? rawFile.name.slice(dotIdx + 1).toLowerCase() : ""
    const type: TestFile["type"] = rawFile.type.startsWith("image/")
      ? "image"
      : rawFile.type.startsWith("video/")
        ? "video"
        : "other"

    const [dims, dur] = await Promise.all([
      detectDimensions(rawFile),
      detectVideoDuration(rawFile),
    ])

    const dimensions = dims ? dimensionLabel(dims.width, dims.height) : undefined
    const length = dur != null ? durationLabel(dur) : type === "image" ? "n/a" : undefined

    const entry: TestFile = {
      id: crypto.randomUUID(),
      name,
      ext,
      type,
      dimensions,
      length,
      selections: {},
      aiValues: {},
      aiLoading: aiCategories.length > 0,
      aiError: null,
    }
    setFiles(prev => [...prev, entry])

    if (aiCategories.length > 0) {
      try {
        const res = await fetch("/api/naming/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: rawFile.name, aiCategories }),
        })
        const d = await res.json()
        if (!res.ok) throw new Error(d.error || "AI failed")
        setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, aiLoading: false, aiValues: d.values || {} } : f))
      } catch (e: any) {
        setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, aiLoading: false, aiError: e.message } : f))
      }
    }
  }

  async function processUrl(url: string) {
    const trimmed = url.trim()
    if (!trimmed) return
    const segments = trimmed.split("/")
    const rawName  = segments[segments.length - 1].split("?")[0]
    const dotIdx   = rawName.lastIndexOf(".")
    const name = dotIdx > 0 ? rawName.slice(0, dotIdx) : rawName || "asset"
    const ext  = dotIdx > 0 ? rawName.slice(dotIdx + 1).toLowerCase() : ""

    const entry: TestFile = {
      id: crypto.randomUUID(),
      name,
      ext,
      type: "other",
      selections: {},
      aiValues: {},
      aiLoading: aiCategories.length > 0,
      aiError: null,
    }
    setFiles(prev => [...prev, entry])
    setUrlInput("")

    if (aiCategories.length > 0) {
      try {
        const res = await fetch("/api/naming/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: rawName || name, aiCategories }),
        })
        const d = await res.json()
        if (!res.ok) throw new Error(d.error || "AI failed")
        setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, aiLoading: false, aiValues: d.values || {} } : f))
      } catch (e: any) {
        setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, aiLoading: false, aiError: e.message } : f))
      }
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const dropped = Array.from(e.dataTransfer.files)
    dropped.forEach(f => processFile(f))
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || [])
    selected.forEach(f => processFile(f))
    e.target.value = ""
  }

  function setSelection(fileId: string, catId: string, value: string) {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, selections: { ...f.selections, [catId]: value } } : f))
  }

  function copyFilename(fileId: string, filename: string) {
    navigator.clipboard.writeText(filename).catch(() => {})
    setCopied(fileId)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="mt-6">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Test AI Naming</h3>
        <p className="text-xs text-slate-500 dark:text-muted-foreground">
          Upload files to test your naming schema
        </p>
      </div>

      {/* Drop zone + URL input */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 gap-2 cursor-pointer transition-colors",
            draggingOver ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20" : "border-slate-200 dark:border-border hover:border-slate-300"
          )}
          onClick={() => fileInput.current?.click()}
        >
          <IconUpload className="size-6 text-slate-400" />
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Drag & Drop</p>
          <p className="text-xs text-slate-400">or click to select files</p>
          <input ref={fileInput} type="file" multiple className="hidden" onChange={onFileInput} accept="image/*,video/*" />
        </div>

        <div className="border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 gap-3">
          <IconLink className="size-6 text-slate-400" />
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Paste URLs</p>
          <div className="flex gap-2 w-full max-w-xs">
            <Input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://..."
              className="h-8 text-xs flex-1"
              onKeyDown={e => { if (e.key === "Enter") processUrl(urlInput) }}
            />
            <Button size="sm" className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={() => processUrl(urlInput)}>
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      {files.length > 0 && (
        <div className="mt-4 space-y-3">
          {files.map(file => {
            const filename = buildFilename(categories, file)
            return (
              <div key={file.id} className="border rounded-xl p-4 bg-white dark:bg-card">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-muted-foreground uppercase tracking-wide">
                      Original
                    </p>
                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      {file.name}{file.ext ? `.${file.ext}` : ""}
                    </p>
                  </div>
                  <button onClick={() => setFiles(prev => prev.filter(f => f.id !== file.id))} className="text-muted-foreground/50 hover:text-muted-foreground">
                    <IconX className="size-4" />
                  </button>
                </div>

                {/* Auto-detected info */}
                <div className="flex flex-wrap gap-2 mb-3 text-xs">
                  {file.type !== "other" && (
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-muted rounded-full capitalize">
                      {file.type}
                    </span>
                  )}
                  {file.dimensions && (
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-full">
                      {file.dimensions}
                    </span>
                  )}
                  {file.length && (
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-full">
                      {file.length}
                    </span>
                  )}
                </div>

                {/* Manual selectors for non-AI, non-auto categories */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {categories
                    .filter(c => !c.isAI && !c.autoDetect && c.options.length > 0)
                    .map(cat => (
                      <div key={cat.id} className="flex flex-col gap-1">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{cat.name}</p>
                        <div className="flex flex-wrap gap-1">
                          {cat.options.map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setSelection(file.id, cat.id, opt.value)}
                              className={cn(
                                "px-2 py-0.5 rounded-full text-xs border transition-colors",
                                file.selections[cat.id] === opt.value
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "border-slate-200 text-slate-600 dark:text-slate-400 hover:border-blue-300"
                              )}
                            >
                              {opt.value}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>

                {/* AI values */}
                {aiCategories.length > 0 && (
                  <div className="mb-3">
                    {file.aiLoading ? (
                      <div className="flex items-center gap-2 text-xs text-purple-500">
                        <IconLoader2 className="size-3.5 animate-spin" />
                        Generating AI values...
                      </div>
                    ) : file.aiError ? (
                      <div className="flex items-center gap-2 text-xs text-amber-500">
                        <IconAlertCircle className="size-3.5" />
                        AI unavailable — {file.aiError}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {aiCategories.map(cat => (
                          <div key={cat.id} className="flex flex-col gap-1">
                            <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide">{cat.name} (AI)</p>
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 text-xs">
                              {file.aiValues[cat.name] || "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Generated filename */}
                <div className="pt-3 border-t">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                    Generated Filename
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-slate-50 dark:bg-muted/30 px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 break-all">
                      {filename}
                    </code>
                    <button
                      onClick={() => copyFilename(file.id, filename)}
                      className="shrink-0 size-8 flex items-center justify-center rounded-lg border hover:bg-muted/50 transition-colors text-muted-foreground"
                    >
                      {copiedId === file.id
                        ? <IconCheck className="size-3.5 text-green-500" />
                        : <IconCopy className="size-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Add Category Dialog (inline) ───────────────────────────────────────────────

function AddCategoryInline({ onAdd }: { onAdd: (cat: Omit<SchemaCategory, "id">) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [isAI, setIsAI] = useState(false)

  function commit() {
    if (!name.trim()) return
    onAdd({ name: name.trim(), description: desc.trim(), isAI, autoDetect: false, options: [] })
    setName(""); setDesc(""); setIsAI(false); setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="h-full min-h-[120px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors p-4"
      >
        <IconPlus className="size-5" />
        <span className="text-xs font-medium">Add Category</span>
      </button>
    )
  }

  return (
    <div className="border-2 border-blue-400 rounded-xl p-4 bg-blue-50 dark:bg-blue-950/20 space-y-2">
      <Input value={name} onChange={e => setName(e.target.value)} placeholder="Category name (e.g., Brand)" autoFocus className="h-8 text-sm" onKeyDown={e => { if (e.key === "Enter") commit() }} />
      <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" className="h-8 text-xs" onKeyDown={e => { if (e.key === "Enter") commit() }} />
      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
        <input type="checkbox" checked={isAI} onChange={e => setIsAI(e.target.checked)} className="rounded" />
        AI-generated value
      </label>
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={commit} disabled={!name.trim()}>
          <IconCheck className="size-3 mr-1" />Add
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={() => { setOpen(false); setName(""); setDesc("") }}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ── Main AINamingTab ───────────────────────────────────────────────────────────

export function AINamingTab() {
  const {
    categories, loading, saving, error, lastSaved, formatPreview,
    addCategory, updateCategory, removeCategory, reorderCategories,
    addOption, removeOption,
  } = useNamingSchema()

  const dragFrom = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const handleDragStart = useCallback((idx: number) => { dragFrom.current = idx }, [])
  const handleDragOver  = useCallback((e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx) }, [])
  const handleDragEnd   = useCallback(() => { setDragOverIdx(null); dragFrom.current = null }, [])
  const handleDrop      = useCallback((toIdx: number) => {
    const from = dragFrom.current
    if (from !== null && from !== toIdx) reorderCategories(from, toIdx)
    handleDragEnd()
  }, [reorderCategories, handleDragEnd])

  const suggestedNotAdded = SUGGESTED_CATEGORIES.filter(
    s => !categories.some(c => c.name === s.name)
  )

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {error && (
        <div className="mb-4 flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
          <IconAlertCircle className="size-4 shrink-0" />{error}
        </div>
      )}

      {/* Naming Schema */}
      <div className="border rounded-2xl p-5 bg-white dark:bg-card">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
              <IconSparkles className="size-4 text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Naming Schema</h3>
              <p className="text-xs text-slate-500 dark:text-muted-foreground font-mono">
                Format: {formatPreview}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saving && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <IconLoader2 className="size-3 animate-spin" />Saving...
              </div>
            )}
            {!saving && lastSaved && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <IconCheck className="size-3 text-green-500" />
                Saved {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
            {!saving && !lastSaved && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <IconCloudDownload className="size-3" />
                Auto-save on
              </div>
            )}
          </div>
        </div>

        {/* Category grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((cat, idx) => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              index={idx}
              onEdit={updateCategory}
              onRemove={removeCategory}
              onAddOption={addOption}
              onRemoveOption={removeOption}
              dragProps={{
                draggable: true,
                onDragStart: () => handleDragStart(idx),
                onDragOver: (e) => handleDragOver(e, idx),
                onDrop: () => handleDrop(idx),
                onDragEnd: handleDragEnd,
                isDragTarget: dragOverIdx === idx && dragFrom.current !== idx,
              }}
            />
          ))}

          {/* Suggested (ghost) categories */}
          {suggestedNotAdded.map(s => (
            <button
              key={s.name}
              onClick={() => addCategory(s)}
              className="border-2 border-dashed rounded-xl p-4 text-left hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/10 transition-colors group"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-xs font-semibold text-blue-500">{s.name}</p>
                {s.isAI && <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-500">AI</span>}
                {s.autoDetect && <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-green-100 text-green-600">Auto</span>}
              </div>
              <p className="text-xs text-slate-400 line-clamp-2">{s.description}</p>
              <p className="text-xs text-blue-400 mt-2 group-hover:underline">+ Click to add</p>
            </button>
          ))}

          {/* Add new category */}
          <AddCategoryInline onAdd={addCategory} />
        </div>
      </div>

      {/* Test AI Naming */}
      {categories.length > 0 && <TestNamingSection categories={categories} />}
    </div>
  )
}
