import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { signR2Upload } from "@/lib/r2-upload-client"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null)
    const { assetId } = (body || {}) as { assetId?: string }
    if (typeof assetId !== "string" || !assetId.trim()) {
      return NextResponse.json({ error: "assetId is required" }, { status: 400 })
    }

    const result = await signR2Upload(ctx.orgId, ctx.user.id, assetId)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status
    const message = err instanceof Error ? err.message : "Failed to sign upload"
    return NextResponse.json({ error: message }, { status: status || 500 })
  }
}
