import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendInviteEmail, sendAddedToOrgEmail } from "@/lib/email"
import { emitAndLog } from "@/lib/notifications/emit"
import { conflictResponse, readExpectedVersion, updateWithVersion } from "@/lib/optimistic-update"

type MemberRow = {
  id: string
  role: string
  joined_at: string
  user_id: string
}

type ProfileRow = {
  id: string
  full_name: string | null
  avatar_url: string | null
}

type AccountRow = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at?: string
  last_sign_in_at?: string | null
  raw_user_meta_data?: {
    provider?: string
    [key: string]: unknown
  } | null
}

function isLarkAccount(account: AccountRow) {
  return account.raw_user_meta_data?.provider === "lark"
}

// List org members
export async function GET(
  request: NextRequest,
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

    if (request.nextUrl.searchParams.get("available") === "true") {
      const { data: callerMember } = await adminSupabase
        .from("org_members")
        .select("role")
        .eq("org_id", orgId)
        .eq("user_id", user.id)
        .single()

      if (!callerMember || callerMember.role !== "admin") {
        return NextResponse.json({ error: "Only admins can view available accounts" }, { status: 403 })
      }

      const { data: existingMembers } = await adminSupabase
        .from("org_members")
        .select("user_id")
        .eq("org_id", orgId)

      const memberIds = new Set(
        ((existingMembers || []) as Array<{ user_id: string }>).map((m) => m.user_id)
      )

      const source = request.nextUrl.searchParams.get("source")
      const { data: accounts, error: accountsError } = await adminSupabase
        .from("accounts")
        .select("id, email, full_name, avatar_url, created_at, last_sign_in_at, raw_user_meta_data")
        .is("disabled_at", null)
        .order("email")

      if (accountsError) {
        console.error("Failed to fetch available accounts:", accountsError)
        return NextResponse.json({ error: "Failed to fetch available accounts" }, { status: 500 })
      }

      const availableAccounts = (accounts || [])
        .filter((account: AccountRow) => !memberIds.has(account.id))
        .filter((account: AccountRow) => source === "lark_company" ? isLarkAccount(account) : true)
        .map((account: AccountRow) => ({
          id: account.id,
          email: account.email,
          full_name: account.full_name,
          avatar_url: account.avatar_url,
          created_at: account.created_at,
          last_sign_in_at: account.last_sign_in_at,
          provider: account.raw_user_meta_data?.provider || null,
        }))

      return NextResponse.json({ accounts: availableAccounts })
    }

    const { data: members } = await adminSupabase
      .from("org_members")
      .select("id, role, joined_at, user_id")
      .eq("org_id", orgId)
      .order("joined_at")

    const memberRows = (members || []) as MemberRow[]
    const userIds = memberRows.map((m) => m.user_id)

    const [{ data: profiles }, { data: accountAvatars }] = await Promise.all([
      adminSupabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds),
      adminSupabase.from("accounts").select("id, avatar_url").in("id", userIds),
    ])

