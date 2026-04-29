import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendInviteEmail } from "@/lib/email"

// List pending invitations for this org
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: orgId } = await params
    const supabase = createAdminClient()

    // Verify caller is admin
    const { data: callerMember } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .single()

    if (!callerMember || callerMember.role !== "admin") {
      return NextResponse.json({ error: "Only admins can view invitations" }, { status: 403 })
    }

    const { data: invitations } = await supabase
      .from("org_invitations")
      .select("id, email, role, created_at, expires_at, accepted_at, token")
      .eq("org_id", orgId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false })

    return NextResponse.json({ invitations: invitations || [] })
  } catch (err) {
    console.error("Failed to fetch invitations:", err)
    return NextResponse.json({ error: "Failed to fetch invitations" }, { status: 500 })
  }
}

// Delete a pending invitation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: orgId } = await params
    const invitationId = request.nextUrl.searchParams.get("invitation_id")
    if (!invitationId) return NextResponse.json({ error: "invitation_id is required" }, { status: 400 })

    const supabase = createAdminClient()

    const { data: callerMember } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .single()

    if (!callerMember || callerMember.role !== "admin") {
      return NextResponse.json({ error: "Only admins can delete invitations" }, { status: 403 })
    }

    await supabase.from("org_invitations").delete().eq("id", invitationId).eq("org_id", orgId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Failed to delete invitation:", err)
    return NextResponse.json({ error: "Failed to delete invitation" }, { status: 500 })
  }
}

// Resend an invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: orgId } = await params
    const { invitation_id } = await request.json()
    if (!invitation_id) return NextResponse.json({ error: "invitation_id is required" }, { status: 400 })

    const supabase = createAdminClient()

    const { data: callerMember } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .single()

    if (!callerMember || callerMember.role !== "admin") {
      return NextResponse.json({ error: "Only admins can resend invitations" }, { status: 403 })
    }

    // Get the invitation and refresh its expiry
    const { data: invitation, error } = await supabase
      .from("org_invitations")
      .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
      .eq("id", invitation_id)
      .eq("org_id", orgId)
      .is("accepted_at", null)
      .select()
      .single()

    if (error || !invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single()

    await sendInviteEmail({
      to: invitation.email,
      orgName: org?.name || "Organization",
      inviterName: user.user_metadata?.full_name || user.email || "Someone",
      token: invitation.token,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Failed to resend invitation:", err)
    return NextResponse.json({ error: "Failed to resend invitation" }, { status: 500 })
  }
}
