import { NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// GET /api/meta/ad-accounts
// Returns the org's connected Meta ad accounts.
// Primary source: ad_accounts table (synced by cron).
// Fallback: Meta Graph API /me/adaccounts when table is empty but FB is connected.
export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const db = createAdminClient()
    const { data, error } = await db
      .from("ad_accounts")
      .select("id, fb_ad_account_id, name, currency, account_status, is_active")
      .eq("org_id", ctx.orgId)
      .order("name", { ascending: true })

    if (error) throw error

    if (data && data.length > 0) {
      return NextResponse.json({ accounts: data, source: "db" })
    }

    // Table is empty — fallback: fetch directly from Meta Graph API
    const conn = await getFacebookConnection(ctx.orgId)
    if (!conn?.access_token) {
      return NextResponse.json({ accounts: [], connected: false })
    }

    const GRAPH = "https://graph.facebook.com/v25.0"
    const res = await fetch(
      `${GRAPH}/me/adaccounts?fields=id,account_id,name,currency,account_status&limit=200&access_token=${conn.access_token}`
    )

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      console.error("[meta/ad-accounts] Graph API error:", errBody)
      return NextResponse.json({ accounts: [], connected: true, error: errBody?.error?.message })
    }

    const graphData = await res.json()
    const accounts = (graphData.data ?? []).map((a: any) => ({
      id: a.id,
      fb_ad_account_id: a.id,          // "act_xxx" format
      name: a.name,
      currency: a.currency,
      account_status: a.account_status,
      is_active: a.account_status === 1,
    }))

    return NextResponse.json({ accounts, connected: true, source: "graph" })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
