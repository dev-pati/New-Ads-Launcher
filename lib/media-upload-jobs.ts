import { createAdminClient } from "./supabase/admin"

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

  await db.from("media_upload_jobs").update({ status }).eq("id", jobId)
}
