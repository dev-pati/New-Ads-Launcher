import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
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
    const { data: page } = await supabase
      .from("pages")
      .select("fb_page_id, page_access_token")
      .eq("org_id", ctx.orgId)
      .eq("fb_page_id", page_id)
      .maybeSingle()

    if (!page?.page_access_token) {
      return NextResponse.json({ error: "Page token not found. Reconnect Facebook and select this Page again." }, { status: 400 })
    }

    const fields = "messages,messaging_postbacks"
    const res = await fetch(`${GRAPH}/${page_id}/subscribed_apps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscribed_fields: fields,
        access_token: page.page_access_token,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.error) {
      return NextResponse.json({ error: data.error?.message || "Unable to subscribe Page webhooks." }, { status: 400 })
    }

    return NextResponse.json({ success: true, subscribed_fields: fields, meta: data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to subscribe Page webhooks." }, { status: 500 })
  }
}
