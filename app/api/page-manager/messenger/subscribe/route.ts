import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { resolveOrgPageAccessToken } from "@/lib/facebook-page-token"
import { normalizeMetaError } from "@/lib/meta-error"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const GRAPH = "https://graph.facebook.com/v25.0"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { page_id } = await request.json()
    if (!page_id) return NextResponse.json({ error: "page_id required" }, { status: 400 })

    const supabase = createAdminClient()
    const pageToken = await resolveOrgPageAccessToken(supabase, ctx.orgId, ctx.user.id, page_id)

    if (!pageToken?.token) {
      return NextResponse.json({ error: "Page token not found. Reconnect Facebook and select this Page again." }, { status: 400 })
    }

    const fields = "messages,messaging_postbacks,message_echoes"
    const params = new URLSearchParams({
      subscribed_fields: fields,
      access_token: pageToken.token,
    })

    const res = await fetch(`${GRAPH}/${page_id}/subscribed_apps`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.error) {
      return NextResponse.json(
        normalizeMetaError(data, "Unable to subscribe Page webhooks.", { pageId: page_id, permission: "pages_manage_metadata" }),
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, subscribed_fields: fields, meta: data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to subscribe Page webhooks." }, { status: 500 })
  }
}
