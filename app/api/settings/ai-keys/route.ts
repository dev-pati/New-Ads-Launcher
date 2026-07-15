import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { decryptSecret, encryptSecret, isEncrypted } from "@/lib/crypto"

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createAdminClient()
  const { data } = await supabase
    .from("org_ai_keys")
    .select("gemini_api_key, openai_api_key")
    .eq("org_id", ctx.orgId)
    .single()

  return NextResponse.json({
    gemini_api_key: decryptSecret(data?.gemini_api_key) ?? null,
    openai_api_key: decryptSecret(data?.openai_api_key) ?? null,
  })
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { gemini_api_key, openai_api_key } = body

  const gem = gemini_api_key?.trim() || null
  const oai = openai_api_key?.trim() || null

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("org_ai_keys")
    .upsert(
      {
        org_id: ctx.orgId,
        gemini_api_key: gem ? (isEncrypted(gem) ? gem : encryptSecret(gem)) : null,
        openai_api_key: oai ? (isEncrypted(oai) ? oai : encryptSecret(oai)) : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
