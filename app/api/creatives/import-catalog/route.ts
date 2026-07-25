import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { mapCreativeForClient, parseStoragePath } from "@/lib/creative-media"

const MAX_IMPORT_DESCRIPTORS = 50
const ALLOWED_ROLES = new Set(["admin", "editor"])

interface CatalogDescriptor {
  fileUrl: string
  storagePath: string
  fileName?: string
  mediaType?: "image" | "video"
  mimeType?: string
  sizeBytes?: number
  approvalStatus?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function parseDescriptor(value: unknown): { ok: true; descriptor: CatalogDescriptor } | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: "descriptor must be an object" }
  const fileUrl = value.fileUrl
  const storagePath = value.storagePath
  const fileName = value.fileName
  const mediaType = value.mediaType
  const mimeType = value.mimeType
  const sizeBytes = value.sizeBytes
  const approvalStatus = value.approvalStatus

  if (typeof fileUrl !== "string" || !fileUrl.startsWith("https://creative.patigroup.com/api/media/")) {
    return { ok: false, error: "fileUrl must be a Creative Portal resolver URL" }
  }
  if (typeof storagePath !== "string") return { ok: false, error: "storagePath is required" }
  const locator = parseStoragePath(storagePath)
  if (locator.provider !== "creative_media_r2") return { ok: false, error: "storagePath must be r2://" }
  if (locator.bucket !== "pati-videos") return { ok: false, error: "storagePath bucket must be pati-videos" }
  if (!locator.key.startsWith("creative-portal/approved/")) {
    return { ok: false, error: "storagePath must be Portal-approved media" }
  }
  if (approvalStatus !== undefined && approvalStatus !== "approved") {
    return { ok: false, error: "approvalStatus must be approved" }
  }
  if (mediaType !== undefined && mediaType !== "image" && mediaType !== "video") {
    return { ok: false, error: "mediaType must be image or video" }
  }
  if (mimeType !== undefined && typeof mimeType !== "string") return { ok: false, error: "mimeType must be a string" }
  if (fileName !== undefined && typeof fileName !== "string") return { ok: false, error: "fileName must be a string" }
  if (sizeBytes !== undefined && (typeof sizeBytes !== "number" || sizeBytes < 0 || !Number.isFinite(sizeBytes))) {
    return { ok: false, error: "sizeBytes must be a positive number" }
  }

  return {
    ok: true,
    descriptor: {
      fileUrl,
      storagePath,
      fileName: fileName || "imported_media",
      mediaType: mediaType || (mimeType?.startsWith("image/") ? "image" : "video"),
      mimeType,
      sizeBytes: sizeBytes || 0,
      approvalStatus: "approved",
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!ALLOWED_ROLES.has(ctx.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!isRecord(body) || !Array.isArray(body.descriptors)) {
      return NextResponse.json({ error: "descriptors array is required" }, { status: 400 })
    }

    const dryRun = body.dryRun === true
    if (body.descriptors.length === 0) {
      return NextResponse.json({ error: "descriptors cannot be empty" }, { status: 400 })
    }
    if (body.descriptors.length > MAX_IMPORT_DESCRIPTORS) {
      return NextResponse.json({ error: `max ${MAX_IMPORT_DESCRIPTORS} descriptors per request` }, { status: 400 })
    }

    const descriptors: CatalogDescriptor[] = []
    for (const raw of body.descriptors) {
      const parsed = parseDescriptor(raw)
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
      descriptors.push(parsed.descriptor)
    }

    const supabase = createAdminClient()
    const storagePaths = descriptors.map((descriptor) => descriptor.storagePath)
    const { data: existing, error: existingError } = await supabase
      .from("creatives")
      .select("id, storage_path")
      .eq("org_id", ctx.orgId)
      .in("storage_path", storagePaths)

    if (existingError) {
      console.error("[creatives/import-catalog] existing lookup error:", existingError)
      return NextResponse.json({ error: "Database error during validation" }, { status: 500 })
    }

    const existingPaths = new Set((existing || []).map((row) => row.storage_path).filter(Boolean))
    const inserts = descriptors
      .filter((descriptor) => !existingPaths.has(descriptor.storagePath))
      .map((descriptor) => ({
        org_id: ctx.orgId,
        user_id: ctx.user.id,
        file_url: descriptor.fileUrl,
        storage_path: descriptor.storagePath,
        file_name: descriptor.fileName || "imported_media",
        media_type: descriptor.mediaType || "video",
        file_size: descriptor.sizeBytes || 0,
        status: "approved",
      }))

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        total: descriptors.length,
        wouldInsert: inserts.length,
        alreadyExists: existingPaths.size,
      })
    }

    if (inserts.length === 0) {
      return NextResponse.json({ success: true, count: 0, skippedExisting: existingPaths.size, creatives: [] })
    }

    const { data, error } = await supabase
      .from("creatives")
      .insert(inserts)
      .select()

    if (error) {
      console.error("[creatives/import-catalog] insert error:", error)
      return NextResponse.json({ error: "Database error during import" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      count: data.length,
      skippedExisting: existingPaths.size,
      creatives: data.map(mapCreativeForClient),
    }, { status: 201 })
  } catch (err) {
    console.error("[creatives/import-catalog] error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
