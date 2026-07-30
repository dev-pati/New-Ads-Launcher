import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { uploadVideoUrlToMeta, uploadImageToMeta, getVideoReadyData } from "@/lib/facebook"
import { getConnectionForAdAccount, MissingViaError, isManual } from "@/lib/auth"
import { CREATIVE_STATUS, assertCanMarkUploaded } from "@/lib/creative-readiness"
import { PORTAL_MEDIA_ORIGIN } from "@/lib/portal-media/claim"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_VIDEOS_PER_ORG = 5
// Adaptive batch size based on current rate limit pct
function batchSize(pct: number): number {
  if (pct >= 60) return 0  // pause entirely
  if (pct >= 40) return 1
  if (pct >= 20) return 2
  return 3
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createAdminClient()
  const uploaded: string[] = []
  const skipped: string[] = []
  const errors: { id: string; error: string }[] = []
  const processed: string[] = []

  // 1. Process "pending" creatives
  const { data: pending } = await db
    .from("creatives")
    .select("id, org_id, ad_account_id, file_url, file_name, media_type, status")
    .eq("status", "pending")
    .not("file_url", "eq", "")
    .order("created_at", { ascending: true })
    .limit(50)

  if (pending && pending.length > 0) {
    // Group by org_id
    const byOrg = new Map<string, typeof pending>()
    for (const row of pending) {
      const list = byOrg.get(row.org_id) ?? []
      list.push(row)
      byOrg.set(row.org_id, list)
    }

    for (const [orgId, rows] of byOrg) {
    let currentRatePct = 0
    const limit = Math.min(rows.length, MAX_VIDEOS_PER_ORG)

    for (let i = 0; i < limit; i++) {
      const row = rows[i]
      const allowed = batchSize(currentRatePct)
      if (allowed === 0) {
        for (let j = i; j < limit; j++) skipped.push(rows[j].id)
        break
      }

      try {
        // Via MECE: upload video = WRITE — resolve theo ad_account_id của từng creative
        // (via launch của account → OAuth của org → skip nếu không có)
        let conn
        try {
          conn = await getConnectionForAdAccount(orgId, row.ad_account_id, "write")
        } catch (err) {
          if (err instanceof MissingViaError) {
            skipped.push(row.id)
            continue
          }
          throw err
        }
        if (!conn?.access_token) {
          skipped.push(row.id)
          continue
        }

        assertCanMarkUploaded(row.status)

        // SEC-008: file_url must be our own Supabase Storage or the audited Creative Portal
        // media origin (ADR-0003) before we fetch/hand it to Meta — anything else is SSRF risk.
        const allowedHosts = new Set<string>()
        try { allowedHosts.add(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host) } catch { /* unset */ }
        try { allowedHosts.add(new URL(PORTAL_MEDIA_ORIGIN).host) } catch { /* unset */ }
        let fileUrlHost: string | null = null
        try { fileUrlHost = new URL(row.file_url).host } catch { /* invalid */ }
        if (!fileUrlHost || !allowedHosts.has(fileUrlHost)) {
          console.error(`[cron/upload-to-facebook] creative ${row.id} has disallowed file_url host; skipping`)
          skipped.push(row.id)
          continue
        }

        const normAccountId = row.ad_account_id?.startsWith("act_")
          ? row.ad_account_id
          : `act_${row.ad_account_id}`

          if (row.media_type === "video") {
            const result = await uploadVideoUrlToMeta(
              normAccountId,
              conn.access_token,
              row.file_url,
              row.file_name,
              { skipProof: isManual(conn) }
            )
            currentRatePct = result.rateLimitPct

            await db
              .from("creatives")
              .update({ fb_video_id: result.videoId, status: CREATIVE_STATUS.PROCESSING })
              .eq("id", row.id)
          } else {
            const imgRes = await fetch(row.file_url)
            if (!imgRes.ok) throw new Error(`Failed to fetch image from Storage: ${imgRes.status}`)
            const imgBuffer = await imgRes.arrayBuffer()
            const result = await uploadImageToMeta(
              normAccountId,
              conn.access_token,
              imgBuffer,
              row.file_name,
              { skipProof: isManual(conn) }
            )
            currentRatePct = result.rateLimitPct

            await db
              .from("creatives")
              .update({
                fb_image_hash: result.hash,
                fb_image_url: result.url,
                fb_thumbnail_url: result.url_128,
                status: CREATIVE_STATUS.READY,
              })
              .eq("id", row.id)
          }

          uploaded.push(row.id)
        } catch (err) {
          const msg: string = err instanceof Error ? err.message : "Unknown error"
          if (err instanceof Error && err.name === "MetaRateLimitError") {
            for (let j = i; j < limit; j++) skipped.push(rows[j].id)
            break
          }

          await db.from("creatives").update({ status: CREATIVE_STATUS.ERROR }).eq("id", row.id)
          errors.push({ id: row.id, error: msg })
          console.error(`[cron/upload-to-facebook] creative ${row.id} failed:`, msg)
        }
      }
    }
  }

  // 2. Poll "processing" videos
  const { data: processing } = await db
    .from("creatives")
    .select("id, org_id, ad_account_id, fb_video_id, file_url, fb_thumbnail_url, status")
    .eq("status", "processing")
    .eq("media_type", "video")
    .not("fb_video_id", "is", null)
    .order("updated_at", { ascending: true })
    .limit(20)

  if (processing && processing.length > 0) {
    const byOrg = new Map<string, typeof processing>()
    for (const row of processing) {
      const list = byOrg.get(row.org_id) ?? []
      list.push(row)
      byOrg.set(row.org_id, list)
    }

    for (const [orgId, rows] of byOrg) {
      for (const row of rows) {
        // Via MECE: video was uploaded through the write connection for this ad
        // account — poll status through the same one, skip if it's gone.
        let conn
        try {
          conn = await getConnectionForAdAccount(orgId, row.ad_account_id, "write")
        } catch (err) {
          if (err instanceof MissingViaError) continue
          throw err
        }
        if (!conn?.access_token) continue

        try {
          assertCanMarkUploaded(row.status)
          const videoData = await getVideoReadyData(row.fb_video_id!, conn.access_token, { skipProof: isManual(conn) })
          if (videoData.status === "error") {
            await db.from("creatives").update({ status: CREATIVE_STATUS.ERROR }).eq("id", row.id)
            errors.push({ id: row.id, error: videoData.errorMsg || "Video processing failed" })
          } else if (videoData.ready) {
            const update: Record<string, unknown> = { status: CREATIVE_STATUS.READY }
            if (videoData.thumbnailUrl) update.fb_thumbnail_url = videoData.thumbnailUrl
            // videoData.sourceUrl is a temporary Meta CDN URL — never overwrite the
            // stable file_url (creative.patigroup.com resolver) or storage_path.
            await db.from("creatives").update(update).eq("id", row.id)
            processed.push(row.id)
          }
        } catch (err) {
          console.error(`[cron/upload-to-facebook] failed to poll video ${row.fb_video_id}:`, err instanceof Error ? err.message : String(err))
        }
      }
    }
  }

  console.log(`[cron/upload-to-facebook] uploaded=${uploaded.length} processed_ready=${processed.length} skipped=${skipped.length} errors=${errors.length}`)
  return NextResponse.json({
    uploaded: uploaded.length,
    processedReady: processed.length,
    skipped: skipped.length,
    errors: errors.length
  })
}
