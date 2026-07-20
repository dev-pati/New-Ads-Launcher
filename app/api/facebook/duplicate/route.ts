import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getConnectionForAdAccount, isManual, MissingViaError } from "@/lib/auth"
import { duplicateNode, getResourceAccountId } from "@/lib/facebook"
import { adAccountBelongsToOrg } from "@/app/api/facebook/_utils"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { id, name, deep_copy, status_option, copies, adAccountId } = body

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    // Via MECE: mutation = WRITE → via launch của account → OAuth → block (VIA-MASTER.md)
    let connection
    try {
      connection = await getConnectionForAdAccount(ctx.orgId, adAccountId, "write")
    } catch (err) {
      if (err instanceof MissingViaError) {
        return NextResponse.json({ error: err.message, code: "MISSING_LAUNCH_VIA" }, { status: 400 })
      }
      throw err
    }
    if (!connection) return NextResponse.json({ error: "No Facebook connection found" }, { status: 401 })

    const token = connection.access_token
    const manual = isManual(connection)

    const resourceAccountId = await getResourceAccountId(id, token, { isManual: manual })
    if (!resourceAccountId) {
      return NextResponse.json({ error: "Could not verify resource ownership" }, { status: 400 })
    }
    const belongs = await adAccountBelongsToOrg(ctx.orgId, "act_" + resourceAccountId, token)
    if (!belongs) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const numCopies = Math.min(Math.max(parseInt(copies) || 1, 1), 20)
    const results = []

    for (let i = 0; i < numCopies; i++) {
      const copyName = numCopies > 1 && name ? `${name} - Copy ${i + 1}` : name
      const res = await duplicateNode(id, token, {
        name: copyName,
        deep_copy,
        status_option,
      }, { isManual: manual })
      results.push(res.id)
    }

    return NextResponse.json({ success: true, ids: results })
  } catch (err: any) {
    console.error("[facebook/duplicate]", err)
    return NextResponse.json({ error: err.message || "Failed to duplicate" }, { status: 500 })
  }
}
