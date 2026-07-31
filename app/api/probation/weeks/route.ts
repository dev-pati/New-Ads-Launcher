import { NextRequest, NextResponse } from "next/server"
import { getProbationViewer } from "@/lib/probation/auth"
import { getWeek, listWeeks, saveWeek } from "@/lib/probation/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const viewer = await getProbationViewer()
  if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const weeks = await listWeeks(viewer.email as string)
  return NextResponse.json({ weeks })
}

/**
 * Close a week, and/or record what the reviewers actually scored it.
 *
 * `selfScore` is what the app computed; `confirmedScore` is theirs. Both are
 * stored because the gap between them is the signal — evaluation principle #2
 * says their number is the real one, and a self score that keeps drifting above
 * it is the early warning the plan's "fail sớm, fix sớm" depends on.
 *
 * `reportSentAt` / `repliedAt` carry rule #4: no reply = no data = fail. An
 * unanswered report is not "pending", it is a metric already failing.
 */
export async function POST(request: NextRequest) {
  try {
    const viewer = await getProbationViewer()
    if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const email = viewer.email as string

    const body = await request.json()
    const { weekKey } = body ?? {}
    if (typeof weekKey !== "string" || !weekKey) {
      return NextResponse.json({ error: "weekKey is required" }, { status: 400 })
    }

    const existing = await getWeek(email, weekKey)
    const num = (v: unknown, fallback: number | null): number | null => {
      if (v === null) return null
      if (v === undefined) return fallback
      const n = Number(v)
      return Number.isFinite(n) ? n : fallback
    }

    // Once a week is sent, its report text is frozen. What you were scored on is
    // the text they read — letting a later edit rewrite history would make the
    // confirmed score unauditable, which is the whole point of storing it.
    // A week marked sent from the Overview tab before any draft was saved has no
    // text yet — freezing that would lock in an empty report. The freeze starts
    // once there is something to freeze.
    const alreadySent = existing?.reportState === "sent" && !!existing?.reportText
    const reportText = alreadySent
      ? existing?.reportText
      : typeof body.reportText === "string"
        ? body.reportText
        : existing?.reportText
    const reportState = alreadySent
      ? "sent"
      : body.reportState === "sent" || body.reportSentAt
        ? "sent"
        : body.reportState === "draft" || body.reportText !== undefined
          ? "draft"
          : existing?.reportState

    await saveWeek(email, {
      weekKey,
      selfScore: num(body.selfScore, existing?.selfScore ?? null),
      confirmedScore: num(body.confirmedScore, existing?.confirmedScore ?? null),
      confirmedBy: body.confirmedBy ?? existing?.confirmedBy,
      confirmedNote: body.confirmedNote ?? existing?.confirmedNote,
      reportSentAt: body.reportSentAt ?? existing?.reportSentAt ?? null,
      repliedAt: body.repliedAt ?? existing?.repliedAt ?? null,
      reportText,
      reportState,
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save week"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
