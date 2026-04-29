import { NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getFacebookPages } from "@/lib/facebook"

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection found" }, { status: 401 })

    const pages = await getFacebookPages(connection.access_token)
    return NextResponse.json({ pages })
  } catch (err) {
    console.error("Failed to fetch pages:", err)
    return NextResponse.json({ error: "Failed to fetch Facebook pages" }, { status: 500 })
  }
}
