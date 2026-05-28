"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  IconArrowLeft, IconDeviceFloppy, IconPlayerPlay,
  IconEye, IconHistory, IconBell, IconDots, IconChevronDown,
  IconLoader2, IconCheck, IconX, IconCirclePlus, IconBolt,
  IconClock, IconShieldCheck,
} from "@tabler/icons-react"
import { WorkflowCanvas } from "./WorkflowCanvas"
import { TriggerConfigPanel } from "./TriggerConfigPanel"
import { ActionConfigPanel } from "./ActionConfigPanel"
import type {
  WorkflowStep, TriggerConfig, ActionConfig, Workflow,
} from "@/lib/workflow-types"

// ─── Default configs ──────────────────────────────────────────────────────────

function defaultTrigger(): TriggerConfig {
  return {
    appId: "meta",
    event: "performance_monitoring",
    monitoringLevel: "campaign",
    campaignFilter: "all",
    metricConditions: [{ metric: "spend", operator: "decreases_by", value: 20, unit: "%" }],
    comparisonWindow: "day_over_day",
    checkFrequency: "daily",
  }
}

function defaultAction(): ActionConfig {
  return {
    appId: "notification",
    event: "send_notification",
    notification: {
      via: "both",
      emailRecipients: [],
      customMessage: "{{trigger.summary}}\n{{trigger.entityName}}: {{trigger.previousValue}} → {{trigger.currentValue}} ({{trigger.actualChange}}% change)",
    },
  }
}

// ─── Add-step picker modal ────────────────────────────────────────────────────

const ACTION_CHOICES = [
  { id: "send_notification", label: "Send Notification", icon: "🔔", appId: "notification" as const },
  { id: "duplicate_ad",      label: "Duplicate Ad",      icon: "📋", appId: "meta"         as const },
  { id: "increase_budget",   label: "Increase Budget",   icon: "📈", appId: "meta"         as const },
  { id: "pause_adset",       label: "Pause Ad Set",      icon: "⏸️", appId: "meta"         as const },
  { id: "launch_tiktok",     label: "Launch on TikTok",  icon: "🎵", appId: "tiktok"       as const },
  { id: "send_slack",        label: "Send Slack",        icon: "💬", appId: "slack"        as const },
  { id: "add_sheet_row",     label: "Log to Sheets",     icon: "📊", appId: "sheets"       as const },
]

const STEP_TYPES = [
  {
    id: "trigger",
    label: "Trigger",
    desc: "Add another trigger",
    iconEl: <IconBolt className="size-4 text-red-500" />,
    iconBg: "bg-red-50 dark:bg-red-950/20",
  },
  {
    id: "action",
    label: "Action",
    desc: "Do something",
    iconEl: <IconPlayerPlay className="size-4 text-[#2563EB] fill-[#2563EB]" />,
    iconBg: "bg-blue-50 dark:bg-blue-950/20",
  },
  {
    id: "delay",
    label: "Delay",
    desc: "Wait before next step",
    iconEl: <IconClock className="size-4 text-violet-500" />,
    iconBg: "bg-violet-50 dark:bg-violet-950/20",
  },
  {
    id: "approval",
    label: "Approval",
    desc: "Require manual approval",
    iconEl: <IconShieldCheck className="size-4 text-amber-600" />,
    iconBg: "bg-amber-50 dark:bg-amber-950/20",
  },
]

