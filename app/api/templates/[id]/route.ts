import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { name, primary_text, headline, description, link, cta, tags } = body

    const db = createAdminClient()
    const { data, error } = await db
      .from("ad_copy_templates")
      .update({
        ...(name !== undefined && { name: name.trim() }),
        ...(primary_text !== undefined && { primary_text }),
        ...(headline !== undefined && { headline }),
        ...(description !== undefined && { description }),
        ...(link !== undefined && { link }),
        ...(cta !== undefined && { cta }),
        ...(tags !== undefined && { tags }),
      })
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ template: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const db = createAdminClient()
    const { error } = await db
      .from("ad_copy_templates")
      .delete()
      .eq("id", id)
      .eq("org_id", ctx.orgId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
