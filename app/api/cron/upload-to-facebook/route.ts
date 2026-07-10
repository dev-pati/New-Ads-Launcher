import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { uploadVideoUrlToMeta } from "@/lib/facebook"
import { parseRateLimit } from "@/lib/facebook"
import { getConnectionForAdAccount, MissingViaError } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_VIDEOS_PER_ORG = 5
// Adaptive batch size based on current rate limit pct
function batchSize(pct: number): number {
  if (pct >= 60) return 0  // pause entirely
  if (pct >= 40) return 1
  if (pct >= 20) return 2
  return 3
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createAdminClient()
  const uploaded: string[] = []
  const skipped: string[] = []
  const errors: { id: string; error: string }[] = []

  // Fetch up to 50 pending videos, oldest first
  const { data: pending } = await db
    .from("creatives")
    .select("id, org_id, ad_account_id, file_url, file_name")
    .eq("status", "pending")
    .eq("media_type", "video")
    .is("fb_video_id", null)
    .order("created_at", { ascending: true })
    .limit(50)

  if (!pending || pending.length === 0) {
    return NextResponse.json({ uploaded: 0, skipped: 0, errors: 0 })
  }

  // Group by org_id
  const byOrg = new Map<string, typeof pending>()
  for (const row of pending) {
    const list = byOrg.get(row.org_id) ?? []
    list.push(row)
    byOrg.set(row.org_id, list)
  }

  for (const [orgId, rows] of byOrg) {
    let currentRatePct = 0
    const limit = Math.min(rows.length, MAX_VIDEOS_PER_ORG)

    for (let i = 0; i < limit; i++) {
      const row = rows[i]
      const allowed = batchSize(currentRatePct)
      if (allowed === 0) {
        // Rate limit too high — skip remaining videos for this org this run
        for (let j = i; j < limit; j++) skipped.push(rows[j].id)
        break
      }

      try {
        // Via MECE: upload video = WRITE — resolve theo ad_account_id của từng creative
        // (via launch của account → OAuth của org → skip nếu không có)
        let conn
        try {
          conn = await getConnectionForAdAccount(orgId, row.ad_account_id, "write")
        } catch (err) {
          if (err instanceof MissingViaError) {
            skipped.push(row.id)
            continue
          }
          throw err
        }
        if (!conn?.access_token) {
          skipped.push(row.id)
          continue
        }

        const normAccountId = row.ad_account_id?.startsWith("act_")
          ? row.ad_account_id
          : `act_${row.ad_account_id}`

        const result = await uploadVideoUrlToMeta(
          normAccountId,
          conn.access_token,
          row.file_url,
          row.file_name
        )
        currentRatePct = result.rateLimitPct

        await db
          .from("creatives")
          .update({ fb_video_id: result.videoId, status: "processing" })
          .eq("id", row.id)

        uploaded.push(row.id)
      } catch (err: any) {
        const msg: string = err?.message ?? "Unknown error"
        const isRateLimit = err?.name === "MetaRateLimitError"

        if (isRateLimit) {
          // Stop this org, let next cron run handle it
          for (let j = i; j < limit; j++) skipped.push(rows[j].id)
          break
        }

        await db
          .from("creatives")
          .update({ status: "error" })
          .eq("id", row.id)

        errors.push({ id: row.id, error: msg })
        console.error(`[cron/upload-to-facebook] creative ${row.id} failed:`, msg)
      }
    }
  }

  console.log(`[cron/upload-to-facebook] uploaded=${uploaded.length} skipped=${skipped.length} errors=${errors.length}`)
  return NextResponse.json({ uploaded: uploaded.length, skipped: skipped.length, errors: errors.length })
}
