"use client"

import { useCallback, useEffect, useState } from "react"
import { IconHistory, IconLoader2, IconRefresh } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { AutomationRun } from "./types"

export function CommentHistorySection() {
  const [history, setHistory] = useState<AutomationRun[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch("/api/comments/history")
      const data = await res.json().catch(() => ({}))
      setHistory(Array.isArray(data.runs) ? data.runs : [])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => { void loadHistory() }, [loadHistory])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{history.length} total run{history.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => void loadHistory()}
          className="flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors hover:bg-muted/50"
        >
          <IconRefresh className="size-3.5" /> Refresh
        </button>
      </div>

      {historyLoading ? (
        <div className="flex justify-center py-20">
          <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-16">
          <IconHistory className="size-14 text-muted-foreground/20" />
          <p className="text-base font-semibold">No automation history yet</p>
          <p className="text-sm text-muted-foreground">History will appear here once automation rules have been executed</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table data-table="comfortable" className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="px-3 text-left text-xs font-semibold text-muted-foreground">Automation</th>
                <th className="px-3 text-left text-xs font-semibold text-muted-foreground">Action</th>
                <th className="px-3 text-left text-xs font-semibold text-muted-foreground">Result</th>
                <th className="px-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                <th className="px-3 text-right text-xs font-semibold text-muted-foreground">Time</th>
              </tr>
            </thead>
            <tbody>
              {history.map(r => (
                <tr key={r.id} className="border-b transition-colors last:border-0 hover:bg-muted/20">
                  <td className="px-3 font-medium">{r.automation_name}</td>
                  <td className="px-3 capitalize text-muted-foreground">{r.action_taken?.replace(/_/g, " ")}</td>
                  <td className="max-w-[220px] truncate px-3 text-muted-foreground">{r.result}</td>
                  <td className="px-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold",
                      r.status === "success" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : r.status === "skipped" ? "bg-muted/60 text-muted-foreground"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 text-right text-xs text-muted-foreground">
                    {new Date(r.run_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
