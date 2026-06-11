import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

function isMissingTableError(error: any) {
  const message = String(error?.message || "").toLowerCase()
  return error?.code === "42P01" || message.includes("does not exist") || message.includes("schema cache")
}

/** Check if the page_id looks like a mock/demo ID (e.g. "p-1", "p-2") */
function isMockPageId(pageId: string) {
  return /^p-\d+$/.test(pageId)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const pageId = request.nextUrl.searchParams.get("page_id") || ""
    const limit = Number(request.nextUrl.searchParams.get("limit") || 50)
    if (!pageId) return NextResponse.json({ error: "page_id required" }, { status: 400 })

    // Return empty gracefully for demo/mock page IDs so UI doesn't show errors
    if (isMockPageId(pageId)) {
      return NextResponse.json({
        conversations: [],
        pageNotRegistered: true,
        info: "This is a demo page. Connect a real Facebook Page to load Messenger conversations.",
      })
    }

    const supabase = createAdminClient()

    // Try to find the page in the pages table — but don't hard-fail if not found.
    // Pages may exist in Meta but not yet registered in the workspace pages table.
    const { data: page } = await supabase
      .from("pages")
      .select("fb_page_id, name")
      .eq("org_id", ctx.orgId)
      .eq("fb_page_id", pageId)
      .maybeSingle()

    // If page is not registered in Supabase, return empty conversations instead of 404.
    // This avoids console errors and lets the UI show a "no data yet" state.
    if (!page) {
      return NextResponse.json({
        conversations: [],
        pageNotRegistered: true,
        info: "Page is not registered in this workspace. Messenger sync will work after the page is connected via the Connect flow.",
      })
    }

    const { data: conversations, error: conversationsError } = await supabase
      .from("page_conversations")
      .select("*")
      .eq("org_id", ctx.orgId)
      .eq("page_id", pageId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(Math.max(1, Math.min(limit, 100)))

    if (conversationsError) {
      if (isMissingTableError(conversationsError)) {
        return NextResponse.json({
          conversations: [],
          setupRequired: true,
          error: "Messenger inbox tables are not installed. Run the page manager messenger migration.",
        })
      }
      return NextResponse.json({ error: conversationsError.message }, { status: 500 })
    }

    const conversationIds = (conversations || []).map((conversation: any) => conversation.id)
    const { data: messages, error: messagesError } = conversationIds.length
      ? await supabase
          .from("page_messages")
          .select("*")
          .eq("org_id", ctx.orgId)
          .in("conversation_id", conversationIds)
          .order("fb_created_time", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true })
      : { data: [], error: null }

    if (messagesError) {
      return NextResponse.json({ error: messagesError.message }, { status: 500 })
    }

    const messagesByConversation = new Map<string, any[]>()
    for (const message of messages || []) {
      const list = messagesByConversation.get(message.conversation_id) || []
      list.push(message)
      messagesByConversation.set(message.conversation_id, list)
    }

    return NextResponse.json({
      conversations: (conversations || []).map((conversation: any) => ({
        ...conversation,
        messages: messagesByConversation.get(conversation.id) || [],
      })),
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to load Messenger inbox." }, { status: 500 })
  }
}
