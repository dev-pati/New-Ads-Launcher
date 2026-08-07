import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection, requireRole } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { getOrgAdAccountInfo } from "@/app/api/facebook/_utils"
import { listApprovedAssets } from "@/lib/supabase/portal-registry"
import { buildTree, collectKeysUnder } from "@/lib/portal-media/tree"
import { claimPortalAsset, portalStoragePath } from "@/lib/portal-media/claim"
import { createUploadJob } from "@/lib/media-upload-jobs"
import { emitAndLog } from "@/lib/notifications/emit"

async function requireLaunchRole() {
  const ctx = await getAuthContext()
  if (!ctx) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const denied = requireRole(ctx)
  if (denied) return { error: denied }
  return { ctx }
}

async function resolveAdAccountInOrg(orgId: string, adAccountId: string) {
  const oauth = await getFacebookConnection(orgId)
  return getOrgAdAccountInfo(orgId, adAccountId, oauth?.access_token)
}

/**
 * Assign Portal assets to one ad account.
 *
 * Accepts `folderPaths` (recursive, the common case) and/or `objectKeys`. A folder is
 * expanded against the live registry rather than against anything the client sent, so a
 * stale page cannot assign an asset Portal has since withdrawn.
 */
export async function PUT(request: NextRequest) {
  const auth = await requireLaunchRole()
  if (auth.error) return auth.error
  const ctx = auth.ctx!

  const body = await request.json().catch(() => null)
  let adAccountId = typeof body?.ad_account_id === "string" ? body.ad_account_id.trim() : ""
  const folderPaths: string[] = Array.isArray(body?.folder_paths)
    ? body.folder_paths.filter((p: unknown) => typeof p === "string")
    : []
  const objectKeys: string[] = Array.isArray(body?.object_keys)
    ? body.object_keys.filter((k: unknown) => typeof k === "string")
    : []

  if (!adAccountId) return NextResponse.json({ error: "ad_account_id is required" }, { status: 400 })
  if (!folderPaths.length && !objectKeys.length) {
    return NextResponse.json({ error: "folder_paths or object_keys is required" }, { status: 400 })
  }
  const account = await resolveAdAccountInOrg(ctx.orgId, adAccountId)
  if (!account) {
    return NextResponse.json({ error: "Ad account not found in this workspace" }, { status: 400 })
  }
  adAccountId = account.id

  let assets
  try {
    const all = await listApprovedAssets()
    const wanted = new Set(objectKeys)
    if (folderPaths.length) {
      const tree = buildTree(all)
      for (const path of folderPaths) for (const key of collectKeysUnder(tree, path)) wanted.add(key)
    }
    assets = all.filter(a => wanted.has(a.object_key))
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Portal registry unavailable" },
      { status: 502 }
    )
  }

  if (!assets.length) return NextResponse.json({ error: "No approved media found for that selection" }, { status: 400 })

  const supabase = createAdminClient()
  const assigned: string[] = []
  const creativeIds: string[] = []
  const assignedItems: { object_key: string; creative_id: string }[] = []
  const errors: { object_key: string; error: string }[] = []

  for (const asset of assets) {
    try {
      const { creativeId } = await claimPortalAsset({
        asset,
        orgId: ctx.orgId,
        adAccountId,
        userId: ctx.user.id,
      })
      const { error } = await supabase
        .from("portal_media_assignments")
        .upsert(
          {
            object_key: asset.object_key,
            portal_asset_id: asset.id,
            org_id: ctx.orgId,
            ad_account_id: adAccountId,
            creative_id: creativeId,
            assigned_by: ctx.user.id,
          },
          { onConflict: "object_key,org_id,ad_account_id" }
        )
      if (error) throw error
      assigned.push(asset.object_key)
      creativeIds.push(creativeId)
      assignedItems.push({ object_key: asset.object_key, creative_id: creativeId })
    } catch (err) {
      errors.push({ object_key: asset.object_key, error: err instanceof Error ? err.message : String(err) })
    }
  }

  let jobId: string | null = null
  if (creativeIds.length > 0) {
    try {
      jobId = await createUploadJob(ctx.orgId, adAccountId, creativeIds)

      await supabase
        .from("portal_media_assignments")
        .update({ job_id: jobId })
        .in("creative_id", creativeIds)
        .eq("org_id", ctx.orgId)

      // Fire & forget trigger worker to process immediately instead of waiting 5m.
      // Next.js fetch without await doesn't block the response.
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      fetch(`${appUrl}/api/cron/upload-to-facebook`, {
        headers: { "Authorization": `Bearer ${process.env.CRON_SECRET}` }
      }).catch(err => console.error("[assignments] trigger cron err:", err))
    } catch (jobErr) {
      console.error("[assignments] Failed to create upload job:", jobErr)
      const message = jobErr instanceof Error ? jobErr.message : String(jobErr)
      await supabase
        .from("creatives")
        .update({ status: "error" })
        .in("id", creativeIds)
        .eq("org_id", ctx.orgId)
      for (const item of assignedItems) {
        errors.push({ object_key: item.object_key, error: message })
      }
    }
  }

  // Assigning Portal media is how creative reaches an ad account, and until now it was
  // the loudest action in the product that said nothing at all. One notification per
  // assign pass, not per asset — a 200-file folder must not produce 200 rows.
  //
  // Only a fully-successful batch counts as the Produce action (media_assignment:assigned,
  // matched in activity-catalog.ts). A partial failure does not emit the log row to prevent
  // inflating the Produce tally.
  if (assigned.length > 0 && errors.length === 0) {
    const { data: accountRow } = await supabase
      .from("ad_accounts")
      .select("name")
      .eq("org_id", ctx.orgId)
      .eq("fb_ad_account_id", adAccountId)
      .maybeSingle()

    await emitAndLog("portal-media.assign", {
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      actorName: ctx.user.user_metadata?.full_name || ctx.user.email?.split("@")[0] || "Someone",
      type: "media.assigned",
      action: "assigned",
      objectType: "media_assignment",
      objectId: jobId ?? adAccountId,
      count: assigned.length,
      context: { preposition: "to", name: accountRow?.name || adAccountId },
      body: null,
      link: "/assets",
      // The upload job is the assign pass. A retried request reuses neither, so the
      // fallback key still collapses a double-click inside the same minute.
      dedupeKey: jobId
        ? `media.assigned:${jobId}`
        : `media.assigned:${ctx.user.id}:${adAccountId}:${Math.floor(Date.now() / 60000)}`,
      source: "portal-media.assign",
    })
  }

  return NextResponse.json({
    ok: errors.length === 0,
    assigned: assigned.length,
    requested: assets.length,
    job_id: jobId,
    total: creativeIds.length,
    items: assignedItems,
    errors
  })
}

