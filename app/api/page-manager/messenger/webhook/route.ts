import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type MessengerEvent = {
  sender?: { id?: string }
  recipient?: { id?: string }
  timestamp?: number
  message?: {
    mid?: string
    text?: string
    is_echo?: boolean
    attachments?: unknown[]
  }
  postback?: {
    mid?: string
    title?: string
    payload?: string
  }
}

function verifyToken() {
  return process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || ""
}

function eventTime(timestamp?: number) {
  return timestamp ? new Date(timestamp).toISOString() : new Date().toISOString()
}

function eventText(event: MessengerEvent) {
  if (event.message?.text) return event.message.text
  if (event.postback?.title) return event.postback.title
  if (event.postback?.payload) return event.postback.payload
  if (event.message?.attachments?.length) return "[Attachment]"
  return ""
}

function eventType(event: MessengerEvent) {
  if (event.postback) return "postback"
  if (event.message?.attachments?.length && !event.message?.text) return "attachment"
  if (event.message?.text) return "text"
  return "unknown"
}

async function storeMessengerEvent(page: any, event: MessengerEvent) {
  const pageId = event.recipient?.id || page.fb_page_id
  const isEcho = Boolean(event.message?.is_echo)
  const customerPsid = isEcho ? event.recipient?.id : event.sender?.id
  const direction = isEcho ? "outbound" : "inbound"
  const text = eventText(event)
  const timestamp = eventTime(event.timestamp)
  const fbMessageId = event.message?.mid || event.postback?.mid || null

  if (!pageId || !customerPsid || !text) return

  const supabase = createAdminClient()
  const { data: existingConversation } = await supabase
    .from("page_conversations")
    .select("id, unread_count")
    .eq("org_id", page.org_id)
    .eq("page_id", pageId)
    .eq("customer_psid", customerPsid)
    .maybeSingle()

  const nextUnreadCount = direction === "inbound"
    ? (existingConversation?.unread_count || 0) + 1
    : 0

  const { data: conversation, error: conversationError } = await supabase
    .from("page_conversations")
    .upsert(
      {
        org_id: page.org_id,
        page_id: pageId,
        page_name: page.name,
        customer_psid: customerPsid,
        customer_name: customerPsid,
        status: direction === "inbound" ? "pending" : "replied",
        unread_count: nextUnreadCount,
        last_message: text,
        last_message_at: timestamp,
        last_inbound_at: direction === "inbound" ? timestamp : undefined,
        last_outbound_at: direction === "outbound" ? timestamp : undefined,
      },
      { onConflict: "org_id,page_id,customer_psid" }
    )
    .select("id, unread_count")
    .single()

  if (conversationError || !conversation) {
    console.error("[messenger/webhook] conversation upsert failed", conversationError)
    return
  }

  const messageRow = {
    org_id: page.org_id,
    conversation_id: conversation.id,
    page_id: pageId,
    customer_psid: customerPsid,
    fb_message_id: fbMessageId,
    direction,
    message_type: eventType(event),
    message: text,
    attachments: event.message?.attachments || [],
    raw_event: event,
    fb_created_time: timestamp,
  }

  if (fbMessageId) {
    await supabase
      .from("page_messages")
      .upsert(messageRow, { onConflict: "org_id,fb_message_id", ignoreDuplicates: true })
  } else {
    await supabase.from("page_messages").insert(messageRow)
  }
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams
  const mode = search.get("hub.mode")
  const token = search.get("hub.verify_token")
  const challenge = search.get("hub.challenge")

  if (mode === "subscribe" && token && token === verifyToken()) {
    return new NextResponse(challenge || "", { status: 200 })
  }

  return NextResponse.json({ error: "Invalid verification token" }, { status: 403 })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (body.object !== "page") return NextResponse.json({ success: true })

    const supabase = createAdminClient()

    for (const entry of body.entry || []) {
      const pageId = entry.id
      if (!pageId) continue

      const { data: pages } = await supabase
        .from("pages")
        .select("org_id, fb_page_id, name")
        .eq("fb_page_id", pageId)

      if (!pages?.length) continue

      for (const event of entry.messaging || []) {
        for (const page of pages) {
          await storeMessengerEvent(page, event)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[messenger/webhook]", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Webhook error" }, { status: 500 })
  }
}
