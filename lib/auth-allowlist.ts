import { createAdminClient } from "./supabase/admin"

const ALLOWED_DOMAINS = ["patigroup.com"]
const ALLOWED_EMAILS = [
  "raymond.nguyen1707@gmail.com",
  "bella.nguyen.tpf@gmail.com",
]

export async function isEmailAllowed(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase()
  const domain = normalized.split("@")[1]

  if (ALLOWED_DOMAINS.includes(domain)) {
    return true
  }

  if (ALLOWED_EMAILS.includes(normalized)) {
    return true
  }

  // Check if account already exists in database
  const db = createAdminClient()
  const { data } = await db
    .from("accounts")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle()

  return !!data
}

/**
 * A `@patigroup.com` address is a colleague, not a stranger: create the account and put
 * it in the default workspace as `launcher` so a first sign-in needs no admin action.
 * Idempotent - an existing account or membership is left exactly as it is, so this can
 * never silently reset someone who was already promoted.
 */
const DEFAULT_ORG_SLUG = process.env.DEFAULT_ORG_SLUG || "launch-ads"
const DEFAULT_ORG_ROLE = "launcher"

export async function provisionCompanyAccount(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase()
  if (!ALLOWED_DOMAINS.includes(normalized.split("@")[1])) return

  const db = createAdminClient()

  const { data: existing } = await db
    .from("accounts")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle()

  let accountId = existing?.id as string | undefined

  if (!accountId) {
    const fullName = normalized.split("@")[0]
    const { data: created, error } = await db
      .from("accounts")
      .insert({
        email: normalized,
        full_name: fullName,
        raw_user_meta_data: { full_name: fullName, provisioned_by: "domain_allowlist" },
        email_confirmed_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (error || !created) {
      console.error("[allowlist] account provisioning failed:", error)
      return
    }
    accountId = created.id
    await db.from("profiles").insert({ id: accountId, full_name: fullName })
  }

  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("slug", DEFAULT_ORG_SLUG)
    .maybeSingle()

  if (!org) {
    console.error(`[allowlist] default org "${DEFAULT_ORG_SLUG}" not found; account created without membership`)
    return
  }

  const { data: membership } = await db
    .from("org_members")
    .select("id")
    .eq("org_id", org.id)
    .eq("user_id", accountId)
    .maybeSingle()

  if (membership) return

  const { error: memberError } = await db
    .from("org_members")
    .insert({ org_id: org.id, user_id: accountId, role: DEFAULT_ORG_ROLE })

  if (memberError) console.error("[allowlist] membership provisioning failed:", memberError)
}
