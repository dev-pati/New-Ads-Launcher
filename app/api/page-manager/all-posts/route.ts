import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { metaFetch, MetaApiError } from "@/app/api/facebook/_meta-fetch"
import { getDarkPostAds } from "@/lib/facebook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const GRAPH = "https://graph.facebook.com/v25.0"

function sortNewestFirst(items: any[]) {
  return [...items].sort((a, b) => {
    const left = new Date(a?.createdTime || a?.created_time || 0).getTime()
    const right = new Date(b?.createdTime || b?.created_time || 0).getTime()
    return (Number.isFinite(right) ? right : 0) - (Number.isFinite(left) ? left : 0)
  })
}

function normalizeAdAccountId(id: string) {
  return id.startsWith("act_") ? id.slice(4) : id
}

function pageMatchesPost(pageId: string, postId?: string) {
  return !!postId && postId.startsWith(`${pageId}_`)
}

function datePresetToDays(preset: string) {
  if (preset === "last_90d" || preset === "last_90_days") return 90
  if (preset === "last_7d" || preset === "last_7_days") return 7
  return 30 // default (last_30d / last_30_days)
}

function ago(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0]
}

function mapMetaDarkPost(item: any, fallbackPageId: string, fallbackPageName: string | undefined, adAccountName: string | null) {
  return {
    id: `${item.id}:${item.post_id}`,
    source: "dark" as const,
    scope: "dark" as const,
    adId: item.id,
    adName: item.name,
    adStatus: item.status,
    effectiveStatus: item.effective_status,
    adSetId: item.adset_id || null,
    adSetName: item.adset_name || null,
    campaignId: item.campaign_id || null,
    campaignName: item.campaign_name || null,
    pageId: item.page_id || fallbackPageId || null,
    pageName: item.page_name || fallbackPageName || null,
    postId: item.post_id,
    storyIdSource: item.object_story_id ? "object_story_id" : "effective_object_story_id",
    objectStoryId: item.object_story_id || null,
    effectiveObjectStoryId: item.effective_object_story_id || null,
    permalinkUrl: item.post_url || null,
    thumbnailUrl: item.image_url || item.thumb_url || null,
    previewThumbnailUrl: item.thumb_url || null,
    mediaType: item.media_type === "video" ? "video" : "image",
    createdTime: item.date_created || null,
    reactions: 0,
    comments: 0,
    shares: 0,
    engagement: 0,
    reach: 0,
    impressions: 0,
    videoViews: 0,
    primaryText: item.primaryText || null,
    headline: item.headline || null,
    description: item.description || null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp = request.nextUrl.searchParams
    const pageId = sp.get("page_id") || ""
    const adAccountId = sp.get("ad_account_id") || ""
    const scope = sp.get("scope") || "selected_page" // selected_page | ad_account
    const datePreset = sp.get("date_preset") || "last_30_days"
    const limit = Math.min(parseInt(sp.get("limit") || "100", 10), 100)

    if (!pageId) return NextResponse.json({ error: "page_id required" }, { status: 400 })

    const days = datePresetToDays(datePreset)

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

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
          { caller: "all-posts/me-accounts" }
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
        console.warn("[all-posts] fallback page token unavailable:", err)
      }
    }

    const pageName = page?.name || pageId

    // Define tasks to run concurrently
    let publicPosts: any[] = []
    let publicError: string | null = null
    let publicPermissionRequired = false
    let pageInsightTotals: any = null

    let darkPosts: any[] = []
    let darkError: string | null = null
    let inspectedAds = 0
    let adsWithStoryId = 0
    let darkPaging: any = null

    // 1. Fetch public posts task & page insights totals
    const fetchPublicPostsAndInsights = async () => {
      if (!pageToken) {
        publicError = "Page Access Token not found."
        return
      }

      // Fetch insights first for page totals
      try {
        const since = ago(days), until = ago(1)
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

        const insightsData = await metaFetch(
          `${GRAPH}/${pageId}/insights?metric=${encodeURIComponent(metrics)}&period=day&since=${since}&until=${until}&access_token=${pageToken}`,
          { caller: "all-posts/insights" }
        )

        const byDate: Record<string, any> = {}
        for (const metricObj of insightsData.data ?? []) {
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

        pageInsightTotals = daily.reduce((acc: any, d: any) => ({
          reach:            acc.reach            + (d.reach ?? 0),
          impressions:      acc.impressions      + (d.impressions ?? 0),
          engaged_users:    acc.engaged_users    + (d.engaged_users ?? 0),
          post_engagements: acc.post_engagements + (d.post_engagements ?? 0),
          new_fans:         acc.new_fans         + (d.new_fans ?? 0),
        }), { reach: 0, impressions: 0, engaged_users: 0, post_engagements: 0, new_fans: 0 })
      } catch (insightErr) {
        console.warn("[all-posts] page insights fetch failed:", insightErr)
      }

      // Now fetch actual public posts list
      try {
        const postFields = "id,message,story,created_time,permalink_url,full_picture,status_type,reactions.summary(true),comments.summary(true),shares,insights.metric(post_impressions,post_reach,post_video_views)"
        const postsData = await metaFetch(
          `${GRAPH}/${pageId}/posts?fields=${encodeURIComponent(postFields)}&limit=10&access_token=${pageToken}`,
          { caller: "all-posts/public" }
        )
        publicPosts = (postsData.data || []).map((post: any) => {
          const insights = post.insights?.data || []
          const reactions = post.reactions?.summary?.total_count ?? 0
          const comments = post.comments?.summary?.total_count ?? 0
          const shares = post.shares?.count ?? 0
          const reach = insights.find((d: any) => d.name === "post_reach")?.values?.[0]?.value ?? 0
          const impressions = insights.find((d: any) => d.name === "post_impressions")?.values?.[0]?.value ?? 0
          const videoViews = insights.find((d: any) => d.name === "post_video_views")?.values?.[0]?.value ?? 0
          return {
            id: post.id,
            source: "public" as const,
            scope: "public" as const,
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
            adId: null,
            adName: null,
            campaignName: null,
            adSetName: null,
          }
        })
      } catch (postErr) {
        console.warn("[all-posts] public posts fetch failed:", postErr)
        if (postErr instanceof MetaApiError && postErr.code === 10) {
          publicPermissionRequired = true
          publicError = "Public Page posts require pages_read_engagement or Page Public Content Access."
        } else {
          // Fallback to minimal fields (reactions, comments summary only, no insights)
          try {
            const fallbackFields = "id,message,story,created_time,permalink_url,full_picture,status_type,reactions.summary(true),comments.summary(true),shares"
            const fallbackPosts = await metaFetch(
              `${GRAPH}/${pageId}/posts?fields=${encodeURIComponent(fallbackFields)}&limit=10&access_token=${pageToken}`,
              { caller: "all-posts/public-fallback" }
            )
            publicPosts = (fallbackPosts.data || []).map((post: any) => {
              const reactions = post.reactions?.summary?.total_count ?? 0
              const comments = post.comments?.summary?.total_count ?? 0
              const shares = post.shares?.count ?? 0
              return {
                id: post.id,
                source: "public" as const,
                scope: "public" as const,
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
                adId: null,
                adName: null,
                campaignName: null,
                adSetName: null,
              }
            })
          } catch (fallbackErr) {
            publicError = fallbackErr instanceof Error ? fallbackErr.message : "Public Page posts are unavailable."
          }
        }
      }
    }

    // 2. Fetch dark posts task
    const fetchDarkPosts = async () => {
      if (!adAccountId) {
        darkError = "Select an ad account to load Meta dark posts."
        return
      }
      try {
        const { data: orgAccounts } = await db
          .from("ad_accounts")
          .select("fb_ad_account_id, fb_account_id, name")
          .eq("org_id", ctx.orgId)

        const requestedAccount = normalizeAdAccountId(adAccountId)
        const matchedOrgAccount = (orgAccounts || []).find((account: any) =>
          normalizeAdAccountId(account.fb_ad_account_id || "") === requestedAccount ||
          normalizeAdAccountId(account.fb_account_id || "") === requestedAccount
        )
        const selectedAdAccountName = matchedOrgAccount?.name || adAccountId

        const result = await getDarkPostAds(adAccountId, connection.access_token, {
          limit,
        })

        const ads = result.ads || []
        inspectedAds = ads.length
        adsWithStoryId = ads.filter(ad => ad.post_id).length
        darkPaging = result.paging || null

        darkPosts = ads
          .filter(ad => ad.post_id)
          .filter(ad => scope !== "selected_page" || ad.page_id === pageId || pageMatchesPost(pageId, ad.post_id))
          .map(ad => mapMetaDarkPost(ad, pageId, pageName, selectedAdAccountName))
      } catch (err: any) {
        console.warn("[all-posts] dark posts fetch failed:", err)
        darkError = err.message || "Failed to fetch dark posts"
      }
    }

    // Run both tasks concurrently
    await Promise.all([fetchPublicPostsAndInsights(), fetchDarkPosts()])

    // Merge and sort using direct object property key mappings
    const allPosts = sortNewestFirst([...publicPosts, ...darkPosts])

    return NextResponse.json({
      pageId,
      pageName,
      posts: allPosts,
      publicCount: publicPosts.length,
      darkCount: darkPosts.length,
      totalCount: allPosts.length,
      publicError,
      publicPermissionRequired,
      darkError,
      inspectedAds,
      adsWithStoryId,
      darkPaging,
      pageInsightTotals,
    })
  } catch (err: any) {
    console.error("[all-posts] global error:", err)
    return NextResponse.json({ error: err.message || "Failed to fetch all posts" }, { status: 500 })
  }
}
