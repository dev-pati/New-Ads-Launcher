"use client"

import { useState } from "react"
import { IconCheck, IconX, IconLoader2, IconAlertCircle, IconChevronDown, IconChevronUp } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

export interface PopupItem {
  id: string
  name: string
  status: "pending" | "success" | "failed"
  error?: string
}

interface MiniStatusPopupProps {
  title: string
  total: number
  items: PopupItem[]
  onDone: () => void
}

export function MiniStatusPopup({ title, total, items, onDone }: MiniStatusPopupProps) {
  const [expanded, setExpanded] = useState(false)

  const pendingItems = items.filter((item) => item.status === "pending")
  const successItems = items.filter((item) => item.status === "success")
  const failedItems = items.filter((item) => item.status === "failed")
  const isDone = pendingItems.length === 0

  const doneCount = successItems.length + failedItems.length
  const progressPercent = total > 0 ? (doneCount / total) * 100 : 0

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-[100] w-80 rounded-xl border bg-white dark:bg-background text-[#1c2b33] dark:text-foreground shadow-2xl transition-all duration-300",
        "border-border p-4 flex flex-col gap-3"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-sm">
          {!isDone ? (
            <IconLoader2 className="size-4 animate-spin text-blue-600 shrink-0" />
          ) : failedItems.length > 0 ? (
            <IconAlertCircle className="size-4 text-amber-500 shrink-0" />
          ) : (
            <IconCheck className="size-4 text-green-600 shrink-0" />
          )}
          <span>{title}</span>
        </div>
        {isDone && (
          <button
            onClick={onDone}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Progress Bar (Only show when not done or while working) */}
      {!isDone && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{doneCount} / {total}</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary */}
      {isDone && (
        <div className="text-xs text-muted-foreground flex items-center justify-between">
          <span>
            {successItems.length} succeeded · {failedItems.length} failed
          </span>
          {items.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-0.5 text-blue-600 hover:underline font-medium focus:outline-none"
            >
              {expanded ? "Hide detail" : "View detail"}
              {expanded ? <IconChevronUp className="size-3" /> : <IconChevronDown className="size-3" />}
            </button>
          )}
        </div>
      )}

      {/* Scrollable Item List */}
      {(!isDone || expanded) && items.length > 0 && (
        <div className="max-h-40 overflow-y-auto border rounded-md divide-y bg-muted/20">
          {items.map((item) => (
            <div key={item.id} className="p-2 text-xs flex flex-col gap-0.5">
              <div className="flex items-start justify-between gap-2">
                <span className="truncate font-medium flex-1">{item.name}</span>
                {item.status === "pending" ? (
                  <IconLoader2 className="size-3 animate-spin text-muted-foreground shrink-0 mt-0.5" />
                ) : item.status === "success" ? (
                  <IconCheck className="size-3 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <IconX className="size-3 text-red-600 shrink-0 mt-0.5" />
                )}
              </div>
              {item.error && (
                <span className="text-[10px] text-red-600 font-mono break-words">{item.error}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
