import { NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { recordActivity } from "@/lib/notifications/emit"

export const dynamic = "force-dynamic"

/**
 * Records that somebody actually took the report out of the app.
 *
 * This is the single exception to Tracking's own rule that reading does not count —
 * and it is an export, not a page view. Without it there is no way to answer "is
 * anyone using this dashboard", which is exactly the blindness that lets a shipped
 * feature sit unused (BL-12). It is deliberately excluded from ACTIVITY_CATALOG so it
 * can never inflate anybody's valuable-action count.
 */
export async function POST() {
  const context = await getAuthContext()
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await recordActivity({
    orgId: context.orgId,
    actorId: context.user.id,
    actorName: context.user.full_name || context.user.email?.split("@")[0] || "Someone",
    objectType: "report",
    objectId: `tracking:${context.user.id}`,
    objectName: "Tracking report",
    action: "completed",
  })

  return NextResponse.json({ ok: result.ok, degraded: result.degraded })
}
