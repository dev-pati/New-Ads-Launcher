import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getFacebookPages, getPageInstagramAccounts } from "@/lib/facebook"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (process.env.MOCK_META_API === "true") {
      const pageId = request.nextUrl.searchParams.get("page_id")
      const fake = (id: string) => [{ id: `ig_${id}`, username: `mock_ig_${id.slice(-3)}`, profile_pic: "https://placehold.co/80x80/ec4899/white?text=IG" }]
      if (pageId) return NextResponse.json({ igAccounts: fake(pageId), mock: true })
      return NextResponse.json({
        results: ["100000000000001", "100000000000002", "100000000000003"].map(id => ({ pageId: id, igAccounts: fake(id) })),
        mock: true,
      })
    }

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
