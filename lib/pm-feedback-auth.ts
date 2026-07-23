import { getAuthUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

// Allowlist of PM emails who can view the cross-org feedback dashboard at /pm-feedback.
// Sourced from PM_FEEDBACK_EMAILS env (comma-separated). Falls back to a single
// default PM email so it works locally without env wiring.
const DEFAULT_PM_EMAILS = ["raymond.nguyen1707@gmail.com", "seth@patigroup.com"]

export function getPmEmails(): string[] {
  const raw = process.env.PM_FEEDBACK_EMAILS
  if (!raw) return DEFAULT_PM_EMAILS
  const list = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return list.length ? list : DEFAULT_PM_EMAILS
}

export function isPmEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getPmEmails().includes(email.trim().toLowerCase())
}

/** True when the user is "admin" in at least one org (any org, cross-org view). */
async function isOrgAdminAnywhere(userId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1)
  return !!data && data.length > 0
}

/** Returns the logged-in account if they can view the cross-org feedback dashboard, else null. */
export async function getPmViewer() {
  const user = await getAuthUser()
  if (!user) return null
  if (isPmEmail(user.email)) return user
  if (await isOrgAdminAnywhere(user.id)) return user
  return null
}
