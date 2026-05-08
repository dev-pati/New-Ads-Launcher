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

    const db = createAdminClient()
    const rows = creative_ids.map((cid: string) => ({ board_id: boardId, creative_id: cid }))

    const { error } = await db.from("board_assets").upsert(rows, { onConflict: "board_id,creative_id" })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
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

    const db = createAdminClient()
    const { error } = await db
      .from("board_assets")
      .delete()
      .eq("board_id", boardId)
      .eq("creative_id", creativeId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
