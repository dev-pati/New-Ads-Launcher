/**
 * GET /api/meta/connection-status
 * Checks if the Facebook connection is valid and returns the status.
 */
import { NextResponse }                          from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GRAPH = "https://graph.facebook.com/v25.0"

const ERROR_MESSAGES: Record<number, string> = {
  190:  "Token expired or revoked — please sign in to Facebook again",
  200:  "Insufficient access permissions",
  294:  "Missing manage_pages permission",
  368:  "Facebook account is restricted or locked",
  100:  "Invalid parameter",
  4:    "API rate limit reached — try again later",
  17:   "API rate limit reached — try again later",
  341:  "Ad limit reached",
  2500: "Authentication error — please sign in to Facebook again",
}

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) {
      return NextResponse.json({
        connected: false,
        status: "disconnected",
        message: "No Facebook account connected",
        accountName: null,
      })
    }

    // Ping Meta API to check token validity
    const res  = await fetch(
      `${GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(connection.access_token)}`,
      { cache: "no-store" }
    )
    const data = await res.json()

    if (data.error) {
      const code    = data.error.code as number
      const subcode = data.error.error_subcode as number
      const message = ERROR_MESSAGES[code] ?? ERROR_MESSAGES[subcode]
        ?? data.error.message
        ?? "There is a problem with the Facebook account"

      // Classify severity
      const isBlocked  = [368, 190, 2500].includes(code)
      const isExpired  = code === 190
      const isRestricted = code === 368

      return NextResponse.json({
        connected:   false,
        status:      isBlocked ? "blocked" : isExpired ? "expired" : "error",
        message,
        accountName: connection.fb_user_name ?? null,
        errorCode:   code,
        isBlocked,
        isExpired,
        isRestricted,
      })
    }

    return NextResponse.json({
      connected:   true,
      status:      "ok",
      message:     null,
      accountName: data.name ?? connection.fb_user_name ?? null,
    })
  } catch (err: any) {
    return NextResponse.json({
      connected:   false,
      status:      "error",
      message:     "Unable to check Facebook connection",
      accountName: null,
    })
  }
}
