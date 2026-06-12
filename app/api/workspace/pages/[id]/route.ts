import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { listWorkspacePages } from "@/lib/workspace-pages"

export const dynamic = "force-dynamic"

function canManageWorkspacePages(role?: string | null) {
  return role === "admin" || role === "owner"
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!canManageWorkspacePages(ctx.role)) {
      return NextResponse.json({ error: "Insufficient workspace permission" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const patch: Record<string, unknown> = {}
    if (typeof body.is_active === "boolean") {
      patch.is_active = body.is_active
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "No supported fields to update" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("workspace_pages")
      .update(patch)
      .eq("id", id)
      .eq("workspace_id", ctx.orgId)
      .select("id")
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: "Workspace Page not found" }, { status: 404 })

    const pages = await listWorkspacePages(supabase, ctx.orgId, false)
    return NextResponse.json({ ok: true, pages })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to update workspace Page" },
      { status: 400 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!canManageWorkspacePages(ctx.role)) {
      return NextResponse.json({ error: "Insufficient workspace permission" }, { status: 403 })
    }

    const { id } = await params
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("workspace_pages")
      .update({
        is_active: false,
        removed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("workspace_id", ctx.orgId)
      .select("id")
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: "Workspace Page not found" }, { status: 404 })

    const pages = await listWorkspacePages(supabase, ctx.orgId, false)
    return NextResponse.json({ ok: true, pages })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to remove workspace Page" },
      { status: 400 }
    )
  }
}
