import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ViaRole } from "@/lib/via-connections"

async function getOwnedConnection(orgId: string, id: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("facebook_connections")
    .select("id, connection_type, via_role, is_active")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle()
  return data
}

async function countAssignedAccounts(orgId: string, connectionId: string) {
  const supabase = createAdminClient()
  const { count } = await supabase
    .from("ad_accounts")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .or(`launch_connection_id.eq.${connectionId},read_connection_id.eq.${connectionId}`)
  return count ?? 0
}

// Đổi label; đổi via_role CHỈ khi đã gỡ hết account khỏi slot (giữ MECE)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const connection = await getOwnedConnection(ctx.orgId, id)
    if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 })
    if (connection.connection_type !== "manual_token") {
      return NextResponse.json({ error: "Only via (manual token) connections can be edited" }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    const updates: Record<string, unknown> = {}

    if (typeof body?.label === "string") updates.label = body.label.trim() || null

    const newRole: ViaRole | undefined = body?.viaRole
    if (newRole !== undefined && newRole !== connection.via_role) {
      if (newRole !== "launch" && newRole !== "non_launch") {
        return NextResponse.json({ error: "viaRole must be 'launch' or 'non_launch'" }, { status: 400 })
      }
      const assignedCount = await countAssignedAccounts(ctx.orgId, id)
      if (assignedCount > 0) {
        return NextResponse.json(
          { error: `Via is assigned to ${assignedCount} ad account(s). Remove it from all slots before changing its role.` },
          { status: 409 }
        )
      }
      updates.via_role = newRole
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from("facebook_connections").update(updates).eq("id", id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[connections] patch failed:", err)
    return NextResponse.json({ error: "Failed to update connection" }, { status: 500 })
  }
}

// Remove via (admin only): is_active=false + clear cả 2 slot đang trỏ tới
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (ctx.role !== "admin" && ctx.role !== "owner") {
      return NextResponse.json({ error: "Only admins can remove a via" }, { status: 403 })
    }

    const { id } = await params
    const connection = await getOwnedConnection(ctx.orgId, id)
    if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 })
    if (connection.connection_type !== "manual_token") {
      return NextResponse.json(
        { error: "Only via can be removed here — OAuth disconnect at /api/facebook/connection" },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    await supabase
      .from("ad_accounts")
      .update({ launch_connection_id: null })
      .eq("org_id", ctx.orgId)
      .eq("launch_connection_id", id)
    await supabase
      .from("ad_accounts")
      .update({ read_connection_id: null })
      .eq("org_id", ctx.orgId)
      .eq("read_connection_id", id)

    const { error } = await supabase
      .from("facebook_connections")
      .update({ is_active: false })
      .eq("id", id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[connections] delete failed:", err)
    return NextResponse.json({ error: "Failed to remove connection" }, { status: 500 })
  }
}
