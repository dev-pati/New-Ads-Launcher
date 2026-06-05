/**
 * send-lark.ts — Lark (Feishu) messaging via Open API
 * Uses LARK_APP_ID + LARK_APP_SECRET to send direct messages or group messages
 */

const LARK_API = "https://open.larksuite.com/open-apis"

// ── Get app access token ──────────────────────────────────────────────────────
async function getAppToken(): Promise<string | null> {
  const appId     = process.env.LARK_APP_ID
  const appSecret = process.env.LARK_APP_SECRET
  if (!appId || !appSecret) return null

  const res = await fetch(`${LARK_API}/auth/v3/app_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  })
  const data = await res.json()
  return data.app_access_token ?? null
}

// ── Get user open_id by email ─────────────────────────────────────────────────
async function getUserIdByEmail(email: string, token: string): Promise<string | null> {
  const res = await fetch(
    `${LARK_API}/contact/v3/users/batch_get_id?user_id_type=open_id`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ emails: [email] }),
    }
  )
  const data = await res.json()
  return data.data?.user_list?.[0]?.user_id ?? null
}

// ── Build rich card message ───────────────────────────────────────────────────
function buildLarkCard({
  title,
  message,
  metrics,
  appUrl,
}: {
  title: string
  message?: string
  metrics?: {
    totalSpend: number
    roas: number
    purchases: number
    revenue: number
    period: string
    campaigns: { name: string; spend: number; roas: number }[]
  }
  appUrl?: string
}): object {
  const elements: any[] = []

  if (message) {
    elements.push({
      tag: "div",
      text: { tag: "lark_md", content: message },
    })
  }

  if (metrics) {
    elements.push({ tag: "hr" })
    elements.push({
      tag: "div",
      text: { tag: "lark_md", content: `**📊 Metrics Report — ${metrics.period.replace("_", " ")}**` },
    })
    elements.push({
      tag: "column_set",
      flex_mode: "none",
      background_style: "grey",
      columns: [
        { tag: "column", width: "weighted", weight: 1, elements: [{ tag: "div", text: { tag: "lark_md", content: `**Spend**\n$${metrics.totalSpend.toFixed(0)}` } }] },
        { tag: "column", width: "weighted", weight: 1, elements: [{ tag: "div", text: { tag: "lark_md", content: `**ROAS**\n${metrics.roas.toFixed(2)}x` } }] },
        { tag: "column", width: "weighted", weight: 1, elements: [{ tag: "div", text: { tag: "lark_md", content: `**Purchases**\n${metrics.purchases}` } }] },
        { tag: "column", width: "weighted", weight: 1, elements: [{ tag: "div", text: { tag: "lark_md", content: `**Revenue**\n$${metrics.revenue.toFixed(0)}` } }] },
      ],
    })

    if (metrics.campaigns.length) {
      const campLines = metrics.campaigns.slice(0, 5)
        .map(c => `• **${c.name.length > 35 ? c.name.slice(0, 33) + "…" : c.name}** — $${c.spend.toFixed(0)} · ${c.roas > 0 ? c.roas.toFixed(2) + "x" : "—"}`)
        .join("\n")
      elements.push({ tag: "div", text: { tag: "lark_md", content: `**Top Campaigns:**\n${campLines}` } })
    }
  }

  if (appUrl) {
    elements.push({ tag: "hr" })
    elements.push({
      tag: "action",
      actions: [{
        tag: "button",
        text: { tag: "plain_text", content: "View Dashboard →" },
        type: "primary",
        url: `${appUrl}/insights`,
      }],
    })
  }

  return {
    msg_type: "interactive",
    card: JSON.stringify({
      config: { wide_screen_mode: true },
      header: {
        title: { tag: "plain_text", content: title },
        template: "blue",
      },
      elements,
    }),
  }
}

// ── Send message to user by email ─────────────────────────────────────────────
export async function sendLarkMessage({
  recipients,
  title,
  message,
  metrics,
}: {
  recipients: string[]  // email addresses
  title: string
  message?: string
  metrics?: any
}): Promise<{ ok: boolean; error?: string }> {
  if (!recipients.length) return { ok: false, error: "No recipients" }

  const token = await getAppToken()
  if (!token) return { ok: false, error: "LARK_APP_ID or LARK_APP_SECRET not configured" }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ads.patigroup.com"
  const card   = buildLarkCard({ title, message, metrics, appUrl })

  const errors: string[] = []

  for (const email of recipients) {
    try {
      // Get user open_id
      const userId = await getUserIdByEmail(email, token)
      if (!userId) { errors.push(`User not found: ${email}`); continue }

      // Send message
      const res = await fetch(`${LARK_API}/im/v1/messages?receive_id_type=open_id`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ receive_id: userId, ...card }),
      })
      const data = await res.json()
      if (data.code !== 0) errors.push(`${email}: ${data.msg}`)
    } catch (e: any) {
      errors.push(`${email}: ${e.message}`)
    }
  }

  if (errors.length === recipients.length) return { ok: false, error: errors.join("; ") }
  return { ok: true, error: errors.length ? `Partial: ${errors.join("; ")}` : undefined }
}

// ── Send to a Lark group chat ─────────────────────────────────────────────────
export async function sendLarkGroupMessage({
  chatId,
  title,
  message,
  metrics,
}: {
  chatId: string
  title: string
  message?: string
  metrics?: any
}): Promise<{ ok: boolean; error?: string }> {
  const token = await getAppToken()
  if (!token) return { ok: false, error: "Lark not configured" }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ads.patigroup.com"
  const card   = buildLarkCard({ title, message, metrics, appUrl })

  const res = await fetch(`${LARK_API}/im/v1/messages?receive_id_type=chat_id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ receive_id: chatId, ...card }),
  })
  const data = await res.json()
  if (data.code !== 0) return { ok: false, error: data.msg }
  return { ok: true }
}
