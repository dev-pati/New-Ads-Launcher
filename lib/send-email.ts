/**
 * send-email.ts — Email sender via Resend API
 * Vercel serverless blocks SMTP, so Resend is the only option on production.
 */

interface SendEmailOptions {
  to: string | string[]
  subject: string
  text: string
  html?: string
}

export async function sendEmail({ to, subject, text, html }: SendEmailOptions): Promise<{ ok: boolean; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return { ok: false, error: "RESEND_API_KEY not configured" }

  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      text,
      html: html ?? text.replace(/\n/g, "<br>"),
    }),
  })

  const data = await res.json()
  if (!res.ok) return { ok: false, error: data.message ?? "Resend failed" }
  return { ok: true }
}
