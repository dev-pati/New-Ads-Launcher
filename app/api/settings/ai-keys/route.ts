import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, requireRole } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createAdminClient()
  const { data } = await supabase
    .from("org_ai_keys")
    .select("gemini_api_key, openai_api_key")
    .eq("org_id", ctx.orgId)
    .single()

  const mask = (key: string | null | undefined) =>
    key && key.length > 8 ? `${key.slice(0, 4)}••••${key.slice(-4)}` : key ? "••••" : null

  return NextResponse.json({
    gemini_api_key: mask(data?.gemini_api_key),
    openai_api_key: mask(data?.openai_api_key),
  })
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const denied = requireRole(ctx)
  if (denied) return denied

  const body = await request.json()
  const { gemini_api_key, openai_api_key } = body

  // Don't overwrite with a masked value if the user just submitted the placeholder back
  const cleanGemini = gemini_api_key?.includes("••••") ? undefined : gemini_api_key?.trim()
  const cleanOpenAI = openai_api_key?.includes("••••") ? undefined : openai_api_key?.trim()

  const supabase = createAdminClient()

  // If both are masked, there is nothing to update
  if (cleanGemini === undefined && cleanOpenAI === undefined) {
    return NextResponse.json({ ok: true })
  }

  // To do a partial update on upsert, we'd need to fetch the existing row first.
  // Actually, since the UI probably submits both, if one is unchanged (masked) we should fetch the existing row to preserve it.
  const { data: existing } = await supabase
    .from("org_ai_keys")
    .select("gemini_api_key, openai_api_key")
    .eq("org_id", ctx.orgId)
    .single()

  const finalGemini = cleanGemini !== undefined ? (cleanGemini || null) : existing?.gemini_api_key
  const finalOpenAI = cleanOpenAI !== undefined ? (cleanOpenAI || null) : existing?.openai_api_key

  const { error } = await supabase
    .from("org_ai_keys")
    .upsert(
      {
        org_id: ctx.orgId,
        gemini_api_key: finalGemini,
        openai_api_key: finalOpenAI,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
