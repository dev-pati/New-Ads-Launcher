import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

/**
 * Get the authenticated Supabase user.
 */
export async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/**
 * Get auth context: user + active org_id.
 * Reads org_id from cookie and verifies membership.
 */
export async function getAuthContext() {
  const user = await getAuthUser()
  if (!user) return null

  const cookieStore = await cookies()
  const orgIdFromCookie = cookieStore.get("active_org_id")?.value

  const supabase = await createClient()

  if (orgIdFromCookie) {
    // Verify user is member of this org
    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id, role")
      .eq("org_id", orgIdFromCookie)
      .eq("user_id", user.id)
      .single()

    if (membership) {
      return { user, orgId: membership.org_id, role: membership.role as string }
    }
  }

  // Fallback: get first org
  const { data: firstMembership } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single()

  if (firstMembership) {
    return { user, orgId: firstMembership.org_id, role: firstMembership.role as string }
  }

  return null
}

/**
 * Get the Facebook access token for the org.
 */
export async function getFacebookConnection(orgId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("facebook_connections")
    .select("id, fb_user_id, fb_user_name, fb_picture_url, access_token, token_expires_at")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .single()

  return data
}
