import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
const GRAPH = "https://graph.facebook.com/v25.0"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const { message, page_id } = await request.json()
    if (!message?.trim()) return NextResponse.json({ error: "message required" }, { status: 400 })

    const supabase = await createClient()

    const { data: comment } = await supabase
      .from("comments")
      .select("fb_comment_id")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .single()

    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 })

    // Get page access token
    const { data: page } = await supabase
      .from("pages")
      .select("page_access_token")
      .eq("org_id", ctx.orgId)
      .eq("fb_page_id", page_id)
      .single()

    if (!page?.page_access_token) return NextResponse.json({ error: "Page token not found" }, { status: 400 })

    const res = await fetch(`${GRAPH}/${comment.fb_comment_id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, access_token: page.page_access_token }),
    })
    const data = await res.json()
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 })

    await supabase.from("comments").update({ is_replied: true, draft_reply: message }).eq("id", id)

    return NextResponse.json({ success: true, reply_id: data.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
