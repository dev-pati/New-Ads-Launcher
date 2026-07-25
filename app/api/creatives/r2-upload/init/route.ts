import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { initR2Upload } from "@/lib/r2-upload-client"

const ALLOWED_MIME = new Set(["video/mp4", "video/quicktime", "image/jpeg", "image/png", "image/webp"])
const MAX_SIZE = 1024 * 1024 * 1024 // 1 GiB

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
    const { fileName, mimeType, sizeBytes } = body as {
      fileName?: string
      mimeType?: string
      sizeBytes?: number
    }

    if (typeof fileName !== "string" || !fileName.trim()) {
      return NextResponse.json({ error: "fileName is required" }, { status: 400 })
    }
    if (typeof mimeType !== "string" || !ALLOWED_MIME.has(mimeType)) {
      return NextResponse.json({ error: "Unsupported mimeType" }, { status: 400 })
    }
    if (typeof sizeBytes !== "number" || sizeBytes <= 0 || sizeBytes > MAX_SIZE || !Number.isFinite(sizeBytes)) {
      return NextResponse.json({ error: "Invalid sizeBytes" }, { status: 400 })
    }

    // Client-generated idempotency key is preferred; fall back to a random UUID.
    const idempotencyKey =
      (typeof body.idempotencyKey === "string" && body.idempotencyKey) || crypto.randomUUID()

    const init = await initR2Upload(
      { orgId: ctx.orgId, actorId: ctx.user.id, fileName, mimeType, sizeBytes },
      idempotencyKey
    )
    return NextResponse.json(init)
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status
    const message = err instanceof Error ? err.message : "Failed to init upload"
    return NextResponse.json({ error: message }, { status: status || 500 })
  }
}
