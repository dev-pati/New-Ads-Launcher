import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

const GRAPH = "https://graph.facebook.com/v25.0"

// POST /api/facebook/delete
// Body: { ids: string[] }
// Deletes campaigns, ad sets, or ads — Meta API uses DELETE /{id} for all.
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    const { ids } = await request.json()
    if (!ids?.length) return NextResponse.json({ error: "ids is required" }, { status: 400 })

    const results: { id: string; success: boolean; error?: string }[] = []

    for (const id of ids as string[]) {
      const res = await fetch(`${GRAPH}/${id}?access_token=${connection.access_token}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) {
        results.push({ id, success: false, error: data.error?.message || "Failed" })
      } else {
        results.push({ id, success: true })
      }
    }

    const failed = results.filter(r => !r.success)
    return NextResponse.json({
      success: failed.length === 0,
      results,
      deleted: results.filter(r => r.success).length,
      failed: failed.length,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
