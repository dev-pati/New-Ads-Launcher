import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const supabase = createAdminClient()
    await supabase.from("page_links").delete().eq("id", id).eq("org_id", ctx.orgId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Failed to delete page link:", err)
    return NextResponse.json({ error: "Failed to delete page link" }, { status: 500 })
  }
}
