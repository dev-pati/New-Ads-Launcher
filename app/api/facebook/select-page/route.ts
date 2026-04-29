import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { pageId, pageName, pageAccessToken, pageCategory, pagePictureUrl, businessManagerId } =
      await request.json()

    if (!pageId || !pageAccessToken || !businessManagerId) {
      return NextResponse.json(
        { error: "pageId, pageAccessToken, and businessManagerId are required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { error } = await supabase.from("pages").upsert(
      {
        user_id: user.id,
        business_manager_id: businessManagerId,
        fb_page_id: pageId,
        name: pageName,
        page_access_token: pageAccessToken,
        category: pageCategory,
        picture_url: pagePictureUrl,
        is_active: true,
      },
      { onConflict: "user_id,fb_page_id" }
    )

    if (error) {
      console.error("Failed to save selected page:", error)
      return NextResponse.json(
        { error: "Failed to save selected page" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Select page error:", err)
    return NextResponse.json(
      { error: "Failed to select page" },
      { status: 500 }
    )
  }
}
