/**
 * GET /api/automations/executions/[id]/approve?token=<approval_id>
 * Called when an approver clicks the approve link in their email.
 * Resumes the paused automation execution.
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient }         from "@/lib/supabase/admin"
import { resumeAutomation }          from "@/lib/automation-engine"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: executionId } = await params
  const token = request.nextUrl.searchParams.get("token") // approval record id

  if (!token) {
    return new NextResponse("Missing token", { status: 400 })
  }

  const db = createAdminClient()

  // Verify approval record exists and is still pending
  const { data: approval, error } = await db
    .from("automation_approvals")
    .select("*")
    .eq("id", token)
    .eq("execution_id", executionId)
    .eq("status", "pending")
    .single()

  if (error || !approval) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center">
        <h2>❌ Invalid or expired approval link</h2>
        <p>This approval may have already been processed or the link has expired.</p>
      </body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } }
    )
  }

  // Check timeout
  const timeoutHours = approval.details?.timeoutHours ?? 24
  const createdAt    = new Date(approval.created_at).getTime()
  if (Date.now() - createdAt > timeoutHours * 3_600_000) {
    await db.from("automation_approvals").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", token)
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center">
        <h2>⏰ Approval link expired</h2>
        <p>This approval request expired after ${timeoutHours} hours.</p>
      </body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } }
    )
  }

  // Mark as approved — use conditional update to prevent race with cron timeout
  const { data: updated } = await db
    .from("automation_approvals")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", token)
    .eq("status", "pending") // only update if still pending (race guard)
    .select("id")
    .single()

  if (!updated) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center">
        <h2>⏰ Already processed</h2>
        <p>This approval was already handled (approved, rejected, or timed out).</p>
      </body></html>`,
      { status: 409, headers: { "Content-Type": "text/html" } }
    )
  }

  // Resume the execution
  try {
    const result = await resumeAutomation(executionId)
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center">
        <h2>✅ Approved!</h2>
        <p>Automation "${approval.automation_name}" has been approved and is now executing.</p>
        <p style="color:#666">Status: ${result.status}</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/automate">← Back to Automations</a></p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    )
  } catch (err: any) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center">
        <h2>✅ Approved — but execution failed</h2>
        <p>Error: ${err.message}</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    )
  }
}
