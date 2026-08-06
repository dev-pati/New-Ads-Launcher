import { NextRequest, NextResponse } from "next/server"
import {
  buildEvaluationSpec,
  buildExecutionSpec,
  buildScheduleSpec,
  checkRuleWarnings,
  parseRule,
  type RuleDraft,
} from "@/lib/meta-ad-rules"
import {
  GRAPH,
  RULE_FIELDS,
  graphError,
  isErrorResponse,
  normalizeDraft,
  resolveRuleRequest,
} from "./_shared"

export const dynamic = "force-dynamic"

/** GET /api/facebook/rules?adAccountId=... — list rules, already decoded for the table */
export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveRuleRequest(request, "read")
    if (isErrorResponse(resolved)) return resolved
    const { token, accountPath } = resolved

    const res = await fetch(
      `${GRAPH}/${accountPath}/adrules_library?fields=${RULE_FIELDS}&limit=100&access_token=${token}`
    )
    const data = await res.json()
    if (data.error) return graphError(data)

    const raw: any[] = data.data || []
    return NextResponse.json({
      rules: raw.map(r => ({ ...parseRule(r), raw: r })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/** POST /api/facebook/rules — create a rule from a full draft */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adAccountId, ...rest } = body as { adAccountId?: string } & Partial<RuleDraft>

    const resolved = await resolveRuleRequest(request, "write", adAccountId)
    if (isErrorResponse(resolved)) return resolved
    const { token, accountPath } = resolved

    const draft = normalizeDraft(rest)
    if (!draft.name?.trim()) {
      return NextResponse.json({ error: "Rule name required" }, { status: 400 })
    }
    if (!draft.action) {
      return NextResponse.json({ error: "Action required" }, { status: 400 })
    }
    if (!draft.conditions.length) {
      return NextResponse.json({ error: "At least one condition required" }, { status: 400 })
    }

    // Blocking warnings are refused server-side too — the UI shows them, but a rule that
    // resets learning every 30 minutes must not be creatable by any client.
    const warnings = checkRuleWarnings(draft)
    const blocking = warnings.filter(w => w.severity === "block")
    if (blocking.length && !body.acknowledgeWarnings) {
      return NextResponse.json({ error: blocking[0].message, warnings }, { status: 400 })
    }

    const params = new URLSearchParams({
      access_token: token,
      name: draft.name.trim(),
      evaluation_spec: JSON.stringify(buildEvaluationSpec(draft)),
      execution_spec: JSON.stringify(buildExecutionSpec(draft)),
      schedule_spec: JSON.stringify(buildScheduleSpec(draft)),
      status: body.status === "DISABLED" ? "DISABLED" : "ENABLED",
    })

    const res = await fetch(`${GRAPH}/${accountPath}/adrules_library`, {
      method: "POST",
      body: params,
    })
    const data = await res.json()
    if (data.error) return graphError(data)

    return NextResponse.json({ rule: data, warnings }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
