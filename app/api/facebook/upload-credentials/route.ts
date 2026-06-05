import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const url = new URL(request.url)
    const queryAdAccountId = url.searchParams.get("adAccountId")

    let adAccountIdToUse = queryAdAccountId

    if (!adAccountIdToUse) {
      const supabase = createAdminClient()
      const { data: adAccounts } = await supabase
        .from("ad_accounts")
        .select("fb_ad_account_id")
        .eq("org_id", ctx.orgId)
        .limit(1)

      if (!adAccounts || adAccounts.length === 0) {
        return NextResponse.json({ error: "No ad account found" }, { status: 400 })
      }
      adAccountIdToUse = adAccounts[0].fb_ad_account_id
    }

    return NextResponse.json({
      accessToken: connection.access_token,
      adAccountId: adAccountIdToUse,
    })
  } catch (err) {
    return NextResponse.json({ error: "Failed to get credentials" }, { status: 500 })
  }
}
