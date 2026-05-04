import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getVideoThumbnail } from "@/lib/facebook"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = await createClient()
    const { data: creative } = await supabase
      .from("creatives")
      .select("id, fb_video_id, fb_thumbnail_url")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .single()

    if (!creative) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (!creative.fb_video_id) return NextResponse.json({ error: "Not a video creative" }, { status: 400 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const thumbnailUrl = await getVideoThumbnail(creative.fb_video_id, connection.access_token)
    if (!thumbnailUrl) return NextResponse.json({ thumbnail_url: null })

    await supabase
      .from("creatives")
      .update({ fb_thumbnail_url: thumbnailUrl, file_url: thumbnailUrl })
      .eq("id", id)

    return NextResponse.json({ thumbnail_url: thumbnailUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
