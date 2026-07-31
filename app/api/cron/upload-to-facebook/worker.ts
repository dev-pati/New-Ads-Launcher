import type { createAdminClient } from "@/lib/supabase/admin"
import { getConnectionForAdAccount, MissingViaError, isManual } from "@/lib/auth"
import { uploadVideoUrlToMeta, uploadImageToMeta } from "@/lib/facebook"
import { CREATIVE_STATUS, isLaunchable, type CreativeStatus } from "@/lib/creative-readiness"
import { PORTAL_MEDIA_ORIGIN } from "@/lib/portal-media/claim"

export type CreativeRow = {
  id: string
  org_id: string
  ad_account_id: string
  file_url: string
  file_name: string
  media_type: string
  status: CreativeStatus
  fb_video_id: string | null
  fb_image_hash: string | null
}

export type UploadResult =
  | { ok: true; kind: "video" | "image"; uploaded: boolean; rateLimitPct: number }
  | { ok: false; permanent: boolean; error: string }

/**
 * Upload one creative to Meta — single source of truth for the legacy pending
 * loop and the B8 job worker. Preserves Via MECE, SEC-008 host allowlist, and
 * skipProof for manual via tokens.
 *
 * Idempotent (TD-35): readiness is asset-id based, never status based — if Meta
 * already has the asset we short-circuit and never re-upload.
 */
export async function processUpload(
  db: ReturnType<typeof createAdminClient>,
  row: CreativeRow
): Promise<UploadResult> {
  if (isLaunchable(row)) {
    return { ok: true, kind: row.media_type === "video" ? "video" : "image", uploaded: false, rateLimitPct: 0 }
  }

  const normAccountId = row.ad_account_id?.startsWith("act_")
    ? row.ad_account_id
    : `act_${row.ad_account_id}`

  let conn
  try {
    conn = await getConnectionForAdAccount(row.org_id, row.ad_account_id, "write")
  } catch (err) {
    if (err instanceof MissingViaError) {
      await db.from("creatives").update({ status: CREATIVE_STATUS.ERROR }).eq("id", row.id)
      return { ok: false, permanent: true, error: "Missing via connection for this ad account" }
    }
    throw err
  }
  if (!conn?.access_token) {
    await db.from("creatives").update({ status: CREATIVE_STATUS.ERROR }).eq("id", row.id)
    return { ok: false, permanent: true, error: "Meta connection is invalid or missing access token" }
  }

  const allowedHosts = new Set<string>()
  try { allowedHosts.add(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host) } catch { /* env unset in test */ }
  try { allowedHosts.add(new URL(PORTAL_MEDIA_ORIGIN).host) } catch { /* env unset in test */ }
  let fileUrlHost: string | null = null
  try { fileUrlHost = new URL(row.file_url).host } catch { /* invalid url */ }
  if (!fileUrlHost || !allowedHosts.has(fileUrlHost)) {
    await db.from("creatives").update({ status: CREATIVE_STATUS.ERROR }).eq("id", row.id)
    return { ok: false, permanent: true, error: `Disallowed file url host: ${fileUrlHost || "invalid URL"}` }
  }

  if (row.media_type === "video") {
    const result = await uploadVideoUrlToMeta(
      normAccountId, conn.access_token, row.file_url, row.file_name,
      { skipProof: isManual(conn) }
    )
    await db.from("creatives")
      .update({ fb_video_id: result.videoId, status: CREATIVE_STATUS.PROCESSING })
      .eq("id", row.id)
    return { ok: true, kind: "video", uploaded: true, rateLimitPct: result.rateLimitPct ?? 0 }
  }

  const imgRes = await fetch(row.file_url)
  if (!imgRes.ok) throw new Error(`Failed to fetch image from Storage: ${imgRes.status}`)
  const imgBuffer = await imgRes.arrayBuffer()
  const result = await uploadImageToMeta(
    normAccountId, conn.access_token, imgBuffer, row.file_name,
    { skipProof: isManual(conn) }
  )
  await db.from("creatives").update({
    fb_image_hash: result.hash,
    fb_image_url: result.url,
    fb_thumbnail_url: result.url_128,
    status: CREATIVE_STATUS.READY,
  }).eq("id", row.id)
  return { ok: true, kind: "image", uploaded: true, rateLimitPct: result.rateLimitPct ?? 0 }
}
