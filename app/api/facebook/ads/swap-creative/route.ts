import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { adAccountBelongsToOrg } from "@/app/api/facebook/_utils"

const GRAPH = "https://graph.facebook.com/v25.0"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const { adAccountId, adIds, newCreativeId } = body

    if (!adAccountId) return NextResponse.json({ error: "adAccountId is required" }, { status: 400 })
    if (!Array.isArray(adIds) || adIds.length === 0) {
      return NextResponse.json({ error: "adIds array is required and must not be empty" }, { status: 400 })
    }
    if (!newCreativeId) return NextResponse.json({ error: "newCreativeId is required" }, { status: 400 })

    const token = connection.access_token

    // Guard 1: Ownership check
    const belongs = await adAccountBelongsToOrg(ctx.orgId, adAccountId, token)
    if (!belongs) {
      return NextResponse.json({ error: "Ad account not found or not authorized" }, { status: 403 })
    }

    // Guard 2: Creative lookup
    const supabase = createAdminClient()
    const { data: creative, error: creativeErr } = await supabase
      .from("creatives")
      .select("fb_creative_id, file_name")
      .eq("id", newCreativeId)
      .eq("org_id", ctx.orgId)
      .single()

    if (creativeErr || !creative) {
      return NextResponse.json({ error: "Creative not found" }, { status: 404 })
    }
    if (!creative.fb_creative_id) {
      return NextResponse.json({ error: "Creative chưa sẵn sàng (chưa upload lên Meta)" }, { status: 400 })
    }

    // Guard 3: Swap creative on Meta API using Promise.allSettled
    const results = await Promise.allSettled(
      adIds.map(async (adId: string) => {
        const creativeObj = { creative_id: creative.fb_creative_id }
        const res = await fetch(`${GRAPH}/${adId}?access_token=${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ creative: JSON.stringify(creativeObj) }),
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error?.message || "Failed to swap creative")
        }
        return { adId, success: true }
      })
    )

    const mappedResults = results.map((r, i) => {
      if (r.status === "fulfilled") {
        return r.value
      } else {
        return { adId: adIds[i], success: false, error: r.reason?.message || "Failed to swap creative" }
      }
    })

    return NextResponse.json({ results: mappedResults })
  } catch (err: any) {
    console.error("[swap-creative] error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
