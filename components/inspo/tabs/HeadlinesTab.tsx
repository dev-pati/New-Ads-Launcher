"use client"

import { useState, useMemo } from "react"
import { IconCopy, IconCheck, IconChevronUp, IconChevronDown } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { formatViews } from "@/lib/inspo-mock-data"
import type { HeadlineMetrics } from "@/lib/brand-spy-analytics"

type SortKey = "adsCount" | "longestRunning" | "totalRunningDays" | "totalReach" | "score"

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
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
      <span className="text-[11px] tabular-nums text-muted-foreground w-6 text-right">{pct}</span>
    </div>
  )
}

interface Props { headlines: HeadlineMetrics[] }

const PAGE_SIZE = 10

export function HeadlinesTab({ headlines }: Props) {
  const [search,  setSearch]  = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("totalReach")
  const [sortAsc, setSortAsc] = useState(false)
  const [page,    setPage]    = useState(1)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(p => !p)
    else { setSortKey(key); setSortAsc(false) }
    setPage(1)
  }

  const filtered = useMemo(() => {
    let rows = [...headlines]
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(r => r.text.toLowerCase().includes(q))
    }
    rows.sort((a, b) => {
      const diff = (a[sortKey] as number) - (b[sortKey] as number)
      return sortAsc ? diff : -diff
    })
    return rows
  }, [headlines, search, sortKey, sortAsc])

  const pages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (headlines.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
      <p className="font-medium">No headlines found for this brand.</p>
      <p className="text-sm mt-1">Headlines are pulled from ad creative titles.</p>
    </div>
  )

  const LABELS: Record<SortKey, string> = {
    adsCount: "Ads", longestRunning: "Longest", totalRunningDays: "Total Days", totalReach: "Reach", score: "Score",
  }

  return (
    <div className="space-y-4">
      <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
        placeholder="Search headlines..."
        className="w-full max-w-sm h-9 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
      />

      <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-muted-foreground text-[11px] uppercase tracking-wide">
              <th className="text-left px-5 py-3 font-semibold w-[45%]">Headline</th>
              {(["adsCount", "longestRunning", "totalRunningDays", "totalReach", "score"] as SortKey[]).map(k => (
                <th key={k} className="px-5 py-3 text-right cursor-pointer select-none" onClick={() => toggleSort(k)}>
                  <span className="flex items-center justify-end gap-1 font-semibold">
                    {LABELS[k]}
                    {sortKey === k
                      ? sortAsc ? <IconChevronUp className="size-3" /> : <IconChevronDown className="size-3" />
                      : <IconChevronDown className="size-3 opacity-30" />
                    }
                  </span>
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {paged.map((row, i) => (
              <tr key={i} className="hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3">
                  <p className="text-[13px] font-medium text-foreground">{row.text}</p>
                </td>
                <td className="px-5 py-3 text-right tabular-nums font-medium">{row.adsCount}</td>
                <td className="px-5 py-3 text-right tabular-nums">{row.longestRunning}d</td>
                <td className="px-5 py-3 text-right tabular-nums">{row.totalRunningDays}d</td>
                <td className="px-5 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">{formatViews(row.totalReach)}</td>
                <td className="px-5 py-3 min-w-[80px]"><ScoreBar score={row.score} /></td>
                <td className="px-3 py-3"><CopyBtn text={row.text} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>{filtered.length} results</p>
          <div className="flex items-center gap-1">
            <button disabled={page === 1}     onClick={() => setPage(p => p - 1)} className="size-7 text-xs rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">←</button>
            {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)} className={cn("size-7 text-xs rounded-lg transition-colors", p === page ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{p}</button>
            ))}
            <button disabled={page === pages} onClick={() => setPage(p => p + 1)} className="size-7 text-xs rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">→</button>
          </div>
        </div>
      )}
    </div>
  )
}
