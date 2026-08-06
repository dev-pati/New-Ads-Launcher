import assert from "node:assert/strict"
import test from "node:test"
import { automationCoverage, delta, estimatedHoursSaved, leverageRatio, summarizeActivity } from "../lib/tracking/activity.ts"
import { buildTrackingReport } from "../lib/tracking/report.ts"

const batch = (userId: string, name: string, createdAt: string) => ({ user_id: userId, user_name: name, created_at: createdAt })
const row = (objectType: string, action: string, actorId: string | null, createdAt: string, source?: string) => ({
  actor_id: actorId,
  actor_name: actorId ? "Kevin" : null,
  object_type: objectType,
  action,
  created_at: createdAt,
  source: source ?? "app",
})

test("counts a launch once — the activity_log echo of a launch is dropped", () => {
  const summary = summarizeActivity({
    batches: [batch("buyer-a", "Kevin", "2026-08-03T02:00:00.000Z")],
    rows: [
      row("ad", "launched", "buyer-a", "2026-08-03T02:00:01.000Z"),
      row("batch", "failed", "buyer-a", "2026-08-03T02:00:02.000Z"),
    ],
  })

  assert.equal(summary.total, 1)
  assert.equal(summary.byClass.produce, 1)
  assert.equal(summary.byType.find(type => type.key === "launch.submitted")?.count, 1)
})

test("machines are not people — cron and automation rows never become someone's action", () => {
  const summary = summarizeActivity({
    rows: [
      row("creative", "created", null, "2026-08-03T02:00:00.000Z"),
      row("creative", "created", "worker", "2026-08-03T02:00:00.000Z", "cron"),
      row("creative", "created", "buyer-a", "2026-08-03T02:00:00.000Z"),
    ],
  })

  assert.equal(summary.total, 1)
  assert.equal(summary.activeMembers, 1)
  assert.equal(summary.byMember[0].userId, "buyer-a")
})

test("an uninstrumented activity is never reported as an unused one", () => {
  const summary = summarizeActivity({ rows: [] })

  const unusedKeys = summary.unused.map(type => type.key)
  const notInstrumentedKeys = summary.notInstrumented.map(type => type.key)

  assert.ok(notInstrumentedKeys.includes("template.applied"))
  assert.ok(!unusedKeys.includes("template.applied"))
  assert.ok(unusedKeys.includes("template.created"))
  assert.equal(summary.unused.some(type => type.status !== "live"), false)
})

test("breadth counts distinct activity types, active days count Vietnam calendar days", () => {
  const summary = summarizeActivity({
    batches: [batch("buyer-a", "Kevin", "2026-08-03T02:00:00.000Z")],
    rows: [
      row("template", "created", "buyer-a", "2026-08-03T04:00:00.000Z"),
      row("template", "created", "buyer-a", "2026-08-03T05:00:00.000Z"),
      // 18:00 UTC on 3 Aug is already 4 Aug in Asia/Ho_Chi_Minh.
      row("preset", "created", "buyer-a", "2026-08-03T18:00:00.000Z"),
    ],
  })

  const member = summary.byMember[0]
  assert.equal(member.actions, 4)
  assert.equal(member.breadth, 3)
  assert.equal(member.activeDays, 2)
  assert.equal(summary.activeDays, 2)
})

test("onlyUserId scopes every number to one member", () => {
  const input = {
    batches: [batch("buyer-a", "Kevin", "2026-08-03T02:00:00.000Z"), batch("buyer-b", "Seth", "2026-08-03T02:00:00.000Z")],
    rows: [row("template", "created", "buyer-b", "2026-08-03T04:00:00.000Z")],
  }

  assert.equal(summarizeActivity(input).total, 3)
  assert.equal(summarizeActivity({ ...input, onlyUserId: "buyer-a" }).total, 1)
  assert.equal(summarizeActivity({ ...input, onlyUserId: "buyer-b" }).total, 2)
})

test("estimated minutes come only from activities that declare an assumption", () => {
  const summary = summarizeActivity({
    rows: [
      row("template", "created", "buyer-a", "2026-08-03T02:00:00.000Z"), // 8 min
      row("draft", "created", "buyer-a", "2026-08-03T02:00:00.000Z"), // 4 min
      row("campaign", "updated", "buyer-a", "2026-08-03T02:00:00.000Z"), // none declared
    ],
  })

  assert.equal(summary.estimatedMinutesSaved, 12)
  assert.equal(estimatedHoursSaved(summary.estimatedMinutesSaved, 6), 1.2)
})

test("an empty period is unavailable, not zero percent coverage and not a zero ratio", () => {
  assert.equal(automationCoverage(0, 0), null)
  assert.equal(automationCoverage(3, 1), 75)
  assert.equal(leverageRatio(4, 0), null)
  assert.equal(leverageRatio(3, 2), 1.5)
  assert.equal(delta(5, 0), null)
  assert.equal(delta(0, 0), 0)
  assert.equal(delta(6, 4), 50)
})

test("the report labels every number and never prints an uninstrumented activity as zero", () => {
  const activity = summarizeActivity({
    batches: [batch("buyer-a", "Kevin", "2026-08-03T02:00:00.000Z")],
    rows: [row("template", "created", "buyer-a", "2026-08-03T04:00:00.000Z")],
  })

  const markdown = buildTrackingReport({
    days: 7,
    generatedAt: "2026-08-05T02:00:00.000Z",
    orgName: "PATI",
    delivery: { batches: 1, fullSuccess: 1, nonSuccess: 0, adsCreated: 3, successRate: 100, averageSessionDurationMs: 90_000 },
    previous: { deltaBatches: null, deltaAdsCreated: 20, deltaSuccessRate: 5, deltaActivity: null, deltaActiveMembers: 0, deltaAutomationRuns: null },
    creative: { ready: 10, launched: 6, unlaunched: 4, launchRate: 60 },
    failureReasons: [],
    activity: {
      ...activity,
      leverageRatio: leverageRatio(activity.byClass.reuse, 1),
      estimatedHoursSaved: estimatedHoursSaved(activity.estimatedMinutesSaved, 0),
    },
    activityAvailable: true,
    instrumentedSince: "2026-08-01T00:00:00.000Z",
    automationRuns: 0,
    automationCoverage: null,
  })

  assert.ok(markdown.includes("**estimated**"))
  assert.ok(markdown.includes("no prior data") === false)
  assert.ok(markdown.includes("n/a")) // deltaBatches has no base — stated, not invented
  assert.ok(markdown.includes("Not measurable yet"))
  assert.ok(markdown.includes("Template used in a launch"))
  assert.ok(!/Template used in a launch.*\b0\b/.test(markdown))
  assert.ok(markdown.includes("Automation coverage:** unavailable"))
})

test("the report says so when app activity is not recorded at all", () => {
  const markdown = buildTrackingReport({
    days: 30,
    generatedAt: "2026-08-05T02:00:00.000Z",
    delivery: { batches: 0, fullSuccess: 0, nonSuccess: 0, adsCreated: 0, successRate: 0, averageSessionDurationMs: null },
    previous: { deltaBatches: null, deltaAdsCreated: null, deltaSuccessRate: 0, deltaActivity: null, deltaActiveMembers: null, deltaAutomationRuns: null },
    creative: { ready: 0, launched: 0, unlaunched: 0, launchRate: 0 },
    failureReasons: [],
    activity: null,
    activityAvailable: false,
    instrumentedSince: null,
    automationRuns: 0,
    automationCoverage: null,
  })

  assert.ok(markdown.includes("activity_log is not applied"))
  assert.ok(markdown.includes("Adoption:** unavailable"))
})
