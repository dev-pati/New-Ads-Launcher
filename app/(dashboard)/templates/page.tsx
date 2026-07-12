"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { useAdAccount } from "@/lib/ad-account-context"
import { cn } from "@/lib/utils"
import {
  IconSearch, IconChevronDown, IconFilter, IconPlus, IconTemplate,
  IconFolder, IconFileImport, IconFileExport, IconLayoutDashboard,
  IconCloudDownload, IconPencil, IconTrash, IconLoader2, IconCheck,
  IconCopy, IconX, IconTag, IconChartBar, IconSparkles, IconDotsVertical,
  IconRefresh,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { TopPerformingTab } from "@/components/templates/TopPerformingTab"
import { AINamingTab } from "@/components/templates/AINamingTab"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AdCopyTemplate {
  id: string
  org_id: string
  ad_account_id: string
  name: string
  primary_text?: string
  headline?: string
  description?: string
  link?: string
  cta: string
  tags: string[]
  created_at: string
  updated_at: string
}

const CTA_OPTIONS = [
  "SHOP_NOW", "LEARN_MORE", "SIGN_UP", "BOOK_NOW", "CONTACT_US",
  "DOWNLOAD", "GET_OFFER", "GET_QUOTE", "ORDER_NOW", "SEND_MESSAGE",
  "SUBSCRIBE", "WATCH_MORE", "APPLY_NOW", "BUY_NOW", "CALL_NOW",
]

// ─── Empty Template Form ────────────────────────────────────────────────────────
//push

const emptyForm = () => ({
  name: "",
  primary_text: "",
  headline: "",
  description: "",
  link: "",
  cta: "SHOP_NOW",
  tags: "" as string,
})

// ─── Template Card ──────────────────────────────────────────────────────────────

function TemplateCard({
  t, onEdit, onDelete, onCopy,
}: {
  t: AdCopyTemplate
  onEdit: (t: AdCopyTemplate) => void
  onDelete: (id: string) => void
  onCopy: (t: AdCopyTemplate) => void
}) {
  return (
    <div className="group bg-white border rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="size-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
            <IconTemplate className="size-4 text-blue-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{t.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="opacity-0 group-hover:opacity-100 size-7 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-all shrink-0">
              <IconDotsVertical className="size-3.5 text-slate-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onCopy(t)} className="gap-2 text-xs">
              <IconCopy className="size-3.5" />Copy template
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(t)} className="gap-2 text-xs">
              <IconPencil className="size-3.5" />Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(t.id)} className="gap-2 text-xs text-red-600 focus:text-red-600">
              <IconTrash className="size-3.5" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 space-y-1.5">
        {t.primary_text && (
          <div className="text-xs bg-slate-50 rounded-lg px-3 py-2">
            <span className="text-slate-400 font-medium">Primary Text · </span>
            <span className="text-slate-700 line-clamp-2">{t.primary_text}</span>
          </div>
        )}
        {t.headline && (
          <div className="text-xs bg-slate-50 rounded-lg px-3 py-2">
            <span className="text-slate-400 font-medium">Headline · </span>
            <span className="text-slate-700 font-semibold">{t.headline}</span>
          </div>
        )}
        {(t.cta || t.link) && (
          <div className="flex items-center gap-2 text-xs">
            {t.cta && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">{t.cta.replace(/_/g, " ")}</span>}
            {t.link && <span className="text-slate-400 truncate">{t.link}</span>}
          </div>
        )}
        {t.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {t.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full text-xs font-medium">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Template Form Dialog ───────────────────────────────────────────────────────

function TemplateFormDialog({
  open, onClose, initial, prefill, onSave, saving,
}: {
  open: boolean
  onClose: () => void
  initial?: AdCopyTemplate | null
  prefill?: Partial<ReturnType<typeof emptyForm>>
  onSave: (data: ReturnType<typeof emptyForm>) => void
  saving: boolean
}) {
  const [form, setForm] = useState(emptyForm())

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        name: initial.name,
        primary_text: initial.primary_text || "",
        headline: initial.headline || "",
        description: initial.description || "",
        link: initial.link || "",
        cta: initial.cta || "SHOP_NOW",
        tags: initial.tags?.join(", ") || "",
      } : { ...emptyForm(), ...(prefill || {}) })
    }
  }, [open, initial, prefill])

  const set = (k: keyof ReturnType<typeof emptyForm>, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b shrink-0">
          <DialogTitle className="text-sm font-bold">{initial ? "Edit Template" : "Create Ad Copy Template"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">Template Name <span className="text-red-500">*</span></Label>
            <Input placeholder="e.g. Summer Sale Copy" value={form.name} onChange={e => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">Primary Text</Label>
            <Textarea placeholder="Write your ad copy here..." rows={4} value={form.primary_text} onChange={e => set("primary_text", e.target.value)} className="resize-none text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">Headline</Label>
            <Input placeholder="Short punchy headline..." value={form.headline} onChange={e => set("headline", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">Description</Label>
            <Input placeholder="Optional description..." value={form.description} onChange={e => set("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">CTA</Label>
              <select
                value={form.cta}
                onChange={e => set("cta", e.target.value)}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm shadow-sm focus:ring-1 focus:ring-primary outline-none"
              >
                {CTA_OPTIONS.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Web Link</Label>
              <Input placeholder="https://..." value={form.link} onChange={e => set("link", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 font-medium">Tags (Folders) <span className="text-xs text-slate-400 font-normal">(comma-separated)</span></Label>
            <Input placeholder="e.g. Summer, Promo, Brand" value={form.tags} onChange={e => set("tags", e.target.value)} />
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={saving || !form.name.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
            {saving && <IconLoader2 className="size-3.5 mr-1.5 animate-spin" />}
            {initial ? "Save Changes" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "ad-setup" | "tags" | "top-performing" | "ai-naming"
type SortOption = "newest" | "oldest" | "name-az" | "name-za"

export default function TemplatesPage() {
  const { selectedAccountId, selectedAccount, adAccounts, setSelectedAccountId } = useAdAccount()

  const [tab, setTab] = useState<Tab>("ad-setup")
  const [templates, setTemplates] = useState<AdCopyTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get("q") || "")
  const [searchActive, setSearchActive] = useState(() => !!searchParams.get("q"))
  const [sort, setSort] = useState<SortOption>("newest")

  // Dialogs
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AdCopyTemplate | null>(null)
  const [prefillData, setPrefillData] = useState<Partial<ReturnType<typeof emptyForm>> | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [accountDropOpen, setAccountDropOpen] = useState(false)
  const [activeFolder, setActiveFolder] = useState<string | null>(null) // null = All, "__uncategorized__" = no tags, else tag name

  const openCreateFromCopy = useCallback((copy: { headline: string; primaryText: string }) => {
    setPrefillData({ headline: copy.headline, primary_text: copy.primaryText, name: "" })
    setEditTarget(null)
    setFormOpen(true)
    setTab("ad-setup")
  }, [])

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/templates`)
      const d = await r.json()
      setTemplates(d.templates || [])
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const filtered = useMemo(() => {
    let list = [...templates]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.primary_text?.toLowerCase().includes(q) ||
        t.headline?.toLowerCase().includes(q)
      )
    }
    if (activeFolder === "__uncategorized__") {
      list = list.filter(t => !t.tags || t.tags.length === 0)
    } else if (activeFolder) {
      list = list.filter(t => t.tags?.includes(activeFolder))
    }
    if (sort === "newest") list.sort((a, b) => b.created_at.localeCompare(a.created_at))
    else if (sort === "oldest") list.sort((a, b) => a.created_at.localeCompare(b.created_at))
    else if (sort === "name-az") list.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === "name-za") list.sort((a, b) => b.name.localeCompare(a.name))
    return list
  }, [templates, search, sort, activeFolder])

  const openCreate = () => { setEditTarget(null); setFormOpen(true) }
  const openEdit = (t: AdCopyTemplate) => { setEditTarget(t); setFormOpen(true) }

  const handleSave = async (form: ReturnType<typeof emptyForm>) => {
    setSaving(true)
    try {
      const tags = form.tags.split(",").map(s => s.trim()).filter(Boolean)
      const payload = { ...form, tags }
      if (editTarget) {
        const r = await fetch(`/api/templates/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const d = await r.json()
        if (r.ok) setTemplates(prev => prev.map(t => t.id === editTarget.id ? d.template : t))
      } else {
        const r = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ad_account_id: selectedAccountId || null, ...payload }),
        })
        const d = await r.json()
        if (r.ok) setTemplates(prev => [d.template, ...prev])
      }
      setFormOpen(false)
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await fetch(`/api/templates/${deleteId}`, { method: "DELETE" })
      setTemplates(prev => prev.filter(t => t.id !== deleteId))
      setDeleteId(null)
    } finally { setDeleting(false) }
  }

  const handleCopy = (t: AdCopyTemplate) => {
    setEditTarget(null)
    setFormOpen(true)
    // pre-fill form as a copy — handled in TemplateFormDialog via initial=null but we trigger differently
    setTimeout(() => {
      // Will open empty form; user copies manually — simple approach
    }, 0)
  }

  const exportCsv = () => {
    const rows = [
      ["Name", "Primary Text", "Headline", "Description", "CTA", "Link"],
      ...templates.map(t => [t.name, t.primary_text || "", t.headline || "", t.description || "", t.cta, t.link || ""]),
    ]
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "ad_copy_templates.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  const importCsv = () => {
    const input = document.createElement("input")
    input.type = "file"; input.accept = ".csv"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      const lines = text.split("\n").slice(1).filter(l => l.trim())
      const toCreate: ReturnType<typeof emptyForm>[] = []
      for (const line of lines) {
        const cols = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/^"|"$/g, "").replace(/""/g, '"'))
        if (cols[0]?.trim()) {
          toCreate.push({ name: cols[0] || "", primary_text: cols[1] || "", headline: cols[2] || "", description: cols[3] || "", cta: cols[4] || "SHOP_NOW", link: cols[5] || "" })
        }
      }
      for (const t of toCreate) {
        const r = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ad_account_id: selectedAccountId || null, ...t }),
        })
        if (r.ok) { const d = await r.json(); setTemplates(prev => [d.template, ...prev]) }
      }
    }
    input.click()
  }

  const SORT_LABELS: Record<SortOption, string> = {
    newest: "Newest first", oldest: "Oldest first", "name-az": "Name A–Z", "name-za": "Name Z–A",
  }

  const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
    { value: "ad-setup", label: "Ad Setup", icon: <IconTemplate className="size-3.5" /> },
    { value: "tags", label: "Tags", icon: <IconTag className="size-3.5" /> },
    { value: "top-performing", label: "Top Performing", icon: <IconChartBar className="size-3.5" /> },
    { value: "ai-naming", label: "AI Naming", icon: <IconSparkles className="size-3.5" /> },
  ]

  const folderTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of templates) {
      for (const tag of t.tags || []) {
        counts.set(tag, (counts.get(tag) || 0) + 1)
      }
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [templates])

  const uncategorizedCount = useMemo(
    () => templates.filter(t => !t.tags || t.tags.length === 0).length,
    [templates]
  )

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* ── Left Sidebar ── */}
      <div className="w-[240px] border-r flex flex-col shrink-0">
        <div className="px-5 h-[52px] flex items-center justify-between border-b">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">FOLDERS</span>
        </div>

        <div className="flex-1 overflow-auto py-3 px-3 space-y-0.5">
          <button
            onClick={() => setActiveFolder(null)}
            className={cn(
              "w-full flex items-center gap-2.5 h-9 px-3 rounded-lg text-sm font-semibold transition-colors",
              activeFolder === null ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            <IconTemplate className="size-4 shrink-0" />
            <span className="flex-1 text-left">All Templates</span>
            <span className={cn(
              "text-xs rounded-full px-1.5 py-0.5 font-bold leading-none",
              activeFolder === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {templates.length}
            </span>
          </button>

          <button
            onClick={() => setActiveFolder("__uncategorized__")}
            className={cn(
              "w-full flex items-center gap-2.5 h-9 px-3 rounded-lg text-sm hover:bg-muted/50 transition-colors",
              activeFolder === "__uncategorized__" ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground"
            )}
          >
            <IconFolder className="size-4 shrink-0" />
            <span className="flex-1 text-left">Uncategorized</span>
            <span className="text-xs font-bold opacity-40">{uncategorizedCount}</span>
          </button>

          {folderTags.length === 0 ? (
            <div className="py-6 px-2 text-center">
              <IconTag className="size-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                No tags yet. Add tags when editing a template to create folders.
              </p>
            </div>
          ) : (
            folderTags.map(([tag, count]) => (
              <button
                key={tag}
                onClick={() => setActiveFolder(tag)}
                className={cn(
                  "w-full flex items-center gap-2.5 h-9 px-3 rounded-lg text-sm hover:bg-muted/50 transition-colors",
                  activeFolder === tag ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground"
                )}
              >
                <IconTag className="size-4 shrink-0" />
                <span className="flex-1 text-left truncate">{tag}</span>
                <span className="text-xs font-bold opacity-40">{count}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-0 border-b shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold tracking-tight">Templates</h1>

            {/* Account selector */}
            <DropdownMenu open={accountDropOpen} onOpenChange={setAccountDropOpen}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-1.5 border rounded-full text-sm font-medium hover:bg-muted/50 transition-colors">
                  <div className="size-5 rounded-full bg-[#1877F2] flex items-center justify-center shrink-0">
                    <svg className="size-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </div>
                  <span className="max-w-[140px] truncate">{selectedAccount?.name || "Select account"}</span>
                  <IconChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {adAccounts.map(a => (
                  <DropdownMenuItem
                    key={a.id}
                    onClick={() => { setSelectedAccountId(a.id); setAccountDropOpen(false) }}
                    className={cn("gap-2 text-xs", selectedAccountId === a.id && "font-semibold text-primary")}
                  >
                    {selectedAccountId === a.id && <IconCheck className="size-3 shrink-0" />}
                    <span className="truncate">{a.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                  tab === t.value
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {tab === "ad-setup" && (
          <>
            {/* Action Bar */}
            <div className="px-5 h-[56px] flex items-center gap-2 border-b shrink-0 overflow-x-auto">
              {/* Search */}
              {searchActive ? (
                <div className="relative">
                  <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    autoFocus
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onBlur={() => { if (!search) setSearchActive(false) }}
                    placeholder="Search templates..."
                    className="h-8 pl-8 pr-8 text-xs w-52"
                  />
                  {search && (
                    <button onClick={() => { setSearch(""); setSearchActive(false) }} className="absolute right-2 top-1/2 -translate-y-1/2">
                      <IconX className="size-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              ) : (
                <button onClick={() => setSearchActive(true)} className="size-8 flex items-center justify-center rounded-lg border hover:bg-muted/50 transition-colors">
                  <IconSearch className="size-3.5 text-muted-foreground" />
                </button>
              )}

              {/* Sort */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs rounded-full px-3">
                    {SORT_LABELS[sort]} <IconChevronDown className="size-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([v, l]) => (
                    <DropdownMenuItem key={v} onClick={() => setSort(v)} className={cn("text-xs gap-2", sort === v && "font-semibold text-primary")}>
                      {sort === v && <IconCheck className="size-3" />}{l}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="h-4 w-px bg-border mx-0.5" />

              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs rounded-full px-3 whitespace-nowrap" onClick={importCsv}>
                <IconFileImport className="size-3.5 text-muted-foreground" />Import CSV
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs rounded-full px-3 whitespace-nowrap" onClick={exportCsv} disabled={templates.length === 0}>
                <IconFileExport className="size-3.5 text-muted-foreground" />Export CSV
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs rounded-full px-3 whitespace-nowrap" onClick={fetchTemplates}>
                <IconRefresh className="size-3.5 text-muted-foreground" />Refresh
              </Button>

              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs rounded-full px-4 ml-auto bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                onClick={openCreate}
              >
                <IconPlus className="size-3.5" />Create Ad Copy Template
              </Button>
            </div>

            {/* Template List */}
            <div className="flex-1 overflow-y-auto p-5">
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                  <div className="size-16 rounded-2xl bg-blue-600 flex items-center justify-center mb-5 shadow-lg shadow-blue-500/30">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                      <path d="M7 7H17M7 12H17M7 17H13" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold mb-2">
                    {search ? "No templates match your search" : "No Templates Found"}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm mb-6">
                    {search
                      ? "Try a different search term or clear the filter."
                      : "Create templates to reuse your best ad copy across campaigns."}
                  </p>
                  {!search && (
                    <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 rounded-full px-6">
                      <IconPlus className="size-4" />Create Ad Copy Template
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filtered.map(t => (
                    <TemplateCard
                      key={t.id}
                      t={t}
                      onEdit={openEdit}
                      onDelete={id => setDeleteId(id)}
                      onCopy={ct => {
                        setEditTarget({ ...ct, id: "", name: `${ct.name} - Copy` } as any)
                        setFormOpen(true)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "tags" && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <IconTag className="size-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold mb-1">No Tags Yet</h3>
            <p className="text-sm text-muted-foreground">Create tags to organize your templates into folders.</p>
          </div>
        )}

        {tab === "top-performing" && (
          <TopPerformingTab
            adAccountId={selectedAccountId}
            onCreateFromCopy={openCreateFromCopy}
          />
        )}

        {tab === "ai-naming" && <AINamingTab />}
      </div>

      {/* ── Create / Edit Dialog ── */}
      <TemplateFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setPrefillData(null) }}
        initial={editTarget?.id ? editTarget : null}
        prefill={prefillData ?? undefined}
        onSave={handleSave}
        saving={saving}
      />

      {/* ── Delete Confirm ── */}
      <Dialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
            <DialogDescription>This will permanently delete this ad copy template. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <IconLoader2 className="size-3.5 mr-1.5 animate-spin" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
