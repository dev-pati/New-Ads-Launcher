import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp = request.nextUrl.searchParams
    const status = sp.get("status")

    const supabase = await createClient()
    let q = supabase
      .from("automations")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })

    if (status) q = q.eq("status", status)

    const { data, error } = await q
    // Gracefully handle missing table (migration not yet applied)
    if (error) {
      if (error.code === "42P01") return NextResponse.json({ automations: [] })
      throw error
    }

    return NextResponse.json({ automations: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { name, description, trigger_type, trigger_config, conditions, actions, ad_account_ids, requires_approval, template_id, notif_config, steps } = body

    if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("automations")
      .insert({
        org_id: ctx.orgId,
        name: name.trim(),
        description: description || null,
        trigger_type: trigger_type || (steps?.[0]?.triggerConfig?.event ?? "performance_monitoring"),
        trigger_config: trigger_config || steps?.[0]?.triggerConfig || {},
        conditions: conditions || [],
        actions: actions || steps?.slice(1) || [],
        steps: steps || null,
        ad_account_ids: ad_account_ids || [],
        requires_approval: requires_approval || false,
        template_id: template_id || null,
        notif_config: notif_config || null,
        status: "active",
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ automation: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
