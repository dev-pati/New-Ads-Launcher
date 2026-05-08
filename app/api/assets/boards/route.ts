import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const db = createAdminClient()
    const { data: boards, error } = await db
      .from("asset_boards")
      .select("*, board_assets(count)")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const result = (boards || []).map((b: any) => ({
      ...b,
      asset_count: b.board_assets?.[0]?.count ?? 0,
      board_assets: undefined,
    }))

    return NextResponse.json({ boards: result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { name, description } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 })

    const db = createAdminClient()
    const { data, error } = await db
      .from("asset_boards")
      .insert({ org_id: ctx.orgId, user_id: ctx.user.id, name: name.trim(), description: description || null })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ board: { ...data, asset_count: 0 } }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
