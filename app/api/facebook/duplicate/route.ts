import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { duplicateNode } from "@/lib/facebook"
import { adAccountBelongsToOrg } from "@/app/api/facebook/_utils"

const GRAPH_API_BASE = "https://graph.facebook.com/v25.0"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection found" }, { status: 401 })

    const body = await request.json()
    const { id, name, deep_copy, status_option, copies } = body

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    // Ownership check (IDOR protection)
    try {
      const srcRes = await fetch(`${GRAPH_API_BASE}/${id}?fields=account_id&access_token=${connection.access_token}`)
      if (!srcRes.ok) {
        const srcErr = await srcRes.json().catch(() => ({}))
        return NextResponse.json({ error: srcErr.error?.message || "Source node not found or inaccessible" }, { status: 404 })
      }
      const srcData = await srcRes.json()
      const adAccountId = srcData.account_id
      if (!adAccountId) {
        return NextResponse.json({ error: "Could not retrieve ad account ID for source node" }, { status: 500 })
      }

      const belongs = await adAccountBelongsToOrg(ctx.orgId, adAccountId, connection.access_token)
      if (!belongs) {
        return NextResponse.json({ error: "Ad account not found or not authorized" }, { status: 403 })
      }
    } catch (err: any) {
      console.error("[facebook/duplicate] IDOR validation error:", err)
      return NextResponse.json({ error: "Ownership validation failed: " + (err.message || "Unknown error") }, { status: 500 })
    }

    const numCopies = Math.min(Math.max(parseInt(copies) || 1, 1), 20)
    const results = []

    for (let i = 0; i < numCopies; i++) {
      const copyName = numCopies > 1 && name ? `${name} - Copy ${i + 1}` : name
      const res = await duplicateNode(id, connection.access_token, {
        name: copyName,
        deep_copy,
        status_option,
      })
      results.push(res.id)
    }

    return NextResponse.json({ success: true, ids: results })
  } catch (err: any) {
    console.error("[facebook/duplicate]", err)
    return NextResponse.json({ error: err.message || "Failed to duplicate" }, { status: 500 })
  }
}
