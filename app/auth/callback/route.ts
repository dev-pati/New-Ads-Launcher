import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Handles Supabase Auth email confirmation callback
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (code) {
    const supabase = await createClient()
    const { data } = await supabase.auth.exchangeCodeForSession(code)

    // Check if user has an invite_token in metadata and auto-accept
    if (data?.user?.user_metadata?.invite_token) {
      const token = data.user.user_metadata.invite_token
      const adminSupabase = createAdminClient()

      const { data: invitation } = await adminSupabase
        .from("org_invitations")
        .select("id, org_id, role, expires_at, accepted_at")
        .eq("token", token)
        .single()

      if (invitation && !invitation.accepted_at && new Date(invitation.expires_at) > new Date()) {
        // Add user to org
        await adminSupabase.from("org_members").insert({
          org_id: invitation.org_id,
          user_id: data.user.id,
          role: invitation.role,
        })

        // Mark invitation as accepted
        await adminSupabase
          .from("org_invitations")
          .update({ accepted_at: new Date().toISOString() })
          .eq("id", invitation.id)

        // Set active org cookie
        const response = NextResponse.redirect(`${origin}/`)
        response.cookies.set("active_org_id", invitation.org_id, {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
        })
        return response
      }
    }
  }

  return NextResponse.redirect(`${origin}/`)
}
