import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

// List ads for the active org
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const status = request.nextUrl.searchParams.get("status")
    const pageId = request.nextUrl.searchParams.get("page_id")
    const adAccountId = request.nextUrl.searchParams.get("ad_account_id")

    const supabase = createAdminClient()

    let query = supabase
      .from("ads")
      .select(`
        *,
        ad_media (id, media_type, url, file_name, sort_order),
        page:pages (id, fb_page_id, name, picture_url),
        ad_account:ad_accounts (id, fb_ad_account_id, name, currency)
      `)
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })

    if (status) query = query.eq("status", status)
    if (pageId) query = query.eq("page_id", pageId)
    if (adAccountId) query = query.eq("ad_account_id", adAccountId)

    const { data, error } = await query

    if (error) {
      console.error("Failed to fetch ads:", error)
      return NextResponse.json({ error: "Failed to fetch ads" }, { status: 500 })
    }

    return NextResponse.json({ ads: data || [] })
  } catch (err) {
    console.error("Failed to fetch ads:", err)
    return NextResponse.json({ error: "Failed to fetch ads" }, { status: 500 })
  }
}

// Create a new ad draft
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      page_id,
      ad_account_id,
      name,
      caption,
      headline,
      description,
      link_url,
      cta,
      target_age_min,
      target_age_max,
      target_gender,
      target_locations,
      target_interests,
      budget_type,
      budget_amount,
      schedule_start,
      schedule_end,
    } = body

    if (!page_id || !ad_account_id || !name) {
      return NextResponse.json(
        { error: "page_id, ad_account_id, and name are required" },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Ownership check: page + ad account must belong to the active org
    const [{ data: page }, { data: adAccount }] = await Promise.all([
      supabase
        .from("pages")
        .select("id")
        .eq("id", page_id)
        .eq("org_id", ctx.orgId)
        .maybeSingle(),
      supabase
        .from("ad_accounts")
        .select("id")
        .eq("id", ad_account_id)
        .eq("org_id", ctx.orgId)
        .maybeSingle(),
    ])
    if (!page || !adAccount) {
      return NextResponse.json(
        { error: "page_id or ad_account_id not found in this organization" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("ads")
      .insert({
        org_id: ctx.orgId,
        user_id: ctx.user.id,
        page_id,
        ad_account_id,
        name,
        caption,
        headline,
        description,
        link_url,
        cta: cta || "LEARN_MORE",
        target_age_min: target_age_min || 18,
        target_age_max: target_age_max || 65,
        target_gender: target_gender || "all",
        target_locations: target_locations || [],
        target_interests: target_interests || [],
        budget_type: budget_type || "daily",
        budget_amount,
        schedule_start,
        schedule_end,
        status: "draft",
      })
      .select()
      .single()

    if (error) {
      console.error("Failed to create ad:", error)
      return NextResponse.json({ error: "Failed to create ad" }, { status: 500 })
    }

    return NextResponse.json({ ad: data }, { status: 201 })
  } catch (err) {
    console.error("Failed to create ad:", err)
    return NextResponse.json({ error: "Failed to create ad" }, { status: 500 })
  }
}
