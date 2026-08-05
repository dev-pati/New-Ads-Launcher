"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { IconSearch, IconX, IconChevronDown } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import {
  FilterChip,
  FilterField,
  FilterLevel,
  FilterOperator,
  RecentFilter,
  POPULAR_FILTERS,
  SELECTED_ROWS_FIELD,
  SELECTED_ROWS_LABEL,
  chipSummary,
  defaultOperator,
  fieldsForLevel,
  filterFieldById,
  isChipValidAt,
  loadRecentFilters,
  newChipId,
  operatorLabel,
  operatorTakesNoValue,
  operatorsFor,
  rememberFilter,
} from "@/lib/ads-manager-filters"

interface FilterBarProps {
  level: FilterLevel
  chips: FilterChip[]
  onChipsChange: (next: FilterChip[]) => void
  /** Free-text search is kept alongside chips — it filters live, exactly as before. */
  search: string
  onSearchChange: (value: string) => void
  /** Distinct values present in loaded data, per enum field id. */
  enumOptions: Record<string, string[]>
  /** Entity names present in loaded data, per text field id — powers the exact-match group. */
  suggestions: Record<string, string[]>
  /** How many rows the suggestions were computed over; shown so "not found" is not read as "does not exist". */
  loadedRowCount: number
  /** Metric chips are evaluated over this range. Named in the tooltip so the coupling is visible. */
  dateRangeLabel: string
  selectedCount: number
  /** Freezes the current selection into a `__selected_rows` chip. The page owns the ids. */
  onFilterSelectedRows: () => void
}

type Editor = {
  chipId: string | null
  field: string
  operator: FilterOperator
  values: string[]
}

const LEVEL_NOUN: Record<FilterLevel, string> = {
  campaigns: "campaigns",
  adsets: "ad sets",
  ads: "ads",
}

