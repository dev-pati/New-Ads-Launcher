/**
 * GET /api/cron/check-sheets-triggers
 * Daily cron — checks all active Google Sheets automations.
 * Auth: Bearer CRON_SECRET
 */
import { NextRequest, NextResponse }           from "next/server"
import { createAdminClient }                   from "@/lib/supabase/admin"
import { checkSheetsCellChanged, checkSheetsNewRows } from "@/lib/sheets-trigger-checker"
import { executeAutomation }                   from "@/lib/automation-engine"

export const runtime     = "nodejs"
export const dynamic     = "force-dynamic"
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dryRun = request.nextUrl.searchParams.get("dry_run") === "true"
  const db     = createAdminClient()
  const now    = new Date()

  const results: {
    automationId: string; name: string; orgId: string
    event: string; fired: boolean; reason: string
    executionId?: string; error?: string
  }[] = []

  // Fetch active Google Sheets automations
  const { data: automations } = await db
    .from("automations")
    .select("id, org_id, name, trigger_config, actions, last_run_at")
    .eq("status", "active")

  const sheetsAutomations = (automations ?? []).filter(a => {
    const cfg = a.trigger_config as any
    return cfg?.appId === "sheets" && cfg?.event && cfg?.sheetsSpreadsheetId
  })

  console.log(`[check-sheets-triggers] Found ${sheetsAutomations.length} active Sheets automations`)

  for (const automation of sheetsAutomations) {
    const cfg   = automation.trigger_config as any
    const event = cfg.event as string
    const state = cfg._triggerState ?? {}

    // Respect checkFrequency (daily=24h, weekly=168h)
    const freqHours = cfg.sheetsCheckFrequency === "weekly" ? 168 : 24
    if (automation.last_run_at) {
      const hoursSince = (now.getTime() - new Date(automation.last_run_at).getTime()) / 3_600_000
      if (hoursSince < freqHours) {
        results.push({ automationId: automation.id, name: automation.name, orgId: automation.org_id, event, fired: false, reason: `Skipped — ran ${hoursSince.toFixed(1)}h ago` })
        continue
      }
    }

    try {
      // Check the trigger
      let checkResult
      if (event === "sheets_cell_changed") {
        checkResult = await checkSheetsCellChanged(cfg, state)
      } else if (event === "sheets_new_row_launch" || event === "sheets_new_row_catalog") {
        checkResult = await checkSheetsNewRows(cfg, state)
      } else {
        results.push({ automationId: automation.id, name: automation.name, orgId: automation.org_id, event, fired: false, reason: `Unknown event: ${event}` })
        continue
      }

      // Always update state and last_run_at
      if (!dryRun) {
        const updatedConfig = { ...cfg, _triggerState: checkResult.newState }
        await db.from("automations").update({
          trigger_config: updatedConfig,
          last_run_at: now.toISOString(),
        }).eq("id", automation.id)
      }

      if (!checkResult.fired) {
        results.push({ automationId: automation.id, name: automation.name, orgId: automation.org_id, event, fired: false, reason: checkResult.reason })
        continue
      }

      if (dryRun) {
        results.push({ automationId: automation.id, name: automation.name, orgId: automation.org_id, event, fired: true, reason: `[DRY RUN] ${checkResult.reason}` })
        continue
      }

      // Execute — pass first row data as file context if available
      const firstRow = checkResult.rows?.[0]
      const execResult = await executeAutomation(automation.id, automation.org_id, {
        isTest:   false,
        fileName: firstRow ? Object.values(firstRow).filter(Boolean).join(" | ") : undefined,
      })

      // Log execution
      await db.from("automation_executions").insert({
        org_id:            automation.org_id,
        automation_id:     automation.id,
        automation_name:   automation.name,
        status:            execResult.status,
        entities_affected: checkResult.rows?.length ?? 1,
        api_calls:         execResult.actionResults.length,
        action_taken:      event,
        details: {
          trigger:       event,
          triggerReason: checkResult.reason,
          rows:          checkResult.rows,
          cellValue:     checkResult.cellValue,
          actionResults: execResult.actionResults,
          logs:          execResult.logs,
        },
      })

      results.push({ automationId: automation.id, name: automation.name, orgId: automation.org_id, event, fired: true, reason: checkResult.reason, executionId: execResult.executionDbId })

    } catch (err: any) {
      console.error(`[check-sheets-triggers] Error for ${automation.name}:`, err.message)
      results.push({ automationId: automation.id, name: automation.name, orgId: automation.org_id, event, fired: false, reason: `Error: ${err.message}`, error: err.message })
    }
  }

  const fired   = results.filter(r => r.fired).length
  const errored = results.filter(r => r.error).length

  return NextResponse.json({ ok: true, dryRun, checked: sheetsAutomations.length, fired, errored, results, ranAt: now.toISOString() })
}
