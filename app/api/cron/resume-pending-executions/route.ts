/**
 * GET /api/cron/resume-pending-executions
 * Runs every 5 minutes — resumes executions that were paused for a delay.
 * Also expires approval requests that have timed out.
 * Auth: Bearer CRON_SECRET
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient }         from "@/lib/supabase/admin"
import { resumeAutomation }          from "@/lib/automation-engine"

export const runtime     = "nodejs"
export const dynamic     = "force-dynamic"
export const maxDuration = 120

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db  = createAdminClient()
  const now = new Date().toISOString()

  const results: { executionId: string; type: string; status: string; error?: string }[] = []

  // ── 1. Resume delay executions whose resume_at has passed ──────────────────
  const { data: pendingDelay } = await db
    .from("automation_executions")
    .select("id, details, automation_name")
    .eq("status", "pending")
    .filter("details->action_taken", "eq", '"delay"')

  for (const exec of pendingDelay ?? []) {
    const details   = exec.details as any
    const resumeAt  = details?.resumeAt
    if (!resumeAt || resumeAt > now) continue  // not ready yet

    try {
      const result = await resumeAutomation(exec.id)
      results.push({ executionId: exec.id, type: "delay_resume", status: result.status })
      console.log(`[resume-pending] Resumed delay execution ${exec.id} → ${result.status}`)
    } catch (err: any) {
      results.push({ executionId: exec.id, type: "delay_resume", status: "error", error: err.message })
    }
  }

  // ── 2. Expire timed-out approval requests ──────────────────────────────────
  const { data: pendingApprovals } = await db
    .from("automation_approvals")
    .select("id, details, execution_id, automation_name, created_at")
    .eq("status", "pending")

  for (const approval of pendingApprovals ?? []) {
    const timeoutHours = (approval.details as any)?.timeoutHours ?? 24
    const createdAt    = new Date(approval.created_at).getTime()
    if (Date.now() - createdAt < timeoutHours * 3_600_000) continue  // not expired yet

    // Mark approval as rejected (timeout)
    await db.from("automation_approvals").update({
      status: "rejected",
      reviewed_at: now,
    }).eq("id", approval.id)

    // Mark execution as failed
    if (approval.execution_id) {
      await db.from("automation_executions").update({
        status: "failed",
        details: { expiredAt: now, reason: `Approval timed out after ${timeoutHours}h` },
      }).eq("id", approval.execution_id)
    }

    results.push({ executionId: approval.execution_id ?? "", type: "approval_timeout", status: "expired" })
    console.log(`[resume-pending] Approval ${approval.id} expired for "${approval.automation_name}"`)
  }

  const resumed  = results.filter(r => r.type === "delay_resume").length
  const expired  = results.filter(r => r.type === "approval_timeout").length
  const errored  = results.filter(r => r.error).length

  return NextResponse.json({ ok: true, resumed, expired, errored, results, ranAt: now })
}