const accountAvatarMap = new Map(
      ((accountAvatars || []) as Array<{ id: string; avatar_url: string | null }>).map((a) => [a.id, a.avatar_url])
    )

    const profileMap = new Map(
      ((profiles || []) as ProfileRow[]).map((p) => [p.id, {
        ...p,
        avatar_url: p.avatar_url || accountAvatarMap.get(p.id) || null,
      }])
    )

    const result = memberRows.map((m) => ({
      id: m.id,
      role: m.role,
      joined_at: m.joined_at,
      user: profileMap.get(m.user_id) || { id: m.user_id, full_name: "Unknown", avatar_url: accountAvatarMap.get(m.user_id) || null },
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
    const { email, role, user_id: userId } = await request.json()

    const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!userId && (!trimmedEmail || !emailRegex.test(trimmedEmail))) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }

    const VALID_ROLES = ["admin", "editor", "launcher", "uploader", "analyst", "commenter"]
    const sanitizedRole: string = VALID_ROLES.includes(role) ? role : "editor"

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

    // Check custom-auth accounts before falling back to an email invitation.
    let existingUser: AccountRow | null = null
    if (userId) {
      const { data } = await adminSupabase
        .from("accounts")
        .select("id, email, full_name, avatar_url")
        .eq("id", userId)
        .is("disabled_at", null)
        .maybeSingle()
      existingUser = data
    } else {
      const { data } = await adminSupabase
        .from("accounts")
        .select("id, email, full_name, avatar_url")
        .ilike("email", trimmedEmail)
        .is("disabled_at", null)
        .maybeSingle()
      existingUser = data
    }

    if (userId && !existingUser) {
      return NextResponse.json({ error: "User account not found" }, { status: 404 })
    }

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
        role: sanitizedRole,
        invited_by: user.id,
      })

      await adminSupabase
        .from("profiles")
        .upsert({
          id: existingUser.id,
          full_name: existingUser.full_name,
          avatar_url: existingUser.avatar_url,
        })

      // Send notification email
      const { data: org } = await adminSupabase
        .from("organizations")
        .select("name")
        .eq("id", orgId)
        .single()

      try {
        await sendAddedToOrgEmail({
          to: existingUser.email,
          orgName: org?.name || "Organization",
          inviterName: user.user_metadata?.full_name || user.email || "Someone",
        })
      } catch (emailErr) {
        console.error("Failed to send notification email:", emailErr)
      }

      const inviterName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Someone"
      // The actor is the inviter, not the invitee: the invitee did not do anything.
      // Getting this backwards also suppressed the notification for the one person who
      // most needs it, because the emitter never notifies the actor.
      await emitAndLog("orgs.members.add", {
        orgId,
        actorId: user.id,
        actorName: inviterName,
        type: "member.joined",
        action: "joined",
        objectType: "member",
        objectId: existingUser.id,
        objectName: existingUser.full_name || existingUser.email,
        body: `${existingUser.email} was added to the workspace as ${sanitizedRole}.`,
        link: "/settings",
        dedupeKey: `member.joined:${orgId}:${existingUser.id}`,
        source: "orgs.members.add",
      })

      return NextResponse.json({ success: true, added: true })
    }

    // Create invitation
    const { data: invitation, error: inviteError } = await adminSupabase
      .from("org_invitations")
      .upsert(
        {
          org_id: orgId,
          email: trimmedEmail,
          role: sanitizedRole,
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

    // Send invite email via Resend — surface delivery errors so the user knows
    let emailError: string | null = null
    try {
      await sendInviteEmail({
        to: trimmedEmail,
        orgName: org?.name || "Organization",
        inviterName: user.user_metadata?.full_name || user.email || "Someone",
        token: invitation.token,
      })
    } catch (emailErr: unknown) {
      emailError = emailErr instanceof Error ? emailErr.message : "Failed to send email"
    }

    return NextResponse.json({
      success: true,
      invitation,
      ...(emailError && { emailWarning: `Invitation created but email delivery failed: ${emailError}` }),
    })
  } catch (err) {
    console.error("Failed to invite member:", err)
    return NextResponse.json({ error: "Failed to invite member" }, { status: 500 })
  }
}

// Update a member's role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: orgId } = await params
    const body = await request.json()
    const { member_id: memberId, role } = body

    if (!memberId) return NextResponse.json({ error: "member_id is required" }, { status: 400 })

    const expectedVersion = readExpectedVersion(body)
    if (expectedVersion === "invalid") {
      return NextResponse.json({ error: "Invalid expected_version" }, { status: 400 })
    }

    const VALID_ROLES = ["admin", "editor", "launcher", "uploader", "analyst", "commenter"]
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: callerMember } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .single()

    if (!callerMember || callerMember.role !== "admin") {
      return NextResponse.json({ error: "Only admins can change roles" }, { status: 403 })
    }

    // An admin must not edit their own role: self-demotion can leave an org with no
    // admin and cannot be undone without another admin. Everyone else reaches a higher
    // role through a request, never by editing the selector.
    const { data: targetMember } = await supabase
      .from("org_members")
      .select("user_id")
      .eq("id", memberId)
      .eq("org_id", orgId)
      .maybeSingle()

    if (targetMember?.user_id === user.id) {
      return NextResponse.json(
        { error: "You cannot change your own role. Ask another admin." },
        { status: 403 }
      )
    }

    const actorName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Someone"
    const outcome = await updateWithVersion<{ id: string; user_id: string; role: string }>({
      db: supabase,
      table: "org_members",
      id: memberId,
      orgId,
      expectedVersion,
      updates: { role },
      actorId: user.id,
    })

    if (outcome.ok === false) {
      if (outcome.kind === "not_found") {
        return NextResponse.json({ error: "Member not found" }, { status: 404 })
      }
      if (outcome.kind === "conflict") return conflictResponse(outcome.conflict)
      return NextResponse.json({ error: outcome.message }, { status: 500 })
    }

    if (outcome.changes.length > 0) {
      const { data: target } = await supabase
        .from("accounts")
        .select("full_name, email")
        .eq("id", outcome.row.user_id)
        .maybeSingle()
      const targetName = target?.full_name || target?.email || "a member"

      // A role change decides what someone is allowed to do next — including whether
      // they can still launch. Everyone in the org sees it, and the affected member
      // sees it whether or not their role would normally receive ops notifications.
      await emitAndLog("orgs.members.role", {
        orgId,
        actorId: user.id,
        actorName,
        type: "member.role_changed",
        action: "updated",
        objectType: "member",
        objectId: outcome.row.user_id,
        objectName: targetName,
        changes: outcome.changes,
        alsoUserIds: [outcome.row.user_id],
        link: "/settings",
        source: "orgs.members.role",
      })
    }

    return NextResponse.json({ success: true, degraded: outcome.degraded })
  } catch (err) {
    console.error("Failed to update member role:", err)
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 })
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
