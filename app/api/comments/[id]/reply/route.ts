import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { resolveOrgPageAccessToken } from "@/lib/facebook-page-token"
import { normalizeMetaError } from "@/lib/meta-error"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
const GRAPH = "https://graph.facebook.com/v25.0"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const { message, page_id } = await request.json()
    if (!message?.trim()) return NextResponse.json({ error: "message required" }, { status: 400 })

    const supabase = createAdminClient()

    const { data: comment } = await supabase
      .from("comments")
      .select("fb_comment_id")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .single()

    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 })

    const pageToken = await resolveOrgPageAccessToken(supabase, ctx.orgId, ctx.user.id, page_id)
    if (!pageToken?.token) return NextResponse.json({ error: "Page token not found. Please reconnect Facebook and select this Page again." }, { status: 400 })

    const res = await fetch(`${GRAPH}/${comment.fb_comment_id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, access_token: pageToken.token }),
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      return NextResponse.json(
        normalizeMetaError(data, "Unable to reply to comment.", { pageId: page_id, permission: "pages_manage_engagement" }),
        { status: 400 }
      )
    }

    await supabase.from("comments").update({ is_replied: true, draft_reply: message }).eq("id", id)

    return NextResponse.json({ success: true, reply_id: data.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
