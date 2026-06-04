"use client"

import { forwardRef, useImperativeHandle, useState, useRef, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import {
  IconBell, IconMail, IconBrandSlack, IconPlus, IconX,
  IconBrandMeta, IconBrandTiktok, IconBrandSnapchat,
  IconBrandPinterest, IconTable, IconCalendar, IconChevronDown,
  IconLoader2, IconPhoto,
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
  manual:       { label: "Manual Trigger",icon: IconCalendar,       iconBg: "bg-blue-100 dark:bg-blue-950/40",    iconColor: "text-blue-600" },
}

const EVENT_LABELS: Partial<Record<string, string>> = {
  send_notification:        "Send Notification",
  // Meta pause
  pause_ad:                 "Pause Ad",
  pause_campaign:           "Pause Campaign",
  pause_adset:              "Pause Ad Set",
  // Meta enable
  enable_ad:                "Enable Ad",
  enable_campaign:          "Enable Campaign",
  enable_adset:             "Enable Ad Set",
  // Meta duplicate
  duplicate_ad:             "Duplicate Ad",
  duplicate_adset:          "Duplicate Ad Set",
  duplicate_campaign:       "Duplicate Campaign",
  // Meta budget
  increase_budget:          "Increase Budget",
  decrease_budget:          "Decrease Budget",
  change_budget:            "Change Budget",
  // Meta rules & creative
  swap_creative:            "Swap Creative from Shortlist",
  create_rule:              "Create Rule",
  toggle_rule:              "Toggle Rule",
  update_rule:              "Update Rule",
  apply_existing_rule:      "Apply Existing Rule",
  set_minimum_spend:        "Set Minimum Spend",
  // Meta launch
  launch_ad:                "Launch Ad",
  // Social
  launch_tiktok:            "Launch on TikTok",
  launch_snapchat:          "Launch on Snapchat",
  launch_pinterest:         "Launch on Pinterest",
  send_slack:               "Send Slack",
  // Sheets
  add_sheet_row:            "Add Row",
  update_sheet_cell:        "Update Cell",
  update_sheet_row:         "Update Row",
  // Media
  upload_to_media_library:  "Upload to Media Library",
  schedule:                 "Schedule",
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

      {/* SLACK WEBHOOK */}
      {showSlack && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Slack Webhook URL</label>
          <input
            type="url"
            value={(notif as any).slackWebhookUrl ?? ""}
            onChange={e => updateNotif({ ...(notif as any), slackWebhookUrl: e.target.value })}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full px-3 py-2 text-[13px] bg-muted/40 border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-[11px] text-muted-foreground/60">Tạo Incoming Webhook tại api.slack.com/apps</p>
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

// ─── SelectField helper ───────────────────────────────────────────────────────

function SelectField({ label, value, options, onChange, required, description }: {
  label: string; value: string; options: { value: string; label: string }[]
  onChange: (v: string) => void; required?: boolean; description?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[12px] font-semibold text-foreground/80">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground">
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
      </div>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
    </div>
  )
}

// ─── Meta Action Setup ────────────────────────────────────────────────────────

const META_PAUSE_ENABLE_EVENTS = ["pause_ad","pause_campaign","pause_adset","enable_ad","enable_campaign","enable_adset"]
const META_DUPLICATE_EVENTS    = ["duplicate_ad","duplicate_adset","duplicate_campaign"]
const META_BUDGET_EVENTS       = ["increase_budget","decrease_budget","change_budget"]
const META_TARGET_EVENTS       = ["swap_creative","create_rule","toggle_rule","update_rule","apply_existing_rule","set_minimum_spend"]
const ALL_META_EVENTS          = [...META_PAUSE_ENABLE_EVENTS, ...META_DUPLICATE_EVENTS, ...META_BUDGET_EVENTS, ...META_TARGET_EVENTS, "launch_ad"]

// Helper: trigger variable chips
const TRIGGER_VARS = [
  { key: "{{trigger.qualifyingAdIds}}",       label: "Ad IDs from trigger" },
  { key: "{{trigger.qualifyingAdSetIds}}",    label: "Ad Set IDs from trigger" },
  { key: "{{trigger.qualifyingCampaignIds}}", label: "Campaign IDs from trigger" },
]
const NAME_TEMPLATE_VARS = ["{{original_name}}", "{{date}}", "{{adset_name}}", "{{campaign_name}}"]

// ─── AdSetPicker — hierarchical ad account → campaign → adset picker ──────────
function AdSetPicker({ label, selectedIds, onChange, level = "adset" }: {
  label: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
  level?: "adset" | "campaign" | "ad"
}) {
  const [accounts,  setAccounts]  = useState<{ id: string; name: string }[]>([])
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; accountId: string }[]>([])
  const [adsets,    setAdsets]    = useState<{ id: string; name: string; campaignId: string }[]>([])
  const [selAccount,  setSelAccount]  = useState("")
  const [selCampaign, setSelCampaign] = useState("")
  const [loadingCamp, setLoadingCamp] = useState(false)
  const [loadingAdset, setLoadingAdset] = useState(false)

  // Load ad accounts
  useEffect(() => {
    fetch("/api/facebook/ad-accounts")
      .then(r => r.json())
      .then(d => setAccounts((d.adAccounts ?? d.accounts ?? []).map((a: any) => ({ id: a.id ?? a.fb_ad_account_id, name: a.name ?? a.fb_ad_account_id }))))
      .catch(() => {})
  }, [])

  // Load campaigns when account selected
  const loadCampaigns = useCallback(async (accountId: string) => {
    if (!accountId) return
    setLoadingCamp(true)
    try {
      const res  = await fetch(`/api/facebook/campaigns?adAccountId=${encodeURIComponent(accountId)}`)
      const data = await res.json()
      setCampaigns((data.campaigns ?? data.data ?? []).map((c: any) => ({ id: c.id, name: c.name, accountId })))
      setAdsets([])
      setSelCampaign("")
    } finally { setLoadingCamp(false) }
  }, [])

  // Load adsets when campaign selected
  const loadAdsets = useCallback(async (campaignId: string) => {
    if (!campaignId) return
    setLoadingAdset(true)
    try {
      const res  = await fetch(`/api/facebook/adsets?campaignId=${encodeURIComponent(campaignId)}`)
      const data = await res.json()
      setAdsets((data.adsets ?? data.data ?? []).map((a: any) => ({ id: a.id, name: a.name, campaignId })))
    } finally { setLoadingAdset(false) }
  }, [])

  const items = level === "campaign" ? campaigns : level === "ad" ? [] : adsets

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</label>

      {/* Ad Account selector */}
      <select
        value={selAccount}
        onChange={e => { setSelAccount(e.target.value); loadCampaigns(e.target.value) }}
        className="w-full h-8 px-2 text-[12px] bg-muted/40 border border-border/60 rounded-lg"
      >
        <option value="">— Select Ad Account —</option>
        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>

      {/* Campaign selector */}
      {selAccount && (
        <select
          value={selCampaign}
          onChange={e => { setSelCampaign(e.target.value); if (level !== "campaign") loadAdsets(e.target.value) }}
          className="w-full h-8 px-2 text-[12px] bg-muted/40 border border-border/60 rounded-lg"
          disabled={loadingCamp}
        >
          <option value="">{loadingCamp ? "Loading campaigns..." : "— Select Campaign —"}</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}

      {/* Adset list with checkboxes */}
      {level !== "campaign" && selCampaign && (
        <div className="border border-border/60 rounded-lg max-h-40 overflow-y-auto bg-muted/20">
          {loadingAdset ? (
            <div className="px-3 py-2 text-[12px] text-muted-foreground">Loading ad sets...</div>
          ) : adsets.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-muted-foreground">No ad sets found</div>
          ) : adsets.map(a => (
            <label key={a.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.includes(a.id)}
                onChange={e => {
                  if (e.target.checked) onChange([...selectedIds, a.id])
                  else onChange(selectedIds.filter(id => id !== a.id))
                }}
                className="rounded"
              />
              <span className="text-[12px] truncate">{a.name}</span>
              <span className="text-[10px] text-muted-foreground/50 ml-auto shrink-0">{a.id}</span>
            </label>
          ))}
        </div>
      )}

      {/* Selected summary */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedIds.map(id => {
            const name = [...accounts, ...campaigns, ...adsets].find(x => x.id === id)?.name ?? id
            return (
              <span key={id} className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                {name.length > 20 ? name.slice(0, 18) + "…" : name}
                <button onClick={() => onChange(selectedIds.filter(x => x !== id))} className="hover:text-destructive">×</button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TriggerVarInput({ label, value, onChange, placeholder, description, vars = TRIGGER_VARS }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; description?: string
  vars?: { key: string; label: string }[]
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[12px] font-semibold text-foreground/80">{label} <span className="text-red-500">*</span></label>
      <input type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "Use data pill from trigger..."}
        className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono placeholder:text-muted-foreground/50 placeholder:font-sans"
      />
      <div className="flex flex-wrap gap-1">
        {vars.map(v => (
          <button key={v.key} type="button"
            onClick={() => onChange(v.key)}
            className="h-5 px-2 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[10px] font-medium transition-colors">
            {v.key}
          </button>
        ))}
      </div>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
    </div>
  )
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-foreground/80">{label}</p>
        {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={cn("relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/30")}>
        <span className={cn("pointer-events-none inline-block size-4 rounded-full bg-white shadow transform transition-transform duration-200",
          checked ? "translate-x-4" : "translate-x-0")} />
      </button>
    </div>
  )
}

function MetaActionSetup({ config, onChange, triggerAppId }: { config: ActionConfig; onChange: (c: ActionConfig) => void; triggerAppId?: string }) {
  const ev = config.event
  const isPauseEnable = META_PAUSE_ENABLE_EVENTS.includes(ev)
  const isDuplicate   = META_DUPLICATE_EVENTS.includes(ev)
  const isBudget      = META_BUDGET_EVENTS.includes(ev)

  // Only Meta metric threshold trigger provides qualifying entity IDs automatically
  const triggerHasNoIds = triggerAppId !== "meta"

  // Which trigger variable to suggest based on action level
  const triggerVar =
    ev.includes("campaign") ? "{{trigger.qualifyingCampaignIds}}" :
    ev.includes("adset")    ? "{{trigger.qualifyingAdSetIds}}" :
                              "{{trigger.qualifyingAdIds}}"

  const targetLabel =
    ev.includes("campaign") ? "Campaigns" :
    ev.includes("adset")    ? "Ad Sets" : "Ads"

  const pickerLevel = ev.includes("campaign") ? "campaign" as const : ev.includes("ad") && !ev.includes("adset") ? "ad" as const : "adset" as const

  return (
    <div className="p-5 space-y-4">
      {/* Action Event selector */}
      <SelectField
        label="Action Event" value={ev} required
        options={[
          { value: "pause_ad",           label: "Pause Ad" },
          { value: "pause_campaign",     label: "Pause Campaign" },
          { value: "pause_adset",        label: "Pause Ad Set" },
          { value: "enable_ad",          label: "Enable Ad" },
          { value: "enable_campaign",    label: "Enable Campaign" },
          { value: "enable_adset",       label: "Enable Ad Set" },
          { value: "duplicate_ad",       label: "Duplicate Ad" },
          { value: "duplicate_adset",    label: "Duplicate Ad Set" },
          { value: "duplicate_campaign", label: "Duplicate Campaign" },
          { value: "increase_budget",    label: "Increase Budget" },
          { value: "decrease_budget",    label: "Decrease Budget" },
          { value: "change_budget",      label: "Change Budget" },
          { value: "swap_creative",      label: "Swap Creative from Shortlist" },
          { value: "create_rule",        label: "Create Rule" },
          { value: "toggle_rule",        label: "Toggle Rule" },
          { value: "update_rule",        label: "Update Rule" },
          { value: "apply_existing_rule",label: "Apply Existing Rule" },
          { value: "set_minimum_spend",  label: "Set Minimum Spend" },
          { value: "launch_ad",          label: "Launch Ad" },
        ]}
        onChange={v => onChange({ ...config, event: v as ActionConfig["event"], actionTargetExpression: undefined })}
      />

      <div className="pt-1 border-t border-border/60 space-y-4">

        {/* ── Pause / Enable ─────────────────────────────────────────── */}
        {isPauseEnable && (
          triggerHasNoIds ? (
            <AdSetPicker
              label={`${targetLabel} to ${ev.startsWith("pause") ? "Pause" : "Enable"}`}
              selectedIds={config.targetIds ?? []}
              onChange={ids => onChange({ ...config, targetIds: ids, actionTargetExpression: ids.join(",") })}
              level={pickerLevel}
            />
          ) : (
            <TriggerVarInput
              label={`${targetLabel} to ${ev.startsWith("pause") ? "Pause" : "Enable"}`}
              value={config.actionTargetExpression ?? triggerVar}
              onChange={v => onChange({ ...config, actionTargetExpression: v })}
              vars={[{ key: triggerVar, label: `IDs from trigger` }]}
              description={`Use ${triggerVar} to pass entities from the trigger. Or enter specific comma-separated IDs.`}
            />
          )
        )}

        {/* ── Duplicate Ad ─────────────────────────────────────────── */}
        {ev === "duplicate_ad" && (
          <>
            <TriggerVarInput
              label="Source Ads"
              value={config.actionTargetExpression ?? "{{trigger.qualifyingAdIds}}"}
              onChange={v => onChange({ ...config, actionTargetExpression: v })}
              vars={[{ key: "{{trigger.qualifyingAdIds}}", label: "Ads from trigger" }]}
              description="Use {{trigger.qualifyingAdIds}} to duplicate ads from the Performance Threshold trigger"
            />

            <SelectField
              label="Target Ad Sets" value={config.targetFilter ?? "all"}
              options={[
                { value: "all",           label: "Same ad set as original" },
                { value: "name_contains", label: "Ad set name contains..." },
                { value: "specific",      label: "Specific ad set IDs" },
              ]}
              onChange={v => onChange({ ...config, targetFilter: v as any })}
              description="Where to place the duplicated ads"
            />

            {config.targetFilter === "name_contains" && (
              <input type="text" placeholder="e.g., US || Broad"
                value={config.targetFilterValue ?? ""}
                onChange={e => onChange({ ...config, targetFilterValue: e.target.value })}
                className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
              />
            )}
            {config.targetFilter === "specific" && (
              <textarea placeholder="One ad set ID per line"
                value={(config.duplicateTargetAdsets ?? []).join("\n")}
                onChange={e => onChange({ ...config, duplicateTargetAdsets: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })}
                rows={2}
                className="w-full px-3 py-2 text-[12px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono resize-none"
              />
            )}

            <SelectField
              label="Duplicated Ad Status" value={config.duplicateStatus ?? "ACTIVE"}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "PAUSED", label: "Paused" },
              ]}
              onChange={v => onChange({ ...config, duplicateStatus: v as any })}
              description="Status of the newly created duplicate ads"
            />

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">New Name (optional)</label>
              <input type="text" placeholder="e.g. {{original_name}}_{{date}}"
                value={config.duplicateNameTemplate ?? ""}
                onChange={e => onChange({ ...config, duplicateNameTemplate: e.target.value })}
                className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono placeholder:text-muted-foreground/50 placeholder:font-sans"
              />
              <div className="flex flex-wrap gap-1">
                {NAME_TEMPLATE_VARS.map(v => (
                  <button key={v} type="button"
                    onClick={() => onChange({ ...config, duplicateNameTemplate: (config.duplicateNameTemplate ?? "") + v })}
                    className="h-5 px-2 rounded-full bg-muted hover:bg-primary/10 hover:text-primary border border-border/50 text-[10px] font-medium text-muted-foreground transition-colors">
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <Toggle
                checked={config.duplicatePauseOriginal ?? false}
                onChange={v => onChange({ ...config, duplicatePauseOriginal: v })}
                label="Pause original ads after duplication"
              />
              <Toggle
                checked={config.duplicateCooldownEnabled ?? false}
                onChange={v => onChange({ ...config, duplicateCooldownEnabled: v })}
                label="Enable Cooldown Period"
                description="Prevent duplicating the same ad more than once in a period"
              />
              <Toggle
                checked={config.duplicateAutoSplit ?? false}
                onChange={v => onChange({ ...config, duplicateAutoSplit: v })}
                label="Auto-split ad set when limit reached"
              />
            </div>
          </>
        )}

        {/* ── Duplicate Ad Set ─────────────────────────────────────── */}
        {ev === "duplicate_adset" && (
          <>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">Select Ad Set to Duplicate <span className="text-red-500">*</span></label>
              <input type="text" placeholder="Ad Set ID"
                value={config.actionTargetExpression ?? ""}
                onChange={e => onChange({ ...config, actionTargetExpression: e.target.value })}
                className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono placeholder:text-muted-foreground/50 placeholder:font-sans"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">Target Campaign (optional)</label>
              <input type="text" placeholder="Same campaign (default)"
                value={config.duplicateTargetCampaignId ?? ""}
                onChange={e => onChange({ ...config, duplicateTargetCampaignId: e.target.value })}
                className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono placeholder:text-muted-foreground/50 placeholder:font-sans"
              />
              <p className="text-[11px] text-muted-foreground">Leave empty to keep the ad set in the same campaign.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">New Name (optional)</label>
              <input type="text" placeholder="e.g. {{original_name}}_copy"
                value={config.duplicateNameTemplate ?? ""}
                onChange={e => onChange({ ...config, duplicateNameTemplate: e.target.value })}
                className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono placeholder:text-muted-foreground/50 placeholder:font-sans"
              />
              <div className="flex flex-wrap gap-1">
                {NAME_TEMPLATE_VARS.map(v => (
                  <button key={v} type="button"
                    onClick={() => onChange({ ...config, duplicateNameTemplate: (config.duplicateNameTemplate ?? "") + v })}
                    className="h-5 px-2 rounded-full bg-muted hover:bg-primary/10 hover:text-primary border border-border/50 text-[10px] font-medium text-muted-foreground transition-colors">
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Duplicate Campaign ───────────────────────────────────── */}
        {ev === "duplicate_campaign" && (
          <>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">Select Campaign to Duplicate <span className="text-red-500">*</span></label>
              <input type="text" placeholder="Campaign ID"
                value={config.actionTargetExpression ?? ""}
                onChange={e => onChange({ ...config, actionTargetExpression: e.target.value })}
                className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono placeholder:text-muted-foreground/50 placeholder:font-sans"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">New Name (optional)</label>
              <input type="text" placeholder="e.g. {{original_name}}_{{date}}"
                value={config.duplicateNameTemplate ?? ""}
                onChange={e => onChange({ ...config, duplicateNameTemplate: e.target.value })}
                className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono placeholder:text-muted-foreground/50 placeholder:font-sans"
              />
              <div className="flex flex-wrap gap-1">
                {NAME_TEMPLATE_VARS.map(v => (
                  <button key={v} type="button"
                    onClick={() => onChange({ ...config, duplicateNameTemplate: (config.duplicateNameTemplate ?? "") + v })}
                    className="h-5 px-2 rounded-full bg-muted hover:bg-primary/10 hover:text-primary border border-border/50 text-[10px] font-medium text-muted-foreground transition-colors">
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Swap Creative / Create/Toggle/Update Rule / Apply Rule ─ */}
        {(ev === "swap_creative" || ev === "create_rule" || ev === "toggle_rule" || ev === "update_rule" || ev === "apply_existing_rule") && (
          <>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">Select Target <span className="text-red-500">*</span></label>
              <input type="text" placeholder="Ad Set ID"
                value={config.actionTargetAdsetId ?? ""}
                onChange={e => onChange({ ...config, actionTargetAdsetId: e.target.value })}
                className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono placeholder:text-muted-foreground/50 placeholder:font-sans"
              />
              <p className="text-[11px] text-muted-foreground">Enter the Ad Set ID to target</p>
            </div>

            {ev === "apply_existing_rule" && (
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-foreground/80">Select Rule <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Rule ID"
                  value={config.actionRuleId ?? ""}
                  onChange={e => onChange({ ...config, actionRuleId: e.target.value })}
                  className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono placeholder:text-muted-foreground/50 placeholder:font-sans"
                />
                <p className="text-[11px] text-muted-foreground">
                  Enter your existing Facebook Ad Rule ID. Applies to ads created in this automation.
                </p>
              </div>
            )}
          </>
        )}

        {/* ── Launch Ad ────────────────────────────────────────────── */}
        {ev === "launch_ad" && (
          <>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 px-3 py-2.5">
              <p className="text-[11px] text-blue-700 dark:text-blue-400">
                <span className="font-semibold">Note:</span> The creative asset comes from the trigger (e.g., Media Library upload or Best Performing Post). Configure the target ad set and copy below.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">Target Ad Sets <span className="text-red-500">*</span></label>
              <textarea
                placeholder="One Ad Set ID per line"
                value={(config.launchTargetAdsets ?? []).join("\n")}
                onChange={e => onChange({ ...config, launchTargetAdsets: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })}
                rows={3}
                className="w-full px-3 py-2 text-[12px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono resize-none placeholder:text-muted-foreground/60"
              />
              <p className="text-[11px] text-muted-foreground">Ad Set IDs where the ad will be created</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">Ad Name Template</label>
              <input type="text" placeholder="{{filename}} - {{date}}"
                value={config.launchAdNameTemplate ?? ""}
                onChange={e => onChange({ ...config, launchAdNameTemplate: e.target.value })}
                className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono placeholder:text-muted-foreground/50 placeholder:font-sans"
              />
              <div className="flex flex-wrap gap-1">
                {["{{filename}}", "{{date}}", "{{adSetName}}", "{{campaignName}}"].map(v => (
                  <button key={v} type="button"
                    onClick={() => onChange({ ...config, launchAdNameTemplate: (config.launchAdNameTemplate ?? "") + v })}
                    className="h-5 px-2 rounded-full bg-muted hover:bg-primary/10 hover:text-primary border border-border/50 text-[10px] font-medium text-muted-foreground transition-colors">
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">Headline</label>
              <input type="text" placeholder="Ad headline"
                value={config.launchHeadline ?? ""}
                onChange={e => onChange({ ...config, launchHeadline: e.target.value })}
                className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">Primary Text</label>
              <textarea placeholder="Ad primary text" rows={3}
                value={config.launchPrimaryText ?? ""}
                onChange={e => onChange({ ...config, launchPrimaryText: e.target.value })}
                className="w-full px-3 py-2 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">Link URL <span className="text-red-500">*</span></label>
              <input type="url" placeholder="https://example.com"
                value={config.launchLinkUrl ?? ""}
                onChange={e => onChange({ ...config, launchLinkUrl: e.target.value })}
                className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <SelectField label="Call to Action" value={config.launchCta ?? "LEARN_MORE"}
                  options={[
                    { value: "LEARN_MORE",    label: "Learn More" },
                    { value: "SHOP_NOW",      label: "Shop Now" },
                    { value: "SIGN_UP",       label: "Sign Up" },
                    { value: "GET_QUOTE",     label: "Get Quote" },
                    { value: "BOOK_NOW",      label: "Book Now" },
                    { value: "CONTACT_US",    label: "Contact Us" },
                    { value: "DOWNLOAD",      label: "Download" },
                    { value: "ORDER_NOW",     label: "Order Now" },
                    { value: "WATCH_MORE",    label: "Watch More" },
                    { value: "APPLY_NOW",     label: "Apply Now" },
                    { value: "GET_OFFER",     label: "Get Offer" },
                    { value: "SUBSCRIBE",     label: "Subscribe" },
                    { value: "MESSAGE_PAGE",  label: "Send Message" },
                  ]}
                  onChange={v => onChange({ ...config, launchCta: v })}
                />
              </div>
              <div className="flex-1">
                <SelectField label="Initial Status" value={config.launchInitialStatus ?? "PAUSED"}
                  options={[
                    { value: "PAUSED", label: "Paused" },
                    { value: "ACTIVE", label: "Active" },
                  ]}
                  onChange={v => onChange({ ...config, launchInitialStatus: v as any })}
                />
              </div>
            </div>
          </>
        )}

        {/* ── Set Minimum Spend ─────────────────────────────────────── */}
        {ev === "set_minimum_spend" && (
          <>
            <TriggerVarInput
              label="Ad Set IDs"
              value={config.actionTargetExpression ?? "{{trigger.qualifyingAdSetIds}}"}
              onChange={v => onChange({ ...config, actionTargetExpression: v })}
              vars={[{ key: "{{trigger.qualifyingAdSetIds}}", label: "Ad Sets from trigger" }]}
              description="Comma-separated ad set IDs or use a trigger variable"
            />
            <SelectField
              label="Minimum Spend Type" value={config.minSpendType ?? "fixed"}
              options={[
                { value: "fixed",      label: "Fixed Amount ($)" },
                { value: "percentage", label: "Percentage (%) of budget" },
              ]}
              onChange={v => onChange({ ...config, minSpendType: v as any })}
              required
            />
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">
                Minimum Spend Amount <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-muted-foreground">{config.minSpendType === "percentage" ? "%" : "$"}</span>
                <input type="number" min={0}
                  value={config.minSpendAmount ?? ""}
                  onChange={e => onChange({ ...config, minSpendAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Each ad set will have this minimum daily spend target</p>
            </div>
          </>
        )}

        {/* ── Budget ───────────────────────────────────────────────── */}
        {isBudget && (
          <>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-foreground/80">Budget Level</label>
              <div className="relative">
                <select value={config.targetLevel ?? "adset"}
                  onChange={e => onChange({ ...config, targetLevel: e.target.value as any })}
                  className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none">
                  <option value="adset">Ad Sets</option>
                  <option value="campaign">Campaigns</option>
                </select>
                <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              </div>
              <p className="text-[11px] text-muted-foreground">Modify budgets at the {config.targetLevel === "campaign" ? "campaign" : "ad set"} level</p>
            </div>

            {triggerHasNoIds ? (
              <AdSetPicker
                label={`Target ${config.targetLevel === "campaign" ? "Campaigns" : "Ad Sets"}`}
                selectedIds={config.targetIds ?? []}
                onChange={ids => onChange({ ...config, targetIds: ids, actionTargetExpression: ids.join(",") })}
                level={config.targetLevel === "campaign" ? "campaign" : "adset"}
              />
            ) : (
              <TriggerVarInput
                label={`Target ${config.targetLevel === "campaign" ? "Campaigns" : "Ad Sets"}`}
                value={config.actionTargetExpression ?? (config.targetLevel === "campaign" ? "{{trigger.qualifyingCampaignIds}}" : "{{trigger.qualifyingAdSetIds}}")}
                onChange={v => onChange({ ...config, actionTargetExpression: v })}
                vars={config.targetLevel === "campaign"
                  ? [{ key: "{{trigger.qualifyingCampaignIds}}", label: "Campaigns from trigger" }]
                  : [{ key: "{{trigger.qualifyingAdSetIds}}", label: "Ad Sets from trigger" }]}
                description="Paste comma-separated IDs or use a trigger variable"
              />
            )}

            <SelectField
              label="Operation" value={config.budgetOperation ?? (ev === "increase_budget" ? "increase" : ev === "decrease_budget" ? "decrease" : "increase")}
              options={[
                { value: "increase", label: "↑ Increase" },
                { value: "decrease", label: "↓ Decrease" },
                { value: "set",      label: "= Set to" },
              ]}
              onChange={v => onChange({ ...config, budgetOperation: v as any })}
              required
            />

            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <label className="text-[12px] font-semibold text-foreground/80">Amount <span className="text-red-500">*</span></label>
                <input type="number" min={0}
                  value={config.budgetAmount ?? ""}
                  onChange={e => onChange({ ...config, budgetAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="w-32 space-y-1.5">
                <label className="text-[12px] font-semibold text-foreground/80">Amount Type</label>
                <div className="relative">
                  <select value={config.budgetAmountType ?? "percentage"}
                    onChange={e => onChange({ ...config, budgetAmountType: e.target.value as any })}
                    className="w-full h-9 pl-2 pr-6 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none">
                    <option value="percentage">Percentage (%)</option>
                    <option value="absolute">Dollar ($)</option>
                  </select>
                  <IconChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            <SelectField
              label="Budget Type" value={config.budgetType ?? "daily"}
              options={[{ value: "daily", label: "Daily Budget" }, { value: "lifetime", label: "Lifetime Budget" }]}
              onChange={v => onChange({ ...config, budgetType: v as any })}
              description={`Choose which budget type to modify on the target ${config.targetLevel === "campaign" ? "campaigns" : "ad sets"}`}
            />
          </>
        )}

      </div>

      {/* Require approval toggle */}
      <div className="pt-3 border-t border-border/40">
        <Toggle
          checked={config.requireApproval ?? false}
          onChange={v => onChange({ ...config, requireApproval: v })}
          label="Require Approval"
          description="Pause before executing this action"
        />
      </div>
    </div>
  )
}

// ─── Google Sheets Action Setup ───────────────────────────────────────────────

function SheetsActionSetup({ config, onChange }: { config: ActionConfig; onChange: (c: ActionConfig) => void }) {
  const ev = config.event

  const handleSpreadsheetInput = (raw: string) => {
    const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
    onChange({ ...config, actionSheetsSpreadsheetId: match ? match[1] : raw })
  }

  return (
    <div className="p-5 space-y-4">
      <SelectField
        label="Action Event" value={ev} required
        options={[
          { value: "add_sheet_row",    label: "Add Row" },
          { value: "update_sheet_cell",label: "Update Cell" },
          { value: "update_sheet_row", label: "Update Row" },
        ]}
        onChange={v => onChange({ ...config, event: v as any })}
      />

      {/* Service Account note */}
      <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5 space-y-1">
        <p className="text-[11px] font-semibold text-foreground/70">Service Account Access</p>
        <p className="text-[11px] text-muted-foreground">
          Share your sheet with <span className="font-mono text-[10px] bg-muted px-1 rounded">{process.env.NEXT_PUBLIC_SHEETS_SERVICE_ACCOUNT ?? "adlauncher-sheets@..."}</span> and grant <strong>Editor</strong> access.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-foreground/80">Spreadsheet ID or URL <span className="text-red-500">*</span></label>
        <input type="text" placeholder="Paste spreadsheet URL or ID"
          value={config.actionSheetsSpreadsheetId ?? ""}
          onChange={e => handleSpreadsheetInput(e.target.value)}
          className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-foreground/80">Sheet Name</label>
        <input type="text" placeholder="Sheet1"
          value={config.actionSheetsSheetName ?? "Sheet1"}
          onChange={e => onChange({ ...config, actionSheetsSheetName: e.target.value })}
          className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {ev === "update_sheet_cell" && (
        <>
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-foreground/80">Cell Reference <span className="text-red-500">*</span></label>
            <input type="text" placeholder="e.g., B2, C5"
              value={config.actionSheetsCellRef ?? ""}
              onChange={e => onChange({ ...config, actionSheetsCellRef: e.target.value })}
              className="w-28 h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-foreground/80">Value</label>
            <input type="text" placeholder="Value to write"
              value={config.actionSheetsCellValue ?? ""}
              onChange={e => onChange({ ...config, actionSheetsCellValue: e.target.value })}
              className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
            />
          </div>
        </>
      )}

      {(ev === "add_sheet_row" || ev === "update_sheet_row") && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-semibold text-foreground/80">Column Mapping</label>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-1">Map columns to data. Use {"{{filename}}"}, {"{{date}}"}, {"{{fileUrl}}"} as variables.</p>
          {(config.actionSheetsColumnMappings ?? []).map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <input placeholder="Column" value={m.column}
                onChange={e => {
                  const next = [...(config.actionSheetsColumnMappings ?? [])]
                  next[i] = { ...m, column: e.target.value }
                  onChange({ ...config, actionSheetsColumnMappings: next })
                }}
                className="w-24 h-8 px-2.5 text-[12px] bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40"
              />
              <input placeholder="Value or {{variable}}" value={m.value}
                onChange={e => {
                  const next = [...(config.actionSheetsColumnMappings ?? [])]
                  next[i] = { ...m, value: e.target.value }
                  onChange({ ...config, actionSheetsColumnMappings: next })
                }}
                className="flex-1 h-8 px-2.5 text-[12px] bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40"
              />
              <button onClick={() => onChange({ ...config, actionSheetsColumnMappings: (config.actionSheetsColumnMappings ?? []).filter((_, j) => j !== i) })}
                className="text-muted-foreground hover:text-destructive">
                <IconX className="size-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() => onChange({ ...config, actionSheetsColumnMappings: [...(config.actionSheetsColumnMappings ?? []), { column: "", value: "" }] })}
            className="flex items-center gap-1.5 text-[12px] text-primary hover:underline font-medium">
            <IconPlus className="size-3.5" /> Add Column
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Media Library Action Setup ───────────────────────────────────────────────

function MediaLibraryActionSetup({ config, onChange }: { config: ActionConfig; onChange: (c: ActionConfig) => void }) {
  const [boards, setBoards] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch("/api/asset-boards")
      .then(r => r.json())
      .then(d => setBoards(d.boards ?? []))
      .catch(() => setBoards([]))
      .finally(() => setLoading(false))
  }, [])

  const NAMING_VARS = ["{originalName}", "{date}", "{boardName}", "{counter}", "{ratio}"]

  return (
    <div className="p-5 space-y-4">
      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-foreground/80">Target Board</label>
        {loading ? (
          <div className="flex items-center gap-2 h-9 px-3 border border-border rounded-lg text-[13px] text-muted-foreground">
            <IconLoader2 className="size-3.5 animate-spin" /> Loading boards…
          </div>
        ) : (
          <div className="relative">
            <select value={config.actionMediaBoardId ?? ""}
              onChange={e => {
                const board = boards.find(b => b.id === e.target.value)
                onChange({ ...config, actionMediaBoardId: e.target.value || undefined, actionMediaBoardName: board?.name })
              }}
              className="w-full h-9 pl-3 pr-8 text-[13px] bg-background border border-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground">
              <option value="">No board (upload to library root)</option>
              {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <IconChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Optionally organize uploaded media into a board.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-foreground/80">Naming Template (optional)</label>
        <input type="text" placeholder="{originalName}"
          value={config.actionMediaNamingTemplate ?? ""}
          onChange={e => onChange({ ...config, actionMediaNamingTemplate: e.target.value })}
          className="w-full h-9 px-3 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
        />
        <div className="flex flex-wrap gap-1 mt-1">
          {NAMING_VARS.map(v => (
            <button key={v} type="button"
              onClick={() => onChange({ ...config, actionMediaNamingTemplate: (config.actionMediaNamingTemplate ?? "") + v })}
              className="h-5 px-2 rounded-full bg-muted hover:bg-primary/10 hover:text-primary border border-border/50 text-[10px] font-medium text-muted-foreground transition-colors">
              {v}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Leave empty to keep the original file name.</p>
      </div>
    </div>
  )
}

// ─── Setup tab dispatcher ─────────────────────────────────────────────────────

function SetupTab({ config, onChange, triggerAppId }: { config: ActionConfig; onChange: (c: ActionConfig) => void; triggerAppId?: string }) {
  if (config.appId === "notification") return <NotificationSetup config={config} onChange={onChange} />
  if (config.appId === "meta" || ALL_META_EVENTS.includes(config.event)) return <MetaActionSetup config={config} onChange={onChange} triggerAppId={triggerAppId} />
  if (config.appId === "sheets" || ["add_sheet_row","update_sheet_cell","update_sheet_row"].includes(config.event)) return <SheetsActionSetup config={config} onChange={onChange} />
  if (config.appId === "media_library" || config.event === "upload_to_media_library") return <MediaLibraryActionSetup config={config} onChange={onChange} />

  // Fallback for other apps
  const meta = getActionMeta(config)
  const AppIcon = meta.icon
  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl">
        <div className={cn("size-8 rounded-lg flex items-center justify-center shrink-0", meta.iconBg)}>
          <AppIcon className={cn("size-4", meta.iconColor)} />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-foreground">{meta.label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Action configured — {config.event?.replace(/_/g, " ")}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Preview helpers ──────────────────────────────────────────────────────────

function PreviewRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
      <span className="text-[11px] text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className={cn("text-[12px] font-medium flex-1", accent ? "text-primary" : "text-foreground")}>{value}</span>
    </div>
  )
}

function MetaActionPreview({ config }: { config: ActionConfig }) {
  const ev = config.event
  const label = EVENT_LABELS[ev] ?? ev.replace(/_/g, " ")
  const isPause   = ev.startsWith("pause_")
  const isEnable  = ev.startsWith("enable_")
  const isDupe    = ev.startsWith("duplicate_")
  const isBudget  = META_BUDGET_EVENTS.includes(ev)
  const isTarget  = META_TARGET_EVENTS.includes(ev)

  const targetDesc =
    config.targetFilter === "specific"   ? `${(config.targetIds ?? []).length} specific ID(s)`
    : config.targetFilter === "name_contains" ? `Name contains "${config.targetFilterValue ?? "..."}"`
    : "All active items"

  const budgetDesc = isBudget ? (() => {
    const op  = config.budgetOperation ?? "increase"
    const amt = config.budgetAmount ?? 0
    const typ = config.budgetAmountType === "absolute" ? `$${amt}` : `${amt}%`
    const bt  = config.budgetType === "lifetime" ? "lifetime" : "daily"
    if (op === "set")      return `Set ${bt} budget to ${typ}`
    if (op === "decrease") return `Decrease ${bt} budget by ${typ}`
    return `Increase ${bt} budget by ${typ}`
  })() : null

  const dupeDesc = isDupe
    ? `${config.duplicateCopies ?? 1} copy(ies) — initial status: ${config.duplicateStatus ?? "PAUSED"}`
    : null

  return (
    <div className="p-5 space-y-4">
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border/40">
          <div className="flex items-center gap-2">
            <IconBrandMeta className="size-4 text-[#1877F2]" />
            <span className="text-[12px] font-semibold text-foreground">Meta · {label}</span>
          </div>
        </div>
        <div className="px-4 py-1">
          <PreviewRow label="Action" value={label} accent />
          <PreviewRow label="Target" value={targetDesc} />
          {isBudget  && <PreviewRow label="Budget change" value={budgetDesc!} accent />}
          {isDupe    && <PreviewRow label="Duplicate" value={dupeDesc!} />}
          {isPause   && <PreviewRow label="Result" value="Status → PAUSED" />}
          {isEnable  && <PreviewRow label="Result" value="Status → ACTIVE" />}
          {isTarget  && <PreviewRow label="Target Ad Set" value={config.actionTargetAdsetId || "Not set"} />}
          {ev === "apply_existing_rule" && <PreviewRow label="Rule ID" value={config.actionRuleId || "Not set"} />}
          {ev === "set_minimum_spend" && <PreviewRow label="Min Spend" value={`${config.minSpendType === "percentage" ? "" : "$"}${config.minSpendAmount ?? 0}${config.minSpendType === "percentage" ? "%" : ""} (${config.minSpendType === "percentage" ? "Percentage" : "Fixed Amount"})`} accent />}
          <PreviewRow label="Approval" value={config.requireApproval ? "Required before executing" : "Not required"} />
        </div>
      </div>

      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3">
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          <span className="font-semibold">Note:</span> This action calls the Meta Ads API and will affect real ads when the automation fires.
          {config.requireApproval && " Approval is required before executing."}
        </p>
      </div>
    </div>
  )
}

function SheetsActionPreview({ config }: { config: ActionConfig }) {
  const ev    = config.event
  const label = EVENT_LABELS[ev] ?? ev.replace(/_/g, " ")
  const spreadsheetId = config.actionSheetsSpreadsheetId
  const sheetName     = config.actionSheetsSheetName ?? "Sheet1"

  return (
    <div className="p-5 space-y-4">
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border/40">
          <div className="flex items-center gap-2">
            <IconTable className="size-4 text-green-600" />
            <span className="text-[12px] font-semibold text-foreground">Google Sheets · {label}</span>
          </div>
        </div>
        <div className="px-4 py-1">
          <PreviewRow label="Action" value={label} accent />
          <PreviewRow label="Spreadsheet" value={spreadsheetId ? `ID: ${spreadsheetId.slice(0, 20)}…` : "Not configured"} />
          <PreviewRow label="Sheet" value={sheetName} />
          {ev === "update_sheet_cell" && (
            <PreviewRow label="Cell" value={`${config.actionSheetsCellRef ?? "?"} = "${config.actionSheetsCellValue ?? ""}"`} />
          )}
          {(ev === "add_sheet_row" || ev === "update_sheet_row") && (
            <PreviewRow
              label="Columns"
              value={(config.actionSheetsColumnMappings ?? []).length > 0
                ? (config.actionSheetsColumnMappings ?? []).map(m => `${m.column}=${m.value}`).join(", ")
                : "No columns mapped"}
            />
          )}
        </div>
      </div>

      {!spreadsheetId && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 px-4 py-3">
          <p className="text-[11px] text-red-600 dark:text-red-400">
            <span className="font-semibold">Missing:</span> Spreadsheet ID or URL is required.
          </p>
        </div>
      )}

      <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 px-4 py-3">
        <p className="text-[11px] text-blue-700 dark:text-blue-400">
          <span className="font-semibold">Tip:</span> Make sure the service account has <strong>Editor</strong> access to the spreadsheet.
        </p>
      </div>
    </div>
  )
}

function MediaLibraryActionPreview({ config }: { config: ActionConfig }) {
  const boardName = config.actionMediaBoardName
  const template  = config.actionMediaNamingTemplate

  return (
    <div className="p-5 space-y-4">
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border/40">
          <div className="flex items-center gap-2">
            <IconPhoto className="size-4 text-orange-500" />
            <span className="text-[12px] font-semibold text-foreground">Media Library · Upload</span>
          </div>
        </div>
        <div className="px-4 py-1">
          <PreviewRow label="Action" value="Upload to Media Library" accent />
          <PreviewRow label="Target board" value={boardName ?? "Library root (no board)"} />
          <PreviewRow label="File name" value={template ? `Template: ${template}` : "Keep original file name"} />
        </div>
      </div>

      <div className="rounded-xl bg-muted/30 border border-border px-4 py-3">
        <p className="text-[11px] text-muted-foreground">
          When this action runs, the file from the trigger will be uploaded to your Media Library
          {boardName ? ` and added to the board "<strong>${boardName}</strong>"` : ""}.
        </p>
      </div>
    </div>
  )
}

// ─── Preview tab ──────────────────────────────────────────────────────────────

function PreviewTab({ config, automationId }: { config: ActionConfig; automationId?: string }) {
  const [dryRunning, setDryRunning] = useState(false)
  const [dryRunResult, setDryRunResult] = useState<string | null>(null)

  const handleDryRun = async () => {
    if (!automationId) {
      setDryRunResult("❌ Save the automation first")
      setTimeout(() => setDryRunResult(null), 3000)
      return
    }
    setDryRunning(true)
    setDryRunResult(null)
    try {
      const res  = await fetch(`/api/automations/${automationId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_test: true }),
      })
      const data = await res.json()
      const notifResult = data.actionResults?.find((r: any) => r.event === "send_notification")
      if (notifResult?.status === "success") {
        setDryRunResult("✅ Email sent successfully!")
      } else if (notifResult?.status === "skipped") {
        setDryRunResult(`⚠️ Skipped: ${notifResult.message}`)
      } else {
        setDryRunResult(`❌ Failed: ${notifResult?.message ?? data.error ?? "Unknown error"}`)
      }
    } catch (err: any) {
      setDryRunResult(`❌ ${err.message}`)
    } finally {
      setDryRunning(false)
      setTimeout(() => setDryRunResult(null), 5000)
    }
  }
  const notif = config.notification
  const msg   = notif?.customMessage ??
    "{{trigger.summary}}\n{{trigger.entityName}}: {{trigger.previousValue}} → {{trigger.currentValue}} ({{trigger.actualChange}}% change)"
  const recipientCount = notif?.emailRecipients?.length ?? 0
  const meta = getActionMeta(config)

  // Dispatch to specific previews
  if (ALL_META_EVENTS.includes(config.event)) return <MetaActionPreview config={config} />
  if (["add_sheet_row","update_sheet_cell","update_sheet_row"].includes(config.event)) return <SheetsActionPreview config={config} />
  if (config.event === "upload_to_media_library") return <MediaLibraryActionPreview config={config} />

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
        <button
          onClick={handleDryRun}
          disabled={dryRunning}
          className="w-full h-9 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {dryRunning ? <><IconLoader2 className="size-3.5 animate-spin" /> Sending…</> : "Dry-run this notification"}
        </button>
        {dryRunResult && (
          <p className="text-[12px] text-center font-medium py-1">{dryRunResult}</p>
        )}
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
  automationId?: string
  triggerAppId?: string
}

export function ActionConfigPanel({ stepIndex, config, onChange, onClose, automationId, triggerAppId }: Props) {
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
          ? <SetupTab config={config} onChange={onChange} triggerAppId={triggerAppId} />
          : <PreviewTab config={config} automationId={automationId} />
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
