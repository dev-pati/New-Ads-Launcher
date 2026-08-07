/**
 * What counts as valuable work in this app — and what deliberately does not.
 *
 * Tracking v1 measured one activity: submitting a launch. Anyone whose week was
 * spent building templates, mapping Portal media, fixing a budget on a live ad set
 * or closing a creative request showed up as having done nothing. This catalog is
 * the answer to "valuable activity is not only launching ads".
 *
 * ── The filter ────────────────────────────────────────────────────────────────
 * An activity earns a place here only if all three hold:
 *
 *   1. A person decided to do it. Not a cron, not a page render.
 *   2. It moves a launch forward, makes the next launch cheaper, or protects money
 *      already being spent.
 *   3. It left a durable row behind. If nothing changed in the database, it did not
 *      happen — we refuse to infer work from page views.
 *
 * That third rule is why opening a screen, filtering a table, scrolling, logging in
 * and refreshing are *not* in this file and must never be added. Counting them
 * inflates "usage" without proving value, and the first person to notice would be
 * right to stop trusting the whole dashboard.
 *
 * ── Where the numbers come from ───────────────────────────────────────────────
 * `activity_log` (one row per event, actor attributed) is the primary source. Two
 * exceptions, both deliberate:
 *
 *   - Launch batches are counted from `launch_batches`, not from the `ad:launched`
 *     activity row, because that table is complete back to the beginning while
 *     `activity_log` starts empty on the day it is applied. The two matching
 *     activity_log pairs are listed in EXCLUDED_MATCHES so a batch is never counted
 *     twice.
 *   - Page Manage work comes from `page_manage_activity`, which has its own
 *     append-only table with `actor_id` and predates activity_log.
 *
 * ── status, and why a zero is not always a zero ───────────────────────────────
 *   live            — a producer exists today; a 0 means nobody did it.
 *   pending_emit    — the act happens in the product but nothing records who did it.
 *                     The UI must show "not instrumented", never 0.
 *   not_instrumented— same, and not scheduled. Each one carries its blocker.
 *
 * `automations` and `ad_set_presets` have no actor column at all (TD-31), so their
 * activity can only ever be attributed through activity_log.
 */

export type ActivityClass = "produce" | "reuse" | "govern" | "collaborate"

export type ActivityStatus = "live" | "pending_emit" | "not_instrumented"

export type ActivityDefinition = {
  /** Stable key. Used in the API payload and in the report; never renumber. */
  key: string
  label: string
  class: ActivityClass
  status: ActivityStatus
  /** `object_type:action` pairs in activity_log that produce this activity. */
  match: string[]
  /**
   * The shipped function a person uses to do this, in the words of the screen.
   *
   * `evidence` answers "which row proves it" and is written for an engineer. This one
   * answers the question a reader of the dashboard actually asks — "Produce counts
   * actions on *what*?" — and must name a screen someone can open. Keep it concrete:
   * a menu label and its route, never a subsystem name.
   */
  surface: string
  /** Shown in the methodology dialog: where the number literally comes from. */
  evidence: string
  /**
   * Estimated minutes of manual work avoided each time this happens.
   *
   * These are ASSUMPTIONS, not measurements — nothing in the app times a human.
   * Every surface that uses them must label the result "estimated". Replace with a
   * one-off time study (5 people, one session) before this reaches a CEO deck.
   * Decision D3 in specs/tracking/README.md.
   */
  minutesSaved?: number
  /** Which of the eight KPIs in product/overview.md §11 this feeds. */
  kpi: string
}

export const CLASS_LABEL: Record<ActivityClass, string> = {
  produce: "Produce",
  reuse: "Reuse",
  govern: "Govern",
  collaborate: "Collaborate",
}

export const CLASS_DESCRIPTION: Record<ActivityClass, string> = {
  produce: "Creates something launchable — creatives, media mappings, ads.",
  reuse: "Makes the next launch cheaper — templates, presets, drafts.",
  govern: "Protects money already being spent — edits, pauses, automation.",
  collaborate: "Keeps the creative supply chain and the feedback loop moving.",
}

/** Ordering used everywhere the four classes are displayed. */
export const CLASS_ORDER: ActivityClass[] = ["produce", "reuse", "govern", "collaborate"]

/**
 * Counted from `launch_batches` instead, so they must not also be counted from
 * activity_log. Delivery and App Activity are two views of the work, not two tallies
 * of the same event.
 */
export const EXCLUDED_MATCHES: ReadonlySet<string> = new Set(["ad:launched", "batch:failed"])

/** Estimated minutes of manual watching avoided per automation execution. Assumption. */
export const AUTOMATION_MINUTES_SAVED = 10

