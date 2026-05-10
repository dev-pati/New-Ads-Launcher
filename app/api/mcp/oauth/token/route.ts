import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createHash, randomBytes } from "crypto"

export const dynamic = "force-dynamic"

function base64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

function verifySHA256(verifier: string, challenge: string): boolean {
  const hash = createHash("sha256").update(verifier).digest()
  return base64urlEncode(hash) === challenge
}

function generateToken(): string {
  return `mcp_${base64urlEncode(randomBytes(32))}`
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "no-store",
}

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, string>

    const ct = request.headers.get("content-type") || ""
    if (ct.includes("application/x-www-form-urlencoded")) {
      const text = await request.text()
      body = Object.fromEntries(new URLSearchParams(text))
    } else {
      body = await request.json()
    }

    const { grant_type, code, code_verifier, redirect_uri } = body

    if (grant_type !== "authorization_code") {
      return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400, headers: CORS })
    }

    if (!code || !code_verifier || !redirect_uri) {
      return NextResponse.json({ error: "invalid_request", error_description: "code, code_verifier, redirect_uri required" }, { status: 400, headers: CORS })
    }

    const admin = createAdminClient()

    const { data: codeRow, error: codeErr } = await admin
      .from("mcp_oauth_codes")
      .select("*")
      .eq("code", code)
      .eq("used", false)
      .single()

    if (codeErr || !codeRow) {
      return NextResponse.json({ error: "invalid_grant", error_description: "Code not found or already used" }, { status: 400, headers: CORS })
    }

    if (new Date(codeRow.expires_at) < new Date()) {
      return NextResponse.json({ error: "invalid_grant", error_description: "Code expired" }, { status: 400, headers: CORS })
    }

    if (codeRow.redirect_uri !== redirect_uri) {
      return NextResponse.json({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, { status: 400, headers: CORS })
    }

    if (!verifySHA256(code_verifier, codeRow.code_challenge)) {
      return NextResponse.json({ error: "invalid_grant", error_description: "PKCE verification failed" }, { status: 400, headers: CORS })
    }

    // Mark code as used
    await admin.from("mcp_oauth_codes").update({ used: true }).eq("id", codeRow.id)

    const accessToken = generateToken()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const { error: tokenErr } = await admin.from("mcp_oauth_tokens").insert({
      access_token: accessToken,
      client_id: codeRow.client_id,
      org_id: codeRow.org_id,
      user_id: codeRow.user_id,
      scope: codeRow.scope,
      expires_at: expiresAt.toISOString(),
    })

    if (tokenErr) throw tokenErr

    return NextResponse.json(
      {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 30 * 24 * 60 * 60,
        scope: codeRow.scope,
      },
      { headers: CORS }
    )
  } catch (err: any) {
    return NextResponse.json({ error: "server_error", error_description: err.message }, { status: 500, headers: CORS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS })
}
