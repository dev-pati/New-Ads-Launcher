import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { addWorkspacePages, listWorkspacePages } from "@/lib/workspace-pages"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const activeOnly = request.nextUrl.searchParams.get("active") !== "false"
    const supabase = createAdminClient()
    const pages = await listWorkspacePages(supabase, ctx.orgId, activeOnly)

    return NextResponse.json({ pages })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to load workspace Pages" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const metaPageIds = Array.isArray(body.meta_page_ids) ? body.meta_page_ids : []
    const supabase = createAdminClient()
    const pages = await addWorkspacePages(supabase, ctx.orgId, ctx.user.id, metaPageIds)

    return NextResponse.json({ ok: true, pages })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to add Pages to workspace" },
      { status: 400 }
    )
  }
}
