import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createAdminClient()
    const { data } = await supabase
      .from("page_links")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })

    return NextResponse.json({ pageLinks: data || [] })
  } catch (err) {
    console.error("Failed to fetch page links:", err)
    return NextResponse.json({ error: "Failed to fetch page links" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { name, url } = await request.json()
    if (!name || !url) {
      return NextResponse.json({ error: "name and url are required" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("page_links")
      .insert({ org_id: ctx.orgId, user_id: ctx.user.id, name, url })
      .select()
      .single()

    if (error) {
      console.error("Failed to create page link:", error)
      return NextResponse.json({ error: "Failed to create page link" }, { status: 500 })
    }

    return NextResponse.json({ pageLink: data }, { status: 201 })
  } catch (err) {
    console.error("Failed to create page link:", err)
    return NextResponse.json({ error: "Failed to create page link" }, { status: 500 })
  }
}
