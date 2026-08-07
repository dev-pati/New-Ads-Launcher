import type { ReportInput } from "./report"

export const WEEKLY_REPORT_TO = ["kevin@patigroup.com", "seth@patigroup.com"] as const
export const WEEKLY_REPORT_CC = "wpjpwk7o7pbxz@patigroup.com"
export const DEFAULT_REPORT_TIMEZONE = "Asia/Ho_Chi_Minh"

export type WeeklyReportTeamRow = {
  name: string
  adsCreated: number
  batches: number
  actions: number
  activeDays: number
  breadth: number
}

export type WeeklyReportSnapshot = {
  report: ReportInput
  team: WeeklyReportTeamRow[]
  kr?: {
    totalPoints: number
    monthToDatePoints: number
    launchFallbacks: number
    controlFallbacks: number
  }
}

export type WeeklyReportSchedule = {
  enabled: boolean
  weekday: number
  sendTime: string
  timezone: string
  lastDueLocalDate: string | null
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function formatDate(date: Date, timezone = DEFAULT_REPORT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: timezone,
  }).format(date)
}

function signed(value: number | null, suffix = "%"): string {
  if (value === null) return "n/a"
  return `${value > 0 ? "+" : ""}${value}${suffix}`
}

function riskSentence(report: ReportInput): string {
  const risks: string[] = []
  if (report.delivery.nonSuccess > 0) risks.push(`${report.delivery.nonSuccess} launch batches need review`)
  if (report.creative.unlaunched > 0) risks.push(`${report.creative.unlaunched} ready creatives remain unlaunched`)
  if (report.failureReasons[0]) risks.push(`top stored error: ${report.failureReasons[0].label} (${report.failureReasons[0].count})`)
  return risks.length ? risks.join("; ") : "No measured delivery risk in this period."
}

