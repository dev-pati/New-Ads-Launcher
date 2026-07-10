import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getConnectionForAdAccount, MissingViaError } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

// Trả token cho browser upload video TRỰC TIẾP lên Meta (tránh proxy file lớn qua server).
// Via MECE: upload media = WRITE → resolve theo slot launch của đúng ad account (VIA-MASTER.md).
// Token trả về giới hạn: đúng connection WRITE của account được yêu cầu, không phải token org tùy ý.
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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

    let connection
    try {
      connection = await getConnectionForAdAccount(ctx.orgId, adAccountIdToUse, "write")
    } catch (err) {
      if (err instanceof MissingViaError) {
        return NextResponse.json({ error: err.message, code: "MISSING_LAUNCH_VIA" }, { status: 400 })
      }
      throw err
    }
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    return NextResponse.json({
      accessToken: connection.access_token,
      adAccountId: adAccountIdToUse,
    })
  } catch {
    return NextResponse.json({ error: "Failed to get credentials" }, { status: 500 })
  }
}
