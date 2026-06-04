import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { pacingSnapshotFallback } from "@/lib/snapshot-fallback"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const GRAPH = "https://graph.facebook.com/v25.0"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const sp          = request.nextUrl.searchParams
    const adAccountId = sp.get("adAccountId") || ""
    if (!adAccountId) return NextResponse.json({ error: "adAccountId required" }, { status: 400 })

    const accountPath = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const token       = connection.access_token

    const [spendRes, prevRes, campRes] = await Promise.all([
      fetch(`${GRAPH}/${accountPath}/insights?fields=spend&date_preset=this_month&access_token=${token}`),
      fetch(`${GRAPH}/${accountPath}/insights?fields=spend&date_preset=last_month&access_token=${token}`),
      fetch(`${GRAPH}/${accountPath}/campaigns?fields=name,daily_budget,lifetime_budget,effective_status&effective_status=["ACTIVE"]&limit=100&access_token=${token}`),
    ])
    const [spendData, prevData, campData]: any[] = await Promise.all([
      spendRes.json(), prevRes.json(), campRes.json(),
    ])

    if (spendData.error) return NextResponse.json({ error: spendData.error.message }, { status: 400 })

    const thisMonthSpend = parseFloat(spendData.data?.[0]?.spend || "0")
    const lastMonthSpend = parseFloat(prevData.data?.[0]?.spend || "0")

    const campaigns = (campData.data || []).map((c: any) => ({
      id:             c.id,
      name:           c.name,
      // Facebook returns budgets in cents
      dailyBudget:    c.daily_budget    ? parseFloat(c.daily_budget)    / 100 : null,
      lifetimeBudget: c.lifetime_budget ? parseFloat(c.lifetime_budget) / 100 : null,
    }))

    const now          = new Date()
    const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const dayOfMonth   = now.getDate()
    const daysElapsed  = dayOfMonth
    const daysRemaining = daysInMonth - dayOfMonth

    const totalDailyBudget       = campaigns.reduce((s: number, c: any) => s + (c.dailyBudget || 0), 0)
    const projectedMonthlyBudget = totalDailyBudget * daysInMonth
    const avgDailySpend          = daysElapsed > 0 ? thisMonthSpend / daysElapsed : 0
    const projectedMonthSpend    = thisMonthSpend + avgDailySpend * daysRemaining
    const pacePercent            = projectedMonthlyBudget > 0
      ? (thisMonthSpend / projectedMonthlyBudget) * 100 : 0

    return NextResponse.json({
      thisMonthSpend,
      lastMonthSpend,
      totalDailyBudget,
      projectedMonthlyBudget,
      projectedMonthSpend,
      pacePercent,
      avgDailySpend,
      daysElapsed,
      daysInMonth,
      daysRemaining,
      campaigns,
    })
  } catch (err: any) {
    console.error("[insights/pacing]", err)
    try {
      const sp2 = request.nextUrl.searchParams
      const ctx2 = await getAuthContext()
      const adAccountId = sp2.get("adAccountId") || sp2.get("ad_account_id") || ""
      if (ctx2 && adAccountId) {
        const snapshot = await pacingSnapshotFallback(ctx2.orgId, adAccountId)
        if (snapshot) return NextResponse.json(snapshot)
      }
    } catch {}
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
