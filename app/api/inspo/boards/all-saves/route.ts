import { NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/inspo/boards/all-saves — load all board saves for the org
// Used on page load to build savedMap (adId → boardIds)
export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("inspo_board_saves")
      .select("board_id, ad_id")
      .eq("org_id", ctx.orgId)

    if (error) throw error

    return NextResponse.json({ saves: data || [] })
  } catch (err: any) {
    console.error("[inspo/boards/all-saves] GET", err)
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}
