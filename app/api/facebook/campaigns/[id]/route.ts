import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

const GRAPH_API = "https://graph.facebook.com/v25.0"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const res = await fetch(`${GRAPH_API}/${id}`, {
      method: "DELETE",
      body: new URLSearchParams({ access_token: connection.access_token }),
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      const msg = data.error?.message || "Failed to delete campaign"
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete campaign" }, { status: 500 })
  }
}
