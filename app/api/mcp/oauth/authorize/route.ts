import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAuthContext } from "@/lib/auth"
import { randomBytes } from "crypto"

export const dynamic = "force-dynamic"

function generateCode(): string {
  return randomBytes(32).toString("hex")
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { client_id, redirect_uri, code_challenge, code_challenge_method, scope } = body

    if (!client_id || !redirect_uri || !code_challenge) {
      return NextResponse.json({ error: "missing_params", error_description: "client_id, redirect_uri, code_challenge required" }, { status: 400 })
    }

    const code = generateCode()
    const admin = createAdminClient()

    const { error } = await admin.from("mcp_oauth_codes").insert({
      code,
      client_id,
      redirect_uri,
      code_challenge,
      code_challenge_method: code_challenge_method || "S256",
      org_id: ctx.orgId,
      user_id: ctx.user.id,
      scope: scope || "ads:read ads:write",
    })

    if (error && error.code !== "42P01") throw error

    return NextResponse.json({ code })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
