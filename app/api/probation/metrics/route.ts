import { NextRequest, NextResponse } from "next/server"
import { getProbationViewer } from "@/lib/probation/auth"
import { getConfig, saveReading } from "@/lib/probation/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Record one manual metric reading (or the "unaided" tick on an auto metric). */
export async function POST(request: NextRequest) {
  try {
    const viewer = await getProbationViewer()
    if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const email = viewer.email as string

    const body = await request.json()
    const { metricId, weekKey, value, confirmed, note, evidence } = body ?? {}

    if (typeof metricId !== "string" || typeof weekKey !== "string") {
      return NextResponse.json({ error: "metricId and weekKey are required" }, { status: 400 })
    }

    const config = await getConfig(email)
    const def = config.metrics.find((m) => m.id === metricId)
    if (!def) return NextResponse.json({ error: `Unknown metric "${metricId}"` }, { status: 400 })

    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric < 0) {
      return NextResponse.json({ error: "value must be a number ≥ 0" }, { status: 400 })
    }

    await saveReading(email, {
      metricId,
      weekKey,
      value: numeric,
      confirmed: typeof confirmed === "boolean" ? confirmed : undefined,
      note: typeof note === "string" ? note : undefined,
      evidence: typeof evidence === "string" ? evidence : undefined,
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save metric"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
