import { createAdminClient } from "@/lib/supabase/admin"
import { buildBody, buildTitle, redactChanges } from "./message"
import {
  ROLE_VISIBILITY,
  type FieldChange,
  type NotificationAction,
  type NotificationType,
  type ObjectType,
} from "./types"
import { notificationCategoryForType } from "./category"

/**
 * The single write path for notifications and the audit log.
 *
 * Three things this does that `notifyOrgMembers` did not:
 *
 *  1. **Excludes the actor.** Nobody is told what they just did.
 *  2. **Filters by role.** ROLE_VISIBILITY is a permission check — a commenter has
 *     no route into ads-manager, so a launch notification would be a dead link and
 *     a leak of ad-account activity.
 *  3. **Reports what happened.** It returns counts and errors instead of swallowing
 *     them into console.error, so a route can log a real outcome. There is no
 *     observability in this app (TD-06); a silent notification failure is invisible.
 *
 * Backward compatibility: the v2 columns (object_type, changes, dedupe_key, …) and
 * `activity_log` may not exist yet — 20260803_* is written but applying it needs
 * sign-off on the shared project. Every write degrades to the pre-v2 shape on a
 * missing-column / missing-table error and reports `degraded: true`.
 */

export type EmitInput = {
  orgId: string
  actorId: string | null
  actorName: string
  type: NotificationType
  action: NotificationAction
  objectType: ObjectType
  objectId: string
  objectName?: string | null
  /** Fields that actually changed. Empty on an `updated` action means "nothing to say". */
  changes?: FieldChange[]
  /** Deep link. Must be an app-relative path. */
  link?: string | null
  /** Free-text body used when there are no field changes to spell out. */
  body?: string | null
  /** Plural count for "launched 12 ads". */
  count?: number | null
  /** Trailing clause for the title: `{ preposition: "to", name: "Hooray 37" }`. */
  context?: { preposition: string; name: string } | null
  /**
   * Idempotency key, unique per recipient. Same key twice = one notification.
   * Defaults to `{type}:{objectId}`, which is right for anything keyed to a batch,
   * job or row id. Pass a distinct key when the same object legitimately produces
   * repeated notifications.
   */
  dedupeKey?: string | null
  /**
   * Restrict delivery to these user ids (still intersected with org membership and
   * role visibility). Used for "assigned to you" and job-owner notifications.
   */
  onlyUserIds?: string[] | null
  /** Deliver to these users regardless of role — e.g. the person whose role changed. */
  alsoUserIds?: string[] | null
  source?: string
  requestId?: string | null
}

export type EmitResult = {
  ok: boolean
  /** True when there was genuinely nothing worth notifying about. */
  skipped: boolean
  reason?: string
  recipients: number
  inserted: number
  activityLogged: boolean
  /** True when the v2 schema is not applied and the legacy shape was written. */
  degraded: boolean
  errors: string[]
}

/** PostgREST / Postgres codes meaning "that column or table isn't there". */
function isSchemaGap(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === "42703" || err.code === "42P01" || err.code === "PGRST204") return true
  return /column .* does not exist|could not find the .* column|relation .* does not exist/i.test(
    err.message || ""
  )
}

function safeLink(link: string | null | undefined): string | null {
  if (!link) return null
  // App-relative only. A notification is not a place to hand somebody an external URL.
  return link.startsWith("/") && !link.startsWith("//") ? link : null
}

