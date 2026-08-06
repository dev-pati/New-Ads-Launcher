"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  IconAlertCircle, IconAlertTriangle, IconCheck, IconInfoCircle,
  IconLoader2, IconPlus, IconX, IconWand,
} from "@tabler/icons-react"
import {
  ACTIONS, ENTITY_TYPES, METRIC_CATALOG, OPERATORS, TIME_RANGES,
  checkRuleWarnings, describeSchedule, suggestRuleName,
  type RuleCondition, type RuleDraft, type RuleEntityType, type RuleScheduleType,
} from "@/lib/meta-ad-rules"

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function emptyDraft(): RuleDraft {
  return {
    name: "",
    entityType: "ADSET",
    activeOnly: true,
    action: "PAUSE",
    actionAmount: "",
    actionUnit: "PERCENTAGE",
    // The pattern every rule in the live account uses: a spend floor, then the judgement.
    conditions: [
      { metric: "spent", operator: "GREATER_THAN", value: "27" },
      { metric: "purchases", operator: "LESS_THAN", value: "1" },
    ],
    timeRange: "LIFETIME",
    scheduleType: "DAILY",
    customWindows: [{ startMinute: 9 * 60, endMinute: 9 * 60, days: [1, 2, 3, 4, 5] }],
    subscribers: [],
    notifyOnFacebook: true,
  }
}

