import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

function monthKey(d: string) { return d.substring(0, 7) }
function monthLabel(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
}

function dateRangeFilter(datePreset: string): Date | null {
  const d = new Date()
  if      (datePreset === "last_7d")   { d.setDate(d.getDate() - 7);  return d }
  else if (datePreset === "last_30d")  { d.setDate(d.getDate() - 30); return d }
  else if (datePreset === "last_90d")  { d.setDate(d.getDate() - 90); return d }
  else if (datePreset === "this_month") {
    d.setDate(1); d.setHours(0, 0, 0, 0); return d
  }
  else if (datePreset === "last_month") {
    d.setDate(1); d.setMonth(d.getMonth() - 1); return d
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp         = request.nextUrl.searchParams
    const datePreset = sp.get("datePreset") || "last_90d"
    const supabase   = createAdminClient()

    let query = supabase
      .from("launch_batches")
      .select("id,user_id,user_name,ad_account_id,ad_account_name,status,total_ads,failed_ads,duration_ms,created_at,creative_ids,cta")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(1000)

    const since = dateRangeFilter(datePreset)
    if (since) query = query.gte("created_at", since.toISOString())

    const { data: batches, error } = await query

    if (error) {
      if (error.code === "42P01" || /relation .* does not exist/i.test(error.message)) {
        return NextResponse.json({
          batches: [], monthly: [], leaderboard: [],
          summary: { totalAds: 0, totalBatches: 0, hoursSaved: 0, topLauncher: null },
          _migrationNeeded: true,
        })
      }
      throw new Error(error.message)
    }

    const rows = batches || []

    // ── Fetch creatives for media type breakdown ───────────────────────────────
    const allCreativeIds = [...new Set(rows.flatMap(b => (b.creative_ids as string[] | null) || []))]
    let creativeMediaMap: Record<string, "video" | "image"> = {}
    if (allCreativeIds.length > 0) {
      const { data: creatives } = await supabase
        .from("creatives")
        .select("id,media_type")
        .in("id", allCreativeIds)
      for (const c of creatives || []) {
        creativeMediaMap[c.id] = c.media_type
      }
    }

    // ── Aggregate by month ─────────────────────────────────────────────────────
    type MonthBucket = {
      key: string; label: string; dateStart: string
      batches: number; ads: number; failedAds: number; videoAds: number; imageAds: number
    }
    const mMap: Record<string, MonthBucket> = {}

    for (const b of rows) {
      const dateStr  = (b.created_at as string).substring(0, 10)
      const k        = monthKey(dateStr)
      if (!mMap[k]) mMap[k] = { key: k, label: monthLabel(dateStr), dateStart: dateStr, batches: 0, ads: 0, failedAds: 0, videoAds: 0, imageAds: 0 }
      mMap[k].batches++
      mMap[k].ads       += b.total_ads || 0
      mMap[k].failedAds += b.failed_ads || 0

      const creativeIds = (b.creative_ids as string[] | null) || []
      for (const cid of creativeIds) {
        const mt = creativeMediaMap[cid]
        if (mt === "video") mMap[k].videoAds++
        else if (mt === "image") mMap[k].imageAds++
      }
    }

    const monthly = Object.values(mMap).sort((a, b) => a.dateStart.localeCompare(b.dateStart))

    // ── Team leaderboard ───────────────────────────────────────────────────────
    const userMap: Record<string, { userId: string; userName: string; batches: number; ads: number; lastLaunch: string }> = {}
    for (const b of rows) {
      const uid = b.user_id as string
      const dateStr = (b.created_at as string).substring(0, 10)
      if (!userMap[uid]) userMap[uid] = { userId: uid, userName: b.user_name || "Unknown", batches: 0, ads: 0, lastLaunch: dateStr }
      userMap[uid].batches++
      userMap[uid].ads += b.total_ads || 0
      if (dateStr > userMap[uid].lastLaunch) userMap[uid].lastLaunch = dateStr
    }
    const leaderboard = Object.values(userMap).sort((a, b) => b.ads - a.ads)

    // ── Summary KPIs ───────────────────────────────────────────────────────────
    const totalAds     = rows.reduce((s, b) => s + (b.total_ads || 0), 0)
    const totalBatches = rows.length
    const totalDurationMs = rows.reduce((s, b) => s + (b.duration_ms || 0), 0)
    // Assume 15 min manual work per ad saved by the launcher
    const hoursSaved   = parseFloat((totalAds * 15 / 60).toFixed(1))
    const topLauncher  = leaderboard[0] || null

    // ── Media type totals ──────────────────────────────────────────────────────
    const totalVideoAds = monthly.reduce((s, m) => s + m.videoAds, 0)
    const totalImageAds = monthly.reduce((s, m) => s + m.imageAds, 0)

    // ── Recent batches for table ───────────────────────────────────────────────
    const recentBatches = rows.slice(0, 50).map(b => ({
      id:              b.id,
      userName:        b.user_name || "Unknown",
      adAccountName:   b.ad_account_name || b.ad_account_id,
      totalAds:        b.total_ads || 0,
      failedAds:       b.failed_ads || 0,
      status:          b.status || "success",
      durationMs:      b.duration_ms || 0,
      createdAt:       b.created_at,
      cta:             b.cta || "",
    }))

    // ── Unique launchers count ──────────────────────────────────────────────
    const uniqueUsers = Object.keys(userMap).length

    return NextResponse.json({
      monthly,
      leaderboard,
      recentBatches,
      summary: {
        totalAds, totalBatches, hoursSaved,
        uniqueUsers,
        totalVideoAds, totalImageAds,
        successRate: totalBatches > 0 ? ((rows.filter(b => b.status === "success").length / totalBatches) * 100) : 0,
        topLauncher: topLauncher
          ? { name: topLauncher.userName, ads: topLauncher.ads, batches: topLauncher.batches }
          : null,
        avgDurationMs: totalBatches > 0 ? totalDurationMs / totalBatches : 0,
      },
      datePreset,
    })
  } catch (err: any) {
    console.error("[statistics/upload-stats]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
