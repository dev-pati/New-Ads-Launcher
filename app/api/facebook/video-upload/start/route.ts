import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getOrgAdAccountInfo } from "@/app/api/facebook/_utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface StartUploadBody {
  ad_account_id?: string
  file_name?: string
  file_size?: number
}

// POST { ad_account_id, file_name, file_size }
// Starts a Facebook resumable upload session server-side.
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const { ad_account_id, file_size } = await request.json() as StartUploadBody
    if (!ad_account_id) return NextResponse.json({ error: "ad_account_id required" }, { status: 400 })
    if (!Number.isFinite(file_size) || !file_size || file_size <= 0) {
      return NextResponse.json({ error: "file_size must be a positive number" }, { status: 400 })
    }

    const account = await getOrgAdAccountInfo(ctx.orgId, ad_account_id, connection.access_token)
    if (!account) {
      return NextResponse.json({ error: "Ad account not in your workspace" }, { status: 403 })
    }

    const normId = account.id.startsWith("act_") ? account.id : `act_${account.id}`
    const body = new URLSearchParams({
      access_token: connection.access_token,
      upload_phase: "start",
      file_size: Math.trunc(file_size).toString(),
    })

    const response = await fetch(`https://graph.facebook.com/v21.0/${normId}/advideos`, {
      method: "POST",
      body,
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || data?.error) {
      return NextResponse.json(
        { error: data?.error?.message || "Failed to start video upload session" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ad_account_id: normId,
      upload_session_id: data.upload_session_id,
      video_id: data.video_id,
      start_offset: data.start_offset,
      end_offset: data.end_offset,
    })
  } catch (err) {
    console.error("[video-upload/start]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    )
  }
}
