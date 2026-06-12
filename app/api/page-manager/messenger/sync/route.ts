import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { resolveOrgPageAccessToken } from "@/lib/facebook-page-token"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const GRAPH = "https://graph.facebook.com/v25.0"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { page_id } = await request.json()
    if (!page_id) return NextResponse.json({ error: "page_id required" }, { status: 400 })

    // Skip sync for demo page IDs
    if (/^p-\d+$/.test(page_id)) {
      return NextResponse.json({ success: true, count: 0 })
    }

    const supabase = createAdminClient()
    const pageToken = await resolveOrgPageAccessToken(supabase, ctx.orgId, ctx.user.id, page_id)
    if (!pageToken?.token) {
      return NextResponse.json({
        error: "Page token not found. Please reconnect Facebook and select this Page again.",
      }, { status: 400 })
    }

    // 1. Fetch conversations from Facebook API
    const convUrl = `${GRAPH}/${page_id}/conversations?fields=id,updated_time,unread_count,participants&limit=15&access_token=${pageToken.token}`
    const convRes = await fetch(convUrl)
    const convData = await convRes.json()

    if (convData.error) {
      return NextResponse.json({
        error: convData.error.message,
        code: convData.error.code,
        subcode: convData.error.error_subcode,
      }, { status: 400 })
    }

    const fbConversations = convData.data || []
    let importedCount = 0

    for (const thread of fbConversations) {
      const participants = thread.participants?.data || []
      const customer = participants.find((p: any) => p.id !== page_id) || participants[0] || {}
      const customerPsid = customer.id
      const customerName = customer.name || "Messenger User"

      if (!customerPsid) continue

      // 2. Fetch recent messages for this conversation thread
      const msgUrl = `${GRAPH}/${thread.id}/messages?fields=id,message,created_time,from,to,attachments&limit=25&access_token=${pageToken.token}`
      const msgRes = await fetch(msgUrl)
      const msgData = await msgRes.json()

      const fbMessages = msgData.data || []
      if (!fbMessages.length) continue

      // Sort chronological ascending
      fbMessages.sort((a: any, b: any) => new Date(a.created_time).getTime() - new Date(b.created_time).getTime())

      // Determine last message details
      const lastMsg = fbMessages[fbMessages.length - 1]
      const lastText = lastMsg.message || (lastMsg.attachments?.data?.length ? "[Attachment]" : "")
      const lastTime = new Date(lastMsg.created_time).toISOString()

      // Calculate last inbound/outbound times
      let lastInboundAt: string | undefined
      let lastOutboundAt: string | undefined

      for (let i = fbMessages.length - 1; i >= 0; i--) {
        const m = fbMessages[i]
        const isFromPage = m.from?.id === page_id
        if (isFromPage && !lastOutboundAt) {
          lastOutboundAt = new Date(m.created_time).toISOString()
        }
        if (!isFromPage && !lastInboundAt) {
          lastInboundAt = new Date(m.created_time).toISOString()
        }
        if (lastInboundAt && lastOutboundAt) break
      }

      const lastMsgIsFromPage = lastMsg.from?.id === page_id
      const status = lastMsgIsFromPage ? "replied" : "pending"

      // Upsert conversation
      const { data: conversation, error: convError } = await supabase
        .from("page_conversations")
        .upsert(
          {
            org_id: ctx.orgId,
            page_id,
            page_name: pageToken.pageName || page_id,
            customer_psid: customerPsid,
            customer_name: customerName,
            status,
            unread_count: thread.unread_count || 0,
            last_message: lastText.slice(0, 500),
            last_message_at: lastTime,
            last_inbound_at: lastInboundAt,
            last_outbound_at: lastOutboundAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "org_id,page_id,customer_psid" }
        )
        .select("id")
        .maybeSingle()

      if (convError || !conversation) {
        console.error("[messenger/sync] failed to upsert conversation:", convError)
        continue
      }

      // Upsert messages in batch
      const messagesToInsert = fbMessages.map((m: any) => {
        const direction = m.from?.id === page_id ? "outbound" : "inbound"
        let msgType = "text"
        if (m.attachments?.data?.length) msgType = "attachment"

        return {
          org_id: ctx.orgId,
          conversation_id: conversation.id,
          page_id,
          customer_psid: customerPsid,
          fb_message_id: m.id,
          direction,
          message_type: msgType,
          message: m.message || "",
          attachments: m.attachments?.data || [],
          raw_event: m,
          fb_created_time: new Date(m.created_time).toISOString(),
        }
      })

      if (messagesToInsert.length) {
        const { error: msgInsertError } = await supabase
          .from("page_messages")
          .upsert(messagesToInsert, { onConflict: "org_id,fb_message_id", ignoreDuplicates: true })

        if (msgInsertError) {
          console.error("[messenger/sync] failed to insert messages:", msgInsertError)
        }
      }

      importedCount++
    }

    return NextResponse.json({ success: true, count: importedCount })
  } catch (err: any) {
    console.error("[messenger/sync] error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
