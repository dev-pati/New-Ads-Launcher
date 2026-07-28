import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { getAdDetail } from "@/lib/facebook"
import { adAccountBelongsToOrg, normalizeAdAccountId } from "../_utils"

// One ad, normalized: copy + media + metrics snapshot.
// Feeds "Duplicate to Launcher" (launch page reads ?from_ad=) and is the same
// shape POST /api/templates/from-ad persists.
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sp = request.nextUrl.searchParams
    const adId = sp.get("ad_id")
    const adAccountId = sp.get("ad_account_id")
    const datePreset = sp.get("date_preset") || "last_30d"

    if (!adId) return NextResponse.json({ error: "ad_id required" }, { status: 400 })
    if (!adAccountId) return NextResponse.json({ error: "ad_account_id required" }, { status: 400 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    if (!(await adAccountBelongsToOrg(ctx.orgId, adAccountId, connection.access_token))) {
      return NextResponse.json({ error: `Ad account ${adAccountId} not in your workspace` }, { status: 403 })
    }

    const ad = await getAdDetail(adId, connection.access_token, { datePreset })

    // The ad id came from the client; confirm it really lives in the account we
    // just authorized, so a valid account can't be used to read a foreign ad.
    if (ad.account_id && normalizeAdAccountId(ad.account_id) !== normalizeAdAccountId(adAccountId)) {
      return NextResponse.json({ error: "Ad does not belong to this ad account" }, { status: 403 })
    }

    return NextResponse.json({ ad })
  } catch (err: any) {
    console.error("[ad-detail] error:", err)
    return NextResponse.json({ error: err.message || "Failed to fetch ad" }, { status: 500 })
  }
}
