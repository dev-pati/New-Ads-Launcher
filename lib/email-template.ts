/**
 * email-template.ts — HTML email templates for automation notifications
 */

interface MetricsData {
  totalSpend: number
  purchases: number
  revenue: number
  roas: number
  campaigns: { name: string; spend: number; purchases: number; roas: number }[]
  period: string
  adAccountName?: string
}

export function buildNotificationEmail({
  automationName,
  message,
  metrics,
  status,
}: {
  automationName: string
  message?: string
  metrics?: MetricsData
  status?: "success" | "alert" | "info"
}): { subject: string; html: string; text: string } {
  const color    = status === "alert" ? "#ef4444" : status === "success" ? "#10b981" : "#6366f1"
  const emoji    = status === "alert" ? "🚨" : status === "success" ? "✅" : "📊"
  const subject  = `${emoji} ${automationName}`

  const metricsHtml = metrics ? `
    <div style="margin:24px 0">
      <div style="font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">
        ${metrics.period.replace("_", " ").replace("last", "Last")} • ${metrics.adAccountName ?? "Ad Account"}
      </div>

      <!-- KPI Cards -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
        <tr>
          <td width="25%" style="padding:12px;background:#f9fafb;border-radius:8px;text-align:center;border:1px solid #e5e7eb">
            <div style="font-size:11px;color:#9ca3af;font-weight:500;margin-bottom:4px">SPEND</div>
            <div style="font-size:20px;font-weight:700;color:#111827">$${metrics.totalSpend.toFixed(0)}</div>
          </td>
          <td width="4%" />
          <td width="25%" style="padding:12px;background:#f9fafb;border-radius:8px;text-align:center;border:1px solid #e5e7eb">
            <div style="font-size:11px;color:#9ca3af;font-weight:500;margin-bottom:4px">ROAS</div>
            <div style="font-size:20px;font-weight:700;color:${metrics.roas >= 2 ? "#10b981" : metrics.roas >= 1 ? "#f59e0b" : "#ef4444"}">${metrics.roas.toFixed(2)}x</div>
          </td>
          <td width="4%" />
          <td width="25%" style="padding:12px;background:#f9fafb;border-radius:8px;text-align:center;border:1px solid #e5e7eb">
            <div style="font-size:11px;color:#9ca3af;font-weight:500;margin-bottom:4px">PURCHASES</div>
            <div style="font-size:20px;font-weight:700;color:#111827">${metrics.purchases}</div>
          </td>
          <td width="4%" />
          <td width="25%" style="padding:12px;background:#f9fafb;border-radius:8px;text-align:center;border:1px solid #e5e7eb">
            <div style="font-size:11px;color:#9ca3af;font-weight:500;margin-bottom:4px">REVENUE</div>
            <div style="font-size:20px;font-weight:700;color:#111827">$${metrics.revenue.toFixed(0)}</div>
          </td>
        </tr>
      </table>

      <!-- Top Campaigns -->
      ${metrics.campaigns.length > 0 ? `
      <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:8px">Top Campaigns</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <tr style="background:#f3f4f6">
          <th style="text-align:left;padding:8px 12px;font-size:11px;color:#6b7280;font-weight:600">CAMPAIGN</th>
          <th style="text-align:right;padding:8px 12px;font-size:11px;color:#6b7280;font-weight:600">SPEND</th>
          <th style="text-align:right;padding:8px 12px;font-size:11px;color:#6b7280;font-weight:600">PURCHASES</th>
          <th style="text-align:right;padding:8px 12px;font-size:11px;color:#6b7280;font-weight:600">ROAS</th>
        </tr>
        ${metrics.campaigns.map((c, i) => `
        <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f9fafb"};border-bottom:1px solid #e5e7eb">
          <td style="padding:10px 12px;font-size:12px;color:#111827;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</td>
          <td style="padding:10px 12px;font-size:12px;color:#111827;text-align:right">$${c.spend.toFixed(0)}</td>
          <td style="padding:10px 12px;font-size:12px;color:#111827;text-align:right">${c.purchases}</td>
          <td style="padding:10px 12px;font-size:12px;font-weight:600;text-align:right;color:${c.roas >= 2 ? "#10b981" : c.roas >= 1 ? "#f59e0b" : "#ef4444"}">${c.roas > 0 ? c.roas.toFixed(2) + "x" : "—"}</td>
        </tr>`).join("")}
      </table>` : ""}
    </div>
  ` : ""

  const messageHtml = message && message.trim()
    ? `<div style="background:#f9fafb;border-left:3px solid ${color};padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0;font-size:14px;color:#374151;line-height:1.6">${message.replace(/\n/g, "<br>")}</div>`
    : ""

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">

    <!-- Header -->
    <div style="background:${color};padding:24px 32px">
      <div style="font-size:11px;color:rgba(255,255,255,0.8);font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">AdLauncher Automation</div>
      <div style="font-size:22px;font-weight:700;color:#ffffff">${emoji} ${automationName}</div>
    </div>

    <!-- Content -->
    <div style="padding:24px 32px">
      ${messageHtml}
      ${metricsHtml}

      <!-- CTA -->
      <div style="text-align:center;margin-top:24px">
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://ads.patigroup.com"}/insights"
           style="display:inline-block;background:${color};color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
          View Full Dashboard →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center">
      <div style="font-size:11px;color:#9ca3af">Sent by AdLauncher • <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://ads.patigroup.com"}/automate" style="color:#9ca3af">Manage automations</a></div>
    </div>
  </div>
</body>
</html>`

  // Plain text fallback
  const text = [
    `${emoji} ${automationName}`,
    message ?? "",
    metrics ? [
      `\n📊 Metrics (${metrics.period}):`,
      `Spend: $${metrics.totalSpend.toFixed(2)}`,
      `ROAS: ${metrics.roas.toFixed(2)}x`,
      `Purchases: ${metrics.purchases}`,
      `Revenue: $${metrics.revenue.toFixed(2)}`,
      metrics.campaigns.length ? "\nTop Campaigns:\n" + metrics.campaigns.map(c => `  • ${c.name}: $${c.spend.toFixed(2)}`).join("\n") : "",
    ].join("\n") : "",
  ].filter(Boolean).join("\n\n")

  return { subject, html, text }
}
