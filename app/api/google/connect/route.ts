import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { encryptSecret } from "@/lib/crypto"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { code } = await request.json()
    if (!code) return NextResponse.json({ error: "code required" }, { status: 400 })

    const clientId     = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
    const redirectUri  = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/google/connect`
      : "postmessage" // postmessage = popup flow, no redirect URI needed

    if (!clientSecret) return NextResponse.json({ error: "GOOGLE_CLIENT_SECRET not configured" }, { status: 500 })

    // Exchange auth code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  "postmessage",
        grant_type:    "authorization_code",
      }),
    })
    const tokens = await tokenRes.json()
    if (!tokenRes.ok || tokens.error) {
      return NextResponse.json({ error: tokens.error_description || tokens.error || "Token exchange failed" }, { status: 400 })
    }

    const { access_token, refresh_token, expires_in } = tokens
    if (!refresh_token) {
      return NextResponse.json({ error: "No refresh_token returned — ensure prompt=consent was used" }, { status: 400 })
    }

    // Get user email from Google
    let email: string | null = null
    try {
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` },
      })
      const userInfo = await userRes.json()
      email = userInfo.email || null
    } catch {}

    const expiryAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()
    const adminDb  = createAdminClient()

    // Upsert — one Google connection per org
    const { error } = await adminDb.from("google_connections").upsert({
      org_id:        ctx.orgId,
      user_id:       ctx.user.id,
      email,
      access_token:  encryptSecret(access_token),
      refresh_token: encryptSecret(refresh_token),
      expiry_at:     expiryAt,
      updated_at:    new Date().toISOString(),
    }, { onConflict: "org_id" })

    if (error) {
      console.error("[google/connect] DB upsert error:", error)
      return NextResponse.json({ error: error.message || "Failed to save connection" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, email })
  } catch (err: any) {
    console.error("[google/connect] error:", err)
    return NextResponse.json({ error: err.message || "Connect failed" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const adminDb = createAdminClient()
    await adminDb.from("google_connections").delete().eq("org_id", ctx.orgId)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
