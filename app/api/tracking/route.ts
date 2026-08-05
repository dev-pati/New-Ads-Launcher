import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import {
  summarizeCreativeCoverage,
  summarizeFailureReasons,
  summarizeLaunchBatches,
  summarizeLaunchBatchesTimeSeries,
  isoWeekMonday,
  type TrackingBatch,
  type TrackingCreative,
  workingDayStreak,
} from "@/lib/tracking/summary"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const context = await getAuthContext()
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const requestedDays = Number(url.searchParams.get("days") || 7)
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 7
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const db = createAdminClient()

  // 1. Fetch data
  const [recentBatchesResult, successfulBatchesResult, creativesResult, painpointResult] = await Promise.all([
    db
      .from("launch_batches")
      .select("id,user_id,user_name,status,total_ads,failed_ads,duration_ms,created_at,ad_account_name,errors")
      .eq("org_id", context.orgId)
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
    db
      .from("launch_batches")
      .select("creative_ids")
      .eq("org_id", context.orgId)
      .eq("status", "success"),
    db
      .from("creatives")
      .select("id,fb_image_hash,fb_video_id")
      .eq("org_id", context.orgId),
    db
      .from("weekly_painpoints")
      .select("note")
      .eq("org_id", context.orgId)
      .eq("user_id", context.user.id)
      .eq("week_start", isoWeekMonday(new Date()))
      .maybeSingle(),
  ])

  const error = recentBatchesResult.error || successfulBatchesResult.error || creativesResult.error
  if (error) {
    console.error("[tracking]", error)
    return NextResponse.json({ error: "Tracking data is unavailable." }, { status: 500 })
  }

  const batches = (recentBatchesResult.data || []) as TrackingBatch[]
  const myBatches = batches.filter(batch => batch.user_id === context.user.id)
  const launchedCreativeIds = new Set((successfulBatchesResult.data || []).flatMap(batch => batch.creative_ids || []))

  const isAdmin = context.role === "admin"
  const baseResponse: Record<string, unknown> = {
    days,
    generatedAt: new Date().toISOString(),
    role: context.role,
    currentUserId: context.user.id,
    mine: summarizeLaunchBatches(myBatches),
    myBatches,
    myStreak: workingDayStreak(myBatches.flatMap(batch => batch.created_at ? [batch.created_at] : [])),
    myFailureReasons: summarizeFailureReasons(myBatches),
    creative: summarizeCreativeCoverage((creativesResult.data || []) as TrackingCreative[], launchedCreativeIds),
    creatorDataStatus: "awaiting_portal",
    painpoint: painpointResult.data?.note || "",
  }

  if (isAdmin) {
    const admin = summarizeLaunchBatches(batches)
    baseResponse.admin = admin
    baseResponse.adminTimeSeries = summarizeLaunchBatchesTimeSeries(batches, days)
    baseResponse.teamStreaks = Object.fromEntries(
      admin.team.map(member => [
        member.userId,
        workingDayStreak(batches.filter(batch => batch.user_id === member.userId).flatMap(batch => batch.created_at ? [batch.created_at] : [])),
      ])
    )
    baseResponse.failureReasons = summarizeFailureReasons(batches)
  }

  return NextResponse.json(baseResponse)
}
