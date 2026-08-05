import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { isoWeekMonday } from "@/lib/tracking/summary"

export const dynamic = "force-dynamic"

export async function GET() {
  const context = await getAuthContext()
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = createAdminClient()
  const { data, error } = await db
    .from("weekly_painpoints")
    .select("note,week_start,updated_at")
    .eq("org_id", context.orgId)
    .eq("user_id", context.user.id)
    .eq("week_start", isoWeekMonday(new Date()))
    .maybeSingle()

  if (error) {
    console.error("[tracking/painpoint]", error)
    return NextResponse.json({ error: "Painpoint unavailable." }, { status: 500 })
  }

  return NextResponse.json({ note: data?.note || "", weekStart: data?.week_start || isoWeekMonday(new Date()), updatedAt: data?.updated_at || null })
}

export async function POST(request: NextRequest) {
  const context = await getAuthContext()
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let note = ""
  try {
    const body = await request.json()
    note = typeof body?.note === "string" ? body.note.slice(0, 2000) : ""
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 })
  }

  const weekStart = isoWeekMonday(new Date())
  const db = createAdminClient()
  const { data, error } = await db
    .from("weekly_painpoints")
    .upsert(
      { org_id: context.orgId, user_id: context.user.id, week_start: weekStart, note, updated_at: new Date().toISOString() },
      { onConflict: "org_id,user_id,week_start" },
    )
    .select("note,week_start,updated_at")
    .single()

  if (error) {
    console.error("[tracking/painpoint]", error)
    return NextResponse.json({ error: "Could not save painpoint." }, { status: 500 })
  }

  return NextResponse.json(data)
}
