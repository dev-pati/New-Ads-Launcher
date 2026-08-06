"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  IconAlertTriangle, IconCopy, IconDotsVertical, IconEdit, IconEye, IconLoader2, IconTrash,
} from "@tabler/icons-react"
import { timeRangeLabel, describeSchedule, type ParsedRule } from "@/lib/meta-ad-rules"

export interface RuleRow extends ParsedRule {
  raw?: any
}

export interface RuleSummary {
  executions: number
  lastRun: string | null
  entitiesAffected: number
}

function fmtDate(d?: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

/**
 * Meta has four statuses and the toggle can only show two. `HAS_ISSUES` in particular reads
 * as "on" to the switch and as "not running" to Meta — the exact gap trap T7 lives in — so
 * the status is its own column, in Meta's own words, and the toggle is only a control.
 */
function statusPill(rule: RuleRow): { text: string; className: string; warn?: boolean } {
  switch (rule.status) {
    case "ENABLED":
      return { text: "Active", className: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" }
    case "DISABLED":
      return { text: "Off", className: "bg-muted text-muted-foreground" }
    case "HAS_ISSUES":
      return {
        text: "Has issues",
        className: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
        warn: true,
      }
    case "DELETED":
      return { text: "Deleted", className: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" }
    default:
      return {
        text: rule.status ? rule.status.toLowerCase().replace(/_/g, " ") : "Unknown",
        className: "bg-muted text-muted-foreground",
      }
  }
}

/**
 * Answers Meta's "When rule runs" column. When a rule is disabled Meta says
 * "Rule is not being checked." — that sentence is the whole reason the column exists, and
 * dropping it is how a rule sits dead for months without anyone noticing (trap T7).
 */
function whenRuleRuns(rule: RuleRow) {
  if (rule.hasIssues) return { text: "Meta reported an issue with this rule.", dead: true }
  if (!rule.enabled) return { text: "Rule is not being checked.", dead: true }
  return { text: describeSchedule(rule.scheduleType).label, dead: false }
}

/** Toggle + rule name stay put while the rest scrolls, the way Ads Manager locks them. */
const STICKY_TOGGLE = "sticky left-0 z-10 bg-background group-hover:bg-muted/30"
const STICKY_NAME = "sticky left-10 z-10 bg-background group-hover:bg-muted/30"

export function RulesTable({
  rules, summary, busyId, onToggle, onPreview, onEdit, onDuplicate, onDelete,
}: {
  rules: RuleRow[]
  summary: Record<string, RuleSummary>
  busyId: string | null
  onToggle: (rule: RuleRow, next: boolean) => void
  onPreview: (rule: RuleRow) => void
  onEdit: (rule: RuleRow) => void
  onDuplicate: (rule: RuleRow) => void
  onDelete: (rule: RuleRow) => void
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null)

  return (
    <div className="border rounded-xl overflow-x-auto">
      <table data-table="comfortable" className="w-full table-fixed text-sm min-w-[1240px]">
        {/*
          table-fixed, because auto layout re-weights every column from the content of the
          rules that happen to be on screen — switch accounts and the same columns move.
          Pixels for the columns whose content has a fixed length (id, dates, controls),
          percentages for the ones holding sentences, so the spare width lands on the text.
        */}
        <colgroup>
          <col className="w-10" />
          <col className="w-[15%]" />
          <col className="w-[96px]" />
          <col className="w-[168px]" />
          <col className="w-[16%]" />
          <col className="w-[22%]" />
          <col className="w-[104px]" />
          <col className="w-[132px]" />
          <col className="w-[12%]" />
          <col className="w-[112px]" />
          <col className="w-[132px]" />
        </colgroup>
        <thead className="bg-muted">
          <tr className="[&>th]:py-2.5 [&>th]:font-medium [&>th]:text-muted-foreground [&>th]:whitespace-nowrap">
            <th className={cn("px-3 bg-muted sticky left-0 z-20")} />
            <th className="text-left px-3 bg-muted sticky left-10 z-20">Rule name</th>
            <th className="text-left px-3">Status</th>
            <th className="text-left px-3">ID</th>
            <th className="text-left px-3">Applied to</th>
            <th className="text-left px-3">Action &amp; condition</th>
            <th className="text-left px-3">Time range</th>
            <th className="text-left px-3">Rule results</th>
            <th className="text-left px-3">When rule runs</th>
            <th className="text-left px-3">Created</th>
            <th className="text-right px-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rules.map(rule => {
            const s = summary[rule.id]
            const runs = whenRuleRuns(rule)
            const pill = statusPill(rule)
            return (
              <tr key={rule.id} className="group hover:bg-muted/30 transition-colors align-top">
                <td className={cn("px-3", STICKY_TOGGLE)}>
                  {busyId === rule.id ? (
                    <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : (
                    <button
                      role="switch"
                      aria-checked={rule.enabled}
                      aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.name}`}
                      onClick={() => onToggle(rule, !rule.enabled)}
                      className={cn(
                        "relative h-5 w-9 rounded-full transition-colors",
                        rule.enabled ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 size-4 rounded-full bg-white shadow transition-all",
                          rule.enabled ? "left-[18px]" : "left-0.5"
                        )}
                      />
                    </button>
                  )}
                </td>

                <td className={cn("px-3", STICKY_NAME)}>
                  <button
                    onClick={() => onEdit(rule)}
                    title={rule.name}
                    className="font-medium text-left hover:text-primary hover:underline line-clamp-2"
                  >
                    {rule.name}
                  </button>
                </td>

                <td className="px-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap",
                      pill.className
                    )}
                  >
                    {pill.warn && <IconAlertTriangle className="size-3" />}
                    {pill.text}
                  </span>
                </td>

                {/* Meta's own rule id — the only handle that works in Ads Manager and in a support ticket */}
                <td className="px-3">
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">{rule.id}</span>
                </td>

                <td className="px-3 text-muted-foreground">{rule.appliedTo}</td>

                <td className="px-3">
                  <div className="font-medium">{rule.actionLabel}</div>
                  <div className="text-xs text-muted-foreground">{rule.conditionText}</div>
                </td>

                <td className="px-3 text-muted-foreground whitespace-nowrap">
                  {timeRangeLabel(rule.timeRange)}
                </td>

                {/* Executions, not evaluations — a continuous rule evaluates ~48x/day */}
                <td className="px-3">
                  {!s || s.executions === 0 ? (
                    <span className="text-muted-foreground">Never</span>
                  ) : (
                    <>
                      <div>{s.executions} {s.executions === 1 ? "run" : "runs"}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.entitiesAffected} affected · {fmtDate(s.lastRun)}
                      </div>
                    </>
                  )}
                </td>

                <td className={cn("px-3", runs.dead ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                  {runs.text}
                </td>

                <td className="px-3 text-muted-foreground text-xs">{fmtDate(rule.createdTime)}</td>

                <td className="px-3">
                  <div className="flex items-center justify-end gap-1 relative">
                    <Button variant="outline" size="sm" onClick={() => onPreview(rule)}>
                      <IconEye className="size-4 mr-1" /> Preview
                    </Button>
                    <button
                      onClick={() => setMenuFor(menuFor === rule.id ? null : rule.id)}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                      aria-label={`More actions for ${rule.name}`}
                    >
                      <IconDotsVertical className="size-4" />
                    </button>
                    {menuFor === rule.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                        <div className="absolute right-0 top-9 z-20 w-40 bg-background border rounded-lg shadow-lg py-1 text-sm">
                          <button
                            className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2"
                            onClick={() => { setMenuFor(null); onEdit(rule) }}
                          >
                            <IconEdit className="size-4" /> Edit
                          </button>
                          <button
                            className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2"
                            onClick={() => { setMenuFor(null); onDuplicate(rule) }}
                          >
                            <IconCopy className="size-4" /> Duplicate
                          </button>
                          <button
                            className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2 text-red-600 dark:text-red-400"
                            onClick={() => { setMenuFor(null); onDelete(rule) }}
                          >
                            <IconTrash className="size-4" /> Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
