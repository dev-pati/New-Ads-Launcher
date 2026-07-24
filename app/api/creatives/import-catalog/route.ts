import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { mapCreativeForClient } from "@/lib/creative-media"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    if (!Array.isArray(body.descriptors)) {
      return NextResponse.json({ error: "descriptors array is required" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const inserts = body.descriptors.map((desc: {
      fileUrl: string;
      storagePath: string;
      fileName?: string;
      mediaType?: string;
      mimeType?: string;
      sizeBytes?: number;
      approvalStatus?: string;
      brandId?: string;
      productId?: string;
    }) => {
      // "The resulting descriptor contains brandId, productId, fileUrl, storagePath,
      // approvalStatus='approved', and briefId=null, ready for a later AdManage catalog import."
      // No byte copy or fake workflow rows (no dummy assignments/submissions).
      return {
        org_id: ctx.orgId,
        user_id: ctx.user.id,
        file_url: desc.fileUrl,
        storage_path: desc.storagePath,
        file_name: desc.fileName || "imported_media",
        media_type: desc.mediaType || (desc.mimeType?.startsWith("image/") ? "image" : "video"),
        file_size: desc.sizeBytes || 0,
        status: desc.approvalStatus === "approved" ? "approved" : "ready"
      }
    })

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
      count: data.length,
      creatives: data.map(mapCreativeForClient)
    }, { status: 201 })
  } catch (err) {
    console.error("[creatives/import-catalog] error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
