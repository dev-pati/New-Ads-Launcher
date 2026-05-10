import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

export const dynamic = "force-dynamic"

const GRAPH = "https://graph.facebook.com/v25.0"

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

    // First get all rules, then get history for each
    const rulesRes = await fetch(
      `${GRAPH}/${accountPath}/automation_rules?fields=id,name,status&limit=50&access_token=${token}`
    )
    const rulesData = await rulesRes.json()
    if (rulesData.error) return NextResponse.json({ error: rulesData.error.message }, { status: 400 })

    const rules: any[] = rulesData.data || []

    // Batch fetch history for all rules
    const historyEntries: any[] = []
    await Promise.all(
      rules.slice(0, 10).map(async (rule) => {
        try {
          const hRes = await fetch(
            `${GRAPH}/${rule.id}/history?fields=id,results,is_applicable,timestamp_start,timestamp_stop,error_code,num_entity_affected,num_api_call&limit=20&access_token=${token}`
          )
          const hData = await hRes.json()
          if (hData.data) {
            hData.data.forEach((h: any) => {
              historyEntries.push({
                ...h,
                rule_id: rule.id,
                rule_name: rule.name,
                rule_status: rule.status,
              })
            })
          }
        } catch {}
      })
    )

    // Sort by timestamp descending
    historyEntries.sort((a, b) =>
      new Date(b.timestamp_stop || 0).getTime() - new Date(a.timestamp_stop || 0).getTime()
    )

    return NextResponse.json({ history: historyEntries, rules })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
