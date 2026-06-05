import { NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("pages")
      .select("id, fb_page_id, name, picture_url, is_active")
      .eq("org_id", ctx.orgId)
      .eq("is_active", true)
      .order("name")

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ pages: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
