import { NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection, requireRole } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { recordActivity } from "@/lib/notifications/emit"

const ADMIN_ROLES = new Set(["admin", "owner"])

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

    const forbidden = requireRole(ctx, ADMIN_ROLES)
    if (forbidden) return forbidden

    const connection = await getFacebookConnection(ctx.orgId)
    const actorName = ctx.user.user_metadata?.full_name || ctx.user.email?.split("@")[0] || "Someone"

    await recordActivity({
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      actorName,
      objectType: "facebook_connection",
      objectId: connection?.id ?? ctx.orgId,
      objectName: connection?.fb_user_name ?? null,
      action: "deleted",
      source: "connection-delete",
    })

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
