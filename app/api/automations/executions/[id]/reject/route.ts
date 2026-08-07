/**
 * Rejection flow for a paused automation execution.
 *
 * GET  /api/automations/executions/[id]/reject?token=<approval_id>
 *      Renders a confirmation page. Does NOT mutate — defends against CSRF-style
 *      spend mutations triggered by a single GET (email scanners, prefetch). TD-08.
 * POST /api/automations/executions/[id]/reject  (body: { token })
 *      Marks the execution as failed/rejected and updates the approval record.
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ""

type Approval = { automation_name: string }

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function htmlPage(title: string, body: string, status = 200) {
  return new NextResponse(
    `<html><body style="font-family:sans-serif;padding:40px;text-align:center">${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html" } },
  )
}

async function loadPendingApproval(executionId: string, token: string) {
  const db = createAdminClient()
  const { data: approval, error } = await db
    .from("automation_approvals")
    .select("*")
    .eq("id", token)
    .eq("execution_id", executionId)
    .eq("status", "pending")
    .single()
  if (error || !approval) return null
  return approval as Approval
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: executionId } = await params
  const token = request.nextUrl.searchParams.get("token")
  if (!token) return new NextResponse("Missing token", { status: 400 })

  const approval = await loadPendingApproval(executionId, token)
  if (!approval) {
    return htmlPage(
      "❌",
      `<h2>❌ Invalid or already processed</h2>`,
      400,
    )
  }

  // Render a confirmation form — the user must click to POST.
  return htmlPage(
    "Confirm rejection",
    `<h2>Reject automation?</h2>
     <p>Automation "<strong>${esc(approval.automation_name)}</strong>" is waiting for your review.</p>
     <form method="post" action="" style="margin-top:24px">
       <input type="hidden" name="token" value="${esc(token)}" />
       <button type="submit"
         style="padding:12px 32px;font-size:16px;background:#dc2626;color:#fff;border:none;border-radius:6px;cursor:pointer">
         ❌ Confirm rejection
       </button>
     </form>
     <p style="margin-top:24px">
       <a href="${APP_URL}/automate">← Back to Automations</a>
     </p>`,
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: executionId } = await params
  const form = await request.formData().catch(() => null)
  const token =
    (form?.get("token") as string | null) ??
    request.nextUrl.searchParams.get("token")

  if (!token) return new NextResponse("Missing token", { status: 400 })

  const approval = await loadPendingApproval(executionId, token)
  if (!approval) {
    return htmlPage(
      "❌",
      `<h2>❌ Invalid or already processed</h2>`,
      400,
    )
  }

  const db = createAdminClient()

  // Mark approval as rejected
  await db
    .from("automation_approvals")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", token)

  // Mark execution as failed
  await db
    .from("automation_executions")
    .update({
      status: "failed",
      details: { rejectedAt: new Date().toISOString(), rejectedBy: "approver" },
    })
    .eq("id", executionId)

  return htmlPage(
    "❌",
    `<h2>❌ Rejected</h2>
     <p>Automation "${esc(approval.automation_name)}" has been rejected. No actions will be executed.</p>
     <p><a href="${APP_URL}/automate">← Back to Automations</a></p>`,
  )
}
