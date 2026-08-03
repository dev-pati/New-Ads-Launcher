/**
 * send-email.ts — Email sender via SMTP (nodemailer).
 * Lark SMTP is the only transport. Resend removed: its sandbox rejects
 * non-owner recipients, which blocked login OTPs.
 */
import nodemailer, { type Transporter } from "nodemailer"

interface SendEmailOptions {
  to: string | string[]
  cc?: string | string[]
  subject: string
  text: string
  html?: string
  replyTo?: string
}

let transporter: Transporter | null = null

function getTransporter(): Transporter | null {
  if (transporter) return transporter

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null

  const port = Number(SMTP_PORT) || 465
  transporter = nodemailer.createTransport({
    pool: true,
    maxConnections: 2,
    maxMessages: 100,
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 10_000,
  })
  return transporter
}

export async function sendEmail({ to, cc, subject, text, html, replyTo }: SendEmailOptions): Promise<{ ok: boolean; error?: string }> {
  const tx = getTransporter()
  if (!tx) return { ok: false, error: "SMTP_HOST / SMTP_USER / SMTP_PASS not configured" }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER
  try {
    await tx.sendMail({
      from,
      to: Array.isArray(to) ? to.join(", ") : to,
      ...(cc ? { cc: Array.isArray(cc) ? cc.join(", ") : cc } : {}),
      subject,
      text,
      html: html ?? text.replace(/\n/g, "<br>"),
      ...(replyTo ? { replyTo } : {}),
    })
    return { ok: true }
  } catch (error) {
    console.error("[send-email] SMTP failed", error)
    return { ok: false, error: error instanceof Error ? error.message : "SMTP failed" }
  }
}
