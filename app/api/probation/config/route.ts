import { NextRequest, NextResponse } from "next/server"
import { getProbationViewer } from "@/lib/probation/auth"
import { getConfig, saveConfig } from "@/lib/probation/store"
import type { ProbationConfig } from "@/lib/probation/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const viewer = await getProbationViewer()
  if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const config = await getConfig(viewer.email as string)
  return NextResponse.json({ config })
}

/**
 * Replace the KR config.
 *
 * Written by the dashboard's Scoring tab. Whole-object replace, not a patch:
 * the point splits have to be validated as a set (they must sum to 100), so a
 * partial update could not be checked.
 */
export async function PUT(request: NextRequest) {
  try {
    const viewer = await getProbationViewer()
    if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const incoming = (body?.config ?? body) as ProbationConfig

    if (!incoming || !Array.isArray(incoming.metrics) || !Array.isArray(incoming.krs)) {
      return NextResponse.json({ error: "config.metrics and config.krs are required" }, { status: 400 })
    }

    const total = incoming.metrics.reduce((s, m) => s + (Number(m.points) || 0), 0)
    if (Math.abs(total - 100) > 0.01) {
      return NextResponse.json(
        { error: `Metric points must sum to 100, got ${total}` },
        { status: 400 }
      )
    }

    await saveConfig(viewer.email as string, incoming)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save config"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
