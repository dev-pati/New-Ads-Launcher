import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

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
      .from("creatives")
      .select("*")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .single()

    if (error) return NextResponse.json({ error: "Creative not found" }, { status: 404 })
    return NextResponse.json({ creative: data })
  } catch (err) {
    console.error("Failed to fetch creative:", err)
    return NextResponse.json({ error: "Failed to fetch creative" }, { status: 500 })
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
    const supabase = await createClient()

    const allowedFields = ["headline", "primary_text", "description", "cta", "link_url", "file_name", "status"]
    const updates: Record<string, any> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field]
    }

    const { data, error } = await supabase
      .from("creatives")
      .update(updates)
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: "Failed to update creative" }, { status: 500 })
    return NextResponse.json({ creative: data })
  } catch (err) {
    console.error("Failed to update creative:", err)
    return NextResponse.json({ error: "Failed to update creative" }, { status: 500 })
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

    const { data: creative } = await supabase
      .from("creatives")
      .select("storage_path")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .single()

    if (creative?.storage_path) {
      await supabase.storage.from("ad-media").remove([creative.storage_path])
    }

    await supabase.from("creatives").delete().eq("id", id).eq("org_id", ctx.orgId)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Failed to delete creative:", err)
    return NextResponse.json({ error: "Failed to delete creative" }, { status: 500 })
  }
}