export const ACTIVITY_CATALOG: ActivityDefinition[] = [
  // ── Produce ────────────────────────────────────────────────────────────────
  {
    key: "launch.submitted",
    label: "Launch submitted",
    class: "produce",
    status: "live",
    match: [],
    surface: "Launch (/launch) — Quick launch, Table mode, and the Launch ads dialog in Ads Manager.",
    evidence: "One launch_batches row, from any of the three launch routes.",
    kpi: "Ads launched / week",
  },
  {
    key: "portal_media.assigned",
    label: "Portal media assigned",
    class: "produce",
    status: "live",
    match: ["media_assignment:assigned"],
    surface:
      "Assets (/assets) — Portal Vault, assigning an approved asset to an org and ad account. Counted once the whole batch is assigned; Meta delivery follows automatically and is not counted separately.",
    evidence:
      "media.assigned from /api/portal-media/assignments, counted only when every asset in the batch succeeds. Partial batches are not counted.",
    minutesSaved: 2,
    kpi: "Manual-hours saved",
  },
  {
    key: "creative.updated",
    label: "Creative edited",
    class: "produce",
    status: "live",
    match: ["creative:updated"],
    surface: "Assets (/assets) — renaming or re-tagging a creative card.",
    evidence: "creative.updated from /api/creatives/[id].",
    kpi: "Ads launched / week",
  },

  // ── Reuse ──────────────────────────────────────────────────────────────────
  {
    key: "template.created",
    label: "Ad copy template created",
    class: "reuse",
    status: "live",
    match: ["template:created"],
    surface: "Templates (/templates) — New template. Also Ads Manager (/ads-manager) → Save ad as template.",
    evidence: "template.created from /api/templates and /api/templates/from-ad.",
    minutesSaved: 8,
    kpi: "Manual-hours saved",
  },
  {
    key: "template.updated",
    label: "Template refined",
    class: "reuse",
    status: "live",
    match: ["template:updated"],
    surface: "Templates (/templates) — editing an existing template.",
    evidence: "template.updated from /api/templates/[id].",
    minutesSaved: 3,
    kpi: "Manual-hours saved",
  },
  {
    key: "preset.created",
    label: "Ad set preset saved",
    class: "reuse",
    status: "live",
    match: ["preset:created"],
    surface: "Presets (/presets) — Save ad set preset. Also the Save preset button inside the Launch ads dialog.",
    evidence: "recordActivity from /api/presets. ad_set_presets itself has no actor column (TD-31).",
    minutesSaved: 5,
    kpi: "Manual-hours saved",
  },
  {
    key: "draft.saved",
    label: "Launch draft saved",
    class: "reuse",
    status: "live",
    match: ["draft:created"],
    surface: "Launch (/launch) — Save draft, so a half-built launch survives leaving the page.",
    evidence: "recordActivity from /api/launch-drafts; artifact row in launch_drafts.user_id.",
    minutesSaved: 4,
    kpi: "Time-to-launch",
  },
  {
    key: "template.applied",
    label: "Template used in a launch",
    class: "reuse",
    status: "not_instrumented",
    match: ["template:applied"],
    surface: "Launch (/launch) — Load copy, the template picker on the ad form. The click happens; nothing records it.",
    evidence:
      "Not recorded. The launch payload carries the copy, not the template id, so 'what % of launches reuse a template' cannot be answered yet. Needs a template_id column on launch_batches or an emit at the launch routes — BL-12 slice 2.",
    kpi: "Manual-hours saved",
  },
  {
    key: "preset.applied",
    label: "Preset used in a launch",
    class: "reuse",
    status: "not_instrumented",
    match: ["preset:applied"],
    surface: "Launch (/launch) — loading a saved preset into the ad set form. Not recorded either.",
    evidence: "Not recorded, same reason as template.applied.",
    kpi: "Time-to-launch",
  },

  // ── Govern ─────────────────────────────────────────────────────────────────
  {
    key: "campaign.updated",
    label: "Campaign edited",
    class: "govern",
    status: "live",
    match: ["campaign:updated"],
    surface: "Ads Manager (/ads-manager) — editing a campaign row: name, objective, on/off.",
    evidence: "campaign.updated from /api/facebook/update.",
    kpi: "Launch success rate",
  },
  {
    key: "adset.updated",
    label: "Ad set edited",
    class: "govern",
    status: "live",
    match: ["adset:updated"],
    surface: "Ads Manager (/ads-manager) — the Edit ad set drawer: budget, schedule, targeting.",
    evidence: "adset.updated from /api/facebook/update — budget, schedule and targeting changes on live spend.",
    kpi: "Launch success rate",
  },
  {
    key: "ad.updated",
    label: "Ad edited or paused",
    class: "govern",
    status: "live",
    match: ["ad:updated"],
    surface: "Ads Manager (/ads-manager) — editing an ad or flipping its on/off switch.",
    evidence: "ad.status_changed from /api/facebook/update.",
    kpi: "Launch success rate",
  },
  {
    key: "automation.created",
    label: "Automation created",
    class: "govern",
    status: "live",
    match: ["automation:created"],
    surface: "Automate (/automate) — the workflow builder, saving a new rule.",
    evidence: "recordActivity from /api/automations. The automations table has no actor column (TD-31).",
    minutesSaved: 15,
    kpi: "Automation coverage",
  },
  {
    key: "automation.updated",
    label: "Automation tuned",
    class: "govern",
    status: "live",
    match: ["automation:updated"],
    surface: "Automate (/automate) — changing an existing rule's trigger, condition or action.",
    evidence: "automation.updated from /api/automations/[id].",
    kpi: "Automation coverage",
  },
  {
    key: "scheduled_activation.created",
    label: "Activation scheduled",
    class: "govern",
    status: "not_instrumented",
    match: ["scheduled_activation:created"],
    surface: "Launch (/launch) — setting an activation time on a launch, written by launch-direct and launch-table-batch.",
    evidence: "scheduled_activations has no actor column and no emit. Who scheduled an activation is not recoverable — TD-31.",
    kpi: "Automation coverage",
  },

  // ── Collaborate ────────────────────────────────────────────────────────────
  {
    key: "request.updated",
    label: "Creative request moved",
    class: "collaborate",
    status: "live",
    match: ["request:updated"],
    surface: "Assets (/assets) — Creative requests: moving a request's status or editing its brief.",
    evidence: "request.status_changed and request.updated from /api/assets/requests/[id].",
    kpi: "Feedback loop age",
  },
  {
    key: "page.content",
    label: "Page content published",
    class: "collaborate",
    status: "live",
    match: ["page_manage:content"],
    surface: "Page Manager (/page-manager) — Content: publishing or scheduling a Page post.",
    evidence: "page_manage_activity rows with module = content.",
    kpi: "Adoption (WAU per org)",
  },
  {
    key: "page.comment",
    label: "Comment handled",
    class: "collaborate",
    status: "live",
    match: ["page_manage:comment"],
    surface: "Page Manager (/page-manager) — Comments: replying to, hiding or deleting a comment on an ad or post.",
    evidence: "page_manage_activity rows with module = comment.",
    kpi: "Feedback loop age",
  },
  {
    key: "page.inbox",
    label: "Inbox message handled",
    class: "collaborate",
    status: "live",
    match: ["page_manage:inbox"],
    surface: "Page Manager (/page-manager) — Inbox: answering a Messenger conversation.",
    evidence: "page_manage_activity rows with module = inbox.",
    kpi: "Feedback loop age",
  },
  {
    key: "member.joined",
    label: "Teammate onboarded",
    class: "collaborate",
    status: "live",
    match: ["member:joined"],
    surface: "Settings → Organization (/settings/organization) — adding a member to the org.",
    evidence: "member.joined from /api/orgs/[id]/members.",
    kpi: "Adoption (WAU per org)",
  },
  {
    key: "painpoint.submitted",
    label: "Weekly painpoint written",
    class: "collaborate",
    status: "live",
    match: ["painpoint:created"],
    surface: "Tracking → My usage (/tracking) — the weekly card at the bottom of the fallback block.",
    evidence: "recordActivity from /api/tracking/painpoint; artifact row in weekly_painpoints.",
    kpi: "Feedback loop age",
  },
]

/**
 * Adoption of Tracking itself.
 *
 * The one exception to "reading does not count" — and it is an export, not a view.
 * Without it there is no way to answer "did anyone actually use this dashboard", the
 * exact blindness that lets a shipped feature sit unused. It is kept out of
 * ACTIVITY_CATALOG on purpose: it must never inflate anybody's valuable-action count.
 */
export const REPORT_EXPORT_MATCH = "report:exported"

const byMatch = new Map<string, ActivityDefinition>()
for (const definition of ACTIVITY_CATALOG) {
  for (const pair of definition.match) byMatch.set(pair, definition)
}

/** `object_type:action` → the activity it means, or undefined if we do not count it. */
export const ACTIVITY_BY_MATCH: ReadonlyMap<string, ActivityDefinition> = byMatch

export function activityFor(objectType: string, action: string): ActivityDefinition | undefined {
  return byMatch.get(`${objectType}:${action}`)
}
