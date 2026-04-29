import { NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const supabase = await createClient()
    const { data: adAccounts } = await supabase
      .from("ad_accounts")
      .select("fb_ad_account_id")
      .eq("org_id", ctx.orgId)
      .limit(1)

    if (!adAccounts || adAccounts.length === 0) {
      return NextResponse.json({ error: "No ad account found" }, { status: 400 })
    }

    return NextResponse.json({
      accessToken: connection.access_token,
      adAccountId: adAccounts[0].fb_ad_account_id,
    })
  } catch (err) {
    return NextResponse.json({ error: "Failed to get credentials" }, { status: 500 })
  }
}
