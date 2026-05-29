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
    // ── Pause ────────────────────────────────────────────────────────────────
    case "pause_ad":
    case "pause_campaign":
    case "pause_adset": {
      const ids = action.targetIds?.length ? action.targetIds : payload.entityIds?.length ? payload.entityIds : (action.targetId ? [action.targetId] : [])
      if (!ids.length) return { event: ev, status: "skipped", message: "No target IDs configured" }
      const results = await Promise.all(ids.map(async id => {
        const res = await fetch(`${GRAPH}/${id}?access_token=${token}`, {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ status: "PAUSED" }).toString(),
        })
        return res.json()
      }))
      const failed = results.filter(r => r.error)
      if (failed.length) return { event: ev, status: "failed", message: failed[0].error.message }
      addLog(logs, `${ev}: paused ${ids.length} item(s)`)
      return { event: ev, status: "success", message: `Paused ${ids.length} item(s)`, data: { ids } }
    }

    // ── Enable ────────────────────────────────────────────────────────────────
    case "enable_ad":
    case "enable_campaign":
    case "enable_adset": {
      const ids = action.targetIds?.length ? action.targetIds : payload.entityIds?.length ? payload.entityIds : (action.targetId ? [action.targetId] : [])
      if (!ids.length) return { event: ev, status: "skipped", message: "No target IDs configured" }
      const results = await Promise.all(ids.map(async id => {
        const res = await fetch(`${GRAPH}/${id}?access_token=${token}`, {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ status: "ACTIVE" }).toString(),
        })
        return res.json()
      }))
      const failed = results.filter(r => r.error)
      if (failed.length) return { event: ev, status: "failed", message: failed[0].error.message }
      addLog(logs, `${ev}: enabled ${ids.length} item(s)`)
      return { event: ev, status: "success", message: `Enabled ${ids.length} item(s)`, data: { ids } }
    }

    // ── Budget ────────────────────────────────────────────────────────────────
    case "increase_budget":
    case "decrease_budget":
    case "change_budget": {
      const ids = action.targetIds?.length ? action.targetIds : payload.entityIds?.length ? payload.entityIds : (action.targetId ? [action.targetId] : [])
      if (!ids.length) return { event: ev, status: "skipped", message: "No target IDs configured" }

      const budgetField = action.budgetType === "lifetime" ? "lifetime_budget" : "daily_budget"
      const change      = action.budgetChange
      const operation   = action.budgetOperation ?? (ev === "increase_budget" ? "increase" : ev === "decrease_budget" ? "decrease" : "increase")
      const amount      = action.budgetAmount ?? change?.amount ?? 0
      const isPercent   = (action.budgetAmountType ?? change?.unit ?? "%") === "percentage" || (change?.unit === "%")

      const updates = await Promise.all(ids.map(async id => {
        const fetchRes = await fetch(`${GRAPH}/${id}?fields=${budgetField}&access_token=${token}`)
        const fetchData = await fetchRes.json()
        if (fetchData.error) return { id, error: fetchData.error.message }

        const current = parseInt(fetchData[budgetField] ?? "0")
        let next: number
        if (operation === "set") {
          next = Math.round(amount * 100)
        } else if (isPercent) {
          const factor = operation === "increase" ? (1 + amount / 100) : (1 - amount / 100)
          next = Math.round(current * factor)
        } else {
          const delta = Math.round(amount * 100)
          next = operation === "increase" ? current + delta : current - delta
        }
        next = Math.max(next, 100)

        const res = await fetch(`${GRAPH}/${id}?access_token=${token}`, {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ [budgetField]: String(next) }).toString(),
        })
        const data = await res.json()
        if (data.error) return { id, error: data.error.message }
        return { id, prev: current, next }
      }))

      const failed = updates.filter(r => r.error)
      if (failed.length) return { event: ev, status: "failed", message: (failed[0] as any).error }
      addLog(logs, `${ev}: updated budget for ${ids.length} item(s)`)
      return { event: ev, status: "success", message: `Budget updated for ${ids.length} item(s)`, data: { updates } }
    }

    // ── Duplicate ─────────────────────────────────────────────────────────────
    case "duplicate_ad":
    case "duplicate_adset":
    case "duplicate_campaign": {
      const ids = action.targetIds?.length ? action.targetIds : payload.entityIds?.length ? payload.entityIds : (action.targetId ?? action.templateAdSetId ? [action.targetId ?? action.templateAdSetId!] : [])
      if (!ids.length) return { event: ev, status: "skipped", message: "No target IDs configured" }

      const copies     = action.duplicateCopies ?? 1
      const statusOpt  = action.duplicateStatus ?? "PAUSED"
      const deepCopy   = ev !== "duplicate_ad"

      const results = await Promise.all(ids.map(async id => {
        const qs = new URLSearchParams({ access_token: token, status_option: statusOpt, deep_copy: String(deepCopy) })
        if (copies > 1) qs.set("count", String(copies))
        const res = await fetch(`${GRAPH}/${id}/copies?${qs}`, { method: "POST" })
        const data = await res.json()
        if (data.error) return { id, error: data.error.message }
        const newId = data.copied_adset_id ?? data.copied_campaign_id ?? data.id
        return { id, newId }
      }))

      const failed = results.filter(r => (r as any).error)
      if (failed.length) return { event: ev, status: "failed", message: (failed[0] as any).error }
      addLog(logs, `${ev}: duplicated ${ids.length} item(s)`)
      return { event: ev, status: "success", message: `Duplicated ${ids.length} item(s)`, data: { results } }
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

// ─── Google Sheets action executor ───────────────────────────────────────────

async function execSheetsAction(
  action: ActionConfig,
  payload: TriggerPayload,
  logs: StepLog[]
): Promise<ActionResult> {
  const ev = action.event
  const spreadsheetId = action.actionSheetsSpreadsheetId
  const sheetName     = action.actionSheetsSheetName ?? "Sheet1"

  if (!spreadsheetId) {
    addLog(logs, `${ev}: no spreadsheet configured`, "warn")
    return { event: ev, status: "skipped", message: "No spreadsheet configured" }
  }

  try {
    const { saReadRange } = await import("@/lib/google-sheets-sa")
    const { google }      = await import("googleapis")

    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    if (!raw) return { event: ev, status: "failed", message: "GOOGLE_SERVICE_ACCOUNT_JSON not configured" }

    const auth = new (await import("googleapis")).google.auth.GoogleAuth({
      credentials: JSON.parse(raw),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })
    const sheets = google.sheets({ version: "v4", auth })

    if (ev === "add_sheet_row" || ev === "update_sheet_row") {
      const mappings: { column: string; value: string }[] = action.actionSheetsColumnMappings ?? []

      // Build row values by resolving template variables
      const resolveValue = (template: string) => {
        return template
          .replace("{{filename}}", payload.fileName ?? "")
          .replace("{{fileUrl}}", payload.fileUrl ?? "")
          .replace("{{date}}", new Date().toISOString().split("T")[0])
          .replace("{{mimeType}}", payload.mimeType ?? "")
      }

      const values = mappings.map(m => resolveValue(m.value))

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: sheetName,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [values] },
      })

      addLog(logs, `${ev}: appended row to ${sheetName}`)
      return { event: ev, status: "success", message: `Row appended to ${sheetName}` }
    }

    if (ev === "update_sheet_cell") {
      const cellRef  = action.actionSheetsCellRef ?? "A1"
      const value    = action.actionSheetsCellValue ?? ""
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!${cellRef}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[value]] },
      })
      addLog(logs, `${ev}: updated ${sheetName}!${cellRef} = "${value}"`)
      return { event: ev, status: "success", message: `Cell ${cellRef} updated` }
    }

    return { event: ev, status: "skipped", message: `Unsupported sheets action: ${ev}` }
  } catch (err: any) {
    addLog(logs, `${ev} error: ${err.message}`, "error")
    return { event: ev, status: "failed", message: err.message }
  }
}

