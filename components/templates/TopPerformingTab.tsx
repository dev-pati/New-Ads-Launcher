"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { useTopPerforming, type TopPerformingItem } from "@/hooks/use-top-performing"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  IconLoader2, IconRefresh, IconSparkles, IconCopy, IconChevronDown,
  IconCheck, IconDatabase, IconChartBar,
} from "@tabler/icons-react"

const DATE_PRESETS = [
  { value: "last_7d",  label: "Last 7 days"  },
  { value: "last_14d", label: "Last 14 days" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "last_90d", label: "Last 90 days" },
]

function fmtSpend(n: number) {
  if (n >= 10000) return `$${(n / 1000).toFixed(1)}k`
  if (n >= 1000)  return `$${(n / 1000).toFixed(2)}k`
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function AdCopyCard({
  item,
  onCreateFromCopy,
}: {
  item: TopPerformingItem
  onCreateFromCopy: (copy: { headline: string; primaryText: string }) => void
}) {
  const [expanded, setExpanded]   = useState(false)
  const [copiedField, setCopied]  = useState<string | null>(null)

  const MAX = 180
  const longText   = item.primaryText.length > MAX
  const displayText = expanded || !longText ? item.primaryText : item.primaryText.slice(0, MAX) + "..."

  function copyField(field: string, text: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(field)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="border rounded-xl p-4 bg-white dark:bg-card hover:shadow-sm transition-shadow">
      {/* Top row */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 dark:text-muted-foreground w-4">
            {item.rank}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-white text-xs font-bold bg-green-500">
            {fmtSpend(item.spend)}
          </span>
          {item.copyCount > 1 && (
            <span className="text-xs text-slate-400 dark:text-muted-foreground">
              {item.copyCount} ads
            </span>
          )}
        </div>
        <button
          onClick={() => onCreateFromCopy({ headline: item.headline, primaryText: item.primaryText })}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          <IconSparkles className="size-3" />
          Create
        </button>
      </div>

      {/* Headline */}
      {item.headline && (
        <div className="mb-2 group/hl">
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide">Headline</p>
            <button
              onClick={() => copyField("headline", item.headline)}
              className="opacity-0 group-hover/hl:opacity-100 transition-opacity"
            >
              {copiedField === "headline"
                ? <IconCheck className="size-3 text-green-500" />
                : <IconCopy className="size-3 text-slate-400 hover:text-slate-600" />}
            </button>
          </div>
          <p className="text-xs font-semibold text-slate-900 dark:text-white leading-snug">
            {item.headline}
          </p>
        </div>
      )}

      {/* Primary Text */}
      {item.primaryText && (
        <div className="mb-3 group/pt">
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide">Primary Text</p>
            <button
              onClick={() => copyField("primaryText", item.primaryText)}
              className="opacity-0 group-hover/pt:opacity-100 transition-opacity"
            >
              {copiedField === "primaryText"
                ? <IconCheck className="size-3 text-green-500" />
                : <IconCopy className="size-3 text-slate-400 hover:text-slate-600" />}
            </button>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
            {displayText}
          </p>
          {longText && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-xs text-blue-600 font-medium mt-1 hover:underline"
            >
              {expanded ? "Show less" : "Show"}
              <IconChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} />
            </button>
          )}
        </div>
      )}

      {/* Ad info */}
      <div className="pt-2 border-t">
        <p className="text-xs text-slate-400 dark:text-muted-foreground truncate">
          Ad: {item.adName}
        </p>
        <p className="text-xs text-slate-400 dark:text-muted-foreground">
          ID: {item.adId}
        </p>
      </div>
    </div>
  )
}

interface Props {
  adAccountId: string | null
  onCreateFromCopy: (copy: { headline: string; primaryText: string }) => void
}

export function TopPerformingTab({ adAccountId, onCreateFromCopy }: Props) {
  const [datePreset, setDatePreset] = useState("last_30d")
  const { items, loading, error, isCached, cachedAt, refresh } = useTopPerforming(adAccountId, datePreset)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Action bar */}
      <div className="px-6 py-3 border-b flex items-center gap-3 shrink-0 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold">Top Performing Ad Copy</h2>
            {items.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-muted-foreground">
                ↗ {items.length} Unique {items.length === 1 ? "Copy" : "Copies"}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-muted-foreground">
            Discover your highest-spending ad copy to create winning templates
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                {DATE_PRESETS.find(d => d.value === datePreset)?.label}
                <IconChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {DATE_PRESETS.map(d => (
                <DropdownMenuItem
                  key={d.value}
                  onClick={() => setDatePreset(d.value)}
                  className={cn("text-xs gap-2", datePreset === d.value && "font-semibold text-primary")}
                >
                  {datePreset === d.value && <IconCheck className="size-3" />}
                  {d.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {isCached && cachedAt && (
            <div className="flex items-center gap-1.5 h-8 px-3 border rounded-lg text-xs text-slate-500 dark:text-muted-foreground bg-muted/30">
              <IconDatabase className="size-3.5" />
              Cached · {cachedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={refresh}
            disabled={loading}
          >
            <IconRefresh className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!adAccountId ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <IconChartBar className="size-12 text-muted-foreground/20 mb-4" />
            <p className="text-sm text-muted-foreground">Select an ad account to view top performing ad copy.</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-48">
            <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <p className="text-sm text-red-500 max-w-md">{error}</p>
            <Button variant="outline" size="sm" onClick={refresh}>Try again</Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <IconChartBar className="size-12 text-muted-foreground/20 mb-4" />
            <h3 className="font-bold mb-1">No data found</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              No ads with spend were found in this account for the selected date range.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={refresh}>
              <IconRefresh className="size-3.5 mr-1.5" />Retry
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {items.map(item => (
              <AdCopyCard
                key={item.adId}
                item={item}
                onCreateFromCopy={onCreateFromCopy}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
