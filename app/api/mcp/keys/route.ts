import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateMcpApiKey, hashMcpApiKey, keyPrefix } from "@/lib/mcp-keys"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("mcp_api_keys")
      .select("id, name, api_key, api_key_prefix, last_used_at, created_at")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })

    if (error) {
      if (error.code === "42P01") return NextResponse.json({ keys: [] })
      if (error.message?.includes("api_key_prefix") || error.code === "42703") {
        const legacy = await supabase
          .from("mcp_api_keys")
          .select("id, name, api_key, last_used_at, created_at")
          .eq("org_id", ctx.orgId)
          .order("created_at", { ascending: false })
        if (legacy.error) throw legacy.error
        return NextResponse.json({
          keys: (legacy.data || []).map((k: any) => ({
            id: k.id,
            name: k.name,
            api_key_prefix: k.api_key ? String(k.api_key).slice(0, 10) : null,
            last_used_at: k.last_used_at,
            created_at: k.created_at,
          })),
        })
      }
      throw error
    }

    return NextResponse.json({
      keys: (data || []).map((k: any) => ({
        id: k.id,
        name: k.name,
        api_key_prefix: k.api_key_prefix || (k.api_key ? String(k.api_key).slice(0, 10) : null),
        last_used_at: k.last_used_at,
        created_at: k.created_at,
      })),
    })
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

    const plain = generateMcpApiKey()
    const admin = createAdminClient()

    let data: any = null
    let error: any = null
    ;({ data, error } = await admin
      .from("mcp_api_keys")
      .insert({
        org_id: ctx.orgId,
        user_id: ctx.user.id,
        name,
        api_key_hash: hashMcpApiKey(plain),
        api_key_prefix: keyPrefix(plain),
        api_key: null,
      })
      .select("id, name, api_key_prefix, created_at")
      .single())

    if (error && (error.message?.includes("api_key_hash") || error.code === "42703" || error.code === "PGRST204")) {
      ;({ data, error } = await admin
        .from("mcp_api_keys")
        .insert({
          org_id: ctx.orgId,
          user_id: ctx.user.id,
          name,
          api_key: plain,
        })
        .select("id, name, api_key, created_at")
        .single())
      if (error) throw error
      return NextResponse.json({
        key: {
          id: data.id,
          name: data.name,
          api_key_prefix: plain.slice(0, 10),
          created_at: data.created_at,
          api_key: plain,
        },
      }, { status: 201 })
    }

    if (error) throw error

    return NextResponse.json({
      key: {
        id: data.id,
        name: data.name,
        api_key_prefix: data.api_key_prefix,
        created_at: data.created_at,
        api_key: plain,
      },
    }, { status: 201 })
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
