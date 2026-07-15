import { createAdminClient } from "@/lib/supabase/admin"
import { decryptSecret } from "@/lib/crypto"

// NOTE: these run server-side only, and callers pass ctx.orgId after
// getAuthContext() has already verified the user's membership in that org.
// We read with the admin client (bypassing RLS) to match how the Settings
// route (app/api/settings/ai-keys) writes/reads this table — the RLS-scoped
// client returns no row under this app's custom-JWT auth, so the org key
// would never be found and every AI feature would fall back to the (empty)
// process.env key. Authorization is enforced at the app layer, not RLS here.

export async function getGeminiApiKey(orgId: string): Promise<string | null> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from("org_ai_keys")
      .select("gemini_api_key")
      .eq("org_id", orgId)
      .single()

    const key = decryptSecret(data?.gemini_api_key)?.trim()
    if (key) return key
  } catch { /* fallthrough */ }

  return process.env.GEMINI_API_KEY ?? null
}

export async function getOpenAIApiKey(orgId: string): Promise<string | null> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from("org_ai_keys")
      .select("openai_api_key")
      .eq("org_id", orgId)
      .single()

    const key = decryptSecret(data?.openai_api_key)?.trim()
    if (key) return key
  } catch { /* fallthrough */ }

  return process.env.OPENAI_API_KEY ?? null
}
