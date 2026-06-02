import { NextRequest, NextResponse } from "next/server"
import { getAuthContext }          from "@/lib/auth"
import { createAdminClient }       from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const db = createAdminClient()

    const { data: executions, error } = await db
      .from("automation_executions")
      .select("id, status, entities_affected, api_calls, action_taken, executed_at, details")
      .eq("automation_id", id)
      .eq("org_id", ctx.orgId)
      .order("executed_at", { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ executions: executions ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
