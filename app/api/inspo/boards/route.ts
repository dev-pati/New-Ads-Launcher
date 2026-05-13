import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/inspo/boards — list boards for the org
export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createAdminClient()

    const { data: boards, error } = await supabase
      .from("inspo_boards")
      .select("id, name, created_at, user_id")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: true })

    if (error) throw error

    // Attach ad counts
    const boardIds = (boards || []).map((b: any) => b.id)
    const { data: counts } = boardIds.length
      ? await supabase
          .from("inspo_board_saves")
          .select("board_id")
          .in("board_id", boardIds)
      : { data: [] }

    const countMap: Record<string, number> = {}
    for (const row of counts || []) {
      countMap[row.board_id] = (countMap[row.board_id] || 0) + 1
    }

    const result = (boards || []).map((b: any) => ({
      ...b,
      ad_count: countMap[b.id] || 0,
    }))

    return NextResponse.json({ boards: result })
  } catch (err: any) {
    console.error("[inspo/boards] GET", err)
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}

// POST /api/inspo/boards — create a new board
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { name } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 })

    const supabase = createAdminClient()

    const { data: board, error } = await supabase
      .from("inspo_boards")
      .insert({ org_id: ctx.orgId, user_id: ctx.user.id, name: name.trim() })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ board: { ...board, ad_count: 0 } })
  } catch (err: any) {
    console.error("[inspo/boards] POST", err)
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}
