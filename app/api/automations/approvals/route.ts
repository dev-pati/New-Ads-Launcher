import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp = request.nextUrl.searchParams
    const status = sp.get("status") || "pending"

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("automation_approvals")
      .select("*, automations(name, trigger_type)")
      .eq("org_id", ctx.orgId)
      .eq("status", status)
      .order("created_at", { ascending: false })

    if (error) {
      if (error.code === "42P01") return NextResponse.json({ approvals: [] })
      throw error
    }
    return NextResponse.json({ approvals: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id, action } = await request.json()
    if (!id || !["approved", "rejected"].includes(action)) {
      return NextResponse.json({ error: "id and action (approved|rejected) required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("automation_approvals")
      .update({ status: action, reviewed_by: ctx.user.id, reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ approval: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
