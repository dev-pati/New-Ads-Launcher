import { createHmac, createHash, randomUUID } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"

export function truncateUTF16(str: string, limit: number): string {
  if (str.length <= limit) return str
  let truncated = str.slice(0, limit)
  const lastCode = truncated.charCodeAt(limit - 1)
  if (lastCode >= 0xd800 && lastCode <= 0xdbff) {
    truncated = truncated.slice(0, limit - 1)
  }
  return truncated
}

export function mapSeverity(severity: string): "P0" | "P1" | "P2" | "P3" {
  switch (severity) {
    case "critical": return "P0"
    case "high": return "P1"
    case "medium": return "P2"
    case "low": return "P3"
    default: return "P3"
  }
}

export function mapKind(feedbackType: string): "bug" | "request" | "praise" {
  if (feedbackType === "missing_feature") {
    return "request"
  }
  return "bug"
}

export function computeSubmitterProof(email: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(email.trim().toLowerCase())
    .digest("hex")
}

export function computeSignature({
  secret,
  app,
  timestamp,
  nonce,
  idempotencyKey,
  bodyBytes,
}: {
  secret: string
  app: string
  timestamp: string
  nonce: string
  idempotencyKey: string
  bodyBytes: string
}): string {
  const bodyHash = createHash("sha256").update(bodyBytes).digest("hex")
  const message = `${app}.${timestamp}.${nonce}.${idempotencyKey}.${bodyHash}`
  const sig = createHmac("sha256", secret).update(message).digest("hex")
  return `v1=${sig}`
}

export interface FeedbackMirrorRow {
  id: string
  user_email?: string | null
  feature_area: string
  feature_function: string
  feedback_type: string
  severity: string
  observed_evidence: string
  expected_result?: string | null
  reference_url?: string | null
  extra_note?: string | null
  expected_done_at?: string | null
  artifact_url?: string | null
  created_at: string
  org_id: string
}