export function FilterBar({
  level, chips, onChipsChange, search, onSearchChange,
  enumOptions, suggestions, loadedRowCount, dateRangeLabel,
  selectedCount, onFilterSelectedRows,
}: FilterBarProps) {
  const [open, setOpen] = useState(false)
  const [editor, setEditor] = useState<Editor | null>(null)
  // Lazy initializer rather than an effect: `loadRecentFilters` returns [] on the
  // server, and nothing renders `recent` until the dropdown opens, so this cannot
  // produce a hydration mismatch.
  const [recent, setRecent] = useState<RecentFilter[]>(loadRecentFilters)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) { setOpen(false); setEditor(null) }
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  const fields = useMemo(() => fieldsForLevel(level), [level])
  const query = search.trim()

  function commit(next: FilterChip) {
    const exists = chips.some(c => c.id === next.id)
    onChipsChange(exists ? chips.map(c => (c.id === next.id ? next : c)) : [...chips, next])
    setRecent(rememberFilter(next))
    setEditor(null)
    setOpen(false)
    // The typed text became a chip; leaving it in the box would filter twice.
    onSearchChange("")
  }

  function removeChip(id: string) {
    onChipsChange(chips.filter(c => c.id !== id))
    if (editor?.chipId === id) setEditor(null)
  }

  function openEditorForField(field: FilterField, seedValue?: string, seedOperator?: FilterOperator) {
    setEditor({
      chipId: null,
      field: field.id,
      operator: seedOperator ?? defaultOperator(field.type),
      values: seedValue !== undefined ? [seedValue] : [],
    })
    setOpen(true)
  }

  function openEditorForChip(chip: FilterChip) {
    if (chip.field === SELECTED_ROWS_FIELD) return   // a snapshot has nothing to edit
    setEditor({ chipId: chip.id, field: chip.field, operator: chip.operator, values: [...chip.values] })
    setOpen(true)
  }

  function applyEditor() {
    if (!editor) return
    const field = filterFieldById(editor.field)
    if (!field) return
    const values = operatorTakesNoValue(editor.operator)
      ? []
      : editor.values.map(v => v.trim()).filter(Boolean)
    if (!operatorTakesNoValue(editor.operator) && values.length === 0) return
    commit({
      id: editor.chipId ?? newChipId(),
      field: editor.field,
      operator: editor.operator,
      values,
    })
  }

  function applyRecent(f: RecentFilter) {
    const field = filterFieldById(f.field)
    if (!field) return
    commit({ id: newChipId(), field: f.field, operator: f.operator, values: [...f.values] })
  }

  // ── Suggestions while typing ────────────────────────────────────────────────
  const textFields = fields.filter(f => f.type === "text" && f.id !== "id")
  const entityMatches = query
    ? textFields
        .map(f => ({
          field: f,
          values: (suggestions[f.id] ?? [])
            .filter(v => v.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 5),
        }))
        .filter(g => g.values.length > 0)
    : []

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (open || editor) { setOpen(false); setEditor(null) }
      else onSearchChange("")
      return
    }
    if (e.key === "Backspace" && search === "" && chips.length > 0 && !editor) {
      removeChip(chips[chips.length - 1].id)
    }
  }

  return (
    <div ref={rootRef} className="relative flex-1 min-w-[260px]">
      <div
        className={cn(
          "flex items-center flex-wrap gap-1 w-full pl-3 pr-8 py-1 min-h-[34px]",
          "bg-muted/30 border rounded-lg focus-within:ring-1 focus-within:ring-ring"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        <IconSearch className="size-3.5 shrink-0 text-muted-foreground/50" />

        {chips.map(chip => {
          const valid = isChipValidAt(chip, level)
          const s = chipSummary(chip)
          const isMetric = filterFieldById(chip.field)?.source === "metric"
          return (
            <span
              key={chip.id}
              title={
                !valid
                  ? `${s.label} does not apply to ${LEVEL_NOUN[level]} — the filter is inactive on this tab`
                  : isMetric
                  ? `Evaluated over ${dateRangeLabel}`
                  : undefined
              }
              className={cn(
                "flex items-center gap-1 pl-2 pr-1 py-0.5 text-xs rounded-full border max-w-[280px]",
                valid
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-muted border-border text-muted-foreground/60 line-through"
              )}
            >
              <button
                type="button"
                onClick={e => { e.stopPropagation(); openEditorForChip(chip) }}
                className="truncate font-medium"
              >
                {s.label}{s.operator ? ` ${s.operator}` : ""}{s.value ? ` ${s.value}` : ""}
              </button>
              <button
                type="button"
                aria-label={`Remove filter ${s.label}`}
                onClick={e => { e.stopPropagation(); removeChip(chip.id) }}
                className="shrink-0 hover:text-foreground"
              >
                <IconX className="size-3" />
              </button>
            </span>
          )
        })}

        <input
          ref={inputRef}
          value={search}
          onChange={e => { onSearchChange(e.target.value); setOpen(true); setEditor(null) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
          placeholder={chips.length ? "Add filter..." : "Search by name, ID, campaign or ad set..."}
          className="flex-1 min-w-[140px] py-0.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground/50"
        />
      </div>

      {(search || chips.length > 0) && (
        <button
          onClick={() => { onSearchChange(""); onChipsChange([]) }}
          title="Clear search and filters"
          className="absolute right-2.5 top-2 text-muted-foreground/50 hover:text-foreground"
        >
          <IconX className="size-3.5" />
        </button>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-[420px] max-h-[420px] overflow-y-auto rounded-lg border bg-popover shadow-lg text-sm">
          {editor ? (
            <EditorPanel
              editor={editor}
              setEditor={setEditor}
              enumOptions={enumOptions}
              suggestions={suggestions}
              onApply={applyEditor}
              onCancel={() => setEditor(null)}
            />
          ) : query ? (
            <>
              <Group label="Suggested searches">
                {textFields.map(f => (
                  <Row key={f.id} onClick={() => openEditorForField(f, query, "contains_all")}>
                    <span className="text-muted-foreground">{f.label}</span>
                    <span className="text-muted-foreground/60">contains all of</span>
                    <span className="font-medium truncate">{query}</span>
                  </Row>
                ))}
              </Group>
              {entityMatches.map(g => (
                <Group key={g.field.id} label={g.field.label}>
                  {g.values.map(v => (
                    <Row key={v} onClick={() => openEditorForField(g.field, v, "is")}>
                      <span className="truncate">{v}</span>
                    </Row>
                  ))}
                </Group>
              ))}
              <div className="px-3 py-1.5 text-xs text-muted-foreground/70 border-t">
                Matched against {loadedRowCount} loaded row{loadedRowCount === 1 ? "" : "s"}.
              </div>
            </>
          ) : (
            <>
              {recent.length > 0 && (
                <Group label="Recent">
                  {recent.map((f, i) => {
                    const field = filterFieldById(f.field)
                    if (!field) return null
                    return (
                      <Row key={`${f.field}-${i}`} onClick={() => applyRecent(f)}>
                        <span className="text-muted-foreground">{field.label}</span>
                        <span className="text-muted-foreground/60">{operatorLabel(field.type, f.operator)}</span>
                        <span className="font-medium truncate">{f.values.join(" – ")}</span>
                      </Row>
                    )
                  })}
                </Group>
              )}
              {/* Hardcoded. Nothing measures which filters buyers actually use (BL-12),
                  so this must not be presented as personalised. */}
              <Group label="Common filters">
                {POPULAR_FILTERS.map((f, i) => {
                  const field = filterFieldById(f.field)
                  if (!field || !field.levels.includes(level)) return null
                  return (
                    <Row key={`pop-${i}`} onClick={() => applyRecent(f)}>
                      <span className="text-muted-foreground">{field.label}</span>
                      <span className="text-muted-foreground/60">{operatorLabel(field.type, f.operator)}</span>
                      <span className="font-medium">{f.values.join(" – ")}</span>
                    </Row>
                  )
                })}
              </Group>
              <Group label="Filter by">
                <Row
                  disabled={selectedCount === 0}
                  onClick={() => { onFilterSelectedRows(); setOpen(false) }}
                >
                  <span className={cn(selectedCount === 0 && "text-muted-foreground/50")}>
                    {SELECTED_ROWS_LABEL}
                  </span>
                  {selectedCount > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground">{selectedCount} selected</span>
                  )}
                </Row>
                {fields.map(f => (
                  <Row key={f.id} onClick={() => openEditorForField(f)}>
                    <span>{f.label}</span>
                    <IconChevronDown className="ml-auto size-3.5 -rotate-90 text-muted-foreground/50" />
                  </Row>
                ))}
              </Group>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b last:border-b-0 py-1">
      <div className="px-3 py-1 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide">{label}</div>
      {children}
    </div>
  )
}

function Row({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/60 disabled:opacity-50 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

function EditorPanel({
  editor, setEditor, enumOptions, suggestions, onApply, onCancel,
}: {
  editor: Editor
  setEditor: (e: Editor) => void
  enumOptions: Record<string, string[]>
  suggestions: Record<string, string[]>
  onApply: () => void
  onCancel: () => void
}) {
  const field = filterFieldById(editor.field)
  if (!field) return null
  const ops = operatorsFor(field.type)
  const needsSecond = editor.operator === "between"
  const noValue = operatorTakesNoValue(editor.operator)
  const options = field.type === "enum" ? enumOptions[field.id] ?? [] : []
  const datalistId = `filter-suggest-${field.id}`

  const setValue = (index: number, value: string) => {
    const values = [...editor.values]
    values[index] = value
    setEditor({ ...editor, values })
  }

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{field.label}</span>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><IconX className="size-4" /></button>
      </div>

      <select
        value={editor.operator}
        onChange={e => setEditor({ ...editor, operator: e.target.value as FilterOperator, values: [] })}
        className="w-full px-2 py-1.5 text-sm border rounded-md bg-background outline-none focus:ring-1 focus:ring-ring"
      >
        {ops.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>

      {field.type === "enum" ? (
        <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
          {options.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">No values in the loaded rows.</div>
          )}
          {options.map(opt => {
            const checked = editor.values.includes(opt)
            return (
              <label key={opt} className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/60">
                <input
                  type="checkbox"
                  className="rounded size-[14px] accent-[#1877f2]"
                  checked={checked}
                  onChange={() => setEditor({
                    ...editor,
                    values: checked ? editor.values.filter(v => v !== opt) : [...editor.values, opt],
                  })}
                />
                <span className="truncate">{opt}</span>
              </label>
            )
          })}
        </div>
      ) : noValue ? (
        <p className="text-xs text-muted-foreground">
          Matches rows that {editor.operator === "is_set" ? "have" : "have no"} reported data for this metric in the
          selected date range. A row with no data is not treated as zero.
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            type={field.type === "date" ? (editor.operator === "in_last_days" ? "number" : "date") : field.type === "text" ? "text" : "number"}
            value={editor.values[0] ?? ""}
            onChange={e => setValue(0, e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onApply() } }}
            list={field.type === "text" ? datalistId : undefined}
            placeholder={editor.operator === "in_last_days" ? "days" : "value"}
            className="flex-1 px-2 py-1.5 text-sm border rounded-md bg-background outline-none focus:ring-1 focus:ring-ring"
          />
          {needsSecond && (
            <>
              <span className="text-xs text-muted-foreground">and</span>
              <input
                type={field.type === "date" ? "date" : "number"}
                value={editor.values[1] ?? ""}
                onChange={e => setValue(1, e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onApply() } }}
                className="flex-1 px-2 py-1.5 text-sm border rounded-md bg-background outline-none focus:ring-1 focus:ring-ring"
              />
            </>
          )}
          {field.type === "text" && (
            <datalist id={datalistId}>
              {(suggestions[field.id] ?? []).slice(0, 50).map(v => <option key={v} value={v} />)}
            </datalist>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-2.5 py-1 text-xs border rounded-lg hover:bg-muted/50">Cancel</button>
        <button onClick={onApply} className="px-2.5 py-1 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-90">Apply</button>
      </div>
    </div>
  )
}
