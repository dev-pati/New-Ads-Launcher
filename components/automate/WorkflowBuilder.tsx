"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  IconArrowLeft, IconDeviceFloppy, IconPlayerPlay,
  IconEye, IconHistory, IconBell, IconDots,
  IconLoader2, IconCheck, IconX, IconBolt,
  IconClock, IconShieldCheck, IconSearch,
  IconBrandMeta, IconBrandTiktok, IconBrandSnapchat,
  IconBrandPinterest, IconBrandSlack, IconBrandGoogleDrive,
  IconTable, IconCalendar, IconHandClick,
  IconPhoto, IconBrandDropbox, IconApps, IconWind, IconBrandFramer, IconScan,
} from "@tabler/icons-react"
import { WorkflowCanvas, type ClickPos } from "./WorkflowCanvas"
import { TriggerConfigPanel } from "./TriggerConfigPanel"
import { ActionConfigPanel } from "./ActionConfigPanel"
import type {
  WorkflowStep, TriggerConfig, ActionConfig, DelayConfig, ApprovalConfig, Workflow, AppId,
} from "@/lib/workflow-types"

// ─── Trigger app picker data ──────────────────────────────────────────────────

const TRIGGER_APPS: {
  appId: AppId
  name: string
  desc: string
  Icon: React.ElementType
  iconBg: string
  iconFg: string
}[] = [
  { appId: "meta",         name: "Meta",          desc: "Meta Ads is a secure partner with AdLauncher",            Icon: IconBrandMeta,        iconBg: "#1877F2", iconFg: "#fff" },
  { appId: "tiktok",       name: "TikTok Ads",    desc: "Monitor TikTok ad performance and launch automations",    Icon: IconBrandTiktok,      iconBg: "#010101", iconFg: "#fff" },
  { appId: "schedule",     name: "Scheduled",     desc: "Run your automation on a recurring schedule",             Icon: IconCalendar,         iconBg: "#6366F1", iconFg: "#fff" },
  { appId: "google_drive", name: "Google Drive",  desc: "Google Drive is a secure partner with AdLauncher",        Icon: IconBrandGoogleDrive, iconBg: "#34A853", iconFg: "#fff" },
  { appId: "sheets",       name: "Google Sheets", desc: "Share your Google Sheet with our services",               Icon: IconTable,            iconBg: "#0F9D58", iconFg: "#fff" },
  { appId: "slack",        name: "Slack",         desc: "Connect Slack to trigger automations from messages",      Icon: IconBrandSlack,       iconBg: "#4A154B", iconFg: "#fff" },
  { appId: "snapchat",     name: "Snapchat",      desc: "Monitor Snapchat ad performance and automations",         Icon: IconBrandSnapchat,    iconBg: "#FFFC00", iconFg: "#000" },
  { appId: "pinterest",    name: "Pinterest",     desc: "Monitor Pinterest ad performance and automations",        Icon: IconBrandPinterest,   iconBg: "#E60023", iconFg: "#fff" },
  { appId: "manual",        name: "Manual Trigger", desc: "Run this automation manually on demand",                   Icon: IconHandClick,    iconBg: "#2563EB", iconFg: "#fff" },
  { appId: "media_library", name: "Media Library",  desc: "Upload media to your library or trigger from assets",     Icon: IconPhoto,        iconBg: "#FF7043", iconFg: "#fff" },
  { appId: "dropbox",       name: "Dropbox",        desc: "Dropbox is a secure partner with AdLauncher",             Icon: IconBrandDropbox, iconBg: "#0061FF", iconFg: "#fff" },
  { appId: "sharepoint",    name: "SharePoint",     desc: "SharePoint is a secure partner with AdLauncher",          Icon: IconApps,         iconBg: "#038387", iconFg: "#fff" },
  { appId: "air",           name: "AIR",            desc: "Trigger automations from a publicly shared AIR board",    Icon: IconWind,         iconBg: "#1A1A1A", iconFg: "#fff" },
  { appId: "frameio",       name: "Frame.io",       desc: "Trigger automations when new files are added in Frame.io",Icon: IconBrandFramer,  iconBg: "#4353FF", iconFg: "#fff" },
  { appId: "adscan",        name: "Adscan",         desc: "Trigger automations when competitor ad activity detected", Icon: IconScan,         iconBg: "#7C3AED", iconFg: "#fff" },
]

