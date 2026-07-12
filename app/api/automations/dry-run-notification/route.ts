/**
 * POST /api/automations/dry-run-notification
 * Tests notification sending with current UI config (not saved to DB).
 * Used by the "Dry-run this notification" button in ActionConfigPanel.
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { sendEmail } from "@/lib/send-email"
import { buildNotificationEmail } from "@/lib/email-template"
import { sendLarkMessage, sendLarkGroupMessage } from "@/lib/send-lark"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { notification } = body

    if (!notification) return NextResponse.json({ error: "notification config required" }, { status: 400 })

    const results: string[] = []
    const errors: string[]  = []

    // ── Email ──────────────────────────────────────────────────────────────────
    const recipients: string[] = notification.emailRecipients ?? []
    if (recipients.length && (notification.via === "email" || notification.via === "both" || !notification.via)) {
      {
        const { subject, html, text } = buildNotificationEmail({
          automationName: "Automation Test",
          message: notification.customMessage
            ? `[DRY-RUN]\n\n${notification.customMessage}\n\nℹ️ Template variables ({{trigger.summary}} etc.) will be filled with real data when the automation runs.`
            : "[DRY-RUN] Automation notification is configured correctly.",
          status: "info",
        })
        const emailResult = await sendEmail({ to: recipients, subject: "🧪 " + subject, html, text })
        if (!emailResult.ok) errors.push(`Email: ${emailResult.error ?? "failed"}`)
        else results.push(`email → ${recipients.join(", ")}`)
      }
    }

    // ── Slack ──────────────────────────────────────────────────────────────────
    const webhookUrl: string = notification.slackWebhookUrl ?? ""
    if (webhookUrl && (notification.via === "slack" || notification.via === "both")) {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "🧪 *Dry-run test* — Automation notification is configured correctly.",
        }),
      })
      if (!res.ok) errors.push(`Slack: HTTP ${res.status}`)
      else results.push("slack webhook")
    }

    // ── Lark ───────────────────────────────────────────────────────────────────
    const larkRecipients: string[] = notification.larkRecipients ?? []
    const larkChatId: string = notification.larkChatId ?? ""
    if ((larkRecipients.length || larkChatId) && notification.via === "lark") {
      if (larkRecipients.length) {
        const r = await sendLarkMessage({ recipients: larkRecipients, title: "🧪 Dry-run Test", message: "Automation notification is configured correctly. This is a test message." })
        if (!r.ok) errors.push(`Lark DM: ${r.error}`)
        else results.push(`lark → ${larkRecipients.join(", ")}`)
      }
      if (larkChatId) {
        const r = await sendLarkGroupMessage({ chatId: larkChatId, title: "🧪 Dry-run Test", message: "Automation notification is configured correctly." })
        if (!r.ok) errors.push(`Lark group: ${r.error}`)
        else results.push("lark group")
      }
    }

    if (results.length === 0 && errors.length === 0) {
      return NextResponse.json({ ok: false, error: "No notification channels configured (add email, Slack, or Lark)" })
    }
    if (errors.length > 0 && results.length === 0) {
      return NextResponse.json({ ok: false, error: errors.join("; ") })
    }

    return NextResponse.json({
      ok: true,
      message: `Sent via: ${results.join(", ")}${errors.length ? ` (warnings: ${errors.join(", ")})` : ""}`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
