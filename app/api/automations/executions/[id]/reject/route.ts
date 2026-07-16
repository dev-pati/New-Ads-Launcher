/**
 * GET /api/automations/executions/[id]/reject?token=<signed>
 * HMAC-signed token (approvalId + executionId + action + exp).
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
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

  const payload = verifyApprovalToken(token, { executionId, action: "reject" })
  if (!payload) {
    return html("<h2>❌ Invalid or already processed</h2>", 400)
  }

  const db = createAdminClient()

  const { data: approval } = await db
    .from("automation_approvals")
    .select("*")
    .eq("id", payload.approvalId)
    .eq("execution_id", executionId)
    .eq("status", "pending")
    .single()

  if (!approval) {
    return html("<h2>❌ Invalid or already processed</h2>", 400)
  }

  const { data: updated } = await db
    .from("automation_approvals")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", payload.approvalId)
    .eq("status", "pending")
    .select("id")
    .single()

  if (!updated) {
    return html("<h2>⏰ Already processed</h2>", 409)
  }

  await db
    .from("automation_executions")
    .update({
      status: "failed",
      details: { rejectedAt: new Date().toISOString(), rejectedBy: "approver" },
    })
    .eq("id", executionId)

  return html(
    `<h2>❌ Rejected</h2>
     <p>Automation "${approval.automation_name}" has been rejected. No actions will be executed.</p>
     <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/automate">← Back to Automations</a></p>`
  )
}
