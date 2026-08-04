import { NextRequest, NextResponse } from "next/server"
import { findRoadmapOnlyAutomationApp } from "@/lib/automation-capabilities"
import { getAuthContext, requireRole }            from "@/lib/auth"
import { createAdminClient }         from "@/lib/supabase/admin"
import { emitAndLog } from "@/lib/notifications/emit"
import { conflictResponse, readExpectedVersion, updateWithVersion } from "@/lib/optimistic-update"
import { getActorName } from "@/lib/upload-utils"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("automations")
      .select("*")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .single()

    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ automation: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const denied = requireRole(ctx)
    if (denied) return denied

    const { id } = await params
    const body = await request.json()
    const { name, trigger_type, trigger_config, conditions, actions, ad_account_ids, status, notif_config, steps } = body
    const roadmapOnlyApp = findRoadmapOnlyAutomationApp(steps)
    if (roadmapOnlyApp) {
      return NextResponse.json(
        { error: `${roadmapOnlyApp} automation is coming soon` },
        { status: 400 },
      )
    }

    const supabase = createAdminClient()
    const updates: Record<string, any> = {}
    if (name           !== undefined) updates.name            = name.trim()
    if (trigger_type   !== undefined) updates.trigger_type    = trigger_type
    if (trigger_config !== undefined) updates.trigger_config  = trigger_config
    if (conditions     !== undefined) updates.conditions      = conditions
    if (actions        !== undefined) updates.actions         = actions
    if (ad_account_ids !== undefined) updates.ad_account_ids  = ad_account_ids
    if (status         !== undefined) updates.status          = status
    if (notif_config   !== undefined) updates.notif_config    = notif_config
    if (steps          !== undefined) updates.steps           = steps

    const expectedVersion = readExpectedVersion(body)
    if (expectedVersion === "invalid") {
      return NextResponse.json({ error: "Invalid expected_version" }, { status: 400 })
    }

    // Automations are edited from a multi-step builder — two admins reordering steps
    // at once must not silently drop one editor's step list.
    const outcome = await updateWithVersion<Record<string, any>>({
      db: supabase,
      table: "automations",
      id,
      orgId: ctx.orgId,
      expectedVersion,
      updates,
      actorId: ctx.user.id,
      baseline: body.baseline ?? null,
      resolveActorName: async userId => {
        if (!userId) return null
        const { data: account } = await supabase
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
      return NextResponse.json({ error: "Failed to update automation" }, { status: 500 })
    }

    const data = outcome.row

    if (outcome.changes.length > 0) {
      void emitAndLog("automations.update", {
        orgId: ctx.orgId,
        actorId: ctx.user.id,
        actorName: getActorName(ctx.user),
        type: "automation.updated",
        action: "updated",
        objectType: "automation",
        objectId: id,
        objectName: data.name || null,
        changes: outcome.changes,
        link: "/automations",
        dedupeKey: `automation.updated:${id}:${Date.now()}`,
        source: "automations.update",
      })
    }

    return NextResponse.json({ automation: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const denied = requireRole(ctx)
    if (denied) return denied

    const { id } = await params
    const supabase = createAdminClient()
    const { error } = await supabase
      .from("automations").delete().eq("id", id).eq("org_id", ctx.orgId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
