import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

const GRAPH_API_BASE = "https://graph.facebook.com/v25.0"

// GET /api/facebook/ads/[id]/debug
// Fetches an ad's full diagnostic info from Meta to debug "Delivery error" / "Story Unavailable":
// - effective_status, configured_status
// - issues_info (Meta's specific reasons for delivery problems)
// - recommendations
// - creative.object_story_id (missing → "Story Unavailable")
// - creative.video_id, image_hash, status
// - adset / campaign minimal info
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    if (!id) return NextResponse.json({ error: "ad id required" }, { status: 400 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    // Try a minimal field set first to identify which field Meta rejects
    const fields = [
      "id", "name", "effective_status",
      "issues_info",
      "recommendations",
      "creative{id,name,object_type,object_story_id,effective_object_story_id,thumbnail_url,image_hash,video_id}",
    ].join(",")

    const url = `${GRAPH_API_BASE}/${id}?fields=${fields}&access_token=${connection.access_token}`
    const res = await fetch(url)
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || "Failed to fetch ad", raw: data }, { status: res.status })
    }

    // Highlight likely root causes
    const diagnosis: string[] = []
    if (data.creative && !data.creative.object_story_id && !data.creative.effective_object_story_id) {
      diagnosis.push("⚠ Creative has no object_story_id — dark post creation failed → 'Story Unavailable' in preview")
    }
    if (Array.isArray(data.issues_info) && data.issues_info.length > 0) {
      data.issues_info.forEach((issue: any) => {
        diagnosis.push(`Meta issue [${issue.level}]: ${issue.error_summary || issue.error_message} (code ${issue.error_code})`)
      })
    }
    if (data.effective_status === "DISAPPROVED") diagnosis.push("⚠ Ad DISAPPROVED by Meta")
    if (data.effective_status === "WITH_ISSUES") diagnosis.push("⚠ Ad WITH_ISSUES — check recommendations / issues_info")
    if (data.effective_status === "PENDING_REVIEW") diagnosis.push("ℹ Ad PENDING_REVIEW — wait for Meta to approve")
    if (data.effective_status === "IN_PROCESS") diagnosis.push("ℹ Ad IN_PROCESS — Meta still building, wait 1-3 min")
    if (data.effective_status === "ADSET_PAUSED") diagnosis.push("ℹ Parent ad set is PAUSED")
    if (data.effective_status === "CAMPAIGN_PAUSED") diagnosis.push("ℹ Parent campaign is PAUSED")

    return NextResponse.json({
      diagnosis,
      ad: data,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}
