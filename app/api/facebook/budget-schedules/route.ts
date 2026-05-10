import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const GRAPH = "https://graph.facebook.com/v25.0"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp = request.nextUrl.searchParams
    const adAccountId = sp.get("adAccountId") || ""

    const supabase = await createClient()
    let q = supabase
      .from("budget_schedules")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("scheduled_at", { ascending: true })

    if (adAccountId) {
      const norm = adAccountId.startsWith("act_") ? adAccountId.slice(4) : adAccountId
      q = q.ilike("ad_account_id", `%${norm}%`)
    }

    const { data, error } = await q
    if (error) {
      if (error.code === "42P01") return NextResponse.json({ schedules: [] })
      throw error
    }

    return NextResponse.json({ schedules: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { adAccountId, adsetId, adsetName, ruleName, changeType, newBudget, percentage, scheduledAt, timezone } = body

    if (!adAccountId || !adsetId || !ruleName || !scheduledAt) {
      return NextResponse.json({ error: "adAccountId, adsetId, ruleName, scheduledAt required" }, { status: 400 })
    }
    if (changeType === "absolute" && !newBudget) {
      return NextResponse.json({ error: "newBudget required for absolute change" }, { status: 400 })
    }
    if (["percentage_increase", "percentage_decrease"].includes(changeType) && !percentage) {
      return NextResponse.json({ error: "percentage required for percentage change" }, { status: 400 })
    }

    const norm = adAccountId.startsWith("act_") ? adAccountId.slice(4) : adAccountId

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("budget_schedules")
      .insert({
        org_id: ctx.orgId,
        ad_account_id: norm,
        adset_id: adsetId,
        adset_name: adsetName || null,
        rule_name: ruleName,
        change_type: changeType || "absolute",
        new_budget: newBudget ? parseFloat(newBudget) : null,
        percentage: percentage ? parseFloat(percentage) : null,
        scheduled_at: scheduledAt,
        timezone: timezone || "UTC",
        status: "active",
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ schedule: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const supabase = await createClient()
    const { error } = await supabase
      .from("budget_schedules")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("org_id", ctx.orgId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
