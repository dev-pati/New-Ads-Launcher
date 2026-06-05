/**
 * POST /api/automations/dry-run-notification
 * Tests notification sending with current UI config (not saved to DB).
 * Used by the "Dry-run this notification" button in ActionConfigPanel.
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { sendEmail } from "@/lib/send-email"

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
        const emailResult = await sendEmail({
          to: recipients,
          subject: "🧪 Dry-run: Automation notification test",
          text: notification.customMessage
            ? `[DRY-RUN TEST]\n\n${notification.customMessage}\n\nNote: Template variables like {{trigger.summary}} will be replaced with real values when the automation fires.`
            : "[DRY-RUN TEST]\n\nThis is a test notification. Your automation is configured correctly.",
        })
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

    if (results.length === 0 && errors.length === 0) {
      return NextResponse.json({ ok: false, error: "No notification channels configured (add email or Slack)" })
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
