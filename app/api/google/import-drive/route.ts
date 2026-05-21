import { NextRequest, NextResponse, after } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { uploadImageToMeta } from "@/lib/facebook"
import { createAdminClient } from "@/lib/supabase/admin"
import { mapCreativeForClient } from "@/lib/creative-media"

// POST /api/google/import-drive
// Downloads a file from Google Drive using the user's OAuth token.
// Images: sync upload to Meta + Supabase Storage → status=ready immediately.
// Videos: TUS upload to Supabase → status=pending returned to client immediately,
//         background IIFE uploads buffer directly to Meta → status=processing,
//         client thumbnail polling transitions to status=ready once Meta finishes.
export const runtime = "nodejs"
export const maxDuration = 120
export const dynamic = "force-dynamic"

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-")
}

// TUS resumable upload — splits into 6 MB chunks to avoid Caddy 413 on large files
async function tusUpload(
  supabaseUrl: string,
  serviceRoleKey: string,
  bucket: string,
  objectPath: string,
  data: ArrayBuffer,
  mimeType: string,
  cfHeaders: Record<string, string> = {}
) {
  const CHUNK = 6 * 1024 * 1024
  const total = data.byteLength
  const base = (s: string) => Buffer.from(s).toString("base64")

  const initRes = await fetch(`${supabaseUrl}/storage/v1/upload/resumable`, {
    method: "POST",
    headers: {
      ...cfHeaders,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/offset+octet-stream",
      "Content-Length": "0",
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(total),
      "Upload-Metadata": `bucketName ${base(bucket)},objectName ${base(objectPath)},contentType ${base(mimeType)}`,
    },
  })
  if (!initRes.ok) throw new Error(`TUS init failed (${initRes.status}): ${await initRes.text()}`)

  const location = initRes.headers.get("Location") || ""
  const uploadUrl = location.startsWith("http") ? location : `${supabaseUrl}${location}`

  let offset = 0
  while (offset < total) {
    const end = Math.min(offset + CHUNK, total)
    const chunk = data.slice(offset, end)
    const patchRes = await fetch(uploadUrl, {
      method: "PATCH",
      headers: {
        ...cfHeaders,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/offset+octet-stream",
        "Content-Length": String(end - offset),
        "Upload-Offset": String(offset),
        "Tus-Resumable": "1.0.0",
      },
      body: chunk,
    })
    if (!patchRes.ok) throw new Error(`TUS chunk failed at ${offset} (${patchRes.status}): ${await patchRes.text()}`)
    offset = end
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { accessToken, fileId, fileName, mimeType, adAccountId } = await request.json()
    if (!accessToken || !fileId || !adAccountId) {
      return NextResponse.json({ error: "accessToken, fileId, adAccountId required" }, { status: 400 })
    }

    const isVideo = (mimeType as string)?.startsWith("video/")
    const isImage = (mimeType as string)?.startsWith("image/")
    if (!isVideo && !isImage) {
      return NextResponse.json({ error: `Unsupported file type: ${mimeType}` }, { status: 400 })
    }

    // ── Download from Google Drive ────────────────────────────────────────────
    let driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    // Large files may return a virus-scan confirmation HTML page
    const contentType = driveRes.headers.get("content-type") || ""
    if (contentType.includes("text/html")) {
      const html = await driveRes.text()
      const match = html.match(/name="confirm" value="([^"]+)"/)
      if (!match) {
        return NextResponse.json({
          error: "Google Drive returned an HTML page instead of the file. Check file permissions or try again.",
        }, { status: 400 })
      }
      driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&confirm=${match[1]}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
    }

    if (!driveRes.ok) {
      const errText = await driveRes.text()
      return NextResponse.json({ error: `Drive download failed (${driveRes.status}): ${errText}` }, { status: 400 })
    }

    const fileBuffer = await driveRes.arrayBuffer()

    // Sanity check: detect accidental HTML download (e.g. access-denied page)
    if (fileBuffer.byteLength < 5000) {
      const head = new TextDecoder().decode(fileBuffer.slice(0, 100)).toLowerCase()
      if (head.includes("<!doctype html") || head.includes("<html")) {
        return NextResponse.json({ error: "Downloaded content appears to be HTML, not a media file." }, { status: 400 })
      }
    }

    const fileSize = fileBuffer.byteLength
    const admin = createAdminClient()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const cfHeaders: Record<string, string> = {}
    if (process.env.CF_ACCESS_CLIENT_ID) cfHeaders["CF-Access-Client-Id"] = process.env.CF_ACCESS_CLIENT_ID
    if (process.env.CF_ACCESS_CLIENT_SECRET) cfHeaders["CF-Access-Client-Secret"] = process.env.CF_ACCESS_CLIENT_SECRET

    const normAccountId = (adAccountId as string).startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const storagePath = `creatives/${ctx.orgId}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`

    // ── Images: sync Meta upload (small, fast) ───────────────────────────────
    if (isImage) {
      const connection = await getFacebookConnection(ctx.orgId)
      if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

      const r = await uploadImageToMeta(normAccountId, connection.access_token, fileBuffer, fileName)

      try {
        await tusUpload(supabaseUrl, serviceRoleKey, "ad-media", storagePath, fileBuffer, mimeType, cfHeaders)
      } catch (e: any) {
        console.error("[import-drive] Storage upload error (image):", e)
      }
      const { data: { publicUrl } } = admin.storage.from("ad-media").getPublicUrl(storagePath)

      const { data: creative, error: insertError } = await admin
        .from("creatives")
        .insert({
          org_id: ctx.orgId,
          user_id: ctx.user.id,
          ad_account_id: normAccountId,
          file_name: fileName,
          file_url: publicUrl,
          storage_path: storagePath,
          media_type: "image",
          file_size: fileSize,
          fb_image_hash: r.hash,
          fb_image_url: r.url,
          fb_thumbnail_url: r.url_128 || r.url,
          fb_video_id: null,
          status: "ready",
        })
        .select()
        .single()

      if (insertError) {
        console.error("[import-drive] DB insert error (image):", insertError)
        return NextResponse.json({ error: `Database error: ${insertError.message}` }, { status: 500 })
      }
      return NextResponse.json({ creative: mapCreativeForClient(creative) }, { status: 201 })
    }

    // ── Videos: dedup check before uploading ─────────────────────────────────
    const { data: existingVideo } = await admin
      .from("creatives")
      .select("id, file_name, file_url, media_type, fb_image_url, fb_thumbnail_url, fb_image_hash, fb_video_id, status, ad_account_id, created_at")
      .eq("org_id", ctx.orgId)
      .eq("file_name", fileName)
      .eq("file_size", fileSize)
      .eq("media_type", "video")
      .neq("status", "error")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingVideo) {
      return NextResponse.json({ creative: mapCreativeForClient(existingVideo) })
    }

    // ── Videos: upload to Supabase Storage via TUS, defer Meta to cron ─────────
    try {
      await tusUpload(supabaseUrl, serviceRoleKey, "ad-media", storagePath, fileBuffer, mimeType, cfHeaders)
    } catch (e: any) {
      console.error("[import-drive] Storage upload error (video):", e)
      return NextResponse.json({ error: `Storage upload failed: ${e.message}` }, { status: 500 })
    }

    const { data: { publicUrl } } = admin.storage.from("ad-media").getPublicUrl(storagePath)

    const { data: creative, error: insertError } = await admin
      .from("creatives")
      .insert({
        org_id: ctx.orgId,
        user_id: ctx.user.id,
        ad_account_id: normAccountId,
        file_name: fileName,
        file_url: publicUrl,
        storage_path: storagePath,
        media_type: "video",
        file_size: fileSize,
        fb_image_hash: null,
        fb_image_url: null,
        fb_thumbnail_url: null,
        fb_video_id: null,
        status: "pending",
      })
      .select()
      .single()

    if (insertError) {
      console.error("[import-drive] DB insert error (video):", insertError)
      return NextResponse.json({ error: `Database error: ${insertError.message}` }, { status: 500 })
    }

    // after() keeps the Vercel Lambda alive after response is sent — bare IIFEs are
    // killed immediately in serverless environments once the response returns.
    const creativeId = creative.id
    const capturedBuffer = fileBuffer
    after(async () => {
      try {
        const conn = await getFacebookConnection(ctx.orgId)
        if (!conn?.access_token) {
          console.error(`[import-drive] no Facebook connection for org ${ctx.orgId}`)
          return
        }
        const form = new FormData()
        form.append("access_token", conn.access_token)
        form.append("name", fileName as string)
        form.append("file", new Blob([capturedBuffer], { type: mimeType as string }), fileName as string)
        const metaRes = await fetch(`https://graph-video.facebook.com/v21.0/${normAccountId}/advideos`, {
          method: "POST",
          body: form,
        })
        const metaData = await metaRes.json()
        if (!metaRes.ok || metaData.error) {
          throw new Error(metaData.error?.message || `Meta video upload failed (${metaRes.status})`)
        }
        await admin.from("creatives")
          .update({ fb_video_id: metaData.id, status: "processing" })
          .eq("id", creativeId)
        console.log(`[import-drive] video ${creativeId} sent to Meta: ${metaData.id}`)
      } catch (e: any) {
        console.error(`[import-drive] background Meta upload failed for ${creativeId}:`, e.message)
        await admin.from("creatives").update({ status: "error" }).eq("id", creativeId)
      }
    })

    return NextResponse.json({ creative: mapCreativeForClient(creative) }, { status: 201 })
  } catch (err: any) {
    console.error("[import-drive] Error:", err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
