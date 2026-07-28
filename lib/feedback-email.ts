/**
 * feedback-email.ts — Launch/Feedback loop notifications.
 * On new feedback: PO gets the ticket (BOM cc'd), reporter gets a receipt, PM alert gets a short ping.
 * One thread — PO/BOM reply to each other by normal email, no reply-to-ticket feature.
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/send-email"

const PM_ALERT_EMAIL = process.env.FEEDBACK_ALERT_EMAIL || "thanhtin@patigroup.com"

interface FeedbackRow {
  id: string
  feature_area: string
  feature_function: string
  severity: string
  observed_evidence: string
  expected_result: string
  user_email: string | null
}

async function getRecipients(orgId: string): Promise<{ po: string | null; bom: string | null; orgName: string }> {
  const db = createAdminClient()
  const { data: org } = await db
    .from("organizations")
    .select("name, feedback_po_email, feedback_bom_email")
    .eq("id", orgId)
    .single()

  return {
    po: org?.feedback_po_email || process.env.FEEDBACK_PO_EMAIL || null,
    bom: org?.feedback_bom_email || process.env.FEEDBACK_BOM_EMAIL || null,
    orgName: org?.name || "AdLauncher",
  }
}

// Best-effort: never throws, never blocks the ticket insert.
export async function sendFeedbackNotifications(row: FeedbackRow, orgId: string) {
  try {
    const { po, bom, orgName } = await getRecipients(orgId)
    const shortId = row.id.slice(0, 8)
    const subjectTag = `[${row.feature_area}/${row.feature_function}] ${shortId}`

    if (po) {
      await sendEmail({
        to: po,
        ...(bom ? { cc: bom } as never : {}),
        subject: `New feedback — ${subjectTag}`,
        text: `New feedback ticket from ${orgName}.

Feature: ${row.feature_area} / ${row.feature_function}
Severity: ${row.severity}
Reporter: ${row.user_email || "unknown"}

Observed:
${row.observed_evidence}

Expected:
${row.expected_result}

Ticket: ${shortId}`,
      })
    }

    if (row.user_email) {
      await sendEmail({
        to: row.user_email,
        subject: `We received your feedback — ${subjectTag}`,
        text: `Hi,

Thanks for the report. Your feedback ticket ${shortId} (${row.feature_area} / ${row.feature_function}) has been received${po ? ` and is being handled by ${po}` : ""}.

We'll follow up if we need more details.

AdLauncher Product Team`,
      })
    }

    // Ping alert email
    await sendEmail({
      to: PM_ALERT_EMAIL,
      subject: `New feedback received: ${subjectTag}`,
      text: `Bạn vừa nhận 1 feedback về, vui lòng mở ads.patigroup.com/pm-feedback check ngay`,
    })
  } catch (err) {
    console.error("feedback notification failed:", err)
  }
}
