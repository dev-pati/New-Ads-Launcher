/**
 * GET /api/automations/executions/[id]/reject?token=<approval_id>
 * Called when an approver clicks the reject link in their email.
 * Marks the execution as failed/rejected.
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient }         from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: executionId } = await params
  const token = request.nextUrl.searchParams.get("token")

  if (!token) return new NextResponse("Missing token", { status: 400 })

  const db = createAdminClient()

  const { data: approval } = await db
    .from("automation_approvals")
    .select("*")
    .eq("id", token)
    .eq("execution_id", executionId)
    .eq("status", "pending")
    .single()

  if (!approval) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center">
        <h2>❌ Invalid or already processed</h2>
      </body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } }
    )
  }

  // Mark approval as rejected
  await db.from("automation_approvals").update({
    status:      "rejected",
    reviewed_at: new Date().toISOString(),
  }).eq("id", token)

  // Mark execution as failed
  await db.from("automation_executions").update({
    status: "failed",
    details: { rejectedAt: new Date().toISOString(), rejectedBy: "approver" },
  }).eq("id", executionId)

  return new NextResponse(
    `<html><body style="font-family:sans-serif;padding:40px;text-align:center">
      <h2>❌ Rejected</h2>
      <p>Automation "${approval.automation_name}" has been rejected. No actions will be executed.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/automate">← Back to Automations</a></p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  )
}
