import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp = request.nextUrl.searchParams
    const search = sp.get("search") || ""
    const limit = Math.min(parseInt(sp.get("limit") || "50"), 100)

    const supabase = await createClient()
    let q = supabase
      .from("automation_executions")
      .select("*, automations(name)")
      .eq("org_id", ctx.orgId)
      .order("executed_at", { ascending: false })
      .limit(limit)

    if (search) q = q.ilike("automation_name", `%${search}%`)

    const { data, error } = await q
    if (error) throw error

    return NextResponse.json({ history: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