export async function enqueueFeedback(feedbackRow: FeedbackMirrorRow) {
  try {
    const db = createAdminClient()

    const {
      id,
      user_email,
      feature_area,
      feature_function,
      feedback_type,
      severity,
      observed_evidence,
      expected_result,
      reference_url,
      extra_note,
      expected_done_at,
      artifact_url,
      created_at,
      org_id,
    } = feedbackRow

    let observed = observed_evidence || ""
    if (reference_url) {
      observed += `\n\n[Ref] ${reference_url}`
    }
    if (extra_note) {
      observed += `\n\n[Note] ${extra_note}`
    }
    if (expected_done_at) {
      observed += `\n\n[Expected Done] ${expected_done_at}`
    }
    observed = truncateUTF16(observed, 4000)

    const expected = truncateUTF16(expected_result || "", 4000)

    const firstLine = (observed_evidence || "").split("\n")[0] || ""
    let title = `[${mapKind(feedback_type)}/${feature_function}] ${firstLine}`.trim()
    if (title.length < 8) {
      title = `[Feedback] ${observed_evidence || ""}`.trim()
    }
    title = truncateUTF16(title, 140)
    if (title.length < 8) {
      title = title.padEnd(8, ".")
    }

    const payload = {
      title,
      observed,
      expected,
      kind: mapKind(feedback_type),
      severity: mapSeverity(severity),
      origin: "human",
      submitter_email: String(user_email || "anonymous@patigroup.com").trim().toLowerCase(),
      submitter_verified: false,
      route: truncateUTF16((artifact_url || "").split("?")[0], 1000),
      view_id: truncateUTF16(`${feature_area}:${feature_function}`, 120),
      tenant_org_id: org_id,
      submitted_at: new Date(created_at).toISOString(),
    }

    const idempotency_key = `ads:${id}`

    const { error } = await db
      .from("feedback_hub_outbox")
      .upsert(
        {
          feedback_id: id,
          idempotency_key,
          payload,
          status: "queued",
          attempts: 0,
          next_attempt_at: new Date().toISOString(),
        },
        { onConflict: "idempotency_key", ignoreDuplicates: true }
      )

    if (error) {
      console.error("[feedback-hub] Enqueue failed:", error.message)
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[feedback-hub] Enqueue unexpected error:", msg)
  }
}

export async function reconcileMissedEnqueues() {
  try {
    const db = createAdminClient()

    // 1. Get minimum created_at in outbox
    const { data: minOutbox, error: minErr } = await db
      .from("feedback_hub_outbox")
      .select("created_at")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (minErr) {
      console.error("[feedback-hub] Reconcile min query failed:", minErr.message)
      return
    }

    if (!minOutbox) {
      // Outbox is empty, reconcile is a no-op
      return
    }

    const minDate = new Date(minOutbox.created_at)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const sinceDate = minDate > sevenDaysAgo ? minDate : sevenDaysAgo
    const sinceStr = sinceDate.toISOString()

    // 2. Fetch outbox feedback_ids in the range
    const { data: existingIds, error: existErr } = await db
      .from("feedback_hub_outbox")
      .select("feedback_id")
      .gte("created_at", sinceStr)

    if (existErr) {
      console.error("[feedback-hub] Reconcile exist query failed:", existErr.message)
      return
    }

    const existingSet = new Set((existingIds || []).map((x) => x.feedback_id))

    // 3. Fetch mirror events in the range
    const { data: mirrorEvents, error: mirrorErr } = await db
      .from("feedback_events")
      .select("*")
      .gte("created_at", sinceStr)

    if (mirrorErr) {
      console.error("[feedback-hub] Reconcile mirror query failed:", mirrorErr.message)
      return
    }

    // 4. Find missed events and enqueue
    const missed = (mirrorEvents || []).filter((e) => !existingSet.has(e.id))
    for (const e of missed) {
      await enqueueFeedback(e as FeedbackMirrorRow)
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[feedback-hub] Reconcile unexpected error:", msg)
  }
}

export async function drainOutbox() {
  try {
    const enabled = process.env.FEEDBACK_ENABLED === "1"
    if (!enabled) {
      console.log("feedback-hub dark")
      return { ok: true, status: "dark", delivered: 0, retried: 0, failed: 0 }
    }

    const db = createAdminClient()
    const hubUrl = process.env.FEEDBACK_HUB_URL || "https://ai.patigroup.com"
    const appKey = process.env.FEEDBACK_APP_KEY || "ads"
    const secret = process.env.FEEDBACK_APP_SECRET

    if (!secret) {
      console.warn("[feedback-hub] FEEDBACK_APP_SECRET is not set. Outbox remains queued.")
      return { ok: false, error: "missing_secret", delivered: 0, retried: 0, failed: 0 }
    }

    // Fetch up to 10 pending items due for processing
    const { data: items, error: fetchErr } = await db
      .from("feedback_hub_outbox")
      .select("*")
      .eq("status", "queued")
      .lte("next_attempt_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(10)

    if (fetchErr) {
      console.error("[feedback-hub] Failed to fetch outbox:", fetchErr.message)
      return { ok: false, error: fetchErr.message, delivered: 0, retried: 0, failed: 0 }
    }

    if (!items || items.length === 0) {
      return { ok: true, processed: 0, delivered: 0, retried: 0, failed: 0 }
    }

    let deliveredCount = 0
    let failedCount = 0
    let retriedCount = 0

    for (const item of items) {
      const payload = { ...item.payload }

      const submitter_email = payload.submitter_email || "anonymous@patigroup.com"
      payload.submitter_proof = computeSubmitterProof(submitter_email, secret)

      const rawBody = JSON.stringify(payload)
      const timestamp = String(Math.floor(Date.now() / 1000))
      const nonce = randomUUID()
      const idempotencyKey = item.idempotency_key

      const signature = computeSignature({
        secret,
        app: appKey,
        timestamp,
        nonce,
        idempotencyKey,
        bodyBytes: rawBody,
      })

      const targetUrl = `${hubUrl}/api/feedback/ingest`

      try {
        const res = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-PATI-App": appKey,
            "X-PATI-Timestamp": timestamp,
            "X-PATI-Nonce": nonce,
            "X-PATI-Idempotency-Key": idempotencyKey,
            "X-PATI-Signature": signature,
          },
          body: rawBody,
          signal: AbortSignal.timeout(10000),
        })

        const status = res.status
        let resJson: Record<string, unknown> | null = null
        try {
          resJson = await res.json()
        } catch (_e) {
          // ignore
        }

        if (status === 201 || (status === 200 && resJson?.duplicate === true)) {
          const hub_short_id = resJson?.hub_short_id || resJson?.short_id || null

          await db
            .from("feedback_hub_outbox")
            .update({
              status: "delivered",
              hub_short_id,
              attempts: item.attempts + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id)

          if (hub_short_id) {
            await db
              .from("feedback_events")
              .update({ hub_short_id })
              .eq("id", item.feedback_id)
          }

          deliveredCount++
        } else if ([400, 404, 405, 413, 422].includes(status)) {
          const last_error = (resJson?.error as string | undefined) || `HTTP ${status}`
          await db
            .from("feedback_hub_outbox")
            .update({
              status: "failed",
              last_error,
              attempts: item.attempts + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id)

          failedCount++
        } else {
          const attempts = item.attempts + 1
          const backoffMinutes = Math.min(Math.pow(2, attempts), 60)
          const nextAttempt = new Date(Date.now() + backoffMinutes * 60 * 1000)

          await db
            .from("feedback_hub_outbox")
            .update({
              attempts,
              next_attempt_at: nextAttempt.toISOString(),
              last_error: (resJson?.error as string | undefined) || `HTTP ${status}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id)

          retriedCount++
        }
      } catch (err: unknown) {
        const attempts = item.attempts + 1
        const backoffMinutes = Math.min(Math.pow(2, attempts), 60)
        const nextAttempt = new Date(Date.now() + backoffMinutes * 60 * 1000)
        const msg = err instanceof Error ? err.message : "Network error"

        await db
          .from("feedback_hub_outbox")
          .update({
            attempts,
            next_attempt_at: nextAttempt.toISOString(),
            last_error: msg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id)

        retriedCount++
      }
    }

    return {
      ok: true,
      processed: items.length,
      delivered: deliveredCount,
      failed: failedCount,
      retried: retriedCount,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error"
    console.error("[feedback-hub] Drain outbox unexpected error:", msg)
    return { ok: false, error: msg, delivered: 0, retried: 0, failed: 0 }
  }
}
