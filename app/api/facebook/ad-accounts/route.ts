import { NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getAdAccounts } from "@/lib/facebook"

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (process.env.MOCK_META_API === "true") {
      console.log("[ad-accounts] MOCK MODE — returning fake ad accounts")
      return NextResponse.json({
        adAccounts: [
          { id: "act_111111111", account_id: "111111111", name: "GEC-MOCK 01", account_status: 1, currency: "USD" },
          { id: "act_222222222", account_id: "222222222", name: "GEC-MOCK 02", account_status: 1, currency: "USD" },
        ],
        mock: true,
      })
    }

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection found" }, { status: 401 })

    const adAccounts = await getAdAccounts(connection.access_token)
    return NextResponse.json({ adAccounts })
  } catch (err) {
    console.error("Failed to fetch ad accounts:", err)
    return NextResponse.json({ error: "Failed to fetch ad accounts" }, { status: 500 })
  }
}
