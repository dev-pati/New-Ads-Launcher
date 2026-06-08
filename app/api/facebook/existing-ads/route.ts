import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getExistingAds } from "@/lib/facebook"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedFacebookMetadata } from "../_cache"

const EXISTING_ADS_TTL_MS = 5 * 60 * 1000 // 5 min cache

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp = request.nextUrl.searchParams
    const adAccountId    = sp.get("ad_account_id")
    const datePreset     = sp.get("date_preset") || "last_30d"
    const limit          = Math.min(parseInt(sp.get("limit") || "50", 10), 200)
    const after          = sp.get("after") || undefined
    const activeOnly     = sp.get("active_only") === "1"
    const activeAdSetOnly = sp.get("active_adset_only") === "1"

    if (!adAccountId) return NextResponse.json({ error: "ad_account_id required" }, { status: 400 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    // Security: verify ad account belongs to this org
    const norm = (id: string) => id.startsWith("act_") ? id.slice(4) : id
    const supabase = createAdminClient()
    const { data: orgAccounts } = await supabase
      .from("ad_accounts")
      .select("fb_ad_account_id")
      .eq("org_id", ctx.orgId)
    const allowedNorm = (orgAccounts || []).map((a: any) => norm(a.fb_ad_account_id))
    if (!allowedNorm.includes(norm(adAccountId))) {
      console.warn(`[existing-ads] ad_account ${adAccountId} not in org ${ctx.orgId}`)
      return NextResponse.json({ error: `Ad account ${adAccountId} not in your workspace` }, { status: 403 })
    }

    const cacheKey = `fb:existing-ads:${ctx.orgId}:${adAccountId}:${datePreset}:${limit}:${after || ""}:${activeOnly}:${activeAdSetOnly}`

    const result = await getCachedFacebookMetadata(
      cacheKey,
      EXISTING_ADS_TTL_MS,
      () => {
        console.log(`[existing-ads] Fetching org=${ctx.orgId} account=${adAccountId} preset=${datePreset}`)
        return getExistingAds(adAccountId, connection.access_token, {
          datePreset, limit, after, activeOnly, activeAdSetOnly,
        })
      }
    )

    return NextResponse.json({ ...result, requestedAccount: adAccountId })
  } catch (err: any) {
    console.error("[existing-ads] error:", err)
    return NextResponse.json({ error: err.message || "Failed to fetch existing ads" }, { status: 500 })
  }
}
