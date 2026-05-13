import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

type Params = { params: Promise<{ id: string }> }

// GET /api/inspo/boards/[id]/saves — list saved ads in a board
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: boardId } = await params
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("inspo_board_saves")
      .select("id, ad_id, ad_data, created_at")
      .eq("board_id", boardId)
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ saves: data || [] })
  } catch (err: any) {
    console.error("[inspo/boards/saves] GET", err)
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}

// POST /api/inspo/boards/[id]/saves — save an ad to the board
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: boardId } = await params
    const { ad } = await request.json()
    if (!ad?.id) return NextResponse.json({ error: "ad required" }, { status: 400 })

    const supabase = createAdminClient()

    // Verify board belongs to this org
    const { data: board } = await supabase
      .from("inspo_boards")
      .select("id")
      .eq("id", boardId)
      .eq("org_id", ctx.orgId)
      .single()

    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 })

    const { data, error } = await supabase
      .from("inspo_board_saves")
      .upsert(
        { board_id: boardId, org_id: ctx.orgId, ad_id: ad.id, ad_data: ad },
        { onConflict: "board_id,ad_id" }
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ save: data })
  } catch (err: any) {
    console.error("[inspo/boards/saves] POST", err)
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}

// DELETE /api/inspo/boards/[id]/saves?ad_id=xxx — unsave an ad
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: boardId } = await params
    const adId = request.nextUrl.searchParams.get("ad_id")
    if (!adId) return NextResponse.json({ error: "ad_id required" }, { status: 400 })

    const supabase = createAdminClient()

    await supabase
      .from("inspo_board_saves")
      .delete()
      .eq("board_id", boardId)
      .eq("ad_id", adId)
      .eq("org_id", ctx.orgId)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[inspo/boards/saves] DELETE", err)
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}
