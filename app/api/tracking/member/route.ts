import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { summarizeLaunchBatches, workingDayStreak, isoWeekMonday, type TrackingBatch } from "@/lib/tracking/summary"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const context = await getAuthContext()
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (context.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 })

  const url = new URL(request.url)
  const userId = url.searchParams.get("userId")
  if (!userId) return NextResponse.json({ error: "userId is required." }, { status: 400 })

  const requestedDays = Number(url.searchParams.get("days") || 7)
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 7
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  const db = createAdminClient()
  const [batchesResult, painpointResult] = await Promise.all([
    db
      .from("launch_batches")
      .select("id,user_id,user_name,status,total_ads,failed_ads,duration_ms,created_at,ad_account_name,errors")
      .eq("org_id", context.orgId)
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
    db
      .from("weekly_painpoints")
      .select("note,week_start")
      .eq("org_id", context.orgId)
      .eq("user_id", userId)
      .eq("week_start", isoWeekMonday(new Date()))
      .maybeSingle(),
  ])

  if (batchesResult.error) {
    console.error("[tracking/member]", batchesResult.error)
    return NextResponse.json({ error: "Member data unavailable." }, { status: 500 })
  }

  const batches = (batchesResult.data || []) as TrackingBatch[]
  const summary = summarizeLaunchBatches(batches)

  return NextResponse.json({
    userId,
    days,
    summary,
    streak: workingDayStreak(batches.flatMap(batch => batch.created_at ? [batch.created_at] : [])),
    recentBatches: batches.slice(0, 10),
    painpoint: painpointResult.data?.note || "",
  })
}
