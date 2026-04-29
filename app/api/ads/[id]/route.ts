import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// Get a single ad
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("ads")
      .select(`
        *,
        ad_media (id, media_type, url, file_name, sort_order),
        page:pages (id, fb_page_id, name, picture_url),
        ad_account:ad_accounts (id, fb_ad_account_id, name, currency)
      `)
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: "Ad not found" }, { status: 404 })
    }

    return NextResponse.json({ ad: data })
  } catch (err) {
    console.error("Failed to fetch ad:", err)
    return NextResponse.json({ error: "Failed to fetch ad" }, { status: 500 })
  }
}

// Update an ad
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const supabase = await createClient()

    // Only allow updating certain fields
    const allowedFields = [
      "name", "caption", "headline", "description", "link_url", "cta",
      "target_age_min", "target_age_max", "target_gender",
      "target_locations", "target_interests",
      "budget_type", "budget_amount", "schedule_start", "schedule_end",
      "status", "page_id", "ad_account_id",
    ]

    const updates: Record<string, any> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    const { data, error } = await supabase
      .from("ads")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      console.error("Failed to update ad:", error)
      return NextResponse.json({ error: "Failed to update ad" }, { status: 500 })
    }

    return NextResponse.json({ ad: data })
  } catch (err) {
    console.error("Failed to update ad:", err)
    return NextResponse.json({ error: "Failed to update ad" }, { status: 500 })
  }
}

// Delete an ad
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from("ads")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      console.error("Failed to delete ad:", error)
      return NextResponse.json({ error: "Failed to delete ad" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Failed to delete ad:", err)
    return NextResponse.json({ error: "Failed to delete ad" }, { status: 500 })
  }
}
