import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { executeAutomation } from "@/lib/automation-engine"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// POST /api/automations/[id]/run
// Body: { file_id?, file_name?, file_url?, mime_type?, thumbnail_url?, is_test? }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const result = await executeAutomation(id, ctx.orgId, {
      fileId:       body.file_id,
      fileName:     body.file_name,
      fileUrl:      body.file_url,
      mimeType:     body.mime_type,
      thumbnailUrl: body.thumbnail_url,
      isTest:       body.is_test ?? false, // default false — caller must explicitly set is_test:true for dry runs
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
