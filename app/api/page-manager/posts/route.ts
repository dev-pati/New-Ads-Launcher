import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { resolveOrgPageAccessToken } from "@/lib/facebook-page-token"
import { normalizeMetaError } from "@/lib/meta-error"
import { createAdminClient } from "@/lib/supabase/admin"
import { logPageManageActivity } from "@/lib/page-manage-activity"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GRAPH = "https://graph.facebook.com/v25.0"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { page_id, message, image_url } = await request.json()
    const caption = String(message || "").trim()
    const imageUrl = String(image_url || "").trim()

    if (!page_id) return NextResponse.json({ error: "page_id required" }, { status: 400 })
    if (!caption && !imageUrl) {
      return NextResponse.json({ error: "message or image_url required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    const pageToken = await resolveOrgPageAccessToken(supabase, ctx.orgId, ctx.user.id, String(page_id))
    if (!pageToken?.token) {
      return NextResponse.json(
        { error: "Page token not found. Reconnect Facebook and select this Page again." },
        { status: 400 }
      )
    }

    // Photo publish: Meta fetches the image by public URL. caption = post message.
    // Text-only publish: Page feed.
    const isPhoto = Boolean(imageUrl)
    const endpoint = isPhoto ? `${GRAPH}/${page_id}/photos` : `${GRAPH}/${page_id}/feed`
    const body = isPhoto
      ? { url: imageUrl, caption, published: true, access_token: pageToken.token }
      : { message: caption, access_token: pageToken.token }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok || data.error) {
      return NextResponse.json(
        normalizeMetaError(data, "Unable to publish post.", { pageId: String(page_id), permission: "pages_manage_posts" }),
        { status: 400 }
      )
    }

    const postId = data.post_id || data.id

    await logPageManageActivity(supabase, {
      actorId: ctx.user.id,
      orgId: ctx.orgId,
      pageId: String(page_id),
      module: "content",
      action: isPhoto ? "publish_photo" : "publish_text",
      targetRef: postId ? String(postId) : null,
    })

    return NextResponse.json({ success: true, post_id: postId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
