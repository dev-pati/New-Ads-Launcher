"use client"

import { forwardRef, useImperativeHandle, useState, useRef } from "react"
import { cn } from "@/lib/utils"
import {
  IconBell, IconMail, IconBrandSlack, IconPlus, IconX,
  IconBrandMeta, IconBrandTiktok, IconBrandSnapchat,
  IconBrandPinterest, IconTable, IconCalendar,
} from "@tabler/icons-react"
import type { ActionConfig, NotificationConfig } from "@/lib/workflow-types"
import { TRIGGER_VARIABLES, SYSTEM_VARIABLES } from "@/lib/workflow-types"

// ─── Action metadata map ──────────────────────────────────────────────────────

type AppId = ActionConfig["appId"]

const APP_META: Record<string, {
  label: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
}> = {
  notification: { label: "Notification",  icon: IconBell,           iconBg: "bg-amber-100 dark:bg-amber-950/40",  iconColor: "text-amber-500"  },
  meta:         { label: "Meta",          icon: IconBrandMeta,      iconBg: "bg-blue-100 dark:bg-blue-950/40",   iconColor: "text-blue-600 dark:text-blue-400"   },
  tiktok:       { label: "TikTok",        icon: IconBrandTiktok,    iconBg: "bg-zinc-100 dark:bg-zinc-800",      iconColor: "text-zinc-800 dark:text-zinc-200"   },
  snapchat:     { label: "Snapchat",      icon: IconBrandSnapchat,  iconBg: "bg-yellow-100 dark:bg-yellow-950/40", iconColor: "text-yellow-600" },
  pinterest:    { label: "Pinterest",     icon: IconBrandPinterest, iconBg: "bg-red-100 dark:bg-red-950/40",     iconColor: "text-red-600 dark:text-red-400"     },
  slack:        { label: "Slack",         icon: IconBrandSlack,     iconBg: "bg-purple-100 dark:bg-purple-950/40", iconColor: "text-purple-600" },
  sheets:       { label: "Sheets",        icon: IconTable,          iconBg: "bg-green-100 dark:bg-green-950/40", iconColor: "text-green-700 dark:text-green-400" },
  schedule:     { label: "Schedule",      icon: IconCalendar,       iconBg: "bg-indigo-100 dark:bg-indigo-950/40", iconColor: "text-indigo-600" },
}

const EVENT_LABELS: Partial<Record<string, string>> = {
  send_notification: "Send Notification",
  duplicate_ad:      "Duplicate Ad",
  increase_budget:   "Increase Budget",
  pause_adset:       "Pause Ad Set",
  launch_tiktok:     "Launch on TikTok",
  launch_snapchat:   "Launch on Snapchat",
  launch_pinterest:  "Launch on Pinterest",
  send_slack:        "Send Slack",
  add_sheet_row:     "Log to Sheets",
  schedule:          "Schedule",
}

function getActionMeta(config: ActionConfig) {
  const app   = APP_META[config.appId] ?? APP_META["notification"]
  const label = EVENT_LABELS[config.event] ?? config.event?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) ?? "Action"
  return { ...app, label }
}

// ─── Variable chip ────────────────────────────────────────────────────────────

function VarChip({ token, onInsert }: { token: { key: string; label: string }; onInsert: (key: string) => void }) {
  return (
    <button
      onClick={() => onInsert(`{{${token.key}}}`)}
      className="flex items-center gap-1 h-6 px-2 rounded-full bg-muted hover:bg-primary/10 hover:text-primary border border-border/50 text-[10px] font-medium text-muted-foreground transition-colors"
    >
      <IconPlus className="size-2.5" />
      {token.label}
    </button>
  )
}

// ─── Email tag input (forwardRef) ─────────────────────────────────────────────

export interface EmailTagInputHandle { commit: () => void }

interface EmailTagInputProps { recipients: string[]; onChange: (r: string[]) => void }

const EmailTagInput = forwardRef<EmailTagInputHandle, EmailTagInputProps>(
  function EmailTagInput({ recipients, onChange }, ref) {
    const [draft, setDraft] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)

    function commit() {
      const email = draft.trim()
      if (!email || !email.includes("@")) return
      onChange([...recipients, email])
      setDraft("")
    }

    function remove(i: number) { onChange(recipients.filter((_, j) => j !== i)) }

    useImperativeHandle(ref, () => ({ commit }))

    return (
      <div className="flex items-start gap-2">
        <div
          onClick={() => inputRef.current?.focus()}
          className="flex-1 min-h-9 flex flex-wrap gap-1.5 px-3 py-2 bg-muted/40 border border-border/60 rounded-lg cursor-text"
        >
          {recipients.map((r, i) => (
            <span key={i} className="flex items-center gap-1 h-5 px-2 rounded-full bg-primary/10 text-primary text-[11px] font-medium">
              {r}
              <button onClick={e => { e.stopPropagation(); remove(i) }} className="hover:text-destructive transition-colors">
                <IconX className="size-2.5" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="email"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit() }
              if (e.key === "Backspace" && !draft && recipients.length) remove(recipients.length - 1)
            }}
            onBlur={commit}
            placeholder={recipients.length === 0 ? "Enter email and press Enter or click Add" : ""}
            className="flex-1 min-w-[140px] bg-transparent outline-none text-[12px] placeholder:text-muted-foreground/50"
          />
        </div>
        <button
          onClick={commit}
          className="h-9 px-3 rounded-lg border border-border/60 bg-muted/40 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
        >
          + Add
        </button>
      </div>
    )
  }
)

