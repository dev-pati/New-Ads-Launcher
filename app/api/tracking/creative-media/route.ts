import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { listApprovedAssetsByKeys } from "@/lib/supabase/portal-registry"
import { mediaNodeFromAsset, type MediaNode } from "@/lib/portal-media/tree"
import { isMissingTable } from "@/lib/tracking/missing-table"
import type { CreativeMediaStatus } from "@/lib/tracking/creative-table"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GRAPH = "https://graph.facebook.com/v25.0"

/**
 * One Meta ad → the Portal asset it was launched from, for the Media Detail sheet on the
 * Creative tab.
 *
 * There is no `fb_ad_id` on `creatives` and no ad↔creative row anywhere: `launch_batches`
 * records `creative_ids` per batch, not per ad. So the join key is the one thing both
 * sides already store — what Meta was given:
 *
 *   Meta ad → creative{video_id | image_hash} → creatives.fb_video_id | fb_image_hash
 *           → portal_media_assignments.creative_id → object_key
 *           → creative_portal.creative_storage_catalog
 *
 * That is the same pair `lib/creative-readiness.ts` calls proof that Meta has the asset,
 * which is why it is deterministic: an ad cannot run without one of them, and AdLauncher
 * wrote whichever one it used.
 *
 * Every link in that chain can be legitimately absent — an ad built in Ads Manager, a
 * creative uploaded by hand, a carousel that exposes neither key. Each of those is a
 * named `status`, answered 200, never an empty sheet: "we cannot link this" and "this has
 * no metadata" are different sentences and the reader has to be able to tell them apart.
 *
 * Creator ID / name is deliberately absent. `creative_storage_catalog` exposes no creator
 * column — checked against the live view, including inside `creative_snapshot` — so this
 * route reports `creatorStatus: "awaiting_portal"` rather than substituting
 * `creatives.user_id`, which is the AdLauncher uploader and a different person.
 */
export type TrackingCreativeMedia = {
  /** Union and the note for each non-linked case: lib/tracking/creative-table.ts. */
  status: CreativeMediaStatus
  file: MediaNode | null
  creative: {
    id: string
    fileName: string
    mediaType: string | null
    fileUrl: string | null
    createdAt: string | null
  } | null
  meta: { videoId: string | null; imageHash: string | null }
  /** No creator identity exists to show yet — see the module comment. */
  creatorStatus: "awaiting_portal"
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const adId = request.nextUrl.searchParams.get("adId")
  if (!adId) return NextResponse.json({ error: "adId required" }, { status: 400 })

  const connection = await getFacebookConnection(ctx.orgId)
  if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

  const params = new URLSearchParams({
    fields: "creative{id,video_id,image_hash}",
    access_token: connection.access_token,
  })
  const metaResponse = await fetch(`${GRAPH}/${adId}?${params}`)
  const metaBody = await metaResponse.json()
  if (metaBody.error) {
    return NextResponse.json({ error: metaBody.error.message }, { status: 502 })
  }

  const videoId: string | null = metaBody.creative?.video_id || null
  const imageHash: string | null = metaBody.creative?.image_hash || null
  const base = { meta: { videoId, imageHash }, creatorStatus: "awaiting_portal" as const }

  // Carousels and catalog ads carry their assets one level deeper, in the story spec.
  // Rather than guess at a child asset, say the ad exposes nothing to match on.
  if (!videoId && !imageHash) {
    return NextResponse.json({ ...base, status: "no_media_key", file: null, creative: null } satisfies TrackingCreativeMedia)
  }

  const supabase = createAdminClient()
  const filters = [
    videoId ? `fb_video_id.eq.${videoId}` : null,
    imageHash ? `fb_image_hash.eq.${imageHash}` : null,
  ].filter(Boolean).join(",")

  const { data: creatives, error: creativeError } = await supabase
    .from("creatives")
    .select("id,file_name,file_url,media_type,created_at")
    .eq("org_id", ctx.orgId)
    .or(filters)
    .order("created_at", { ascending: true })
    .limit(1)

  if (creativeError) return NextResponse.json({ error: creativeError.message }, { status: 500 })

  const creativeRow = creatives?.[0]
  if (!creativeRow) {
    // The ad runs on an asset this org never uploaded through AdLauncher.
    return NextResponse.json({ ...base, status: "not_in_adlauncher", file: null, creative: null } satisfies TrackingCreativeMedia)
  }

  const creative = {
    id: creativeRow.id as string,
    fileName: creativeRow.file_name as string,
    mediaType: (creativeRow.media_type as string) ?? null,
    fileUrl: (creativeRow.file_url as string) ?? null,
    createdAt: (creativeRow.created_at as string) ?? null,
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from("portal_media_assignments")
    .select("object_key")
    .eq("org_id", ctx.orgId)
    .eq("creative_id", creative.id)
    .limit(1)

  // A missing assignments table is not "this creative came from nowhere".
  if (assignmentError && !isMissingTable(assignmentError)) {
    return NextResponse.json({ error: assignmentError.message }, { status: 500 })
  }

  const objectKey = assignments?.[0]?.object_key as string | undefined
  if (!objectKey) {
    return NextResponse.json({ ...base, status: "not_from_portal", file: null, creative } satisfies TrackingCreativeMedia)
  }

  let assets
  try {
    assets = await listApprovedAssetsByKeys([objectKey])
  } catch (cause) {
    // Portal unreachable must not read as Portal-has-nothing (same rule as the tree route).
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Portal registry unavailable" },
      { status: 502 },
    )
  }

  const asset = assets[0]
  if (!asset) {
    return NextResponse.json({ ...base, status: "portal_missing", file: null, creative } satisfies TrackingCreativeMedia)
  }

  return NextResponse.json({
    ...base,
    status: "linked",
    file: mediaNodeFromAsset(asset),
    creative,
  } satisfies TrackingCreativeMedia)
}
