"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { COLUMN_DEFS, COLUMN_MAP, ColumnDef, ColumnTab } from "@/lib/column-config"
import { IconSearch, IconX, IconGripVertical, IconChevronDown, IconChevronLeft } from "@tabler/icons-react"

const TABS: { id: ColumnTab; label: string }[] = [
  { id: "key_metrics",  label: "Key metrics"  },
  { id: "tracking",     label: "Tracking"     },
  { id: "ad_settings",  label: "Ad settings"  },
  { id: "advanced",     label: "Advanced"     },
  { id: "custom",       label: "Custom"       },
]

// System columns — always present, cannot be removed
const REQUIRED_COLS = [
  { id: "select",        label: "select"        },
  { id: "status-toggle", label: "status-toggle" },
  { id: "campaignName",  label: "campaignName"  },
]

interface Props {
  open: boolean
  columnOrder: string[]
  onApply: (cols: string[]) => void
  onSavePreset: (name: string, cols: string[]) => void
  onClose: () => void
}

export function CustomizeColumnsModal({ open, columnOrder, onApply, onSavePreset, onClose }: Props) {
  const [localCols,      setLocalCols]      = useState<string[]>([])
  const [searchQuery,    setSearchQuery]    = useState("")
  const [activeTab,      setActiveTab]      = useState<ColumnTab>("key_metrics")
  const [collapsed,      setCollapsed]      = useState<Record<string, boolean>>({})
  const [dragOverIdx,    setDragOverIdx]    = useState<number | null>(null)
  const [showSaveInput,  setShowSaveInput]  = useState(false)
  const [savePresetName, setSavePresetName] = useState("")
  const dragStartIdx = useRef<number | null>(null)

  useEffect(() => {
    if (open) {
      setLocalCols([...columnOrder])
      setSearchQuery("")
      setActiveTab("key_metrics")
      setCollapsed({})
      setShowSaveInput(false)
      setSavePresetName("")
    }
  }, [open, columnOrder])

  if (!open) return null

  const toggleCol = (colId: string) => {
    setLocalCols(prev =>
      prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]
    )
  }

  // Custom tab: all columns sorted alphabetically as one flat group
  const filteredDefs: ColumnDef[] = searchQuery
    ? COLUMN_DEFS.filter(c =>
        c.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.headerLabel.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activeTab === "custom"
      ? [...COLUMN_DEFS].sort((a, b) => a.label.localeCompare(b.label))
      : COLUMN_DEFS.filter(c => c.tab === activeTab)

  const sectionGroups = (activeTab === "custom" && !searchQuery)
    ? [{ section: "all_columns", label: "All columns", cols: filteredDefs }]
    : (() => {
        const order = Array.from(new Set(filteredDefs.map(c => c.section)))
        return order.map(s => ({
          section: s,
          label:   filteredDefs.find(c => c.section === s)!.sectionLabel,
          cols:    filteredDefs.filter(c => c.section === s),
        }))
      })()

  const allCollapsed = sectionGroups.length > 0 && sectionGroups.every(g => !!collapsed[g.section])

  const toggleCollapseAll = () => {
    if (allCollapsed) {
      setCollapsed({})
    } else {
      setCollapsed(Object.fromEntries(sectionGroups.map(g => [g.section, true])))
    }
  }

  // Drag & drop handlers (right panel)
  const handleDragStart = (idx: number) => { dragStartIdx.current = idx }
  const handleDragOver  = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx) }
  const handleDragEnd   = () => { setDragOverIdx(null); dragStartIdx.current = null }
  const handleDrop = (idx: number) => {
    const from = dragStartIdx.current
    if (from === null || from === idx) { handleDragEnd(); return }
    const next = [...localCols]
    const [moved] = next.splice(from, 1)
    next.splice(idx, 0, moved)
    setLocalCols(next)
    handleDragEnd()
  }

  const commitSavePreset = () => {
    if (savePresetName.trim()) onSavePreset(savePresetName.trim(), localCols)
    setShowSaveInput(false)
    setSavePresetName("")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="bg-white dark:bg-card w-[900px] max-w-[96vw] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "min(90vh, 680px)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#1c2b33] dark:text-white">Customise columns</h2>
            <p className="text-sm text-[#65676b] dark:text-muted-foreground mt-0.5">
              Choose which columns to show and arrange how they appear in the table.
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-full hover:bg-muted/50 transition-colors text-muted-foreground mt-0.5"
          >
            <IconX className="size-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 min-h-0">
          {/* ── Left panel ── */}
          <div className="flex flex-col w-[58%] border-r min-h-0">
            {/* Search + Collapse all */}
            <div className="px-4 pt-4 pb-3 shrink-0 flex items-center gap-2">
              <div className="relative flex-1">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50 pointer-events-none" />
                <input
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setCollapsed({}) }}
                  placeholder="Search for metrics or column settings"
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg outline-none focus:ring-1 focus:ring-ring bg-background"
                />
              </div>
              <button
                onClick={toggleCollapseAll}
                className="flex items-center gap-1.5 h-9 px-3 text-xs border rounded-lg hover:bg-muted/50 transition-colors text-[#65676b] dark:text-muted-foreground whitespace-nowrap shrink-0"
              >
                <IconChevronLeft className={cn("size-3.5 transition-transform", allCollapsed && "rotate-180")} />
                {allCollapsed ? "Expand all" : "Collapse all"}
              </button>
            </div>

            {/* Tab pills — hide when searching */}
            {!searchQuery && (
              <div className="flex items-center gap-1 px-4 pb-3 shrink-0 border-b flex-wrap">
                {TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setActiveTab(t.id); setCollapsed({}) }}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-lg transition-colors font-medium",
                      activeTab === t.id
                        ? "bg-[#e7f3ff] text-[#1877f2]"
                        : "text-[#65676b] dark:text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {/* Metric sections */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {sectionGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No metrics found</p>
              ) : sectionGroups.map(({ section, label, cols }) => {
                const isCollapsed = !!collapsed[section]
                const selectedN   = cols.filter(c => localCols.includes(c.id)).length
                return (
                  <div key={section} className="border rounded-xl overflow-hidden">
                    {/* Section header */}
                    <button
                      onClick={() => setCollapsed(p => ({ ...p, [section]: !p[section] }))}
                      className="w-full flex items-center justify-between px-4 py-3 bg-[#f7f8fa] dark:bg-muted/30 hover:bg-[#f0f2f5] dark:hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-[#1c2b33] dark:text-white">{label}</span>
                        {selectedN > 0 && (
                          <span className="text-xs text-[#65676b] dark:text-muted-foreground">
                            {selectedN} selected
                          </span>
                        )}
                      </div>
                      <IconChevronDown
                        className={cn("size-4 text-muted-foreground transition-transform", isCollapsed && "-rotate-90")}
                      />
                    </button>

                    {/* Metrics grid */}
                    {!isCollapsed && (
                      <div className="grid grid-cols-2 divide-x divide-y">
                        {cols.map(col => (
                          <label
                            key={col.id}
                            className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 size-4 rounded accent-[#1877f2] cursor-pointer shrink-0"
                              checked={localCols.includes(col.id)}
                              onChange={() => toggleCol(col.id)}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-[#1c2b33] dark:text-white leading-tight">
                                {col.label}
                              </p>
                              <p className="text-xs text-[#65676b] dark:text-muted-foreground mt-0.5">
                                {col.description}
                              </p>
                            </div>
                          </label>
                        ))}
                        {/* Pad odd-count grids so last row always has 2 cells */}
                        {cols.length % 2 !== 0 && (
                          <div className="px-4 py-3 bg-[#fafafa] dark:bg-muted/5" />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Right panel ── */}
          <div className="flex flex-col w-[42%] min-h-0">
            <div className="px-4 py-3 border-b shrink-0">
              <p className="text-xs font-bold text-[#1c2b33] dark:text-white">
                {localCols.length + REQUIRED_COLS.length} columns selected
              </p>
              <p className="text-xs text-[#65676b] dark:text-muted-foreground mt-0.5">
                Drag and drop to arrange the order they appear in the table.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto divide-y">
              {/* Required columns — always on top, no drag */}
              {REQUIRED_COLS.map(col => (
                <div key={col.id} className="flex items-center gap-3 px-4 py-2.5 select-none">
                  <IconGripVertical className="size-3.5 text-muted-foreground/20 shrink-0" />
                  <span className="flex-1 text-xs text-[#1c2b33] dark:text-white">{col.label}</span>
                  <span className="text-xs text-muted-foreground">Required</span>
                </div>
              ))}

              {/* Draggable optional columns */}
              {localCols.map((colId, idx) => {
                const colDef = COLUMN_MAP[colId]
                if (!colDef) return null
                const isDragTarget = dragOverIdx === idx && dragStartIdx.current !== idx
                return (
                  <div
                    key={colId}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={e  => handleDragOver(e, idx)}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 cursor-grab active:cursor-grabbing transition-colors select-none",
                      isDragTarget
                        ? "bg-blue-50 dark:bg-blue-950/30 border-t-2 border-blue-500"
                        : "hover:bg-muted/30"
                    )}
                  >
                    <IconGripVertical className="size-3.5 text-muted-foreground/50 shrink-0" />
                    <span className="flex-1 text-xs text-[#1c2b33] dark:text-white">{colDef.label}</span>
                    <button
                      onClick={() => toggleCol(colId)}
                      className="size-5 flex items-center justify-center rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      <IconX className="size-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-[#f7f8fa] dark:bg-muted/20 shrink-0">
          {/* Save preset */}
          <div className="flex items-center gap-2">
            {showSaveInput ? (
              <>
                <input
                  type="text"
                  value={savePresetName}
                  onChange={e => setSavePresetName(e.target.value)}
                  placeholder="Preset name..."
                  autoFocus
                  className="h-8 w-44 px-3 text-sm border rounded-lg outline-none focus:ring-1 focus:ring-ring bg-white dark:bg-background"
                  onKeyDown={e => {
                    if (e.key === "Enter") commitSavePreset()
                    if (e.key === "Escape") setShowSaveInput(false)
                  }}
                />
                <button
                  onClick={commitSavePreset}
                  className="h-8 px-3 text-xs bg-[#1877f2] text-white rounded-lg hover:bg-[#1464d8] transition-colors font-semibold"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowSaveInput(false)}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowSaveInput(true)}
                className="text-xs text-[#1877f2] font-semibold hover:underline"
              >
                Save as column preset
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="h-8 px-4 text-sm border rounded-lg hover:bg-muted/50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => { onApply(localCols); onClose() }}
              className="h-8 px-5 text-sm bg-[#1877f2] text-white rounded-lg hover:bg-[#1464d8] transition-colors font-semibold"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
