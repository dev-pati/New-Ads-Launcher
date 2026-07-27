import nodemailer from "nodemailer"

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null

function getTransporter() {
  if (transporter) return transporter
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 465,
    secure: Number(SMTP_PORT) !== 587,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
  return transporter
}

export async function sendOtpEmail(to: string, otp: string): Promise<{ ok: boolean; error?: string }> {
  const tx = getTransporter()
  if (!tx) return { ok: false, error: "SMTP not configured" }

  try {
    await tx.sendMail({
      from: `AdLauncher <${process.env.SMTP_USER}>`,
      to,
      subject: `Your AdLauncher login code: ${otp}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Your login code</h2>
          <p style="font-size: 32px; font-weight: 700; letter-spacing: 4px;">${otp}</p>
          <p style="color: #666; font-size: 14px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
        </div>
      `,
    })
    return { ok: true }
  } catch (err: any) {
    console.error("[smtp-email] failed to send OTP to", to, "—", err)
    return { ok: false, error: err?.message || "SMTP send failed" }
  }
}
