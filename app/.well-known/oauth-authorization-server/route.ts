import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function getBase() {
  const raw = process.env.NEXT_PUBLIC_APP_URL || "https://www.sonkieu.site"
  const trimmed = raw.replace(/\/$/, "")
  // Force https only for non-localhost (OAuth requires https in production)
  if (!trimmed.includes("localhost") && !trimmed.includes("127.0.0.1")) {
    return trimmed.replace(/^http:\/\//, "https://")
  }
  return trimmed
}

export async function GET() {
  const base = getBase()
  return NextResponse.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/mcp/authorize`,
      token_endpoint: `${base}/api/mcp/oauth/token`,
      registration_endpoint: `${base}/api/mcp/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["ads:read", "ads:write"],
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    }
  )
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  })
}
