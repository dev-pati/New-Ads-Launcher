import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { fetchAllAds } from "@/lib/facebook-launch"
import { adAccountBelongsToOrg } from "@/app/api/facebook/_utils"

// POST /api/facebook/adsets/[id]/duplicate
// Creates a copy of the source ad set via Meta's /copies endpoint
// Returns the new ad set ID + name

const GRAPH_API_BASE = "https://graph.facebook.com/v25.0"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    if (!id) return NextResponse.json({ error: "ad set id required" }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const renameSuffix = body.renameSuffix ?? ""
    const customName = body.customName as string | undefined
    const statusOption = body.statusOption || "PAUSED"
    const deepCopy = !!body.deepCopy

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    // Ownership check (IDOR protection)
    try {
      const srcRes = await fetch(`${GRAPH_API_BASE}/${id}?fields=account_id&access_token=${connection.access_token}`)
      if (!srcRes.ok) {
        const srcErr = await srcRes.json().catch(() => ({}))
        return NextResponse.json({ error: srcErr.error?.message || "Source ad set not found or inaccessible" }, { status: 404 })
      }
      const srcData = await srcRes.json()
      const adAccountId = srcData.account_id
      if (!adAccountId) {
        return NextResponse.json({ error: "Could not retrieve ad account ID for source ad set" }, { status: 500 })
      }

      const belongs = await adAccountBelongsToOrg(ctx.orgId, adAccountId, connection.access_token)
      if (!belongs) {
        return NextResponse.json({ error: "Ad account not found or not authorized" }, { status: 403 })
      }
    } catch (err: any) {
      console.error("[duplicate adset] IDOR validation error:", err)
      return NextResponse.json({ error: "Ownership validation failed: " + (err.message || "Unknown error") }, { status: 500 })
    }

    // Call Meta /copies endpoint
    const renameOptions: any = {}
    if (renameSuffix) renameOptions.rename_suffix = renameSuffix

    const copyQs: Record<string, string> = {
      access_token: connection.access_token,
      deep_copy: deepCopy ? "true" : "false",
      status_option: statusOption,
    }
    if (Object.keys(renameOptions).length > 0) copyQs.rename_options = JSON.stringify(renameOptions)
    const params_ = new URLSearchParams(copyQs)

    const res = await fetch(`${GRAPH_API_BASE}/${id}/copies?${params_}`, { method: "POST" })
    const data = await res.json()
    if (!res.ok) {
      const msg = data.error?.message || "Failed to duplicate ad set"
      console.error("[duplicate adset] Meta error:", msg)
      if (/rate limit|#4|request limit/i.test(msg)) {
        return NextResponse.json({ error: "Rate limited. Wait and retry.", rateLimited: true }, { status: 429 })
      }
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const newAdSetId = data.copied_adset_id || data.id
    if (!newAdSetId) return NextResponse.json({ error: "No ID returned by Meta" }, { status: 500 })

    // Apply overrides (name + budget + targeting + delivery) via PATCH on new ad set
    const updates: Record<string, string> = {}
    if (customName) updates.name = customName
    if (body.budgetOverride && body.budgetType) {
      if (body.budgetType === "daily") updates.daily_budget = String(body.budgetOverride)
      else updates.lifetime_budget = String(body.budgetOverride)
    }
    if (body.spendingLimits?.min) updates.daily_min_spend_target = String(body.spendingLimits.min)
    if (body.spendingLimits?.max) updates.daily_spend_cap = String(body.spendingLimits.max)
    if (body.optimizationGoal) updates.optimization_goal = body.optimizationGoal
    if (body.bidStrategy) updates.bid_strategy = body.bidStrategy

    const warnings: string[] = []

    // Targeting override — must fetch existing targeting first, then merge only the changed fields.
    // Sending a partial targeting object to Meta replaces the full targeting, destroying interests,
    // custom audiences, placement settings, etc.
    if (body.geoCountries?.length || body.ageMin || body.ageMax) {
      try {
        const tRes = await fetch(
          `${GRAPH_API_BASE}/${newAdSetId}?fields=targeting&access_token=${connection.access_token}`
        )
        if (!tRes.ok) {
          const errData = await tRes.json().catch(() => ({}))
          throw new Error(errData.error?.message || `HTTP ${tRes.status}`)
        }
        const tData = await tRes.json()
        const merged = tData.targeting ? { ...tData.targeting } : {}
        if (body.geoCountries?.length) merged.geo_locations = { countries: body.geoCountries }
        if (body.ageMin) merged.age_min = body.ageMin
        if (body.ageMax) merged.age_max = body.ageMax
        updates.targeting = JSON.stringify(merged)
      } catch (e: any) {
        // Skip targeting override if fetch fails — safer than destroying existing targeting
        warnings.push(`Geo/age override skipped: failed to fetch source targeting (${e.message || e})`)
        console.warn("[duplicate adset] failed to fetch existing targeting — skipping geo/age override:", e)
      }
    }

    if (Object.keys(updates).length > 0) {
      try {
        const patchBody = new URLSearchParams(updates)
        const patchRes = await fetch(
          `${GRAPH_API_BASE}/${newAdSetId}?access_token=${encodeURIComponent(connection.access_token)}`,
          { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: patchBody.toString() }
        )
        if (!patchRes.ok) {
          const e = await patchRes.json().catch(() => ({}))
          const errorMsg = e.error?.message || `HTTP ${patchRes.status}`
          console.warn("[duplicate adset] patch failed but copy created:", errorMsg)
          warnings.push(`Ad set duplicated, but some overrides failed to apply: ${errorMsg}`)
        }
      } catch (e: any) {
        console.warn("[duplicate adset] patch error:", e)
        warnings.push(`Ad set duplicated, but override network error occurred: ${e.message || e}`)
      }
    }

    // Fetch the new ad set details
    const detailRes = await fetch(
      `${GRAPH_API_BASE}/${newAdSetId}?fields=id,name,status,effective_status,campaign_id,daily_budget&access_token=${connection.access_token}`
    )
    const detail = (await detailRes.json()) as Record<string, unknown>
    if (!detailRes.ok) {
      const fallbackAdSet: Record<string, unknown> = { id: newAdSetId, name: customName || "Copy", status: statusOption }
      if (deepCopy) {
        fallbackAdSet.ads = await fetchAllAds(newAdSetId, connection.access_token)
      }
      if (warnings.length > 0) {
        return NextResponse.json({ adSet: fallbackAdSet, warnings }, { status: 207 })
      }
      return NextResponse.json({ adSet: fallbackAdSet })
    }

    if (deepCopy) {
      detail.ads = await fetchAllAds(newAdSetId, connection.access_token)
    }

    if (warnings.length > 0) {
      return NextResponse.json({ adSet: detail, warnings }, { status: 207 })
    }
    return NextResponse.json({ adSet: detail })
  } catch (err: any) {
    console.error("[duplicate adset] error:", err)
    return NextResponse.json({ error: err.message || "Failed to duplicate" }, { status: 500 })
  }
}
