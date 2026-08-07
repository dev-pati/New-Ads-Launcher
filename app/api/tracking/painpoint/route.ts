import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { isoWeekMonday } from "@/lib/tracking/summary"
import { recordActivity } from "@/lib/notifications/emit"

export const dynamic = "force-dynamic"

export async function GET() {
  const context = await getAuthContext()
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = createAdminClient()
  const { data, error } = await db
    .from("weekly_painpoints")
    .select("note,week_start,updated_at,creative_aggregate,data_mismatch_count")
    .eq("org_id", context.orgId)
    .eq("user_id", context.user.id)
    .eq("week_start", isoWeekMonday(new Date()))
    .maybeSingle()

  if (error) {
    console.error("[tracking/painpoint]", error)
    return NextResponse.json({ error: "Painpoint unavailable." }, { status: 500 })
  }

  return NextResponse.json({
    note: data?.note || "",
    weekStart: data?.week_start || isoWeekMonday(new Date()),
    updatedAt: data?.updated_at || null,
    creativeAggregate: (data?.creative_aggregate as "works" | "not_yet" | null) ?? null,
    dataMismatchCount: (data?.data_mismatch_count as number | null) ?? null,
  })
}

export async function POST(request: NextRequest) {
  const context = await getAuthContext()
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let note = ""
  // Unanswered is a third state, distinct from 'not_yet' and from 0. It stays null all
  // the way to the card, which renders it as "—" rather than inventing an answer.
  let creativeAggregate: "works" | "not_yet" | null = null
  let dataMismatchCount: number | null = null
  try {
    const body = await request.json()
    note = typeof body?.note === "string" ? body.note.slice(0, 2000) : ""
    if (body?.creativeAggregate === "works" || body?.creativeAggregate === "not_yet") {
      creativeAggregate = body.creativeAggregate
    }
    if (Number.isInteger(body?.dataMismatchCount)) dataMismatchCount = Math.min(1000, Math.max(0, body.dataMismatchCount))
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 })
  }

  const weekStart = isoWeekMonday(new Date())
  const db = createAdminClient()
  const { data, error } = await db
    .from("weekly_painpoints")
    .upsert(
      {
        org_id: context.orgId,
        user_id: context.user.id,
        week_start: weekStart,
        note,
        creative_aggregate: creativeAggregate,
        data_mismatch_count: dataMismatchCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,user_id,week_start" },
    )
    .select("note,week_start,updated_at,creative_aggregate,data_mismatch_count")
    .single()

  if (error) {
    console.error("[tracking/painpoint]", error)
    return NextResponse.json({ error: "Could not save painpoint." }, { status: 500 })
  }

  // Writing a painpoint is how the feedback loop stays alive — Tracking counts it as
  // Collaborate. An empty form is the user clearing the box, not an activity; a
  // structured answer on its own still counts, because it still told us something.
  if (note.trim() || creativeAggregate || dataMismatchCount !== null) {
    await recordActivity({
      orgId: context.orgId,
      actorId: context.user.id,
      actorName: context.user.full_name || context.user.email?.split("@")[0] || "Someone",
      objectType: "painpoint",
      objectId: `${context.user.id}:${weekStart}`,
      objectName: weekStart,
      action: "created",
    })
  }

  return NextResponse.json(data)
}
