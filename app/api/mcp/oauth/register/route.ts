import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { randomUUID } from "crypto"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { client_name, redirect_uris } = body

    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      return NextResponse.json({ error: "invalid_client_metadata", error_description: "redirect_uris required" }, { status: 400 })
    }

    const clientId = `mcp_${randomUUID().replace(/-/g, "")}`
    const admin = createAdminClient()

    const { error } = await admin
      .from("mcp_oauth_clients")
      .insert({ client_id: clientId, client_name: client_name || "Unknown", redirect_uris })

    if (error && error.code !== "42P01") throw error

    return NextResponse.json(
      {
        client_id: clientId,
        client_name: client_name || "Unknown",
        redirect_uris,
        grant_types: ["authorization_code"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      },
      {
        status: 201,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    )
  } catch (err: any) {
    return NextResponse.json({ error: "server_error", error_description: err.message }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
