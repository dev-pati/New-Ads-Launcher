import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getConnectionForAdAccount, isManual } from "@/lib/auth"
import { describeAccountHealth } from "@/lib/account-health"
import { secureMetaFetch } from "@/lib/meta-secure-fetch"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GRAPH = "https://graph.facebook.com/v25.0"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rawId = request.nextUrl.searchParams.get("adAccountId") || ""
    const accountId = rawId.replace(/^act_/, "")
    if (!/^\d+$/.test(accountId)) {
      return NextResponse.json({ error: "Valid adAccountId required" }, { status: 400 })
    }

    const connection = await getConnectionForAdAccount(ctx.orgId, accountId, "read")
    if (!connection) {
      return NextResponse.json({ available: false, message: "No read connection is assigned to this ad account." })
    }

    const fields = "id,name,account_status,disable_reason,is_notifications_enabled"
    const url = `${GRAPH}/act_${accountId}?fields=${fields}&access_token=${encodeURIComponent(connection.access_token)}`
    const response = await secureMetaFetch(url, undefined, { skipProof: isManual(connection) })
    const data = await response.json()

    if (!response.ok || data.error) {
      return NextResponse.json({
        available: false,
        message: data.error?.message || "Meta account health is unavailable.",
      })
    }

    const statusCode = Number(data.account_status ?? 0)
    const disableReasonCode = Number(data.disable_reason ?? 0)
    const description = describeAccountHealth(statusCode, disableReasonCode)

    return NextResponse.json({
      available: true,
      account: {
        id: data.id,
        name: data.name,
        statusCode,
        status: description.status,
        disableReasonCode,
        disableReason: description.disableReason,
        metaNotificationsEnabled:
          typeof data.is_notifications_enabled === "boolean" ? data.is_notifications_enabled : null,
        healthy: description.healthy,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load account health"
    console.error("[facebook/account-health]", error)
    return NextResponse.json({ available: false, message }, { status: 200 })
  }
}
