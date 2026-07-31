"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  IconLoader2,
  IconRefresh,
  IconExternalLink,
  IconPhoto,
  IconLock,
  IconCopy,
  IconCheck,
  
} from "@tabler/icons-react"
import {
  FEEDBACK_FEATURES,
  FEEDBACK_SEVERITIES,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
} from "@/lib/feedback-taxonomy"
import { cn } from "@/lib/utils"

type FeedbackRow = {
  id: string
  org_id: string
  org_name: string | null
  user_id: string
  user_email: string | null
  feature_area: string
  feature_function: string
  feedback_type: string
  severity: string
  status: string
  observed_evidence: string
  expected_result: string
  reference_url: string | null
  extra_note: string | null
  expected_done_at: string | null
  artifact_url: string | null
  screenshot_path: string | null
  screenshot_url: string | null
  created_at: string
  updated_at: string
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  low: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
}

const STATUS_STYLE: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  doing: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
}

const STATUS_DOT: Record<string, string> = {
  open: "bg-blue-500",
  doing: "bg-amber-500",
  done: "bg-emerald-500",
  rejected: "bg-red-500",
}

function areaLabel(area: string) {
  return FEEDBACK_FEATURES.find((a) => a.area === area)?.label ?? area
}

function functionLabel(area: string, fn: string) {
  const a = FEEDBACK_FEATURES.find((x) => x.area === area)
  return a?.functions.find((f) => f.value === fn)?.label ?? fn
}

function typeLabel(v: string) {
  return FEEDBACK_TYPES.find((t) => t.value === v)?.label ?? v
}

function severityLabel(v: string) {
  return FEEDBACK_SEVERITIES.find((s) => s.value === v)?.label ?? v
}

function fmtDate(s: string | null) {
  if (!s) return "—"
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function fmtDay(s: string | null) {
  if (!s) return "—"
  // date-only fields come as YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString()
}

function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium capitalize",
        className
      )}
    >
      {children}
    </span>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">
        {label}
      </div>
      <div className="text-sm text-foreground break-words whitespace-pre-wrap">{children}</div>
    </div>
  )
}

function suspectedFiles(r: FeedbackRow): string {
  const area = FEEDBACK_FEATURES.find(a => a.area === r.feature_area)
  const fn = area?.functions.find(f => f.value === r.feature_function)
  const routes = fn?.routes ?? []
  if (!routes.length) return "- Unknown route. Search the codebase for the feature label."
  return routes.map(rt => `- \`app/(dashboard)${rt === "/" ? "" : rt}/page.tsx\``).join("\n")
}

function buildPrompt(r: FeedbackRow): string {
  return `You are a senior engineer agent. A user reported a feedback item. Investigate the codebase, identify root cause, and fix it.

# Feedback Context
- **DB row id:** ${r.id}
- **Feature area:** ${areaLabel(r.feature_area)} (${r.feature_area})
- **Function:** ${functionLabel(r.feature_area, r.feature_function)} (${r.feature_function})
- **Type:** ${typeLabel(r.feedback_type)} | **Severity:** ${severityLabel(r.severity)}
- **Status:** ${r.status}
- **Reported by:** ${r.user_email || "—"} (Org: ${r.org_name || r.org_id})
- **Created:** ${fmtDate(r.created_at)}

# Issue
- **Observed:** ${r.observed_evidence}
- **Expected:** ${r.expected_result}
- **Extra note:** ${r.extra_note || "—"}
- **Reference URL:** ${r.reference_url || "—"}
- **Screenshot:** ${r.screenshot_url || "none"}

# Likely location (investigate first)
${suspectedFiles(r)}

# Instructions
1. Read the suspected files above and trace the feature flow.
2. If a screenshot URL is provided, examine it to understand the UI state. If missing, infer from the Observed/Expected fields.
3. Identify the root cause, then implement a minimal fix.
4. Leave a one-line summary of what you changed and why.`
}

