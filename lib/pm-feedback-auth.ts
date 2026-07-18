import { getAuthUser } from "@/lib/auth"

// Allowlist of PM emails who can view the cross-org feedback dashboard at /pm-feedback.
// Sourced from PM_FEEDBACK_EMAILS env (comma-separated). Falls back to a single
// default PM email so it works locally without env wiring.
const DEFAULT_PM_EMAILS = ["raymond.nguyen1707@gmail.com"]

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

/** Returns the logged-in account if they are in the PM allowlist, else null. */
export async function getPmViewer() {
  const user = await getAuthUser()
  if (!user || !isPmEmail(user.email)) return null
  return user
}
