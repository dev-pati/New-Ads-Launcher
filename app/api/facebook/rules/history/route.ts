import { NextRequest, NextResponse } from "next/server"
import { GRAPH, graphError, isErrorResponse, resolveRuleRequest } from "../_shared"

export const dynamic = "force-dynamic"

const HISTORY_FIELDS = [
  "id",
  "results",
  "is_manual",
  "timestamp",
  "evaluation_spec",
  "execution_spec",
].join(",")

interface HistoryEntry {
  id?: string
  rule_id: string
  rule_name: string
  timestamp?: string
  is_manual?: boolean
  /** entities this run actually changed */
  entities: { id: string; name?: string; type?: string }[]
}

/**
 * GET /api/facebook/rules/history?adAccountId=...[&ruleId=...][&entityId=...]
 *
 * Serves two different questions from the same edge:
 *   - "what has this rule done?"      → ruleId
 *   - "who turned my ad off?"         → entityId  (workflow W3; Meta cannot answer this,
 *                                       its history is only searchable by rule)
 *
 * `summary` is what the list needs for the "Rule results" and "When rule runs" columns:
 * executions are runs that changed something, which is not the same as evaluations. A
 * continuous rule evaluates ~48x/day and may execute never — showing evaluations there
 * would make every healthy rule look like it is destroying the account.
 */
export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveRuleRequest(request, "read")
    if (isErrorResponse(resolved)) return resolved
    const { token, accountPath } = resolved

    const sp = request.nextUrl.searchParams
    const ruleIdFilter = sp.get("ruleId")
    const entityIdFilter = sp.get("entityId")

    const rulesRes = await fetch(
      `${GRAPH}/${accountPath}/adrules_library?fields=id,name,status&limit=100&access_token=${token}`
    )
    const rulesData = await rulesRes.json()
    if (rulesData.error) return graphError(rulesData)

    let rules: any[] = rulesData.data || []
    if (ruleIdFilter) rules = rules.filter(r => String(r.id) === ruleIdFilter)

    const entries: HistoryEntry[] = []
    const summary: Record<string, { executions: number; lastRun: string | null; entitiesAffected: number }> = {}

    await Promise.all(
      rules.map(async rule => {
        summary[rule.id] = { executions: 0, lastRun: null, entitiesAffected: 0 }
        try {
          const res = await fetch(
            `${GRAPH}/${rule.id}/history?fields=${HISTORY_FIELDS}&limit=50&access_token=${token}`
          )
          const data = await res.json()
          // A single rule failing (deleted, permission) must not empty the whole page.
          if (!data?.data) return

          for (const h of data.data as any[]) {
            const entities = (h.results || [])
              .filter((r: any) => r?.object_id)
              .map((r: any) => ({
                id: String(r.object_id),
                name: r.object_name,
                type: r.object_type,
              }))

            if (!entities.length) continue // an evaluation that changed nothing
            summary[rule.id].executions += 1
            summary[rule.id].entitiesAffected += entities.length
            if (!summary[rule.id].lastRun) summary[rule.id].lastRun = h.timestamp ?? null

            entries.push({
              id: h.id,
              rule_id: String(rule.id),
              rule_name: rule.name,
              timestamp: h.timestamp,
              is_manual: h.is_manual,
              entities,
            })
          }
        } catch {
          // leave this rule's summary at zero rather than failing the request
        }
      })
    )

    const filtered = entityIdFilter
      ? entries.filter(e => e.entities.some(x => x.id === entityIdFilter))
      : entries

    filtered.sort(
      (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    )

    return NextResponse.json({ history: filtered, summary, rules })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
