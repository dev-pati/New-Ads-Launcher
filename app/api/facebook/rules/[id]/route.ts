import { NextRequest, NextResponse } from "next/server"
import {
  buildEvaluationSpec,
  buildExecutionSpec,
  buildScheduleSpec,
  checkRuleWarnings,
  parseRule,
} from "@/lib/meta-ad-rules"
import {
  GRAPH,
  RULE_FIELDS,
  graphError,
  isErrorResponse,
  normalizeDraft,
  resolveRuleRequest,
} from "../_shared"

export const dynamic = "force-dynamic"

/** GET /api/facebook/rules/<id>?adAccountId=... — read one rule, decoded */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolved = await resolveRuleRequest(request, "read")
    if (isErrorResponse(resolved)) return resolved
    const { id } = await params

    const res = await fetch(`${GRAPH}/${id}?fields=${RULE_FIELDS}&access_token=${resolved.token}`)
    const data = await res.json()
    if (data.error) return graphError(data)

    return NextResponse.json({ rule: { ...parseRule(data), raw: data } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/facebook/rules/<id> — edit a rule, or just flip its status.
 *
 * Meta updates rules with a POST to the rule id; only the fields you send change. Sending
 * `{ status }` alone is how the row toggle works, so the toggle never has to reconstruct
 * the whole spec (and cannot corrupt it by reconstructing it wrong).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json()
    const { adAccountId, statusOnly, ...rest } = body

    const resolved = await resolveRuleRequest(request, "write", adAccountId)
    if (isErrorResponse(resolved)) return resolved
    const { id } = await params

    const params_ = new URLSearchParams({ access_token: resolved.token })
    let warnings: ReturnType<typeof checkRuleWarnings> = []

    if (statusOnly) {
      if (body.status !== "ENABLED" && body.status !== "DISABLED") {
        return NextResponse.json({ error: "status must be ENABLED or DISABLED" }, { status: 400 })
      }
      params_.set("status", body.status)
    } else {
      const draft = normalizeDraft(rest)
      if (!draft.name?.trim()) return NextResponse.json({ error: "Rule name required" }, { status: 400 })
      if (!draft.action) return NextResponse.json({ error: "Action required" }, { status: 400 })
      if (!draft.conditions.length) {
        return NextResponse.json({ error: "At least one condition required" }, { status: 400 })
      }

      warnings = checkRuleWarnings(draft)
      const blocking = warnings.filter(w => w.severity === "block")
      if (blocking.length && !body.acknowledgeWarnings) {
        return NextResponse.json({ error: blocking[0].message, warnings }, { status: 400 })
      }

      params_.set("name", draft.name.trim())
      params_.set("evaluation_spec", JSON.stringify(buildEvaluationSpec(draft)))
      params_.set("execution_spec", JSON.stringify(buildExecutionSpec(draft)))
      params_.set("schedule_spec", JSON.stringify(buildScheduleSpec(draft)))
      if (body.status === "ENABLED" || body.status === "DISABLED") params_.set("status", body.status)
    }

    const res = await fetch(`${GRAPH}/${id}`, { method: "POST", body: params_ })
    const data = await res.json()
    if (data.error) return graphError(data)

    return NextResponse.json({ success: true, warnings })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/** DELETE /api/facebook/rules/<id>?adAccountId=... */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolved = await resolveRuleRequest(request, "write")
    if (isErrorResponse(resolved)) return resolved
    const { id } = await params

    const res = await fetch(`${GRAPH}/${id}?access_token=${resolved.token}`, { method: "DELETE" })
    const data = await res.json()
    if (data.error) return graphError(data)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
