"use client"

import { useState, useMemo } from "react"
import { IconCopy, IconCheck, IconExternalLink, IconChevronUp, IconChevronDown } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { LandingPageMetrics } from "@/lib/brand-spy-analytics"

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Copy URL">
      {copied ? <IconCheck className="size-3.5 text-emerald-500" /> : <IconCopy className="size-3.5" />}
    </button>
  )
}

type SortKey = "adsCount" | "distribution"

interface Props { pages: LandingPageMetrics[] }

export function LandingPagesTab({ pages: lps }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("adsCount")
  const [sortAsc, setSortAsc] = useState(false)
  const [search,  setSearch]  = useState("")

  const sorted = useMemo(() => {
    let rows = [...lps]
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(r => r.url.toLowerCase().includes(q))
    }
    rows.sort((a, b) => {
      const diff = a[sortKey] - b[sortKey]
      return sortAsc ? diff : -diff
    })
    return rows
  }, [lps, sortKey, sortAsc, search])

  if (lps.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
      <p className="font-medium">No landing pages detected.</p>
      <p className="text-sm mt-1">Landing pages are extracted from ad creatives.</p>
    </div>
  )

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortAsc(p => !p)
    else { setSortKey(k); setSortAsc(false) }
  }

  return (
    <div className="space-y-4">
      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Filter URLs..."
        className="w-full max-w-sm h-9 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
      />

      <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-muted-foreground text-xs uppercase tracking-wide">
              <th className="text-left px-5 py-3 font-semibold">Landing Page URL</th>
              {(["adsCount", "distribution"] as SortKey[]).map(k => (
                <th key={k} className="px-5 py-3 text-right cursor-pointer select-none" onClick={() => toggleSort(k)}>
                  <span className="flex items-center justify-end gap-1 font-semibold">
                    {k === "adsCount" ? "Ads Count" : "Distribution %"}
                    {sortKey === k
                      ? sortAsc ? <IconChevronUp className="size-3" /> : <IconChevronDown className="size-3" />
                      : <IconChevronDown className="size-3 opacity-30" />
                    }
                  </span>
                </th>
              ))}
              <th className="w-20 px-5 py-3 text-right font-semibold text-xs uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {sorted.map((row, i) => (
              <tr key={i} className="hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded text-xs font-bold bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-xs font-mono text-foreground/80 truncate max-w-[360px]">{row.url}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-right tabular-nums font-semibold">{row.adsCount}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary/70 rounded-full" style={{ width: `${row.distribution}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{row.distribution}%</span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <a href={row.url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Open">
                      <IconExternalLink className="size-3.5" />
                    </a>
                    <CopyBtn text={row.url} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