/**
 * Unassign: remove the assignment and the creative it produced.
 *
 * Blocked once Meta holds the asset — deleting the row here would orphan an object that
 * still exists in the ad account. Guard carried over verbatim from v1.
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireLaunchRole()
  if (auth.error) return auth.error
  const ctx = auth.ctx!

  const { searchParams } = new URL(request.url)
  const objectKey = searchParams.get("object_key")
  const adAccountId = searchParams.get("ad_account_id")
  // The Assets grid reverts from the creative it is looking at and has no object key
  // in hand, so both lookups are supported.
  const creativeId = searchParams.get("creative_id")
  if (!creativeId && !(objectKey && adAccountId)) {
    return NextResponse.json(
      { error: "creative_id, or object_key with ad_account_id, is required" },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  let query = supabase
    .from("portal_media_assignments")
    .select("id, object_key, creative_id")
    .eq("org_id", ctx.orgId)
  query = creativeId
    ? query.eq("creative_id", creativeId)
    : query.eq("object_key", objectKey!).eq("ad_account_id", adAccountId!)

  const { data: assignment, error: findErr } = await query.maybeSingle()

  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 })

  if (assignment.creative_id) {
    const { data: creative, error: creativeErr } = await supabase
      .from("creatives")
      .select("id, storage_path, fb_video_id, fb_image_hash")
      .eq("id", assignment.creative_id)
      .eq("org_id", ctx.orgId)
      .maybeSingle()
    if (creativeErr) return NextResponse.json({ error: creativeErr.message }, { status: 500 })

    if (creative?.fb_video_id || creative?.fb_image_hash) {
      return NextResponse.json(
        { error: "Asset already uploaded to Meta. Remove it from Meta before unassigning." },
        { status: 409 }
      )
    }

    if (creative && creative.storage_path === portalStoragePath(assignment.object_key)) {
      const { error: deleteErr } = await supabase
        .from("creatives")
        .delete()
        .eq("id", creative.id)
        .eq("org_id", ctx.orgId)
      if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }
  }

  const { error: unassignErr } = await supabase
    .from("portal_media_assignments")
    .delete()
    .eq("id", assignment.id)
    .eq("org_id", ctx.orgId)

  if (unassignErr) return NextResponse.json({ error: unassignErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
