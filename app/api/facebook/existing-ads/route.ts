import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getExistingAds } from "@/lib/facebook"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp = request.nextUrl.searchParams
    const adAccountId = sp.get("ad_account_id")
    const datePreset = sp.get("date_preset") || "last_30d"
    const limit = parseInt(sp.get("limit") || "50", 10)
    const after = sp.get("after") || undefined
    const activeOnly = sp.get("active_only") === "1"
    const activeAdSetOnly = sp.get("active_adset_only") === "1"

    if (!adAccountId) return NextResponse.json({ error: "ad_account_id required" }, { status: 400 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    // Verify ad account belongs to this org (security check) — normalize id format
    const norm = (id: string) => id.startsWith("act_") ? id.slice(4) : id
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()
    const { data: orgAccounts } = await supabase
      .from("ad_accounts")
      .select("fb_ad_account_id")
      .eq("org_id", ctx.orgId)
    const allowedNorm = (orgAccounts || []).map((a: any) => norm(a.fb_ad_account_id))
    if (!allowedNorm.includes(norm(adAccountId))) {
      console.warn(`[existing-ads] ad_account ${adAccountId} not in org ${ctx.orgId} allowed:`, allowedNorm)
      return NextResponse.json({ error: `Ad account ${adAccountId} not in your workspace` }, { status: 403 })
    }

    console.log(`[existing-ads] Fetching for org=${ctx.orgId} ad_account=${adAccountId} preset=${datePreset} active_only=${activeOnly} active_adset_only=${activeAdSetOnly}`)
    const result = await getExistingAds(adAccountId, connection.access_token, {
      datePreset, limit, after, activeOnly, activeAdSetOnly,
    })
    console.log(`[existing-ads] Returned ${result.ads.length} ads, hasMore=${!!result.paging?.after}`)
    return NextResponse.json({ ...result, requestedAccount: adAccountId })
  } catch (err: any) {
    console.error("[existing-ads] error:", err)
    return NextResponse.json({ error: err.message || "Failed to fetch existing ads" }, { status: 500 })
  }
}
