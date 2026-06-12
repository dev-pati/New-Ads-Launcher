import { NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { syncMetaPagesForWorkspace } from "@/lib/workspace-pages"

export const dynamic = "force-dynamic"

function formatWorkspacePagesError(err: unknown) {
  const message = err instanceof Error ? err.message : "Unable to sync Meta Pages"
  const lower = message.toLowerCase()
  if (
    lower.includes("meta_pages") ||
    lower.includes("workspace_pages") ||
    lower.includes("meta_accounts") ||
    lower.includes("schema cache") ||
    lower.includes("does not exist")
  ) {
    return {
      status: 503,
      body: {
        error: "Workspace Pages migration has not been applied yet. Run supabase/migrations/20260612_workspace_pages.sql, then refresh the Supabase schema cache.",
        migrationRequired: true,
        detail: message,
      },
    }
  }
  return {
    status: lower.includes("permission") ? 403 : 500,
    body: {
      error: message,
      needsReconnect: lower.includes("expired") || lower.includes("invalid") || lower.includes("oauth"),
    },
  }
}

export async function POST() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createAdminClient()
    const result = await syncMetaPagesForWorkspace(supabase, ctx.orgId, ctx.user.id)

    return NextResponse.json({
      ok: true,
      connected: result.connected,
      needsReconnect: result.needsReconnect,
      count: result.pages.length,
      pages: result.pages,
    })
  } catch (err) {
    const formatted = formatWorkspacePagesError(err)
    return NextResponse.json(formatted.body, { status: formatted.status })
  }
}
