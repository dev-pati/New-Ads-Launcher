import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
const GRAPH = "https://graph.facebook.com/v25.0"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const { is_hidden, page_id } = await request.json()
    const supabase = createAdminClient()

    const { data: comment } = await supabase
      .from("comments")
      .select("fb_comment_id")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .single()

    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 })

    const { data: page } = await supabase
      .from("pages")
      .select("page_access_token")
      .eq("org_id", ctx.orgId)
      .eq("fb_page_id", page_id)
      .single()

    if (!page?.page_access_token) return NextResponse.json({ error: "Page token not found" }, { status: 400 })

    const res = await fetch(
      `${GRAPH}/${comment.fb_comment_id}?is_hidden=${is_hidden}&access_token=${page.page_access_token}`,
      { method: "POST" }
    )
    const data = await res.json()
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 })

    await supabase.from("comments").update({ is_hidden }).eq("id", id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
