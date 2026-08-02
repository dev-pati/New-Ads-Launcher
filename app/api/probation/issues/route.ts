import { NextRequest, NextResponse } from "next/server"
import { getProbationViewer } from "@/lib/probation/auth"
import { createIssue, deleteEntry, listIssues, updateIssue } from "@/lib/probation/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const viewer = await getProbationViewer()
  if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const issues = await listIssues(viewer.email as string)
  return NextResponse.json({ issues })
}

export async function POST(request: NextRequest) {
  try {
    const viewer = await getProbationViewer()
    if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const { issue, owner, deadline } = body ?? {}
    if (!issue || !owner || !deadline) {
      return NextResponse.json({ error: "issue, owner and deadline are required" }, { status: 400 })
    }

    await createIssue(viewer.email as string, {
      issue,
      owner,
      deadline,
      status: "open",
    })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create issue"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const viewer = await getProbationViewer()
    if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const { id, ...patch } = (await request.json()) ?? {}
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
    await updateIssue(viewer.email as string, id, patch)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update issue"
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
