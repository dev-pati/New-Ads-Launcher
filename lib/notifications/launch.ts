import { emitAndLog } from "./emit"

/**
 * Launch outcome notification, shared by all three launch routes.
 *
 * All three write `launch_batches` (CONTEXT.md); all three should say the same thing
 * about the same event. Before this, `launch` said nothing at all, and the other two
 * only spoke when something succeeded — a launch where 3 of 12 ads failed looked
 * exactly like a clean one.
 */
export async function notifyLaunchOutcome(input: {
  orgId: string
  actorId: string
  actorName: string
  batchId: string | null
  adAccountName: string | null
  /** Ad set or campaign the ads landed in, when the route knows one. */
  targetName: string | null
  created: number
  failed: number
  source: string
}) {
  const { orgId, actorId, actorName, batchId, adAccountName, targetName, created, failed, source } =
    input

  if (created === 0 && failed === 0) return

  const link = batchId ? `/ads-manager?batch=${batchId}` : "/ads-manager"
  // Without a batch row there is no stable id to dedupe on; fall back to the actor
  // and minute, which collapses a double-click without collapsing two real launches.
  const anchor = batchId ?? `${actorId}:${Math.floor(Date.now() / 60000)}`

  if (created > 0) {
    await emitAndLog(source, {
      orgId,
      actorId,
      actorName,
      type: "ad.launched",
      action: "launched",
      objectType: "ad",
      objectId: anchor,
      objectName: targetName,
      count: created,
      body: targetName
        ? `Launched to "${targetName}"${adAccountName ? ` on ${adAccountName}` : ""}.`
        : adAccountName
          ? `Launched on ${adAccountName}.`
          : null,
      link,
      dedupeKey: `ad.launched:${anchor}`,
      source,
    })
  }

  if (failed > 0) {
    const total = created + failed
    await emitAndLog(source, {
      orgId,
      actorId,
      actorName,
      type: "ad.launch_failed",
      action: "failed",
      objectType: "batch",
      objectId: anchor,
      objectName: targetName ?? adAccountName,
      body: `${failed} of ${total} ad${total === 1 ? "" : "s"} failed to launch${
        adAccountName ? ` on ${adAccountName}` : ""
      }. View error details.`,
      link,
      dedupeKey: `ad.launch_failed:${anchor}`,
      source,
    })
  }
}
