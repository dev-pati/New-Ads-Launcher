"use client"

import { useState, useMemo } from "react"
import { IconCopy, IconCheck, IconChevronUp, IconChevronDown } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { formatViews } from "@/lib/inspo-mock-data"
import type { AdCopyMetrics } from "@/lib/brand-spy-analytics"

type SortKey = "adsCount" | "longestRunning" | "totalRunningDays" | "totalReach" | "score"

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
      title="Copy"
    >
      {copied ? <IconCheck className="size-3.5 text-emerald-500" /> : <IconCopy className="size-3.5" />}
    </button>
  )
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.round(score))
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-6 text-right">{pct}</span>
    </div>
  )
}

interface Props {
  copies: AdCopyMetrics[]
  emptyLabel?: string
}

const PAGE_SIZE = 10

export function AdCopiesTab({ copies, emptyLabel = "No ad copies found." }: Props) {
  const [search, setSearch]   = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("totalReach")
  const [sortAsc, setSortAsc] = useState(false)
  const [page,    setPage]    = useState(1)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(p => !p)
    else { setSortKey(key); setSortAsc(false) }
    setPage(1)
  }

  const filtered = useMemo(() => {
    let rows = [...copies]
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(r => r.text.toLowerCase().includes(q))
    }
    rows.sort((a, b) => {
      const diff = (a[sortKey] as number) - (b[sortKey] as number)
      return sortAsc ? diff : -diff
    })
    return rows
  }, [copies, search, sortKey, sortAsc])

  const pages  = Math.ceil(filtered.length / PAGE_SIZE)
  const paged  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (copies.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
      <p className="font-medium">{emptyLabel}</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1) }}
        placeholder="Search ad copies..."
        className="w-full max-w-sm h-9 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
      />

      <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-muted-foreground text-xs uppercase tracking-wide">
              <th className="text-left px-5 py-3 font-semibold w-[40%]">Ad Copy</th>
              {(["adsCount", "longestRunning", "totalRunningDays", "totalReach", "score"] as SortKey[]).map(k => (
                <SortHeader key={k} label={LABELS[k]} sortKey={k} current={sortKey} asc={sortAsc} onSort={toggleSort} />
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {paged.map((row, i) => {
              const isExpanded = expanded.has(row.text)
              return (
                <tr key={i} className="hover:bg-muted/20 transition-colors align-top">
                  <td className="px-5 py-3">
                    <div className="flex items-start gap-2">
                      {row.firstAd?.mediaUrl && (
                        <img src={row.firstAd.mediaUrl} alt="" className="size-10 rounded-lg object-cover shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs text-foreground leading-snug", !isExpanded && "line-clamp-2")}>
                          {row.text}
                        </p>
                        {row.text.length > 120 && (
                          <button
                            onClick={() => setExpanded(p => { const n = new Set(p); isExpanded ? n.delete(row.text) : n.add(row.text); return n })}
                            className="text-xs text-primary hover:underline mt-0.5"
                          >
                            {isExpanded ? "Show less" : "Show more"}
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium">{row.adsCount}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{row.longestRunning}d</td>
                  <td className="px-5 py-3 text-right tabular-nums">{row.totalRunningDays}d</td>
                  <td className="px-5 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">{formatViews(row.totalReach)}</td>
                  <td className="px-5 py-3 min-w-[80px]"><ScoreBar score={row.score} /></td>
                  <td className="px-3 py-3"><CopyBtn text={row.text} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>{filtered.length} results</p>
          <div className="flex items-center gap-1">
            <PaginationBtn label="←" disabled={page === 1}     onClick={() => setPage(p => p - 1)} />
            {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)}
                className={cn("size-7 text-xs rounded-lg transition-colors", p === page ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              >{p}</button>
            ))}
            <PaginationBtn label="→" disabled={page === pages} onClick={() => setPage(p => p + 1)} />
          </div>
        </div>
      )}
    </div>
  )
}

const LABELS: Record<SortKey, string> = {
  adsCount: "Ads", longestRunning: "Longest", totalRunningDays: "Total Days", totalReach: "Reach", score: "Score",
}

function SortHeader({ label, sortKey, current, asc, onSort }: {
  label: string; sortKey: SortKey; current: SortKey; asc: boolean; onSort: (k: SortKey) => void
}) {
  const active = current === sortKey
  return (
    <th className="px-5 py-3 text-right cursor-pointer select-none" onClick={() => onSort(sortKey)}>
      <span className="flex items-center justify-end gap-1 font-semibold">
        {label}
        {active
          ? asc ? <IconChevronUp className="size-3" /> : <IconChevronDown className="size-3" />
          : <IconChevronDown className="size-3 opacity-30" />
        }
      </span>
    </th>
  )
}

function PaginationBtn({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button disabled={disabled} onClick={onClick}
      className="size-7 text-xs rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
      {label}
    </button>
  )
}
