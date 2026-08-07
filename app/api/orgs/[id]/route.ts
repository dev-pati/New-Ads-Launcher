import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { recordActivity } from "@/lib/notifications/emit"

// Update an organization (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: orgId } = await params
    const { name, logo_url, feedback_po_email, feedback_bom_email } = await request.json()
    const trimmedName = typeof name === "string" ? name.trim() : ""

    if (!trimmedName) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: callerMember } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .single()

    if (!callerMember || callerMember.role !== "admin") {
      return NextResponse.json({ error: "Only admins can update organizations" }, { status: 403 })
    }

    const emailOrNull = (value: unknown) => {
      if (value === undefined) return undefined
      const trimmed = typeof value === "string" ? value.trim() : ""
      return trimmed || null
    }
    const updates: { name: string; logo_url?: string | null; feedback_po_email?: string | null; feedback_bom_email?: string | null } = { name: trimmedName }
    if (logo_url !== undefined) updates.logo_url = logo_url
    if (feedback_po_email !== undefined) updates.feedback_po_email = emailOrNull(feedback_po_email)
    if (feedback_bom_email !== undefined) updates.feedback_bom_email = emailOrNull(feedback_bom_email)

    const { data: org, error } = await supabase
      .from("organizations")
      .update(updates)
      .eq("id", orgId)
      .select("id, name, slug, logo_url, created_at")
      .single()

    if (error) {
      console.error("Failed to update organization:", error)
      return NextResponse.json({ error: "Failed to update organization" }, { status: 500 })
    }

    const actorName = user.full_name || user.email?.split("@")[0] || "Someone"
    await recordActivity({
      orgId,
      actorId: user.id,
      actorName,
      objectType: "organization",
      objectId: orgId,
      objectName: org.name,
      action: "updated",
      source: "org-update",
    })

    return NextResponse.json({ org })
  } catch (err) {
    console.error("Failed to update organization:", err)
    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 })
  }
}

// Delete an organization (admin only, requires confirmation name match)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: orgId } = await params
    const { confirmName } = await request.json()

    if (!confirmName) {
      return NextResponse.json({ error: "confirmName is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify caller is admin
    const { data: callerMember } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .single()

    if (!callerMember || callerMember.role !== "admin") {
      return NextResponse.json({ error: "Only admins can delete organizations" }, { status: 403 })
    }

    // Verify org name matches
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single()

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    if (org.name !== confirmName) {
      return NextResponse.json({ error: "Organization name does not match" }, { status: 400 })
    }

    const actorName = user.full_name || user.email?.split("@")[0] || "Someone"
    await recordActivity({
      orgId,
      actorId: user.id,
      actorName,
      objectType: "organization",
      objectId: orgId,
      objectName: org.name,
      action: "deleted",
      source: "org-delete",
    })

    // Delete the organization (CASCADE will handle members, invitations, etc.)
    const { error } = await supabase
      .from("organizations")
      .delete()
      .eq("id", orgId)

    if (error) {
      console.error("Failed to delete organization:", error)
      return NextResponse.json({ error: "Failed to delete organization" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Failed to delete organization:", err)
    return NextResponse.json({ error: "Failed to delete organization" }, { status: 500 })
  }
}
