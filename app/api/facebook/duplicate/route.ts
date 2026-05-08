import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { duplicateNode } from "@/lib/facebook"

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
