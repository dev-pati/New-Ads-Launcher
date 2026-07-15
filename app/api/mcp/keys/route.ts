import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

function generateApiKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let key = "al_"
  for (let i = 0; i < 40; i++) {
    key += chars[Math.floor(Math.random() * chars.length)]
  }
  return key
}

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("mcp_api_keys")
      .select("id, name, api_key, last_used_at, created_at")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })

    if (error) {
      if (error.code === "42P01") return NextResponse.json({ keys: [] })
      throw error
    }

    return NextResponse.json({ keys: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const name = body.name || "Default"

    const apiKey = generateApiKey()
    const admin = createAdminClient()

    const { data, error } = await admin
      .from("mcp_api_keys")
      .insert({
        org_id: ctx.orgId,
        user_id: ctx.user.id,
        api_key: apiKey,
        name,
      })
      .select()
      .single()

    if (error) throw error
    // Return the plaintext key exactly once for the caller to copy.
    return NextResponse.json({ key: { ...data, api_key: apiKey } }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const supabase = createAdminClient()
    const { error } = await supabase
      .from("mcp_api_keys")
      .delete()
      .eq("id", id)
      .eq("org_id", ctx.orgId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