export default function PmFeedbackDashboardPage() {
  const router = useRouter()
  const [rows, setRows] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [unauthorized, setUnauthorized] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState(false)
  const [copiedPromptId, setCopiedPromptId] = useState("")
  const [rejectReason, setRejectReason] = useState("")
  const [rejectEvidence, setRejectEvidence] = useState("")
  const [rejecting, setRejecting] = useState(false)
  const [rejectMsg, setRejectMsg] = useState<string | null>(null)

  const [fStatus, setFStatus] = useState("")
  const [fSeverity, setFSeverity] = useState("")
  const [fArea, setFArea] = useState("")
  const [fType, setFType] = useState("")
  const [fQ, setFQ] = useState("")

  const buildUrl = useCallback(() => {
    const p = new URLSearchParams()
    if (fStatus) p.set("status", fStatus)
    if (fSeverity) p.set("severity", fSeverity)
    if (fArea) p.set("feature_area", fArea)
    if (fType) p.set("feedback_type", fType)
    if (fQ.trim()) p.set("q", fQ.trim())
    p.set("limit", "300")
    return `/api/pm-feedback?${p.toString()}`
  }, [fStatus, fSeverity, fArea, fType, fQ])

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(buildUrl(), { cache: "no-store" })
      if (res.status === 401) {
        setUnauthorized(true)
        setForbidden(false)
        return
      }
      if (res.status === 403) {
        setForbidden(true)
        setUnauthorized(false)
        return
      }
      if (!res.ok) {
        const t = await res.text().catch(() => "")
        setError(`Load failed (${res.status}). ${t.slice(0, 200)}`)
        return
      }
      setUnauthorized(false)
      setForbidden(false)
      const data = await res.json()
      const list: FeedbackRow[] = Array.isArray(data.feedback) ? data.feedback : []
      setRows(list)
      setSelectedId((cur) => {
        if (cur && list.some((r) => r.id === cur)) return cur
        return list[0]?.id ?? null
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error")
    } finally {
      setLoading(false)
    }
  }, [buildUrl])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  useEffect(() => {
    if (forbidden || unauthorized) return
    const onFocus = () => load()
    window.addEventListener("focus", onFocus)
    const id = window.setInterval(load, 30_000)
    return () => {
      window.removeEventListener("focus", onFocus)
      window.clearInterval(id)
    }
  }, [forbidden, unauthorized, load])

  async function updateStatus(id: string, status: string) {
    const prev = rows
    setUpdatingId(id)
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)))
    try {
      const res = await fetch(`/api/pm-feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => "")
        setError(`Update failed (${res.status}). ${t.slice(0, 200)}`)
        setRows(prev)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error")
      setRows(prev)
    } finally {
      setUpdatingId(null)
    }
  }

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId]
  )

  const { activeRows, doneRows, rejectedRows } = useMemo(() => {
    return {
      activeRows: rows.filter((r) => !["done", "rejected"].includes(r.status)),
      doneRows: rows.filter((r) => r.status === "done"),
      rejectedRows: rows.filter((r) => r.status === "rejected"),
    }
  }, [rows])

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id)
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 1500)
    } catch {}
  }

  async function copyPrompt(r: FeedbackRow) {
    const md = buildPrompt(r)
    const blob = new Blob([md], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `feedback-${r.id.slice(0, 8)}.md`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function sendReject(id: string) {
    if (!rejectReason.trim()) {
      setRejectMsg("Please enter a reason.")
      return
    }
    setRejecting(true)
    setRejectMsg(null)
    try {
      const res = await fetch(`/api/pm-feedback/${id}/reject-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim(), evidence: rejectEvidence.trim() }),
      })
      const t = await res.text()
      if (!res.ok) {
        const j = JSON.parse(t)
        setRejectMsg(`Failed: ${j.error ?? res.status}`)
      } else {
        setRejectMsg("Email sent & status set to rejected.")
        setRejectReason("")
        setRejectEvidence("")
        load()
      }
    } catch {
      setRejectMsg("Network error.")
    } finally {
      setRejecting(false)
    }
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-sm w-full text-center space-y-3">
          <IconLock className="mx-auto size-8 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Sign in required</h1>
          <p className="text-sm text-muted-foreground">
            PM feedback dashboard requires an AdLauncher login with a PM allowlisted email.
          </p>
          <Button onClick={() => router.push("/auth/login")}>Go to login</Button>
        </div>
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-sm w-full text-center space-y-3">
          <IconLock className="mx-auto size-8 text-muted-foreground" />
          <h1 className="text-lg font-semibold">PM only</h1>
          <p className="text-sm text-muted-foreground">
            This dashboard is restricted to the product manager allowlist.
          </p>
        </div>
      </div>
    )
  }

  const renderRow = (r: FeedbackRow, dim: boolean) => {
    const active = r.id === selectedId
    return (
      <tr
        key={r.id}
        onClick={() => setSelectedId(r.id)}
        className={cn(
          "border-t border-border cursor-pointer hover:bg-muted/40 transition-colors",
          active && "bg-primary/5",
          dim && "opacity-60 grayscale-[50%]"
        )}
      >
        <td className="px-3 whitespace-nowrap text-xs text-muted-foreground">
          {fmtDate(r.created_at)}
        </td>
        <td className="px-3 min-w-[140px]">
          <div className="font-medium truncate max-w-[180px]">{r.user_email || "—"}</div>
          <div className="text-xs text-muted-foreground truncate max-w-[180px]">
            {r.org_name || r.org_id.slice(0, 8)}
          </div>
        </td>
        <td className="px-3 min-w-[140px]">
          <div className="truncate max-w-[180px]">{areaLabel(r.feature_area)}</div>
          <div className="text-xs text-muted-foreground truncate max-w-[180px]">
            {functionLabel(r.feature_area, r.feature_function)}
          </div>
        </td>
        <td className="px-3 space-y-1">
          <div>
            <Chip className="border-border bg-muted/40">{typeLabel(r.feedback_type)}</Chip>
          </div>
          <div>
            <Chip className={SEVERITY_STYLE[r.severity] || "border-border"}>
              {severityLabel(r.severity)}
            </Chip>
          </div>
        </td>
        <td className="px-3 max-w-[260px]">
          <div className="line-clamp-2 text-foreground/90">{r.observed_evidence}</div>
        </td>
        <td className="px-3" onClick={(e) => e.stopPropagation()}>
          <Select
            value={r.status}
            onValueChange={(v) => updateStatus(r.id, v)}
            disabled={updatingId === r.id}
          >
            <SelectTrigger size="sm" className={cn("w-[110px]", STATUS_STYLE[r.status] || "capitalize")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {FEEDBACK_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  <span className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${STATUS_DOT[s]}`} />
                    {s}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        <td className="px-3">
          {r.screenshot_url ? (
            <a
              href={r.screenshot_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <IconPhoto className="size-3.5" /> View
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
      </tr>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto max-w-[1600px] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Product Manager
            </div>
            <h1 className="font-heading text-xl font-semibold">Feedback log</h1>
            <p className="text-sm text-muted-foreground">
              Cross-org. Full fields. Auto-refresh every 30s.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{rows.length} items</span>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? <IconLoader2 className="animate-spin" /> : <IconRefresh />}
              Refresh
            </Button>
          </div>
        </div>

        <div className="mx-auto max-w-[1600px] px-4 pb-3 flex flex-wrap gap-2 items-center">
          <Select value={fStatus || "all"} onValueChange={(v) => setFStatus(v === "all" ? "" : v)}>
            <SelectTrigger size="sm" className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">All statuses</SelectItem>
              {FEEDBACK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="flex items-center gap-2 capitalize">
                    <span className={`size-2 rounded-full ${STATUS_DOT[s]}`} />
                    {s}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={fSeverity || "all"}
            onValueChange={(v) => setFSeverity(v === "all" ? "" : v)}
          >
            <SelectTrigger size="sm" className="w-[140px]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">All severities</SelectItem>
              {FEEDBACK_SEVERITIES.map((s) => (
                <SelectItem key={s.value} value={s.value} title={s.description}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={fArea || "all"} onValueChange={(v) => setFArea(v === "all" ? "" : v)}>
            <SelectTrigger size="sm" className="w-[160px]">
              <SelectValue placeholder="Feature" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">All features</SelectItem>
              {FEEDBACK_FEATURES.map((a) => (
                <SelectItem key={a.area} value={a.area}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={fType || "all"} onValueChange={(v) => setFType(v === "all" ? "" : v)}>
            <SelectTrigger size="sm" className="w-[170px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">All types</SelectItem>
              {FEEDBACK_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            value={fQ}
            onChange={(e) => setFQ(e.target.value)}
            placeholder="Search evidence / expected / email / note"
            className="h-8 w-[280px] max-w-full"
          />
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4">
        {error && (
          <div className="mb-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <IconLoader2 className="animate-spin" /> Loading feedback…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            No feedback yet. Once users submit from the bubble, logs appear here.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] gap-4">
            {/* List */}
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table data-table="compact" className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 font-medium">When</th>
                      <th className="px-3 font-medium">Who / Org</th>
                      <th className="px-3 font-medium">Feature</th>
                      <th className="px-3 font-medium">Type / Sev</th>
                      <th className="px-3 font-medium">Observed</th>
                      <th className="px-3 font-medium">Status</th>
                      <th className="px-3 font-medium">Proof</th>
                    </tr>
                  </thead>
                  {activeRows.length > 0 && (
                    <tbody>
                      {activeRows.map((r) => renderRow(r, false))}
                    </tbody>
                  )}
                  {doneRows.length > 0 && (
                    <tbody>
                      {(activeRows.length > 0 || rejectedRows.length > 0) && (
                        <tr>
                          <td colSpan={7} className="bg-muted/40 px-3 text-xs font-semibold text-muted-foreground border-y border-border">
                            Done ({doneRows.length})
                          </td>
                        </tr>
                      )}
                      {doneRows.map((r) => renderRow(r, true))}
                    </tbody>
                  )}
                  {rejectedRows.length > 0 && (
                    <tbody>
                      {(activeRows.length > 0 || doneRows.length > 0) && (
                        <tr>
                          <td colSpan={7} className="bg-muted/40 px-3 text-xs font-semibold text-muted-foreground border-y border-border">
                            Rejected ({rejectedRows.length})
                          </td>
                        </tr>
                      )}
                      {rejectedRows.map((r) => renderRow(r, true))}
                    </tbody>
                  )}
                </table>
              </div>
            </div>

            {/* Detail panel — full fields */}
            <aside className="rounded-xl border border-border bg-card p-4 lg:sticky lg:top-[140px] lg:self-start max-h-[calc(100vh-160px)] overflow-y-auto">
              {!selected ? (
                <p className="text-sm text-muted-foreground">Select a row to inspect full fields.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Feedback ID</div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs break-all">{selected.id}</span>
                        <button
                          onClick={() => copyId(selected.id)}
                          className="text-muted-foreground hover:text-foreground shrink-0"
                          title="Copy ID"
                        >
                          {copiedId ? (
                            <IconCheck className="size-3.5 text-emerald-500" />
                          ) : (
                            <IconCopy className="size-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <Chip className={STATUS_STYLE[selected.status] || "border-border"}>
                      {selected.status}
                    </Chip>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Who">{selected.user_email || "—"}</Field>
                    <Field label="When">{fmtDate(selected.created_at)}</Field>
                    <Field label="Org">{selected.org_name || selected.org_id}</Field>
                    <Field label="Updated">{fmtDate(selected.updated_at)}</Field>
                    <Field label="Feature area">{areaLabel(selected.feature_area)}</Field>
                    <Field label="Function">
                      {functionLabel(selected.feature_area, selected.feature_function)}
                    </Field>
                    <Field label="Type">{typeLabel(selected.feedback_type)}</Field>
                    <Field label="Severity">{severityLabel(selected.severity)}</Field>
                    <Field label="Deadline expectation">
                      {fmtDay(selected.expected_done_at)}
                    </Field>
                    <Field label="Artifact URL">
                      {selected.artifact_url ? (
                        <a
                          href={selected.artifact_url}
                          className="inline-flex items-center gap-1 text-primary hover:underline break-all"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {selected.artifact_url}
                          <IconExternalLink className="size-3.5 shrink-0" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </Field>
                  </div>

                  <Field label="Observed evidence">{selected.observed_evidence}</Field>
                  <Field label="Expected result">{selected.expected_result}</Field>
                  <Field label="Extra note">{selected.extra_note || "—"}</Field>
                  <Field label="Reference URL">
                    {selected.reference_url ? (
                      <a
                        href={selected.reference_url}
                        className="inline-flex items-center gap-1 text-primary hover:underline break-all"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {selected.reference_url}
                        <IconExternalLink className="size-3.5 shrink-0" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </Field>

                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                      Screenshot proof
                    </div>
                    {selected.screenshot_url ? (
                      <a href={selected.screenshot_url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selected.screenshot_url}
                          alt="Feedback screenshot"
                          className="w-full max-h-80 object-contain rounded-md border border-border bg-muted/30"
                        />
                      </a>
                    ) : (
                      <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                        No screenshot attached
                      </div>
                    )}
                    {selected.screenshot_path && (
                      <div className="mt-1 font-mono text-[11px] text-muted-foreground break-all">
                        {selected.screenshot_path}
                      </div>
                    )}
                  </div>

                  <div className="pt-1 border-t border-border">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                      Update status
                    </div>
                    <Select
                      value={selected.status}
                      onValueChange={(v) => updateStatus(selected.id, v)}
                      disabled={updatingId === selected.id}
                    >
                      <SelectTrigger className="w-full capitalize">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {FEEDBACK_STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selected.status !== "rejected" && (
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        className="w-full gap-2 text-muted-foreground hover:text-foreground"
                        onClick={() => copyPrompt(selected)}
                      >
                        {copiedPromptId === selected.id ? <IconCheck className="size-4 text-emerald-500" /> : <IconCopy className="size-4" />}
                        {copiedPromptId === selected.id ? "Copied Prompt!" : "Copy fix prompt (.md)"}
                      </Button>
                    </div>
                  )}

                  {selected.status === "rejected" && (
                    <div className="pt-4 border-t border-border space-y-3">
                      <div className="text-[11px] uppercase tracking-wide text-destructive mb-1.5 font-semibold">
                        Reject Email (User will be notified)
                      </div>
                      <Input
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason (e.g. out of scope)"
                        className="h-8 text-xs"
                      />
                      <Input
                        value={rejectEvidence}
                        onChange={(e) => setRejectEvidence(e.target.value)}
                        placeholder="Evidence (e.g. meta rate limit doc)"
                        className="h-8 text-xs"
                      />
                      <Button
                        variant="destructive"
                        className="w-full h-8 text-xs"
                        onClick={() => sendReject(selected.id)}
                        disabled={rejecting}
                      >
                        {rejecting ? <IconLoader2 className="size-3.5 animate-spin mr-1" /> : null}
                        Send Rejection Email
                      </Button>
                      {rejectMsg && (
                        <div className="text-xs text-muted-foreground text-center">
                          {rejectMsg}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}
