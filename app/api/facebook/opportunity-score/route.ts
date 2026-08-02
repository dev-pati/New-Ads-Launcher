import { NextRequest, NextResponse } from "next/server"

import { clearCachedFacebookMetadata, getCachedFacebookMetadata } from "../_cache"
import { getOrgAdAccountInfo } from "../_utils"
import { getAuthContext, getConnectionForAdAccount, isManual } from "@/lib/auth"
import { GRAPH_API_BASE } from "@/lib/facebook"
import { normalizeMetaError } from "@/lib/meta-error"
import { secureMetaFetch } from "@/lib/meta-secure-fetch"
import {
  normalizeOpportunityScore,
  normalizeOpportunityScoreWeight,
  type OpportunityScoreResult,
} from "@/lib/opportunity-score"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CACHE_TTL_MS = 15 * 60 * 1000

interface MetaOpportunityScorePayload {
  opportunity_score?: unknown
  opportunity_score_weight?: unknown
  error?: unknown
}

function normalizeAdAccountPath(adAccountId: string) {
  const numericId = adAccountId.replace(/^act_/, "")
  return `act_${numericId}`
}

async function readOpportunityScore(
  adAccountId: string,
  accessToken: string,
  manualConnection: boolean,
): Promise<OpportunityScoreResult> {
  const accountPath = normalizeAdAccountPath(adAccountId)
  const params = new URLSearchParams({
    fields: "opportunity_score,opportunity_score_weight",
    access_token: accessToken,
  })
  const response = await secureMetaFetch(
    `${GRAPH_API_BASE}/${accountPath}?${params}`,
    undefined,
    { skipProof: manualConnection },
  )
  const payload = (await response.json()) as MetaOpportunityScorePayload

  if (!response.ok || payload.error) {
    const normalized = normalizeMetaError(payload, "Failed to load Opportunity Score.", {
      permission: "ads_read",
    })
    throw new Error(normalized.error)
  }

  const score = normalizeOpportunityScore(payload.opportunity_score)
  if (score === null) {
    return { available: false, score: null, weight: null, reason: "unsupported" }
  }

  return {
    available: true,
    score,
    weight: normalizeOpportunityScoreWeight(payload.opportunity_score_weight),
  }
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const adAccountId = request.nextUrl.searchParams.get("ad_account_id")?.trim() || ""
    if (!adAccountId || !/^(act_)?\d+$/.test(adAccountId)) {
      return NextResponse.json({ error: "A valid ad_account_id is required" }, { status: 400 })
    }

    const connection = await getConnectionForAdAccount(ctx.orgId, adAccountId, "read")
    if (!connection) {
      return NextResponse.json<OpportunityScoreResult>({
        available: false,
        score: null,
        weight: null,
        reason: "no_read_connection",
      })
    }

    const account = await getOrgAdAccountInfo(ctx.orgId, adAccountId, connection.access_token)
    if (!account) {
      return NextResponse.json({ error: "Ad account does not belong to this organisation" }, { status: 403 })
    }

    const normalizedAccountId = account.id.replace(/^act_/, "")
    const cacheKey = `opportunity-score:${ctx.orgId}:${normalizedAccountId}`
    if (request.nextUrl.searchParams.get("refresh") === "true") {
      clearCachedFacebookMetadata(cacheKey)
    }

    const result = await getCachedFacebookMetadata(cacheKey, CACHE_TTL_MS, () =>
      readOpportunityScore(account.id, connection.access_token, isManual(connection)),
    )

    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, max-age=0" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load Opportunity Score"
    console.error("[opportunity-score]", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
