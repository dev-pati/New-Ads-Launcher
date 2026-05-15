import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const db = createAdminClient()
    const { data, error } = await db
      .from("notifications")
      .select("id, type, title, body, link, actor_name, is_read, created_at")
      .eq("org_id", ctx.orgId)
      .eq("user_id", ctx.user.id)
      .order("created_at", { ascending: false })
      .limit(30)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ notifications: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id, markAll } = await request.json()
    const db = createAdminClient()

    if (markAll) {
      await db.from("notifications")
        .update({ is_read: true })
        .eq("org_id", ctx.orgId)
        .eq("user_id", ctx.user.id)
        .eq("is_read", false)
    } else if (id) {
      await db.from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("user_id", ctx.user.id)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
