import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

const GRAPH = "https://graph.facebook.com/v25.0"

// POST /api/facebook/toggle-status
// Body: { id: string, newStatus: "ACTIVE" | "PAUSED" }
// Works for campaigns, ad sets, and ads — Meta API uses the same PATCH endpoint for all.
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    const { id, newStatus } = await request.json()
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
    if (!["ACTIVE", "PAUSED"].includes(newStatus)) {
      return NextResponse.json({ error: "newStatus must be ACTIVE or PAUSED" }, { status: 400 })
    }

    const body = new URLSearchParams({ status: newStatus, access_token: connection.access_token })
    const res = await fetch(`${GRAPH}/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || "Failed to update status" }, { status: res.status })
    }
    return NextResponse.json({ success: true, id, newStatus })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
