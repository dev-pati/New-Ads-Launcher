"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { cn } from "@/lib/utils"
import { COLUMN_DEFS, COLUMN_MAP, ColumnDef, ColumnTab, CustomMetricAccess, CustomMetricConfig, CustomMetricFormat, toColumnDef } from "@/lib/column-config"
import { IconSearch, IconX, IconGripVertical, IconChevronDown, IconChevronLeft, IconPlus } from "@tabler/icons-react"

const TABS: { id: ColumnTab; label: string }[] = [
  { id: "key_metrics",  label: "Key metrics"  },
  { id: "tracking",     label: "Tracking"     },
  { id: "ad_settings",  label: "Ad settings"  },
  { id: "advanced",     label: "Advanced"     },
  { id: "custom",       label: "Custom"       },
]

const REQUIRED_COLS = [
  { id: "select",        label: "select"        },
  { id: "status-toggle", label: "status-toggle" },
  { id: "campaignName",  label: "campaignName"  },
]

const OPS = ["+", "-", "*", "/", "(", ")"]
const FORMULA_ONLY_METRICS: ColumnDef[] = [
  { id: "post_engagements", label: "Post engagements", headerLabel: "Post engagements", description: "The number of engagement actions attributed to your ads.", tab: "custom", section: "custom_metrics_section", sectionLabel: "Custom metrics" },
]
const POPULAR = [
  { name: "Impressions to 3-second video plays rate", formula: ["video_views_3s", "/", "impressions"] },
  { name: "Impressions to post engagements rate", formula: ["post_engagements", "/", "impressions"] },
  { name: "Link clicks to landing page views rate", formula: ["landing_page_views", "/", "link_clicks"] },
  { name: "Video plays to link clicks rate", formula: ["link_clicks", "/", "video_views_3s"] },
  { name: "Link clicks to purchases rate", formula: ["purchases", "/", "link_clicks"] },
]

interface Props {
  open: boolean
  columnOrder: string[]
  customMetrics?: CustomMetricConfig[]
  onApply: (cols: string[]) => void
  onSavePreset: (name: string, cols: string[]) => void
  onSaveCustomMetric?: (metric: CustomMetricConfig) => void
  onClose: () => void
}

