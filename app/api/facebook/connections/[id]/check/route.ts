import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchViaProfile, tokenStatusFromError } from "@/lib/via-connections"
import { buildMetaHeaders } from "@/lib/meta-secure-fetch"

// Health check 1 connection: GET /me (skipProof nếu manual) → cập nhật token_status
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const supabase = createAdminClient()
    const { data: connection } = await supabase
      .from("facebook_connections")
      .select("id, access_token, connection_type")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .eq("is_active", true)
      .maybeSingle()

    if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 })

    let tokenStatus: "valid" | "expired" | "invalid" = "valid"
    try {
      if (connection.connection_type === "manual_token") {
        await fetchViaProfile(connection.access_token)
      } else {
        const res = await fetch("https://graph.facebook.com/v25.0/me?fields=id", {
          headers: buildMetaHeaders(connection.access_token),
        })
        const data = await res.json()
        if (data?.error) throw data
      }
    } catch (err) {
      tokenStatus = tokenStatusFromError(err)
    }

    await supabase
      .from("facebook_connections")
      .update({ token_status: tokenStatus, last_checked_at: new Date().toISOString() })
      .eq("id", id)

    return NextResponse.json({ token_status: tokenStatus })
  } catch (err) {
    console.error("[connections] check failed:", err)
    return NextResponse.json({ error: "Failed to check connection" }, { status: 500 })
  }
}
