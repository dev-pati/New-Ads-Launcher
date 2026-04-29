import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendInviteEmail, sendAddedToOrgEmail } from "@/lib/email"

// List org members
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: orgId } = await params
    const adminSupabase = createAdminClient()

    // Verify user is member of this org
    const { data: membership } = await adminSupabase
      .from("org_members")
      .select("id")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 })
    }

    const { data: members } = await adminSupabase
      .from("org_members")
      .select("id, role, joined_at, user_id")
      .eq("org_id", orgId)
      .order("joined_at")

    // Fetch profiles separately
    const userIds = (members || []).map((m: any) => m.user_id)
    const { data: profiles } = await adminSupabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", userIds)

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

    const result = (members || []).map((m: any) => ({
      id: m.id,
      role: m.role,
      joined_at: m.joined_at,
      user: profileMap.get(m.user_id) || { id: m.user_id, full_name: "Unknown" },
    }))

    return NextResponse.json({ members: result })
  } catch (err) {
    console.error("Failed to fetch members:", err)
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
  }
}

// Invite a member by email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: orgId } = await params
    const { email, role } = await request.json()

    if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 })

    const supabase = createAdminClient()

    // Verify caller is admin
    const { data: callerMember } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .single()

    if (!callerMember || callerMember.role !== "admin") {
      return NextResponse.json({ error: "Only admins can invite members" }, { status: 403 })
    }

    const adminSupabase = createAdminClient()

    // Check if user with this email already exists
    const { data: existingUsers } = await adminSupabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find((u) => u.email === email)

    if (existingUser) {
      const { data: existingMember } = await supabase
        .from("org_members")
        .select("id")
        .eq("org_id", orgId)
        .eq("user_id", existingUser.id)
        .single()

      if (existingMember) {
        return NextResponse.json({ error: "User is already a member" }, { status: 400 })
      }

      // Add directly
      await adminSupabase.from("org_members").insert({
        org_id: orgId,
        user_id: existingUser.id,
        role: role || "editor",
        invited_by: user.id,
      })

      // Send notification email
      const { data: org } = await adminSupabase
        .from("organizations")
        .select("name")
        .eq("id", orgId)
        .single()

      try {
        await sendAddedToOrgEmail({
          to: email,
          orgName: org?.name || "Organization",
          inviterName: user.user_metadata?.full_name || user.email || "Someone",
        })
      } catch (emailErr) {
        console.error("Failed to send notification email:", emailErr)
      }

      return NextResponse.json({ success: true, added: true })
    }

    // Create invitation
    const { data: invitation, error: inviteError } = await adminSupabase
      .from("org_invitations")
      .upsert(
        {
          org_id: orgId,
          email,
          role: role || "editor",
          invited_by: user.id,
        },
        { onConflict: "org_id,email" }
      )
      .select()
      .single()

    if (inviteError) {
      console.error("Failed to create invitation:", inviteError)
      return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 })
    }

    // Get org name for email
    const { data: org } = await adminSupabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single()

    // Send invite email via Resend
    try {
      await sendInviteEmail({
        to: email,
        orgName: org?.name || "Organization",
        inviterName: user.user_metadata?.full_name || user.email || "Someone",
        token: invitation.token,
      })
    } catch (emailErr) {
      console.error("Failed to send invite email:", emailErr)
    }

    return NextResponse.json({ success: true, invitation })
  } catch (err) {
    console.error("Failed to invite member:", err)
    return NextResponse.json({ error: "Failed to invite member" }, { status: 500 })
  }
}

// Remove a member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: orgId } = await params
    const memberId = request.nextUrl.searchParams.get("member_id")

    if (!memberId) return NextResponse.json({ error: "member_id is required" }, { status: 400 })

    const supabase = createAdminClient()

    const { data: callerMember } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .single()

    if (!callerMember || callerMember.role !== "admin") {
      return NextResponse.json({ error: "Only admins can remove members" }, { status: 403 })
    }

    const adminSupabase = createAdminClient()
    await adminSupabase.from("org_members").delete().eq("id", memberId).eq("org_id", orgId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Failed to remove member:", err)
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
  }
}
