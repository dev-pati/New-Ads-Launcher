import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

function normalizeAdAccountId(id?: string | null) {
  return (id || "").replace(/^act_/, "")
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const accountId = normalizeAdAccountId(request.nextUrl.searchParams.get("account_id"))
    const limitParam = Number(request.nextUrl.searchParams.get("limit") || 100)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 100

    const supabase = createAdminClient()
    let query = supabase
      .from("ad_account_metrics_snapshots")
      .select(`
        id,
        fb_ad_account_id,
        fb_account_id,
        name,
        account_status,
        currency,
        spend_cap_minor,
        remaining_minor,
        amount_spent_minor,
        ownership,
        owner_business_name,
        synced_at
      `)
      .eq("org_id", ctx.orgId)
      .order("synced_at", { ascending: false })
      .limit(limit)

    if (accountId) {
      query = query.or(
        `fb_account_id.eq.${accountId},fb_account_id.eq.act_${accountId},fb_ad_account_id.eq.${accountId},fb_ad_account_id.eq.act_${accountId}`
      )
    }

    const { data, error } = await query

    if (error) {
      console.error("Failed to fetch ad account metric snapshots:", error)
      return NextResponse.json({ snapshots: [], warning: error.message })
    }

    const snapshots = data || []

    return NextResponse.json({ snapshots })
  } catch (err) {
    console.error("Failed to fetch ad account metrics:", err)
    return NextResponse.json({ snapshots: [], warning: "Failed to fetch ad account metrics" })
  }
}
