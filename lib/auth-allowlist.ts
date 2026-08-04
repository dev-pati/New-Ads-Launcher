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
