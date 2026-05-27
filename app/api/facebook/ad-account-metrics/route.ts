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

    const params = request.nextUrl.searchParams
    const accountId = normalizeAdAccountId(params.get("account_id"))
    const dateFrom = params.get("date_from")
    const dateTo = params.get("date_to")
    const limitParam = Number(params.get("limit") || 100)
    // When fetching all accounts for a date range we pull more rows to allow JS dedup
    const isAllAccounts = !accountId && (dateFrom || dateTo)
    const limit = isAllAccounts ? 3000 : (Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 100)

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
        timezone_name,
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

    if (dateFrom) {
      query = query.gte("synced_at", dateFrom)
    }
    if (dateTo) {
      query = query.lte("synced_at", dateTo + "T23:59:59.999Z")
    }

    const { data, error } = await query

    if (error) {
      console.error("Failed to fetch ad account metric snapshots:", error)
      return NextResponse.json({ snapshots: [], warning: error.message })
    }

    let snapshots = data || []

    // When querying all accounts with a date range, keep only the latest snapshot per account
    if (isAllAccounts) {
      const seen = new Set<string>()
      snapshots = snapshots.filter(s => {
        const key = normalizeAdAccountId(s.fb_ad_account_id)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }

    return NextResponse.json({ snapshots })
  } catch (err) {
    console.error("Failed to fetch ad account metrics:", err)
    return NextResponse.json({ snapshots: [], warning: "Failed to fetch ad account metrics" })
  }
}
