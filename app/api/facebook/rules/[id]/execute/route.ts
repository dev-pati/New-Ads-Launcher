import { NextRequest, NextResponse } from "next/server"
import { GRAPH, graphError, isErrorResponse, resolveRuleRequest } from "../../_shared"

export const dynamic = "force-dynamic"

/**
 * POST /api/facebook/rules/<id>/execute — run the rule now, without waiting for its schedule.
 *
 * This is the `Run` button inside Meta's preview dialog. It is a real mutation: it can turn
 * off every entity the preview listed, and there is no undo. The UI must show the preview
 * count first and require an explicit confirm.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json().catch(() => ({}))
    const resolved = await resolveRuleRequest(request, "write", body.adAccountId)
    if (isErrorResponse(resolved)) return resolved
    const { id } = await params

    const res = await fetch(`${GRAPH}/${id}/execute`, {
      method: "POST",
      body: new URLSearchParams({ access_token: resolved.token }),
    })
    const data = await res.json()
    if (data.error) return graphError(data)

    return NextResponse.json({ success: true, result: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
