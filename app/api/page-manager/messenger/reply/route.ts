import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const GRAPH = "https://graph.facebook.com/v25.0"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { page_id, conversation_id, customer_psid, message } = await request.json()
    const text = String(message || "").trim()
    if (!page_id) return NextResponse.json({ error: "page_id required" }, { status: 400 })
    if (!text) return NextResponse.json({ error: "message required" }, { status: 400 })

    const supabase = createAdminClient()

    const { data: page } = await supabase
      .from("pages")
      .select("fb_page_id, name, page_access_token")
      .eq("org_id", ctx.orgId)
      .eq("fb_page_id", page_id)
      .maybeSingle()

    if (!page?.page_access_token) {
      return NextResponse.json({ error: "Page token not found. Reconnect Facebook and select this Page again." }, { status: 400 })
    }

    let conversation: any = null
    if (conversation_id) {
      const { data } = await supabase
        .from("page_conversations")
        .select("*")
        .eq("org_id", ctx.orgId)
        .eq("page_id", page_id)
        .eq("id", conversation_id)
        .maybeSingle()
      conversation = data
    } else if (customer_psid) {
      const { data } = await supabase
        .from("page_conversations")
        .select("*")
        .eq("org_id", ctx.orgId)
        .eq("page_id", page_id)
        .eq("customer_psid", customer_psid)
        .maybeSingle()
      conversation = data
    }

    if (!conversation?.customer_psid) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    const metaRes = await fetch(`${GRAPH}/me/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: page.page_access_token,
        messaging_type: "RESPONSE",
        recipient: { id: conversation.customer_psid },
        message: { text },
      }),
    })
    const metaData = await metaRes.json().catch(() => ({}))
    if (!metaRes.ok || metaData.error) {
      return NextResponse.json({ error: metaData.error?.message || "Unable to send Messenger reply." }, { status: 400 })
    }

    const now = new Date().toISOString()
    const messageId = metaData.message_id
      ? String(metaData.message_id)
      : `out:${conversation.id}:${Date.now()}`

    await supabase.from("page_messages").insert({
      org_id: ctx.orgId,
      conversation_id: conversation.id,
      page_id,
      customer_psid: conversation.customer_psid,
      fb_message_id: messageId,
      direction: "outbound",
      message_type: "text",
      message: text,
      raw_event: { meta_response: metaData },
      fb_created_time: now,
    })

    await supabase
      .from("page_conversations")
      .update({
        status: "replied",
        unread_count: 0,
        last_message: text,
        last_message_at: now,
        last_outbound_at: now,
      })
      .eq("id", conversation.id)
      .eq("org_id", ctx.orgId)

    return NextResponse.json({ success: true, meta: metaData })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to send Messenger reply." }, { status: 500 })
  }
}
