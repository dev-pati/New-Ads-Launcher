import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: "Login required" }, { status: 401 })
    }

    const token = request.nextUrl.searchParams.get("token")
    if (!token) {
      return NextResponse.json({ error: "Invalid invitation" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Find invitation
    const { data: invitation } = await supabase
      .from("org_invitations")
      .select("id, org_id, email, role, expires_at, accepted_at")
      .eq("token", token)
      .single()

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
    }

    if (invitation.accepted_at) {
      return NextResponse.json({ error: "Invitation already accepted" }, { status: 400 })
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invitation expired" }, { status: 400 })
    }

    // Verify the logged-in user's email matches the invited email
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { error: "This invitation was sent to a different email address" },
        { status: 403 }
      )
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from("org_members")
      .select("id")
      .eq("org_id", invitation.org_id)
      .eq("user_id", user.id)
      .single()

    if (existing) {
      // Get org name
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", invitation.org_id)
        .single()

      return NextResponse.json({
        success: true,
        orgId: invitation.org_id,
        orgName: org?.name,
        message: "Already a member",
      })
    }

    // Add user to org
    await supabase.from("org_members").insert({
      org_id: invitation.org_id,
      user_id: user.id,
      role: invitation.role,
      invited_by: null,
    })

    // Mark invitation as accepted
    await supabase
      .from("org_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id)

    // Get org name
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", invitation.org_id)
      .single()

    return NextResponse.json({
      success: true,
      orgId: invitation.org_id,
      orgName: org?.name,
    })
  } catch (err) {
    console.error("Failed to accept invitation:", err)
    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 })
  }
}
