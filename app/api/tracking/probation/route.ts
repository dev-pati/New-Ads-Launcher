import { NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { isProbationSubject } from "@/lib/tracking/probation"
import { isoWeekMonday } from "@/lib/tracking/summary"

export const dynamic = "force-dynamic"

/**
 * The measured half of the probation month.
 *
 * This route returns only what the app can prove: who launched, in which ISO week, from
 * `launch_batches`. The fallback tally and the weekly self-answers are hand-kept on the
 * subject's own machine (`lib/tracking/fallback-local.ts`) and are scored in the browser,
 * because they are a personal count and a server table would have made them look like
 * organisational measurement. No `meta_fallback_events`, no unapplied migration, nothing
 * this route needs that does not already exist in the database.
 *
 * Subject-only: it is a review of one person, so only that person reads it here. Being an
 * admin is not enough — Team usage is a shared screen and a probation review is not
 * shared reading. Reviewers receive the week through the copy-paste block, which is the
 * route the plan already defines.
 */

/** The probation window. Fixed rather than "current month" — the plan covers one month. */
const MONTH_START = "2026-08-01"
const MONTH_END = "2026-09-01"

export async function GET() {
  const context = await getAuthContext()
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isProbationSubject(context.user)) {
    return NextResponse.json({ error: "This report belongs to one person." }, { status: 403 })
  }

  const db = createAdminClient()

  const { data, error } = await db
    .from("launch_batches")
    .select("user_name,total_ads,failed_ads,created_at")
    .eq("org_id", context.orgId)
    .gte("created_at", `${MONTH_START}T00:00:00.000Z`)
    .lt("created_at", `${MONTH_END}T00:00:00.000Z`)

  if (error) {
    console.error("[tracking/probation]", error)
    return NextResponse.json({ error: "Launch history unavailable." }, { status: 500 })
  }

  const weeks = new Map<string, Map<string, number>>()
  for (const batch of data || []) {
    // A batch where every ad failed is not a launch the person completed here — counting
    // it would score an attempt as an adoption.
    const ads = Math.max(0, ((batch.total_ads as number) || 0) - ((batch.failed_ads as number) || 0))
    if (ads === 0) continue

    const week = isoWeekMonday(batch.created_at as string)
    const launchers = weeks.get(week) || new Map<string, number>()
    const name = (batch.user_name as string | null) || "Unknown"
    launchers.set(name, (launchers.get(name) || 0) + 1)
    weeks.set(week, launchers)
  }

  const currentWeek = isoWeekMonday(new Date())
  const anchor = currentWeek >= MONTH_START && currentWeek < MONTH_END ? currentWeek : MONTH_START
  if (!weeks.has(anchor)) weeks.set(anchor, new Map())

  return NextResponse.json({
    monthStart: MONTH_START,
    monthEnd: MONTH_END,
    currentWeek,
    weeks: [...weeks.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([week, launchers], index) => ({
        week,
        index: index + 1,
        isCurrent: week === currentWeek,
        launchers: [...launchers.entries()].map(([name, batches]) => ({ name, batches })),
      })),
  })
}