export function buildWeeklyReportEmail({ report, team, kr }: WeeklyReportSnapshot): { subject: string; html: string; text: string } {
  const date = new Date(report.generatedAt)
  const subject = `[INFORM - Tech/Raymond] AdLauncher Weekly Report (${formatDate(date)})`
  const activity = report.activityAvailable ? report.activity : null
  const orgName = escapeHtml(report.orgName || "AdLauncher")
  const risk = riskSentence(report)
  const teamRows = team.slice(0, 20).map(row => `
    <tr>
      <td style="border-bottom:1px solid rgb(222,224,227);padding:9px 8px"><b>${escapeHtml(row.name)}</b></td>
      <td style="border-bottom:1px solid rgb(222,224,227);padding:9px 8px;text-align:right">${row.adsCreated}</td>
      <td style="border-bottom:1px solid rgb(222,224,227);padding:9px 8px;text-align:right">${row.actions}</td>
      <td style="border-bottom:1px solid rgb(222,224,227);padding:9px 8px;text-align:right">${row.activeDays}/${report.days}</td>
      <td style="border-bottom:1px solid rgb(222,224,227);padding:9px 8px;text-align:right">${row.breadth}</td>
    </tr>`).join("")

  const activityMix = activity
    ? Object.entries(activity.byClass).map(([key, value]) => `<li><b>${escapeHtml(key)}</b>: ${value}</li>`).join("")
    : "<li>App activity unavailable; launch delivery remains measured.</li>"

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:rgb(245,246,248);font-family:Arial,sans-serif;color:rgb(31,35,41)">
  <div style="max-width:720px;margin:24px auto;background:white;border:1px solid rgb(222,224,227);border-radius:12px;overflow:hidden">
    <div style="padding:24px 28px;background:rgb(20,86,240);color:white">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.8">AdLauncher · ${orgName}</div>
      <h1 style="margin:8px 0 0;font-size:24px">Weekly operating report</h1>
      <p style="margin:6px 0 0;opacity:.85">Last ${report.days} days · generated ${formatDate(date)}</p>
    </div>
    <div style="padding:24px 28px">
      <h2 style="font-size:18px;margin:0 0 12px">Executive summary</h2>
      <table width="100%" cellpadding="0" cellspacing="8" style="margin:0 -8px 20px">
        <tr>
          <td style="padding:12px;border:1px solid rgb(222,224,227);border-radius:8px"><span style="font-size:12px;color:rgb(100,106,115)">ADS LAUNCHED</span><br><b style="font-size:24px">${report.delivery.adsCreated}</b><br><span style="font-size:12px;color:rgb(100,106,115)">${signed(report.previous.deltaAdsCreated)} vs prior</span></td>
          <td style="padding:12px;border:1px solid rgb(222,224,227);border-radius:8px"><span style="font-size:12px;color:rgb(100,106,115)">FULL SUCCESS</span><br><b style="font-size:24px">${report.delivery.successRate}%</b><br><span style="font-size:12px;color:rgb(100,106,115)">${signed(report.previous.deltaSuccessRate, " pts")} vs prior</span></td>
          <td style="padding:12px;border:1px solid rgb(222,224,227);border-radius:8px"><span style="font-size:12px;color:rgb(100,106,115)">APP ACTIONS</span><br><b style="font-size:24px">${activity ? activity.total : "-"}</b><br><span style="font-size:12px;color:rgb(100,106,115)">${activity ? signed(report.previous.deltaActivity) : "unavailable"}</span></td>
          <td style="padding:12px;border:1px solid rgb(222,224,227);border-radius:8px"><span style="font-size:12px;color:rgb(100,106,115)">ACTIVE MEMBERS</span><br><b style="font-size:24px">${activity ? activity.activeMembers : "-"}</b><br><span style="font-size:12px;color:rgb(100,106,115)">${activity ? `${activity.activeDays} active days` : "unavailable"}</span></td>
        </tr>
      </table>

      <div style="padding:14px 16px;background:rgb(242,243,245);border-left:3px solid rgb(20,86,240);border-radius:0 8px 8px 0">
        <b>Management readout</b>
        <p style="margin:6px 0 0;line-height:1.6">The team delivered ${report.delivery.adsCreated} ads from ${report.delivery.batches} batches at ${report.delivery.successRate}% full-batch success. ${activity ? `${activity.activeMembers} members recorded ${activity.total} measurable app actions across ${activity.activeDays} active days.` : "App activity is not measurable on this project yet."}</p>
      </div>

      ${kr ? `<h2 style="font-size:18px;margin:24px 0 10px">KR tracking</h2>
      <table width="100%" cellpadding="0" cellspacing="8" style="margin:0 -8px 20px">
        <tr>
          <td style="padding:12px;border:1px solid rgb(222,224,227);border-radius:8px"><span style="font-size:12px;color:rgb(100,106,115)">TOTAL POINTS</span><br><b style="font-size:22px">${kr.totalPoints}/100</b></td>
          <td style="padding:12px;border:1px solid rgb(222,224,227);border-radius:8px"><span style="font-size:12px;color:rgb(100,106,115)">MONTH TO DATE</span><br><b style="font-size:22px">${kr.monthToDatePoints}/100</b></td>
          <td style="padding:12px;border:1px solid rgb(222,224,227);border-radius:8px"><span style="font-size:12px;color:rgb(100,106,115)">LAUNCH FALLBACKS</span><br><b style="font-size:22px">${kr.launchFallbacks}</b></td>
          <td style="padding:12px;border:1px solid rgb(222,224,227);border-radius:8px"><span style="font-size:12px;color:rgb(100,106,115)">CONTROL FALLBACKS</span><br><b style="font-size:22px">${kr.controlFallbacks}</b></td>
        </tr>
      </table>
      <p style="margin:-10px 0 20px;color:rgb(100,106,115);font-size:13px">${kr.launchFallbacks + kr.controlFallbacks} recorded fallbacks in the tracked month.</p>` : ""}

      <h2 style="font-size:18px;margin:24px 0 10px">Team usage</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px">
        <thead><tr style="background:rgb(242,243,245)"><th style="padding:9px 8px;text-align:left">Member</th><th style="padding:9px 8px;text-align:right">Ads</th><th style="padding:9px 8px;text-align:right">Actions</th><th style="padding:9px 8px;text-align:right">Active days</th><th style="padding:9px 8px;text-align:right">Features</th></tr></thead>
        <tbody>${teamRows || `<tr><td colspan="5" style="padding:12px;color:rgb(100,106,115)">No team usage recorded.</td></tr>`}</tbody>
      </table>

      <h2 style="font-size:18px;margin:24px 0 8px">App activity</h2>
      <ul style="margin:0;padding-left:20px;line-height:1.7">${activityMix}</ul>
      ${activity ? `<p style="color:rgb(100,106,115);font-size:13px">Estimated time saved: <b>~${activity.estimatedHoursSaved}h</b>. Automation coverage: <b>${report.automationCoverage === null ? "unavailable" : `${report.automationCoverage}%`}</b>.</p>` : ""}

      <h2 style="font-size:18px;margin:24px 0 8px">Risks and attention</h2>
      <p style="margin:0;line-height:1.6">${escapeHtml(risk)}</p>
    </div>
    <div style="padding:14px 28px;border-top:1px solid rgb(222,224,227);font-size:12px;color:rgb(100,106,115)">Measured from AdLauncher delivery and activity records. Unavailable never means zero.</div>
  </div>
</body></html>`

  const text = [
    `AdLauncher Weekly Report - ${formatDate(date)}`,
    `Executive summary: ${report.delivery.adsCreated} ads, ${report.delivery.successRate}% full success, ${report.delivery.nonSuccess} batches need review.`,
    activity ? `App activity: ${activity.total} actions, ${activity.activeMembers} active members, ${activity.activeDays} active days.` : "App activity: unavailable.",
    kr ? `KR tracking: ${kr.totalPoints}/100 current, ${kr.monthToDatePoints}/100 month-to-date, ${kr.launchFallbacks + kr.controlFallbacks} recorded fallbacks (${kr.launchFallbacks} launch, ${kr.controlFallbacks} control).` : "",
    `Risk: ${risk}`,
    "Team usage:",
    ...team.map(row => `- ${row.name}: ${row.adsCreated} ads, ${row.actions} actions, ${row.activeDays}/${report.days} active days, ${row.breadth} features.`),
  ].join("\n")

  return { subject, html, text }
}

function zonedParts(now: Date, timezone: string): { localDate: string; weekday: number; minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now)
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || ""
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"))
    return {
      localDate: `${get("year")}-${get("month")}-${get("day")}`,
      weekday,
      minutes: Number(get("hour")) * 60 + Number(get("minute")),
    }
  } catch {
    return null
  }
}

export function isWeeklyReportDue(schedule: WeeklyReportSchedule, now = new Date()): string | null {
  if (!schedule.enabled || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(schedule.sendTime)) return null
  const local = zonedParts(now, schedule.timezone)
  if (!local || local.weekday !== schedule.weekday || local.localDate === schedule.lastDueLocalDate) return null
  const [hour, minute] = schedule.sendTime.split(":").map(Number)
  return local.minutes >= hour * 60 + minute ? local.localDate : null
}