function defaultTriggerForApp(appId: AppId): TriggerConfig {
  switch (appId) {
    case "meta":
      return {
        appId: "meta",
        event: "performance_monitoring",
        monitoringLevel: "campaign",
        campaignFilter: "all",
        metricConditions: [{ metric: "spend", operator: "decreases_by", value: 20, unit: "%" }],
        comparisonWindow: "day_over_day",
        checkFrequency: "daily",
      }
    case "schedule":
      return { appId: "schedule", event: "schedule", checkFrequency: "daily", scheduleTime: "09:00" }
    case "google_drive":
      return { appId: "google_drive", event: "drive_new_file_in_folder", checkFrequency: "daily", driveBatchStrategy: "one_per_file", driveFileType: "all", driveUploadAllOnFirstRun: false }
    case "manual":
      return { appId: "manual", event: "manual", checkFrequency: "daily" }
    case "media_library":
      return {
        appId: "media_library",
        event: "media_uploaded",
        mediaBoard: "all",
        mediaAssetName: "all",
        mediaType: "all",
        triggerTiming: "immediately",
        assetStatus: "all",
        assetGrouping: false,
      }
    case "sheets":
      return {
        appId: "sheets",
        event: "sheets_cell_changed",
        sheetsSheetName: "Sheet1",
        sheetsWatchMode: "single_cell",
        sheetsCondition: "equals",
        sheetsConditionValue: "TRUE",
        sheetsTriggerCell: "C5",
      }
    case "dropbox":
      return { appId: "dropbox", event: "new_dropbox_file", checkFrequency: "daily" }
    case "sharepoint":
      return { appId: "sharepoint", event: "new_sharepoint_file", checkFrequency: "daily" }
    case "air":
      return { appId: "air", event: "new_air_asset", checkFrequency: "daily" }
    case "frameio":
      return { appId: "frameio", event: "new_frameio_file", checkFrequency: "daily" }
    case "adscan":
      return { appId: "adscan", event: "adscan_alert", checkFrequency: "daily" }
    default:
      return { appId, event: "performance_monitoring", checkFrequency: "daily" }
  }
}

// ─── App Picker Modal ─────────────────────────────────────────────────────────

