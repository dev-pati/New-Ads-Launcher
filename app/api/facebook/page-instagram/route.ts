import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getAdAccountPages, getFacebookPages, getPageInstagramAccounts, getBatchPageInstagramAccounts } from "@/lib/facebook"
import { getCachedFacebookMetadata, peekCachedFacebookMetadata, setCachedFacebookMetadata } from "../_cache"
import { adAccountBelongsToOrg } from "../_utils"

export const dynamic = "force-dynamic"
const PAGES_TTL_MS = 10 * 60 * 1000
const INSTAGRAM_TTL_MS = 15 * 60 * 1000

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

    const pages = await getCachedFacebookMetadata(
      adAccountId
        ? `fb:pages:${ctx.orgId}:ad-account:${adAccountId}`
        : `fb:pages:${ctx.orgId}:all`,
      PAGES_TTL_MS,
      () => adAccountId
        ? getAdAccountPages(adAccountId, connection.access_token)
        : getFacebookPages(connection.access_token)
    )

    if (pageId) {
      const page = pages.find((candidate) => candidate.id === pageId)
      if (!page) {
        return NextResponse.json({ error: "Facebook Page not found for this ad account" }, { status: 403 })
      }

      const igAccounts = await getCachedFacebookMetadata(
        `fb:page-instagram:${ctx.orgId}:${page.id}`,
        INSTAGRAM_TTL_MS,
        () => getPageInstagramAccounts(page.id, page.access_token)
      )
      return NextResponse.json({ igAccounts })
    }

    // Batch-fetch: check cache per page, only call Meta API for uncached pages (1 call instead of N)
    const uncachedPages: typeof pages = []
    const igMap = new Map<string, any[]>()

    for (const page of pages) {
      const key = `fb:page-instagram:${ctx.orgId}:${page.id}`
      const cached = peekCachedFacebookMetadata<any[]>(key)
      if (cached !== undefined) {
        igMap.set(page.id, cached)
      } else {
        uncachedPages.push(page)
      }
    }

    if (uncachedPages.length > 0) {
      const batchResult = await getBatchPageInstagramAccounts(uncachedPages, connection.access_token)
      for (const page of uncachedPages) {
        const ig = batchResult.get(page.id) || []
        igMap.set(page.id, ig)
        setCachedFacebookMetadata(`fb:page-instagram:${ctx.orgId}:${page.id}`, ig, INSTAGRAM_TTL_MS)
      }
    }

    const results = pages.map(page => ({ pageId: page.id, igAccounts: igMap.get(page.id) || [] }))

    return NextResponse.json({ results })
  } catch (err) {
    console.error("page-instagram error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch Instagram accounts" },
      { status: 500 }
    )
  }
}
