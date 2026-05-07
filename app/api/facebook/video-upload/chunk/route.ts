import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// POST raw binary body (single chunk, max ~3.5MB)
// Query: ad_account_id, upload_session_id, start_offset
// Forwards chunk to Facebook Resumable Upload API.
// Returns { start_offset, end_offset } for the next chunk.
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const sp = request.nextUrl.searchParams
    const adAccountId = sp.get("ad_account_id")
    const uploadSessionId = sp.get("upload_session_id")
    const startOffset = sp.get("start_offset") || "0"

    if (!adAccountId || !uploadSessionId) {
      return NextResponse.json({ error: "ad_account_id and upload_session_id required" }, { status: 400 })
    }

    const chunkBuffer = await request.arrayBuffer()
    if (chunkBuffer.byteLength === 0) {
      return NextResponse.json({ error: "Empty chunk" }, { status: 400 })
    }

    const normId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const token = connection.access_token

    const formData = new FormData()
    formData.append("upload_phase", "transfer")
    formData.append("upload_session_id", uploadSessionId)
    formData.append("start_offset", startOffset)
    formData.append("access_token", token)
    formData.append("video_file_chunk", new Blob([chunkBuffer]), "chunk.mp4")

    const res = await fetch(`https://graph.facebook.com/v21.0/${normId}/advideos`, {
      method: "POST",
      body: formData,
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      return NextResponse.json({ error: data.error?.message || "Chunk upload failed" }, { status: 400 })
    }

    return NextResponse.json({
      start_offset: data.start_offset,
      end_offset: data.end_offset,
    })
  } catch (err: any) {
    console.error("[video-upload/chunk]", err)
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}
