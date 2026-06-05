import { NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createAdminClient()
    const { data: bms, error } = await supabase
      .from("business_managers")
      .select(`
        id, fb_business_id, name,
        pages (id, fb_page_id, name, category, picture_url, is_active),
        ad_accounts (id, fb_ad_account_id, fb_account_id, name, currency, account_status, is_active)
      `)
      .eq("org_id", ctx.orgId)
      .order("name")

    if (error) {
      console.error("Failed to fetch BMs:", error)
      return NextResponse.json({ error: "Failed to fetch business managers" }, { status: 500 })
    }

    return NextResponse.json({ businessManagers: bms || [] })
  } catch (err) {
    console.error("Failed to fetch business managers:", err)
    return NextResponse.json({ error: "Failed to fetch business managers" }, { status: 500 })
  }
}
