import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { resolveOrgPageAccessToken } from "@/lib/facebook-page-token"
import { normalizeMetaError } from "@/lib/meta-error"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const GRAPH = "https://graph.facebook.com/v25.0"

function classifySentiment(message: string): "positive" | "neutral" | "negative" {
  const text = message.toLowerCase()
  if (/(scam|fake|bad|broken|hate|spam|refund|angry|terrible)/.test(text)) return "negative"
  if (/(thanks|thank you|love|great|good|interested|price|how much|buy)/.test(text)) return "positive"
  return "neutral"
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { page_id, post_id } = await request.json()
    if (!page_id) return NextResponse.json({ error: "page_id required" }, { status: 400 })
    if (!post_id) return NextResponse.json({ error: "post_id required" }, { status: 400 })

    const supabase = createAdminClient()
    const pageToken = await resolveOrgPageAccessToken(supabase, ctx.orgId, ctx.user.id, page_id)
    if (!pageToken?.token) {
      return NextResponse.json({ error: "Page token not found. Please reconnect Facebook and select this Page again." }, { status: 400 })
    }

    const postFields = "id,message,story,created_time,permalink_url,full_picture,reactions.summary(true),comments.summary(true),shares"
    const postRes = await fetch(`${GRAPH}/${post_id}?fields=${encodeURIComponent(postFields)}&access_token=${encodeURIComponent(pageToken.token)}`)
    const postData = await postRes.json()
    if (!postRes.ok || postData.error) {
      return NextResponse.json(
        normalizeMetaError(postData, "Unable to load Page post.", { pageId: page_id, permission: "pages_read_engagement" }),
        { status: 400 }
      )
    }

    const commentFields = "id,message,from,created_time,can_hide,is_hidden,like_count,comment_count"
    const commentsRes = await fetch(`${GRAPH}/${post_id}/comments?fields=${encodeURIComponent(commentFields)}&filter=stream&limit=100&access_token=${encodeURIComponent(pageToken.token)}`)
    const commentsData = await commentsRes.json()
    if (!commentsRes.ok || commentsData.error) {
      return NextResponse.json(
        normalizeMetaError(commentsData, "Unable to load Page post comments.", { pageId: page_id, permission: "pages_read_engagement" }),
        { status: 400 }
      )
    }

    const postReactions = postData.reactions?.summary?.total_count ?? 0
    const postComments = postData.comments?.summary?.total_count ?? 0
    const postShares = postData.shares?.count ?? 0

    const rawComments = (commentsData.data || []).map((comment: any) => ({
      fb_comment_id: comment.id,
      fb_post_id: postData.id || post_id,
      fb_post_message: (postData.message || postData.story || "").slice(0, 160),
      fb_post_permalink: postData.permalink_url || null,
      fb_post_full_picture: postData.full_picture || null,
      fb_post_reactions: postReactions,
      fb_post_comments: postComments,
      fb_post_shares: postShares,
      page_id,
      page_name: pageToken.pageName || null,
      message: comment.message || "",
      from_name: comment.from?.name || "Unknown",
      from_id: comment.from?.id || "",
      like_count: comment.like_count || 0,
      comment_count: comment.comment_count || 0,
      is_hidden: comment.is_hidden || false,
      fb_created_time: comment.created_time,
    }))

    if (!rawComments.length) {
      return NextResponse.json({ new_count: 0, total_fetched: 0, comments: [] })
    }

    const fbIds = rawComments.map((comment: any) => comment.fb_comment_id)
    const { data: existing } = await supabase
      .from("comments")
      .select("fb_comment_id")
      .eq("org_id", ctx.orgId)
      .in("fb_comment_id", fbIds)

    const existingIds = new Set((existing || []).map((comment: any) => comment.fb_comment_id))
    const toInsert = rawComments
      .filter((comment: any) => !existingIds.has(comment.fb_comment_id))
      .map((comment: any) => ({
        org_id: ctx.orgId,
        ...comment,
        sentiment: classifySentiment(comment.message),
        sentiment_score: 0,
        themes: [],
      }))

    let inserted: any[] = []
    if (toInsert.length) {
      const { data, error } = await supabase
        .from("comments")
        .insert(toInsert)
        .select()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      inserted = data || []
    }

    const { data: comments } = await supabase
      .from("comments")
      .select("*")
      .eq("org_id", ctx.orgId)
      .eq("page_id", page_id)
      .eq("fb_post_id", post_id)
      .order("fb_created_time", { ascending: false })
      .limit(100)

    return NextResponse.json({
      new_count: inserted.length,
      total_fetched: rawComments.length,
      comments: comments || [],
    })
  } catch (err: any) {
    console.error("[comments/sync-post]", err)
    return NextResponse.json({ error: err.message || "Unable to sync post comments" }, { status: 500 })
  }
}
