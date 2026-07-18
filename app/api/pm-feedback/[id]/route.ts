import { NextRequest, NextResponse } from "next/server"
import { getPmViewer } from "@/lib/pm-feedback-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { isValidStatus } from "@/lib/feedback-taxonomy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const viewer = await getPmViewer()
    if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    const body = await request.json()
    const status = String(body?.status || "").trim()

    if (!isValidStatus(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const { data, error } = await createAdminClient()
      .from("feedback_events")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*, org:organizations(id, name, slug)")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ feedback: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update feedback"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
