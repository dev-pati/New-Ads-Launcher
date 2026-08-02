import nodemailer, { type Transporter } from "nodemailer"
import { sendEmail } from "@/lib/send-email"

let transporter: Transporter | null = null

function getTransporter() {
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

export async function sendOtpEmail(to: string, otp: string): Promise<{ ok: boolean; error?: string }> {
  const tx = getTransporter()
  const subject = `Your AdLauncher login code: ${otp}`
  const text = `Your AdLauncher login code is ${otp}. This code expires in 10 minutes. If you didn't request this, you can ignore this email.`
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Your login code</h2>
      <p style="font-size: 32px; font-weight: 700; letter-spacing: 4px;">${otp}</p>
      <p style="color: #666; font-size: 14px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
    </div>
  `

  if (!tx) return sendEmail({ to, subject, text, html })

  try {
    await tx.sendMail({
      from: `AdLauncher <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    })
    return { ok: true }
  } catch (error) {
    console.error("[smtp-email] SMTP failed, falling back to Resend", error)
    return sendEmail({ to, subject, text, html })
  }
}
