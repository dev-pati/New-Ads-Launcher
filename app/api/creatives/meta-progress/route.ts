import { NextRequest, NextResponse } from "next/server"

import { getCachedFacebookMetadata } from "@/app/api/facebook/_cache"
import { getAuthContext, getConnectionForAdAccount, isManual, type ResolvedConnection } from "@/lib/auth"
import { getVideoProcessingStatus } from "@/lib/facebook"
import {
  normalizeMetaProcessingPercent,
  type MetaAssignmentProgress,
} from "@/lib/meta-assignment-progress"
import { createAdminClient } from "@/lib/supabase/admin"

const MAX_ITEMS = 10
const META_PROGRESS_CACHE_MS = 5_000

interface CreativeProgressRow {
  id: string
  ad_account_id: string | null
  media_type: "image" | "video"
  status: string | null
  fb_video_id: string | null
  fb_image_hash: string | null
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null)
    const creativeIds = Array.isArray(body?.creative_ids)
      ? [...new Set<string>(body.creative_ids.filter(
          (id: unknown): id is string => typeof id === "string" && id.length > 0,
        ))].slice(0, MAX_ITEMS)
      : []
    if (creativeIds.length === 0) {
      return NextResponse.json({ error: "creative_ids is required" }, { status: 400 })
    }

    const db = createAdminClient()
    const { data, error } = await db
      .from("creatives")
      .select("id, ad_account_id, media_type, status, fb_video_id, fb_image_hash")
      .eq("org_id", ctx.orgId)
      .in("id", creativeIds)

    if (error) throw error

    const rows = (data || []) as CreativeProgressRow[]
    const rowsById = new Map(rows.map(row => [row.id, row]))
    const connections = new Map<string, ResolvedConnection | null>()
    const items: MetaAssignmentProgress[] = []

    // Sequential by design: this endpoint is polled and must not burst Meta when a
    // folder contains several videos processing at the same time.
    for (const creativeId of creativeIds) {
      const creative = rowsById.get(creativeId)
      if (!creative) {
        items.push({
          creativeId,
          phase: "error",
          percent: null,
          error: "Creative not found or not accessible",
        })
        continue
      }
      if (creative.status === "error") {
        items.push({ creativeId: creative.id, phase: "error", percent: null })
        continue
      }

      const imageReady = creative.media_type === "image" && Boolean(creative.fb_image_hash)
      if (creative.status === "ready" || imageReady) {
        items.push({ creativeId: creative.id, phase: "ready", percent: 100 })
        continue
      }

      if (creative.media_type !== "video" || !creative.fb_video_id) {
        items.push({ creativeId: creative.id, phase: "assigning", percent: null })
        continue
      }

      const accountId = creative.ad_account_id || ""
      if (!connections.has(accountId)) {
        connections.set(
          accountId,
          accountId ? await getConnectionForAdAccount(ctx.orgId, accountId, "read") : null,
        )
      }
      const connection = connections.get(accountId) || null
      if (!connection) {
        items.push({ creativeId: creative.id, phase: "processing", percent: null })
        continue
      }

      const meta = await getCachedFacebookMetadata(
        `creative-meta-progress:${ctx.orgId}:${creative.id}:${creative.fb_video_id}`,
        META_PROGRESS_CACHE_MS,
        () => getVideoProcessingStatus(
          creative.fb_video_id!,
          connection.access_token,
          { skipProof: isManual(connection) },
        ),
      )

      if (meta.status === "error") {
        await db
          .from("creatives")
          .update({ status: "error" })
          .eq("id", creative.id)
          .eq("org_id", ctx.orgId)
        items.push({
          creativeId: creative.id,
          phase: "error",
          percent: null,
          error: meta.errorMsg || "Meta processing failed",
        })
        continue
      }

      if (meta.ready) {
        await db
          .from("creatives")
          .update({ status: "ready" })
          .eq("id", creative.id)
          .eq("org_id", ctx.orgId)
        items.push({ creativeId: creative.id, phase: "ready", percent: 100 })
        continue
      }

      items.push({
        creativeId: creative.id,
        phase: "processing",
        percent: normalizeMetaProcessingPercent(meta.processingProgress),
      })
    }

    return NextResponse.json({ items })
  } catch (error) {
    console.error("[creative-meta-progress]", error)
    return NextResponse.json({ error: "Failed to load per-item Meta progress" }, { status: 500 })
  }
}
