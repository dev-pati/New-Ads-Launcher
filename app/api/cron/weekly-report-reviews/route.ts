import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isWeeklyReportDue } from "@/lib/tracking/weekly-report"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createAdminClient()
  const now = new Date()
  const { data: schedules, error } = await db
    .from("weekly_report_schedules")
    .select("org_id,enabled,weekday,send_time,timezone,last_due_local_date")
    .eq("enabled", true)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const due: string[] = []
  for (const row of schedules || []) {
    const localDate = isWeeklyReportDue({
      enabled: row.enabled,
      weekday: row.weekday,
      sendTime: row.send_time,
      timezone: row.timezone,
      lastDueLocalDate: row.last_due_local_date,
    }, now)
    if (!localDate) continue
    const { data } = await db.from("weekly_report_schedules").update({
      pending_review: true,
      last_due_local_date: localDate,
      last_due_at: now.toISOString(),
      updated_at: now.toISOString(),
    }).eq("org_id", row.org_id).or(`last_due_local_date.is.null,last_due_local_date.neq.${localDate}`).select("org_id").maybeSingle()
    if (data) due.push(row.org_id)
  }

  return NextResponse.json({ ok: true, checked: schedules?.length || 0, pending_review: due.length, orgIds: due })
}
