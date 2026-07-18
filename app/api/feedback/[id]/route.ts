import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, requireRole } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { isValidStatus } from "@/lib/feedback-taxonomy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const denied = requireRole(ctx, new Set(["admin"]))
    if (denied) return denied

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
      .eq("org_id", ctx.orgId)
      .select("*")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json({ feedback: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update feedback"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
