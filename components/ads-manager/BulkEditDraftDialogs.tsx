"use client"

import { useMemo, useState } from "react"
import { IconAlertTriangle, IconCheck, IconLoader2, IconX } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { BULK_EDIT_FIELD_GROUPS } from "@/components/ads-manager/BulkEditFieldMenu"
import {
  type BulkDraftField,
  type BulkDraftLevel,
  type BulkDraftMap,
  type BulkEditableItem,
  type BulkPublishResult,
  bulkDraftKey,
  draftChangeLabels,
  orderedDrafts,
  stageBudgetDrafts,
  stageNameDrafts,
  stageStatusDrafts,
} from "@/lib/ads-manager-bulk-drafts"

const LEVEL_LABEL: Record<BulkDraftLevel, string> = {
  campaign: "campaign",
  adset: "ad set",
  ad: "ad",
}

export function LegacyBulkEditDraftDialog({
  open,
  level,
  items,
  drafts,
  initialField = "turn_on",
  onOpenChange,
  onSave,
}: {
  open: boolean
  level: BulkDraftLevel
  items: BulkEditableItem[]
  drafts: BulkDraftMap
  initialField?: BulkDraftField
  onOpenChange: (open: boolean) => void
  onSave: (drafts: BulkDraftMap) => void
}) {
  const [field, setField] = useState<BulkDraftField>(initialField)
  const [budget, setBudget] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")

  const eligibleBudgetItems = useMemo(
    () => items.filter(item => item.budgetEligible),
    [items],
  )
  const blockedBudgetItems = items.filter(item => !item.budgetEligible)

  const save = () => {
    try {
      let next: BulkDraftMap
      if (field === "turn_on") next = stageStatusDrafts(drafts, level, items, "ACTIVE")
      else if (field === "turn_off") next = stageStatusDrafts(drafts, level, items, "PAUSED")
      else if (field === "name") next = stageNameDrafts(drafts, level, items, name)
      else next = stageBudgetDrafts(drafts, "adset", items, Number(budget))
      onSave(next)
      onOpenChange(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this draft")
    }
  }

  const canSave = field === "budget"
    ? eligibleBudgetItems.length > 0 && Number.isFinite(Number(budget)) && Number(budget) > 0
    : field === "name"
      ? items.length > 0 && name.trim().length > 0
      : items.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk edit {items.length} {LEVEL_LABEL[level]}{items.length === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription>
            Stage one change across the selection. Meta is not updated until you review and publish.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <div className="space-y-1 border-r pr-3">
            {([
              ["turn_on", "Turn on"],
              ["turn_off", "Turn off"],
              ["name", "Name"],
              ...(level === "adset" ? [["budget", "Budget"]] : []),
            ] as Array<[BulkDraftField, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => { setField(value); setError("") }}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm font-medium",
                  field === value ? "bg-blue-50 text-[#1877f2] dark:bg-blue-950/30" : "hover:bg-muted/60",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-w-0 space-y-3">
            <div className="rounded-lg border">
              <div className="grid grid-cols-[minmax(0,1fr)_180px] border-b bg-muted/30 px-3 py-2 text-xs font-semibold">
                <span>{LEVEL_LABEL[level][0].toUpperCase() + LEVEL_LABEL[level].slice(1)} name</span>
                <span>{field === "budget" ? "Budget" : field === "name" ? "New name" : "New status"}</span>
              </div>
              {(field === "budget" || field === "name") && (
                <div className="grid grid-cols-[minmax(0,1fr)_180px] items-center border-b bg-blue-50/60 px-3 py-2 dark:bg-blue-950/20">
                  <span className="text-sm font-medium">Edit all {field === "budget" ? "eligible " : ""}{LEVEL_LABEL[level]}s</span>
                  {field === "budget" ? (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <Input
                        value={budget}
                        onChange={event => { setBudget(event.target.value); setError("") }}
                        inputMode="decimal"
                        className="h-8 pl-7"
                        placeholder="0.00"
                      />
                    </div>
                  ) : (
                    <Input
                      value={name}
                      onChange={event => { setName(event.target.value); setError("") }}
                      className="h-8"
                      placeholder="New name"
                    />
                  )}
                </div>
              )}
              <div className="max-h-[310px] overflow-y-auto">
                {items.map(item => {
                  const budgetType = item.daily_budget !== undefined ? "Daily" : item.lifetime_budget !== undefined ? "Lifetime" : "—"
                  return (
                    <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_180px] items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">ID: {item.id}</p>
                      </div>
                      {field === "budget" ? (
                        item.budgetEligible ? (
                          <div className="text-sm">
                            <span className="font-medium">{budgetType}</span>
                            <span className="ml-1 text-muted-foreground">
                              ${(Number(item.daily_budget || item.lifetime_budget || 0) / 100).toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-700 dark:text-amber-400">{item.budgetBlockedReason || "Budget unavailable"}</span>
                        )
                      ) : field === "name" ? (
                        <span className="truncate text-sm">{name.trim() || item.name}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                          <span className={cn("size-2 rounded-full", field === "turn_on" ? "bg-emerald-600" : "bg-gray-400")} />
                          {field === "turn_on" ? "Active" : "Paused"}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {field === "budget" && blockedBudgetItems.length > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <IconAlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {blockedBudgetItems.length} selected {LEVEL_LABEL[level]}{blockedBudgetItems.length === 1 ? " is" : "s are"} excluded from this budget draft.
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!canSave}>Save to draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const LEVEL_TITLE: Record<BulkDraftLevel, string> = {
  campaign: "Campaign",
  adset: "Ad set",
  ad: "Ad",
}

const LEVEL_PLURAL: Record<BulkDraftLevel, string> = {
  campaign: "Campaigns",
  adset: "Ad sets",
  ad: "Ads",
}

export type BulkEditHierarchyRow = {
  id: string
  level: BulkDraftLevel
  name: string
  depth: 0 | 1 | 2
  selected: boolean
}

export type BulkEditHierarchy = {
  rows: BulkEditHierarchyRow[]
  counts: Partial<Record<BulkDraftLevel, number>>
}

export function BulkStatusChangeDialog({
  open,
  level,
  items,
  drafts,
  field,
  publishing,
  onOpenChange,
  onSave,
  onPublish,
}: {
  open: boolean
  level: BulkDraftLevel
  items: BulkEditableItem[]
  drafts: BulkDraftMap
  field: "turn_on" | "turn_off"
  publishing: boolean
  onOpenChange: (open: boolean) => void
  onSave: (drafts: BulkDraftMap) => void
  onPublish: (drafts: BulkDraftMap, keys: string[]) => void
}) {
  const next = useMemo(
    () => stageStatusDrafts(drafts, level, items, field === "turn_on" ? "ACTIVE" : "PAUSED"),
    [drafts, field, items, level],
  )
  const keys = useMemo(
    () => items.map(item => bulkDraftKey(level, item.id)).filter(key => Boolean(next[key])),
    [items, level, next],
  )

  return (
    <Dialog open={open} onOpenChange={openState => !publishing && onOpenChange(openState)}>
      <DialogContent className="gap-0 p-0 sm:max-w-[600px]">
        <DialogHeader className="border-b px-4 py-4">
          <DialogTitle>Change item status</DialogTitle>
        </DialogHeader>
        <div className="px-4 py-5 text-sm">
          You are {field === "turn_on" ? "turning on" : "turning off"} {items.length} item{items.length === 1 ? "" : "s"}.
        </div>
        <DialogFooter className="flex-row justify-between border-t px-4 py-3 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>Cancel</Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={publishing || keys.length === 0}
              onClick={() => {
                onSave(next)
                onOpenChange(false)
              }}
            >
              Save to draft
            </Button>
            <Button
              className="bg-[#078f67] text-white hover:bg-[#067b59]"
              disabled={publishing || keys.length === 0}
              onClick={() => onPublish(next, keys)}
            >
              {publishing && <IconLoader2 className="mr-1.5 size-4 animate-spin" />}
              Publish
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BulkEditDraftDialog({
  open,
  level,
  items,
  drafts,
  hierarchy,
  initialField = "name",
  onOpenChange,
  onSave,
}: {
  open: boolean
  level: BulkDraftLevel
  items: BulkEditableItem[]
  drafts: BulkDraftMap
  hierarchy: BulkEditHierarchy
  initialField?: BulkDraftField
  onOpenChange: (open: boolean) => void
  onSave: (drafts: BulkDraftMap) => void
}) {
  const normalizedInitialField: "name" | "budget" = initialField === "budget" && level === "adset" ? "budget" : "name"
  const [field, setField] = useState<"name" | "budget">(normalizedInitialField)
  const initialNames = useMemo(() => Object.fromEntries(items.map(item => [
    item.id,
    drafts[bulkDraftKey(level, item.id)]?.node.name ?? item.name,
  ])), [drafts, items, level])
  const initialBudgets = useMemo(() => Object.fromEntries(items.map(item => {
    const draft = drafts[bulkDraftKey(level, item.id)]
    const minor = draft?.node.daily_budget ?? draft?.node.lifetime_budget ?? item.daily_budget ?? item.lifetime_budget ?? ""
    return [item.id, minor ? (Number(minor) / 100).toFixed(2) : ""]
  })), [drafts, items, level])
  const [names, setNames] = useState<Record<string, string>>(initialNames)
  const [budgets, setBudgets] = useState<Record<string, string>>(initialBudgets)
  const [error, setError] = useState("")
  const eligibleBudgetItems = useMemo(() => items.filter(item => item.budgetEligible), [items])
  const blockedBudgetItems = useMemo(() => items.filter(item => !item.budgetEligible), [items])

  const commonName = items.length > 0 && items.every(item => names[item.id] === names[items[0].id]) ? names[items[0].id] : ""
  const commonBudget = eligibleBudgetItems.length > 0
    && eligibleBudgetItems.every(item => budgets[item.id] === budgets[eligibleBudgetItems[0].id])
    ? budgets[eligibleBudgetItems[0].id]
    : ""
  const nameDirty = items.some(item => names[item.id]?.trim() !== initialNames[item.id])
  const budgetDirty = eligibleBudgetItems.some(item => budgets[item.id] !== initialBudgets[item.id])
  const allNamesValid = items.length > 0 && items.every(item => Boolean(names[item.id]?.trim()))
  const allBudgetsValid = eligibleBudgetItems.length > 0
    && eligibleBudgetItems.every(item => Number.isFinite(Number(budgets[item.id])) && Number(budgets[item.id]) > 0)
  const canSave = field === "budget" ? budgetDirty && allBudgetsValid : nameDirty && allNamesValid
  const oldTotal = eligibleBudgetItems.reduce((total, item) => total + Number(item.daily_budget ?? item.lifetime_budget ?? 0) / 100, 0)
  const nextTotal = eligibleBudgetItems.reduce((total, item) => total + (Number(budgets[item.id]) || 0), 0)

  const save = () => {
    try {
      let next = drafts
      if (field === "name") {
        for (const item of items) next = stageNameDrafts(next, level, [item], names[item.id])
      } else {
        for (const item of eligibleBudgetItems) next = stageBudgetDrafts(next, "adset", [item], Number(budgets[item.id]))
      }
      onSave(next)
      onOpenChange(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this draft")
    }
  }

  const setAllNames = (value: string) => {
    setNames(Object.fromEntries(items.map(item => [item.id, value])))
    setError("")
  }
  const setAllBudgets = (value: string) => {
    setBudgets(current => ({
      ...current,
      ...Object.fromEntries(eligibleBudgetItems.map(item => [item.id, value])),
    }))
    setError("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[calc(100vh-16px)] w-[calc(100vw-16px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        <div className="grid h-[54px] shrink-0 grid-cols-[360px_minmax(0,1fr)] border-b">
          <div className="flex items-center gap-1 border-r px-2">
            {(["campaign", "adset", "ad"] as BulkDraftLevel[]).map(tabLevel => (
              <div
                key={tabLevel}
                className={cn(
                  "flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded px-1 text-sm",
                  level === tabLevel ? "bg-blue-50 font-semibold text-[#1877f2] dark:bg-blue-950/30" : "text-muted-foreground",
                )}
              >
                <span aria-hidden="true">{tabLevel === "campaign" ? "▰" : tabLevel === "adset" ? "▦" : "▤"}</span>
                <span className="truncate">{LEVEL_PLURAL[tabLevel]}</span>
                {Boolean(hierarchy.counts[tabLevel]) && (
                  <span className="rounded-full bg-background px-1.5 text-xs">{hierarchy.counts[tabLevel]}</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-4">
            <DialogTitle className="text-base">
              {field === "budget" ? "Budget" : "Name"} for {items.length} {LEVEL_LABEL[level]}{items.length === 1 ? "" : "s"}
            </DialogTitle>
            <button type="button" aria-label="Close bulk editor" onClick={() => onOpenChange(false)} className="rounded p-1 hover:bg-muted">
              <IconX className="size-5" />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[360px_250px_minmax(0,1fr)]">
          <aside className="overflow-y-auto border-r py-1">
            {hierarchy.rows.map(row => (
              <div
                key={`${row.level}:${row.id}`}
                className={cn(
                  "flex min-h-10 items-start gap-2 border-l-2 py-2 pr-3 text-sm",
                  row.selected ? "border-[#1877f2] bg-blue-50 dark:bg-blue-950/25" : "border-transparent",
                )}
                style={{ paddingLeft: `${12 + row.depth * 24}px` }}
              >
                {row.selected ? (
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border border-[#1877f2] bg-white text-xs text-[#1877f2]">✓</span>
                ) : (
                  <span className="mt-0.5 text-[#1877f2]" aria-hidden="true">{row.level === "campaign" ? "▰" : row.level === "adset" ? "▦" : "▤"}</span>
                )}
                <span className="line-clamp-2">{row.name}</span>
              </div>
            ))}
          </aside>

          <nav className="overflow-y-auto border-r px-2 py-4">
            {BULK_EDIT_FIELD_GROUPS[level].map(group => (
              <div key={group.label} className="mb-3">
                <p className="px-2 pb-1 text-sm font-bold">{group.label}</p>
                {group.fields
                  .filter(option => option.action !== "turn_on" && option.action !== "turn_off")
                  .map(option => {
                    const selectable = option.action === "name" || (option.action === "budget" && level === "adset")
                    const active = option.action === field
                    return (
                      <button
                        key={option.label}
                        type="button"
                        disabled={!selectable}
                        onClick={() => {
                          if (!selectable) return
                          setField(option.action as "name" | "budget")
                          setError("")
                        }}
                        className={cn(
                          "w-full rounded px-2 py-2 text-left text-sm",
                          active ? "bg-blue-50 font-semibold text-[#1877f2] dark:bg-blue-950/30" : "text-foreground",
                          selectable && !active && "hover:bg-muted/60",
                          !selectable && "cursor-not-allowed text-muted-foreground opacity-45",
                        )}
                      >
                        {option.label}
                      </button>
                    )
                  })}
              </div>
            ))}
          </nav>

          <main className="min-w-0 overflow-y-auto p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">{field === "budget" ? "Budget" : `${LEVEL_TITLE[level]} Name`}</h3>
              <Button variant="outline" size="sm">Show all <span className="ml-2">⌄</span></Button>
            </div>
            <div className="overflow-hidden rounded border">
              <div className="grid grid-cols-[minmax(280px,1fr)_minmax(300px,420px)] border-b bg-muted/20 px-4 py-2 text-sm font-semibold">
                <span>{LEVEL_TITLE[level]} name</span>
                <span>{field === "budget" ? "Budget" : `${LEVEL_TITLE[level]} Name`}</span>
              </div>
              <div className="grid min-h-[68px] grid-cols-[minmax(280px,1fr)_minmax(300px,420px)] items-center gap-4 border-b bg-muted/30 px-4 py-3">
                <span className="text-sm font-medium">Edit all selected {LEVEL_LABEL[level]}s</span>
                {field === "budget" ? (
                  <BudgetControl value={commonBudget} placeholder="Mixed values" onChange={setAllBudgets} aggregate />
                ) : (
                  <Input value={commonName} placeholder="Mixed values" onChange={event => setAllNames(event.target.value)} />
                )}
              </div>
              {items.map(item => (
                <div key={item.id} className="grid min-h-[68px] grid-cols-[minmax(280px,1fr)_minmax(300px,420px)] items-center gap-4 border-b px-4 py-3 last:border-b-0">
                  <span className="truncate text-sm">{item.name}</span>
                  {field === "budget" ? (
                    item.budgetEligible ? (
                      <BudgetControl
                        value={budgets[item.id]}
                        onChange={value => {
                          setBudgets(current => ({ ...current, [item.id]: value }))
                          setError("")
                        }}
                        typeLabel={item.daily_budget !== undefined ? "Daily budget" : "Lifetime budget"}
                      />
                    ) : (
                      <span className="text-sm text-amber-700 dark:text-amber-400">{item.budgetBlockedReason || "Budget unavailable"}</span>
                    )
                  ) : (
                    <Input
                      value={names[item.id]}
                      onChange={event => {
                        setNames(current => ({ ...current, [item.id]: event.target.value }))
                        setError("")
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
            {field === "budget" && blockedBudgetItems.length > 0 && (
              <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <IconAlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {blockedBudgetItems.length} selected {LEVEL_LABEL[level]}{blockedBudgetItems.length === 1 ? " is" : "s are"} excluded from this budget draft.
              </p>
            )}
            {field === "budget" && (
              <p className="mt-4 text-right text-sm">
                Total budget: <b>${nextTotal.toFixed(2)}</b> <span className="text-muted-foreground">(was ${oldTotal.toFixed(2)})</span>
              </p>
            )}
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </main>
        </div>

        <DialogFooter className="shrink-0 border-t px-4 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!canSave}>Save to draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BudgetControl({
  value,
  placeholder,
  onChange,
  aggregate = false,
  typeLabel = "Daily budget",
}: {
  value: string
  placeholder?: string
  onChange: (value: string) => void
  aggregate?: boolean
  typeLabel?: string
}) {
  return (
    <div className="grid grid-cols-[180px_minmax(0,1fr)]">
      <select disabled={!aggregate} className="h-9 rounded-l border border-r-0 bg-background px-3 text-sm disabled:bg-muted/30 disabled:text-muted-foreground">
        <option>{aggregate ? "Set daily budget to" : typeLabel}</option>
      </select>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">$</span>
        <Input
          value={value}
          placeholder={placeholder}
          inputMode="decimal"
          onChange={event => onChange(event.target.value)}
          className="rounded-l-none pl-7 pr-12"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">USD</span>
      </div>
    </div>
  )
}

export function BulkDraftReviewDialog({
  open,
  drafts,
  publishing,
  results,
  initialKeys,
  onOpenChange,
  onPublish,
}: {
  open: boolean
  drafts: BulkDraftMap
  publishing: boolean
  results: BulkPublishResult[]
  initialKeys?: string[]
  onOpenChange: (open: boolean) => void
  onPublish: (keys: string[]) => void
}) {
  const ordered = useMemo(() => orderedDrafts(Object.values(drafts)), [drafts])
  const [selected, setSelected] = useState<Set<string>>(() => {
    const available = new Set(ordered.map(draft => draft.key))
    const preferred = initialKeys?.filter(key => available.has(key)) || []
    return new Set(preferred.length ? preferred : available)
  })

  const resultByKey = new Map(results.map(result => [`${result.level}:${result.id}`, result]))
  const allSelected = ordered.length > 0 && ordered.every(draft => selected.has(draft.key))
  const availableSelected = ordered.filter(draft => selected.has(draft.key)).map(draft => draft.key)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Review and publish ({ordered.length})</DialogTitle>
          <DialogDescription>
            Only checked drafts will be published. Successful items are removed; failed items stay available for retry.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-[36px_110px_minmax(0,1fr)_minmax(220px,1fr)] items-center border-b bg-muted/40 px-3 py-2 text-xs font-semibold">
            <input
              aria-label="Select all drafts"
              type="checkbox"
              checked={allSelected}
              onChange={event => setSelected(event.target.checked ? new Set(ordered.map(draft => draft.key)) : new Set())}
              className="size-4 accent-[#1877f2]"
            />
            <span>Level</span>
            <span>Object</span>
            <span>Changes / result</span>
          </div>
          <div className="max-h-[390px] overflow-y-auto">
            {ordered.map(draft => {
              const result = resultByKey.get(draft.key)
              return (
                <div key={draft.key} className="grid grid-cols-[36px_110px_minmax(0,1fr)_minmax(220px,1fr)] items-start border-b px-3 py-3 text-sm last:border-b-0">
                  <input
                    aria-label={`Select ${draft.name}`}
                    type="checkbox"
                    checked={selected.has(draft.key)}
                    onChange={() => setSelected(current => {
                      const next = new Set(current)
                      if (next.has(draft.key)) next.delete(draft.key)
                      else next.add(draft.key)
                      return next
                    })}
                    className="mt-0.5 size-4 accent-[#1877f2]"
                  />
                  <span className="capitalize text-muted-foreground">{draft.level === "adset" ? "Ad set" : draft.level}</span>
                  <div className="min-w-0 pr-3">
                    <p className="truncate font-medium">{draft.name}</p>
                    <p className="text-xs text-muted-foreground">{draft.id}</p>
                  </div>
                  <div>
                    <p>{draftChangeLabels(draft).join(" · ")}</p>
                    {result && (
                      <p className={cn(
                        "mt-1 flex items-start gap-1 text-xs",
                        result.status === "published" ? "text-emerald-700" : "text-destructive",
                      )}>
                        {result.status === "published" && <IconCheck className="size-3.5 shrink-0" />}
                        {result.status === "published" ? "Published" : result.message || result.status}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
            {ordered.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No unpublished edits.</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>Cancel</Button>
          <Button onClick={() => onPublish(availableSelected)} disabled={publishing || availableSelected.length === 0}>
            {publishing && <IconLoader2 className="mr-1.5 size-4 animate-spin" />}
            Publish {availableSelected.length} draft{availableSelected.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
