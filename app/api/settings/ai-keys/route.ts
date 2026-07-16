import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { decryptSecret, encryptSecret, isEncrypted } from "@/lib/crypto"

function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null
  const plain = decryptSecret(value)
  if (!plain) return null
  if (plain.length <= 4) return "••••"
  return `••••${plain.slice(-4)}`
}

/** GET: never returns full secrets — only presence + last4 mask. */
export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createAdminClient()
  const { data } = await supabase
    .from("org_ai_keys")
    .select("gemini_api_key, openai_api_key")
    .eq("org_id", ctx.orgId)
    .single()

  const gemini = decryptSecret(data?.gemini_api_key)
  const openai = decryptSecret(data?.openai_api_key)

  return NextResponse.json({
    has_gemini: Boolean(gemini?.trim()),
    has_openai: Boolean(openai?.trim()),
    gemini_api_key_masked: maskSecret(data?.gemini_api_key),
    openai_api_key_masked: maskSecret(data?.openai_api_key),
  })
}

/**
 * POST: set / clear org AI keys.
 * - omit field → keep existing
 * - null / "" → clear
 * - non-empty string → replace (encrypt at rest)
 * Never accepts a masked "••••xxxx" value as a real key.
 */
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const hasGemField = Object.prototype.hasOwnProperty.call(body, "gemini_api_key")
  const hasOaiField = Object.prototype.hasOwnProperty.call(body, "openai_api_key")

  if (!hasGemField && !hasOaiField) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: existing } = await supabase
    .from("org_ai_keys")
    .select("gemini_api_key, openai_api_key")
    .eq("org_id", ctx.orgId)
    .maybeSingle()

  function resolveField(
    provided: boolean,
    raw: unknown,
    previous: string | null | undefined
  ): string | null {
    if (!provided) return previous ?? null
    if (raw == null || raw === "") return null
    const s = String(raw).trim()
    if (!s) return null
    // Reject masked values accidentally re-submitted from UI
    if (s.startsWith("••••") || s.startsWith("****")) {
      return previous ?? null
    }
    return isEncrypted(s) ? s : encryptSecret(s)
  }

  const next = {
    org_id: ctx.orgId,
    gemini_api_key: resolveField(hasGemField, body.gemini_api_key, existing?.gemini_api_key),
    openai_api_key: resolveField(hasOaiField, body.openai_api_key, existing?.openai_api_key),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from("org_ai_keys")
    .upsert(next, { onConflict: "org_id" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    ok: true,
    has_gemini: Boolean(next.gemini_api_key),
    has_openai: Boolean(next.openai_api_key),
  })
}
