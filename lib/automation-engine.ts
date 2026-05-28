import { createAdminClient } from "@/lib/supabase/admin"
import { getFacebookConnection } from "@/lib/auth"
import type { ActionConfig } from "@/lib/workflow-types"

const GRAPH = "https://graph.facebook.com/v25.0"

export interface TriggerPayload {
  fileId?: string
  fileName?: string
  fileUrl?: string
  mimeType?: string
  thumbnailUrl?: string
  entityIds?: string[]
}

export interface StepLog {
  ts: string
  msg: string
  level: "info" | "warn" | "error"
}

export interface ActionResult {
  event: string
  status: "success" | "failed" | "skipped"
  message: string
  data?: Record<string, any>
}

export interface ExecutionResult {
  status: "success" | "failed" | "skipped"
  logs: StepLog[]
  triggerPayload: TriggerPayload
  actionResults: ActionResult[]
  durationMs: number
  executionDbId?: string
}

function addLog(logs: StepLog[], msg: string, level: StepLog["level"] = "info") {
  logs.push({ ts: new Date().toISOString(), msg, level })
}

async function execMetaAction(
  action: ActionConfig & Record<string, any>,
  payload: TriggerPayload,
  token: string,
  logs: StepLog[]
): Promise<ActionResult> {
  const ev = action.event

  switch (ev) {
    case "pause_campaign":
    case "pause_adset": {
      const id = action.targetId ?? payload.entityIds?.[0]
      if (!id) {
        addLog(logs, `${ev}: no target ID configured`, "warn")
        return { event: ev, status: "skipped", message: "No target ID configured" }
      }
      const body = new URLSearchParams({ status: "PAUSED" })
      const res = await fetch(`${GRAPH}/${id}?access_token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      })
      const data = await res.json()
      if (data.error) {
        addLog(logs, `${ev} error: ${data.error.message}`, "error")
        return { event: ev, status: "failed", message: data.error.message }
      }
      addLog(logs, `${ev}: ID ${id} paused`)
      return { event: ev, status: "success", message: `Paused ${id}`, data }
    }

    case "increase_budget":
    case "decrease_budget": {
      const id = action.targetId ?? payload.entityIds?.[0]
      if (!id) {
        addLog(logs, `${ev}: no target ID`, "warn")
        return { event: ev, status: "skipped", message: "No target ad set ID configured" }
      }
      const change = action.budgetChange
      if (!change) {
        addLog(logs, `${ev}: no budget change config`, "warn")
        return { event: ev, status: "skipped", message: "No budget change configured" }
      }

      const fetchRes = await fetch(`${GRAPH}/${id}?fields=daily_budget&access_token=${token}`)
      const fetchData = await fetchRes.json()
      if (fetchData.error) return { event: ev, status: "failed", message: fetchData.error.message }

      const current = parseInt(fetchData.daily_budget ?? "0")
      let next: number
      if (change.unit === "%") {
        const factor = ev === "increase_budget" ? (1 + change.amount / 100) : (1 - change.amount / 100)
        next = Math.round(current * factor)
      } else {
        const delta = Math.round(change.amount * 100)
        next = ev === "increase_budget" ? current + delta : current - delta
      }
      next = Math.max(next, 100)

      const patchBody = new URLSearchParams({ daily_budget: String(next) })
      const res = await fetch(`${GRAPH}/${id}?access_token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: patchBody.toString(),
      })
      const data = await res.json()
      if (data.error) return { event: ev, status: "failed", message: data.error.message }
      addLog(logs, `${ev}: $${(current / 100).toFixed(2)} → $${(next / 100).toFixed(2)}`)
      return { event: ev, status: "success", message: `Budget $${(current / 100).toFixed(2)} → $${(next / 100).toFixed(2)}`, data: { prev: current, next } }
    }

    case "duplicate_ad": {
      const id = action.templateAdSetId ?? action.targetId ?? payload.entityIds?.[0]
      if (!id) {
        addLog(logs, "duplicate_ad: no template ad set ID", "warn")
        return { event: ev, status: "skipped", message: "No template ad set ID configured" }
      }
      const qs = new URLSearchParams({ access_token: token, deep_copy: "true", status_option: "PAUSED" })
      const res = await fetch(`${GRAPH}/${id}/copies?${qs}`, { method: "POST" })
      const data = await res.json()
      if (data.error) return { event: ev, status: "failed", message: data.error.message }
      const newId = data.copied_adset_id ?? data.id
      addLog(logs, `duplicate_ad: ${id} → ${newId}`)
      return { event: ev, status: "success", message: `Ad set duplicated: ${id} → ${newId}`, data: { newAdSetId: newId } }
    }

    default:
      addLog(logs, `WARNING: Unsupported action type: ${ev} — skipping`, "warn")
      return { event: ev, status: "skipped", message: `Action "${ev}" not yet implemented` }
  }
}

