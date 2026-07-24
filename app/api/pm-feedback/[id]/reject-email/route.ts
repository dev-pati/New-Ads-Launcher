import { NextRequest, NextResponse } from "next/server"
import { getPmViewer } from "@/lib/pm-feedback-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/send-email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const viewer = await getPmViewer()
    if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const reason = String(body?.reason || "").trim()
    const evidence = String(body?.evidence || "").trim()

    if (!reason) return NextResponse.json({ error: "Reason is required" }, { status: 400 })

    const db = createAdminClient()
    const { data: row, error } = await db
      .from("feedback_events")
      .select("*, org:organizations(name)")
      .eq("id", id)
      .single()

    if (error || !row) return NextResponse.json({ error: "Feedback not found" }, { status: 404 })

    if (!row.user_email) {
      return NextResponse.json({ error: "Ticket has no reporter email" }, { status: 400 })
    }

    // Personal test mode: send all emails to Raymond's registered Resend email
    const recipient = "raymond.nguyen1707@gmail.com"

    const orgName = Array.isArray(row.org) ? (row.org[0] as { name?: string } | undefined)?.name : (row.org as { name?: string } | null)?.name

    const subject = `Update on feedback ticket ${id.slice(0, 8)}`
    const text = `Hi,

Thank you for submitting feedback ticket ${id.slice(0, 8)} regarding ${row.feature_area} / ${row.feature_function}. After review, we're unable to accept it because ${reason}.

Our review confirmed that ${evidence || "the current behavior matches our system design and policy"}. This evidence shows that the reported item does not indicate a defect or actionable change.

If you have new information that may change this assessment, please reply directly to this email with the supporting evidence, and we'll gladly review the ticket again.

Best regards,
Thanh Tin
AdLauncher Product Team`

    const result = await sendEmail({
      to: recipient,
      subject,
      text,
      replyTo: "thanhtin@patigroup.com"
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Email failed" }, { status: 502 })
    }

    await db
      .from("feedback_events")
      .update({ status: "rejected", extra_note: `[rejection] ${reason} — ${evidence}`.trim(), updated_at: new Date().toISOString() })
      .eq("id", id)

    return NextResponse.json({ ok: true, sentTo: recipient })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send rejection email"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
