/**
 * GET /api/insights/page-insights
 * Fetches Facebook Page insights (reach, fans, engagement).
 * Falls back to page_insights_snapshots when Meta is unavailable.
 * ?pageId=xxx&days=30
 */
import { NextRequest, NextResponse }              from "next/server"
import { getAuthContext, getFacebookConnection }  from "@/lib/auth"
import { createAdminClient }                      from "@/lib/supabase/admin"
import { metaFetch, MetaApiError }                from "@/app/api/facebook/_meta-fetch"
import { pageSnapshotFallback }                   from "@/lib/snapshot-fallback"
import { snapshotPageInsights }                   from "@/lib/auto-snapshot"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const GRAPH = "https://graph.facebook.com/v25.0"

function ago(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0]
}

function sortNewestFirst(items: any[]) {
  return [...items].sort((a, b) => {
    const left = new Date(a?.created_time || 0).getTime()
    const right = new Date(b?.created_time || 0).getTime()
    return (Number.isFinite(right) ? right : 0) - (Number.isFinite(left) ? left : 0)
  })
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

    let pageToken = page?.page_access_token || ""
    if (!pageToken) {
      try {
        const accounts = await metaFetch(
          `${GRAPH}/me/accounts?fields=${encodeURIComponent("id,name,access_token")}&limit=100&access_token=${connection.access_token}`,
          { caller: "insights/page-insights/me-accounts" }
        )
        const matched = (accounts.data || []).find((item: any) => item.id === pageId)
        pageToken = matched?.access_token || ""

        if (pageToken && page?.fb_page_id) {
          void db
            .from("pages")
            .update({ page_access_token: pageToken })
            .eq("org_id", ctx.orgId)
            .eq("fb_page_id", pageId)
        }
      } catch (err) {
        console.warn("[insights/page-insights] fallback page token unavailable:", err)
      }
    }

    if (!pageToken) {
      return NextResponse.json({
        error: "Page Access Token not found for this Page. Reconnect the Page or select a Page that has been authorized.",
      }, { status: 400 })
    }

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
    let recentPostsError: string | null = null
    let recentPostsPermissionRequired = false
    try {
      const postFields = "id,message,story,created_time,permalink_url,full_picture,status_type,reactions.summary(true),comments.summary(true),shares,insights.metric(post_impressions,post_reach,post_video_views)"
      const postsData = await metaFetch(
        `${GRAPH}/${pageId}/posts?fields=${encodeURIComponent(postFields)}&limit=10&access_token=${pageToken}`,
        { caller: "insights/page-insights/posts" }
      )
      recentPosts = sortNewestFirst((postsData.data || []).map((post: any) => {
        const insights = post.insights?.data || []
        const reactions = post.reactions?.summary?.total_count ?? 0
        const comments = post.comments?.summary?.total_count ?? 0
        const shares = post.shares?.count ?? 0
        const reach = insights.find((d: any) => d.name === "post_reach")?.values?.[0]?.value ?? 0
        const impressions = insights.find((d: any) => d.name === "post_impressions")?.values?.[0]?.value ?? 0
        const videoViews = insights.find((d: any) => d.name === "post_video_views")?.values?.[0]?.value ?? 0
        return {
          id: post.id,
          message: post.message || post.story || "",
          created_time: post.created_time,
          permalink_url: post.permalink_url || null,
          full_picture: post.full_picture || null,
          status_type: post.status_type || null,
          reactions,
          comments,
          shares,
          engagement: reactions + comments + shares,
          reach,
          impressions,
          video_views: videoViews,
        }
      }))
    } catch (postErr) {
      console.warn("[insights/page-insights] recent posts unavailable:", postErr)
      if (postErr instanceof MetaApiError && postErr.code === 10) {
        recentPostsError = "Public Page posts require pages_read_engagement or Page Public Content Access."
        recentPostsPermissionRequired = true
        recentPosts = []
      } else {
        try {
          const fallbackFields = "id,message,story,created_time,permalink_url,full_picture,status_type,reactions.summary(true),comments.summary(true),shares"
          const fallbackPosts = await metaFetch(
            `${GRAPH}/${pageId}/posts?fields=${encodeURIComponent(fallbackFields)}&limit=10&access_token=${pageToken}`,
            { caller: "insights/page-insights/posts-fallback" }
          )
          recentPosts = sortNewestFirst((fallbackPosts.data || []).map((post: any) => {
            const reactions = post.reactions?.summary?.total_count ?? 0
            const comments = post.comments?.summary?.total_count ?? 0
            const shares = post.shares?.count ?? 0
            return {
              id: post.id,
              message: post.message || post.story || "",
              created_time: post.created_time,
              permalink_url: post.permalink_url || null,
              full_picture: post.full_picture || null,
              status_type: post.status_type || null,
              reactions,
              comments,
              shares,
              engagement: reactions + comments + shares,
              reach: 0,
              impressions: 0,
              video_views: 0,
            }
          }))
        } catch (fallbackErr) {
          console.warn("[insights/page-insights] recent posts fallback unavailable:", fallbackErr)
          recentPostsError = fallbackErr instanceof Error ? fallbackErr.message : "Public Page posts are unavailable."
        }
      }
    }

    // Auto-save to snapshots in background
    void snapshotPageInsights(ctx.orgId, pageId, pageName, pageToken, days)

    return NextResponse.json({
      pageId, pageName,
      fans: latest.fans ?? 0,
      daily, totals, recentPosts,
      recentPostsError,
      recentPostsPermissionRequired,
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
