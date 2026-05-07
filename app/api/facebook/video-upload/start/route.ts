import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST { ad_account_id, file_name, file_size }
// Auth-gated token proxy: verifies the user owns the ad account,
// then returns access_token + normalized ad_account_id so the client
// can upload the video file directly to Facebook (no Vercel body limit).
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const { ad_account_id } = await request.json()
    if (!ad_account_id) return NextResponse.json({ error: "ad_account_id required" }, { status: 400 })

    // Verify ad account belongs to this org
    const supabase = await createClient()
    const { data: accounts } = await supabase
      .from("ad_accounts")
      .select("fb_ad_account_id")
      .eq("org_id", ctx.orgId)
    const norm = (id: string) => id.startsWith("act_") ? id.slice(4) : id
    const allowed = (accounts || []).map((a: any) => norm(a.fb_ad_account_id))
    if (!allowed.includes(norm(ad_account_id))) {
      return NextResponse.json({ error: "Ad account not in your workspace" }, { status: 403 })
    }

    const normId = ad_account_id.startsWith("act_") ? ad_account_id : `act_${ad_account_id}`
    return NextResponse.json({ ad_account_id: normId, access_token: connection.access_token })
  } catch (err: any) {
    console.error("[video-upload/start]", err)
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}