// ─── Media Library action executor ───────────────────────────────────────────

async function execMediaLibraryAction(
  action: ActionConfig,
  payload: TriggerPayload,
  orgId: string,
  logs: StepLog[]
): Promise<ActionResult> {
  const ev = action.event
  if (!payload.fileUrl) return { event: ev, status: "skipped", message: "No file URL in trigger payload" }

  try {
    const db       = createAdminClient()
    const boardId  = action.actionMediaBoardId

    // Build file name from naming template
    const template = action.actionMediaNamingTemplate ?? "{originalName}"
    const ext      = payload.fileName?.match(/\.[^.]+$/)?.[0] ?? ""
    const baseName = payload.fileName?.replace(/\.[^.]+$/, "") ?? "file"
    const fileName = template
      .replace("{originalName}", baseName)
      .replace("{date}", new Date().toISOString().split("T")[0])
      .replace("{boardName}", action.actionMediaBoardName ?? "")
      .replace("{counter}", "1") + ext

    // Insert creative record
    const { data: creative, error } = await db
      .from("creatives")
      .insert({
        org_id:     orgId,
        user_id:    "00000000-0000-0000-0000-000000000000", // system
        file_name:  fileName,
        file_url:   payload.fileUrl,
        media_type: (payload.mimeType ?? "").startsWith("video") ? "video" : "image",
        status:     "ready",
        tags:       [],
      })
      .select("id")
      .single()

    if (error) return { event: ev, status: "failed", message: error.message }

    // Associate with board if specified
    if (boardId && creative?.id) {
      await db.from("board_assets").insert({ board_id: boardId, creative_id: creative.id })
    }

    addLog(logs, `${ev}: uploaded "${fileName}" to media library`)
    return { event: ev, status: "success", message: `Uploaded "${fileName}" to media library`, data: { creativeId: creative?.id } }
  } catch (err: any) {
    addLog(logs, `${ev} error: ${err.message}`, "error")
    return { event: ev, status: "failed", message: err.message }
  }
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
    const META_ACTIONS = new Set([
      "pause_ad", "pause_campaign", "pause_adset",
      "enable_ad", "enable_campaign", "enable_adset",
      "duplicate_ad", "duplicate_adset", "duplicate_campaign",
      "increase_budget", "decrease_budget", "change_budget",
    ])
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
      } else if (["add_sheet_row", "update_sheet_cell", "update_sheet_row"].includes(action.event)) {
        result = await execSheetsAction(action, triggerPayload, logs)
      } else if (action.event === "upload_to_media_library") {
        result = await execMediaLibraryAction(action, triggerPayload, orgId, logs)
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