function AddStepModal({ onAdd, onClose }: {
  onAdd: (choice: typeof ACTION_CHOICES[0]) => void
  onClose: () => void
}) {
  const [view, setView] = useState<"type" | "action">("type")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-[320px] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          {view === "action" ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView("type")}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                <IconArrowLeft className="size-3.5" />
              </button>
              <p className="text-sm font-semibold">Choose an action</p>
            </div>
          ) : (
            <p className="text-sm font-semibold">Add a step</p>
          )}
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <IconX className="size-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-2">
          {view === "type" ? (
            STEP_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => t.id === "action" ? setView("action") : onClose()}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left"
              >
                <div className={cn("size-8 rounded-lg flex items-center justify-center shrink-0", t.iconBg)}>
                  {t.iconEl}
                </div>
                <div>
                  <p className="text-[13px] font-medium leading-tight">{t.label}</p>
                  <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                </div>
              </button>
            ))
          ) : (
            ACTION_CHOICES.map(c => (
              <button
                key={c.id}
                onClick={() => { onAdd(c); onClose() }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left"
              >
                <span className="text-xl leading-none">{c.icon}</span>
                <span className="text-[13px] font-medium">{c.label}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

function TopBar({
  name, onNameChange, adAccountName, saving, saved,
  onSave, onRun, onPreview, onHistory,
}: {
  name: string
  onNameChange: (v: string) => void
  adAccountName?: string
  saving: boolean
  saved: boolean
  onSave: () => void
  onRun: () => void
  onPreview: () => void
  onHistory: () => void
}) {
  const router = useRouter()
  const [editingName, setEditingName] = useState(false)

  return (
    <div className="border-b border-border bg-background shrink-0 z-10">
      {/* Row 1: back + bolt icon + name + action buttons */}
      <div className="h-14 flex items-center gap-3 px-4">
        <button
          onClick={() => router.push("/automate")}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
        >
          <IconArrowLeft className="size-4" />
        </button>

        {/* Blue bolt badge */}
        <div className="size-9 rounded-xl bg-[#2563EB] flex items-center justify-center shrink-0 shadow-sm">
          <IconBolt className="size-5 text-white" />
        </div>

        {/* Editable name */}
        {editingName ? (
          <input
            autoFocus
            value={name}
            onChange={e => onNameChange(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={e => e.key === "Enter" && setEditingName(false)}
            className="text-[17px] font-semibold bg-transparent border-b-2 border-[#2563EB] outline-none min-w-0 flex-1 max-w-sm"
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="text-[17px] font-semibold text-foreground hover:text-[#2563EB] transition-colors truncate"
          >
            {name}
          </button>
        )}

        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg border border-border bg-background text-[13px] font-medium text-foreground/80 hover:bg-muted transition-colors disabled:opacity-50"
          >
            {saving ? <IconLoader2 className="size-3.5 animate-spin" /> :
             saved  ? <IconCheck className="size-3.5 text-emerald-500" /> :
                      <IconDeviceFloppy className="size-3.5" />}
            Save
          </button>
          <button
            onClick={onRun}
            className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-[#1D4ED8] transition-colors shadow-sm"
          >
            <IconPlayerPlay className="size-3.5 fill-white" />
            Run
          </button>
          <button onClick={onPreview} className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg border border-border bg-background text-[13px] font-medium text-foreground/80 hover:bg-muted transition-colors">
            <IconEye className="size-3.5" />
            Full preview
          </button>
          <button disabled className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg border border-border bg-background text-[13px] font-medium text-muted-foreground/50 cursor-not-allowed">
            <IconHistory className="size-3.5" />
            History
          </button>
          <button onClick={onHistory} className="size-8 rounded-lg border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <IconBell className="size-4" />
          </button>
          <button className="size-8 rounded-lg border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <IconDots className="size-4" />
          </button>
        </div>
      </div>

      {/* Row 2: Account selector */}
      <div className="px-4 pb-3">
        <button className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border/70 bg-[#F9FAFB] dark:bg-muted/40 text-[13px] font-medium text-foreground/80 hover:bg-muted transition-colors">
          <div className="size-5 rounded-full bg-[#1877F2] flex items-center justify-center shrink-0">
            <span className="text-[9px] font-black text-white">∞</span>
          </div>
          <span className="max-w-[220px] truncate">{adAccountName ?? "Select ad account"}</span>
          <IconChevronDown className="size-3.5 text-muted-foreground ml-1" />
        </button>
      </div>
    </div>
  )
}

// ─── Main builder ─────────────────────────────────────────────────────────────

interface Props {
  initialWorkflow?: Partial<Workflow>
  adAccountName?: string
}

export function WorkflowBuilder({ initialWorkflow, adAccountName }: Props) {
  const [name, setName] = useState(initialWorkflow?.name ?? "Untitled Zap")
  const [steps, setSteps] = useState<WorkflowStep[]>(
    initialWorkflow?.steps ?? [
      { id: "step-1", kind: "trigger", status: "incomplete" },
      { id: "step-2", kind: "action",  status: "incomplete" },
    ]
  )
  const [selectedId, setSelectedId] = useState<string | null>("step-1")
  const [addingAt,   setAddingAt]   = useState<number | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)

  const selectedStep = steps.find(s => s.id === selectedId) ?? null

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSelectStep = useCallback((id: string) => setSelectedId(id), [])

  const handleAddStep = useCallback((afterIndex: number) => setAddingAt(afterIndex), [])

  const handleAddChoice = useCallback((choice: typeof ACTION_CHOICES[0]) => {
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      kind: "action",
      status: "incomplete",
      actionConfig: {
        appId: choice.appId,
        event: choice.id as ActionConfig["event"],
        notification: choice.id === "send_notification" ? {
          via: "both",
          emailRecipients: [],
          customMessage: "{{trigger.summary}}\n{{trigger.entityName}}",
        } : undefined,
      },
    }
    setSteps(prev => {
      const next = [...prev]
      next.splice(addingAt ?? next.length, 0, newStep)
      return next
    })
    setSelectedId(newStep.id)
    setAddingAt(null)
  }, [addingAt])

  const handleUpdateTrigger = useCallback((stepId: string, config: TriggerConfig) => {
    setSteps(prev => prev.map(s => s.id === stepId
      ? { ...s, triggerConfig: config, status: "configured" }
      : s
    ))
  }, [])

  const handleUpdateAction = useCallback((stepId: string, config: ActionConfig) => {
    setSteps(prev => prev.map(s => s.id === stepId
      ? { ...s, actionConfig: config, status: "configured" }
      : s
    ))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          trigger_type: steps[0]?.triggerConfig?.event ?? "performance_monitoring",
          trigger_config: steps[0]?.triggerConfig ?? {},
          conditions: [],
          actions: steps.slice(1).map(s => s.actionConfig).filter(Boolean),
          ad_account_ids: [],
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* silent */ }
    finally { setSaving(false) }
  }, [name, steps])

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Top bar */}
      <TopBar
        name={name}
        onNameChange={setName}
        adAccountName={adAccountName}
        saving={saving}
        saved={saved}
        onSave={handleSave}
        onRun={() => {}}
        onPreview={() => {}}
        onHistory={() => {}}
      />

      {/* Canvas + right panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-hidden relative">
          {/* No-account warning */}
          {!adAccountName && (
            <div className="absolute top-4 left-4 z-10 bg-white dark:bg-card border border-border rounded-xl px-4 py-3 shadow-md max-w-[230px]">
              <p className="text-[12px] text-muted-foreground leading-5">
                No Meta ad accounts connected.<br />
                Please connect an account in{" "}
                <a href="/settings" className="text-primary hover:underline font-medium">Settings</a>.
              </p>
            </div>
          )}
          <WorkflowCanvas
            steps={steps}
            selectedStepId={selectedId}
            onSelectStep={handleSelectStep}
            onAddStep={handleAddStep}
            onAddFirst={() => setAddingAt(0)}
          />
        </div>

        {/* Right config panel */}
        {selectedStep && (
          <div className="w-[380px] shrink-0 border-l border-border bg-background overflow-hidden flex flex-col">
            {selectedStep.kind === "trigger" ? (
              <TriggerConfigPanel
                stepIndex={steps.indexOf(selectedStep) + 1}
                config={selectedStep.triggerConfig ?? defaultTrigger()}
                onChange={c => handleUpdateTrigger(selectedStep.id, c)}
                adAccountName={adAccountName}
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <ActionConfigPanel
                stepIndex={steps.indexOf(selectedStep) + 1}
                config={selectedStep.actionConfig ?? defaultAction()}
                onChange={c => handleUpdateAction(selectedStep.id, c)}
                onClose={() => setSelectedId(null)}
              />
            )}
          </div>
        )}
      </div>

      {/* Add step modal */}
      {addingAt !== null && (
        <AddStepModal
          onAdd={handleAddChoice}
          onClose={() => setAddingAt(null)}
        />
      )}
    </div>
  )
}
