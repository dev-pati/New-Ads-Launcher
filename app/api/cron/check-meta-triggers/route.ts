/**
 * GET /api/cron/check-meta-triggers
 * Daily cron job — checks all active Meta automations and fires those
 * whose trigger conditions are met against live Meta API data.
 *
 * Vercel cron: schedule "0 9 * * *" (9am UTC daily)
 * Auth: Bearer CRON_SECRET header required
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient }         from "@/lib/supabase/admin"
import { checkMetaTrigger }          from "@/lib/meta-trigger-checker"
import { executeAutomation }         from "@/lib/automation-engine"

export const runtime    = "nodejs"
export const dynamic    = "force-dynamic"
export const maxDuration = 300  // 5 min — may need to poll many automations

const CHECK_FREQUENCY_HOURS: Record<string, number> = {
  daily:  24,
  weekly: 168,
}

export async function GET(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // dry_run=true → only check triggers, never execute actions or update last_run_at
  const dryRun = request.nextUrl.searchParams.get("dry_run") === "true"

  const db  = createAdminClient()
  const now = new Date()

  const results: {
    automationId: string
    name: string
    orgId: string
    event: string
    fired: boolean
    reason: string
    executionId?: string
    error?: string
    entityIds?: string[]
    entityNames?: string[]
    metaData?: Record<string, any>
  }[] = []

  // ── Fetch all active Meta automations ────────────────────────────────────
  const { data: automations, error } = await db
    .from("automations")
    .select("id, org_id, name, trigger_config, actions, last_run_at, run_count")
    .eq("status", "active")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filter: only Meta app triggers
  const metaAutomations = (automations ?? []).filter(a => {
    const cfg = a.trigger_config as any
    return cfg?.appId === "meta" && cfg?.event
  })

  console.log(`[check-meta-triggers] Found ${metaAutomations.length} active Meta automations`)

  // ── Process each automation ──────────────────────────────────────────────
  for (const automation of metaAutomations) {
    const triggerConfig = automation.trigger_config as any
    const checkFreqHours = CHECK_FREQUENCY_HOURS[triggerConfig.checkFrequency ?? "daily"] ?? 24

    // Skip if ran too recently (respect check frequency)
    if (automation.last_run_at) {
      const lastRun  = new Date(automation.last_run_at)
      const hoursSince = (now.getTime() - lastRun.getTime()) / 3_600_000
      if (hoursSince < checkFreqHours) {
        results.push({
          automationId: automation.id,
          name: automation.name,
          orgId: automation.org_id,
          event: triggerConfig.event,
          fired: false,
          reason: `Skipped — ran ${hoursSince.toFixed(1)}h ago (freq: ${checkFreqHours}h)`,
        })
        continue
      }
    }

    try {
      // Get Facebook connection for this org
      const { data: conn } = await db
        .from("facebook_connections")
        .select("access_token")
        .eq("org_id", automation.org_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (!conn?.access_token) {
        results.push({
          automationId: automation.id,
          name: automation.name,
          orgId: automation.org_id,
          event: triggerConfig.event,
          fired: false,
          reason: "No active Facebook connection",
        })
        continue
      }

      // ── Check the trigger ──────────────────────────────────────────────
      const checkResult = await checkMetaTrigger(triggerConfig, conn.access_token)

      if (!checkResult.fired) {
        results.push({
          automationId: automation.id,
          name: automation.name,
          orgId: automation.org_id,
          event: triggerConfig.event,
          fired: false,
          reason: checkResult.reason,
        })
        // Update last_run_at so we don't re-check too soon (skip in dry run)
        if (!dryRun) {
          await db.from("automations")
            .update({ last_run_at: now.toISOString() })
            .eq("id", automation.id)
        }
        continue
      }

      // ── Trigger fired ─────────────────────────────────────────────────
      console.log(`[check-meta-triggers] FIRED: ${automation.name} (${triggerConfig.event}) — ${checkResult.reason}${dryRun ? " [DRY RUN]" : ""}`)

      if (dryRun) {
        // Dry run: report what would fire, but don't execute or log
        results.push({
          automationId: automation.id,
          name: automation.name,
          orgId: automation.org_id,
          event: triggerConfig.event,
          fired: true,
          reason: `[DRY RUN] ${checkResult.reason}`,
          entityIds: checkResult.entityIds,
          entityNames: checkResult.entityNames,
          metaData: checkResult.metaData,
        })
        continue
      }

      const execResult = await executeAutomation(
        automation.id,
        automation.org_id,
        {
          isTest: false,
          fileId:   checkResult.entityIds?.[0],
          fileName: checkResult.entityNames?.[0],
        }
      )

      // Log the trigger fire with full meta data
      await db.from("automation_executions").insert({
        org_id:         automation.org_id,
        automation_id:  automation.id,
        automation_name: automation.name,
        status:         execResult.status,
        entities_affected: (checkResult.entityIds ?? []).length,
        api_calls:      execResult.actionResults.length,
        action_taken:   triggerConfig.event,
        ad_account_id:  triggerConfig.adAccountIds?.[0] ?? null,
        details: {
          trigger:       triggerConfig.event,
          triggerReason: checkResult.reason,
          entityIds:     checkResult.entityIds,
          entityNames:   checkResult.entityNames,
          metaData:      checkResult.metaData,
          actionResults: execResult.actionResults,
          logs:          execResult.logs,
        },
      })

      results.push({
        automationId: automation.id,
        name: automation.name,
        orgId: automation.org_id,
        event: triggerConfig.event,
        fired: true,
        reason: checkResult.reason,
        executionId: execResult.executionDbId,
      })

    } catch (err: any) {
      console.error(`[check-meta-triggers] Error for ${automation.name}:`, err.message)
      results.push({
        automationId: automation.id,
        name: automation.name,
        orgId: automation.org_id,
        event: triggerConfig.event,
        fired: false,
        reason: `Error: ${err.message}`,
        error: err.message,
      })
    }
  }

  const fired    = results.filter(r => r.fired).length
  const skipped  = results.filter(r => !r.fired && !r.error).length
  const errored  = results.filter(r => r.error).length

  console.log(`[check-meta-triggers] Done — fired: ${fired}, skipped: ${skipped}, errors: ${errored}`)

  return NextResponse.json({
    ok: true,
    dryRun,
    checked: metaAutomations.length,
    fired,
    skipped,
    errored,
    results,
    ranAt: now.toISOString(),
    note: dryRun ? "DRY RUN — no actions executed, no Meta ads affected" : undefined,
  })
}
