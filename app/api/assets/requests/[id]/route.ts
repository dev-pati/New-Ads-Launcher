import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { emitAndLog } from "@/lib/notifications/emit"
import { conflictResponse, readExpectedVersion, updateWithVersion } from "@/lib/optimistic-update"
import { getActorName } from "@/lib/upload-utils"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const db = createAdminClient()

    const allowed = ["title", "description", "status", "due_date"]
    const updates: Record<string, any> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    const expectedVersion = readExpectedVersion(body)
    if (expectedVersion === "invalid") {
      return NextResponse.json({ error: "Invalid expected_version" }, { status: 400 })
    }

    const outcome = await updateWithVersion<Record<string, any>>({
      db,
      table: "creative_requests",
      id,
      orgId: ctx.orgId,
      expectedVersion,
      updates,
      actorId: ctx.user.id,
      baseline: body.baseline ?? null,
      resolveActorName: async userId => {
        if (!userId) return null
        const { data: account } = await db
          .from("accounts")
          .select("full_name, email")
          .eq("id", userId)
          .maybeSingle()
        return account?.full_name || account?.email?.split("@")[0] || null
      },
    })

    if (outcome.ok === false) {
      if (outcome.kind === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 })
      if (outcome.kind === "conflict") return conflictResponse(outcome.conflict)
      return NextResponse.json({ error: "Failed to update request" }, { status: 500 })
    }

    const data = outcome.row
    const statusChanged = outcome.changes.some(c => c.field === "status")

    if (outcome.changes.length > 0) {
      void emitAndLog("requests.update", {
        orgId: ctx.orgId,
        actorId: ctx.user.id,
        actorName: getActorName(ctx.user),
        type: statusChanged ? "request.status_changed" : "request.updated",
        action: "updated",
        objectType: "request",
        objectId: id,
        objectName: data.title || null,
        changes: outcome.changes,
        link: "/assets/requests",
        dedupeKey: `request.updated:${id}:${Date.now()}`,
        source: "requests.update",
      })
    }

    return NextResponse.json({ request: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const db = createAdminClient()

    const { error } = await db
      .from("creative_requests")
      .delete()
      .eq("id", id)
      .eq("org_id", ctx.orgId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
