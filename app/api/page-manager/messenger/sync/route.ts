import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { getMessengerUserPicture, getMessengerUserProfile } from "@/lib/facebook"
import { resolveOrgPageAccessToken } from "@/lib/facebook-page-token"
import { normalizeMetaError } from "@/lib/meta-error"
import { insertMessengerMessages } from "@/lib/messenger-storage"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const GRAPH = "https://graph.facebook.com/v25.0"
const CONVERSATION_SYNC_LIMIT = 50
const MESSAGE_PAGE_LIMIT = 100
const MAX_MESSAGES_PER_CONVERSATION = 500

async function fetchConversationMessages(conversationId: string, pageToken: string) {
  const messages: any[] = []
  const fields = "id,message,created_time,from,to,attachments{type,payload,mime_type,name,file_url,image_data,video_data}"
  let url = `${GRAPH}/${conversationId}/messages?fields=${encodeURIComponent(fields)}&limit=${MESSAGE_PAGE_LIMIT}&access_token=${encodeURIComponent(pageToken)}`

  while (url && messages.length < MAX_MESSAGES_PER_CONVERSATION) {
    const res = await fetch(url)
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.error) {
      throw data
    }

    if (Array.isArray(data.data)) messages.push(...data.data)

    const next = data.paging?.next
    url = typeof next === "string" && next ? next : ""
  }

  return messages.slice(0, MAX_MESSAGES_PER_CONVERSATION)
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { page_id, full_history } = await request.json()
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
    const conversationLimit = full_history ? CONVERSATION_SYNC_LIMIT : 15
    const convUrl = `${GRAPH}/${page_id}/conversations?fields=id,updated_time,unread_count,participants&limit=${conversationLimit}&access_token=${pageToken.token}`
    const convRes = await fetch(convUrl)
    const convData = await convRes.json()

    if (!convRes.ok || convData.error) {
      return NextResponse.json(
        normalizeMetaError(convData, "Unable to sync Messenger.", { pageId: page_id, permission: "pages_messaging" }),
        { status: 400 }
      )
    }

    const fbConversations = convData.data || []
    let importedCount = 0

    for (const thread of fbConversations) {
      const participants = thread.participants?.data || []
      const customer = participants.find((p: any) => p.id !== page_id) || participants[0] || {}
      const customerPsid = customer.id

      if (!customerPsid) continue

      const customerProfile = await getMessengerUserProfile(customerPsid, pageToken.token)
      const customerProfilePic = customerProfile?.profile_pic
        || await getMessengerUserPicture(customerPsid, pageToken.token)
      const profileName = [customerProfile?.first_name, customerProfile?.last_name].filter(Boolean).join(" ")
      const participantName = typeof customer.name === "string" && customer.name.trim() ? customer.name.trim() : ""
      const customerName = profileName
        || participantName
        || "Messenger User"

      // 2. Fetch message history for this conversation thread.
      let fbMessages: any[] = []
      try {
        fbMessages = await fetchConversationMessages(thread.id, pageToken.token)
      } catch (msgData: any) {
        console.error("[messenger/sync] failed to fetch conversation messages:", msgData?.error || msgData)
        continue
      }
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

      // Find-or-create conversation without relying on a UNIQUE constraint.
      const { data: existingConv } = await supabase
        .from("page_conversations")
        .select("id")
        .eq("org_id", ctx.orgId)
        .eq("page_id", page_id)
        .eq("customer_psid", customerPsid)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()

      const conversationPatch = {
        page_name: pageToken.pageName || page_id,
        customer_name: customerName,
        customer_profile_pic: customerProfilePic || null,
        status,
        unread_count: thread.unread_count || 0,
        last_message: lastText.slice(0, 500),
        last_message_at: lastTime,
        last_inbound_at: lastInboundAt,
        last_outbound_at: lastOutboundAt,
        updated_at: new Date().toISOString(),
      }

      const conversationResult = existingConv
        ? await supabase
            .from("page_conversations")
            .update(conversationPatch)
            .eq("id", existingConv.id)
            .select("id")
            .maybeSingle()
        : await supabase
            .from("page_conversations")
            .insert({ org_id: ctx.orgId, page_id, customer_psid: customerPsid, ...conversationPatch })
            .select("id")
            .maybeSingle()

      const conversation = conversationResult.data
      const convError = conversationResult.error

      if (convError || !conversation) {
        console.error("[messenger/sync] failed to write conversation:", convError)
        continue
      }

      // Upsert messages in batch
      const messagesToInsert = fbMessages.map((m: any) => {
        const direction: "outbound" | "inbound" = m.from?.id === page_id ? "outbound" : "inbound"
        let msgType: "text" | "attachment" = "text"
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
        const { error: msgInsertError } = await insertMessengerMessages(supabase, messagesToInsert)

        if (msgInsertError) {
          console.error("[messenger/sync] failed to insert messages:", msgInsertError)
        }
      }

      importedCount++
    }

    return NextResponse.json({
      success: true,
      count: importedCount,
      conversation_limit: conversationLimit,
      message_limit_per_conversation: MAX_MESSAGES_PER_CONVERSATION,
    })
  } catch (err: any) {
    console.error("[messenger/sync] error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
