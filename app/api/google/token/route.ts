import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

// Returns a valid Google access token for the org.
// Auto-refreshes using stored refresh_token if the access token has expired.
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const adminDb = createAdminClient()
    const { data: conn } = await adminDb
      .from("google_connections")
      .select("access_token, refresh_token, expiry_at, email")
      .eq("org_id", ctx.orgId)
      .maybeSingle()

    if (!conn) return NextResponse.json({ connected: false })

    // Check if access token is still valid (with 60s buffer)
    const expired = !conn.expiry_at || new Date(conn.expiry_at).getTime() < Date.now() + 60_000

    if (!expired) {
      return NextResponse.json({ connected: true, token: conn.access_token, email: conn.email })
    }

    // Refresh the access token
    const clientId     = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!

    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: conn.refresh_token,
        client_id:     clientId,
        client_secret: clientSecret,
        grant_type:    "refresh_token",
      }),
    })
    const refreshed = await refreshRes.json()

    if (!refreshRes.ok || refreshed.error) {
      // Refresh token revoked — delete connection so user reconnects
      await adminDb.from("google_connections").delete().eq("org_id", ctx.orgId)
      return NextResponse.json({ connected: false, error: "Token expired — please reconnect" })
    }

    const newExpiry = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString()

    await adminDb.from("google_connections")
      .update({ access_token: refreshed.access_token, expiry_at: newExpiry, updated_at: new Date().toISOString() })
      .eq("org_id", ctx.orgId)

    return NextResponse.json({ connected: true, token: refreshed.access_token, email: conn.email })
  } catch (err: any) {
    console.error("[google/token] error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
