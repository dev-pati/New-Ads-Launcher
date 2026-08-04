import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { uploadVideoUrlToMeta, uploadImageToMeta, getVideoReadyData } from "@/lib/facebook"
import { getConnectionForAdAccount, MissingViaError, isManual } from "@/lib/auth"
import { CREATIVE_STATUS, assertCanMarkUploaded } from "@/lib/creative-readiness"
import { PORTAL_MEDIA_ORIGIN } from "@/lib/portal-media/claim"
import { processUpload, type CreativeRow } from "./worker"
import { updateJobStatus } from "@/lib/media-upload-jobs"
import { sendLarkMessage } from "@/lib/send-lark"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_VIDEOS_PER_ORG = 5
const MAX_JOB_BATCHES = 2
const RATE_LIMIT_ALERT_RECIPIENTS = ["thanhtin@patigroup.com"]
const RATE_LIMIT_NOTIFY_PCT = 65
const STALE_RUNNING_ITEM_MS = 5 * 60 * 1000

// Adaptive batch size based on rate limit pct
function batchSize(pct: number): number {
  if (pct >= 75) return 0 // pause entirely
  if (pct >= 65) return 1
  if (pct >= 45) return 2
  return 3
}

// Throttle Lark rate-limit alerts to once per hour per org (in-memory; resets on process restart).
const lastAlertAt = new Map<string, number>()
async function notifyRateLimit(orgId: string, pct: number) {
  const now = Date.now()
  const last = lastAlertAt.get(orgId) ?? 0
  if (now - last < 60 * 60 * 1000) return
  lastAlertAt.set(orgId, now)
  try {
    await sendLarkMessage({
      recipients: RATE_LIMIT_ALERT_RECIPIENTS,
      title: "⚠️ Meta API rate limit cao",
      message: `Usage đang ở ${pct}% — upload cron đã giảm batch để tránh bị Meta block. Kiểm tra lại trong vài phút.`,
    })
  } catch (err) {
    console.error("[cron/upload-to-facebook] Lark rate-limit alert failed:", err instanceof Error ? err.message : String(err))
  }
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

  // 0. B8 job queue — drain up to MAX_JOB_BATCHES jobs, each their items.
  //    Backward compat: legacy "pending" creatives without a job still run below.
  try {
    // Requeue items orphaned in "running" by a killed/timed-out tick (maxDuration 60s).
    // The pending-only select below never re-claims them, and the legacy fallback also
    // skips running items, so without this a stale item traps its creative in
    // "Assigning…" forever. 5min >> 60s maxDuration, so a live tick can't be wrongly
    // reset. Idempotent via isLaunchable() in processUpload — Meta already has the asset
    // → short-circuit, no double upload (TD-35).
    const staleBefore = new Date(Date.now() - STALE_RUNNING_ITEM_MS).toISOString()
    await db.from("media_upload_job_items")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("status", "running")
      .lt("updated_at", staleBefore)

    const { data: activeJobs } = await db
      .from("media_upload_jobs")
      .select("id, org_id, ad_account_id")
      .in("status", ["pending", "running"])
      .order("created_at", { ascending: true })
      .limit(MAX_JOB_BATCHES)

    if (activeJobs && activeJobs.length > 0) {
      for (const job of activeJobs) {
        const { data: jobItems } = await db
          .from("media_upload_job_items")
          .select("id, creative_id")
          .eq("job_id", job.id)
          .eq("status", "pending")
          .order("created_at", { ascending: true })

        if (!jobItems || jobItems.length === 0) continue

        await db.from("media_upload_jobs").update({ status: "running" }).eq("id", job.id)

        let currentRatePct = 0
        const limit = Math.min(jobItems.length, MAX_VIDEOS_PER_ORG)

        for (let i = 0; i < limit; i++) {
          const item = jobItems[i]
          const allowed = batchSize(currentRatePct)
          if (allowed === 0) {
            for (let j = i; j < limit; j++) skipped.push(jobItems[j].creative_id)
            break
          }

          const { error: claimErr } = await db
            .from("media_upload_job_items")
            .update({ status: "running", updated_at: new Date().toISOString() })
            .eq("id", item.id)
            .eq("status", "pending")
          if (claimErr) {
            errors.push({ id: item.creative_id, error: claimErr.message })
            continue
          }

          const { data: creative } = await db
            .from("creatives")
            .select("id, org_id, ad_account_id, file_url, file_name, media_type, status, fb_video_id, fb_image_hash")
            .eq("id", item.creative_id)
            .maybeSingle()

          if (!creative) {
            await db.from("media_upload_job_items")
              .update({ status: "failed", error_msg: "Creative not found", updated_at: new Date().toISOString() })
              .eq("id", item.id)
            errors.push({ id: item.creative_id, error: "Creative not found" })
            continue
          }

          const row = creative as unknown as CreativeRow
          try {
            const result = await processUpload(db, row)
            if (result.ok) {
              if (result.rateLimitPct > currentRatePct) currentRatePct = result.rateLimitPct
              if (currentRatePct >= RATE_LIMIT_NOTIFY_PCT) await notifyRateLimit(job.org_id, currentRatePct)
              await db.from("media_upload_job_items")
                .update({ status: "done", updated_at: new Date().toISOString() })
                .eq("id", item.id)
              uploaded.push(item.creative_id)
            } else {
              await db.from("media_upload_job_items")
                .update({ status: "failed", error_msg: result.error, updated_at: new Date().toISOString() })
                .eq("id", item.id)
              errors.push({ id: item.creative_id, error: result.error })
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error"
            if (err instanceof Error && err.name === "MetaRateLimitError") {
              // Note: B8 does not reschedule for rate-limits yet, leaves item running or failed
              for (let j = i; j < limit; j++) skipped.push(jobItems[j].creative_id)
              break
            }
            await db.from("media_upload_job_items")
              .update({ status: "failed", error_msg: msg, updated_at: new Date().toISOString() })
              .eq("id", item.id)
            errors.push({ id: item.creative_id, error: msg })
          }
        }

        await updateJobStatus(db, job.id)
      }
    }
  } catch (jobErr) {
    console.error("[cron/upload-to-facebook] job queue error:", jobErr instanceof Error ? jobErr.message : String(jobErr))
  }

  // 1. Process "pending" creatives (legacy path — no job attached)
  const { data: pending } = await db
    .from("creatives")
    .select("id, org_id, ad_account_id, file_url, file_name, media_type, status")
    .eq("status", "pending")
    .not("file_url", "eq", "")
    .order("created_at", { ascending: true })
    .limit(50)

  if (pending && pending.length > 0) {
    // Optimization: Bulk fetch active job items to avoid N+1 queries.
    // Only skip if item is in pending, running, or done. Failed items can fallback here.
    const pendingIds = pending.map(p => p.id)
    const { data: activeJobItems } = await db
      .from("media_upload_job_items")
      .select("creative_id")
      .in("creative_id", pendingIds)
      .in("status", ["pending", "running", "done"])
    const activeClaimedIds = new Set((activeJobItems || []).map(item => item.creative_id))

    // Group by org_id
    const byOrg = new Map<string, typeof pending>()
    for (const row of pending) {
      if (activeClaimedIds.has(row.id)) {
        skipped.push(row.id)
        continue
      }
      const list = byOrg.get(row.org_id) ?? []
      list.push(row)
      byOrg.set(row.org_id, list)
    }

    for (const [orgId, rows] of byOrg) {
      let currentRatePct = 0
      const limit = Math.min(rows.length, MAX_VIDEOS_PER_ORG)

      for (let i = 0; i < limit; i++) {
        const row = rows[i]

        // Via MECE: WRITE ad_account_id của từng creative
        // (via launch của account → OAuth của org → skip nếu không có)
        let conn
        try {
          conn = await getConnectionForAdAccount(orgId, row.ad_account_id, "write")
        } catch (err) {
          if (err instanceof MissingViaError) {
            // MissingViaError permanent skip until user connects: mark error let UI know
            console.error(`[cron/upload-to-facebook] creative ${row.id} skipped: Missing via connection`)
            await db.from("creatives").update({ status: CREATIVE_STATUS.ERROR }).eq("id", row.id)
            errors.push({ id: row.id, error: "Missing via connection ad account" })
            continue
          }
          throw err
        }
        if (!conn?.access_token) {
          console.error(`[cron/upload-to-facebook] creative ${row.id} skipped: Missing access token`)
          await db.from("creatives").update({ status: CREATIVE_STATUS.ERROR }).eq("id", row.id)
          errors.push({ id: row.id, error: "Meta connection invalid missing access token" })
          continue
        }

        assertCanMarkUploaded(row.status)

        // SEC-008: file_url must be our own Supabase Storage audited Creative Portal
        // media origin (ADR-0003) before we fetch/hand it Meta — anything else SSRF risk.
        const allowedHosts = new Set<string>()
        try { allowedHosts.add(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host) } catch { /* unset */ }
        try { allowedHosts.add(new URL(PORTAL_MEDIA_ORIGIN).host) } catch { /* unset */ }
        let fileUrlHost: string | null = null
        try { fileUrlHost = new URL(row.file_url).host } catch { /* invalid */ }
        if (!fileUrlHost || !allowedHosts.has(fileUrlHost)) {
          console.error(`[cron/upload-to-facebook] ${row.id} disallowed host ${fileUrlHost}`)
          await db.from("creatives").update({ status: CREATIVE_STATUS.ERROR }).eq("id", row.id)
          errors.push({ id: row.id, error: `Disallowed file url host: ${fileUrlHost || "invalid URL"}` })
          continue
        }

        try {
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
            currentRatePct = result.rateLimitPct ?? currentRatePct

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

      if (batchSize(currentRatePct) === 0) break
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
      let conn
      try {
        conn = await getConnectionForAdAccount(orgId, rows[0].ad_account_id, "write")
      } catch (err) {
        if (err instanceof MissingViaError) {
          console.error(`[cron/upload-to-facebook] poll skipped: Missing via connection`)
          continue
        }
        throw err
      }
      if (!conn?.access_token) continue

      for (const row of rows) {
        try {
          assertCanMarkUploaded(row.status)
          const videoData = await getVideoReadyData(row.fb_video_id!, conn.access_token, { skipProof: isManual(conn) })
          if (videoData.status === "error") {
            await db.from("creatives").update({ status: CREATIVE_STATUS.ERROR }).eq("id", row.id)
            errors.push({ id: row.id, error: videoData.errorMsg || "Video processing failed" })
          } else if (videoData.ready) {
            const update: Record<string, string> = { status: CREATIVE_STATUS.READY }
            if (videoData.thumbnailUrl) update.fb_thumbnail_url = videoData.thumbnailUrl
            // videoData.sourceUrl is a temporary Meta CDN URL — never overwrite
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
