import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAuthContext, requireRole } from "@/lib/auth"
import { randomUUID } from "crypto"

export const dynamic = "force-dynamic"

const ADMIN_ROLES = new Set(["admin", "owner"])
const MAX_REDIRECT_URIS = 10

/**
 * Validate a single redirect_uri. Allows:
 *  - loopback (http://localhost / http://127.0.0.1 / http://[::1]) on any port — MCP local clients
 *  - any https:// URL
 * Rejects: non-absolute, http:// on non-loopback hosts (would leak the auth code), javascript:, file:, etc.
 */
function isValidRedirectUri(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  const isLoopback =
    u.hostname === "localhost" ||
    u.hostname === "127.0.0.1" ||
    u.hostname === "[::1]"
  if (u.protocol === "https:") return true
  if (u.protocol === "http:" && isLoopback) return true
  return false
}

export async function POST(request: NextRequest) {
  try {
    // Gate dynamic client registration: only org admins/owners may register an MCP client.
    // TD-10: this endpoint was previously open (no auth) and allowed anyone to mint a client_id.
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const forbidden = requireRole(ctx, ADMIN_ROLES)
    if (forbidden) return forbidden

    const body = await request.json()
    const { client_name, redirect_uris } = body

    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      return NextResponse.json({ error: "invalid_client_metadata", error_description: "redirect_uris required" }, { status: 400 })
    }
    if (redirect_uris.length > MAX_REDIRECT_URIS) {
      return NextResponse.json({ error: "invalid_client_metadata", error_description: `Too many redirect_uris (max ${MAX_REDIRECT_URIS})` }, { status: 400 })
    }
    const invalid = redirect_uris.find((u: unknown) => typeof u !== "string" || !isValidRedirectUri(u as string))
    if (invalid) {
      return NextResponse.json({ error: "invalid_redirect_uri", error_description: "redirect_uri must be https or a loopback http URL" }, { status: 400 })
    }

    const clientId = `mcp_${randomUUID().replace(/-/g, "")}`
    const admin = createAdminClient()

    const { error } = await admin
      .from("mcp_oauth_clients")
      .insert({ client_id: clientId, client_name: client_name || "Unknown", redirect_uris, org_id: ctx.orgId })

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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "server_error", error_description: message }, { status: 500 })
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
