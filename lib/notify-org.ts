import { emitAndLog } from "./notifications/emit"
import type { NotificationAction, NotificationType, ObjectType } from "./notifications/types"

/**
 * @deprecated Use `emitAndLog` from `lib/notifications/emit` directly.
 *
 * Kept as a shim so a call site added while this refactor was in flight still
 * delivers, rather than silently notifying nobody. It maps the four legacy type ids
 * onto the structured ones and drops the pre-built `title` — the new emitter builds
 * the sentence from parts.
 *
 * Behaviour change worth knowing about: the actor no longer receives their own
 * notification, and delivery is filtered by role.
 */

const LEGACY_MAP: Record<
  string,
  { type: NotificationType; action: NotificationAction; objectType: ObjectType }
> = {
  ad_launched: { type: "ad.launched", action: "launched", objectType: "batch" },
  asset_uploaded: { type: "asset.uploaded", action: "created", objectType: "creative" },
  template_created: { type: "template.created", action: "created", objectType: "template" },
  member_joined: { type: "member.joined", action: "joined", objectType: "member" },
}

export async function notifyOrgMembers({
  orgId,
  actorId,
  actorName,
  type,
  title,
  body,
  link,
}: {
  orgId: string
  actorId: string
  actorName: string
  type: string
  title: string
  body?: string
  link?: string
}) {
  const mapped = LEGACY_MAP[type]
  if (!mapped) {
    console.error(`[notify-org] unknown legacy type "${type}" — no notification sent`)
    return
  }

  await emitAndLog("legacy", {
    orgId,
    actorId,
    actorName,
    type: mapped.type,
    action: mapped.action,
    objectType: mapped.objectType,
    objectId: `${type}:${Date.now()}`,
    objectName: null,
    body: body ?? title,
    link: link ?? null,
    dedupeKey: null,
  })
}
