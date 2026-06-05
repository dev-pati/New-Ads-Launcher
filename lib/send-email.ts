/**
 * send-email.ts — Universal email sender
 * Priority: Gmail SMTP (if configured) → Resend API
 * Gmail SMTP can send to any recipient without domain verification.
 */
import nodemailer from "nodemailer"

interface SendEmailOptions {
  to: string | string[]
  subject: string
  text: string
  html?: string
}

export async function sendEmail({ to, subject, text, html }: SendEmailOptions): Promise<{ ok: boolean; error?: string }> {
  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD

  // ── Gmail SMTP ───────────────────────────────────────────────────────────────
  if (gmailUser && gmailPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
      })
      await transporter.sendMail({
        from: `"AdLauncher" <${gmailUser}>`,
        to:   Array.isArray(to) ? to.join(", ") : to,
        subject,
        text,
        html: html ?? text.replace(/\n/g, "<br>"),
      })
      return { ok: true }
    } catch (err: any) {
      console.error("[send-email] Gmail SMTP failed:", err.message)
      // Fall through to Resend
    }
  }

  // ── Resend API fallback ───────────────────────────────────────────────────────
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return { ok: false, error: "No email provider configured (GMAIL_USER or RESEND_API_KEY)" }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
      to:   Array.isArray(to) ? to : [to],
      subject, text,
    }),
  })
  const data = await res.json()
  if (!res.ok) return { ok: false, error: data.message ?? "Resend failed" }
  return { ok: true }
}
