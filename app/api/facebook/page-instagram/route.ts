import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getFacebookPages, getPageInstagramAccounts } from "@/lib/facebook"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    const pageId = request.nextUrl.searchParams.get("page_id")

    // Fetch all pages to get their access tokens
    const pages = await getFacebookPages(connection.access_token)

    if (pageId) {
      // Return IG accounts for a specific page
      const page = pages.find(p => p.id === pageId)
      if (!page) return NextResponse.json({ igAccounts: [] })
      const igAccounts = await getPageInstagramAccounts(page.id, page.access_token)
      return NextResponse.json({ igAccounts })
    }

    // Return IG accounts for all pages in parallel
    const results = await Promise.all(
      pages.map(async (page) => ({
        pageId: page.id,
        igAccounts: await getPageInstagramAccounts(page.id, page.access_token),
      }))
    )

    return NextResponse.json({ results })
  } catch (err: any) {
    console.error("page-instagram error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
