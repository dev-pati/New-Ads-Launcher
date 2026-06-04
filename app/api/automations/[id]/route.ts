import { NextRequest, NextResponse } from "next/server"
import { getAuthContext }            from "@/lib/auth"
import { createClient }              from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const supabase = await createClient()
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

    const { id } = await params
    const body = await request.json()
    const { name, trigger_type, trigger_config, conditions, actions, ad_account_ids, status, notif_config, steps } = body

    const supabase = await createClient()
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

    const { data, error } = await supabase
      .from("automations")
      .update(updates)
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ automation: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const supabase = await createClient()
    const { error } = await supabase
      .from("automations").delete().eq("id", id).eq("org_id", ctx.orgId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
