"use client"

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { cn } from "@/lib/utils"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ComposedChart, Line, PieChart, Pie, Cell,
  AreaChart, Area,
} from "recharts"
import {
  IconLoader2, IconAlertCircle, IconRefresh, IconChevronDown, IconChevronRight,
  IconFilter, IconUsers, IconChartBar, IconMoodEmpty, IconCheck, IconSearch,
  IconDownload, IconWorld, IconHistory, IconLayout, IconPhoto, IconVideo,
  IconX,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { useAdAccount } from "@/lib/ad-account-context"

// ─── Shared Helpers ───────────────────────────────────────────────────────────

const fmt$ = (v: number, d = 2) =>
  "$" + v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtK = (v: number) =>
  v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + "M" :
  v >= 1000 ? (v / 1000).toFixed(1) + "K" : String(Math.round(v))
const fmtDay = (s: string) => {
  const d = new Date(s); return `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })}`
}
const fmtPct = (v: number) => v.toFixed(2) + "%"

const ACCOUNT_COLORS = ["#3b82f6","#06b6d4","#8b5cf6","#ec4899","#f59e0b","#10b981","#ef4444","#84cc16"]
const AGE_COLORS: Record<string, string> = {
  "13-17": "#60a5fa", "18-24": "#06b6d4", "25-34": "#f59e0b", "35-44": "#f97316",
  "45-54": "#06b6d4", "55-64": "#8b5cf6", "65+": "#9ca3af", "Unknown": "#6366f1",
}
const GENDER_COLORS: Record<string, string> = { "Male": "#3b82f6", "Female": "#ec4899", "Unknown": "#9ca3af" }

const DATE_PRESETS = [
  { label: "Last 7 days",  value: "last_7d" },
  { label: "Last 30 days", value: "last_30d" },
  { label: "Last 90 days", value: "last_90d" },
  { label: "This month",   value: "this_month" },
  { label: "Last month",   value: "last_month" },
]

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 min-w-0">
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p className="text-xl font-bold mt-1 truncate">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

function ErrorMsg({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16">
      <IconAlertCircle className="size-8 text-destructive" />
      <p className="text-sm text-muted-foreground max-w-sm text-center">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}><IconRefresh className="size-3.5 mr-1" />Retry</Button>
    </div>
  )
}

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const label = DATE_PRESETS.find(p => p.value === value)?.label || value
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border bg-background hover:bg-muted/50 transition-colors">
        <IconFilter className="size-3.5 text-muted-foreground" />{label}
        <IconChevronDown className="size-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-40 bg-popover border rounded-lg shadow-lg py-1 min-w-[160px]">
          {DATE_PRESETS.map(p => (
            <button key={p.value} onClick={() => { onChange(p.value); setOpen(false) }}
              className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between",
                value === p.value && "text-primary font-medium")}>
              {p.label}
              {value === p.value && <span className="size-1.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CSV Export helper ────────────────────────────────────────────────────────

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map(r =>
    r.map(cell => {
      const s = String(cell ?? "")
      return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }).join(",")
  ).join("\n")
  const blob = new Blob(["﻿" + csv, ""], { type: "text/csv;charset=utf-8;" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Account Picker (shared) ──────────────────────────────────────────────────

function AccountPicker() {
  const { selectedAccountId, adAccounts, setSelectedAccountId } = useAdAccount()
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const accountName = (adAccounts as any[]).find(a => a.id === selectedAccountId)?.name || selectedAccountId || "—"

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch("") }
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const filtered = (adAccounts as any[]).filter(a => a.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium hover:bg-muted/50 transition-colors">
        <span className="size-2 rounded-full bg-blue-500 shrink-0" />
        <span className="max-w-[180px] truncate">{accountName}</span>
        <IconChevronDown className="size-3.5 text-muted-foreground" />
      </button>
      {open && filtered.length > 0 && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-popover border rounded-xl shadow-xl overflow-hidden min-w-[220px]">
          <div className="p-2 border-b">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/40">
              <IconSearch className="size-3.5 text-muted-foreground/50 shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search accounts..." autoFocus
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40" />
            </div>
          </div>
          <div className="py-1 max-h-64 overflow-y-auto">
            <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Ad Accounts</p>
            {filtered.map((acc: any) => (
              <button key={acc.id} onClick={() => { setSelectedAccountId(acc.id); setOpen(false); setSearch("") }}
                className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between gap-2 transition-colors",
                  acc.id === selectedAccountId && "text-primary font-medium"
                )}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn("size-2 rounded-full shrink-0", acc.id === selectedAccountId ? "bg-primary" : "bg-muted-foreground/30")} />
                  <span className="truncate">{acc.name}</span>
                </div>
                {acc.id === selectedAccountId && <IconCheck className="size-3.5 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ALL ACCOUNTS ─────────────────────────────────────────────────────────────

interface AccountRow {
  id: string; name: string; spend: number; impressions: number; linkClicks: number; ctr: number; cpm: number
}

export function AllAccountsView({ adAccounts }: { adAccounts: { id: string; name?: string }[] }) {
  const [datePreset, setDatePreset] = useState("last_30d")
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState("")
  const [metricKey, setMetricKey] = useState("spend")

  const load = useCallback(() => {
    if (!adAccounts.length) return
    const ids = adAccounts.map(a => a.id).join(",")
    setLoading(true); setError("")
    fetch(`/api/insights/statistics/all-accounts?adAccountIds=${encodeURIComponent(ids)}&datePreset=${datePreset}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); return }; setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [adAccounts, datePreset])

  useEffect(() => { load() }, [load])

  const accounts: AccountRow[] = data?.accounts || []
  const totals = data?.totals || {}
  const daily  = data?.daily  || []

  const METRIC_OPTS = [
    { value: "spend",  label: "Spend" },
    { value: "impressions", label: "Impressions" },
    { value: "linkClicks", label: "Link Clicks" },
  ]

  const handleExport = () => {
    const rows: (string | number)[][] = [
      ["Account", "Platform", "Spend", "Spend %", "Link Clicks", "Impressions", "CTR (%)", "CPM"],
      ...accounts.map(a => [
        a.name, "Meta",
        a.spend, totals.spend > 0 ? +((a.spend / totals.spend) * 100).toFixed(2) : 0,
        a.linkClicks, a.impressions,
        +a.ctr.toFixed(4), +a.cpm.toFixed(4),
      ]),
      ["Total", "", totals.spend || 0, 100, totals.clicks || 0, totals.impressions || 0,
       +((totals.ctr || 0).toFixed(4)), +((totals.cpm || 0).toFixed(4))],
    ]
    downloadCSV(`all-accounts-${datePreset}.csv`, rows)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Cross-Platform Spend</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Aggregated spend across all connected ad accounts</p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={handleExport}>
              <IconDownload className="size-3.5" /> Export CSV
            </Button>
          )}
          <DatePicker value={datePreset} onChange={setDatePreset} />
          <Button size="sm" variant="ghost" className="h-8" onClick={load} disabled={loading}>
            <IconRefresh className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorMsg message={error} onRetry={load} /> : !data ? null : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-5 gap-3">
            <KpiCard label="Total Spend"       value={fmt$(totals.spend || 0)} />
            <KpiCard label="Total Clicks"      value={fmtK(totals.clicks || 0)} />
            <KpiCard label="Total Impressions" value={fmtK(totals.impressions || 0)} />
            <KpiCard label="Avg CTR"           value={fmtPct(totals.ctr || 0)} />
            <KpiCard label="Avg CPM"           value={fmt$(totals.cpm || 0)} />
          </div>

          {/* Daily stacked bar */}
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Daily Spend by Account</h2>
              <select value={metricKey} onChange={e => setMetricKey(e.target.value)}
                className="text-xs border rounded-lg px-2 py-1 bg-background outline-none">
                {METRIC_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={daily} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={fmtDay} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => metricKey === "spend" ? `$${v >= 1000 ? (v/1000).toFixed(0)+"K" : v}` : fmtK(v)} />
                <Tooltip content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null
                  const active_items = payload.filter((p: any) => (p.value || 0) > 0)
                  if (!active_items.length) return null
                  return (
                    <div className="bg-popover border rounded-lg shadow-lg p-3 text-xs min-w-[200px]">
                      <p className="font-semibold mb-2 text-foreground">{fmtDay(label)}</p>
                      {active_items.map((p: any) => (
                        <div key={p.name} className="flex items-center justify-between gap-3 py-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: p.fill }} />
                            <span className="text-muted-foreground truncate">{p.name}</span>
                          </div>
                          <span className="font-semibold shrink-0 ml-2">
                            {metricKey === "spend" ? fmt$(p.value) : fmtK(p.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {accounts.map((acc, i) => (
                  <Bar key={acc.name} dataKey={metricKey === "spend" ? acc.name : acc.name + (metricKey === "impressions" ? "_impr" : "_clicks")}
                    name={acc.name} stackId="a" fill={ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]} radius={i === accounts.length - 1 ? [2,2,0,0] : undefined} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            {/* Legend with totals */}
            <div className="flex flex-wrap gap-4 mt-3">
              {accounts.map((acc, i) => (
                <div key={acc.id} className="flex items-center gap-1.5 text-xs">
                  <span className="size-3 rounded-sm shrink-0" style={{ backgroundColor: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length] }} />
                  <span className="text-muted-foreground">Meta {acc.name}</span>
                  <span className="font-semibold">{fmt$(acc.spend, 0)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Account breakdown table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b">
              <h2 className="text-sm font-semibold">Account Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Account</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Platform</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Spend ↓</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">%</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Clicks</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Impressions</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">CTR</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground">CPM</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map(acc => (
                    <tr key={acc.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 font-medium">{acc.name}</td>
                      <td className="px-3 py-3 text-muted-foreground">Meta</td>
                      <td className="px-3 py-3 text-right font-semibold">{fmt$(acc.spend)}</td>
                      <td className="px-3 py-3 text-right text-muted-foreground">{totals.spend > 0 ? ((acc.spend / totals.spend) * 100).toFixed(1) + "%" : "—"}</td>
                      <td className="px-3 py-3 text-right">{fmtK(acc.linkClicks)}</td>
                      <td className="px-3 py-3 text-right">{fmtK(acc.impressions)}</td>
                      <td className="px-3 py-3 text-right">{fmtPct(acc.ctr)}</td>
                      <td className="px-5 py-3 text-right">{fmt$(acc.cpm)}</td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="bg-muted/10 font-semibold">
                    <td className="px-5 py-3">Total ({accounts.length} accounts)</td>
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3 text-right">{fmt$(totals.spend || 0)}</td>
                    <td className="px-3 py-3 text-right">100%</td>
                    <td className="px-3 py-3 text-right">{fmtK(totals.clicks || 0)}</td>
                    <td className="px-3 py-3 text-right">{fmtK(totals.impressions || 0)}</td>
                    <td className="px-3 py-3 text-right">{fmtPct(totals.ctr || 0)}</td>
                    <td className="px-5 py-3 text-right">{fmt$(totals.cpm || 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── SPEND ────────────────────────────────────────────────────────────────────

export function SpendView() {
  const { selectedAccountId: accountId, adAccounts } = useAdAccount()
  const accountName = (adAccounts as any[]).find(a => a.id === accountId)?.name || accountId || "—"

  const [datePreset, setDatePreset] = useState("last_30d")
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(() => {
    if (!accountId) return
    setLoading(true); setError("")
    fetch(`/api/insights/statistics/spend?adAccountId=${encodeURIComponent(accountId)}&datePreset=${datePreset}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); return }; setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [accountId, datePreset])

  useEffect(() => { load() }, [load])

  const campaigns = data?.campaigns || []
  const totals    = data?.totals    || {}
  const daily     = data?.daily     || []
  const topNames  = data?.topCampaignNames || []

  const toggleExpand = (id: string) => {
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const CAMP_COLORS = ["#3b82f6","#f97316","#10b981","#8b5cf6","#ec4899"]

  const handleExport = () => {
    const rows: (string | number)[][] = [
      ["Type", "Name", "Objective", "Status", "Spend", "Impressions", "Link Clicks", "CTR (%)", "Results", "CPA"],
    ]
    campaigns.forEach((c: any) => {
      rows.push(["Campaign", c.name, c.objective || "", c.status || "", c.spend, c.impressions,
        c.linkClicks || 0, +((c.ctr || 0).toFixed(4)), c.results || 0, c.cpa > 0 ? +c.cpa.toFixed(2) : ""])
      ;(c.adsets || []).forEach((a: any) => {
        rows.push(["  Ad Set", a.name, "", "", a.spend, a.impressions || 0,
          a.linkClicks || 0, "", a.results || 0,
          a.results > 0 ? +(a.spend / a.results).toFixed(2) : ""])
      })
    })
    downloadCSV(`spend-campaigns-${datePreset}.csv`, rows)
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      ACTIVE: "bg-emerald-100 text-emerald-700",
      PAUSED: "bg-gray-100 text-gray-600",
      IN_PROCESS: "bg-blue-100 text-blue-700",
      ARCHIVED: "bg-gray-100 text-gray-500",
    }
    return map[s?.toUpperCase()] || "bg-gray-100 text-gray-600"
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Campaign Spend Analysis</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{accountName}</p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={handleExport}>
              <IconDownload className="size-3.5" /> Export CSV
            </Button>
          )}
          <AccountPicker />
          <DatePicker value={datePreset} onChange={setDatePreset} />
          <Button size="sm" variant="ghost" className="h-8" onClick={load} disabled={loading}>
            <IconRefresh className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorMsg message={error} onRetry={load} /> : !data ? null : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <KpiCard label="Total Campaigns"  value={String(totals.campaigns || 0)} />
            <KpiCard label="Total Ad Sets"    value={String(totals.adsets    || 0)} />
            <KpiCard label="Total Results"    value={String(totals.results   || 0)} />
            <KpiCard label="No Results"       value={String(totals.noResults || 0)} sub="Campaigns with 0 results" />
            <KpiCard label="Average CPA"      value={totals.avgCpa > 0 ? fmt$(totals.avgCpa) : "—"} sub="Cost per result" />
            <KpiCard label="Total Spend"      value={fmt$(totals.spend || 0)} />
          </div>

          {/* Campaign spend chart */}
          {daily.length > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <div className="mb-1">
                <h2 className="text-sm font-semibold">Campaign Spend</h2>
                <p className="text-xs text-muted-foreground">Total Spend: {fmt$(totals.spend || 0)}</p>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={daily} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={fmtDay} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+"K" : v}`} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: any) => fmt$(v)} labelFormatter={(s: any) => fmtDay(s)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {topNames.map((name: string, i: number) => (
                    <Bar key={name} dataKey={name} name={name.length > 30 ? name.slice(0, 30) + "…" : name}
                      stackId="a" fill={CAMP_COLORS[i % CAMP_COLORS.length]}
                      radius={i === topNames.length - 1 ? [2,2,0,0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Campaign / Adset tree table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Campaign / Ad Set</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Objective</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Spend ↓</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Results</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground">CPA</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c: any) => (
                    <React.Fragment key={c.id}>
                      <tr className="border-b hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => toggleExpand(c.id)}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {c.adsets.length > 0
                              ? expanded.has(c.id)
                                ? <IconChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                                : <IconChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                              : <span className="size-3.5" />
                            }
                            <span className="font-medium max-w-xs truncate">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground text-xs capitalize">{c.objective?.replace(/_/g, " ") || "—"}</td>
                        <td className="px-3 py-3">
                          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full capitalize", statusBadge(c.status))}>
                            {c.status?.toLowerCase().replace(/_/g, " ") || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold">{fmt$(c.spend)}</td>
                        <td className="px-3 py-3 text-right">{c.results || "—"}</td>
                        <td className="px-5 py-3 text-right text-muted-foreground">{c.cpa > 0 ? fmt$(c.cpa) : "—"}</td>
                      </tr>
                      {expanded.has(c.id) && c.adsets.map((a: any) => (
                        <tr key={a.id} className="border-b bg-muted/5 hover:bg-muted/10 transition-colors">
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-2 pl-6">
                              <span className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0" />
                              <span className="text-xs text-muted-foreground max-w-xs truncate">{a.name}</span>
                              <span className="text-[9px] text-muted-foreground/50">ID: {a.id}</span>
                            </div>
                          </td>
                          <td colSpan={2} />
                          <td className="px-3 py-2.5 text-right text-xs">{fmt$(a.spend)}</td>
                          <td className="px-3 py-2.5 text-right text-xs">{a.results || "—"}</td>
                          <td className="px-5 py-2.5 text-right text-xs text-muted-foreground">
                            {a.results > 0 ? fmt$(a.spend / a.results) : "—"}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── DEMOGRAPHIC ──────────────────────────────────────────────────────────────

export function DemographicView() {
  const { selectedAccountId: accountId, adAccounts } = useAdAccount()
  const accountName = (adAccounts as any[]).find(a => a.id === accountId)?.name || accountId || "—"

  const [datePreset, setDatePreset] = useState("this_month")
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")
  const [segmentDim, setSegmentDim]       = useState<"age" | "gender">("age")
  const [segmentMetric, setSegmentMetric] = useState("spend")

  // Campaign picker state
  const [selectedCampaignId, setSelectedCampaignId] = useState("")
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false)
  const [campaignSearch, setCampaignSearch]         = useState("")
  const [campaignsList, setCampaignsList]           = useState<{ id: string; name: string; spend: number }[]>([])
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close picker on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setCampaignPickerOpen(false); setCampaignSearch("")
      }
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const load = useCallback(() => {
    if (!accountId) return
    setLoading(true); setError("")
    const params = new URLSearchParams({ adAccountId: accountId, datePreset })
    if (selectedCampaignId) params.set("campaignId", selectedCampaignId)
    fetch(`/api/insights/statistics/demographic?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setData(d)
        // Always refresh the campaign picker list from account-level data
        if (d.campaignList?.length) setCampaignsList(d.campaignList)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [accountId, datePreset, selectedCampaignId])

  useEffect(() => { load() }, [load])

  const s          = data?.summary  || {}
  const gender     = data?.gender   || []
  const age        = data?.age      || []
  const ageGender  = data?.ageGender || []
  const campaigns  = data?.campaigns || []

  const segmentData = segmentDim === "age" ? age : gender
  const metricLabel: Record<string, string> = { spend: "Spend", ctr: "CTR (%)", cpm: "CPM", cpc: "CPC" }

  // CPM analysis
  const cpmSegments = ageGender
    .filter((a: any) => a.impressions > 100)
    .map((a: any) => ({ ...a, cpm: a.impressions > 0 ? (a.spend / a.impressions) * 1000 : 0 }))
    .sort((a: any, b: any) => b.cpm - a.cpm)
  const highestCpm = cpmSegments[0]
  const lowestCpm  = cpmSegments[cpmSegments.length - 1]

  const dateRange  = `Showing data for ${DATE_PRESETS.find(p => p.value === datePreset)?.label || datePreset}`
  const selectedCampaignName = campaignsList.find(c => c.id === selectedCampaignId)?.name || ""
  const filteredCampaignList = campaignsList.filter(c => c.name.toLowerCase().includes(campaignSearch.toLowerCase()))

  const handleExport = () => {
    const rows: (string | number)[][] = []
    const scope = selectedCampaignId ? (selectedCampaignName || selectedCampaignId) : "All Campaigns"

    // Gender section
    rows.push([`Gender Distribution — ${scope} — ${dateRange}`])
    rows.push(["Gender", "Spend", "Impressions", "Link Clicks", "CTR (%)", "CPM", "CPC", "Purchases", "Purchase Value", "ROAS"])
    gender.forEach((g: any) => rows.push([g.label, g.spend, g.impressions, g.linkClicks, +g.ctr.toFixed(4), +g.cpm.toFixed(4), +g.cpc.toFixed(4), g.purchases, g.purchaseValue, +g.roas.toFixed(4)]))
    rows.push([])

    // Age section
    rows.push([`Age Group Distribution — ${scope}`])
    rows.push(["Age Group", "Spend", "Impressions", "Link Clicks", "CTR (%)", "CPM", "CPC", "Purchases", "Purchase Value", "ROAS"])
    age.forEach((a: any) => rows.push([a.label, a.spend, a.impressions, a.linkClicks, +a.ctr.toFixed(4), +a.cpm.toFixed(4), +a.cpc.toFixed(4), a.purchases, a.purchaseValue, +a.roas.toFixed(4)]))
    rows.push([])

    // Age/Gender combined
    rows.push([`Age/Gender Combined — ${scope}`])
    rows.push(["Segment", "Spend", "Impressions", "Link Clicks", "CPM"])
    ageGender.forEach((ag: any) => rows.push([ag.label, ag.spend, ag.impressions, ag.linkClicks, +ag.cpm.toFixed(4)]))
    rows.push([])

    // Campaign performance (only when all campaigns)
    if (!selectedCampaignId && campaigns.length > 0) {
      rows.push(["Campaign Performance"])
      rows.push(["Campaign", "Spend", "Impressions", "Top Demographics"])
      campaigns.forEach((c: any) => rows.push([c.name, c.spend, c.impressions, (c.topDemographics || []).join(" | ")]))
    }

    const suffix = selectedCampaignId ? "-campaign" : ""
    downloadCSV(`demographics${suffix}-${datePreset}.csv`, rows)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <IconUsers className="size-6 text-muted-foreground" />
            <h1 className="text-xl font-bold">Meta Demographics</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 ml-8">{dateRange}</p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={handleExport}>
              <IconDownload className="size-3.5" /> Export CSV
            </Button>
          )}
          <AccountPicker />
          <DatePicker value={datePreset} onChange={setDatePreset} />
          <Button size="sm" variant="ghost" className="h-8" onClick={load} disabled={loading}>
            <IconRefresh className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Campaign picker */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => { setCampaignPickerOpen(v => !v); setCampaignSearch("") }}
          className={cn(
            "w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm transition-colors",
            campaignPickerOpen ? "border-primary/50 bg-primary/5" : "bg-card hover:bg-muted/30"
          )}
        >
          <span className="font-medium">
            {selectedCampaignId ? selectedCampaignName : "All Campaigns"}
          </span>
          <div className="flex items-center gap-2">
            {selectedCampaignId && (
              <span
                onClick={e => { e.stopPropagation(); setSelectedCampaignId(""); setCampaignPickerOpen(false) }}
                className="text-[10px] text-muted-foreground hover:text-destructive px-1.5 py-0.5 rounded hover:bg-destructive/10 transition-colors"
              >
                Clear
              </span>
            )}
            <IconChevronDown className={cn("size-4 text-muted-foreground transition-transform", campaignPickerOpen && "rotate-180")} />
          </div>
        </button>

        {campaignPickerOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border rounded-xl shadow-xl overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40">
                <IconSearch className="size-3.5 text-muted-foreground/50 shrink-0" />
                <input
                  value={campaignSearch} onChange={e => setCampaignSearch(e.target.value)}
                  placeholder="Search campaigns..." autoFocus
                  className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40"
                />
              </div>
            </div>
            {/* Options */}
            <div className="max-h-64 overflow-y-auto py-1">
              {/* All Campaigns option */}
              <button
                onClick={() => { setSelectedCampaignId(""); setCampaignPickerOpen(false); setCampaignSearch("") }}
                className={cn("w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors",
                  !selectedCampaignId && "text-primary font-medium"
                )}
              >
                <div className="flex items-center gap-2">
                  {!selectedCampaignId
                    ? <div className="size-4 rounded bg-primary flex items-center justify-center shrink-0"><IconCheck className="size-3 text-primary-foreground" /></div>
                    : <div className="size-4 rounded border shrink-0" />
                  }
                  <span>All Campaigns</span>
                </div>
              </button>
              {/* Individual campaigns */}
              {filteredCampaignList.map(c => (
                <button key={c.id}
                  onClick={() => { setSelectedCampaignId(c.id); setCampaignPickerOpen(false); setCampaignSearch("") }}
                  className={cn("w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors",
                    selectedCampaignId === c.id && "text-primary font-medium"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedCampaignId === c.id
                      ? <div className="size-4 rounded bg-primary flex items-center justify-center shrink-0"><IconCheck className="size-3 text-primary-foreground" /></div>
                      : <div className="size-4 rounded border shrink-0" />
                    }
                    <span className="truncate">{c.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-4">{fmt$(c.spend, 0)}</span>
                </button>
              ))}
              {filteredCampaignList.length === 0 && campaignSearch && (
                <p className="px-4 py-4 text-sm text-muted-foreground/50 text-center">No campaigns found</p>
              )}
            </div>
          </div>
        )}
      </div>

      {loading ? <LoadingState /> : error ? <ErrorMsg message={error} onRetry={load} /> : !data ? null : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <KpiCard label="Top Gender"       value={s.topGender?.label || "—"}        sub={s.topGender ? `${fmt$(s.topGender.spend)} (${s.topGender.pct?.toFixed(1)}%)` : undefined} />
            <KpiCard label="Top Age Group"    value={s.topAge?.label    || "—"}        sub={s.topAge    ? `${fmt$(s.topAge.spend)} (${s.topAge.pct?.toFixed(1)}%)` : undefined} />
            <KpiCard label="Top Age/Gender"   value={s.topAgeGender?.label || "—"}     sub={s.topAgeGender ? `${s.topAgeGender.pct?.toFixed(1)}%` : undefined} />
            <KpiCard label="Total Purchases"  value={String(Math.round(s.totalPurchases || 0))} sub="Based on campaign objectives" />
            <KpiCard label="Average CPA"      value={s.avgCpa > 0 ? fmt$(s.avgCpa) : "—"} sub="Cost per purchases" />
            <KpiCard label="Best CPA Segment" value={s.bestCpaSegment || "N/A"} sub="No data per purchases" />
          </div>

          {/* Gender + Age distribution */}
          <div className="grid grid-cols-2 gap-4">
            {/* Gender donut */}
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold mb-0.5">Gender Distribution</h2>
              <p className="text-xs text-muted-foreground mb-4">Overall gender distribution across all campaigns</p>
              <div className="flex items-center justify-center gap-8">
                <PieChart width={180} height={180}>
                  <Pie data={gender} cx={85} cy={85} innerRadius={50} outerRadius={80}
                    dataKey="spend" nameKey="label" paddingAngle={2}>
                    {gender.map((g: any) => (
                      <Cell key={g.label} fill={GENDER_COLORS[g.label] || "#9ca3af"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt$(v)} />
                </PieChart>
                <div className="space-y-2">
                  {gender.map((g: any) => {
                    const total = gender.reduce((s: number, x: any) => s + x.spend, 0)
                    const pct   = total > 0 ? ((g.spend / total) * 100).toFixed(1) : "0"
                    return (
                      <div key={g.label} className="flex items-center gap-2">
                        <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: GENDER_COLORS[g.label] || "#9ca3af" }} />
                        <span className="text-sm font-medium">{pct}%</span>
                        <span className="text-xs text-muted-foreground">{g.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Age bar */}
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold mb-0.5">Age Group Distribution</h2>
              <p className="text-xs text-muted-foreground mb-4">Spend trends across age groups</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={age} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+"K" : v}`} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} formatter={(v: any) => fmt$(v)} />
                  <Bar dataKey="spend" name="Spend" radius={[2,2,0,0]}>
                    {age.map((a: any) => (
                      <Cell key={a.label} fill={AGE_COLORS[a.label] || "#6366f1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Age spend share donut + Performance by segment */}
          <div className="grid grid-cols-2 gap-4">
            {/* Age spend share donut */}
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold mb-0.5">Age Spend Share</h2>
              <p className="text-xs text-muted-foreground mb-4">Share of spend by age bucket</p>
              <div className="flex items-center gap-6">
                <PieChart width={200} height={200}>
                  <Pie data={age} cx={95} cy={95} innerRadius={55} outerRadius={90}
                    dataKey="spend" nameKey="label" paddingAngle={2}>
                    {age.map((a: any) => (
                      <Cell key={a.label} fill={AGE_COLORS[a.label] || "#6366f1"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt$(v)} />
                </PieChart>
                <div className="space-y-1.5 flex-1">
                  {age.map((a: any) => {
                    const total = age.reduce((s: number, x: any) => s + x.spend, 0)
                    const pct   = total > 0 ? ((a.spend / total) * 100).toFixed(1) : "0"
                    return (
                      <div key={a.label} className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: AGE_COLORS[a.label] || "#6366f1" }} />
                        <span className="text-[11px] text-muted-foreground w-12">{a.label}</span>
                        <span className="text-[11px] font-medium">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Performance by segment */}
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold">Performance by segment</h2>
                  <p className="text-xs text-muted-foreground">Breakdown and metric</p>
                </div>
                <div className="flex gap-2">
                  <select value={segmentDim} onChange={e => setSegmentDim(e.target.value as any)}
                    className="text-xs border rounded-lg px-2 py-1 bg-background outline-none">
                    <option value="age">Age</option>
                    <option value="gender">Gender</option>
                  </select>
                  <select value={segmentMetric} onChange={e => setSegmentMetric(e.target.value)}
                    className="text-xs border rounded-lg px-2 py-1 bg-background outline-none">
                    <option value="spend">Spend</option>
                    <option value="ctr">CTR</option>
                    <option value="cpm">CPM</option>
                    <option value="cpc">CPC</option>
                  </select>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={segmentData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => segmentMetric === "spend" || segmentMetric === "cpm" || segmentMetric === "cpc" ? `$${v}` : v.toFixed(1)} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    formatter={(v: any) => segmentMetric === "ctr" ? fmtPct(v) : fmt$(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey={segmentMetric} name={metricLabel[segmentMetric]} fill="#8b5cf6" radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Campaign Performance table */}
          {campaigns.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b">
                <h2 className="text-sm font-semibold">Campaign Performance</h2>
                <p className="text-xs text-muted-foreground">Top performing campaigns by spend</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Campaign</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Spend</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Impressions</th>
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Top Demographics</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c: any) => (
                      <tr key={c.name} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium max-w-xs truncate">{c.name}</p>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold">{fmt$(c.spend)}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground">{fmtK(c.impressions)}</td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {c.topDemographics?.map((d: string) => (
                              <span key={d} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{d}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Combined Age/Gender Performance */}
          {ageGender.length > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold mb-0.5">Combined Age/Gender Performance</h2>
              <p className="text-xs text-muted-foreground mb-4">Spend distribution across demographic segments</p>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={ageGender.slice(0, 14)} margin={{ top: 4, right: 24, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                  <XAxis dataKey="label" tick={{ fontSize: 8 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis yAxisId="left"  tick={{ fontSize: 9 }} tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+"K" : v}`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} tickFormatter={fmtK} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    formatter={(v: any, name: any) => name === "Impressions" ? fmtK(v) : fmt$(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar   yAxisId="left"  dataKey="spend"       name="Spend"       fill="#8b5cf6" radius={[2,2,0,0]} />
                  <Line  yAxisId="right" dataKey="impressions" name="Impressions" stroke="#10b981" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* CPM Analysis */}
          {cpmSegments.length > 0 && (
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <IconChartBar className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Insights & Analysis</h2>
                </div>
                <p className="text-xs text-muted-foreground">Cost per Mille (CPM) Analysis by Demographic</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Highest CPM</p>
                  <p className="font-semibold capitalize">{highestCpm?.label || "—"}</p>
                  <p className="text-xs text-muted-foreground">CPM: {highestCpm ? fmt$(highestCpm.cpm) : "—"}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Lowest CPM</p>
                  <p className="font-semibold capitalize">{lowestCpm?.label || "—"}</p>
                  <p className="text-xs text-muted-foreground">CPM: {lowestCpm ? fmt$(lowestCpm.cpm) : "—"}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">CPM Range</p>
                  <p className="font-semibold">Across Demographics</p>
                  <p className="text-xs text-muted-foreground">
                    {lowestCpm && highestCpm ? `${fmt$(lowestCpm.cpm)} – ${fmt$(highestCpm.cpm)}` : "—"}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3">CPM by Demographic Segment</h3>
                <div className="grid grid-cols-2 gap-3">
                  {cpmSegments.slice(0, 8).map((s: any) => (
                    <div key={s.label} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-semibold capitalize">{s.label}</p>
                        <p className="text-[10px] text-muted-foreground">Total Spend: {fmt$(s.spend)} · Impressions: {fmtK(s.impressions)}</p>
                      </div>
                      <p className="text-sm font-bold text-right shrink-0 ml-4">CPM: {fmt$(s.cpm)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── COUNTRY ──────────────────────────────────────────────────────────────────

const COUNTRY_COLORS = ["#3b82f6","#06b6d4","#8b5cf6","#ec4899","#f59e0b","#10b981","#ef4444","#84cc16","#f97316","#6366f1"]

export function CountryView() {
  const { selectedAccountId: accountId, adAccounts } = useAdAccount()
  const accountName = (adAccounts as any[]).find(a => a.id === accountId)?.name || accountId || "—"

  const [datePreset, setDatePreset]     = useState("last_30d")
  const [data, setData]                 = useState<any>(null)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState("")
  const [chartMetric, setChartMetric]   = useState("spend")
  const [sortField, setSortField]       = useState("spend")
  const [sortDir, setSortDir]           = useState<"asc" | "desc">("desc")

  // Campaign picker
  const [selectedCampaignId, setSelectedCampaignId] = useState("")
  const [campaignPickerOpen, setCampaignPickerOpen]   = useState(false)
  const [campaignSearch, setCampaignSearch]           = useState("")
  const [campaignsList, setCampaignsList]             = useState<{ id: string; name: string; spend: number }[]>([])
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setCampaignPickerOpen(false); setCampaignSearch("")
      }
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const load = useCallback(() => {
    if (!accountId) return
    setLoading(true); setError("")
    const params = new URLSearchParams({ adAccountId: accountId, datePreset })
    if (selectedCampaignId) params.set("campaignId", selectedCampaignId)
    fetch(`/api/insights/statistics/country?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setData(d)
        if (d.campaignList?.length) setCampaignsList(d.campaignList)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [accountId, datePreset, selectedCampaignId])

  useEffect(() => { load() }, [load])

  const countries  = data?.countries || []
  const s          = data?.summary   || {}

  const sortedCountries = [...countries].sort((a: any, b: any) => {
    const av = a[sortField] ?? 0, bv = b[sortField] ?? 0
    return sortDir === "desc" ? bv - av : av - bv
  })

  const top10       = countries.slice(0, 10)
  const totalSpend  = countries.reduce((sum: number, c: any) => sum + c.spend, 0)
  const filteredCampaignList = campaignsList.filter(c => c.name.toLowerCase().includes(campaignSearch.toLowerCase()))
  const selectedCampaignName = campaignsList.find(c => c.id === selectedCampaignId)?.name || ""

  const CHART_OPTS = [
    { value: "spend", label: "Spend" },
    { value: "impressions", label: "Impressions" },
    { value: "linkClicks", label: "Link Clicks" },
    { value: "cpm", label: "CPM" },
    { value: "ctr", label: "CTR" },
  ]

  const handleExport = () => {
    const rows: (string | number)[][] = [
      ["Country Code", "Country", "Spend", "Impressions", "Link Clicks", "CTR (%)", "CPM", "CPC", "Purchases", "CPA", "ROAS"],
      ...countries.map((c: any) => [c.code, c.label, c.spend, c.impressions, c.linkClicks, +c.ctr.toFixed(4), +c.cpm.toFixed(4), +c.cpc.toFixed(4), c.purchases, c.cpa > 0 ? +c.cpa.toFixed(2) : 0, +c.roas.toFixed(4)]),
    ]
    downloadCSV(`country-${datePreset}.csv`, rows)
  }

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === "desc" ? "asc" : "desc")
    else { setSortField(field); setSortDir("desc") }
  }
  const SortArrow = ({ field }: { field: string }) => (
    <span className={cn("ml-0.5 text-[10px]", sortField === field ? "text-primary" : "text-muted-foreground/30")}>
      {sortField === field ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
    </span>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <IconWorld className="size-6 text-muted-foreground" />
            <h1 className="text-xl font-bold">Meta Country Analysis</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 ml-8">{accountName}</p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <button onClick={handleExport}
              className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border bg-background hover:bg-muted/50 transition-colors">
              <IconDownload className="size-3.5" /> Export CSV
            </button>
          )}
          <AccountPicker />
          <DatePicker value={datePreset} onChange={setDatePreset} />
          <Button size="sm" variant="ghost" className="h-8" onClick={load} disabled={loading}>
            <IconRefresh className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Campaign picker */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => { setCampaignPickerOpen(v => !v); setCampaignSearch("") }}
          className={cn(
            "w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm transition-colors",
            campaignPickerOpen ? "border-primary/50 bg-primary/5" : "bg-card hover:bg-muted/30"
          )}
        >
          <span className="font-medium">{selectedCampaignId ? selectedCampaignName : "All Campaigns"}</span>
          <div className="flex items-center gap-2">
            {selectedCampaignId && (
              <span onClick={e => { e.stopPropagation(); setSelectedCampaignId(""); setCampaignPickerOpen(false) }}
                className="text-[10px] text-muted-foreground hover:text-destructive px-1.5 py-0.5 rounded hover:bg-destructive/10 transition-colors">Clear</span>
            )}
            <IconChevronDown className={cn("size-4 text-muted-foreground transition-transform", campaignPickerOpen && "rotate-180")} />
          </div>
        </button>
        {campaignPickerOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border rounded-xl shadow-xl overflow-hidden">
            <div className="p-2 border-b">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40">
                <IconSearch className="size-3.5 text-muted-foreground/50 shrink-0" />
                <input value={campaignSearch} onChange={e => setCampaignSearch(e.target.value)}
                  placeholder="Search campaigns..." autoFocus
                  className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40" />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              <button onClick={() => { setSelectedCampaignId(""); setCampaignPickerOpen(false); setCampaignSearch("") }}
                className={cn("w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors", !selectedCampaignId && "text-primary font-medium")}>
                {!selectedCampaignId
                  ? <div className="size-4 rounded bg-primary flex items-center justify-center shrink-0"><IconCheck className="size-3 text-primary-foreground" /></div>
                  : <div className="size-4 rounded border shrink-0" />}
                All Campaigns
              </button>
              {filteredCampaignList.map(c => (
                <button key={c.id} onClick={() => { setSelectedCampaignId(c.id); setCampaignPickerOpen(false); setCampaignSearch("") }}
                  className={cn("w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors", selectedCampaignId === c.id && "text-primary font-medium")}>
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedCampaignId === c.id
                      ? <div className="size-4 rounded bg-primary flex items-center justify-center shrink-0"><IconCheck className="size-3 text-primary-foreground" /></div>
                      : <div className="size-4 rounded border shrink-0" />}
                    <span className="truncate">{c.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground ml-4 shrink-0">{fmt$(c.spend, 0)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading ? <LoadingState /> : error ? <ErrorMsg message={error} onRetry={load} /> : !data ? null : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <KpiCard label="Top Country"       value={s.topCountry?.label || "—"}        sub={s.topCountry ? `${fmt$(s.topCountry.spend)} · ${s.topCountry.pct?.toFixed(1)}%` : undefined} />
            <KpiCard label="Countries"         value={String(s.countriesCount || 0)}     sub="Targeted countries" />
            <KpiCard label="Total Spend"       value={fmt$(s.totalSpend || 0)} />
            <KpiCard label="Total Link Clicks" value={fmtK(s.totalClicks || 0)} />
            <KpiCard label="Avg CPA"           value={s.avgCpa > 0 ? fmt$(s.avgCpa) : "—"} sub="Cost per purchase" />
            <KpiCard label="Best CPA Country"  value={s.bestCpaCountry?.label || "N/A"} sub={s.bestCpaCountry ? fmt$(s.bestCpaCountry.cpa) : undefined} />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Pie distribution */}
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold mb-0.5">Country Distribution</h2>
              <p className="text-xs text-muted-foreground mb-4">Spend share by country (top 10)</p>
              <div className="flex items-center gap-4">
                <PieChart width={180} height={180}>
                  <Pie data={top10} cx={85} cy={85} innerRadius={48} outerRadius={82}
                    dataKey="spend" nameKey="label" paddingAngle={2}>
                    {top10.map((_: any, i: number) => (
                      <Cell key={i} fill={COUNTRY_COLORS[i % COUNTRY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt$(v)} />
                </PieChart>
                <div className="space-y-1.5 flex-1 overflow-hidden">
                  {top10.map((c: any, i: number) => {
                    const pct = totalSpend > 0 ? ((c.spend / totalSpend) * 100).toFixed(1) : "0"
                    return (
                      <div key={c.code} className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: COUNTRY_COLORS[i % COUNTRY_COLORS.length] }} />
                        <span className="text-[11px] text-muted-foreground w-8 shrink-0">{c.code}</span>
                        <span className="text-[11px] font-medium">{pct}%</span>
                        <span className="text-[10px] text-muted-foreground truncate">{c.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Bar chart top 10 */}
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold">Top 10 Countries</h2>
                  <p className="text-xs text-muted-foreground">By selected metric</p>
                </div>
                <select value={chartMetric} onChange={e => setChartMetric(e.target.value)}
                  className="text-xs border rounded-lg px-2 py-1 bg-background outline-none">
                  {CHART_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 9 }}
                    tickFormatter={v => chartMetric === "spend" || chartMetric === "cpm" || chartMetric === "cpc"
                      ? `$${v >= 1000 ? (v/1000).toFixed(0)+"K" : v}`
                      : chartMetric === "ctr" ? v.toFixed(1)+"%" : fmtK(v)} />
                  <YAxis type="category" dataKey="code" tick={{ fontSize: 10 }} width={30} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    formatter={(v: any) => chartMetric === "ctr" ? fmtPct(v) : chartMetric === "spend" || chartMetric === "cpm" || chartMetric === "cpc" ? fmt$(v) : fmtK(v)} />
                  <Bar dataKey={chartMetric} fill="#3b82f6" radius={[0,2,2,0]}>
                    {top10.map((_: any, i: number) => (
                      <Cell key={i} fill={COUNTRY_COLORS[i % COUNTRY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Country Performance Table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Country Performance</h2>
                <p className="text-xs text-muted-foreground">{countries.length} countries · click column header to sort</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Country</th>
                    {[
                      { key: "spend",       label: "Spend" },
                      { key: "impressions", label: "Impressions" },
                      { key: "linkClicks",  label: "Clicks" },
                      { key: "ctr",         label: "CTR" },
                      { key: "cpm",         label: "CPM" },
                      { key: "cpc",         label: "CPC" },
                      { key: "purchases",   label: "Purchases" },
                      { key: "cpa",         label: "CPA" },
                    ].map(col => (
                      <th key={col.key} onClick={() => toggleSort(col.key)}
                        className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">
                        {col.label}<SortArrow field={col.key} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedCountries.map((c: any, i: number) => (
                    <tr key={c.code} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: COUNTRY_COLORS[i % COUNTRY_COLORS.length] }} />
                          <span className="font-medium">{c.label}</span>
                          <span className="text-xs text-muted-foreground/50">{c.code}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold">{fmt$(c.spend)}</td>
                      <td className="px-3 py-3 text-right text-muted-foreground">{fmtK(c.impressions)}</td>
                      <td className="px-3 py-3 text-right">{fmtK(c.linkClicks)}</td>
                      <td className="px-3 py-3 text-right">{fmtPct(c.ctr)}</td>
                      <td className="px-3 py-3 text-right">{fmt$(c.cpm)}</td>
                      <td className="px-3 py-3 text-right">{fmt$(c.cpc)}</td>
                      <td className="px-3 py-3 text-right">{c.purchases > 0 ? Math.round(c.purchases) : "—"}</td>
                      <td className="px-3 py-3 text-right text-muted-foreground">{c.cpa > 0 ? fmt$(c.cpa) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── AD HISTORY ───────────────────────────────────────────────────────────────

// ─── Ad History sub-components ────────────────────────────────────────────────

function calcAdAge(createdTime: string): number {
  if (!createdTime) return 0
  return Math.max(0, Math.round((Date.now() - new Date(createdTime).getTime()) / 86_400_000))
}

function AdCreativeCard({ ad }: { ad: any }) {
  const age       = calcAdAge(ad.createdTime)
  const dateStr   = ad.createdTime
    ? new Date(ad.createdTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : ""
  const [imgOk, setImgOk] = useState(true)

  return (
    <div className="rounded-xl border bg-card overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 flex flex-col">
      {/* Thumbnail — square, crisp */}
      <div className="relative aspect-square bg-muted/20 overflow-hidden shrink-0">
        {ad.thumbnail && imgOk ? (
          <img
            src={ad.thumbnail}
            alt={ad.adName}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => setImgOk(false)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {ad.isVideo
              ? <IconVideo className="size-7 text-muted-foreground/20" />
              : <IconPhoto className="size-7 text-muted-foreground/20" />}
          </div>
        )}
        {ad.isVideo && (
          <div className="absolute top-1.5 right-1.5 bg-black/65 backdrop-blur-sm rounded-md px-1.5 py-0.5 flex items-center gap-1">
            <IconVideo className="size-2.5 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 flex flex-col flex-1 gap-1.5">
        <div>
          <p className="text-[11px] font-semibold leading-tight truncate" title={ad.adName}>{ad.adName}</p>
          {ad.campaignName && (
            <p className="text-[9px] text-muted-foreground/50 truncate mt-0.5" title={ad.campaignName}>
              Campaign: {ad.campaignName}
            </p>
          )}
        </div>

        {/* Colored metrics */}
        <div className="space-y-1 mt-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-emerald-600/80">Spend</span>
            <span className="text-[10px] font-bold text-emerald-600">{fmt$(ad.spend)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-amber-600/80">CPC</span>
            <span className="text-[10px] font-bold text-amber-600">{ad.cpc > 0 ? fmt$(ad.cpc) : "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-rose-600/80">CTR</span>
            <span className="text-[10px] font-bold text-rose-600">{fmtPct(ad.ctr)}</span>
          </div>
        </div>

        {/* Age */}
        {age > 0 && (
          <div className="mt-auto pt-1.5 border-t border-dashed border-muted/50">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground/50 font-medium uppercase tracking-wide">Age</span>
              <span className="text-[10px] text-muted-foreground font-semibold">{age} days</span>
            </div>
            {dateStr && <p className="text-[9px] text-muted-foreground/40 text-right mt-0.5">{dateStr}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function AdHistoryMonthCard({ month, sortBy }: { month: any; sortBy: string }) {
  const [showAll, setShowAll] = useState(false)

  const sortedAds = useMemo(() => {
    const list = [...month.ads]
    if (sortBy === "ctr")  list.sort((a: any, b: any) => b.ctr - a.ctr)
    else if (sortBy === "cpc") list.sort((a: any, b: any) => (a.cpc || 999) - (b.cpc || 999))
    else list.sort((a: any, b: any) => b.spend - a.spend)
    return list
  }, [month.ads, sortBy])

  const visibleAds = showAll ? sortedAds : sortedAds.slice(0, 10)

  const avgAge = month.ads.length > 0
    ? Math.round(month.ads.reduce((s: number, a: any) => s + calcAdAge(a.createdTime), 0) / month.ads.length)
    : 0

  const [monthName, year] = month.monthLabel.split(" ")
  const hasData = month.ads.length > 0

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Month header */}
      <div className="px-5 py-4 border-b bg-muted/[0.03]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h3 className="text-xl font-bold leading-none">{monthName}</h3>
              <span className="text-base font-semibold text-muted-foreground/50">{year}</span>
            </div>
            <p className="text-xs text-muted-foreground/60 mt-1">{month.ads.length} creatives</p>
          </div>
          <div className="flex items-center gap-5 shrink-0 flex-wrap justify-end">
            <div className="text-right">
              <p className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Spend</p>
              <p className="text-sm font-bold text-emerald-600">{fmt$(month.totalSpend)}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Avg. Age</p>
              <p className="text-sm font-bold text-blue-600">{avgAge > 0 ? `${avgAge} days` : "—"}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Avg CPC</p>
              <p className="text-sm font-bold text-amber-600">{month.cpc > 0 ? fmt$(month.cpc) : "—"}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Avg CTR</p>
              <p className="text-sm font-bold text-rose-600">{fmtPct(month.ctr)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground/30">
          <div className="size-9 rounded-full border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
            <IconMoodEmpty className="size-5" />
          </div>
          <p className="text-sm font-medium text-muted-foreground/40">No creatives found for {month.monthLabel}</p>
        </div>
      ) : (
        <div className="p-4">
          <div className="grid grid-cols-4 gap-3">
            {visibleAds.map((ad: any) => (
              <AdCreativeCard key={ad.adId + month.monthKey} ad={ad} />
            ))}
          </div>
          {sortedAds.length > 10 && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="w-full mt-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-dashed rounded-lg hover:bg-muted/30 transition-colors"
            >
              {showAll ? "Show less" : `Show all ${sortedAds.length} creatives`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── AD HISTORY VIEW ──────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: "spend", label: "Top by Spend" },
  { value: "ctr",   label: "Top by CTR" },
  { value: "cpc",   label: "Best CPC" },
]

export function AdHistoryView() {
  const { selectedAccountId: accountId } = useAdAccount()

  const [datePreset, setDatePreset]   = useState("last_90d")
  const [data, setData]               = useState<any>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState("")
  const [sortBy, setSortBy]           = useState("spend")
  const [sortOpen, setSortOpen]       = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  // Campaign picker
  const [selectedCampaignId, setSelectedCampaignId] = useState("")
  const [campaignPickerOpen, setCampaignPickerOpen]   = useState(false)
  const [campaignSearch, setCampaignSearch]           = useState("")
  const [campaignsList, setCampaignsList]             = useState<{ id: string; name: string; spend: number }[]>([])
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setCampaignPickerOpen(false); setCampaignSearch("")
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const load = useCallback(() => {
    if (!accountId) return
    setLoading(true); setError("")
    const params = new URLSearchParams({ adAccountId: accountId, datePreset })
    if (selectedCampaignId) params.set("campaignId", selectedCampaignId)
    fetch(`/api/insights/statistics/ad-history?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setData(d)
        if (d.campaignList?.length) setCampaignsList(d.campaignList)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [accountId, datePreset, selectedCampaignId])

  useEffect(() => { load() }, [load])

  const months   = data?.months   || []
  const summary  = data?.summary  || {}

  const allAds = useMemo(() => months.flatMap((m: any) => m.ads), [months])
  const overallAvgAge = allAds.length > 0
    ? Math.round(allAds.reduce((s: number, a: any) => s + calcAdAge(a.createdTime), 0) / allAds.length)
    : 0

  const filteredCampaignList = campaignsList.filter(c => c.name.toLowerCase().includes(campaignSearch.toLowerCase()))
  const selectedCampaignName = campaignsList.find(c => c.id === selectedCampaignId)?.name || ""
  const sortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || "Top by Spend"

  const handleExport = () => {
    const rows: (string | number)[][] = [
      ["Month", "Ad Name", "Campaign", "Spend", "Impressions", "Link Clicks", "CTR (%)", "CPC", "Age (days)"]
    ]
    months.forEach((m: any) => {
      m.ads.forEach((a: any) => {
        rows.push([m.monthLabel, a.adName, a.campaignName, a.spend, a.impressions, a.linkClicks,
          +a.ctr.toFixed(4), +a.cpc.toFixed(4), calcAdAge(a.createdTime)])
      })
    })
    downloadCSV(`ad-history-${datePreset}.csv`, rows)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconHistory className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-bold">Ad History</h1>
        </div>
        <div className="flex items-center gap-2">
          <AccountPicker />
          <DatePicker value={datePreset} onChange={setDatePreset} />
          <Button size="sm" variant="ghost" className="h-8" onClick={load} disabled={loading}>
            <IconRefresh className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex items-center gap-2.5">
        {/* Campaign picker */}
        <div className="relative flex-1 max-w-xs" ref={pickerRef}>
          <button
            onClick={() => { setCampaignPickerOpen(v => !v); setCampaignSearch("") }}
            className={cn(
              "w-full flex items-center justify-between gap-2 h-9 px-3 rounded-lg border text-sm transition-colors",
              campaignPickerOpen ? "border-primary/50 bg-primary/5" : "bg-card hover:bg-muted/40"
            )}
          >
            <span className="font-medium truncate">{selectedCampaignId ? selectedCampaignName : "All Campaigns"}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {selectedCampaignId && (
                <span
                  onClick={e => { e.stopPropagation(); setSelectedCampaignId("") }}
                  className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                >
                  <IconX className="size-3" />
                </span>
              )}
              <IconChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", campaignPickerOpen && "rotate-180")} />
            </div>
          </button>
          {campaignPickerOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border rounded-xl shadow-xl overflow-hidden">
              <div className="p-2 border-b">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/40">
                  <IconSearch className="size-3.5 text-muted-foreground/50 shrink-0" />
                  <input value={campaignSearch} onChange={e => setCampaignSearch(e.target.value)}
                    placeholder="Search campaigns..." autoFocus
                    className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40" />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                <button
                  onClick={() => { setSelectedCampaignId(""); setCampaignPickerOpen(false) }}
                  className={cn("w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors", !selectedCampaignId && "text-primary font-medium")}
                >
                  {!selectedCampaignId
                    ? <div className="size-4 rounded bg-primary flex items-center justify-center shrink-0"><IconCheck className="size-3 text-primary-foreground" /></div>
                    : <div className="size-4 rounded border shrink-0" />}
                  All Campaigns
                </button>
                {filteredCampaignList.map(c => (
                  <button key={c.id}
                    onClick={() => { setSelectedCampaignId(c.id); setCampaignPickerOpen(false) }}
                    className={cn("w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors", selectedCampaignId === c.id && "text-primary font-medium")}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {selectedCampaignId === c.id
                        ? <div className="size-4 rounded bg-primary flex items-center justify-center shrink-0"><IconCheck className="size-3 text-primary-foreground" /></div>
                        : <div className="size-4 rounded border shrink-0" />}
                      <span className="truncate">{c.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground ml-3 shrink-0">{fmt$(c.spend, 0)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sort picker */}
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setSortOpen(v => !v)}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm bg-card hover:bg-muted/40 transition-colors"
          >
            {sortLabel}
            <IconChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", sortOpen && "rotate-180")} />
          </button>
          {sortOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-xl shadow-xl py-1 min-w-[160px]">
              {SORT_OPTIONS.map(o => (
                <button key={o.value} onClick={() => { setSortBy(o.value); setSortOpen(false) }}
                  className={cn("w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50 flex items-center justify-between transition-colors",
                    sortBy === o.value && "text-primary font-medium")}>
                  {o.label}
                  {sortBy === o.value && <span className="size-1.5 rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export */}
        <div className="ml-auto">
          {data && (
            <button onClick={handleExport}
              className="flex items-center gap-1.5 h-9 px-3 text-sm rounded-lg border bg-card hover:bg-muted/40 transition-colors">
              <IconDownload className="size-3.5 text-muted-foreground" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorMsg message={error} onRetry={load} /> : !data ? null : (
        <>
          {/* Summary KPIs — large, like competitor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card px-6 py-5">
              <p className="text-sm text-muted-foreground font-medium">Total Spend</p>
              <p className="text-3xl font-bold mt-1.5 tracking-tight">{fmt$(summary.totalSpend || 0)}</p>
              <p className="text-xs text-muted-foreground/60 mt-1.5">
                Across {summary.uniqueAdCount || 0} unique creatives
                {loading && " (Loading more...)"}
              </p>
            </div>
            <div className="rounded-xl border bg-card px-6 py-5">
              <p className="text-sm text-muted-foreground font-medium">Average Age of Top Ads</p>
              <p className="text-3xl font-bold mt-1.5 tracking-tight">{overallAvgAge > 0 ? `${overallAvgAge} days` : "—"}</p>
              <p className="text-xs text-muted-foreground/60 mt-1.5">Average age when they were top performers</p>
            </div>
          </div>

          {/* Month grid — 2 columns */}
          {months.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20">
              <IconMoodEmpty className="size-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No ad history found for this period.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {months.map((m: any) => (
                <AdHistoryMonthCard key={m.monthKey} month={m} sortBy={sortBy} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── PLACEMENTS ───────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  Facebook: "#3b82f6",
  Instagram: "#ec4899",
  "Audience Network": "#f59e0b",
  Messenger: "#06b6d4",
}

function platformColor(name: string) {
  return PLATFORM_COLORS[name] || ACCOUNT_COLORS[Object.keys(PLATFORM_COLORS).length % ACCOUNT_COLORS.length]
}

export function PlacementsView() {
  const { selectedAccountId: accountId, adAccounts } = useAdAccount()
  const accountName = (adAccounts as any[]).find(a => a.id === accountId)?.name || accountId || "—"

  const [datePreset, setDatePreset]   = useState("last_30d")
  const [data, setData]               = useState<any>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState("")
  const [innerTab, setInnerTab]       = useState<"daily" | "distribution" | "comparison">("daily")
  const [dailyMetric, setDailyMetric] = useState("spend")

  const load = useCallback(() => {
    if (!accountId) return
    setLoading(true); setError("")
    fetch(`/api/insights/statistics/placements?adAccountId=${encodeURIComponent(accountId)}&datePreset=${datePreset}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); return }; setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [accountId, datePreset])

  useEffect(() => { load() }, [load])

  const placements     = data?.placements     || []
  const platforms      = data?.platforms      || []
  const platformNames  = data?.platformNames  || []
  const daily          = data?.daily          || []
  const s              = data?.summary        || {}

  const DAILY_OPTS = [
    { value: "spend",   label: "Spend" },
    { value: "impr",    label: "Impressions" },
    { value: "clicks",  label: "Link Clicks" },
  ]

  const totalSpend = platforms.reduce((sum: number, p: any) => sum + p.spend, 0)

  const handleExport = () => {
    const rows: (string | number)[][] = [
      ["Platform", "Placement", "Spend", "Impressions", "Link Clicks", "CTR (%)", "CPM", "CPC", "Purchases", "CPA"],
      ...placements.map((p: any) => [p.platform, p.position, p.spend, p.impressions, p.linkClicks, +p.ctr.toFixed(4), +p.cpm.toFixed(4), +p.cpc.toFixed(4), p.purchases, p.cpa > 0 ? +p.cpa.toFixed(2) : 0]),
      [],
      ["Platform Summary"],
      ["Platform", "Spend", "%", "Impressions", "Link Clicks", "CTR (%)", "CPM", "CPC"],
      ...platforms.map((p: any) => [p.platform, p.spend, totalSpend > 0 ? +((p.spend / totalSpend) * 100).toFixed(2) : 0, p.impressions, p.linkClicks, +p.ctr.toFixed(4), +p.cpm.toFixed(4), +p.cpc.toFixed(4)]),
    ]
    downloadCSV(`placements-${datePreset}.csv`, rows)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <IconLayout className="size-6 text-muted-foreground" />
            <h1 className="text-xl font-bold">Meta Placements</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 ml-8">{accountName}</p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <button onClick={handleExport}
              className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border bg-background hover:bg-muted/50 transition-colors">
              <IconDownload className="size-3.5" /> Export CSV
            </button>
          )}
          <AccountPicker />
          <DatePicker value={datePreset} onChange={setDatePreset} />
          <Button size="sm" variant="ghost" className="h-8" onClick={load} disabled={loading}>
            <IconRefresh className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorMsg message={error} onRetry={load} /> : !data ? null : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <KpiCard label="Top Placement"   value={s.topPlacement?.label?.split("—")[1]?.trim() || s.topPlacement?.label || "—"} sub={s.topPlacement ? fmt$(s.topPlacement.spend) : undefined} />
            <KpiCard label="Best CPA"        value={s.bestCpaPlacement?.cpa > 0 ? fmt$(s.bestCpaPlacement.cpa) : "—"} sub={s.bestCpaPlacement?.label?.split("—")[0]?.trim()} />
            <KpiCard label="Avg CPA"         value={s.avgCpa > 0 ? fmt$(s.avgCpa) : "—"} sub="Cost per purchase" />
            <KpiCard label="Total Purchases" value={String(Math.round(s.totalPurchases || 0))} />
            <KpiCard label="Avg CTR"         value={fmtPct(s.avgCtr || 0)} />
            <KpiCard label="Total Spend"     value={fmt$(s.totalSpend || 0)} />
          </div>

          {/* Platform spend bars */}
          <div className="grid grid-cols-4 gap-3">
            {platforms.map((p: any) => {
              const pct = totalSpend > 0 ? (p.spend / totalSpend) * 100 : 0
              return (
                <div key={p.platform} className="rounded-xl border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: platformColor(p.platform) }} />
                    <span className="text-sm font-semibold">{p.platform}</span>
                  </div>
                  <p className="text-xl font-bold">{fmt$(p.spend)}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: platformColor(p.platform) }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{pct.toFixed(1)}% of total spend</p>
                </div>
              )
            })}
          </div>

          {/* Inner tabs */}
          <div className="flex gap-1 border-b">
            {([
              { id: "daily", label: "Daily Breakdown" },
              { id: "distribution", label: "Placement Distribution" },
              { id: "comparison", label: "Platform Comparison" },
            ] as { id: typeof innerTab; label: string }[]).map(t => (
              <button key={t.id} onClick={() => setInnerTab(t.id)}
                className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                  innerTab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Daily Breakdown */}
          {innerTab === "daily" && daily.length > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">Daily Spend by Platform</h2>
                <select value={dailyMetric} onChange={e => setDailyMetric(e.target.value)}
                  className="text-xs border rounded-lg px-2 py-1 bg-background outline-none">
                  {DAILY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={daily} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    {platformNames.map((name: string) => (
                      <linearGradient key={name} id={`grad-${name.replace(/\s+/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={platformColor(name)} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={platformColor(name)} stopOpacity={0.05} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={fmtDay} />
                  <YAxis tick={{ fontSize: 10 }}
                    tickFormatter={v => dailyMetric === "spend" ? `$${v >= 1000 ? (v/1000).toFixed(0)+"K" : v}` : fmtK(v)} />
                  <Tooltip content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null
                    const items = payload.filter((p: any) => (p.value || 0) > 0)
                    if (!items.length) return null
                    return (
                      <div className="bg-popover border rounded-lg shadow-lg p-3 text-xs min-w-[180px]">
                        <p className="font-semibold mb-2">{fmtDay(label)}</p>
                        {items.map((p: any) => (
                          <div key={p.name} className="flex items-center justify-between gap-3 py-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: p.stroke }} />
                              <span className="text-muted-foreground truncate">{p.name}</span>
                            </div>
                            <span className="font-semibold shrink-0">
                              {dailyMetric === "spend" ? fmt$(p.value) : fmtK(p.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {platformNames.map((name: string) => {
                    const key = dailyMetric === "spend" ? name : name + "_" + (dailyMetric === "impr" ? "impr" : "clicks")
                    return (
                      <Area key={name} type="monotone" dataKey={key} name={name}
                        stroke={platformColor(name)} strokeWidth={2}
                        fill={`url(#grad-${name.replace(/\s+/g, "")})`}
                        stackId="a" />
                    )
                  })}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Placement Distribution */}
          {innerTab === "distribution" && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-5">
                <h2 className="text-sm font-semibold mb-1">Spend by Placement</h2>
                <p className="text-xs text-muted-foreground mb-4">Top placements sorted by spend</p>
                <ResponsiveContainer width="100%" height={Math.max(200, placements.slice(0,15).length * 32)}>
                  <BarChart data={placements.slice(0, 15)} layout="vertical" margin={{ top: 0, right: 80, left: 8, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 9 }}
                      tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+"K" : v}`} />
                    <YAxis type="category" dataKey="position" tick={{ fontSize: 9 }} width={100} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }}
                      formatter={(v: any, name: any, props: any) => [fmt$(v), props.payload.label]} />
                    <Bar dataKey="spend" radius={[0,2,2,0]}>
                      {placements.slice(0, 15).map((p: any, i: number) => (
                        <Cell key={i} fill={platformColor(p.platform)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Placement table */}
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b">
                  <h2 className="text-sm font-semibold">Placement Details</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/20">
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Platform</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Placement</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Spend</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">%</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Impressions</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Clicks</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">CTR</th>
                        <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground">CPC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {placements.map((p: any) => (
                        <tr key={p.label} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: platformColor(p.platform) }} />
                              <span className="font-medium">{p.platform}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground capitalize">{p.position?.replace(/_/g, " ")}</td>
                          <td className="px-3 py-3 text-right font-semibold">{fmt$(p.spend)}</td>
                          <td className="px-3 py-3 text-right text-muted-foreground">{totalSpend > 0 ? ((p.spend / totalSpend) * 100).toFixed(1) + "%" : "—"}</td>
                          <td className="px-3 py-3 text-right">{fmtK(p.impressions)}</td>
                          <td className="px-3 py-3 text-right">{fmtK(p.linkClicks)}</td>
                          <td className="px-3 py-3 text-right">{fmtPct(p.ctr)}</td>
                          <td className="px-5 py-3 text-right">{p.cpc > 0 ? fmt$(p.cpc) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Platform Comparison */}
          {innerTab === "comparison" && (
            <div className="space-y-4">
              {/* Comparison chart */}
              <div className="rounded-xl border bg-card p-5">
                <h2 className="text-sm font-semibold mb-1">Platform Performance Comparison</h2>
                <p className="text-xs text-muted-foreground mb-4">Key metrics across platforms</p>
                <div className="grid grid-cols-2 gap-6">
                  {/* Spend comparison */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-3">Spend Distribution</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={platforms} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <XAxis dataKey="platform" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+"K" : v}`} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} formatter={(v: any) => fmt$(v)} />
                        <Bar dataKey="spend" name="Spend" radius={[2,2,0,0]}>
                          {platforms.map((p: any) => <Cell key={p.platform} fill={platformColor(p.platform)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {/* CTR comparison */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-3">CTR by Platform (%)</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={platforms} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <XAxis dataKey="platform" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v.toFixed(2) + "%"} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} formatter={(v: any) => fmtPct(v)} />
                        <Bar dataKey="ctr" name="CTR" radius={[2,2,0,0]}>
                          {platforms.map((p: any) => <Cell key={p.platform} fill={platformColor(p.platform)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Platform comparison table */}
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b">
                  <h2 className="text-sm font-semibold">Platform Summary</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/20">
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Platform</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Spend</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">%</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Impressions</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Link Clicks</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">CTR</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">CPM</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">CPC</th>
                        <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground">CPA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {platforms.map((p: any) => (
                        <tr key={p.platform} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: platformColor(p.platform) }} />
                              <span className="font-semibold">{p.platform}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right font-semibold">{fmt$(p.spend)}</td>
                          <td className="px-3 py-3 text-right text-muted-foreground">{totalSpend > 0 ? ((p.spend / totalSpend) * 100).toFixed(1) + "%" : "—"}</td>
                          <td className="px-3 py-3 text-right">{fmtK(p.impressions)}</td>
                          <td className="px-3 py-3 text-right">{fmtK(p.linkClicks)}</td>
                          <td className="px-3 py-3 text-right">{fmtPct(p.ctr)}</td>
                          <td className="px-3 py-3 text-right">{fmt$(p.cpm)}</td>
                          <td className="px-3 py-3 text-right">{p.cpc > 0 ? fmt$(p.cpc) : "—"}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground">{p.cpa > 0 ? fmt$(p.cpa) : "—"}</td>
                        </tr>
                      ))}
                      {/* Total row */}
                      <tr className="bg-muted/10 font-semibold">
                        <td className="px-5 py-3">Total ({platforms.length} platforms)</td>
                        <td className="px-3 py-3 text-right">{fmt$(totalSpend)}</td>
                        <td className="px-3 py-3 text-right">100%</td>
                        <td className="px-3 py-3 text-right">{fmtK(platforms.reduce((sum: number, p: any) => sum + p.impressions, 0))}</td>
                        <td className="px-3 py-3 text-right">{fmtK(platforms.reduce((sum: number, p: any) => sum + p.linkClicks, 0))}</td>
                        <td className="px-3 py-3 text-right">{fmtPct(s.avgCtr || 0)}</td>
                        <td colSpan={2} className="px-3 py-3 text-right text-muted-foreground/50">—</td>
                        <td className="px-5 py-3 text-right text-muted-foreground">{s.avgCpa > 0 ? fmt$(s.avgCpa) : "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── DEVICE ───────────────────────────────────────────────────────────────────

const DEVICE_COLORS: Record<string, string> = {
  "Desktop":      "#3b82f6",
  "Mobile App":   "#10b981",
  "Mobile Web":   "#f59e0b",
  "Tablet":       "#8b5cf6",
  "Connected TV": "#ec4899",
  "Unknown":      "#9ca3af",
}

export function DeviceView() {
  const { selectedAccountId } = useAdAccount()
  const accountId = selectedAccountId || ""
  const [datePreset, setDatePreset] = useState("last_30d")
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  const load = useCallback(() => {
    if (!accountId) return
    setLoading(true); setError("")
    fetch(`/api/insights/statistics/device?adAccountId=${accountId}&datePreset=${datePreset}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); return }; setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [accountId, datePreset])

  useEffect(() => { load() }, [load])

  const devices: any[] = data?.devices || []
  const daily:   any[] = data?.daily   || []
  const s              = data?.summary  || {}
  const totalSpend     = s.totalSpend  || 0
  const deviceKeys: string[] = [...new Set(devices.map((d: any) => d.label))] as string[]

  const pieData = devices.map((d: any) => ({ name: d.label, value: d.spend }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Device Performance</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Spend and engagement broken down by device type</p>
        </div>
        <div className="flex items-center gap-2">
          <AccountPicker />
          <DatePicker value={datePreset} onChange={v => { setDatePreset(v) }} />
          <button onClick={load} className="h-8 px-3 text-sm rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-1.5">
            <IconRefresh className="size-3.5" />Refresh
          </button>
        </div>
      </div>

      {loading && <LoadingState />}
      {error   && <ErrorMsg message={error} onRetry={load} />}
      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Total Spend"       value={fmt$(totalSpend)}          sub={`${devices.length} device types`} />
            <KpiCard label="Top Device"        value={s.topDevice?.label || "—"} sub={s.topDevice ? `${s.topDevice.pct.toFixed(1)}% of spend` : undefined} />
            <KpiCard label="Total Impressions" value={fmtK(s.totalImpr || 0)}    sub="across all devices" />
            <KpiCard label="Avg CPA"           value={s.avgCpa > 0 ? fmt$(s.avgCpa) : "—"} sub="cost per purchase" />
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold mb-3">Spend by Device</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={devices} layout="vertical" margin={{ top: 0, right: 24, left: 80, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => "$" + fmtK(v)} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} formatter={(v: any) => fmt$(v)} />
                  <Bar dataKey="spend" radius={[0, 3, 3, 0]}>
                    {devices.map((d: any) => <Cell key={d.device} fill={DEVICE_COLORS[d.label] || "#64748b"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="lg:col-span-2 rounded-xl border bg-card p-4 flex flex-col">
              <h2 className="text-sm font-semibold mb-3">Spend Share</h2>
              <div className="flex-1 flex items-center justify-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                      {pieData.map((entry, i) => <Cell key={entry.name} fill={DEVICE_COLORS[entry.name] || ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} formatter={(v: any) => fmt$(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 mt-1">
                {devices.slice(0, 5).map((d: any) => (
                  <div key={d.device} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: DEVICE_COLORS[d.label] || "#64748b" }} />
                      <span className="text-muted-foreground">{d.label}</span>
                    </div>
                    <span className="font-medium">{totalSpend > 0 ? ((d.spend / totalSpend) * 100).toFixed(1) + "%" : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {daily.length > 1 && (
            <div className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold mb-3">Daily Spend by Device</h2>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={daily} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(s: any) => fmtDay(s)} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => "$" + fmtK(v)} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} formatter={(v: any) => fmt$(v)} labelFormatter={(s: any) => fmtDay(s)} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  {deviceKeys.map((k, i) => (
                    <Area key={k} type="monotone" dataKey={k} stackId="1"
                      fill={DEVICE_COLORS[k] || ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]}
                      stroke={DEVICE_COLORS[k] || ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]}
                      fillOpacity={0.6} strokeWidth={1.5} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold">Device Performance</h2>
              {data?.hasPrevious && (
                <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">vs Previous Period</span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Device</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Spend</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">%</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Impressions</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">CTR</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">CPC</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">CPM</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">CPA</th>
                    {data?.hasPrevious && <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground">Δ Spend</th>}
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d: any) => (
                    <tr key={d.device} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: DEVICE_COLORS[d.label] || "#64748b" }} />
                          <span className="font-medium">{d.label}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold">{fmt$(d.spend)}</td>
                      <td className="px-3 py-3 text-right text-muted-foreground">{totalSpend > 0 ? ((d.spend / totalSpend) * 100).toFixed(1) + "%" : "—"}</td>
                      <td className="px-3 py-3 text-right">{fmtK(d.impressions)}</td>
                      <td className="px-3 py-3 text-right">{fmtPct(d.ctr)}</td>
                      <td className="px-3 py-3 text-right">{d.cpc > 0 ? fmt$(d.cpc) : "—"}</td>
                      <td className="px-3 py-3 text-right">{d.cpm > 0 ? fmt$(d.cpm) : "—"}</td>
                      <td className="px-3 py-3 text-right">{d.cpa > 0 ? fmt$(d.cpa) : "—"}</td>
                      {data?.hasPrevious && (
                        <td className="px-5 py-3 text-right">
                          {d.spendDelta !== null ? (
                            <span className={cn("text-xs font-semibold", d.spendDelta >= 0 ? "text-emerald-500" : "text-rose-500")}>
                              {d.spendDelta >= 0 ? "+" : ""}{d.spendDelta.toFixed(1)}%
                            </span>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── REACH ────────────────────────────────────────────────────────────────────

const FREQ_COLOR = (f: number) => f < 2 ? "#10b981" : f < 4 ? "#f59e0b" : "#ef4444"
const FREQ_LABEL = (f: number) => f < 2 ? "Good" : f < 4 ? "Watch" : "High"

export function ReachView() {
  const { selectedAccountId } = useAdAccount()
  const accountId = selectedAccountId || ""
  const [datePreset,         setDatePreset]         = useState("last_90d")
  const [selectedCampaignId, setSelectedCampaignId] = useState("")
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false)
  const [campaignSearch,     setCampaignSearch]     = useState("")
  const [campaignsList,      setCampaignsList]      = useState<{ id: string; name: string; spend: number }[]>([])
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) { setCampaignPickerOpen(false); setCampaignSearch("") }
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const load = useCallback(() => {
    if (!accountId) return
    setLoading(true); setError("")
    const params = new URLSearchParams({ adAccountId: accountId, datePreset })
    if (selectedCampaignId) params.set("campaignId", selectedCampaignId)
    fetch(`/api/insights/statistics/reach?${params}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); return }; setData(d); if (d.campaignList?.length) setCampaignsList(d.campaignList) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [accountId, datePreset, selectedCampaignId])

  useEffect(() => { load() }, [load])

  const months: any[] = data?.months  || []
  const s             = data?.summary || {}
  const filteredCampaigns = campaignsList.filter(c => c.name.toLowerCase().includes(campaignSearch.toLowerCase()))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Reach & Frequency</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Monthly reach, frequency trends and cumulative audience growth</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AccountPicker />
          <div className="relative" ref={pickerRef}>
            <button onClick={() => setCampaignPickerOpen(v => !v)}
              className={cn("flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border hover:bg-muted/50 transition-colors",
                selectedCampaignId ? "bg-primary/10 border-primary/30 text-primary" : "bg-background")}>
              <IconFilter className="size-3.5" />
              {selectedCampaignId ? (campaignsList.find(c => c.id === selectedCampaignId)?.name || "Campaign") : "All Campaigns"}
              {selectedCampaignId && <button className="ml-1" onClick={e => { e.stopPropagation(); setSelectedCampaignId("") }}><IconX className="size-3" /></button>}
              {!selectedCampaignId && <IconChevronDown className="size-3.5 text-muted-foreground" />}
            </button>
            {campaignPickerOpen && (
              <div className="absolute top-full right-0 mt-1 z-50 bg-popover border rounded-xl shadow-xl min-w-[240px] max-w-[320px] overflow-hidden">
                <div className="p-2 border-b">
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/40">
                    <IconSearch className="size-3.5 text-muted-foreground/50 shrink-0" />
                    <input value={campaignSearch} onChange={e => setCampaignSearch(e.target.value)} autoFocus
                      placeholder="Search campaigns..." className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40" />
                  </div>
                </div>
                <div className="py-1 max-h-56 overflow-y-auto">
                  <button onClick={() => { setSelectedCampaignId(""); setCampaignPickerOpen(false) }}
                    className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between", !selectedCampaignId && "text-primary font-medium")}>
                    All Campaigns {!selectedCampaignId && <IconCheck className="size-3.5" />}
                  </button>
                  {filteredCampaigns.map(c => (
                    <button key={c.id} onClick={() => { setSelectedCampaignId(c.id); setCampaignPickerOpen(false); setCampaignSearch("") }}
                      className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between gap-2", c.id === selectedCampaignId && "text-primary font-medium")}>
                      <span className="truncate">{c.name}</span>
                      {c.id === selectedCampaignId && <IconCheck className="size-3.5 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DatePicker value={datePreset} onChange={v => { setDatePreset(v); setSelectedCampaignId("") }} />
          <button onClick={load} className="h-8 px-3 text-sm rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-1.5">
            <IconRefresh className="size-3.5" />Refresh
          </button>
        </div>
      </div>

      {loading && <LoadingState />}
      {error   && <ErrorMsg message={error} onRetry={load} />}
      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Total Cumulative Reach" value={fmtK(s.totalReach || 0)}       sub={`${s.monthCount || 0} months`} />
            <KpiCard label="Last Month Reach"        value={fmtK(s.lastMonthReach || 0)}
              sub={s.netNewReach !== null && s.netNewReach !== undefined
                ? `${s.netNewReach >= 0 ? "+" : ""}${fmtK(s.netNewReach)} vs prev`
                : undefined} />
            <KpiCard label="Avg % Net New Reach"     value={s.avgNetNewPct ? (s.avgNetNewPct >= 0 ? "+" : "") + s.avgNetNewPct.toFixed(1) + "%" : "—"} sub="month-over-month" />
            <KpiCard label="Avg Frequency"           value={s.avgFrequency ? s.avgFrequency.toFixed(2) + "x" : "—"}
              sub={s.avgFrequency ? FREQ_LABEL(s.avgFrequency) : undefined} />
          </div>

          {months.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold mb-3">Monthly Reach & Frequency</h2>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={months} margin={{ top: 4, right: 32, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                  <YAxis yAxisId="left"  tick={{ fontSize: 9 }} tickFormatter={v => fmtK(v)} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} tickFormatter={v => v.toFixed(1) + "x"} domain={[0, "auto"]} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    formatter={(v: any, name: any) => [name === "Frequency" ? Number(v).toFixed(2) + "x" : fmtK(v), name]} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Bar  yAxisId="left"  dataKey="reach"       name="Reach"       fill="#3b82f6" fillOpacity={0.85} radius={[2,2,0,0]} />
                  <Bar  yAxisId="left"  dataKey="impressions" name="Impressions" fill="#06b6d4" fillOpacity={0.5}  radius={[2,2,0,0]} />
                  <Line yAxisId="right" type="monotone" dataKey="frequency" name="Frequency" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {months.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold mb-3">Cumulative Reach Growth</h2>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={months} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reachGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => fmtK(v)} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} formatter={(v: any) => [fmtK(v), "Cumulative Reach"]} />
                  <Area type="monotone" dataKey="cumulativeReach" name="Cumulative Reach"
                    stroke="#3b82f6" strokeWidth={2.5} fill="url(#reachGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold">Monthly Breakdown</h2>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-emerald-500" />Good (&lt;2x)</span>
                <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-amber-500" />Watch (2–4x)</span>
                <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-rose-500" />High (&gt;4x)</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Month</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Reach</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Impressions</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Frequency</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Spend</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground">Cumulative Reach</th>
                  </tr>
                </thead>
                <tbody>
                  {[...months].reverse().map((m: any) => (
                    <tr key={m.key} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 font-medium">{m.label}</td>
                      <td className="px-3 py-3 text-right">{fmtK(m.reach)}</td>
                      <td className="px-3 py-3 text-right text-muted-foreground">{fmtK(m.impressions)}</td>
                      <td className="px-3 py-3 text-right">
                        <span className="inline-flex items-center gap-1">
                          <span className="size-1.5 rounded-full" style={{ backgroundColor: FREQ_COLOR(m.frequency) }} />
                          <span style={{ color: FREQ_COLOR(m.frequency) }} className="font-semibold">{m.frequency.toFixed(2)}x</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">{fmt$(m.spend)}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">{fmtK(m.cumulativeReach)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── HOOK RATE ANALYSIS (AI-powered cards) ────────────────────────────────────

function HookCard({ ad, rank }: { ad: any; rank: number }) {
  const [analysis, setAnalysis] = useState<{ bullets: string[] } | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisErr, setAnalysisErr] = useState("")
  const hookGood = ad.hookRate >= 25
  const hookOk   = ad.hookRate >= 10

  const analyze = async () => {
    if (!ad.thumbnail || analyzing || analysis) return
    setAnalyzing(true); setAnalysisErr("")
    try {
      const res = await fetch("/api/insights/creative-audit/analyze-hook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnailUrl: ad.thumbnail, adName: ad.adName, hookRate: ad.hookRate }),
      })
      const data = await res.json()
      if (data.error) { setAnalysisErr(data.error); return }
      setAnalysis(data)
    } catch (e: any) {
      setAnalysisErr(e.message)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="flex-shrink-0 w-[340px] rounded-xl border bg-card overflow-hidden">
      <div className="p-3 flex items-start gap-3">
        {/* Thumbnail */}
        <div className="relative w-[120px] h-[120px] rounded-lg bg-muted/30 overflow-hidden shrink-0">
          {ad.thumbnail ? (
            <img src={ad.thumbnail} alt={ad.adName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <IconVideo className="size-8 text-muted-foreground/30" />
            </div>
          )}
          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="size-8 rounded-full bg-black/50 flex items-center justify-center">
              <svg className="size-4 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Badges row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold bg-blue-500/15 text-blue-600 px-1.5 py-0.5 rounded-full">#{rank}</span>
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5",
              hookGood ? "bg-emerald-500/15 text-emerald-600" :
              hookOk   ? "bg-amber-500/15 text-amber-600"     :
                         "bg-rose-500/15 text-rose-600")}>
              <svg className="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
              Hook: {fmtPct(ad.hookRate)}
            </span>
            <span className="text-[10px] font-semibold bg-gray-800 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <svg className="size-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              Video
            </span>
          </div>

          <p className="text-xs font-semibold line-clamp-2 leading-snug">{ad.adName}</p>

          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <svg className="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Spend: <span className="font-semibold text-foreground">{fmt$(ad.spend, 0)}</span>
            </span>
            <span>Watch: <span className="font-semibold text-foreground">{ad.avgWatch > 0 ? ad.avgWatch.toFixed(1) + "s" : "—"}</span></span>
          </div>

          {/* AI analysis */}
          {!analysis && !analyzing && !analysisErr && ad.thumbnail && (
            <button onClick={analyze}
              className="mt-1 flex items-center gap-1 text-[10px] text-violet-600 hover:text-violet-700 font-medium transition-colors">
              <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              Analyze Hook
            </button>
          )}
          {analyzing && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-violet-500">
              <IconLoader2 className="size-3 animate-spin" />Analyzing frame…
            </div>
          )}
          {analysisErr && (
            <p className="mt-1 text-[10px] text-rose-500">{analysisErr}</p>
          )}
        </div>
      </div>

      {/* AI bullets */}
      {analysis && (
        <div className="border-t px-3 py-2.5 bg-violet-500/5">
          <p className="text-[10px] font-semibold text-violet-600 flex items-center gap-1 mb-1.5">
            <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            What Makes This Hook Work
          </p>
          <ul className="space-y-1">
            {analysis.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground leading-relaxed">
                <svg className="size-2.5 text-violet-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function HookRateAnalysisSection({ videoAds }: { videoAds: any[] }) {
  const [sortDir, setSortDir] = useState<"highest" | "lowest">("highest")
  const sorted = [...videoAds].sort((a, b) =>
    sortDir === "highest" ? b.hookRate - a.hookRate : a.hookRate - b.hookRate
  )

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <svg className="size-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            Hook Rate Analysis
          </h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">Highest performing video ads by hook rate</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setSortDir("highest")}
            className={cn("flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors",
              sortDir === "highest" ? "bg-blue-500 text-white" : "border hover:bg-muted/50 text-muted-foreground")}>
            <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
            Highest
          </button>
          <button onClick={() => setSortDir("lowest")}
            className={cn("flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors",
              sortDir === "lowest" ? "bg-blue-500 text-white" : "border hover:bg-muted/50 text-muted-foreground")}>
            <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            Lowest
          </button>
        </div>
      </div>
      <div className="relative">
        <div className="flex gap-3 p-4 overflow-x-auto scrollbar-thin scrollbar-thumb-border">
          {sorted.map((ad: any, i: number) => (
            <HookCard key={ad.adId} ad={ad} rank={i + 1} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── CREATIVE AUDIT ───────────────────────────────────────────────────────────

const FORMAT_COLORS: Record<string, string> = {
  Video:    "#3b82f6",
  Image:    "#10b981",
  Carousel: "#8b5cf6",
}

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE:  "Learn More",
  SHOP_NOW:    "Shop Now",
  SIGN_UP:     "Sign Up",
  BOOK_TRAVEL: "Book Now",
  CONTACT_US:  "Contact Us",
  SUBSCRIBE:   "Subscribe",
  DOWNLOAD:    "Download",
  GET_OFFER:   "Get Offer",
  APPLY_NOW:   "Apply Now",
  GET_QUOTE:   "Get Quote",
  WATCH_MORE:  "Watch More",
  UNKNOWN:     "Unknown",
}

export function CreativeAuditView() {
  const { selectedAccountId } = useAdAccount()
  const accountId = selectedAccountId || ""
  const [datePreset,         setDatePreset]         = useState("last_30d")
  const [selectedCampaignId, setSelectedCampaignId] = useState("")
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false)
  const [campaignSearch,     setCampaignSearch]     = useState("")
  const [campaignsList,      setCampaignsList]      = useState<{ id: string; name: string; spend: number }[]>([])
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")
  const pickerRef2 = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (pickerRef2.current && !pickerRef2.current.contains(e.target as Node)) { setCampaignPickerOpen(false); setCampaignSearch("") }
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const load = useCallback(() => {
    if (!accountId) return
    setLoading(true); setError("")
    const params = new URLSearchParams({ adAccountId: accountId, datePreset })
    if (selectedCampaignId) params.set("campaignId", selectedCampaignId)
    fetch(`/api/insights/statistics/creative-audit?${params}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); return }; setData(d); if (d.campaignList?.length) setCampaignsList(d.campaignList) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [accountId, datePreset, selectedCampaignId])

  useEffect(() => { load() }, [load])

  const top5:       any[] = data?.top5         || []
  const formats:    any[] = data?.formatMix    || []
  const ctas:       any[] = (data?.ctaBreakdown || []).slice(0, 8)
  const ctaPerf:    any[] = data?.ctaPerf      || []
  const ctaDaily:   any[] = data?.ctaDaily     || []
  const topCtaKeys: string[] = data?.topCtaKeys || []
  const topCopy:    any[] = data?.topCopy      || []
  const s              = data?.summary      || {}
  const videoAds       = (data?.ads || []).filter((a: any) => a.format === "Video" && a.impressions > 0)
    .sort((a: any, b: any) => b.hookRate - a.hookRate).slice(0, 10)
  const filteredCampaigns  = campaignsList.filter(c => c.name.toLowerCase().includes(campaignSearch.toLowerCase()))
  const totalFormatSpend   = formats.reduce((s: number, f: any) => s + f.spend, 0)
  const maxCtaCtr          = ctaPerf.length > 0 ? Math.max(...ctaPerf.map((c: any) => c.ctr)) : 1

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Creative Audit</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Format mix, hook rate, CTA analysis and top performing creatives</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AccountPicker />
          <div className="relative" ref={pickerRef2}>
            <button onClick={() => setCampaignPickerOpen(v => !v)}
              className={cn("flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border hover:bg-muted/50 transition-colors",
                selectedCampaignId ? "bg-primary/10 border-primary/30 text-primary" : "bg-background")}>
              <IconFilter className="size-3.5" />
              {selectedCampaignId ? (campaignsList.find(c => c.id === selectedCampaignId)?.name || "Campaign") : "All Campaigns"}
              {selectedCampaignId && <button className="ml-1" onClick={e => { e.stopPropagation(); setSelectedCampaignId("") }}><IconX className="size-3" /></button>}
              {!selectedCampaignId && <IconChevronDown className="size-3.5 text-muted-foreground" />}
            </button>
            {campaignPickerOpen && (
              <div className="absolute top-full right-0 mt-1 z-50 bg-popover border rounded-xl shadow-xl min-w-[240px] max-w-[320px] overflow-hidden">
                <div className="p-2 border-b">
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/40">
                    <IconSearch className="size-3.5 text-muted-foreground/50 shrink-0" />
                    <input value={campaignSearch} onChange={e => setCampaignSearch(e.target.value)} autoFocus
                      placeholder="Search campaigns..." className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40" />
                  </div>
                </div>
                <div className="py-1 max-h-56 overflow-y-auto">
                  <button onClick={() => { setSelectedCampaignId(""); setCampaignPickerOpen(false) }}
                    className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between", !selectedCampaignId && "text-primary font-medium")}>
                    All Campaigns {!selectedCampaignId && <IconCheck className="size-3.5" />}
                  </button>
                  {filteredCampaigns.map(c => (
                    <button key={c.id} onClick={() => { setSelectedCampaignId(c.id); setCampaignPickerOpen(false); setCampaignSearch("") }}
                      className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between gap-2", c.id === selectedCampaignId && "text-primary font-medium")}>
                      <span className="truncate">{c.name}</span>
                      {c.id === selectedCampaignId && <IconCheck className="size-3.5 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DatePicker value={datePreset} onChange={v => { setDatePreset(v); setSelectedCampaignId("") }} />
          <button onClick={load} className="h-8 px-3 text-sm rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-1.5">
            <IconRefresh className="size-3.5" />Refresh
          </button>
        </div>
      </div>

      {loading && <LoadingState />}
      {error   && <ErrorMsg message={error} onRetry={load} />}
      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Active Ads"        value={String(s.activeAdCount || 0)} sub={`${s.videoAdCount || 0}V · ${s.imageAdCount || 0}I · ${s.carouselCount || 0}C`} />
            <KpiCard label="Total Impressions" value={fmtK(s.totalImpr || 0)}       sub="during period" />
            <KpiCard label="Avg Hook Rate"     value={s.avgHookRate > 0 ? fmtPct(s.avgHookRate) : "—"} sub="video ads only" />
            <KpiCard label="Avg Watch Time"    value={s.avgWatchTime > 0 ? s.avgWatchTime.toFixed(1) + "s" : "—"} sub="per video view" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold mb-3">Format Mix</h2>
              <div className="flex gap-4 items-center">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={formats} cx="50%" cy="50%" innerRadius={32} outerRadius={56} paddingAngle={2} dataKey="spend">
                      {formats.map((f: any) => <Cell key={f.format} fill={FORMAT_COLORS[f.format] || "#64748b"} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6 }} formatter={(v: any) => fmt$(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {formats.map((f: any) => (
                    <div key={f.format} className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-sm shrink-0" style={{ backgroundColor: FORMAT_COLORS[f.format] || "#64748b" }} />
                          <span className="font-medium">{f.format}</span>
                        </span>
                        <span className="text-muted-foreground">{totalFormatSpend > 0 ? ((f.spend / totalFormatSpend) * 100).toFixed(0) + "%" : "0%"} · {fmt$(f.spend, 0)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${totalFormatSpend > 0 ? (f.spend / totalFormatSpend) * 100 : 0}%`, backgroundColor: FORMAT_COLORS[f.format] || "#64748b" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold mb-3">CTA Type — Spend</h2>
              {ctas.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={ctas} layout="vertical" margin={{ top: 0, right: 16, left: 72, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => "$" + fmtK(v)} />
                    <YAxis type="category" dataKey="cta" tick={{ fontSize: 10 }} width={72}
                      tickFormatter={(v: string) => CTA_LABELS[v] || v.replace(/_/g, " ").slice(0, 12)} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} formatter={(v: any) => fmt$(v)}
                      labelFormatter={(v: any) => CTA_LABELS[v] || String(v).replace(/_/g, " ")} />
                    <Bar dataKey="spend" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-muted-foreground/50 text-center py-8">No CTA data available</p>}
            </div>
          </div>

          {top5.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold mb-3">Top Performing Ads</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {top5.map((ad: any, i: number) => (
                  <div key={ad.adId} className="rounded-lg border bg-muted/10 overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="relative aspect-square bg-muted/30 overflow-hidden">
                      {ad.thumbnail ? (
                        <img src={ad.thumbnail} alt={ad.adName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {ad.format === "Video" ? <IconVideo className="size-8 text-muted-foreground/30" /> : <IconPhoto className="size-8 text-muted-foreground/30" />}
                        </div>
                      )}
                      <div className="absolute top-1.5 left-1.5 flex gap-1">
                        <span className="text-[9px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded-full">#{i + 1}</span>
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: (FORMAT_COLORS[ad.format] || "#64748b") + "CC", color: "#fff" }}>{ad.format}</span>
                      </div>
                    </div>
                    <div className="p-2 space-y-1">
                      <p className="text-[10px] font-medium leading-tight line-clamp-2 min-h-[28px]">{ad.adName}</p>
                      <div className="grid grid-cols-2 gap-x-1 text-[9px]">
                        <span className="text-muted-foreground">Spend</span>
                        <span className="font-semibold text-right">{fmt$(ad.spend, 0)}</span>
                        <span className="text-muted-foreground">CTR</span>
                        <span className="font-semibold text-right text-emerald-500">{fmtPct(ad.ctr)}</span>
                        {ad.format === "Video" && ad.hookRate > 0 && (
                          <React.Fragment>
                            <span className="text-muted-foreground">Hook</span>
                            <span className="font-semibold text-right text-blue-500">{fmtPct(ad.hookRate)}</span>
                          </React.Fragment>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {videoAds.length > 0 && (
            <HookRateAnalysisSection videoAds={videoAds} />
          )}

          {/* Ad Spend by CTA Type — daily area chart */}
          {ctaDaily.length > 1 && topCtaKeys.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">Ad Spend by CTA Type</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5 mb-3">Daily spend trends by call-to-action type (top {topCtaKeys.length} CTAs)</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={ctaDaily} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    {topCtaKeys.map((k, i) => (
                      <linearGradient key={k} id={`ctaGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]} stopOpacity={0.03} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(s: any) => fmtDay(s)} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => "$" + fmtK(v)} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} formatter={(v: any) => fmt$(v)} labelFormatter={(s: any) => fmtDay(s)} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }}
                    formatter={(v: string) => (CTA_LABELS[v] || v.replace(/_/g, " ")).toUpperCase()} />
                  {topCtaKeys.map((k, i) => (
                    <Area key={k} type="monotone" dataKey={k} stackId="1" name={k}
                      stroke={ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]}
                      fill={`url(#ctaGrad${i})`}
                      strokeWidth={1.5} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* CTA Performance cards */}
          {ctaPerf.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">Call-to-Action Performance</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5 mb-3">CTR, spend, and usage by CTA type</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {ctaPerf.slice(0, 8).map((c: any, i: number) => (
                  <div key={c.cta} className="rounded-lg border bg-muted/10 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold tracking-wide">{(CTA_LABELS[c.cta] || c.cta.replace(/_/g, " ")).toUpperCase()}</span>
                      <svg className="size-3 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </div>
                    {/* CTR bar */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <span className="text-muted-foreground">CTR</span>
                        <span className="font-bold" style={{ color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length] }}>{fmtPct(c.ctr)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${maxCtaCtr > 0 ? (c.ctr / maxCtaCtr) * 100 : 0}%`, backgroundColor: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length] }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 text-[10px]">
                      <span className="text-muted-foreground">Spend</span>
                      <span className="font-semibold text-right">{fmt$(c.spend, 0)}</span>
                      <span className="text-muted-foreground">Impressions</span>
                      <span className="font-semibold text-right" style={{ color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length] }}>{fmtK(c.impressions)}</span>
                      <span className="text-muted-foreground">Ads using</span>
                      <span className="font-semibold text-right" style={{ color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length] }}>{c.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Performing Copy */}
          {topCopy.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <svg className="size-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    Top Performing Copy
                  </h2>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Top {topCopy.length} ad bodies by impressions</p>
                </div>
              </div>
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {topCopy.map((ad: any, i: number) => (
                  <div key={ad.adId} className="p-4 space-y-2">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="font-bold text-foreground">#{i + 1}</span>
                      <span className="flex items-center gap-0.5">
                        <svg className="size-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                        {fmtK(ad.impressions)} impressions
                      </span>
                      <span className="flex items-center gap-0.5">
                        <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        {fmt$(ad.spend, 0)} spend
                      </span>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{ad.body}</p>
                    </div>
                    <p className="text-[10px] text-blue-500 truncate">From ad: {ad.adName}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── UPLOAD STATS ─────────────────────────────────────────────────────────────

export function UploadStatsView() {
  const [datePreset, setDatePreset] = useState("last_90d")
  const [search,     setSearch]     = useState("")
  const [data,       setData]       = useState<any>(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState("")

  const load = useCallback(() => {
    setLoading(true); setError("")
    fetch(`/api/insights/statistics/upload-stats?datePreset=${datePreset}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); return }; setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [datePreset])

  useEffect(() => { load() }, [load])

  const monthly:     any[] = data?.monthly       || []
  const leaderboard: any[] = data?.leaderboard   || []
  const batches:     any[] = data?.recentBatches || []
  const s                  = data?.summary        || {}
  const totalMediaAds      = (s.totalVideoAds || 0) + (s.totalImageAds || 0)
  const mediaData = [
    { name: "Video", value: s.totalVideoAds || 0, color: "#3b82f6" },
    { name: "Image", value: s.totalImageAds || 0, color: "#10b981" },
  ].filter(d => d.value > 0)

  const filteredBatches = batches.filter((b: any) =>
    !search ||
    b.userName?.toLowerCase().includes(search.toLowerCase()) ||
    b.adAccountName?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Upload Stats</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Ad launch activity, team performance and media type breakdown</p>
        </div>
        <div className="flex items-center gap-2">
          <DatePicker value={datePreset} onChange={setDatePreset} />
          <button onClick={load} className="h-8 px-3 text-sm rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-1.5">
            <IconRefresh className="size-3.5" />Refresh
          </button>
        </div>
      </div>

      {loading && <LoadingState />}
      {error   && <ErrorMsg message={error} onRetry={load} />}
      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Ads Launched"  value={fmtK(s.totalAds || 0)}      sub={`${(s.successRate || 0).toFixed(0)}% success rate`} />
            <KpiCard label="Batches"       value={String(s.totalBatches || 0)} sub={`${s.uniqueUsers || 0} unique launchers`} />
            <KpiCard label="Hours Saved"   value={String(s.hoursSaved || 0)}   sub="est. 15 min saved per ad" />
            <KpiCard label="Top Launcher"  value={s.topLauncher?.name || "—"}  sub={s.topLauncher ? `${s.topLauncher.ads} ads · ${s.topLauncher.batches} batches` : undefined} />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold mb-3">Monthly Launch Activity</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="ads"     name="Ads Launched" fill="#3b82f6" radius={[3,3,0,0]} />
                  <Bar dataKey="batches" name="Batches"      fill="#8b5cf6" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border bg-card p-4 flex flex-col">
              <h2 className="text-sm font-semibold mb-2">Media Type</h2>
              {mediaData.length > 0 ? (
                <>
                  <div className="flex-1 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={130}>
                      <PieChart>
                        <Pie data={mediaData} cx="50%" cy="50%" innerRadius={36} outerRadius={58} paddingAngle={3} dataKey="value">
                          {mediaData.map(d => <Cell key={d.name} fill={d.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 mt-1">
                    {mediaData.map(d => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          <span>{d.name}</span>
                        </span>
                        <span className="font-semibold">{d.value}{totalMediaAds > 0 ? ` (${((d.value / totalMediaAds) * 100).toFixed(0)}%)` : ""}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/50">No media type data</div>
              )}
            </div>
          </div>

          {leaderboard.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b">
                <h2 className="text-sm font-semibold">Team Leaderboard</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">#</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Launcher</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Ads Launched</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Batches</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground">Last Launch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((u: any, i: number) => (
                      <tr key={u.userId} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3">
                          <span className={cn("text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center",
                            i === 0 ? "bg-amber-400/20 text-amber-500" :
                            i === 1 ? "bg-slate-400/20 text-slate-500" :
                            i === 2 ? "bg-orange-400/20 text-orange-500" : "text-muted-foreground"
                          )}>{i + 1}</span>
                        </td>
                        <td className="px-3 py-3 font-medium">{u.userName}</td>
                        <td className="px-3 py-3 text-right font-semibold text-blue-500">{u.ads}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground">{u.batches}</td>
                        <td className="px-5 py-3 text-right text-muted-foreground text-xs">{u.lastLaunch || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent Batches</h2>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-background w-52">
                <IconSearch className="size-3.5 text-muted-foreground/50 shrink-0" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Filter by user / account…"
                  className="flex-1 bg-transparent outline-none text-xs placeholder:text-muted-foreground/40 min-w-0" />
                {search && <button onClick={() => setSearch("")}><IconX className="size-3 text-muted-foreground/50" /></button>}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Date</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Launched by</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Account</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Ads</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Failed</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Duration</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-xs text-muted-foreground">No batches found</td></tr>
                  )}
                  {filteredBatches.map((b: any) => (
                    <tr key={b.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(b.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-3 py-3 font-medium">{b.userName}</td>
                      <td className="px-3 py-3 text-muted-foreground max-w-[180px] truncate">{b.adAccountName}</td>
                      <td className="px-3 py-3 text-right font-semibold text-blue-500">{b.totalAds}</td>
                      <td className="px-3 py-3 text-right">
                        {b.failedAds > 0
                          ? <span className="text-rose-500 font-medium">{b.failedAds}</span>
                          : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground text-xs">
                        {b.durationMs > 0 ? (b.durationMs < 60000 ? (b.durationMs / 1000).toFixed(0) + "s" : (b.durationMs / 60000).toFixed(1) + "m") : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",
                          b.status === "success" ? "bg-emerald-500/10 text-emerald-600" :
                          b.status === "partial"  ? "bg-amber-500/10 text-amber-600" :
                          "bg-rose-500/10 text-rose-600"
                        )}>{b.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