export async function emitNotification(input: EmitInput): Promise<EmitResult> {
  const errors: string[] = []
  const base: EmitResult = {
    ok: false,
    skipped: false,
    recipients: 0,
    inserted: 0,
    activityLogged: false,
    degraded: false,
    errors,
  }

  const changes = redactChanges(input.changes ?? [])

  // "Edited then reverted" is not news. Neither is a PATCH that changed nothing.
  if (input.action === "updated" && changes.length === 0 && !input.body) {
    return { ...base, ok: true, skipped: true, reason: "no field changed" }
  }

  const db = createAdminClient()

  const { data: members, error: membersErr } = await db
    .from("org_members")
    .select("user_id, role")
    .eq("org_id", input.orgId)

  if (membersErr) {
    errors.push(`members: ${membersErr.message}`)
    return base
  }

  const visibleRoles = new Set(ROLE_VISIBILITY[input.type] ?? [])
  const only = input.onlyUserIds ? new Set(input.onlyUserIds) : null
  const also = new Set(input.alsoUserIds ?? [])

  const recipients = (members ?? [])
    .filter(m => m.user_id !== input.actorId)
    .filter(m => (only ? only.has(m.user_id) : true))
    .filter(m => visibleRoles.has(m.role) || also.has(m.user_id))
    .map(m => m.user_id as string)

  const title = buildTitle({
    actorName: input.actorName,
    action: input.action,
    objectType: input.objectType,
    objectName: input.objectName,
    count: input.count,
    context: input.context,
  })
  const body = buildBody(changes, input.body)
  const link = safeLink(input.link)
  const dedupeKey = input.dedupeKey ?? `${input.type}:${input.objectId}`

  // ── Audit log: one row per event, written even when nobody is notified ──────────
  const { error: auditErr } = await db.from("activity_log").insert({
    org_id: input.orgId,
    actor_id: input.actorId,
    actor_name: input.actorName,
    object_type: input.objectType,
    object_id: input.objectId,
    object_name: input.objectName ?? null,
    action: input.action,
    changes,
    source: input.source ?? "app",
    request_id: input.requestId ?? null,
  })

  let degraded = false
  if (auditErr) {
    if (isSchemaGap(auditErr)) degraded = true
    else errors.push(`activity_log: ${auditErr.message}`)
  }

  if (recipients.length === 0) {
    return {
      ...base,
      ok: errors.length === 0,
      skipped: true,
      reason: "no eligible recipient",
      activityLogged: !auditErr,
      degraded,
    }
  }

  // ── Delivery: one row per recipient, idempotent on (user_id, dedupe_key) ───────
  // Preferences are enforced at the shared delivery seam. Missing schema fails open
  // so a rollout never silently drops notifications.
  let deliveryRecipients = recipients
  const category = notificationCategoryForType(input.type)
  const { data: preferences, error: preferencesErr } = await db
    .from("notification_preferences")
    .select("user_id, in_app_enabled")
    .eq("org_id", input.orgId)
    .eq("category", category)
    .in("user_id", recipients)

  if (preferencesErr) {
    if (isSchemaGap(preferencesErr)) degraded = true
    else errors.push(`notification_preferences: ${preferencesErr.message}`)
  } else {
    const optedOut = new Set(
      (preferences ?? [])
        .filter(preference => !preference.in_app_enabled)
        .map(preference => preference.user_id as string)
    )
    deliveryRecipients = recipients.filter(userId => !optedOut.has(userId))
  }

  if (deliveryRecipients.length === 0) {
    return {
      ...base,
      ok: errors.length === 0,
      skipped: true,
      reason: "all eligible recipients disabled this category",
      activityLogged: !auditErr,
      degraded,
    }
  }

  const v2Rows = deliveryRecipients.map(userId => ({
    org_id: input.orgId,
    user_id: userId,
    actor_id: input.actorId,
    actor_name: input.actorName,
    type: input.type,
    title,
    body,
    link,
    object_type: input.objectType,
    object_id: input.objectId,
    object_name: input.objectName ?? null,
    action: input.action,
    changes,
    dedupe_key: dedupeKey,
  }))

  let inserted = 0
  const { data, error } = await db
    .from("notifications")
    .upsert(v2Rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
    .select("id")

  if (!error) {
    inserted = data?.length ?? 0
  } else if (isSchemaGap(error)) {
    degraded = true
    const legacyRows = deliveryRecipients.map(userId => ({
      org_id: input.orgId,
      user_id: userId,
      actor_id: input.actorId,
      actor_name: input.actorName,
      type: input.type,
      title,
      body,
      link,
    }))
    const legacy = await db.from("notifications").insert(legacyRows).select("id")
    if (legacy.error) errors.push(`notifications(legacy): ${legacy.error.message}`)
    else inserted = legacy.data?.length ?? 0
  } else {
    errors.push(`notifications: ${error.message}`)
  }

  return {
    ok: errors.length === 0,
    skipped: false,
    recipients: deliveryRecipients.length,
    inserted,
    activityLogged: !auditErr,
    degraded,
    errors,
  }
}

/**
 * Fire-and-report wrapper for route handlers.
 *
 * Never throws — a failed notification must not fail a launch — but never goes quiet
 * either: every failure lands in the log with the event that produced it, and the
 * result is returned so a caller that wants to surface it can.
 */
export async function emitAndLog(tag: string, input: EmitInput): Promise<EmitResult> {
  try {
    const result = await emitNotification(input)
    if (result.errors.length) {
      console.error(`[notify:${tag}] ${input.type} ${input.objectId} failed:`, result.errors)
    } else if (result.degraded) {
      console.warn(
        `[notify:${tag}] ${input.type} written in legacy shape — apply 20260803_notifications_v2.sql / 20260803_activity_log.sql`
      )
    }
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[notify:${tag}] ${input.type} threw:`, message)
    return {
      ok: false,
      skipped: false,
      recipients: 0,
      inserted: 0,
      activityLogged: false,
      degraded: false,
      errors: [message],
    }
  }
}

/**
 * Audit-only record: something happened that is worth being able to trace, but that
 * nobody needs to be told about. Same table, no delivery rows.
 */
export async function recordActivity(input: {
  orgId: string
  actorId: string | null
  actorName: string
  objectType: ObjectType
  objectId: string
  objectName?: string | null
  action: NotificationAction
  changes?: FieldChange[]
  source?: string
  requestId?: string | null
}): Promise<{ ok: boolean; degraded: boolean; error?: string }> {
  try {
    const db = createAdminClient()
    const { error } = await db.from("activity_log").insert({
      org_id: input.orgId,
      actor_id: input.actorId,
      actor_name: input.actorName,
      object_type: input.objectType,
      object_id: input.objectId,
      object_name: input.objectName ?? null,
      action: input.action,
      changes: redactChanges(input.changes ?? []),
      source: input.source ?? "app",
      request_id: input.requestId ?? null,
    })
    if (error) {
      if (isSchemaGap(error)) return { ok: false, degraded: true }
      console.error("[activity] insert failed:", error.message)
      return { ok: false, degraded: false, error: error.message }
    }
    return { ok: true, degraded: false }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[activity] threw:", message)
    return { ok: false, degraded: false, error: message }
  }
}
