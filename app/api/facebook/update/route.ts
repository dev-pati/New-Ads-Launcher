import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getConnectionForAdAccount, isManual, MissingViaError, requireRole } from "@/lib/auth"
import { updateNode } from "@/lib/facebook"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const denied = requireRole(ctx)
    if (denied) return denied

    const body = await request.json()
    const {
      id, name, status, daily_budget, lifetime_budget, start_time, end_time, adAccountId,
      optimization_goal, bid_strategy, bid_amount, attribution_spec, promoted_object, targeting,
      publisher_platforms, device_platforms, facebook_positions, instagram_positions,
      audience_network_positions, messenger_positions, advertiser, payer
    } = body

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    // Via MECE: mutation = WRITE → via launch của account → OAuth → block (VIA-MASTER.md)
    let connection
    try {
      connection = await getConnectionForAdAccount(ctx.orgId, adAccountId, "write")
    } catch (err) {
      if (err instanceof MissingViaError) {
        return NextResponse.json({ error: err.message, code: "MISSING_LAUNCH_VIA" }, { status: 400 })
      }
      throw err
    }
    if (!connection) return NextResponse.json({ error: "No Facebook connection found" }, { status: 401 })

    await updateNode(id, connection.access_token, {
      name,
      status,
      daily_budget,
      lifetime_budget,
      start_time,
      end_time,
      optimization_goal,
      bid_strategy,
      bid_amount,
      attribution_spec,
      promoted_object,
      targeting,
      publisher_platforms,
      device_platforms,
      facebook_positions,
      instagram_positions,
      audience_network_positions,
      messenger_positions,
      advertiser,
      payer,
    }, { isManual: isManual(connection) })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[facebook/update]", err)
    return NextResponse.json({ error: err.message || "Failed to update" }, { status: 500 })
  }
}