function minuteToTime(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}
function timeToMinute(v: string) {
  const [h, m] = v.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function RuleFormDialog({
  open, onClose, adAccountId, initial, ruleId, onSaved,
}: {
  open: boolean
  onClose: () => void
  adAccountId: string
  /** present = edit mode */
  initial?: Partial<RuleDraft> | null
  ruleId?: string
  onSaved: () => void
}) {
  const isEdit = Boolean(ruleId)
  const [draft, setDraft] = useState<RuleDraft>(emptyDraft)
  const [autoName, setAutoName] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setDraft({ ...emptyDraft(), ...(initial ?? {}) })
    setAutoName(!initial?.name)
    setError("")
  }, [open, initial])

  const patch = (p: Partial<RuleDraft>) => setDraft(d => ({ ...d, ...p }))

  const suggested = useMemo(() => suggestRuleName(draft), [draft])
  const effectiveName = autoName ? suggested : draft.name
  const warnings = useMemo(() => checkRuleWarnings(draft), [draft])
  const blocking = warnings.filter(w => w.severity === "block")
  const action = ACTIONS.find(a => a.value === draft.action)
  const entity = ENTITY_TYPES.find(e => e.value === draft.entityType)!
  const schedule = describeSchedule(draft.scheduleType)

  function updateCondition(i: number, p: Partial<RuleCondition>) {
    patch({ conditions: draft.conditions.map((c, idx) => (idx === i ? { ...c, ...p } : c)) })
  }

  async function handleSave() {
    if (!effectiveName.trim()) return setError("Rule name required")
    if (!adAccountId) return setError("Select an ad account")
    if (blocking.length) return setError(blocking[0].message)

    setSaving(true)
    setError("")
    try {
      const payload = { ...draft, name: effectiveName.trim(), adAccountId }
      const res = await fetch(
        isEdit ? `/api/facebook/rules/${ruleId}` : "/api/facebook/rules",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      const d = await res.json()
      if (!res.ok) return setError(d.error || "Failed to save rule")
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-background rounded-xl shadow-2xl border w-full max-w-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-semibold text-lg">{isEdit ? "Edit rule" : "Create a custom rule"}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automatically update the settings of your campaigns, ad sets or ads.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <IconX className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Rule name — auto-generated from the structured fields */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">Rule name</label>
              <button
                onClick={() => setAutoName(a => !a)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <IconWand className="size-3.5" /> {autoName ? "Write my own" : "Generate for me"}
              </button>
            </div>
            <input
              className={cn(
                "w-full border rounded-lg px-3 py-2 text-sm bg-background outline-none",
                "focus:ring-2 focus:ring-primary/30 focus:border-primary",
                autoName && "text-muted-foreground bg-muted/40"
              )}
              value={effectiveName}
              readOnly={autoName}
              placeholder="e.g. ALL - OFF - Camp - (ROAS)"
              onChange={e => patch({ name: e.target.value })}
            />
          </div>

          {/* Apply rule to */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Apply rule to</label>
            <div className="flex gap-2">
              <select
                className="flex-1 border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                value={draft.entityType}
                onChange={e => patch({ entityType: e.target.value as RuleEntityType })}
              >
                {ENTITY_TYPES.map(t => (
                  <option key={t.value} value={t.value}>All {t.plural}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm px-3 border rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.activeOnly}
                  onChange={e => patch({ activeOnly: e.target.checked })}
                />
                Active only
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 flex items-start gap-1.5">
              <IconInfoCircle className="size-3.5 mt-0.5 flex-shrink-0" />
              {draft.activeOnly
                ? `This rule applies to ${entity.plural} that are active at the time it runs.`
                : `This rule applies to every ${entity.label.toLowerCase()} in the account, including paused ones.`}
            </p>
          </div>

          {/* Action */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Action</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              value={draft.action}
              onChange={e => {
                const next = ACTIONS.find(a => a.value === e.target.value)
                patch({ action: e.target.value, actionUnit: next?.amountUnit })
              }}
            >
              {ACTIONS.map(a => (
                <option key={a.value} value={a.value}>{a.label(entity.plural)}</option>
              ))}
            </select>
            {action?.needsAmount && (
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  placeholder={draft.actionUnit === "ABSOLUTE" ? "Amount, e.g. 10" : "Percent, e.g. 20"}
                  value={draft.actionAmount ?? ""}
                  onChange={e => patch({ actionAmount: e.target.value })}
                />
                <span className="flex items-center px-3 text-sm text-muted-foreground border rounded-lg">
                  {draft.actionUnit === "ABSOLUTE" ? "$" : "%"}
                </span>
              </div>
            )}
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">Conditions</label>
              <button
                onClick={() =>
                  patch({ conditions: [...draft.conditions, { metric: "cpc_link", operator: "GREATER_THAN", value: "3" }] })
                }
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <IconPlus className="size-3.5" /> Add condition
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              <span className="font-medium text-foreground">All of the following match.</span>{" "}
              Meta has no OR — to express &ldquo;or&rdquo;, create a second rule.
            </p>
            <div className="space-y-2">
              {draft.conditions.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    className="flex-1 min-w-0 border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                    value={c.metric}
                    onChange={e => updateCondition(i, { metric: e.target.value })}
                  >
                    {/* Verified-against-live metrics first; the rest are still Meta's
                        documented spelling only, so they are grouped and marked. */}
                    <optgroup label="Metrics">
                      {Object.entries(METRIC_CATALOG)
                        .filter(([, m]) => !m.unverified)
                        .map(([k, m]) => (
                          <option key={k} value={k}>{m.label}</option>
                        ))}
                    </optgroup>
                    <optgroup label="Not yet confirmed on this account">
                      {Object.entries(METRIC_CATALOG)
                        .filter(([, m]) => m.unverified)
                        .map(([k, m]) => (
                          <option key={k} value={k}>{m.label}</option>
                        ))}
                    </optgroup>
                  </select>
                  <select
                    className="border rounded-lg px-2 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                    value={c.operator}
                    onChange={e => updateCondition(i, { operator: e.target.value })}
                  >
                    {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input
                    type="number"
                    className="w-24 border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                    value={c.value}
                    onChange={e => updateCondition(i, { value: e.target.value })}
                  />
                  {draft.conditions.length > 1 && (
                    <button
                      onClick={() => patch({ conditions: draft.conditions.filter((_, idx) => idx !== i) })}
                      className="text-muted-foreground hover:text-red-500"
                    >
                      <IconX className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Time range */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Time range</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              value={draft.timeRange}
              onChange={e => patch({ timeRange: e.target.value })}
            >
              {TIME_RANGES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Schedule */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Schedule</label>
            <div className="space-y-2">
              {(["SEMI_HOURLY", "DAILY", "CUSTOM"] as RuleScheduleType[]).map(t => {
                const d = describeSchedule(t)
                return (
                  <label
                    key={t}
                    className={cn(
                      "flex gap-2.5 p-3 border rounded-lg cursor-pointer transition-colors",
                      draft.scheduleType === t ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                    )}
                  >
                    <input
                      type="radio"
                      className="mt-1"
                      checked={draft.scheduleType === t}
                      onChange={() => patch({ scheduleType: t })}
                    />
                    <span>
                      <span className="text-sm font-medium block">{d.label}</span>
                      <span className="text-xs text-muted-foreground">{d.detail}</span>
                    </span>
                  </label>
                )
              })}
            </div>

            {draft.scheduleType === "CUSTOM" && (
              <div className="mt-3 space-y-3 p-3 border rounded-lg bg-muted/20">
                {(draft.customWindows ?? []).map((w, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        className="border rounded-lg px-2 py-1.5 text-sm bg-background"
                        value={minuteToTime(w.startMinute)}
                        onChange={e =>
                          patch({
                            customWindows: draft.customWindows!.map((x, idx) =>
                              idx === i ? { ...x, startMinute: timeToMinute(e.target.value) } : x
                            ),
                          })
                        }
                      />
                      <span className="text-sm text-muted-foreground">to</span>
                      <input
                        type="time"
                        className="border rounded-lg px-2 py-1.5 text-sm bg-background"
                        value={minuteToTime(w.endMinute)}
                        onChange={e =>
                          patch({
                            customWindows: draft.customWindows!.map((x, idx) =>
                              idx === i ? { ...x, endMinute: timeToMinute(e.target.value) } : x
                            ),
                          })
                        }
                      />
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {DAY_LABELS.map((label, day) => (
                        <button
                          key={day}
                          onClick={() =>
                            patch({
                              customWindows: draft.customWindows!.map((x, idx) =>
                                idx === i
                                  ? {
                                      ...x,
                                      days: x.days.includes(day)
                                        ? x.days.filter(d => d !== day)
                                        : [...x.days, day].sort(),
                                    }
                                  : x
                              ),
                            })
                          }
                          className={cn(
                            "px-2.5 py-1 rounded-md text-xs border transition-colors",
                            w.days.includes(day)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "hover:bg-muted"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Meta stores these in Pacific Time. {schedule.detail}
                </p>
              </div>
            )}
          </div>

          {/* Notification */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Notification</label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.notifyOnFacebook ?? true}
                onChange={e => patch({ notifyOnFacebook: e.target.checked })}
              />
              On Facebook — notify when this rule&apos;s conditions are met
            </label>
            <p className="text-xs text-muted-foreground mt-1.5">
              Only people with access to this ad account can receive rule results.
            </p>
          </div>

          {/* Trap guards — Meta only prints a passive note; we say it where it matters */}
          {warnings.map(w => (
            <div
              key={w.code}
              className={cn(
                "flex items-start gap-2 p-3 rounded-lg text-sm border",
                w.severity === "block"
                  ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900"
                  : "bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-900"
              )}
            >
              <IconAlertTriangle className="size-4 flex-shrink-0 mt-0.5" />
              <span>{w.message}</span>
            </div>
          ))}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
              <IconAlertCircle className="size-4 flex-shrink-0" />{error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || blocking.length > 0}>
            {saving ? <IconLoader2 className="size-4 animate-spin mr-1" /> : <IconCheck className="size-4 mr-1" />}
            {isEdit ? "Save changes" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  )
}
