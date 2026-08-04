import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { summarizeCreativeCoverage, summarizeFailureReasons, summarizeLaunchBatches, type TrackingBatch, type TrackingCreative, workingDayStreak } from "@/lib/tracking/summary"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const context = await getAuthContext()
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const requestedDays = Number(new URL(request.url).searchParams.get("days") || 7)
  const days = requestedDays === 28 ? 28 : 7
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const db = createAdminClient()
  const [recentBatchesResult, successfulBatchesResult, creativesResult] = await Promise.all([
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
  ])

  const error = recentBatchesResult.error || successfulBatchesResult.error || creativesResult.error
  if (error) {
    console.error("[tracking]", error)
    return NextResponse.json({ error: "Tracking data is unavailable." }, { status: 500 })
  }

  const batches = (recentBatchesResult.data || []) as TrackingBatch[]
  const myBatches = batches.filter(batch => batch.user_id === context.user.id)
  const launchedCreativeIds = new Set((successfulBatchesResult.data || []).flatMap(batch => batch.creative_ids || []))
  const admin = summarizeLaunchBatches(batches)

  return NextResponse.json({
    days,
    generatedAt: new Date().toISOString(),
    admin,
    mine: summarizeLaunchBatches(myBatches),
    myBatches,
    teamStreaks: Object.fromEntries(admin.team.map(member => [member.userId, workingDayStreak(batches.filter(batch => batch.user_id === member.userId).flatMap(batch => batch.created_at ? [batch.created_at] : []))])),
    myStreak: workingDayStreak(myBatches.flatMap(batch => batch.created_at ? [batch.created_at] : [])),
    failureReasons: summarizeFailureReasons(batches),
    myFailureReasons: summarizeFailureReasons(myBatches),
    creative: summarizeCreativeCoverage((creativesResult.data || []) as TrackingCreative[], launchedCreativeIds),
    creatorDataStatus: "awaiting_portal",
  })
}
