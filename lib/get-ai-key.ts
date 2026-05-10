import { createClient } from "@/lib/supabase/server"

export async function getGeminiApiKey(orgId: string): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from("org_ai_keys")
      .select("gemini_api_key")
      .eq("org_id", orgId)
      .single()

    if (data?.gemini_api_key?.trim()) return data.gemini_api_key.trim()
  } catch { /* fallthrough */ }

  return process.env.GEMINI_API_KEY ?? null
}
