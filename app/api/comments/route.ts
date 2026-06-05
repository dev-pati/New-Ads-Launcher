import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp        = request.nextUrl.searchParams
    const pageId    = sp.get("page_id") || ""
    const sentiment = sp.get("sentiment") || ""
    const unreplied = sp.get("unreplied") === "1"
    const search    = sp.get("search") || ""
    const limit     = parseInt(sp.get("limit") || "200")

    const supabase = createAdminClient()
    let query = supabase
      .from("comments")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("fb_created_time", { ascending: false })
      .limit(limit)

    if (pageId)    query = query.eq("page_id", pageId)
    if (sentiment) query = query.eq("sentiment", sentiment)
    if (unreplied) query = query.eq("is_replied", false)
    if (search)    query = query.ilike("message", `%${search}%`)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ comments: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
