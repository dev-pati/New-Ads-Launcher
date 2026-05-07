import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST { ad_account_id, file_name, file_size }
// Starts a Facebook Resumable Upload session for large video files.
// Returns { upload_session_id, video_id, start_offset, end_offset }
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const { ad_account_id, file_name, file_size } = await request.json()
    if (!ad_account_id || !file_size) {
      return NextResponse.json({ error: "ad_account_id and file_size required" }, { status: 400 })
    }

    const normId = ad_account_id.startsWith("act_") ? ad_account_id : `act_${ad_account_id}`
    const token = connection.access_token

    const params = new URLSearchParams({
      upload_phase: "start",
      file_size: String(file_size),
      name: file_name || "video.mp4",
      access_token: token,
    })

    const res = await fetch(`https://graph.facebook.com/v21.0/${normId}/advideos`, {
      method: "POST",
      body: params,
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      return NextResponse.json({ error: data.error?.message || "Failed to start upload session" }, { status: 400 })
    }

    return NextResponse.json({
      upload_session_id: data.upload_session_id,
      video_id: data.video_id,
      start_offset: data.start_offset,
      end_offset: data.end_offset,
    })
  } catch (err: any) {
    console.error("[video-upload/start]", err)
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}
