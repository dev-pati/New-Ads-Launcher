import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getAdAccountPages, getFacebookPages, getPageInstagramAccounts, getBatchPageInstagramAccounts } from "@/lib/facebook"
import { getDbCachedFacebookMetadata } from "../_db-cache"
import { adAccountBelongsToOrg } from "../_utils"

export const dynamic = "force-dynamic"
const PAGES_TTL_MS = 10 * 60 * 1000
const INSTAGRAM_TTL_MS = 15 * 60 * 1000
type PageInstagramResult = { pageId: string; igAccounts: Array<{ id: string; username?: string; profile_pic?: string }> }

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    const pageId = request.nextUrl.searchParams.get("page_id")
    const adAccountId = request.nextUrl.searchParams.get("ad_account_id")

    if (adAccountId) {
      const allowed = await adAccountBelongsToOrg(ctx.orgId, adAccountId, connection.access_token)
      if (!allowed) {
        return NextResponse.json({ error: "Ad account not found in workspace" }, { status: 403 })
      }
    }

    const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true"
    const pagesResult = await getDbCachedFacebookMetadata({
      orgId: ctx.orgId,
      cacheKey: adAccountId
        ? `facebook:pages:ad-account:${adAccountId}`
        : "facebook:pages:all",
      ttlMs: PAGES_TTL_MS,
      forceRefresh,
      loader: () => adAccountId
        ? getAdAccountPages(adAccountId, connection.access_token)
        : getFacebookPages(connection.access_token),
    })
    const pages = pagesResult.value

    if (pageId) {
      const page = pages.find((candidate) => candidate.id === pageId)
      if (!page) {
        return NextResponse.json({ error: "Facebook Page not found for this ad account" }, { status: 403 })
      }

      const igResult = await getDbCachedFacebookMetadata({
        orgId: ctx.orgId,
        cacheKey: `facebook:page-instagram:${page.id}`,
        ttlMs: INSTAGRAM_TTL_MS,
        forceRefresh,
        loader: () => getPageInstagramAccounts(page.id, page.access_token),
      })
      return NextResponse.json({
        igAccounts: igResult.value,
        cached: igResult.source !== "meta",
        stale: igResult.stale,
        retryAfterMs: igResult.retryAfterMs,
      })
    }

    const resultsCacheKey = adAccountId
      ? `facebook:page-instagram-results:ad-account:${adAccountId}`
      : "facebook:page-instagram-results:all"
    const resultsResult = await getDbCachedFacebookMetadata({
      orgId: ctx.orgId,
      cacheKey: resultsCacheKey,
      ttlMs: INSTAGRAM_TTL_MS,
      forceRefresh,
      loader: async () => {
        const igMap = new Map<string, PageInstagramResult["igAccounts"]>()
        const batchResult = await getBatchPageInstagramAccounts(pages, connection.access_token)
        for (const page of pages) igMap.set(page.id, batchResult.get(page.id) || [])
        return pages.map(page => ({ pageId: page.id, igAccounts: igMap.get(page.id) || [] }))
      }
    })

    return NextResponse.json({
      results: resultsResult.value,
      cached: resultsResult.source !== "meta",
      stale: resultsResult.stale,
      retryAfterMs: resultsResult.retryAfterMs,
    })
  } catch (err) {
    console.error("page-instagram error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch Instagram accounts" },
      { status: 500 }
    )
  }
}
