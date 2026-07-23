import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GRAPH = "https://graph.facebook.com/v25.0"

type ReviewCall = {
  permission: string
  method: "GET" | "POST"
  endpoint: string
  ok: boolean
  status: number
  note?: string
  data?: unknown
  error?: string
}

async function graphGet(endpoint: string, accessToken: string): Promise<ReviewCall["data"]> {
  const sep = endpoint.includes("?") ? "&" : "?"
  const res = await fetch(`${GRAPH}${endpoint}${sep}access_token=${encodeURIComponent(accessToken)}`, {
    cache: "no-store",
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || data?.error) {
    throw new Error(data?.error?.message || `Meta GET failed (${res.status})`)
  }
  return data
}

async function runGet(permission: string, endpoint: string, accessToken: string, note?: string): Promise<ReviewCall> {
  try {
    const data = await graphGet(endpoint, accessToken)
    return { permission, method: "GET", endpoint, ok: true, status: 200, note, data }
  } catch (err: any) {
    return { permission, method: "GET", endpoint, ok: false, status: 500, note, error: err.message || "Failed" }
  }
}

async function runValidatedCampaignCreate(adAccountId: string, accessToken: string): Promise<ReviewCall> {
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
  const endpoint = `/${actId}/campaigns`
  const body = new URLSearchParams({
    access_token: accessToken,
    name: `API Review Validate Only ${new Date().toISOString()}`,
    buying_type: "AUCTION",
    objective: "OUTCOME_TRAFFIC",
    status: "PAUSED",
    special_ad_categories: JSON.stringify([]),
    is_adset_budget_sharing_enabled: "false",
    execution_options: JSON.stringify(["validate_only"]),
  })
  try {
    const res = await fetch(`${GRAPH}${endpoint}`, { method: "POST", body, cache: "no-store" })
    const data = await res.json().catch(() => null)
    if (!res.ok || data?.error) {
      const fb = data?.error
      const detail = [fb?.message, fb?.error_user_title, fb?.code ? `code=${fb.code}` : ""].filter(Boolean).join(" | ")
      throw new Error(detail || `Meta POST failed (${res.status})`)
    }
    return { permission: "ads_management", method: "POST", endpoint, ok: true, status: res.status, note: "validate_only — no real campaign created", data }
  } catch (err: any) {
    return { permission: "ads_management", method: "POST", endpoint, ok: false, status: 500, note: "validate_only — no real campaign created", error: err.message || "Failed" }
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection?.access_token) return NextResponse.json({ error: "Facebook not connected" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const adAccountId = String(body.adAccountId || body.ad_account_id || "").trim()
    if (!adAccountId) return NextResponse.json({ error: "adAccountId is required" }, { status: 400 })

    const calls: ReviewCall[] = []

    calls.push(await runGet("public_profile", "/me?fields=id,name", connection.access_token))
    calls.push(await runGet("email", "/me?fields=email", connection.access_token))

    const pagesCall = await runGet("pages_show_list", "/me/accounts?fields=id,name,access_token&limit=5", connection.access_token)
    calls.push(pagesCall)

    const page = Array.isArray((pagesCall.data as any)?.data) ? (pagesCall.data as any).data[0] : null
    if (page?.id) {
      const pToken = page.access_token || connection.access_token
      calls.push(await runGet("pages_read_engagement", `/${page.id}?fields=id,name,fan_count,posts.limit(1){id,message,comments.limit(1)}`, pToken, `page_id=${page.id}`))
      calls.push(await runGet("pages_messaging", `/${page.id}/conversations?limit=1`, pToken, `page_id=${page.id}`))
      calls.push(await runGet("pages_manage_metadata", `/${page.id}/subscribed_apps`, pToken, `page_id=${page.id}`))
    } else {
      calls.push({ permission: "pages_read_engagement", method: "GET", endpoint: "/{page_id}", ok: false, status: 404, error: "No page found in /me/accounts" })
    }

    calls.push(await runGet("business_management", "/me/businesses?fields=id,name&limit=10", connection.access_token))

    const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    calls.push(await runGet("ads_read", `/${actId}/campaigns?fields=id,name,status&limit=10`, connection.access_token))
    calls.push(await runValidatedCampaignCreate(actId, connection.access_token))

    const okCount = calls.filter(c => c.ok).length
    return NextResponse.json({
      ok: calls.every(c => c.ok),
      summary: { ok: okCount, failed: calls.length - okCount, total: calls.length, adAccountId: actId },
      calls,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}
