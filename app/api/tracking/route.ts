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
import {
  automationCoverage,
  delta,
  estimatedHoursSaved,
  leverageRatio,
  summarizeActivity,
  type ActivityRow,
  type PageActivityRow,
} from "@/lib/tracking/activity"
import { createAdminClient } from "@/lib/supabase/admin"
/**
 * `activity_log` ships in 20260803_activity_log.sql, which needs sign-off before it
 * is applied on the shared project. Until then the table is absent and the App
 * Activity block must report itself unavailable rather than render zeros — a zero
 * here would read as "the team did nothing".
 */
import { isMissingTable } from "@/lib/tracking/missing-table"

export const dynamic = "force-dynamic"

/** Ceiling on rows pulled per window. Reported back so a truncated period is never read as a quiet one. */
const ACTIVITY_ROW_LIMIT = 10_000

export async function GET(request: NextRequest) {
  const context = await getAuthContext()
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const requestedDays = Number(url.searchParams.get("days") || 7)
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 7
  const windowMs = days * 86_400_000
  const since = new Date(Date.now() - windowMs).toISOString()
  const previousSince = new Date(Date.now() - windowMs * 2).toISOString()
  const db = createAdminClient()

  const activitySelect = "actor_id,actor_name,object_type,action,created_at,source"

  // 1. Fetch data
  const [
    recentBatchesResult,
    previousBatchesResult,
    successfulBatchesResult,
    creativesResult,
    painpointResult,
    activityResult,
    previousActivityResult,
    pageActivityResult,
    automationRunsResult,
    previousAutomationRunsResult,
    firstActivityResult,
  ] = await Promise.all([
    db
      .from("launch_batches")
      .select("id,user_id,user_name,status,total_ads,failed_ads,duration_ms,created_at,ad_account_name,errors")
      .eq("org_id", context.orgId)
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
    db
      .from("launch_batches")
      .select("id,user_id,user_name,status,total_ads,failed_ads,duration_ms,created_at")
      .eq("org_id", context.orgId)
      .gte("created_at", previousSince)
      .lt("created_at", since),
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
    db
      .from("activity_log")
      .select(activitySelect)
      .eq("org_id", context.orgId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(ACTIVITY_ROW_LIMIT),
    db
      .from("activity_log")
      .select(activitySelect)
      .eq("org_id", context.orgId)
      .gte("created_at", previousSince)
      .lt("created_at", since)
      .limit(ACTIVITY_ROW_LIMIT),
    db
      .from("page_manage_activity")
      .select("actor_id,module,created_at")
      .eq("org_id", context.orgId)
      .gte("created_at", since)
      .limit(ACTIVITY_ROW_LIMIT),
    db
      .from("automation_executions")
      .select("id", { count: "exact", head: true })
      .eq("org_id", context.orgId)
      .gte("executed_at", since),
    db
      .from("automation_executions")
      .select("id", { count: "exact", head: true })
      .eq("org_id", context.orgId)
      .gte("executed_at", previousSince)
      .lt("executed_at", since),
    db
      .from("activity_log")
      .select("created_at")
      .eq("org_id", context.orgId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const error = recentBatchesResult.error || successfulBatchesResult.error || creativesResult.error
  if (error) {
    console.error("[tracking]", error)
    return NextResponse.json({ error: "Tracking data is unavailable." }, { status: 500 })
  }

  const batches = (recentBatchesResult.data || []) as TrackingBatch[]
  const previousBatches = (previousBatchesResult.data || []) as TrackingBatch[]
  const myBatches = batches.filter(batch => batch.user_id === context.user.id)
  const launchedCreativeIds = new Set((successfulBatchesResult.data || []).flatMap(batch => batch.creative_ids || []))

  // ── App Activity ────────────────────────────────────────────────────────────
  // Missing table = "not instrumented yet", which is a different answer from zero.
  const activityUnavailable = isMissingTable(activityResult.error)
  if (activityResult.error && !activityUnavailable) console.error("[tracking:activity]", activityResult.error)
  if (pageActivityResult.error && !isMissingTable(pageActivityResult.error)) {
    console.error("[tracking:page-activity]", pageActivityResult.error)
  }

  const activityRows = (activityResult.data || []) as ActivityRow[]
  const previousActivityRows = (previousActivityResult.data || []) as ActivityRow[]
  const pageRows = (pageActivityResult.data || []) as PageActivityRow[]
  const automationRuns = automationRunsResult.count || 0
  const previousAutomationRuns = previousAutomationRunsResult.count || 0

  const teamActivity = summarizeActivity({ rows: activityRows, pageRows, batches })
  const previousTeamActivity = summarizeActivity({ rows: previousActivityRows, batches: previousBatches })
  const myActivity = summarizeActivity({ rows: activityRows, pageRows, batches, onlyUserId: context.user.id })

  const summary = summarizeLaunchBatches(batches)
  const mineSummary = summarizeLaunchBatches(myBatches)
  const previousSummary = summarizeLaunchBatches(previousBatches)
  const isAdmin = context.role === "admin"

  const activityBlock = (scope: typeof teamActivity, batchCount: number) => ({
    ...scope,
    leverageRatio: leverageRatio(scope.byClass.reuse, batchCount),
    estimatedHoursSaved: estimatedHoursSaved(scope.estimatedMinutesSaved, 0),
  })

  const baseResponse: Record<string, unknown> = {
    days,
    generatedAt: new Date().toISOString(),
    role: context.role,
    currentUserId: context.user.id,
    mine: mineSummary,
    myBatches,
    myStreak: workingDayStreak(myBatches.flatMap(batch => batch.created_at ? [batch.created_at] : [])),
    myFailureReasons: summarizeFailureReasons(myBatches),
    creative: summarizeCreativeCoverage((creativesResult.data || []) as TrackingCreative[], launchedCreativeIds),
    creatorDataStatus: "awaiting_portal",
    painpoint: painpointResult.data?.note || "",
    activity: {
      available: !activityUnavailable,
      /**
       * The day activity_log started recording for this org. A 90-day view that
       * predates it is short by construction, not by inactivity.
       */
      instrumentedSince: firstActivityResult.data?.created_at || null,
      unavailableReason: activityUnavailable
        ? "activity_log is not applied on this project yet (20260803_activity_log.sql). Launch counts are complete; every other activity is not being recorded."
        : null,
      truncated: activityRows.length >= ACTIVITY_ROW_LIMIT,
      automationRuns,
      automationCoverage: automationCoverage(automationRuns, teamActivity.byClass.govern),
      mine: activityBlock(myActivity, mineSummary.batches),
    },
    previous: {
      batches: previousSummary.batches,
      adsCreated: previousSummary.adsCreated,
      successRate: previousSummary.successRate,
      deltaBatches: delta(summary.batches, previousSummary.batches),
      deltaAdsCreated: delta(summary.adsCreated, previousSummary.adsCreated),
      deltaSuccessRate: summary.successRate - previousSummary.successRate,
      deltaActivity: delta(teamActivity.total, previousTeamActivity.total),
      deltaActiveMembers: delta(teamActivity.activeMembers, previousTeamActivity.activeMembers),
      deltaAutomationRuns: delta(automationRuns, previousAutomationRuns),
    },
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
    ;(baseResponse.activity as Record<string, unknown>).team = {
      ...activityBlock(teamActivity, admin.batches),
      estimatedHoursSaved: estimatedHoursSaved(teamActivity.estimatedMinutesSaved, automationRuns),
    }
  }

  return NextResponse.json(baseResponse)
}
