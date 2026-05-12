import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getAdAccountPages, getFacebookPages, getPageInstagramAccounts } from "@/lib/facebook"
import { adAccountBelongsToOrg } from "../_utils"

export const dynamic = "force-dynamic"

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

    const pages = adAccountId
      ? await getAdAccountPages(adAccountId, connection.access_token)
      : await getFacebookPages(connection.access_token)

    if (pageId) {
      const page = pages.find((candidate) => candidate.id === pageId)
      if (!page) {
        return NextResponse.json({ error: "Facebook Page not found for this ad account" }, { status: 403 })
      }

      const igAccounts = await getPageInstagramAccounts(page.id, page.access_token)
      return NextResponse.json({ igAccounts })
    }

    const results = await Promise.all(
      pages.map(async (page) => ({
        pageId: page.id,
        igAccounts: await getPageInstagramAccounts(page.id, page.access_token),
      }))
    )

    return NextResponse.json({ results })
  } catch (err) {
    console.error("page-instagram error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch Instagram accounts" },
      { status: 500 }
    )
  }
}
