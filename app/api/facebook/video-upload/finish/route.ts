import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { mapCreativeForClient } from "@/lib/creative-media"
import { getOrgAdAccountInfo } from "@/app/api/facebook/_utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST { ad_account_id, video_id, file_name, file_size, headline?, primary_text?, ... }
// Saves the uploaded video (already on Facebook) as a creative in DB.
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const {
      ad_account_id,
      video_id,
      file_name,
      file_size,
      headline = null,
      primary_text = null,
      description = null,
      link_url = null,
      cta = "LEARN_MORE",
    } = await request.json()

    if (!ad_account_id || !video_id) {
      return NextResponse.json({ error: "ad_account_id and video_id required" }, { status: 400 })
    }

    const account = await getOrgAdAccountInfo(ctx.orgId, ad_account_id, connection.access_token)
    if (!account) {
      return NextResponse.json({ error: "Ad account not in your workspace" }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: creative, error: insertError } = await supabase
      .from("creatives")
      .insert({
        org_id: ctx.orgId,
        user_id: ctx.user.id,
        ad_account_id: account.id,
        file_name: file_name || `video_${video_id}`,
        file_url: "",
        media_type: "video",
        file_size: file_size || 0,
        headline,
        primary_text,
        description,
        link_url,
        cta,
        fb_video_id: video_id,
        status: "processing",
      })
      .select()
      .single()

    if (insertError) {
      console.error("[video-upload/finish] DB insert error:", insertError)
      return NextResponse.json({ error: "Failed to save creative" }, { status: 500 })
    }

    return NextResponse.json({ creative: mapCreativeForClient(creative) }, { status: 201 })
  } catch (err) {
    console.error("[video-upload/finish]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    )
  }
}
