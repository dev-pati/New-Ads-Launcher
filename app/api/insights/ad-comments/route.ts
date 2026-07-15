import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const GRAPH = "https://graph.facebook.com/v25.0"

/**
 * GET /api/insights/ad-comments?adId=...
 * Resolves ad creative → effective_object_story_id → page/post → comments grouped by channel (page).
 * Returns { channels: [{ pageId, pageName, postId, comments: [...] }], resolved: boolean }.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const adId = request.nextUrl.searchParams.get("adId") || ""
    if (!adId) return NextResponse.json({ error: "adId required" }, { status: 400 })

    const connection = await getFacebookConnection(ctx.orgId)

    // 1. Resolve creative + story id from Meta (needs a token)
    let storyId = ""
    let postId = ""
    let pageId = ""
    let pageName = ""
    let mediaType = "image"

    if (connection) {
      const res = await fetch(
        `${GRAPH}/${adId}?fields=creative{id,object_type,video_id,object_story_id,effective_object_story_id,object_story_spec{page_id}}&access_token=${encodeURIComponent(connection.access_token)}`
      )
      const data = await res.json()
      const creative = data?.creative || {}
      storyId = creative.effective_object_story_id || creative.object_story_id || ""
      pageId = creative.object_story_spec?.page_id || ""
      if (storyId.includes("_")) [pageId, postId] = storyId.split("_")
      if (creative.object_type === "VIDEO" || creative.video_id) mediaType = "video"
    }

    if (!pageId || !postId) {
      return NextResponse.json({
        resolved: false,
        reason: "no_object_story_id",
        channels: [],
        message: "This ad has no linked Page post (dark-post). Comments by channel unavailable.",
      })
    }

    // 2. Look up local comments grouped by page
    const db = createAdminClient()
    const { data: comments, error } = await db
      .from("comments")
      .select("id,fb_comment_id,fb_post_id,message,from_name,sentiment,sentiment_score,like_count,is_hidden,is_replied,fb_created_time,page_id")
      .eq("org_id", ctx.orgId)
      .or(`fb_post_id.eq.${pageId}_${postId},fb_post_id.eq.${postId}`)
      .order("fb_created_time", { ascending: false })
      .limit(200)

    if (error) {
      console.error("[ad-comments] db error", error)
    }

    // Resolve page name
    const { data: pageRow } = await db
      .from("pages")
      .select("name")
      .eq("org_id", ctx.orgId)
      .eq("fb_page_id", pageId)
      .maybeSingle()

    pageName = pageRow?.name || `Page ${pageId}`

    return NextResponse.json({
      resolved: true,
      mediaType,
      pageId,
      postId: `${pageId}_${postId}`,
      objectStoryId: storyId,
      channels: [
        {
          pageId,
          pageName,
          platform: "Facebook",
          postId: `${pageId}_${postId}`,
          comments: comments || [],
        },
      ],
    })
  } catch (err: any) {
    console.error("[insights/ad-comments]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
