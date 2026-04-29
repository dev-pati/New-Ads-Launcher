import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

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
