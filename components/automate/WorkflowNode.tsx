"use client"

import { memo } from "react"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"
import {
  IconBrandMeta, IconBell, IconBrandGoogleDrive, IconBrandTiktok,
  IconBrandSnapchat, IconBrandPinterest, IconCalendar,
  IconBrandSlack, IconTable, IconBolt, IconPlayerPlay,
} from "@tabler/icons-react"
import type { AppId, NodeKind, NodeStatus } from "@/lib/workflow-types"

// ─── App icon map ─────────────────────────────────────────────────────────────

const APP_ICONS: Record<AppId, React.ElementType> = {
  meta:         IconBrandMeta,
  notification: IconBell,
  google_drive: IconBrandGoogleDrive,
  tiktok:       IconBrandTiktok,
  snapchat:     IconBrandSnapchat,
  pinterest:    IconBrandPinterest,
  slack:        IconBrandSlack,
  sheets:       IconTable,
  schedule:     IconCalendar,
}

const APP_COLORS: Record<AppId, string> = {
  meta:         "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400",
  notification: "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
  google_drive: "bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400",
  tiktok:       "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200",
  snapchat:     "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-600",
  pinterest:    "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400",
  slack:        "bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400",
  sheets:       "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400",
  schedule:     "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400",
}

const KIND_BADGE: Record<NodeKind, { label: string; color: string }> = {
  trigger:   { label: "TRIGGER",   color: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300" },
  action:    { label: "ACTION",    color: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  condition: { label: "CONDITION", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
}

// ─── Node data shape ──────────────────────────────────────────────────────────

export interface WorkflowNodeData extends Record<string, unknown> {
  stepIndex: number
  kind: NodeKind
  status: NodeStatus
  appId?: AppId
  appName?: string
  eventLabel?: string
  subtitle?: string
  tags: string[]
  isSelected?: boolean
  onSelect?: (id: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export const WorkflowNodeComponent = memo(function WorkflowNodeComponent({
  id, data, selected,
}: NodeProps<Node<WorkflowNodeData>>) {
  const isEmpty = !data.appId
  const AppIcon = data.appId ? (APP_ICONS[data.appId] ?? IconBolt) : (data.kind === "trigger" ? IconBolt : IconPlayerPlay)
  const badge   = KIND_BADGE[data.kind]
  const appCls  = data.appId ? (APP_COLORS[data.appId] ?? "bg-muted text-muted-foreground") : "bg-muted/60 text-muted-foreground/50"

  return (
    <div
      onClick={() => data.onSelect?.(id)}
      className={cn(
        "w-[360px] bg-white dark:bg-card rounded-2xl border transition-all duration-150 cursor-pointer select-none",
        selected
          ? "border-primary shadow-[0_0_0_3px_rgba(99,102,241,0.15)] shadow-lg"
          : "border-[#E5E7EB] dark:border-border hover:border-[#C7D2DA] hover:shadow-md shadow-sm"
      )}
    >
      <Handle type="target" position={Position.Top}    className="!border-0 !bg-transparent !size-0" />
      <Handle type="source" position={Position.Bottom} className="!border-0 !bg-transparent !size-0" />

      <div className="p-4">
        {/* Header row: step + badge + status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="size-5 rounded-full bg-[#F3F4F6] dark:bg-muted flex items-center justify-center text-[10px] font-bold text-[#6B7280] dark:text-muted-foreground shrink-0">
              {data.stepIndex}
            </span>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide", badge.color)}>
              {badge.label}
            </span>
          </div>
          <span className={cn(
            "size-2.5 rounded-full shrink-0",
            data.status === "configured" ? "bg-emerald-500" :
            data.status === "error"      ? "bg-red-500"     : "bg-amber-400"
          )} />
        </div>

        {/* App identity */}
        <div className="flex items-center gap-3">
          <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0", appCls)}>
            <AppIcon className={cn("size-5", isEmpty && "opacity-40")} />
          </div>
          <div className="flex-1 min-w-0">
            {isEmpty ? (
              <p className="text-[14px] font-semibold text-[#9CA3AF] dark:text-muted-foreground leading-tight">
                Choose an app
              </p>
            ) : (
              <>
                <p className="text-[13px] font-semibold text-foreground leading-tight truncate">
                  {data.appName} · {data.eventLabel}
                </p>
                {data.subtitle && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{data.subtitle}</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Tags (only when configured) */}
        {!isEmpty && data.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {data.tags.map((tag, i) => (
              <span key={i} className="px-2.5 py-0.5 rounded-full bg-[#F3F4F6] dark:bg-muted text-[11px] font-medium text-[#6B7280] dark:text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})
