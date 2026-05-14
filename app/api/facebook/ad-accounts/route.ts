import { NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getAdAccounts } from "@/lib/facebook"
import { getCachedFacebookMetadata } from "../_cache"

const AD_ACCOUNTS_TTL_MS = 15 * 60 * 1000

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection found" }, { status: 401 })

    const adAccounts = await getCachedFacebookMetadata(
      `fb:ad-accounts:${ctx.orgId}`,
      AD_ACCOUNTS_TTL_MS,
      () => getAdAccounts(connection.access_token)
    )
    return NextResponse.json({ adAccounts })
  } catch (err) {
    console.error("Failed to fetch ad accounts:", err)
    return NextResponse.json({ error: "Failed to fetch ad accounts" }, { status: 500 })
  }
}
