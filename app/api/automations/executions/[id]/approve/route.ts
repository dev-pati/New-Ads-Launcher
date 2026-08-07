/**
 * Approval flow for a paused automation execution.
 *
 * GET  /api/automations/executions/[id]/approve?token=<approval_id>
 *      Renders a confirmation page. Does NOT mutate — defends against CSRF-style
 *      spend mutations triggered by a single GET (email scanners, prefetched
 *      links, <img> tricks). TD-08.
 * POST /api/automations/executions/[id]/approve  (body: { token })
 *      Marks the approval record as approved and resumes execution.
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { resumeAutomation } from "@/lib/automation-engine"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ""

type Approval = {
  automation_name: string
  created_at: string
  details?: { timeoutHours?: number } | null
}

function htmlPage(title: string, body: string, status = 200) {
  return new NextResponse(
    `<html><body style="font-family:sans-serif;padding:40px;text-align:center">${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html" } },
  )
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
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
      `<h2>❌ Invalid or expired approval link</h2>
       <p>This approval may have already been processed or the link has expired.</p>`,
      400,
    )
  }

  // Reject if timed out
  const timeoutHours = approval.details?.timeoutHours ?? 24
  const createdAt = new Date(approval.created_at).getTime()
  if (Date.now() - createdAt > timeoutHours * 3_600_000) {
    const db = createAdminClient()
    await db
      .from("automation_approvals")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", token)
    return htmlPage(
      "⏰",
      `<h2>⏰ Approval link expired</h2>
       <p>This approval request expired after ${timeoutHours} hours.</p>`,
      400,
    )
  }

  // Render a confirmation form — the user must click to POST.
  return htmlPage(
    "Confirm approval",
    `<h2>Approve automation?</h2>
     <p>Automation "<strong>${esc(approval.automation_name)}</strong>" is waiting for approval.</p>
     <form method="post" action="" style="margin-top:24px">
       <input type="hidden" name="token" value="${esc(token)}" />
       <button type="submit"
         style="padding:12px 32px;font-size:16px;background:#16a34a;color:#fff;border:none;border-radius:6px;cursor:pointer">
         ✅ Confirm approval
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

  // Mark as approved — conditional update prevents race with cron timeout
  const db = createAdminClient()
  const { data: updated } = await db
    .from("automation_approvals")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", token)
    .eq("status", "pending") // only update if still pending (race guard)
    .select("id")
    .single()

  if (!updated) {
    return htmlPage(
      "⏰",
      `<h2>⏰ Already processed</h2>
       <p>This approval was already handled (approved, rejected, or timed out).</p>`,
      409,
    )
  }

  try {
    const result = await resumeAutomation(executionId)
    return htmlPage(
      "✅",
      `<h2>✅ Approved!</h2>
       <p>Automation "${esc(approval.automation_name)}" has been approved and is now executing.</p>
       <p style="color:#666">Status: ${esc(result.status)}</p>
       <p><a href="${APP_URL}/automate">← Back to Automations</a></p>`,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return htmlPage(
      "⚠️",
      `<h2>✅ Approved — but execution failed</h2><p>Error: ${esc(message)}</p>`,
    )
  }
}
