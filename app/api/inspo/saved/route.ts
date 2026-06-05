import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("inspo_saved_ads")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: "Failed to fetch saved ads" }, { status: 500 })
    return NextResponse.json({ ads: data || [] })
  } catch {
    return NextResponse.json({ error: "Failed to fetch saved ads" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const {
      ad_archive_id, page_name, page_id,
      ad_body, ad_title, ad_snapshot_url,
      ad_delivery_start_time, publisher_platforms,
    } = body

    if (!ad_archive_id || !page_name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("inspo_saved_ads")
      .upsert(
        {
          org_id: ctx.orgId,
          user_id: ctx.user.id,
          ad_archive_id,
          page_name,
          page_id: page_id || null,
          ad_body: ad_body || null,
          ad_title: ad_title || null,
          ad_snapshot_url: ad_snapshot_url || null,
          ad_delivery_start_time: ad_delivery_start_time || null,
          publisher_platforms: publisher_platforms || [],
        },
        { onConflict: "org_id,ad_archive_id" }
      )
      .select()
      .single()

    if (error) return NextResponse.json({ error: "Failed to save ad" }, { status: 500 })
    return NextResponse.json({ ad: data })
  } catch {
    return NextResponse.json({ error: "Failed to save ad" }, { status: 500 })
  }
}
