import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { emitAndLog } from "@/lib/notifications/emit"
import { conflictResponse, readExpectedVersion, updateWithVersion } from "@/lib/optimistic-update"
import { getActorName } from "@/lib/upload-utils"

// Single template — used by the Launch page when opened with ?template=<id>.
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const db = createAdminClient()
    const { data, error } = await db
      .from("ad_copy_templates")
      .select("*")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Template not found" }, { status: 404 })
    return NextResponse.json({ template: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { name, primary_text, headline, description, link, cta, tags } = body

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name.trim()
    if (primary_text !== undefined) updates.primary_text = primary_text
    if (headline !== undefined) updates.headline = headline
    if (description !== undefined) updates.description = description
    if (link !== undefined) updates.link = link
    if (cta !== undefined) updates.cta = cta
    if (tags !== undefined) updates.tags = tags

    const expectedVersion = readExpectedVersion(body)
    if (expectedVersion === "invalid") {
      return NextResponse.json({ error: "Invalid expected_version" }, { status: 400 })
    }

    const db = createAdminClient()
    const outcome = await updateWithVersion<Record<string, any>>({
      db,
      table: "ad_copy_templates",
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
      if (outcome.kind === "not_found") return NextResponse.json({ error: "Template not found" }, { status: 404 })
      if (outcome.kind === "conflict") return conflictResponse(outcome.conflict)
      return NextResponse.json({ error: "Failed to update template" }, { status: 500 })
    }

    const data = outcome.row

    if (outcome.changes.length > 0) {
      void emitAndLog("templates.update", {
        orgId: ctx.orgId,
        actorId: ctx.user.id,
        actorName: getActorName(ctx.user),
        type: "template.updated",
        action: "updated",
        objectType: "template",
        objectId: id,
        objectName: data.name || null,
        changes: outcome.changes,
        link: "/templates",
        dedupeKey: `template.updated:${id}:${Date.now()}`,
        source: "templates.update",
      })
    }

    return NextResponse.json({ template: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const db = createAdminClient()
    const { error } = await db
      .from("ad_copy_templates")
      .delete()
      .eq("id", id)
      .eq("org_id", ctx.orgId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
