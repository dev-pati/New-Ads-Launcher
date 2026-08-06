import { NextRequest, NextResponse } from "next/server"
import { GRAPH, graphError, isErrorResponse, resolveRuleRequest } from "../../_shared"

export const dynamic = "force-dynamic"

/**
 * GET /api/facebook/rules/<id>/preview?adAccountId=...
 *
 * Answers the one question the list cannot: if this rule ran right now, what would it
 * touch? Meta's own dialog is titled "Preview of rule results" and this is the same edge.
 *
 * ⚠️ VERIFY-AGAINST-LIVE-API: the `preview` edge shape is the least-documented part of
 * adrules_library. If Meta returns a different envelope, fix it here — the UI only reads
 * { entities, count }.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolved = await resolveRuleRequest(request, "read")
    if (isErrorResponse(resolved)) return resolved
    const { id } = await params

    const fields = "id,name,effective_status"
    const res = await fetch(
      `${GRAPH}/${id}/preview?fields=${fields}&limit=100&access_token=${resolved.token}`
    )
    const data = await res.json()
    if (data.error) return graphError(data)

    const entities: any[] = data.data || []
    return NextResponse.json({
      entities,
      count: entities.length,
      /** Meta caps the page; say so rather than implying the list is complete. */
      truncated: Boolean(data.paging?.next),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
