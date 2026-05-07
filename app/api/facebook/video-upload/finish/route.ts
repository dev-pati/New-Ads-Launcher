import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST { ad_account_id, upload_session_id, video_id, file_name, file_size, headline?, primary_text?, ... }
// Finalizes the Facebook Resumable Upload session and saves creative to DB.
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const {
      ad_account_id,
      upload_session_id,
      video_id,
      file_name,
      file_size,
      headline = null,
      primary_text = null,
      description = null,
      link_url = null,
      cta = "LEARN_MORE",
    } = await request.json()

    if (!ad_account_id || !upload_session_id || !video_id) {
      return NextResponse.json({ error: "ad_account_id, upload_session_id and video_id required" }, { status: 400 })
    }

    const normId = ad_account_id.startsWith("act_") ? ad_account_id : `act_${ad_account_id}`
    const token = connection.access_token

    const params = new URLSearchParams({
      upload_phase: "finish",
      upload_session_id,
      access_token: token,
    })

    const res = await fetch(`https://graph.facebook.com/v21.0/${normId}/advideos`, {
      method: "POST",
      body: params,
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      return NextResponse.json({ error: data.error?.message || "Failed to finalize upload" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: creative, error: insertError } = await supabase
      .from("creatives")
      .insert({
        org_id: ctx.orgId,
        user_id: ctx.user.id,
        ad_account_id,
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
      })
      .select()
      .single()

    if (insertError) {
      console.error("[video-upload/finish] DB insert error:", insertError)
      return NextResponse.json({ error: "Failed to save creative" }, { status: 500 })
    }

    return NextResponse.json({ creative }, { status: 201 })
  } catch (err: any) {
    console.error("[video-upload/finish]", err)
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}
