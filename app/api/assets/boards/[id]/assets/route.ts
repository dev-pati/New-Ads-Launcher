import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: boardId } = await params
    const { creative_ids } = await request.json()

    if (!Array.isArray(creative_ids) || creative_ids.length === 0) {
      return NextResponse.json({ error: "creative_ids required" }, { status: 400 })
    }

    const db = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createAdminClient()
      : await createAdminClient()

    const { data: board, error: boardError } = await db
      .from("asset_boards")
      .select("id")
      .eq("id", boardId)
      .eq("org_id", ctx.orgId)
      .single()

    if (boardError || !board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 })
    }

    const { data: creatives, error: creativesError } = await db
      .from("creatives")
      .select("id")
      .eq("org_id", ctx.orgId)
      .in("id", creative_ids)

    if (creativesError) return NextResponse.json({ error: creativesError.message }, { status: 500 })

    const validCreativeIds = new Set((creatives || []).map((creative: { id: string }) => creative.id))
    if (validCreativeIds.size !== creative_ids.length) {
      return NextResponse.json({ error: "Some selected assets were not found in this workspace" }, { status: 400 })
    }

    const rows = creative_ids.map((cid: string) => ({ board_id: boardId, creative_id: cid }))

    const { error } = await db.from("board_assets").upsert(rows, { onConflict: "board_id,creative_id" })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, added: rows.length })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add assets to board" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: boardId } = await params
    const { searchParams } = new URL(request.url)
    const creativeId = searchParams.get("creative_id")
    if (!creativeId) return NextResponse.json({ error: "creative_id required" }, { status: 400 })

    const db = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createAdminClient()
      : await createAdminClient()

    const { data: board, error: boardError } = await db
      .from("asset_boards")
      .select("id")
      .eq("id", boardId)
      .eq("org_id", ctx.orgId)
      .single()

    if (boardError || !board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 })
    }

    const { error } = await db
      .from("board_assets")
      .delete()
      .eq("board_id", boardId)
      .eq("creative_id", creativeId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to remove asset from board" },
      { status: 500 }
    )
  }
}
