import { NextRequest, NextResponse } from "next/server"
import { getProbationViewer } from "@/lib/probation/auth"
import { createException, deleteEntry, getConfig, listExceptions, updateException } from "@/lib/probation/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const viewer = await getProbationViewer()
  if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const exceptions = await listExceptions(viewer.email as string)
  return NextResponse.json({ exceptions })
}

export async function POST(request: NextRequest) {
  try {
    const viewer = await getProbationViewer()
    if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const email = viewer.email as string

    const body = await request.json()
    const { date, category, description, evidence, approved, metricId } = body ?? {}

    if (!date || !category || !description) {
      return NextResponse.json(
        { error: "date, category and description are required" },
        { status: 400 }
      )
    }

    // Closed set: the plan fixed these categories to stop end-of-period arguments.
    // Accepting a free-text category here would reopen exactly that.
    const config = await getConfig(email)
    if (!config.exceptionCategories.some((c) => c.id === category)) {
      return NextResponse.json({ error: `Unknown exception category "${category}"` }, { status: 400 })
    }

    await createException(email, {
      date,
      category,
      description,
      evidence: evidence || "",
      approved: approved === true,
      metricId: typeof metricId === "string" && metricId ? metricId : undefined,
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create exception"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const viewer = await getProbationViewer()
    if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const { id, ...patch } = (await request.json()) ?? {}
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
    await updateException(viewer.email as string, id, patch)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update exception"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const viewer = await getProbationViewer()
  if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
  await deleteEntry(viewer.email as string, id)
  return NextResponse.json({ ok: true })
}