// ─── Notification setup form ──────────────────────────────────────────────────

function NotificationSetup({ config, onChange }: { config: ActionConfig; onChange: (c: ActionConfig) => void }) {
  const notif: NotificationConfig = config.notification ?? { via: "both", emailRecipients: [], customMessage: "{{trigger.summary}}\n{{trigger.entityName}}" }
  const textareaRef   = useRef<HTMLTextAreaElement>(null)
  const emailInputRef = useRef<EmailTagInputHandle>(null)

  function updateNotif(n: Partial<NotificationConfig>) {
    onChange({ ...config, notification: { ...notif, ...n } })
  }

  function insertVariable(token: string) {
    const ta = textareaRef.current
    if (!ta) { updateNotif({ customMessage: (notif.customMessage ?? "") + token }); return }
    const start = ta.selectionStart, end = ta.selectionEnd
    const msg   = notif.customMessage ?? ""
    updateNotif({ customMessage: msg.slice(0, start) + token + msg.slice(end) })
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + token.length; ta.focus() }, 0)
  }

  const showEmail = notif.via === "email" || notif.via === "both"
  const showSlack = notif.via === "slack" || notif.via === "both"

  return (
    <div className="space-y-5 p-5">
      {/* APP */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">App</label>
        <div className="flex items-center justify-between h-9 px-3 bg-muted/40 border border-border/60 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="size-5 rounded bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
              <IconBell className="size-3 text-amber-500" />
            </div>
            <span className="text-sm font-medium">Notification</span>
          </div>
          <button className="text-[11px] text-primary hover:underline font-medium">Change</button>
        </div>
      </div>

      {/* SEND VIA */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Send Via</label>
        <div className="flex items-center gap-1.5 p-1 bg-muted/40 border border-border/60 rounded-xl">
          {(["email", "slack", "both"] as const).map(v => (
            <button
              key={v}
              onClick={() => updateNotif({ via: v })}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 h-7 rounded-lg text-[12px] font-medium transition-colors",
                notif.via === v
                  ? "bg-background text-foreground shadow-sm border border-border/40"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v === "email" && <IconMail className="size-3.5" />}
              {v === "slack" && <IconBrandSlack className="size-3.5" />}
              {v === "both"  && <><IconMail className="size-3" /><span className="text-[10px]">+</span><IconBrandSlack className="size-3" /></>}
              {v === "email" ? "Email" : v === "slack" ? "Slack" : "Both"}
            </button>
          ))}
        </div>
      </div>

      {/* EMAIL RECIPIENTS */}
      {showEmail && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Email Recipients</label>
          <EmailTagInput ref={emailInputRef} recipients={notif.emailRecipients ?? []} onChange={r => updateNotif({ emailRecipients: r })} />
          {(notif.emailRecipients ?? []).length === 0 && (
            <p className="text-[11px] text-muted-foreground/60">No recipients added yet. Type an email address and press Enter or click Add.</p>
          )}
        </div>
      )}

      {/* SLACK CHANNEL */}
      {showSlack && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Slack Channel</label>
          <div className="flex items-center h-9 px-3 bg-muted/40 border border-border/60 rounded-lg">
            <span className="text-[12px] text-muted-foreground"># your org default</span>
          </div>
        </div>
      )}

      {/* CUSTOM MESSAGE */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Custom Message (Optional)</label>
        <textarea
          ref={textareaRef}
          value={notif.customMessage ?? ""}
          onChange={e => updateNotif({ customMessage: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 text-[13px] bg-muted/40 border border-border/60 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
        />
      </div>

      {/* AVAILABLE VARIABLES */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Available variables <span className="normal-case font-normal text-muted-foreground/50">(click to insert)</span>
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Trigger</p>
            <div className="flex flex-wrap gap-1.5">
              {TRIGGER_VARIABLES.map(v => <VarChip key={v.key} token={v} onInsert={insertVariable} />)}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">System</p>
            <div className="flex flex-wrap gap-1.5">
              {SYSTEM_VARIABLES.map(v => <VarChip key={v.key} token={v} onInsert={insertVariable} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Generic action setup (non-notification) ──────────────────────────────────

function GenericSetup({ config }: { config: ActionConfig }) {
  const meta = getActionMeta(config)
  const AppIcon = meta.icon

  return (
    <div className="p-5 space-y-5">
      {/* APP */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">App</label>
        <div className="flex items-center justify-between h-9 px-3 bg-muted/40 border border-border/60 rounded-lg">
          <div className="flex items-center gap-2">
            <div className={cn("size-5 rounded flex items-center justify-center shrink-0", meta.iconBg)}>
              <AppIcon className={cn("size-3", meta.iconColor)} />
            </div>
            <span className="text-sm font-medium">{meta.label}</span>
          </div>
          <button className="text-[11px] text-primary hover:underline font-medium">Change</button>
        </div>
      </div>

      {/* Configured notice */}
      <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl">
        <div className="size-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
          <AppIcon className={cn("size-4", meta.iconColor)} />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-foreground">{meta.label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Action is configured and ready to run.</p>
        </div>
      </div>
    </div>
  )
}

// ─── Setup tab dispatcher ─────────────────────────────────────────────────────

function SetupTab({ config, onChange }: { config: ActionConfig; onChange: (c: ActionConfig) => void }) {
  if (config.appId === "notification") {
    return <NotificationSetup config={config} onChange={onChange} />
  }
  return <GenericSetup config={config} />
}

// ─── Preview tab ──────────────────────────────────────────────────────────────

function PreviewTab({ config }: { config: ActionConfig }) {
  const notif = config.notification
  const msg   = notif?.customMessage ??
    "{{trigger.summary}}\n{{trigger.entityName}}: {{trigger.previousValue}} → {{trigger.currentValue}} ({{trigger.actualChange}}% change)"
  const recipientCount = notif?.emailRecipients?.length ?? 0
  const meta = getActionMeta(config)

  if (config.appId !== "notification") {
    return (
      <div className="p-5">
        <p className="text-[13px] font-medium text-foreground">{meta.label}</p>
        <p className="text-[11px] text-muted-foreground mt-1">This action will execute when the trigger fires.</p>
      </div>
    )
  }

  return (
    <div className="p-5 space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">Sends</p>
        <p className="text-[12px] font-medium text-foreground">Notification · Send Notification</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
            {notif?.via === "email" ? "Email only" : notif?.via === "slack" ? "Slack only" : "Email + Slack"}
            &middot; {recipientCount === 0 ? "no recipients" : `${recipientCount} recipient(s)`}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">What will get sent</p>
        <button className="w-full h-9 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
          Dry-run this notification
        </button>
      </div>

      {(!notif || notif.via === "email" || notif.via === "both") && (
        <div className="border border-border/60 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-muted/30 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <IconMail className="size-3.5" />EMAIL
            </div>
            <span className="text-[10px] text-muted-foreground/60">{recipientCount === 0 ? "No recipients" : `${recipientCount} recipient(s)`}</span>
          </div>
          <div className="p-3">
            <div className="flex items-start gap-2">
              <div className="size-6 rounded-full bg-primary flex items-center justify-center text-[9px] font-bold text-primary-foreground shrink-0">AM</div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium">Notification: Performance Monitoring</p>
                <p className="text-[10px] text-muted-foreground">to {recipientCount > 0 ? notif?.emailRecipients?.[0] : "you@example.com"}{recipientCount > 1 && ` +${recipientCount - 1} more`}</p>
                <div className="mt-2 bg-muted/40 rounded-lg p-2">
                  <p className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed break-all">{msg}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {(!notif || notif.via === "slack" || notif.via === "both") && (
        <div className="border border-border/60 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-muted/30 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <IconBrandSlack className="size-3.5" />SLACK
            </div>
            <span className="text-[10px] text-muted-foreground/60">{notif?.slackChannel ?? "# your org default"}</span>
          </div>
          <div className="p-3">
            <div className="flex items-start gap-2">
              <div className="size-6 rounded bg-primary flex items-center justify-center text-[9px] font-bold text-primary-foreground shrink-0">AM</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold">AdLauncher</span>
                  <span className="text-[9px] text-muted-foreground bg-muted px-1 py-0.5 rounded font-medium">APP</span>
                </div>
                <div className="mt-1.5 bg-muted/40 rounded-lg p-2">
                  <p className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed break-all">{msg}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  stepIndex: number
  config: ActionConfig
  onChange: (c: ActionConfig) => void
  onClose?: () => void
}

export function ActionConfigPanel({ stepIndex, config, onChange, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"setup" | "preview">("setup")
  const meta    = getActionMeta(config)
  const AppIcon = meta.icon

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Panel header — dynamic */}
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("size-9 rounded-xl flex items-center justify-center shrink-0", meta.iconBg)}>
            <AppIcon className={cn("size-5", meta.iconColor)} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground leading-tight truncate">
              {stepIndex}. {meta.label}
            </p>
            <p className="text-[11px] text-muted-foreground/70 leading-tight mt-0.5">
              What happens when it fires?
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
          >
            <IconX className="size-4" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border shrink-0">
        {(["setup", "preview"] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              "flex-1 py-2.5 text-[13px] font-medium transition-colors capitalize",
              activeTab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "setup"
          ? <SetupTab config={config} onChange={onChange} />
          : <PreviewTab config={config} />
        }
      </div>

      {/* Footer */}
      {activeTab === "setup" && (
        <div className="p-4 border-t border-border shrink-0">
          <button
            onClick={() => setActiveTab("preview")}
            className="w-full h-9 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Preview →
          </button>
        </div>
      )}
    </div>
  )
}
