import { Resend } from "resend"

const getResend = () => {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  return new Resend(apiKey)
}

// Use NEXT_PUBLIC_APP_URL, fallback to SERVER_URL (server-only), then warn
function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.SERVER_URL || ""
  if (!url || url.includes("localhost")) {
    console.warn("[email] NEXT_PUBLIC_APP_URL is localhost or missing — email links will not work externally. Set it to your production domain.")
  }
  return url
}

// Send invite email (user chưa có account - cần click accept)
export async function sendInviteEmail({
  to,
  orgName,
  inviterName,
  token,
}: {
  to: string
  orgName: string
  inviterName: string
  token: string
}) {
  const resend = getResend()
  if (!resend) {
    console.error("[email] RESEND_API_KEY missing — invite email not sent to:", to)
    return
  }

  const acceptUrl = `${getAppUrl()}/invite?token=${token}`

  const { data, error } = await resend.emails.send({
    from: "AdLauncher <team@pati.tuananhdo.site>",
    to,
    subject: `You're invited to join ${orgName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>You're invited!</h2>
        <p><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on AdLauncher.</p>
        <a href="${acceptUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Accept Invitation
        </a>
        <p style="color: #666; font-size: 14px;">This invitation expires in 7 days.</p>
        <p style="color: #999; font-size: 12px;">If you don't have an account yet, you'll be asked to create one first.</p>
      </div>
    `,
  })

  if (error) {
    console.error("[email] Resend error sending invite to", to, "—", error)
    throw new Error(`Email delivery failed: ${error.message}`)
  }

  console.log("[email] Invite sent to", to, "— Resend ID:", data?.id)
}

// Send notification email (user đã có account - đã được add vào org rồi)
export async function sendAddedToOrgEmail({
  to,
  orgName,
  inviterName,
}: {
  to: string
  orgName: string
  inviterName: string
}) {
  const resend = getResend()
  if (!resend) {
    console.error("[email] RESEND_API_KEY missing — added-to-org email not sent to:", to)
    return
  }

  const dashboardUrl = `${getAppUrl()}/campaigns`

  const { data, error } = await resend.emails.send({
    from: "AdLauncher <team@pati.tuananhdo.site>",
    to,
    subject: `You've been added to ${orgName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>You've been added!</h2>
        <p><strong>${inviterName}</strong> has added you to <strong>${orgName}</strong> on AdLauncher.</p>
        <a href="${dashboardUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Go to Dashboard
        </a>
      </div>
    `,
  })

  if (error) {
    console.error("[email] Resend error sending added-to-org to", to, "—", error)
    // Don't throw — user was already added to org, email is just a notification
  } else {
    console.log("[email] Added-to-org sent to", to, "— Resend ID:", data?.id)
  }
}
