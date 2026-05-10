import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

export const dynamic = "force-dynamic"

const GRAPH = "https://graph.facebook.com/v25.0"

const RULE_FIELDS = [
  "id", "name", "status", "schedule_spec", "trigger_subscriptions",
  "actions", "evaluation_spec", "created_time",
].join(",")

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const sp = request.nextUrl.searchParams
    const adAccountId = sp.get("adAccountId") || ""
    if (!adAccountId) return NextResponse.json({ error: "adAccountId required" }, { status: 400 })

    const accountPath = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const token = connection.access_token

    const res = await fetch(
      `${GRAPH}/${accountPath}/adrules_library?fields=${RULE_FIELDS}&limit=50&access_token=${token}`
    )
    const data = await res.json()

    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 })
    return NextResponse.json({ rules: data.data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const body = await request.json()
    const { adAccountId, name, triggerType, conditions, action, schedule } = body

    if (!adAccountId || !name || !action) {
      return NextResponse.json({ error: "adAccountId, name, and action required" }, { status: 400 })
    }

    const accountPath = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const token = connection.access_token

    // Build Facebook Automated Rules spec
    const filters = (conditions || []).map((c: any) => ({
      field: c.field,
      value: String(c.value),
      operator: c.operator,
    }))

    const actionEntry: Record<string, any> = { type: action.type }
    if (action.value) actionEntry.value = String(action.value)

    // execution_type: SEND_NOTIFICATION for notify actions, ROTATE for everything else
    const executionType = action.type === "SEND_NOTIFICATION" ? "SEND_NOTIFICATION" : "ROTATE"

    const params = new URLSearchParams({
      access_token: token,
      name,
      evaluation_spec: JSON.stringify({
        evaluation_type: "SCHEDULE",
        filters,
      }),
      execution_spec: JSON.stringify({
        execution_type: executionType,
      }),
      schedule_spec: JSON.stringify({
        schedule_type: schedule?.type || "DAILY",
      }),
      actions: JSON.stringify([actionEntry]),
      status: "ENABLED",
    })

    const res = await fetch(`${GRAPH}/${accountPath}/adrules_library`, {
      method: "POST",
      body: params,
    })
    const data = await res.json()

    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 })
    return NextResponse.json({ rule: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
