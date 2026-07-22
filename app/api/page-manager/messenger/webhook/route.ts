import { NextRequest, NextResponse } from "next/server"
import { getMessengerUserPicture, getMessengerUserProfile } from "@/lib/facebook"
import { insertMessengerMessage, messengerMessageExists } from "@/lib/messenger-storage"
import { storeCommentEvent } from "@/lib/page-manager-comment-webhook"
import { createAdminClient } from "@/lib/supabase/admin"
import { createHmac, timingSafeEqual } from "crypto"

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

function appSecret() {
  return process.env.FACEBOOK_APP_SECRET || ""
}

function isValidSignature(request: NextRequest, rawBody: string) {
  const signature = request.headers.get("x-hub-signature-256")
  const secret = appSecret()

  // Keep dev usable when app secret is not configured or left as default template.
  const isSecretUnset = !secret || secret === "replace_with_meta_app_secret"
  if (isSecretUnset) return process.env.NODE_ENV !== "production"
  if (!signature || !signature.startsWith("sha256=")) return false

  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`
  const actualBuf = Buffer.from(signature)
  const expectedBuf = Buffer.from(expected)
  if (actualBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(actualBuf, expectedBuf)
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

function eventType(event: MessengerEvent): "text" | "postback" | "attachment" | "unknown" {
  if (event.postback) return "postback"
  if (event.message?.attachments?.length && !event.message?.text) return "attachment"
  if (event.message?.text) return "text"
  return "unknown"
}

async function storeMessengerEvent(page: any, event: MessengerEvent) {
  const isEcho = Boolean(event.message?.is_echo)
  const pageId = isEcho ? event.sender?.id || page.fb_page_id : event.recipient?.id || page.fb_page_id
  const customerPsid = isEcho ? event.recipient?.id : event.sender?.id
  const direction: "outbound" | "inbound" = isEcho ? "outbound" : "inbound"
  const text = eventText(event)
  const timestamp = eventTime(event.timestamp)
  const fbMessageId = event.message?.mid || event.postback?.mid || null

  if (!pageId || !customerPsid || !text) return

  const supabase = createAdminClient()
  if (fbMessageId && await messengerMessageExists(supabase, page.org_id, fbMessageId)) {
    return
  }

  const customerProfile = page.page_access_token
    ? await getMessengerUserProfile(customerPsid, page.page_access_token)
    : null
  const customerProfilePic = page.page_access_token
    ? customerProfile?.profile_pic || await getMessengerUserPicture(customerPsid, page.page_access_token)
    : null
  const profileName = [customerProfile?.first_name, customerProfile?.last_name].filter(Boolean).join(" ")
  const customerName = profileName
    || customerPsid

  const { data: existingConversation } = await supabase
    .from("page_conversations")
    .select("id, unread_count")
    .eq("org_id", page.org_id)
    .eq("page_id", pageId)
    .eq("customer_psid", customerPsid)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  const conversationPatch = {
    page_name: page.name,
    customer_name: customerName,
    customer_profile_pic: customerProfilePic || undefined,
    status: direction === "inbound" ? "pending" : "replied",
    unread_count: direction === "inbound" ? (existingConversation?.unread_count || 0) + 1 : 0,
    last_message: text,
    last_message_at: timestamp,
    last_inbound_at: direction === "inbound" ? timestamp : undefined,
    last_outbound_at: direction === "outbound" ? timestamp : undefined,
  }

  const { data: conversation, error: conversationError } = existingConversation
    ? await supabase
        .from("page_conversations")
        .update(conversationPatch)
        .eq("id", existingConversation.id)
        .select("id, unread_count")
        .single()
    : await supabase
        .from("page_conversations")
        .insert({
          org_id: page.org_id,
          page_id: pageId,
          customer_psid: customerPsid,
          ...conversationPatch,
        })
        .select("id, unread_count")
        .single()

  if (conversationError || !conversation) {
    console.error("[messenger/webhook] conversation write failed", conversationError)
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

  await insertMessengerMessage(supabase, messageRow)
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
    const rawBody = await request.text()
    if (!isValidSignature(request, rawBody)) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 })
    }

    const body = JSON.parse(rawBody || "{}")
    if (body.object !== "page") {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // ponytail: Meta requires 200 OK within ~3s. Defer all DB/AI work to after()
    // so we never block the response. Upgrade path: swap `after()` for a durable
    // queue (QStash/Inngest) if `after()` is dropped from serverless billing.
    // BUGFIX: after() requires experimental config in Next.js 15, or it silently drops execution in some modes.
    // Since Meta requires 200 OK fast, but we're debugging a regression, let's await it directly.
    await processWebhookBody(body)

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    console.error("[messenger/webhook]", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Webhook error" }, { status: 500 })
  }
}

async function processWebhookBody(body: any) {
  const supabase = createAdminClient()
  const jobs: Promise<void>[] = []

  for (const entry of body.entry || []) {
    const pageId = entry.id
    if (!pageId) continue

    const { data: pages } = await supabase
      .from("pages")
      .select("org_id, fb_page_id, name, page_access_token")
      .eq("fb_page_id", pageId)

    if (!pages?.length) continue

    for (const event of entry.messaging || []) {
      for (const page of pages) {
        jobs.push(storeMessengerEvent(page, event))
      }
    }

    for (const change of entry.changes || []) {
      if (change?.field !== "feed") continue
      const value = change.value
      if (value?.item !== "comment" || !value?.comment_id) continue
      for (const page of pages) {
        jobs.push(
          storeCommentEvent(supabase, page, value).then(() => undefined).catch(err => {
            console.error("[messenger/webhook] comment ingest failed", err)
          })
        )
      }
    }
  }

  await Promise.allSettled(jobs)
}
