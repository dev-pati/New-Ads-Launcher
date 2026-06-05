import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("user_settings")
      .upsert({ user_id: user.id }, { onConflict: "user_id" })
      .select()
      .single()

    if (error) {
      console.error("Failed to fetch user settings:", error)
      return NextResponse.json({ error: "Failed to fetch user settings" }, { status: 500 })
    }

    return NextResponse.json({ settings: data })
  } catch (err) {
    console.error("Failed to fetch user settings:", err)
    return NextResponse.json({ error: "Failed to fetch user settings" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()

    const allowedFields = ["theme", "ads_filter", "ads_column_widths"]
    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, ...updates }, { onConflict: "user_id" })
      .select()
      .single()

    if (error) {
      console.error("Failed to update user settings:", error)
      return NextResponse.json({ error: "Failed to update user settings" }, { status: 500 })
    }

    return NextResponse.json({ settings: data })
  } catch (err) {
    console.error("Failed to update user settings:", err)
    return NextResponse.json({ error: "Failed to update user settings" }, { status: 500 })
  }
}
