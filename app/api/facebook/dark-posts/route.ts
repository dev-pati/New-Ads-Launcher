import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getAdAccounts, getDarkPostAds } from "@/lib/facebook"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedFacebookMetadata } from "../_cache"

const DARK_POSTS_TTL_MS = 15 * 60 * 1000
const AD_ACCOUNT_ACCESS_TTL_MS = 15 * 60 * 1000

function normalizeAdAccountId(id: string) {
  return id.startsWith("act_") ? id.slice(4) : id
}

function pageMatchesPost(pageId: string, postId?: string) {
  return !!postId && postId.startsWith(`${pageId}_`)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp = request.nextUrl.searchParams
    const adAccountId = sp.get("ad_account_id")
    const pageId = sp.get("page_id") || undefined
    const limit = Math.min(parseInt(sp.get("limit") || "100", 10), 100)
    const after = sp.get("after") || undefined

    if (!adAccountId) return NextResponse.json({ error: "ad_account_id required" }, { status: 400 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    const supabase = createAdminClient()
    const { data: orgAccounts } = await supabase
      .from("ad_accounts")
      .select("fb_ad_account_id, fb_account_id")
      .eq("org_id", ctx.orgId)

    const requestedAccount = normalizeAdAccountId(adAccountId)
    const allowedAccounts = (orgAccounts || []).flatMap((account: any) => [
      normalizeAdAccountId(account.fb_ad_account_id || ""),
      normalizeAdAccountId(account.fb_account_id || ""),
    ])

    if (!allowedAccounts.includes(requestedAccount)) {
      const liveAccounts = await getCachedFacebookMetadata(
        `fb:dark-posts:ad-account-access:${ctx.orgId}`,
        AD_ACCOUNT_ACCESS_TTL_MS,
        () => getAdAccounts(connection.access_token)
      )
      const hasLiveAccess = (liveAccounts || []).some(account =>
        normalizeAdAccountId(account.id) === requestedAccount ||
        normalizeAdAccountId(account.account_id) === requestedAccount
      )

      if (!hasLiveAccess) {
        return NextResponse.json(
          { error: `Ad account ${adAccountId} is not available for the connected Meta user` },
          { status: 403 }
        )
      }
    }

    const cacheKey = `fb:dark-posts:v2:${ctx.orgId}:${adAccountId}:${limit}:${after || ""}`
    const result = await getCachedFacebookMetadata(cacheKey, DARK_POSTS_TTL_MS, () =>
      getDarkPostAds(adAccountId, connection.access_token, {
        limit,
        after,
      })
    )

    const ads = result.ads || []
    const darkPosts = (result.ads || [])
      .filter(ad => ad.post_id)
      .filter(ad => !pageId || ad.page_id === pageId || pageMatchesPost(pageId, ad.post_id))
      .map(ad => ({
        id: `${ad.id}:${ad.post_id}`,
        source: "meta",
        adId: ad.id,
        adName: ad.name,
        adStatus: ad.status,
        effectiveStatus: ad.effective_status,
        adSetId: ad.adset_id || null,
        adSetName: ad.adset_name || null,
        campaignId: ad.campaign_id || null,
        campaignName: ad.campaign_name || null,
        pageId: ad.page_id || pageId || null,
        pageName: ad.page_name || null,
        postId: ad.post_id,
        storyIdSource: ad.object_story_id ? "object_story_id" : "effective_object_story_id",
        objectStoryId: ad.object_story_id || null,
        effectiveObjectStoryId: ad.effective_object_story_id || null,
        postUrl: ad.post_url || null,
        thumbnailUrl: ad.image_url || ad.thumb_url || null,
        previewThumbnailUrl: ad.thumb_url || null,
        mediaType: ad.media_type === "video" ? "video" : "image",
        createdTime: ad.date_created || null,
        spend: null,
        impressions: null,
        reach: null,
        results: null,
        roas: null,
        primaryText: ad.primaryText || null,
        headline: ad.headline || null,
        description: ad.description || null,
      }))

    return NextResponse.json({
      darkPosts,
      requestedAccount: adAccountId,
      requestedPage: pageId || null,
      paging: result.paging,
      inspectedAds: ads.length,
      adsWithStoryId: ads.filter(ad => ad.post_id).length,
      totalCount: darkPosts.length,
    })
  } catch (err: any) {
    console.error("[dark-posts] error:", err)
    return NextResponse.json({ error: err.message || "Failed to fetch dark posts" }, { status: 500 })
  }
}
