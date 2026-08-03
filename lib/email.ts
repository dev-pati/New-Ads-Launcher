import { sendEmail } from "@/lib/send-email"

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
  const acceptUrl = `${getAppUrl()}/invite?token=${token}`

  const { ok, error } = await sendEmail({
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
    text: `You're invited to join ${orgName} on AdLauncher. Go to: ${acceptUrl}`,
  })

  if (!ok) {
    console.error("[email] SMTP error sending invite to", to, "—", error)
    throw new Error(`Email delivery failed: ${error || "unknown"}`)
  }

  console.log("[email] Invite sent to", to)
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
  const dashboardUrl = `${getAppUrl()}/campaigns`

  const { ok, error } = await sendEmail({
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
    text: `You've been added to ${orgName} on AdLauncher. Go to: ${dashboardUrl}`,
  })

  if (!ok) {
    console.error("[email] SMTP error sending added-to-org to", to, "—", error)
  } else {
    console.log("[email] Added-to-org sent to", to)
  }
}
