import { getAuthUser } from "@/lib/auth"

/**
 * Authorization for the probation dashboard.
 *
 * Deliberately NOT reusing getPmViewer() from lib/pm-feedback-auth.ts: that
 * grants access to any org admin in any org, which is far wider than "only me".
 * This dashboard holds a personal performance record — the gate is one email.
 *
 * The owner is `PROBATION_OWNER_EMAIL`, a single value and not a list. There is
 * no default and no fallback: this repository is public, so the address of the
 * person being assessed does not belong in it, and an unset variable must deny
 * everyone rather than quietly widen access.
 */

export function getProbationOwnerEmail(): string | null {
  const raw = process.env.PROBATION_OWNER_EMAIL?.trim().toLowerCase()
  return raw || null
}

export function isProbationOwner(email: string | null | undefined): boolean {
  const owner = getProbationOwnerEmail()
  if (!owner || !email) return false
  return email.trim().toLowerCase() === owner
}

/** The logged-in account if it owns the probation record, else null. */
export async function getProbationViewer() {
  const user = await getAuthUser()
  if (!user) return null
  return isProbationOwner(user.email) ? user : null
}
