import { NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ connected: false }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ connected: false })

    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      return NextResponse.json({ connected: false, reason: "token_expired" })
    }

    return NextResponse.json({
      connected: true,
      user: {
        id: connection.fb_user_id,
        name: connection.fb_user_name,
        picture: connection.fb_picture_url,
      },
    })
  } catch (err) {
    console.error("Failed to check connection:", err)
    return NextResponse.json({ connected: false }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createAdminClient()
    await supabase.from("ad_media").delete().eq("org_id", ctx.orgId)
    await supabase.from("ads").delete().eq("org_id", ctx.orgId)
    await supabase.from("creatives").delete().eq("org_id", ctx.orgId)
    await supabase.from("pages").delete().eq("org_id", ctx.orgId)
    await supabase.from("ad_accounts").delete().eq("org_id", ctx.orgId)
    await supabase.from("business_managers").delete().eq("org_id", ctx.orgId)
    await supabase.from("facebook_connections").delete().eq("org_id", ctx.orgId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Failed to disconnect:", err)
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 })
  }
}
