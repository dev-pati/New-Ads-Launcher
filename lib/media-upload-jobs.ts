import { createAdminClient } from "./supabase/admin"
import { emitAndLog } from "./notifications/emit"

export interface JobProgress {
  jobId: string
  status: "pending" | "running" | "done" | "error"
  total: number
  done: number
  failed: number
  active: number
  percent: number
  stale: boolean
  errorMsg?: string
  items?: Array<{
    id: string
    creativeId: string
    status: "pending" | "running" | "done" | "failed"
    errorMsg: string | null
  }>
}

export async function createUploadJob(
  orgId: string,
  adAccountId: string,
  creativeIds: string[]
): Promise<string> {
  const db = createAdminClient()

  // 1. Insert jobs row
  const { data: job, error: jobErr } = await db
    .from("media_upload_jobs")
    .insert({
      org_id: orgId,
      ad_account_id: adAccountId,
      status: "pending",
      total_items: creativeIds.length,
    })
    .select("id")
    .single()

  if (jobErr || !job) {
    throw new Error(`Failed to create upload job: ${jobErr?.message || "Unknown DB error"}`)
  }

  // 2. Insert items
  const items = creativeIds.map(creativeId => ({
    job_id: job.id,
    creative_id: creativeId,
    status: "pending",
    retry_count: 0,
  }))

  const { error: itemsErr } = await db.from("media_upload_job_items").insert(items)
  if (itemsErr) {
    // Attempt rollback/cleanup manually to avoid partial states
    await db.from("media_upload_jobs").delete().eq("id", job.id)
    throw new Error(`Failed to create job items: ${itemsErr.message}`)
  }

  return job.id
}

export function calculateProgress(
  totalItems: number,
  items: Array<{ status: string; updated_at: string; error_msg?: string | null }>,
  now = Date.now()
) {
  let done = 0
  let failed = 0
  let active = 0
  let isStale = false
  let lastError = ""

  for (const item of items) {
    if (item.status === "done") {
      done++
    } else if (item.status === "failed") {
      failed++
      if (item.error_msg) lastError = item.error_msg
    } else {
      active++
      const updatedTime = new Date(item.updated_at).getTime()
      if (item.status === "running" && now - updatedTime > 5 * 60 * 1000) {
        isStale = true
      }
    }
  }

  const percent = totalItems > 0 ? Math.floor((done / totalItems) * 100) : 0

  return {
    done,
    failed,
    active,
    percent,
    stale: isStale,
    errorMsg: failed > 0 ? lastError || "Some items failed to upload" : undefined,
  }
}

export async function getJobProgress(jobId: string, orgId: string): Promise<JobProgress | null> {
  const db = createAdminClient()

  const { data: job, error: jobErr } = await db
    .from("media_upload_jobs")
    .select("id, org_id, status, total_items, updated_at")
    .eq("id", jobId)
    .eq("org_id", orgId)
    .maybeSingle()

  if (jobErr || !job) return null

  const { data: items, error: itemsErr } = await db
    .from("media_upload_job_items")
    .select("id, creative_id, status, updated_at, error_msg")
    .eq("job_id", jobId)

  if (itemsErr || !items) return null

  const stats = calculateProgress(job.total_items, items)

  return {
    jobId: job.id,
    status: job.status as "pending" | "running" | "done" | "error",
    total: job.total_items,
    done: stats.done,
    failed: stats.failed,
    active: stats.active,
    percent: stats.percent,
    stale: stats.stale,
    errorMsg: stats.errorMsg,
  }
}

export async function updateJobStatus(db: ReturnType<typeof createAdminClient>, jobId: string) {
  const { data: items } = await db
    .from("media_upload_job_items")
    .select("status")
    .eq("job_id", jobId)

  if (!items) return

  const total = items.length
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const done = items.filter((i: any) => i.status === "done").length
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const failed = items.filter((i: any) => i.status === "failed").length
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pending = items.filter((i: any) => i.status === "pending").length

  let status: "pending" | "running" | "done" | "error" = "running"
  if (done === total) {
    status = "done"
  } else if (done + failed === total) {
    status = failed > 0 ? "error" : "done"
  } else if (pending === total) {
    status = "pending"
  }

  const { data: job } = await db
    .from("media_upload_jobs")
    .select("status, org_id, ad_account_id")
    .eq("id", jobId)
    .maybeSingle()

  const previous = job?.status as string | undefined
  await db.from("media_upload_jobs").update({ status }).eq("id", jobId)

  // The transition into a terminal state is the event. The cron re-runs constantly, so
  // this must fire on the edge, not on the state — and the dedupe key catches the case
  // where two workers observe the same edge.
  const terminal = status === "done" || status === "error"
  if (!terminal || previous === status || !job?.org_id) return

  const { data: account } = await db
    .from("ad_accounts")
    .select("name")
    .eq("org_id", job.org_id)
    .eq("fb_ad_account_id", job.ad_account_id)
    .maybeSingle()
  const accountName = account?.name || job.ad_account_id || "the ad account"

  void emitAndLog("media-upload-job", {
    orgId: job.org_id,
    // No human ran this — the cron did. An actor id here would exclude that person
    // from their own upload result, which is exactly who is waiting for it.
    actorId: null,
    actorName: "AdLauncher",
    type: status === "done" ? "media.upload_completed" : "media.upload_failed",
    action: status === "done" ? "completed" : "failed",
    objectType: "upload_job",
    objectId: jobId,
    objectName: accountName,
    count: total,
    body: status === "done"
      ? `${done} of ${total} asset${total === 1 ? "" : "s"} are now on Meta and ready to launch.`
      : `${failed} of ${total} asset${total === 1 ? "" : "s"} failed to upload to Meta. View error details.`,
    link: "/assets",
    dedupeKey: `media.upload:${jobId}:${status}`,
    source: "cron.upload-to-facebook",
  })
}
