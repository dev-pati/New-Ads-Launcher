/**
 * GET /api/cron/feedback-outbox
 * Cron job to reconcile missed enqueues and drain the feedback outbox to the central hub.
 *
 * Auth: Bearer CRON_SECRET header required
 */

import { NextRequest, NextResponse } from "next/server"
import { reconcileMissedEnqueues, drainOutbox } from "@/lib/feedback-hub"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const auth = request.headers.get("authorization")
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // 1. Reconcile any missed enqueues first
    await reconcileMissedEnqueues()

    // 2. Drain queued items to the hub
    const res = await drainOutbox()

    return NextResponse.json({
      ok: res.ok,
      delivered: res.delivered || 0,
      retried: res.retried || 0,
      failed: res.failed || 0,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error"
    console.error("[feedback-cron] Failed to execute outbox drain cron:", msg)
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    )
  }
}
