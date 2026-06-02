import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { metaFetch } from "@/app/api/facebook/_meta-fetch"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const GRAPH = "https://graph.facebook.com/v25.0"

// GET /api/meta/campaigns?ad_account_id=act_xxx&limit=50&search=name
// Returns campaigns for the given ad account (or first connected account)
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const conn = await getFacebookConnection(ctx.orgId)
    if (!conn?.access_token) {
      return NextResponse.json({ error: "Meta not connected" }, { status: 401 })
    }

    const sp           = request.nextUrl.searchParams
    let   adAccountId  = sp.get("ad_account_id") ?? ""
    const limit        = Math.min(parseInt(sp.get("limit") ?? "50"), 100)
    const search       = sp.get("search") ?? ""

    // If no ad_account_id supplied, pick the first one from the org's ad accounts
    if (!adAccountId) {
      const db = createAdminClient()
      const { data: accts } = await db
        .from("ad_accounts")
        .select("account_id")
        .eq("org_id", ctx.orgId)
        .limit(1)
        .single()
      if (accts?.account_id) adAccountId = `act_${accts.account_id.replace(/^act_/, "")}`
    }

    if (!adAccountId) {
      return NextResponse.json({ campaigns: [], total: 0 })
    }

    // Normalize account ID
    const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`

    const fields = [
      "id",
      "name",
      "status",
      "effective_status",
      "objective",
    ].join(",")

    const params = new URLSearchParams({
      fields,
      limit: String(limit),
      access_token: conn.access_token,
    })

    const url = `${GRAPH}/${actId}/campaigns?${params}`
    const data = await metaFetch(url, { caller: "meta/campaigns" })

    let campaigns = (data?.data ?? []).map((c: any) => ({
      id:          c.id,
      name:        c.name,
      status:      c.effective_status ?? c.status,
      objective:   c.objective ?? null,
      ads_count:   null,
      spend:       null,
    }))

    // Apply client-side search filter
    if (search) {
      const q = search.toLowerCase()
      campaigns = campaigns.filter((c: any) => c.name?.toLowerCase().includes(q))
    }

    return NextResponse.json({
      campaigns,
      total: data?.paging?.cursors ? campaigns.length : campaigns.length,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