export function CustomizeColumnsModal({ open, columnOrder, customMetrics = [], onApply, onSavePreset, onSaveCustomMetric, onClose }: Props) {
  const [localCols,      setLocalCols]      = useState<string[]>([])
  const [searchQuery,    setSearchQuery]    = useState("")
  const [activeTab,      setActiveTab]      = useState<ColumnTab>("key_metrics")
  const [collapsed,      setCollapsed]      = useState<Record<string, boolean>>({})
  const [dragOverIdx,    setDragOverIdx]    = useState<number | null>(null)
  const [showSaveInput,  setShowSaveInput]  = useState(false)
  const [savePresetName, setSavePresetName] = useState("")
  const [showCreate,     setShowCreate]     = useState(false)
  const [metricName,     setMetricName]     = useState("")
  const [metricDesc,     setMetricDesc]     = useState("")
  const [metricFormat,   setMetricFormat]   = useState<CustomMetricFormat>("numeric")
  const [metricAccess,   setMetricAccess]   = useState<CustomMetricAccess>("only_you")
  const [formula,        setFormula]        = useState<string[]>([])
  const [showMetricMenu, setShowMetricMenu] = useState(false)
  const dragStartIdx = useRef<number | null>(null)

  const customDefs = useMemo(() => customMetrics.map(toColumnDef), [customMetrics])
  const allDefs = useMemo(() => [...COLUMN_DEFS, ...customDefs], [customDefs])
  const allMap = useMemo<Record<string, ColumnDef>>(() => ({ ...COLUMN_MAP, ...Object.fromEntries(customDefs.map(c => [c.id, c])) }), [customDefs])
  const formulaMetrics = useMemo(() => [...COLUMN_DEFS, ...FORMULA_ONLY_METRICS].sort((a, b) => a.label.localeCompare(b.label)), [])
  const labelById = useMemo(() => Object.fromEntries(formulaMetrics.map(m => [m.id, m.label])), [formulaMetrics])

  useEffect(() => {
    if (open) {
      setLocalCols([...columnOrder])
      setSearchQuery("")
      setActiveTab("key_metrics")
      setCollapsed({})
      setShowSaveInput(false)
      setSavePresetName("")
      setShowCreate(false)
    }
  }, [open, columnOrder])

  if (!open) return null

  const toggleCol = (colId: string) => {
    setLocalCols(prev => prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId])
  }

  const filteredDefs: ColumnDef[] = searchQuery
    ? allDefs.filter(c => c.label.toLowerCase().includes(searchQuery.toLowerCase()) || c.headerLabel.toLowerCase().includes(searchQuery.toLowerCase()))
    : activeTab === "custom"
      ? customDefs
      : allDefs.filter(c => c.tab === activeTab)

  const sectionGroups = activeTab === "custom" && !searchQuery
    ? [
        { section: "custom_only_you", label: "Only you", cols: customDefs.filter(c => customMetrics.find(m => m.id === c.id)?.access !== "business") },
        { section: "custom_business", label: "Everyone with access to this business", cols: customDefs.filter(c => customMetrics.find(m => m.id === c.id)?.access === "business") },
      ]
    : (() => {
        const order = Array.from(new Set(filteredDefs.map(c => c.section)))
        return order.map(s => ({ section: s, label: filteredDefs.find(c => c.section === s)!.sectionLabel, cols: filteredDefs.filter(c => c.section === s) }))
      })()

  const allCollapsed = sectionGroups.length > 0 && sectionGroups.every(g => !!collapsed[g.section])
  const toggleCollapseAll = () => setCollapsed(allCollapsed ? {} : Object.fromEntries(sectionGroups.map(g => [g.section, true])))
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

  const resetMetricForm = () => {
    setMetricName("")
    setMetricDesc("")
    setMetricFormat("numeric")
    setMetricAccess("only_you")
    setFormula([])
  }

  const createMetric = (addAnother: boolean) => {
    const name = metricName.trim()
    if (!name || formula.length === 0 || !onSaveCustomMetric) return
    const metric: CustomMetricConfig = {
      id: `custom_metric_${Date.now()}`,
      name,
      description: metricDesc.trim(),
      format: metricFormat,
      formula,
      access: metricAccess,
    }
    onSaveCustomMetric(metric)
    setLocalCols(prev => prev.includes(metric.id) ? prev : [...prev, metric.id])
    resetMetricForm()
    if (!addAnother) setShowCreate(false)
  }

  const commitSavePreset = () => {
    if (savePresetName.trim()) onSavePreset(savePresetName.trim(), localCols)
    setShowSaveInput(false)
    setSavePresetName("")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-card w-[1120px] max-w-[96vw] rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "min(90vh, 680px)" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#1c2b33] dark:text-white">Customise columns</h2>
            <p className="text-sm text-[#65676b] dark:text-muted-foreground mt-0.5">Choose which columns to show and arrange how they appear in the table.</p>
          </div>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-full hover:bg-muted/50 transition-colors text-muted-foreground mt-0.5"><IconX className="size-4" /></button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="flex flex-col w-[58%] border-r min-h-0">
            <div className="px-4 pt-4 pb-3 shrink-0 flex items-center gap-2">
              <div className="relative flex-1">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50 pointer-events-none" />
                <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCollapsed({}) }} placeholder="Search for metrics or column settings" className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg outline-none focus:ring-1 focus:ring-ring bg-background" />
              </div>
              {activeTab === "custom" && !searchQuery && (
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 h-9 px-3 text-xs border rounded-lg hover:bg-muted/50 transition-colors font-semibold whitespace-nowrap shrink-0">
                  <IconPlus className="size-3.5" /> Create custom metric
                </button>
              )}
              <button onClick={toggleCollapseAll} className="flex items-center gap-1.5 h-9 px-3 text-xs border rounded-lg hover:bg-muted/50 transition-colors text-[#65676b] dark:text-muted-foreground whitespace-nowrap shrink-0">
                <IconChevronLeft className={cn("size-3.5 transition-transform", allCollapsed && "rotate-180")} />{allCollapsed ? "Expand all" : "Collapse all"}
              </button>
            </div>

            {!searchQuery && (
              <div className="flex items-center gap-1 px-4 pb-3 shrink-0 border-b flex-wrap">
                {TABS.map(t => (
                  <button key={t.id} onClick={() => { setActiveTab(t.id); setCollapsed({}) }} className={cn("px-3 py-1.5 text-xs rounded-lg transition-colors font-medium", activeTab === t.id ? "bg-[#e7f3ff] text-[#1877f2]" : "text-[#65676b] dark:text-muted-foreground hover:bg-muted/50")}>{t.label}</button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {activeTab === "custom" && !searchQuery && customDefs.length === 0 && (
                <div className="text-center py-10 border rounded-xl bg-muted/10">
                  <p className="text-sm font-semibold">No custom metrics yet</p>
                  <button onClick={() => setShowCreate(true)} className="mt-3 h-8 px-3 text-xs bg-[#1877f2] text-white rounded-lg font-semibold">Create custom metric</button>
                </div>
              )}
              {sectionGroups.map(({ section, label, cols }) => {
                if (activeTab === "custom" && !searchQuery && customDefs.length === 0) return null
                const isCollapsed = !!collapsed[section]
                const selectedN = cols.filter(c => localCols.includes(c.id)).length
                return (
                  <div key={section} className="border rounded-xl overflow-hidden">
                    <button onClick={() => setCollapsed(p => ({ ...p, [section]: !p[section] }))} className="w-full flex items-center justify-between px-4 py-3 bg-[#f7f8fa] dark:bg-muted/30 hover:bg-[#f0f2f5] dark:hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3"><span className="text-xs font-semibold text-[#1c2b33] dark:text-white">{label}</span>{selectedN > 0 && <span className="text-xs text-[#65676b] dark:text-muted-foreground">{selectedN} selected</span>}</div>
                      <IconChevronDown className={cn("size-4 text-muted-foreground transition-transform", isCollapsed && "-rotate-90")} />
                    </button>
                    {!isCollapsed && (
                      <div className="grid grid-cols-2 divide-x divide-y">
                        {cols.length === 0 ? <p className="col-span-2 px-4 py-3 text-xs text-muted-foreground">0 selected</p> : cols.map(col => (
                          <label key={col.id} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors">
                            <input type="checkbox" className="mt-0.5 size-4 rounded accent-[#1877f2] cursor-pointer shrink-0" checked={localCols.includes(col.id)} onChange={() => toggleCol(col.id)} />
                            <div className="min-w-0"><p className="text-xs font-medium text-[#1c2b33] dark:text-white leading-tight">{col.label}</p><p className="text-xs text-[#65676b] dark:text-muted-foreground mt-0.5">{col.description}</p></div>
                          </label>
                        ))}
                        {cols.length % 2 !== 0 && <div className="px-4 py-3 bg-[#fafafa] dark:bg-muted/5" />}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col w-[42%] min-h-0">
            <div className="px-4 py-3 border-b shrink-0"><p className="text-xs font-bold text-[#1c2b33] dark:text-white">{localCols.length + REQUIRED_COLS.length} columns selected</p><p className="text-xs text-[#65676b] dark:text-muted-foreground mt-0.5">Drag and drop to arrange the order they appear in the table.</p></div>
            <div className="flex-1 overflow-y-auto divide-y">
              {REQUIRED_COLS.map(col => <div key={col.id} className="flex items-center gap-3 px-4 py-2.5 select-none"><IconGripVertical className="size-3.5 text-muted-foreground/20 shrink-0" /><span className="flex-1 text-xs text-[#1c2b33] dark:text-white">{col.label}</span><span className="text-xs text-muted-foreground">Required</span></div>)}
              {localCols.map((colId, idx) => {
                const colDef = allMap[colId]
                if (!colDef) return null
                const isDragTarget = dragOverIdx === idx && dragStartIdx.current !== idx
                return (
                  <div key={colId} draggable onDragStart={() => handleDragStart(idx)} onDragOver={e => handleDragOver(e, idx)} onDrop={() => handleDrop(idx)} onDragEnd={handleDragEnd} className={cn("flex items-center gap-3 px-4 py-2.5 cursor-grab active:cursor-grabbing transition-colors select-none", isDragTarget ? "bg-blue-50 dark:bg-blue-950/30 border-t-2 border-blue-500" : "hover:bg-muted/30")}>
                    <IconGripVertical className="size-3.5 text-muted-foreground/50 shrink-0" />
                    <span className="flex-1 text-xs text-[#1c2b33] dark:text-white">{colDef.label}</span>
                    <button onClick={() => toggleCol(colId)} className="size-5 flex items-center justify-center rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"><IconX className="size-3" /></button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t bg-[#f7f8fa] dark:bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            {showSaveInput ? <><input type="text" value={savePresetName} onChange={e => setSavePresetName(e.target.value)} placeholder="Preset name..." autoFocus className="h-8 w-44 px-3 text-sm border rounded-lg outline-none focus:ring-1 focus:ring-ring bg-white dark:bg-background" onKeyDown={e => { if (e.key === "Enter") commitSavePreset(); if (e.key === "Escape") setShowSaveInput(false) }} /><button onClick={commitSavePreset} className="h-8 px-3 text-xs bg-[#1877f2] text-white rounded-lg hover:bg-[#1464d8] transition-colors font-semibold">Save</button><button onClick={() => setShowSaveInput(false)} className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">Cancel</button></> : <button onClick={() => setShowSaveInput(true)} className="text-xs text-[#1877f2] font-semibold hover:underline">Save as column preset</button>}
          </div>
          <div className="flex items-center gap-2"><button onClick={onClose} className="h-8 px-4 text-sm border rounded-lg hover:bg-muted/50 transition-colors font-medium">Cancel</button><button onClick={() => { onApply(localCols); onClose() }} className="h-8 px-5 text-sm bg-[#1877f2] text-white rounded-lg hover:bg-[#1464d8] transition-colors font-semibold">Apply</button></div>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="w-[860px] max-w-[96vw] max-h-[92vh] overflow-hidden rounded-xl bg-white dark:bg-card shadow-2xl flex flex-col">
            <div className="flex items-start justify-between px-5 py-4 border-b"><div><h3 className="text-base font-bold">Create custom metric</h3><p className="text-xs text-muted-foreground">Create custom metrics to get more detailed information about campaign performance.</p></div><button onClick={() => setShowCreate(false)} className="size-8 rounded-full hover:bg-muted/50 flex items-center justify-center"><IconX className="size-4" /></button></div>
            <div className="grid grid-cols-[1fr_300px] gap-4 overflow-y-auto p-5">
              <div className="space-y-3">
                <div className="flex gap-1">
                  <div className="relative flex-1">
                    <button onClick={() => setShowMetricMenu(v => !v)} className="h-9 w-full rounded border px-3 text-xs bg-background flex items-center justify-between hover:bg-muted/30">
                      <span>Select metric</span><IconChevronDown className="size-3.5 text-muted-foreground" />
                    </button>
                    {showMetricMenu && (
                      <div className="absolute z-10 mt-1 left-0 right-0 max-h-64 overflow-y-auto rounded border bg-white dark:bg-card shadow-lg">
                        {formulaMetrics.map(m => (
                          <button key={m.id} onClick={() => { setFormula(f => [...f, m.id]); setShowMetricMenu(false) }} className="block w-full text-left px-3 py-2 text-xs hover:bg-muted/40">{m.label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  {OPS.map(op => <button key={op} onClick={() => setFormula(f => [...f, op])} className="h-9 w-12 rounded border text-sm hover:bg-muted/50">{op}</button>)}
                </div>
                <div className="min-h-32 rounded border p-3 text-sm bg-background flex content-start gap-2 flex-wrap">
                  {formula.length === 0 ? <span className="text-muted-foreground text-xs">To combine metrics into a formula, select metrics from the drop-down menu above or start typing here.</span> : formula.map((token, i) => <button key={`${token}_${i}`} onClick={() => setFormula(f => f.filter((_, idx) => idx !== i))} className="px-2 py-1 rounded bg-[#e7f3ff] text-[#1877f2] text-xs font-medium hover:bg-blue-100">{labelById[token] || token}</button>)}
                </div>
                <label className="block"><span className="text-xs font-bold">Name</span><div className="relative"><input value={metricName} onChange={e => setMetricName(e.target.value.slice(0, 100))} placeholder="Name this metric" className="mt-1 h-9 w-full rounded border px-3 pr-14 text-sm bg-background" /><span className="absolute right-3 top-3 text-xs text-muted-foreground">{metricName.length}/100</span></div></label>
                <div className="grid grid-cols-[1fr_130px] gap-3">
                  <label className="block"><span className="text-xs font-bold">Description · Optional</span><div className="relative"><input value={metricDesc} onChange={e => setMetricDesc(e.target.value.slice(0, 350))} placeholder="Describe this metric" className="mt-1 h-9 w-full rounded border px-3 pr-14 text-sm bg-background" /><span className="absolute right-3 top-3 text-xs text-muted-foreground">{metricDesc.length}/350</span></div></label>
                  <label className="block"><span className="text-xs font-bold">Format</span><select value={metricFormat} onChange={e => setMetricFormat(e.target.value as CustomMetricFormat)} className="mt-1 h-9 w-full rounded border px-3 text-sm bg-background"><option value="numeric">Numeric (123)</option><option value="percentage">Percentage (%)</option><option value="currency">Currency ($)</option></select></label>
                </div>
                <label className="block"><span className="text-xs font-bold">Who can access this?</span><select value={metricAccess} onChange={e => setMetricAccess(e.target.value as CustomMetricAccess)} className="mt-1 h-9 w-full rounded border px-3 text-sm bg-background"><option value="only_you">Only you</option><option value="business">Everyone with access to this Business</option></select></label>
                <p className="text-[11px] text-muted-foreground"><b>Note:</b> Meta only performs basic mathematical calculations based on your formula and does not otherwise add to or modify the metric.</p>
              </div>
              <div className="border-l pl-4 space-y-2">
                <div className="h-20 rounded-lg bg-[#b9e2dc]" />
                <p className="text-sm font-bold">Try popular custom formulas</p>
                <p className="text-xs text-muted-foreground">Apply custom formulas that other businesses frequently create. You can only add one custom formula at a time.</p>
                <div className="divide-y">
                  {POPULAR.map(p => <button key={p.name} onClick={() => { setMetricName(p.name); setFormula(p.formula); setMetricFormat("percentage") }} className="w-full py-3 text-left text-xs hover:bg-muted/30 flex gap-2"><IconPlus className="size-3.5 shrink-0" />{p.name}</button>)}
                </div>
              </div>
            </div>
            <div className="flex justify-between p-4 border-t bg-muted/20"><button onClick={() => setShowCreate(false)} className="h-9 px-4 rounded border text-sm">Cancel</button><div className="flex gap-2"><button onClick={() => createMetric(true)} disabled={!metricName.trim() || formula.length === 0} className="h-9 px-4 rounded border text-sm disabled:opacity-50">Create and add another</button><button onClick={() => createMetric(false)} disabled={!metricName.trim() || formula.length === 0} className="h-9 px-4 rounded bg-[#1877f2] text-white text-sm font-semibold disabled:opacity-50">Create Metric</button></div></div>
          </div>
        </div>
      )}
    </div>
  )
}
