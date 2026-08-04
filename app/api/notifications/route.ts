import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LEGACY_COLUMNS = "id, type, title, body, link, actor_name, is_read, created_at"
const V2_COLUMNS = `${LEGACY_COLUMNS}, object_type, object_id, object_name, action, changes, read_at`

/** The v2 columns may not be applied yet — 20260803_notifications_v2.sql needs sign-off. */
function isSchemaGap(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === "42703" || err.code === "PGRST204") return true
  return /column .* does not exist|could not find the .* column/i.test(err.message || "")
}

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const db = createAdminClient()
    // Admin client bypasses RLS, so org and user are filtered explicitly. Both, not
    // one: a user belongs to several orgs and must only see the active one's feed.
    const read = (columns: string) =>
      db
        .from("notifications")
        .select(columns)
        .eq("org_id", ctx.orgId)
        .eq("user_id", ctx.user.id)
        .order("created_at", { ascending: false })
        .limit(50)

    let { data, error } = await read(V2_COLUMNS)
    let degraded = false
    if (error && isSchemaGap(error)) {
      degraded = true
      ;({ data, error } = await read(LEGACY_COLUMNS))
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ notifications: data || [], degraded })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error"
    console.error("[notifications]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id, ids, markAll } = await request.json()
    const db = createAdminClient()

    const apply = async (patch: Record<string, unknown>) => {
      let query = db.from("notifications").update(patch).eq("user_id", ctx.user.id)
      if (markAll) query = query.eq("org_id", ctx.orgId).eq("is_read", false)
      else if (Array.isArray(ids) && ids.length) query = query.in("id", ids)
      else if (id) query = query.eq("id", id)
      else return { error: null }
      return await query
    }

    const now = new Date().toISOString()
    let { error } = await apply({ is_read: true, read_at: now })
    if (error && isSchemaGap(error)) {
      ;({ error } = await apply({ is_read: true }))
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error"
    console.error("[notifications]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
