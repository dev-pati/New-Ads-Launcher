/**
 * GET /api/insights/page-insights
 * Fetches Facebook Page insights (reach, fans, engagement).
 * Falls back to page_insights_snapshots when Meta is unavailable.
 * ?pageId=xxx&days=30
 */
import { NextRequest, NextResponse }              from "next/server"
import { getAuthContext, getFacebookConnection }  from "@/lib/auth"
import { createAdminClient }                      from "@/lib/supabase/admin"
import { metaFetch }                              from "@/app/api/facebook/_meta-fetch"
import { pageSnapshotFallback }                   from "@/lib/snapshot-fallback"
import { snapshotPageInsights }                   from "@/lib/auto-snapshot"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const GRAPH = "https://graph.facebook.com/v25.0"

function ago(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0]
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sp     = request.nextUrl.searchParams
  const pageId = sp.get("pageId") || ""
  const days   = Math.min(parseInt(sp.get("days") || "30"), 90)

  if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 })

  try {
    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) throw new Error("Facebook not connected")

    // Get page access token from pages table
    const db = createAdminClient()
    const { data: page } = await db
      .from("pages")
      .select("fb_page_id, name, page_access_token")
      .eq("org_id", ctx.orgId)
      .eq("fb_page_id", pageId)
      .maybeSingle()

    const pageToken = page?.page_access_token || connection.access_token
    const pageName  = page?.name || pageId

    const since = ago(days), until = ago(1)
    // Meta removed several legacy Page Insights metrics in recent Graph API
    // versions. Keep this list to metrics that are valid in v25.
    const metrics = [
      "page_follows",
      "page_daily_follows",
      "page_daily_unfollows",
      "page_impressions_unique",
      "page_impressions_paid_unique",
      "page_post_engagements",
      "page_actions_post_reactions_total",
      "page_views_total",
      "page_video_views",
    ].join(",")

    const data = await metaFetch(
      `${GRAPH}/${pageId}/insights?metric=${encodeURIComponent(metrics)}&period=day&since=${since}&until=${until}&access_token=${pageToken}`,
      { caller: "insights/page-insights" }
    )

    // Pivot per-metric → per-date
    const byDate: Record<string, any> = {}
    for (const metricObj of data.data ?? []) {
      for (const val of metricObj.values ?? []) {
        const date = val.end_time?.split("T")[0]
        if (!date || date < since || date > until) continue
        if (!byDate[date]) byDate[date] = { date }
        byDate[date][metricObj.name] = val.value ?? 0
      }
    }

    const daily = Object.values(byDate)
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
      .map((d: any) => ({
        ...d,
        fans: d.page_follows ?? 0,
        new_fans: d.page_daily_follows ?? 0,
        reach: d.page_impressions_unique ?? 0,
        impressions: d.page_impressions_unique ?? 0,
        paid_reach: d.page_impressions_paid_unique ?? 0,
        engaged_users: d.page_post_engagements ?? 0,
        post_engagements: d.page_post_engagements ?? 0,
        reactions: d.page_actions_post_reactions_total ?? 0,
        page_views: d.page_views_total ?? 0,
        video_views: d.page_video_views ?? 0,
      }))
    const latest: any = daily[daily.length - 1] ?? {}

    const totals = daily.reduce((acc: any, d: any) => ({
      reach:            acc.reach            + (d.reach ?? 0),
      impressions:      acc.impressions      + (d.impressions ?? 0),
      engaged_users:    acc.engaged_users    + (d.engaged_users ?? 0),
      post_engagements: acc.post_engagements + (d.post_engagements ?? 0),
      new_fans:         acc.new_fans         + (d.new_fans ?? 0),
    }), { reach: 0, impressions: 0, engaged_users: 0, post_engagements: 0, new_fans: 0 })

    let recentPosts: any[] = []
    try {
      const postsData = await metaFetch(
        `${GRAPH}/${pageId}/posts?fields=${encodeURIComponent("id,message,story,created_time,permalink_url,full_picture,status_type")}&limit=6&access_token=${pageToken}`,
        { caller: "insights/page-insights/posts" }
      )
      recentPosts = (postsData.data || []).map((post: any) => ({
        id: post.id,
        message: post.message || post.story || "",
        created_time: post.created_time,
        permalink_url: post.permalink_url || null,
        full_picture: post.full_picture || null,
        status_type: post.status_type || null,
      }))
    } catch (postErr) {
      console.warn("[insights/page-insights] recent posts unavailable:", postErr)
    }

    // Auto-save to snapshots in background
    void snapshotPageInsights(ctx.orgId, pageId, pageName, pageToken, days)

    return NextResponse.json({
      pageId, pageName,
      fans: latest.fans ?? 0,
      daily, totals, recentPosts,
      fromSnapshot: false,
    })
  } catch (err: any) {
    console.error("[insights/page-insights]", err)
    // Fallback to DB snapshots
    try {
      const snapshot = await pageSnapshotFallback(ctx.orgId, pageId, days)
      if (snapshot) return NextResponse.json(snapshot)
    } catch {}
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
