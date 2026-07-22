import { insertMessengerMessage, messengerMessageExists } from "@/lib/messenger-storage"
import { logPageManageActivity } from "@/lib/page-manage-activity"

type SupabaseLike = { from: (table: string) => any }

export type FeedCommentValue = {
  item?: string
  verb?: string
  comment_id?: string
  post_id?: string
  parent_id?: string
  created_time?: number | string
  message?: string
  from?: { id?: string; name?: string }
  permalink_url?: string
  post?: { id?: string; status_type?: string; is_published?: boolean; permalink_url?: string; promotion_status?: string }
}

function toIso(value?: number | string) {
  if (typeof value === "number") {
    // Meta sometimes sends seconds, sometimes ms.
    const ms = value < 1e12 ? value * 1000 : value
    return new Date(ms).toISOString()
  }
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return new Date().toISOString()
}

function isAdContext(value: FeedCommentValue) {
  const promo = String(value.post?.promotion_status || "").toLowerCase()
  if (promo && promo !== "inactive" && promo !== "none") return true
  if (value.post?.is_published === false) return true
  return false
}

export async function storeCommentEvent(
  supabase: SupabaseLike,
  page: { org_id: string; fb_page_id: string; name?: string | null; page_access_token?: string | null },
  value: FeedCommentValue
) {
  if (value?.item !== "comment") return { ok: false, reason: "not_comment" as const }
  const fbCommentId = String(value.comment_id || "").trim()
  const fbPostId = String(value.post_id || value.post?.id || "").trim()
  const fromId = String(value.from?.id || "").trim()
  const fromName = String(value.from?.name || fromId || "Facebook user").trim()
  const message = String(value.message || "").trim() || "[Comment]"
  const verb = String(value.verb || "add").toLowerCase()
  const timestamp = toIso(value.created_time)
  const permalink = value.permalink_url || value.post?.permalink_url || null
  const pageId = page.fb_page_id

  if (!fbCommentId || !fbPostId || !fromId) {
    return { ok: false, reason: "missing_ids" as const }
  }

  // Idempotency: page_messages.fb_comment_id unique
  const { data: existingMsg } = await supabase
    .from("page_messages")
    .select("id, conversation_id")
    .eq("org_id", page.org_id)
    .eq("fb_comment_id", fbCommentId)
    .maybeSingle()

  if (verb === "remove" || verb === "hide") {
    await supabase
      .from("comments")
      .update({ is_hidden: true, message })
      .eq("org_id", page.org_id)
      .eq("fb_comment_id", fbCommentId)

    if (existingMsg?.conversation_id) {
      await supabase
        .from("page_conversations")
        .update({
          last_message: message,
          last_message_at: timestamp,
          source_meta: { verb, hidden: true },
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMsg.conversation_id)
        .eq("org_id", page.org_id)
    }
    return { ok: true, reason: "updated_removed" as const }
  }

  if (verb === "edited" && existingMsg) {
    await supabase
      .from("comments")
      .update({ message, fb_created_time: timestamp })
      .eq("org_id", page.org_id)
      .eq("fb_comment_id", fbCommentId)

    await supabase
      .from("page_messages")
      .update({ message, raw_event: value, fb_created_time: timestamp })
      .eq("id", existingMsg.id)
      .eq("org_id", page.org_id)

    if (existingMsg.conversation_id) {
      await supabase
        .from("page_conversations")
        .update({
          last_message: message.slice(0, 500),
          last_message_at: timestamp,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMsg.conversation_id)
        .eq("org_id", page.org_id)
    }
    return { ok: true, reason: "updated_edited" as const }
  }

  if (existingMsg) {
    return { ok: true, reason: "duplicate" as const }
  }

  // Also short-circuit via messenger mid path if Meta reused mid as comment id.
  if (await messengerMessageExists(supabase, page.org_id, fbCommentId)) {
    return { ok: true, reason: "duplicate_mid" as const }
  }

  const adComment = isAdContext(value)
  const sourceMeta = {
    verb,
    permalink,
    post_status_type: value.post?.status_type || null,
    is_ad_comment: adComment,
    parent_id: value.parent_id || null,
  }

  // Upsert comments table (dedupe on org_id, fb_comment_id)
  const { data: existingComment } = await supabase
    .from("comments")
    .select("id")
    .eq("org_id", page.org_id)
    .eq("fb_comment_id", fbCommentId)
    .maybeSingle()

  let commentRowId = existingComment?.id as string | undefined
  if (!commentRowId) {
    const { data: inserted, error: insertCommentError } = await supabase
      .from("comments")
      .insert({
        org_id: page.org_id,
        fb_comment_id: fbCommentId,
        fb_post_id: fbPostId,
        fb_post_message: null,
        fb_post_permalink: permalink,
        page_id: pageId,
        page_name: page.name || null,
        message,
        from_name: fromName,
        from_id: fromId,
        sentiment: "neutral",
        sentiment_score: 0,
        themes: [],
        is_hidden: false,
        is_replied: false,
        fb_created_time: timestamp,
      })
      .select("id")
      .maybeSingle()

    if (insertCommentError) {
      // Race: another worker inserted first
      const duplicate = insertCommentError.code === "23505" || /duplicate key/i.test(insertCommentError.message || "")
      if (!duplicate) {
        console.error("[comment-webhook] comments insert failed", insertCommentError)
        return { ok: false, reason: "comment_insert_failed" as const }
      }
      const { data: raced } = await supabase
        .from("comments")
        .select("id")
        .eq("org_id", page.org_id)
        .eq("fb_comment_id", fbCommentId)
        .maybeSingle()
      commentRowId = raced?.id
    } else {
      commentRowId = inserted?.id
    }
  }

  // Upsert synthetic conversation for unified inbox
  const { data: existingConversation } = await supabase
    .from("page_conversations")
    .select("id, unread_count")
    .eq("org_id", page.org_id)
    .eq("page_id", pageId)
    .eq("source", "facebook_comment")
    .eq("fb_post_id", fbPostId)
    .eq("customer_psid", fromId)
    .maybeSingle()

  const nextUnread = (existingConversation?.unread_count || 0) + 1
  const conversationPayload = {
    org_id: page.org_id,
    page_id: pageId,
    page_name: page.name || pageId,
    customer_psid: fromId,
    customer_name: fromName,
    source: "facebook_comment",
    status: "pending",
    unread_count: nextUnread,
    last_message: message.slice(0, 500),
    last_message_at: timestamp,
    last_inbound_at: timestamp,
    fb_post_id: fbPostId,
    fb_comment_id: fbCommentId,
    source_meta: sourceMeta,
    metadata: {
      comment_id: commentRowId || null,
      fb_comment_id: fbCommentId,
      fb_post_id: fbPostId,
      is_ad_comment: adComment,
    },
    updated_at: new Date().toISOString(),
  }

  let conversationId = existingConversation?.id as string | undefined
  if (conversationId) {
    const { error: updateError } = await supabase
      .from("page_conversations")
      .update(conversationPayload)
      .eq("id", conversationId)
      .eq("org_id", page.org_id)
    if (updateError) {
      console.error("[comment-webhook] conversation update failed", updateError)
      return { ok: false, reason: "conversation_update_failed" as const }
    }
  } else {
    const { data: insertedConv, error: convError } = await supabase
      .from("page_conversations")
      .insert(conversationPayload)
      .select("id")
      .maybeSingle()

    if (convError || !insertedConv?.id) {
      // Fallback: unique race — re-select
      const { data: racedConv } = await supabase
        .from("page_conversations")
        .select("id, unread_count")
        .eq("org_id", page.org_id)
        .eq("page_id", pageId)
        .eq("source", "facebook_comment")
        .eq("fb_post_id", fbPostId)
        .eq("customer_psid", fromId)
        .maybeSingle()
      conversationId = racedConv?.id
      if (!conversationId) {
        console.error("[comment-webhook] conversation insert failed", convError)
        return { ok: false, reason: "conversation_insert_failed" as const }
      }
      await supabase
        .from("page_conversations")
        .update({
          ...conversationPayload,
          unread_count: (racedConv?.unread_count || 0) + 1,
        })
        .eq("id", conversationId)
        .eq("org_id", page.org_id)
    } else {
      conversationId = insertedConv.id
    }
  }

  await insertMessengerMessage(supabase, {
    org_id: page.org_id,
    conversation_id: conversationId!,
    page_id: pageId,
    customer_psid: fromId,
    fb_message_id: `comment:${fbCommentId}`,
    direction: "inbound",
    message_type: "comment",
    message,
    attachments: [],
    raw_event: value,
    fb_created_time: timestamp,
    fb_comment_id: fbCommentId,
  } as any)

  // Best-effort activity proof (system ingest — actor null)
  await logPageManageActivity(supabase, {
    actorId: null as any,
    orgId: page.org_id,
    pageId,
    module: "comment",
    action: "webhook_ingest",
    targetRef: fbCommentId,
  })

  return { ok: true, reason: "ingested" as const, conversationId, commentId: commentRowId }
}