function AppPickerModal({
  onPick,
  onClose,
}: {
  onPick: (appId: AppId) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const filtered = TRIGGER_APPS.filter(a =>
    a.name.toLowerCase().includes(query.toLowerCase()) ||
    a.desc.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-card border border-border rounded-2xl shadow-2xl w-[620px] max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 shrink-0">
          <div>
            <h2 className="text-[17px] font-bold text-foreground">Choose an app</h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Select the app you want to use for this trigger
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <IconX className="size-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pb-4 shrink-0">
          <div className="flex items-center gap-2.5 h-10 px-3.5 bg-muted/50 border border-border/60 rounded-xl">
            <IconSearch className="size-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search apps..."
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {filtered.length === 0 ? (
            <p className="text-center text-[13px] text-muted-foreground py-8">No apps found.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map(app => {
                const AppIcon = app.Icon
                return (
                  <button
                    key={app.appId}
                    onClick={() => { onPick(app.appId); onClose() }}
                    className="flex items-center gap-3.5 p-3.5 border border-border/60 rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-colors text-left group"
                  >
                    <div
                      className="size-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                      style={{ backgroundColor: app.iconBg }}
                    >
                      <AppIcon className="size-6" style={{ color: app.iconFg }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
                        {app.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                        {app.desc}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

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

function defaultDelay(): DelayConfig {
  return { unit: "hours", value: 1 }
}

function defaultApproval(): ApprovalConfig {
  return { approvers: [], message: "", timeoutHours: 24 }
}

// ─── Delay config panel ───────────────────────────────────────────────────────

function DelayConfigPanel({ stepIndex, config, onChange, onClose }: {
  stepIndex: number
  config: DelayConfig
  onChange: (c: DelayConfig) => void
  onClose: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center">
            <IconClock className="size-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-[13px] font-semibold">Delay</p>
            <p className="text-[11px] text-muted-foreground">Step {stepIndex}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
          <IconX className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <p className="text-[13px] font-semibold text-foreground mb-4">Wait duration</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            value={config.value}
            onChange={e => onChange({ ...config, value: Math.max(1, Number(e.target.value)) })}
            className="w-24 h-10 px-3 border border-border rounded-xl text-[13px] font-medium bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <select
            value={config.unit}
            onChange={e => onChange({ ...config, unit: e.target.value as DelayConfig["unit"] })}
            className="flex-1 h-10 px-3 border border-border rounded-xl text-[13px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
        <p className="text-[12px] text-muted-foreground mt-3">
          The automation will wait {config.value} {config.unit} before proceeding to the next step.
        </p>
      </div>
    </div>
  )
}

// ─── Approval config panel ────────────────────────────────────────────────────

function ApprovalConfigPanel({ stepIndex, config, onChange, onClose }: {
  stepIndex: number
  config: ApprovalConfig
  onChange: (c: ApprovalConfig) => void
  onClose: () => void
}) {
  const [emailInput, setEmailInput] = useState("")

  const addApprover = () => {
    const email = emailInput.trim()
    if (!email || config.approvers.includes(email)) return
    onChange({ ...config, approvers: [...config.approvers, email] })
    setEmailInput("")
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
            <IconShieldCheck className="size-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-[13px] font-semibold">Approval</p>
            <p className="text-[11px] text-muted-foreground">Step {stepIndex}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
          <IconX className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <p className="text-[13px] font-semibold text-foreground mb-2">Approvers</p>
          <div className="flex gap-2 mb-2">
            <input
              type="email"
              placeholder="name@company.com"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addApprover()}
              className="flex-1 h-9 px-3 border border-border rounded-xl text-[13px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={addApprover}
              className="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
            >
              Add
            </button>
          </div>
          {config.approvers.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No approvers added yet.</p>
          ) : (
            <div className="space-y-1.5">
              {config.approvers.map(email => (
                <div key={email} className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-xl">
                  <span className="text-[13px]">{email}</span>
                  <button
                    onClick={() => onChange({ ...config, approvers: config.approvers.filter(e => e !== email) })}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <IconX className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-[13px] font-semibold text-foreground mb-2">Message (optional)</p>
          <textarea
            rows={3}
            placeholder="Describe what needs to be approved..."
            value={config.message ?? ""}
            onChange={e => onChange({ ...config, message: e.target.value })}
            className="w-full px-3 py-2.5 border border-border rounded-xl text-[13px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-foreground mb-2">Auto-reject after</p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              value={config.timeoutHours ?? 24}
              onChange={e => onChange({ ...config, timeoutHours: Number(e.target.value) })}
              className="w-24 h-10 px-3 border border-border rounded-xl text-[13px] font-medium bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span className="text-[13px] text-muted-foreground">hours (0 = never)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Action app list ──────────────────────────────────────────────────────────

const ACTION_APPS: {
  appId: AppId
  name: string
  desc: string
  Icon: React.ElementType
  iconBg: string
  iconFg: string
}[] = [
  { appId: "media_library", name: "Media Library",  desc: "Upload media to your library or trigger from assets",      Icon: IconPhoto,          iconBg: "#FF7043", iconFg: "#fff" },
  { appId: "sheets",        name: "Google Sheets",  desc: "Share your Google Sheet with our services",                Icon: IconTable,          iconBg: "#0F9D58", iconFg: "#fff" },
  { appId: "google_drive",  name: "Google Drive",   desc: "Google Drive is a secure partner with AdLauncher",         Icon: IconBrandGoogleDrive,iconBg:"#34A853", iconFg: "#fff" },
  { appId: "meta",          name: "Meta",           desc: "Meta Ads is a secure partner with AdLauncher",             Icon: IconBrandMeta,      iconBg: "#1877F2", iconFg: "#fff" },
  { appId: "tiktok",        name: "TikTok Ads",     desc: "Monitor TikTok ad performance and launch automations",     Icon: IconBrandTiktok,    iconBg: "#010101", iconFg: "#fff" },
  { appId: "snapchat",      name: "Snapchat Ads",   desc: "Launch ads on Snapchat from your workflow",                Icon: IconBrandSnapchat,  iconBg: "#FFFC00", iconFg: "#000" },
  { appId: "pinterest",     name: "Pinterest Ads",  desc: "Launch ads on Pinterest from your workflow",               Icon: IconBrandPinterest, iconBg: "#E60023", iconFg: "#fff" },
  { appId: "notification",  name: "Notification",   desc: "Send a Slack message or email notification",               Icon: IconBell,           iconBg: "#F59E0B", iconFg: "#fff" },
  { appId: "slack",         name: "Slack",          desc: "Send a Slack notification when this step runs",            Icon: IconBrandSlack,     iconBg: "#4A154B", iconFg: "#fff" },
  { appId: "dropbox",       name: "Dropbox",        desc: "Save or manage files in Dropbox",                          Icon: IconBrandDropbox,   iconBg: "#0061FF", iconFg: "#fff" },
  { appId: "sharepoint",    name: "SharePoint",     desc: "Save or manage files in SharePoint",                       Icon: IconApps,           iconBg: "#038387", iconFg: "#fff" },
  { appId: "air",           name: "AIR",            desc: "Upload assets to AIR board",                               Icon: IconWind,           iconBg: "#1A1A1A", iconFg: "#fff" },
  { appId: "frameio",       name: "Frame.io",       desc: "Upload files to Frame.io",                                 Icon: IconBrandFramer,    iconBg: "#4353FF", iconFg: "#fff" },
]

function defaultActionForApp(appId: AppId): ActionConfig {
  switch (appId) {
    case "meta":
      return { appId: "meta", event: "increase_budget", budgetChange: { type: "increase", amount: 20, unit: "%" } }
    case "notification":
      return {
        appId: "notification", event: "send_notification",
        notification: { via: "both", emailRecipients: [], customMessage: "{{trigger.summary}}\n{{trigger.entityName}}" },
      }
    case "tiktok":    return { appId: "tiktok",    event: "launch_tiktok" }
    case "snapchat":  return { appId: "snapchat",  event: "launch_snapchat" }
    case "pinterest": return { appId: "pinterest", event: "launch_pinterest" }
    case "slack":     return { appId: "slack",     event: "send_slack" }
    case "sheets":    return { appId: "sheets",    event: "add_sheet_row" }
    default:          return { appId, event: "send_notification" }
  }
}

// ─── Action picker modal ──────────────────────────────────────────────────────

function ActionPickerModal({ onPick, onClose }: {
  onPick: (appId: AppId) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const filtered = ACTION_APPS.filter(a =>
    a.name.toLowerCase().includes(query.toLowerCase()) ||
    a.desc.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-card border border-border rounded-2xl shadow-2xl w-[620px] max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 pb-4 shrink-0">
          <div>
            <h2 className="text-[17px] font-bold text-foreground">Choose an app</h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">Select the app you want to use for this action</p>
          </div>
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <IconX className="size-4" />
          </button>
        </div>
        <div className="px-6 pb-4 shrink-0">
          <div className="flex items-center gap-2.5 h-10 px-3.5 bg-muted/50 border border-border/60 rounded-xl">
            <IconSearch className="size-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search apps..."
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/50"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {filtered.length === 0 ? (
            <p className="text-center text-[13px] text-muted-foreground py-8">No apps found.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map(app => {
                const AppIcon = app.Icon
                return (
                  <button
                    key={app.appId}
                    onClick={() => { onPick(app.appId); onClose() }}
                    className="flex items-center gap-3.5 p-3.5 border border-border/60 rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-colors text-left group"
                  >
                    <div
                      className="size-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                      style={{ backgroundColor: app.iconBg }}
                    >
                      <AppIcon className="size-6" style={{ color: app.iconFg }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
                        {app.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                        {app.desc}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Add-step contextual popup ────────────────────────────────────────────────

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

const POPUP_WIDTH = 280

function AddStepPopup({ x, y, onAddKind, onClose }: {
  x: number
  y: number
  onAddKind: (kind: "trigger" | "action" | "delay" | "approval") => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const left = Math.min(Math.max(x - POPUP_WIDTH / 2, 8), window.innerWidth - POPUP_WIDTH - 8)
  const top  = Math.min(y, window.innerHeight - 300)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Element)) onClose()
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left, top, width: POPUP_WIDTH, zIndex: 9999 }}
      className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <p className="text-sm font-semibold">Add a step</p>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
          <IconX className="size-4 text-muted-foreground" />
        </button>
      </div>
      <div className="p-2">
        {STEP_TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => { onAddKind(t.id as "trigger" | "action" | "delay" | "approval"); onClose() }}
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
        ))}
      </div>
    </div>
  )
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

function TopBar({
  name, onNameChange, saving, saved, running,
  onSave, onRun, onPreview, onHistory, historyOpen,
}: {
  name: string
  onNameChange: (v: string) => void
  saving: boolean
  saved: boolean
  running?: boolean
  onSave: () => void
  onRun: () => void
  onPreview: () => void
  onHistory: () => void
  historyOpen?: boolean
}) {
  const router = useRouter()
  const [editingName, setEditingName] = useState(false)

  return (
    <div className="border-b border-border bg-background shrink-0 z-10">
      <div className="h-14 flex items-center gap-3 px-4">
        <button
          onClick={() => router.push("/automate")}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
        >
          <IconArrowLeft className="size-4" />
        </button>

        <div className="size-9 rounded-xl bg-[#2563EB] flex items-center justify-center shrink-0 shadow-sm">
          <IconBolt className="size-5 text-white" />
        </div>

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
            disabled={running}
            className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-[#1D4ED8] transition-colors shadow-sm disabled:opacity-60"
          >
            {running
              ? <IconLoader2 className="size-3.5 animate-spin" />
              : <IconPlayerPlay className="size-3.5 fill-white" />}
            {running ? "Running…" : "Run"}
          </button>
          <button onClick={onPreview} className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg border border-border bg-background text-[13px] font-medium text-foreground/80 hover:bg-muted transition-colors">
            <IconEye className="size-3.5" />
            Full preview
          </button>
          <button onClick={onHistory} className={cn("flex items-center gap-1.5 h-8 px-3.5 rounded-lg border border-border text-[13px] font-medium transition-colors",
            historyOpen ? "bg-primary/10 text-primary border-primary/30" : "bg-background text-foreground/80 hover:bg-muted"
          )}>
            <IconHistory className="size-3.5" />
            History
          </button>
          <button className="size-8 rounded-lg border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <IconBell className="size-4" />
          </button>
          <button className="size-8 rounded-lg border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <IconDots className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main builder ─────────────────────────────────────────────────────────────

interface Props {
  initialWorkflow?: Partial<Workflow>
  adAccountName?: string
}

type AddingAt = { index: number; x: number; y: number } | null

export function WorkflowBuilder({ initialWorkflow, adAccountName }: Props) {
  const automationId = initialWorkflow?.id
  const [name, setName] = useState(initialWorkflow?.name ?? "Untitled Zap")
  const [steps, setSteps] = useState<WorkflowStep[]>(
    // New workflows start empty; templates/saved workflows start with their steps
    initialWorkflow?.steps ?? []
  )
  const [selectedId,            setSelectedId]            = useState<string | null>(null)
  const [addingAt,              setAddingAt]              = useState<AddingAt>(null)
  const [choosingAppForStep,    setChoosingAppForStep]    = useState<string | null>(null)
  const [choosingActionForStep, setChoosingActionForStep] = useState<string | null>(null)
  const [saving,                setSaving]                = useState(false)
  const [saved,                 setSaved]                 = useState(false)
  const [running,               setRunning]               = useState(false)
  const [runResult,             setRunResult]             = useState<{ status: string; message: string } | null>(null)
  const [showHistory,           setShowHistory]           = useState(false)
  const [history,               setHistory]               = useState<any[]>([])
  const [loadingHistory,        setLoadingHistory]        = useState(false)

  const selectedStep = steps.find(s => s.id === selectedId) ?? null

  // ── Handlers ────────────────────────────────────────────────────────────────

  // Clicking a node: empty trigger → app picker; empty action → action picker; configured → panel
  const handleSelectStep = useCallback((id: string) => {
    const step = steps.find(s => s.id === id)
    if (!step) return
    if (step.kind === "trigger" && !step.triggerConfig?.appId) {
      setChoosingAppForStep(id)
      return
    }
    if (step.kind === "action" && !step.actionConfig) {
      setChoosingActionForStep(id)
      return
    }
    setSelectedId(id)
  }, [steps])

  // Empty canvas "Add Trigger" button → add 1 trigger node (user clicks node to pick app)
  const handleAddFirst = useCallback(() => {
    const newId = `step-${Date.now()}`
    setSteps([{ id: newId, kind: "trigger", status: "incomplete" }])
    setSelectedId(null)
  }, [])

  // + buttons between/below nodes → open AddStepPopup
  const handleAddStep = useCallback((afterIndex: number, pos: ClickPos) => {
    setAddingAt({ index: afterIndex, x: pos.x, y: pos.y })
  }, [])

  // User chose an app from the app picker
  const handleAppChosen = useCallback((stepId: string, appId: AppId) => {
    const config = defaultTriggerForApp(appId)
    setSteps(prev => prev.map(s =>
      s.id === stepId ? { ...s, triggerConfig: config, status: "configured" } : s
    ))
    setChoosingAppForStep(null)
    setSelectedId(stepId)
  }, [])

  const handleDeleteStep = useCallback((stepId: string) => {
    setSteps(prev => prev.filter(s => s.id !== stepId))
    setSelectedId(prev => prev === stepId ? null : prev)
  }, [])

  // User picked an app from the ActionPickerModal
  const handleActionChosen = useCallback((stepId: string, appId: AppId) => {
    const config = defaultActionForApp(appId)
    setSteps(prev => prev.map(s => s.id === stepId
      ? { ...s, actionConfig: config, status: "incomplete" }
      : s
    ))
    setChoosingActionForStep(null)
    setSelectedId(stepId)
  }, [])

  const handleAddKind = useCallback((kind: "trigger" | "action" | "delay" | "approval") => {
    const newId = `step-${Date.now()}`
    const newStep: WorkflowStep = {
      id: newId,
      kind,
      status: kind === "delay" || kind === "approval" ? "configured" : "incomplete",
      ...(kind === "delay"    ? { delayConfig:    defaultDelay()    } : {}),
      ...(kind === "approval" ? { approvalConfig: defaultApproval() } : {}),
    }
    setSteps(prev => {
      const next = [...prev]
      next.splice(addingAt?.index ?? next.length, 0, newStep)
      return next
    })
    // For action: open action picker immediately after adding
    if (kind === "action") {
      setChoosingActionForStep(newId)
    } else {
      setSelectedId(newId)
    }
    setAddingAt(null)
  }, [addingAt])

  const handleUpdateDelay = useCallback((stepId: string, config: DelayConfig) => {
    setSteps(prev => prev.map(s => s.id === stepId
      ? { ...s, delayConfig: config, status: "configured" }
      : s
    ))
  }, [])

  const handleUpdateApproval = useCallback((stepId: string, config: ApprovalConfig) => {
    setSteps(prev => prev.map(s => s.id === stepId
      ? { ...s, approvalConfig: config, status: config.approvers.length > 0 ? "configured" : "incomplete" }
      : s
    ))
  }, [])

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

  const handleRun = useCallback(async () => {
    if (!automationId) {
      setRunResult({ status: "error", message: "Save the automation first before running." })
      setTimeout(() => setRunResult(null), 4000)
      return
    }
    setRunning(true)
    setRunResult(null)
    try {
      const res = await fetch(`/api/automations/${automationId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_test: true }),
      })
      const data = await res.json()
      const status = data.status ?? (res.ok ? "success" : "error")
      const msg    = data.error ?? `Run ${status} — ${data.actionResults?.length ?? 0} action(s) executed`
      setRunResult({ status, message: msg })
      setTimeout(() => setRunResult(null), 6000)
    } catch (err: any) {
      setRunResult({ status: "error", message: err.message })
      setTimeout(() => setRunResult(null), 4000)
    } finally {
      setRunning(false)
    }
  }, [automationId])

  const handleHistory = useCallback(async () => {
    setShowHistory(v => !v)
    if (!automationId || showHistory) return
    setLoadingHistory(true)
    try {
      const res  = await fetch(`/api/automations/${automationId}/history`)
      const data = await res.json()
      setHistory(data.executions ?? [])
    } catch {
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }, [automationId, showHistory])

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
          // Save full step objects so delay + approval steps are preserved
          actions: steps.slice(1).map(s => ({
            kind:           s.kind,
            actionConfig:   s.actionConfig   ?? null,
            delayConfig:    s.delayConfig    ?? null,
            approvalConfig: s.approvalConfig ?? null,
          })),
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
      <TopBar
        name={name}
        onNameChange={setName}
        saving={saving}
        saved={saved}
        running={running}
        onSave={handleSave}
        onRun={handleRun}
        onPreview={() => {}}
        onHistory={handleHistory}
        historyOpen={showHistory}
      />

      {/* Run result toast */}
      {runResult && (
        <div className={cn(
          "fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-[13px] font-medium border max-w-sm",
          runResult.status === "success" ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
          : runResult.status === "pending_delay" || runResult.status === "pending_approval" ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
          : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
        )}>
          {runResult.status === "success" ? "✅" : runResult.status.startsWith("pending") ? "⏳" : "❌"}
          <span>{runResult.message}</span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* History panel */}
        {showHistory && (
          <div className="w-[360px] shrink-0 border-r border-border bg-background flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="text-[14px] font-semibold">Run History</p>
              <button onClick={() => setShowHistory(false)} className="text-muted-foreground hover:text-foreground">
                <IconX className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-border/60">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <IconLoader2 className="size-4 animate-spin mr-2" /> Loading…
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <IconHistory className="size-8 mb-2 opacity-30" />
                  <p className="text-[13px]">No runs yet</p>
                </div>
              ) : history.map((exec: any) => (
                <div key={exec.id} className="px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full",
                      exec.status === "success" ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                      : exec.status === "pending" ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
                      : "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400"
                    )}>
                      {exec.status}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{new Date(exec.executed_at).toLocaleString()}</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground">{exec.action_taken || "—"} · {exec.entities_affected ?? 0} affected</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 overflow-hidden relative">
          <WorkflowCanvas
            steps={steps}
            selectedStepId={selectedId}
            onSelectStep={handleSelectStep}
            onAddStep={handleAddStep}
            onAddFirst={handleAddFirst}
            onDeleteStep={handleDeleteStep}
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
                automationId={automationId}
                onClose={() => setSelectedId(null)}
                onChangeApp={() => setChoosingAppForStep(selectedStep.id)}
              />
            ) : selectedStep.kind === "delay" ? (
              <DelayConfigPanel
                stepIndex={steps.indexOf(selectedStep) + 1}
                config={selectedStep.delayConfig ?? defaultDelay()}
                onChange={c => handleUpdateDelay(selectedStep.id, c)}
                onClose={() => setSelectedId(null)}
              />
            ) : selectedStep.kind === "approval" ? (
              <ApprovalConfigPanel
                stepIndex={steps.indexOf(selectedStep) + 1}
                config={selectedStep.approvalConfig ?? defaultApproval()}
                onChange={c => handleUpdateApproval(selectedStep.id, c)}
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

      {/* Contextual add-step popup */}
      {addingAt !== null && (
        <AddStepPopup
          x={addingAt.x}
          y={addingAt.y}
          onAddKind={handleAddKind}
          onClose={() => setAddingAt(null)}
        />
      )}

      {/* App picker modal (trigger app selection) */}
      {choosingAppForStep !== null && (
        <AppPickerModal
          onPick={appId => handleAppChosen(choosingAppForStep, appId)}
          onClose={() => setChoosingAppForStep(null)}
        />
      )}

      {/* Action picker modal */}
      {choosingActionForStep !== null && (
        <ActionPickerModal
          onPick={appId => handleActionChosen(choosingActionForStep, appId)}
          onClose={() => setChoosingActionForStep(null)}
        />
      )}
    </div>
  )
}
