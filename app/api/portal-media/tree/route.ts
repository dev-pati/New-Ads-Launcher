import { NextResponse } from "next/server"
import { getAuthContext, requireRole } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { listApprovedAssets } from "@/lib/supabase/portal-registry"
import { buildTree } from "@/lib/portal-media/tree"

export const dynamic = "force-dynamic"

/**
 * The Portal folder tree, read live from `creative_portal.media_assets` on every call.
 *
 * Deliberately uncached: staleness is the failure this replaces. v1 depended on a cron
 * to copy the registry into `portal_media_items`, so the section showed whatever the
 * last run happened to catch — and if the cron never ran, nothing new ever appeared.
 */
export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const denied = requireRole(ctx)
  if (denied) return denied

  let assets
  try {
    assets = await listApprovedAssets()
  } catch (err) {
    // Never fall through to an empty tree: "Portal unreachable" and "Portal approved
    // nothing" must not look the same, or the first outage silently teaches the Media
    // Buyer that the section is empty and they go back to asking Creative directly.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Portal registry unavailable" },
      { status: 502 }
    )
  }

  const supabase = createAdminClient()
  const { data: assignments, error } = await supabase
    .from("portal_media_assignments")
    .select("object_key, ad_account_id, creative_id")
    .eq("org_id", ctx.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    tree: buildTree(assets),
    assignments: assignments || [],
    totalFiles: assets.length,
  })
}
