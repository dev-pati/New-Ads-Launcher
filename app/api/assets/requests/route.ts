import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const db = createAdminClient()
    const { data, error } = await db
      .from("creative_requests")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ requests: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { title, description, due_date } = await request.json()
    if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 })

    const db = createAdminClient()
    const { data, error } = await db
      .from("creative_requests")
      .insert({
        org_id: ctx.orgId,
        created_by: ctx.user.id,
        title: title.trim(),
        description: description || null,
        due_date: due_date || null,
        status: "open",
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ request: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
