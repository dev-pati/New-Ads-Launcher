"use client"

import { useState, useRef } from "react"
import { cn } from "@/lib/utils"
import { IconMail, IconBrandSlack, IconPlus, IconX } from "@tabler/icons-react"
import type { ActionConfig, NotificationConfig } from "@/lib/workflow-types"
import { TRIGGER_VARIABLES, SYSTEM_VARIABLES } from "@/lib/workflow-types"

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

// ─── Email tag input ──────────────────────────────────────────────────────────

function EmailTagInput({ recipients, onChange }: {
  recipients: string[]
  onChange: (r: string[]) => void
}) {
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  function commit() {
    const email = draft.trim()
    if (!email || !email.includes("@")) return
    onChange([...recipients, email])
    setDraft("")
  }

  function remove(i: number) {
    onChange(recipients.filter((_, j) => j !== i))
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="min-h-9 w-full flex flex-wrap gap-1.5 px-3 py-2 bg-muted/40 border border-border/60 rounded-lg cursor-text"
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
  )
}

// ─── Setup tab ────────────────────────────────────────────────────────────────

function SetupTab({ config, onChange }: {
  config: ActionConfig
  onChange: (c: ActionConfig) => void
}) {
  const notif = config.notification ?? { via: "both", emailRecipients: [], customMessage: "{{trigger.summary}}\n{{trigger.entityName}}" }
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function updateNotif(n: Partial<NotificationConfig>) {
    onChange({ ...config, notification: { ...notif, ...n } })
  }

  function insertVariable(token: string) {
    const ta = textareaRef.current
    if (!ta) {
      updateNotif({ customMessage: (notif.customMessage ?? "") + token })
      return
    }
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const msg   = notif.customMessage ?? ""
    const next  = msg.slice(0, start) + token + msg.slice(end)
    updateNotif({ customMessage: next })
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + token.length
      ta.focus()
    }, 0)
  }

  return (
    <div className="space-y-5 p-5">
      {/* App */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">App</label>
        <div className="flex items-center justify-between h-9 px-3 bg-muted/40 border border-border/60 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="size-5 rounded bg-amber-400 flex items-center justify-center">
              <span className="text-[10px]">🔔</span>
            </div>
            <span className="text-sm font-medium">Notification</span>
          </div>
          <button className="text-[11px] text-primary hover:underline">Change</button>
        </div>
      </div>

      {/* Send via */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Send Via</label>
        <div className="flex items-center gap-2 p-1 bg-muted/40 border border-border/60 rounded-xl">
          {(["email", "slack", "both"] as const).map(v => (
            <button
              key={v}
              onClick={() => updateNotif({ via: v })}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 h-7 rounded-lg text-[12px] font-medium transition-colors capitalize",
                notif.via === v
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v === "email" && <IconMail className="size-3.5" />}
              {v === "slack" && <IconBrandSlack className="size-3.5" />}
              {v === "both"  && <><IconMail className="size-3" /><span>+</span><IconBrandSlack className="size-3" /></>}
              {v === "email" ? "Email" : v === "slack" ? "Slack" : "Both"}
            </button>
          ))}
        </div>
      </div>

      {/* Email recipients */}
      {(notif.via === "email" || notif.via === "both") && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Email Recipients</label>
          <EmailTagInput
            recipients={notif.emailRecipients ?? []}
            onChange={r => updateNotif({ emailRecipients: r })}
          />
          {(notif.emailRecipients ?? []).length === 0 && (
            <p className="text-[11px] text-muted-foreground/60">No recipients added yet. Type an email address and press Enter or click Add.</p>
          )}
        </div>
      )}

      {/* Slack channel */}
      {(notif.via === "slack" || notif.via === "both") && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Slack Channel</label>
          <div className="flex items-center justify-between h-9 px-3 bg-muted/40 border border-border/60 rounded-lg">
            <span className="text-[12px] text-muted-foreground"># your org default</span>
          </div>
        </div>
      )}

      {/* Custom message */}
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

      {/* Variables */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Available variables (click to insert)</p>
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Trigger</p>
          <div className="flex flex-wrap gap-1.5">
            {TRIGGER_VARIABLES.map(v => (
              <VarChip key={v.key} token={v} onInsert={insertVariable} />
            ))}
          </div>
          <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mt-2">System</p>
          <div className="flex flex-wrap gap-1.5">
            {SYSTEM_VARIABLES.map(v => (
              <VarChip key={v.key} token={v} onInsert={insertVariable} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Preview tab ──────────────────────────────────────────────────────────────

function PreviewTab({ config }: { config: ActionConfig }) {
  const notif = config.notification
  const msg = notif?.customMessage ?? "{{trigger.summary}}\n{{trigger.entityName}}: {{trigger.previousValue}} → {{trigger.currentValue}} ({{trigger.actualChange}}% change)"

  return (
    <div className="p-5 space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">2. Sends</p>
        <p className="text-[12px] font-medium text-foreground">Notification · Send Notification</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
            {notif?.via === "email" ? "Email only" : notif?.via === "slack" ? "Slack only" : "Email + Slack"} · {(notif?.emailRecipients ?? []).length === 0 ? "no recipients" : `${notif?.emailRecipients?.length} recipient(s)`}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">What will get sent</p>

        <button className="w-full h-9 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
          🔄 Dry-run this notification
        </button>
      </div>

      {/* Email preview */}
      {(notif?.via === "email" || notif?.via === "both" || !notif) && (
        <div className="border border-border/60 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-muted/30 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <IconMail className="size-3.5" />
              EMAIL
            </div>
            <span className="text-[10px] text-muted-foreground/60">No recipients</span>
          </div>
          <div className="p-3 space-y-2">
            <div className="flex items-start gap-2">
              <div className="size-6 rounded-full bg-primary flex items-center justify-center text-[9px] font-bold text-primary-foreground shrink-0">AM</div>
              <div>
                <p className="text-[11px] font-medium">Notification: Performance Monitoring</p>
                <p className="text-[10px] text-muted-foreground">to you@example.com</p>
                <div className="mt-2 bg-muted/40 rounded-lg p-2">
                  <p className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">{msg}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slack preview */}
      {(notif?.via === "slack" || notif?.via === "both" || !notif) && (
        <div className="border border-border/60 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-muted/30 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <IconBrandSlack className="size-3.5" />
              SLACK
            </div>
            <span className="text-[10px] text-muted-foreground/60"># your org default</span>
          </div>
          <div className="p-3 space-y-2">
            <div className="flex items-start gap-2">
              <div className="size-6 rounded bg-primary flex items-center justify-center text-[9px] font-bold text-primary-foreground shrink-0">AM</div>
              <div>
                <span className="text-[11px] font-semibold">AdLauncher</span>
                <span className="text-[10px] text-muted-foreground ml-1">APP</span>
                <div className="mt-1.5 bg-muted/40 rounded-lg p-2">
                  <p className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">{msg}</p>
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
}

export function ActionConfigPanel({ stepIndex, config, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<"setup" | "preview">("setup")

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Panel header */}
      <div className="px-5 py-4 border-b border-border shrink-0">
        <p className="text-[11px] text-muted-foreground font-medium mb-0.5">
          {stepIndex}. Send Notification
        </p>
        <p className="text-[12px] text-muted-foreground/60">What happens when it fires?</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border shrink-0">
        {(["setup", "preview"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={cn(
              "flex-1 py-2.5 text-[13px] font-medium transition-colors capitalize",
              activeTab === t
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}>
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
        <div className="p-5 border-t border-border shrink-0">
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