async function execNotification(
  action: ActionConfig,
  payload: TriggerPayload,
  automationName: string,
  logs: StepLog[]
): Promise<ActionResult> {
  const notif = action.notification
  if (!notif) return { event: "send_notification", status: "skipped", message: "No notification config" }

  const key = process.env.RESEND_API_KEY
  if (!key) return { event: "send_notification", status: "failed", message: "RESEND_API_KEY not configured" }

  const recipients = notif.emailRecipients ?? []
  if (!recipients.length) return { event: "send_notification", status: "skipped", message: "No email recipients" }

  const subject = `Automation triggered: ${automationName}`
  const fileInfo = payload.fileName ? `\n\nFile: ${payload.fileName}` : ""
  const text = (notif.customMessage || `Your automation "${automationName}" was triggered.`) + fileInfo

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "notifications@ads.patigroup.com", to: recipients, subject, text }),
  })
  const data = await res.json()
  if (!res.ok) return { event: "send_notification", status: "failed", message: data.message ?? "Email failed" }
  addLog(logs, `Email sent to ${recipients.join(", ")}`)
  return { event: "send_notification", status: "success", message: `Email sent to ${recipients.join(", ")}` }
}

export async function executeAutomation(
  automationId: string,
  orgId: string,
  options: {
    fileId?: string
    fileName?: string
    fileUrl?: string
    mimeType?: string
    thumbnailUrl?: string
    isTest?: boolean
  } = {}
): Promise<ExecutionResult> {
  const startMs = Date.now()
  const logs: StepLog[] = []
  const actionResults: ActionResult[] = []
  const triggerPayload: TriggerPayload = {
    fileId: options.fileId,
    fileName: options.fileName,
    fileUrl: options.fileUrl,
    mimeType: options.mimeType,
    thumbnailUrl: options.thumbnailUrl,
  }

  try {
    const supabase = createAdminClient()

    addLog(logs, `Looking up automation ${automationId}`)
    const { data: automation, error } = await supabase
      .from("automations")
      .select("*")
      .eq("id", automationId)
      .eq("org_id", orgId)
      .single()

    if (error || !automation) {
      addLog(logs, `Automation not found: ${error?.message ?? "unknown"}`, "error")
      return { status: "failed", logs, triggerPayload, actionResults, durationMs: Date.now() - startMs }
    }

    addLog(logs, `Automation: "${automation.name}"`)
    if (options.isTest) addLog(logs, "=== TEST WITH SPECIFIC FILE MODE ===")

    if (options.fileId) {
      addLog(logs, `Using specific file ID: ${options.fileId}`)
      addLog(logs, `File: ${options.fileName ?? options.fileId}`)
      addLog(logs, `Type: ${options.mimeType ?? "unknown"}`)
    }

    const actions: (ActionConfig & Record<string, any>)[] = Array.isArray(automation.actions)
      ? automation.actions
      : []

    addLog(logs, `Actions: ${actions.length} configured`)

    // Fetch Meta token if needed
    let fbToken: string | null = null
    const META_ACTIONS = new Set(["pause_campaign", "pause_adset", "increase_budget", "decrease_budget", "duplicate_ad"])
    if (actions.some(a => META_ACTIONS.has(a.event))) {
      addLog(logs, "Fetching Meta connection...")
      const conn = await getFacebookConnection(orgId)
      fbToken = conn?.access_token ?? null
      if (!fbToken) addLog(logs, "No Meta connection — Meta actions will be skipped", "warn")
      else addLog(logs, "Meta connection found")
    }

    // Execute each action
    for (const action of actions) {
      addLog(logs, `--- Executing action: ${action.event} ---`)
      let result: ActionResult

      if (action.event === "send_notification") {
        result = await execNotification(action, triggerPayload, automation.name, logs)
      } else if (META_ACTIONS.has(action.event)) {
        if (!fbToken) {
          result = { event: action.event, status: "skipped", message: "No Meta connection" }
        } else {
          result = await execMetaAction(action, triggerPayload, fbToken, logs)
        }
      } else {
        addLog(logs, `WARNING: Unsupported action type: ${action.event} — skipping`, "warn")
        result = { event: action.event, status: "skipped", message: `Action "${action.event}" not yet implemented` }
      }

      actionResults.push(result)
      addLog(logs, `Result: ${result.status} — ${result.message}`)
    }

    const overallStatus: "success" | "failed" | "skipped" =
      actionResults.length === 0 ? "skipped"
      : actionResults.some(r => r.status === "failed") ? "failed"
      : actionResults.every(r => r.status === "success") ? "success"
      : "skipped"

    const durationMs = Date.now() - startMs
    addLog(logs, `Completed in ${durationMs}ms — ${overallStatus}`)

    // Log to automation_executions
    const { data: exec } = await supabase
      .from("automation_executions")
      .insert({
        org_id: orgId,
        automation_id: automationId,
        automation_name: automation.name,
        status: overallStatus,
        entities_affected: actionResults.filter(r => r.status === "success").length,
        api_calls: actionResults.length,
        action_taken: actions.map(a => a.event).join(", ") || "none",
        ad_account_id: automation.ad_account_ids?.[0] ?? null,
        details: { isTest: options.isTest ?? false, triggerPayload, actionResults, logs },
      })
      .select("id")
      .single()

    // Update run stats
    await supabase
      .from("automations")
      .update({ run_count: (automation.run_count ?? 0) + 1, last_run_at: new Date().toISOString() })
      .eq("id", automationId)

    return { status: overallStatus, logs, triggerPayload, actionResults, durationMs, executionDbId: exec?.id }
  } catch (err: any) {
    addLog(logs, `Fatal error: ${err.message}`, "error")
    return { status: "failed", logs, triggerPayload, actionResults, durationMs: Date.now() - startMs }
  }
}
