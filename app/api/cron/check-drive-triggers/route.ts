/**
 * GET /api/cron/check-drive-triggers
 * Daily cron — checks all active Google Drive automations.
 * Auth: Bearer CRON_SECRET
 */
import { NextRequest, NextResponse }                              from "next/server"
import { createAdminClient }                                      from "@/lib/supabase/admin"
import { checkDriveNewFile, checkDriveNewFolder }                 from "@/lib/drive-trigger-checker"
import { getGoogleTokenForOrg }                                   from "@/lib/google-token"
import { executeAutomation }                                      from "@/lib/automation-engine"

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

  // Fetch active Google Drive automations
  const { data: automations } = await db
    .from("automations")
    .select("id, org_id, name, trigger_config, actions, last_run_at")
    .eq("status", "active")

  const driveAutomations = (automations ?? []).filter(a => {
    const cfg = a.trigger_config as any
    return cfg?.appId === "google_drive" && cfg?.event && cfg?.driveFolderId
  })

  console.log(`[check-drive-triggers] Found ${driveAutomations.length} active Drive automations`)

  // Group by org to avoid multiple token refreshes per org
  const tokenCache = new Map<string, string | null>()
  const getToken = async (orgId: string) => {
    if (!tokenCache.has(orgId)) {
      tokenCache.set(orgId, await getGoogleTokenForOrg(orgId))
    }
    return tokenCache.get(orgId)!
  }

  for (const automation of driveAutomations) {
    const cfg   = automation.trigger_config as any
    const event = cfg.event as string
    const state = cfg._triggerState ?? {}

    // Respect checkFrequency (daily=24h, weekly=168h)
    const freqHours = cfg.checkFrequency === "weekly" ? 168 : 24
    if (automation.last_run_at) {
      const hoursSince = (now.getTime() - new Date(automation.last_run_at).getTime()) / 3_600_000
      if (hoursSince < freqHours) {
        results.push({ automationId: automation.id, name: automation.name, orgId: automation.org_id, event, fired: false, reason: `Skipped — ran ${hoursSince.toFixed(1)}h ago` })
        continue
      }
    }

    try {
      const token = await getToken(automation.org_id)
      if (!token) {
        results.push({ automationId: automation.id, name: automation.name, orgId: automation.org_id, event, fired: false, reason: "No Google Drive connection" })
        continue
      }

      // Check trigger
      let checkResult
      if (event === "drive_new_file_in_folder") {
        checkResult = await checkDriveNewFile(cfg, state, token)
      } else if (event === "drive_new_folder_in_folder") {
        checkResult = await checkDriveNewFolder(cfg, state, token)
      } else {
        results.push({ automationId: automation.id, name: automation.name, orgId: automation.org_id, event, fired: false, reason: `Unknown event: ${event}` })
        continue
      }

      // Update state and last_run_at
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

      // Execute for each new item (file or folder)
      const items = checkResult.items ?? []
      let lastExecId: string | undefined

      for (const item of items) {
        const execResult = await executeAutomation(automation.id, automation.org_id, {
          isTest:   false,
          fileId:   item.id,
          fileName: item.name,
          fileUrl:  item.webViewLink,
          mimeType: item.mimeType,
          thumbnailUrl: item.thumbnailLink,
        })
        lastExecId = execResult.executionDbId
      }

      // Log
      await db.from("automation_executions").insert({
        org_id:            automation.org_id,
        automation_id:     automation.id,
        automation_name:   automation.name,
        status:            "success",
        entities_affected: items.length,
        api_calls:         items.length,
        action_taken:      event,
        details: {
          trigger:       event,
          triggerReason: checkResult.reason,
          items:         items.map(i => ({ id: i.id, name: i.name, mimeType: i.mimeType })),
        },
      })

      results.push({ automationId: automation.id, name: automation.name, orgId: automation.org_id, event, fired: true, reason: checkResult.reason, executionId: lastExecId })

    } catch (err: any) {
      console.error(`[check-drive-triggers] Error for ${automation.name}:`, err.message)
      results.push({ automationId: automation.id, name: automation.name, orgId: automation.org_id, event, fired: false, reason: `Error: ${err.message}`, error: err.message })
    }
  }

  const fired   = results.filter(r => r.fired).length
  const errored = results.filter(r => r.error).length

  return NextResponse.json({ ok: true, dryRun, checked: driveAutomations.length, fired, errored, results, ranAt: now.toISOString() })
}
