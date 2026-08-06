import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getConnectionForAdAccount } from "@/lib/auth"
import type { RuleDraft } from "@/lib/meta-ad-rules"
import { adAccountBelongsToOrg } from "../_utils"

export const GRAPH = "https://graph.facebook.com/v25.0"

/**
 * Fields we ask Meta for on every rule read.
 *
 * `execution_spec` was missing before, which is why the list could not render the
 * "Action & condition" column — the action lived in a field nobody requested.
 */
export const RULE_FIELDS = [
  "id",
  "name",
  "status",
  "evaluation_spec",
  "execution_spec",
  "schedule_spec",
  "created_by",
  "created_time",
  "updated_time",
].join(",")

export interface RuleRequestContext {
  token: string
  accountPath: string
  adAccountId: string
}

/** Meta wants `act_<id>`; callers send it either way. */
export function toAccountPath(adAccountId: string) {
  return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
}

/**
 * Auth + via resolution + ownership guard, in one place.
 *
 * `purpose` matters: creating, editing, deleting or running a rule is a write to Meta and
 * must go through Via LAUNCH. Listing and previewing are reads. The previous rules routes
 * used getFacebookConnection() for both, bypassing the via classification entirely.
 */
export async function resolveRuleRequest(
  request: NextRequest,
  purpose: "read" | "write",
  adAccountIdOverride?: string
): Promise<RuleRequestContext | NextResponse> {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const adAccountId =
    adAccountIdOverride ||
    request.nextUrl.searchParams.get("adAccountId") ||
    request.nextUrl.searchParams.get("ad_account_id") ||
    ""
  if (!adAccountId) {
    return NextResponse.json({ error: "adAccountId required" }, { status: 400 })
  }

  const connection = await getConnectionForAdAccount(ctx.orgId, adAccountId, purpose)
  if (!connection) {
    return NextResponse.json(
      {
        error:
          purpose === "write"
            ? "No Facebook write connection (Via LAUNCH) for this ad account"
            : "No Facebook read connection for this ad account",
      },
      { status: 503 }
    )
  }

  if (!(await adAccountBelongsToOrg(ctx.orgId, adAccountId, connection.access_token))) {
    return NextResponse.json({ error: "Ad account not in your workspace" }, { status: 403 })
  }

  return {
    token: connection.access_token,
    accountPath: toAccountPath(adAccountId),
    adAccountId,
  }
}

/** Fills the defaults so every downstream builder sees a complete draft. */
export function normalizeDraft(input: Partial<RuleDraft>): RuleDraft {
  return {
    name: input.name ?? "",
    entityType: input.entityType ?? "ADSET",
    activeOnly: input.activeOnly ?? true,
    action: input.action ?? "",
    actionAmount: input.actionAmount,
    actionUnit: input.actionUnit,
    actionLimit: input.actionLimit,
    actionFrequencyMinutes: input.actionFrequencyMinutes,
    conditions: (input.conditions ?? []).filter(c => c?.metric && c?.operator && c?.value !== ""),
    timeRange: input.timeRange ?? "LIFETIME",
    scheduleType: input.scheduleType ?? "DAILY",
    customWindows: input.customWindows,
    subscribers: input.subscribers,
    notifyOnFacebook: input.notifyOnFacebook ?? true,
  }
}

export function isErrorResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse
}

/** Meta returns 200 with an `error` object more often than it returns a non-2xx status. */
export function graphError(data: any) {
  const message = data?.error?.message || "Meta API request failed"
  const rateLimited = /rate limit|request limit|#4|#17/i.test(message)
  return NextResponse.json(
    { error: rateLimited ? "Meta API rate limit reached" : message, rateLimited },
    { status: rateLimited ? 429 : 400 }
  )
}
