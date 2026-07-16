/**
 * GET /api/automations/executions/[id]/approve?token=<signed>
 * HMAC-signed token (approvalId + executionId + action + exp).
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { resumeAutomation } from "@/lib/automation-engine"
import { verifyApprovalToken } from "@/lib/approval-token"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function html(body: string, status = 200) {
  return new NextResponse(
    `<html><body style="font-family:sans-serif;padding:40px;text-align:center">${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html" } }
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: executionId } = await params
  const token = request.nextUrl.searchParams.get("token")

  const payload = verifyApprovalToken(token, { executionId, action: "approve" })
  if (!payload) {
    return html("<h2>❌ Invalid or expired approval link</h2><p>This approval may have already been processed or the link has expired.</p>", 400)
  }

  const db = createAdminClient()

  const { data: approval, error } = await db
    .from("automation_approvals")
    .select("*")
    .eq("id", payload.approvalId)
    .eq("execution_id", executionId)
    .eq("status", "pending")
    .single()

  if (error || !approval) {
    return html("<h2>❌ Invalid or expired approval link</h2><p>This approval may have already been processed or the link has expired.</p>", 400)
  }

  const timeoutHours = approval.details?.timeoutHours ?? 24
  const createdAt = new Date(approval.created_at).getTime()
  if (Date.now() - createdAt > timeoutHours * 3_600_000) {
    await db
      .from("automation_approvals")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", payload.approvalId)
    return html(`<h2>⏰ Approval link expired</h2><p>This approval request expired after ${timeoutHours} hours.</p>`, 400)
  }

  const { data: updated } = await db
    .from("automation_approvals")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", payload.approvalId)
    .eq("status", "pending")
    .select("id")
    .single()

  if (!updated) {
    return html("<h2>⏰ Already processed</h2><p>This approval was already handled (approved, rejected, or timed out).</p>", 409)
  }

  try {
    const result = await resumeAutomation(executionId)
    return html(
      `<h2>✅ Approved!</h2>
       <p>Automation "${approval.automation_name}" has been approved and is now executing.</p>
       <p style="color:#666">Status: ${result.status}</p>
       <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/automate">← Back to Automations</a></p>`
    )
  } catch (err: any) {
    return html(`<h2>✅ Approved — but execution failed</h2><p>Error: ${err.message}</p>`)
  }
}
