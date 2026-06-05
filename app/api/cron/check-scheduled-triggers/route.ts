/**
 * GET /api/cron/check-scheduled-triggers
 * Runs every hour — fires automations whose schedule config matches the current time.
 * Handles: one_time, daily, weekly, monthly schedule frequencies.
 * Auth: Bearer CRON_SECRET
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient }         from "@/lib/supabase/admin"
import { executeAutomation }         from "@/lib/automation-engine"

export const runtime     = "nodejs"
export const dynamic     = "force-dynamic"
export const maxDuration = 120

// ─── Schedule matching ────────────────────────────────────────────────────────

function shouldFireNow(cfg: any, now: Date): boolean {
  const freq      = cfg.scheduleFrequency ?? "daily"
  const timeStr   = cfg.scheduleTime ?? "09:00"
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return false // invalid format guard
  const [hh, mm]  = timeStr.split(":").map(Number)
  if (isNaN(hh) || isNaN(mm) || hh > 23 || mm > 59) return false

  // Convert scheduleTime to UTC if timezone provided
  let targetHour = hh, targetMin = mm
  if (cfg.scheduleTimezone && cfg.scheduleTimezone !== "UTC") {
    try {
      const localNow = new Date(now.toLocaleString("en-US", { timeZone: cfg.scheduleTimezone }))
      const utcOffset = (now.getTime() - localNow.getTime()) / 3_600_000
      targetHour = (hh + Math.round(utcOffset) + 24) % 24
    } catch { /* fallback to UTC */ }
  }

  const nowHour   = now.getUTCHours()
  const nowMin    = now.getUTCMinutes()
  const nowDay    = now.getUTCDay()   // 0=Sun, 1=Mon...
  const nowDate   = now.getUTCDate()  // 1-31

  // Match time: cron runs every 5 min, so allow 5-minute window
  const timeMatches = nowHour === targetHour && nowMin >= targetMin && nowMin < targetMin + 5

  if (!timeMatches) return false

  // Check start/end date bounds
  const today = now.toISOString().split("T")[0]
  if (cfg.scheduleStartDate && today < cfg.scheduleStartDate) return false
  if (cfg.scheduleEndDate   && today > cfg.scheduleEndDate)   return false

  switch (freq) {
    case "one_time":
      return cfg.scheduleDate === today

    case "daily":
      return true

    case "weekly": {
      const dayMap: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6,
      }
      const targetDay = dayMap[cfg.scheduleDayOfWeek ?? "monday"] ?? 1
      return nowDay === targetDay
    }

    case "monthly": {
      const targetDate = cfg.scheduleDayOfMonth ?? 1
      return nowDate === targetDate
    }

    default:
      return false
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

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
    fired: boolean; reason: string; executionId?: string; error?: string
  }[] = []

  // Fetch all active scheduled automations
  const { data: automations } = await db
    .from("automations")
    .select("id, org_id, name, trigger_config, actions, last_run_at")
    .eq("status", "active")

  const scheduled = (automations ?? []).filter(a => {
    const cfg = a.trigger_config as any
    if (!cfg) { console.warn(`[check-scheduled-triggers] Automation ${a.id} has no trigger_config`); return false }
    return cfg?.appId === "schedule" || cfg?.event === "schedule"
  })

  console.log(`[check-scheduled-triggers] Found ${scheduled.length} scheduled automations, now=${now.toISOString()}`)

  for (const automation of scheduled) {
    const cfg = automation.trigger_config as any

    // Prevent double-firing — require full 60min gap for hourly, 23h for daily
    if (automation.last_run_at) {
      const lastRun     = new Date(automation.last_run_at)
      const minutesSince = (now.getTime() - lastRun.getTime()) / 60_000
      if (minutesSince < 60) {
        results.push({ automationId: automation.id, name: automation.name, orgId: automation.org_id, fired: false, reason: `Ran ${minutesSince.toFixed(0)}min ago` })
        continue
      }
    }

    const shouldFire = shouldFireNow(cfg, now)

    if (!shouldFire) {
      const freq = cfg.scheduleFrequency ?? "daily"
      const time = cfg.scheduleTime ?? "09:00"
      results.push({ automationId: automation.id, name: automation.name, orgId: automation.org_id, fired: false, reason: `Not time yet (${freq} @ ${time} UTC)` })
      continue
    }

    if (dryRun) {
      results.push({ automationId: automation.id, name: automation.name, orgId: automation.org_id, fired: true, reason: `[DRY RUN] Schedule matched: ${cfg.scheduleFrequency} @ ${cfg.scheduleTime}` })
      continue
    }

    try {
      const execResult = await executeAutomation(automation.id, automation.org_id, {
        isTest: false,
        currentDate:     now.toLocaleDateString("en-US"),
        currentDateTime: now.toLocaleString("en-US"),
        summary: `Scheduled automation "${automation.name}" triggered at ${cfg.scheduleTime} ${cfg.scheduleTimezone ?? "UTC"}`,
      })

      await db.from("automations")
        .update({ last_run_at: now.toISOString() })
        .eq("id", automation.id)

      await db.from("automation_executions").insert({
        org_id:            automation.org_id,
        automation_id:     automation.id,
        automation_name:   automation.name,
        status:            execResult.status,
        entities_affected: execResult.actionResults.filter(r => r.status === "success").length,
        api_calls:         execResult.actionResults.length,
        action_taken:      "schedule",
        details: {
          trigger:       "schedule",
          scheduleConfig: { frequency: cfg.scheduleFrequency, time: cfg.scheduleTime },
          actionResults: execResult.actionResults,
          logs:          execResult.logs,
        },
      })

      results.push({ automationId: automation.id, name: automation.name, orgId: automation.org_id, fired: true, reason: `Schedule matched: ${cfg.scheduleFrequency} @ ${cfg.scheduleTime} UTC`, executionId: execResult.executionDbId })
    } catch (err: any) {
      console.error(`[check-scheduled-triggers] Error for ${automation.name}:`, err.message)
      results.push({ automationId: automation.id, name: automation.name, orgId: automation.org_id, fired: false, reason: `Error: ${err.message}`, error: err.message })
    }
  }

  const fired   = results.filter(r => r.fired).length
  const errored = results.filter(r => r.error).length

  return NextResponse.json({ ok: true, dryRun, checked: scheduled.length, fired, errored, results, ranAt: now.toISOString() })
}
