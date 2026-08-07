import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAdDetails } from "@/lib/facebook"
import { recordActivity } from "@/lib/notifications/emit"

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createAdminClient()
    const { data } = await supabase
      .from("ad_set_presets")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })

    return NextResponse.json({ presets: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const { name, adId } = await request.json()
    if (!name?.trim() || !adId) {
      return NextResponse.json({ error: "name and adId are required" }, { status: 400 })
    }

    const template = await getAdDetails(adId, connection.access_token)

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("ad_set_presets")
      .insert({
        org_id: ctx.orgId,
        name: name.trim(),
        objective: template.campaign.objective,
        special_ad_categories: template.campaign.special_ad_categories || [],
        targeting: template.adset.targeting || {},
        optimization_goal: template.adset.optimization_goal,
        billing_event: template.adset.billing_event,
        bid_strategy: template.adset.bid_strategy,
        bid_amount: template.adset.bid_amount,
        adset_name: template.adset.name,
        campaign_name: template.campaign.name,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ad_set_presets has no actor column (TD-31), so this is the only record of who
    // built the preset. Audit-only: saving a preset is not news for the whole org.
    await recordActivity({
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      actorName: ctx.user.user_metadata?.full_name || ctx.user.email?.split("@")[0] || "Someone",
      objectType: "preset",
      objectId: data.id,
      objectName: name.trim(),
      action: "created",
    })

    return NextResponse.json({ preset: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
