import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveOrgPageAccessToken } from "@/lib/facebook-page-token"

/**
 * Save selected page for the active org.
 * pageAccessToken from client is IGNORED — token is resolved server-side
 * from the org Facebook connection (or existing pages row).
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const pageId = body?.pageId
    const pageName = body?.pageName
    const pageCategory = body?.pageCategory
    const pagePictureUrl = body?.pagePictureUrl
    const businessManagerId = body?.businessManagerId ?? null

    if (!pageId) {
      return NextResponse.json({ error: "pageId is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Server-side token resolve — never trust client-supplied pageAccessToken
    const resolved = await resolveOrgPageAccessToken(
      supabase,
      ctx.orgId,
      ctx.user.id,
      String(pageId)
    )
    if (!resolved?.token) {
      return NextResponse.json(
        {
          error:
            "Unable to resolve page access token for this page. Reconnect Facebook or ensure the page is available on the connected account.",
        },
        { status: 400 }
      )
    }

    // resolveOrgPageAccessToken already upserts pages with encrypted token.
    // Optionally attach business_manager_id / refresh name/picture if provided.
    const patch: Record<string, unknown> = {
      is_active: true,
    }
    if (pageName) patch.name = pageName
    else if (resolved.pageName) patch.name = resolved.pageName
    if (pageCategory) patch.category = pageCategory
    if (pagePictureUrl) patch.picture_url = pagePictureUrl
    if (businessManagerId) patch.business_manager_id = businessManagerId

    const { error } = await supabase
      .from("pages")
      .update(patch)
      .eq("org_id", ctx.orgId)
      .eq("fb_page_id", String(pageId))

    if (error) {
      console.error("Failed to save selected page:", error)
      return NextResponse.json({ error: "Failed to save selected page" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Select page error:", err)
    return NextResponse.json({ error: "Failed to select page" }, { status: 500 })
  }
}
