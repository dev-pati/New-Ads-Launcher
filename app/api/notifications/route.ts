import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LEGACY_COLUMNS = "id, type, title, body, link, actor_name, is_read, created_at"
const V2_COLUMNS = `${LEGACY_COLUMNS}, object_type, object_id, object_name, action, changes, read_at`
const V3_COLUMNS = `${V2_COLUMNS}, archived_at`
type NotificationView = "inbox" | "archived"

/** The v2 columns may not be applied yet — 20260803_notifications_v2.sql needs sign-off. */
function isSchemaGap(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === "42703" || err.code === "PGRST204") return true
  return /column .* does not exist|could not find the .* column/i.test(err.message || "")
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const db = createAdminClient()
    const view: NotificationView = new URL(request.url).searchParams.get("view") === "archived"
      ? "archived"
      : "inbox"

    // Admin client bypasses RLS, so org and user are filtered explicitly. Both, not
    // one: a user belongs to several orgs and must only see the active one's feed.
    const read = (columns: string, withLifecycle: boolean) => {
      let query = db
        .from("notifications")
        .select(columns)
        .eq("org_id", ctx.orgId)
        .eq("user_id", ctx.user.id)
        .order("created_at", { ascending: false })
        .limit(100)
      if (withLifecycle) {
        query = view === "archived"
          ? query.not("archived_at", "is", null)
          : query.is("archived_at", null)
      }
      return query
    }

    let { data, error } = await read(V3_COLUMNS, true)
    let degraded = false
    if (error && isSchemaGap(error)) {
      if (view === "archived") {
        return NextResponse.json(
          { error: "Notification archive migration has not been applied" },
          { status: 503 }
        )
      }
      degraded = true
      ;({ data, error } = await read(LEGACY_COLUMNS, false))
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

    const { id, ids, markAll, action = "read" } = await request.json()
    if (!["read", "archive", "restore"].includes(action)) {
      return NextResponse.json({ error: "Invalid notification action" }, { status: 400 })
    }
    if (markAll && action !== "read") {
      return NextResponse.json({ error: "Only read supports mark all" }, { status: 400 })
    }
    if (!markAll && !id && (!Array.isArray(ids) || ids.length === 0)) {
      return NextResponse.json({ error: "Notification id is required" }, { status: 400 })
    }
    const db = createAdminClient()

    const apply = async (patch: Record<string, unknown>) => {
      let query = db
        .from("notifications")
        .update(patch)
        .eq("user_id", ctx.user.id)
        .eq("org_id", ctx.orgId)
      if (markAll) query = query.eq("org_id", ctx.orgId).eq("is_read", false)
      else if (Array.isArray(ids) && ids.length) query = query.in("id", ids)
      else if (id) query = query.eq("id", id)
      else return { error: null }
      return await query
    }

    const now = new Date().toISOString()
    const patch = action === "archive"
      ? { archived_at: now }
      : action === "restore"
      ? { archived_at: null }
      : { is_read: true, read_at: now }
    let { error } = await apply(patch)
    if (action === "read" && error && isSchemaGap(error)) {
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

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await request.json()
    if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid notification id" }, { status: 400 })
    }

    const { error } = await createAdminClient()
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("user_id", ctx.user.id)
      .eq("org_id", ctx.orgId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error"
    console.error("[notifications]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
