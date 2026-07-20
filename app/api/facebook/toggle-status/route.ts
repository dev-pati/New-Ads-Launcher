import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getConnectionForAdAccount, isManual, MissingViaError } from "@/lib/auth"
import { getResourceAccountId } from "@/lib/facebook"
import { adAccountBelongsToOrg } from "@/app/api/facebook/_utils"
import { secureMetaFetch } from "@/lib/meta-secure-fetch"

const GRAPH = "https://graph.facebook.com/v25.0"

// POST /api/facebook/toggle-status
// Body: { id: string, newStatus: "ACTIVE" | "PAUSED", adAccountId?: string }
// Works for campaigns, ad sets, and ads — Meta API uses the same PATCH endpoint for all.
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id, newStatus, adAccountId } = await request.json()
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
    if (!["ACTIVE", "PAUSED"].includes(newStatus)) {
      return NextResponse.json({ error: "newStatus must be ACTIVE or PAUSED" }, { status: 400 })
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
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    const token = connection.access_token
    const manual = isManual(connection)

    // Verify ownership
    const resourceAccountId = await getResourceAccountId(id, token, { isManual: manual })
    if (!resourceAccountId) {
      return NextResponse.json({ error: "Could not find resource account" }, { status: 400 })
    }
    const belongs = await adAccountBelongsToOrg(ctx.orgId, "act_" + resourceAccountId, token)
    if (!belongs) {
      return NextResponse.json({ error: "Resource does not belong to your org's ad accounts" }, { status: 403 })
    }

    const body = new URLSearchParams({ status: newStatus })
    const res = await secureMetaFetch(`${GRAPH}/${id}?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }, { skipProof: manual })
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || "Failed to update status" }, { status: res.status })
    }
    return NextResponse.json({ success: true, id, newStatus })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
