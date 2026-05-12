import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient as createServerClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const db = createAdminClient()

    // 1. Fetch all boards for the organization
    const { data: boards, error: boardsError } = await db
      .from("asset_boards")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })

    if (boardsError) {
      console.error("Error fetching boards:", boardsError)
      return NextResponse.json({ error: boardsError.message }, { status: 500 })
    }

    if (!boards || boards.length === 0) {
      return NextResponse.json({ boards: [] })
    }

    // 2. Fetch asset counts for these boards
    const boardIds = boards.map(b => b.id)
    const { data: boardAssets, error: countError } = await db
      .from("board_assets")
      .select("board_id")
      .in("board_id", boardIds)

    if (countError) {
      console.error("Error fetching board asset counts:", countError)
      // We don't necessarily want to fail the whole request just for counts
      // but let's log it and decide based on importance
    }

    const countsMap = new Map<string, number>()
    if (boardAssets) {
      boardAssets.forEach((row: any) => {
        countsMap.set(row.board_id, (countsMap.get(row.board_id) || 0) + 1)
      })
    }

    // 3. Map results
    const result = boards.map(board => ({
      ...board,
      asset_count: countsMap.get(board.id) || 0,
    }))

    return NextResponse.json({ boards: result })
  } catch (err) {
    console.error("Critical error in GET /api/assets/boards:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { name, description } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 })

    const db = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createAdminClient()
      : await createServerClient()
    const { data, error } = await db
      .from("asset_boards")
      .insert({ org_id: ctx.orgId, user_id: ctx.user.id, name: name.trim(), description: description || null })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ board: { ...data, asset_count: 0 } }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create board" },
      { status: 500 }
    )
  }
}
