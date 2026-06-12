import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { resolveOrgPageAccessToken } from "@/lib/facebook-page-token"
import { normalizeMetaError } from "@/lib/meta-error"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GRAPH = "https://graph.facebook.com/v25.0"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { page_id, post_id, comment_id } = await request.json()
    if (!page_id) return NextResponse.json({ error: "page_id required" }, { status: 400 })
    if (!post_id) return NextResponse.json({ error: "post_id required" }, { status: 400 })

    const supabase = createAdminClient()
    const pageToken = await resolveOrgPageAccessToken(supabase, ctx.orgId, ctx.user.id, page_id)
    if (!pageToken?.token) {
      return NextResponse.json({ error: "Page token not found. Please reconnect Facebook and select this Page again." }, { status: 400 })
    }

    const postFields = "id,message,story,created_time,permalink_url,full_picture,status_type,reactions.summary(true),comments.summary(true),shares"
    const postIdsToTry = Array.from(new Set([
      String(post_id),
      String(post_id).includes("_") ? "" : `${page_id}_${post_id}`,
    ].filter(Boolean)))

    let postData: any = null
    let postError: any = null
    for (const candidatePostId of postIdsToTry) {
      const postRes = await fetch(`${GRAPH}/${candidatePostId}?fields=${encodeURIComponent(postFields)}&access_token=${encodeURIComponent(pageToken.token)}`)
      const data = await postRes.json().catch(() => ({}))
      if (postRes.ok && !data.error) {
        postData = data
        break
      }
      postError = data
    }

    if (!postData) {
      return NextResponse.json(
        normalizeMetaError(postError, "Unable to load original Facebook post.", { pageId: page_id, permission: "pages_read_engagement" }),
        { status: 400 }
      )
    }

    const preview = {
      postId: postData.id || post_id,
      message: postData.message || postData.story || "",
      createdAt: postData.created_time || null,
      permalink: postData.permalink_url || null,
      mediaUrl: postData.full_picture || null,
      mediaType: String(postData.status_type || "").includes("video") ? "video" : "image",
      reactions: postData.reactions?.summary?.total_count ?? 0,
      comments: postData.comments?.summary?.total_count ?? 0,
      shares: postData.shares?.count ?? 0,
    }

    const patch = {
      fb_post_message: preview.message.slice(0, 160),
      fb_post_permalink: preview.permalink,
      fb_post_full_picture: preview.mediaUrl,
      fb_post_reactions: preview.reactions,
      fb_post_comments: preview.comments,
      fb_post_shares: preview.shares,
    }

    let updatedComment = null
    if (comment_id) {
      const { data } = await supabase
        .from("comments")
        .update(patch)
        .eq("org_id", ctx.orgId)
        .eq("fb_comment_id", comment_id)
        .select()
        .maybeSingle()
      updatedComment = data || null
    }

    if (!updatedComment) {
      await supabase
        .from("comments")
        .update(patch)
        .eq("org_id", ctx.orgId)
        .eq("page_id", page_id)
        .eq("fb_post_id", preview.postId)
    }

    return NextResponse.json({ preview, comment: updatedComment })
  } catch (err: any) {
    console.error("[comments/post-preview]", err)
    return NextResponse.json({ error: err.message || "Unable to load post preview" }, { status: 500 })
  }
}
