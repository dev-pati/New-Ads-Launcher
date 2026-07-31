import { getAdAccounts } from "@/lib/facebook"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedFacebookMetadata } from "./_cache"


interface OrgAdAccountRow {
  fb_ad_account_id: string | null
  currency: string | null
  timezone_name: string | null
}

export interface OrgAdAccountInfo {
  id: string
  currency?: string
  timezoneName?: string
}

const AD_ACCOUNTS_TTL_MS = 2 * 60 * 1000

export function normalizeAdAccountId(id: string) {
  return id.startsWith("act_") ? id.slice(4) : id
}

export async function getOrgAdAccountInfo(
  orgId: string,
  adAccountId: string,
  accessToken?: string
) {
  const requested = normalizeAdAccountId(adAccountId)
  const supabase = createAdminClient()
  const { data: orgAdAccounts, error: orgAdAccountsError } = await supabase
    .from("ad_accounts")
    .select("fb_ad_account_id, currency, timezone_name")
    .eq("org_id", orgId)
  if (orgAdAccountsError) throw orgAdAccountsError

  const dbAccount = ((orgAdAccounts || []) as OrgAdAccountRow[]).find((account) => {
    return normalizeAdAccountId(account.fb_ad_account_id || "") === requested
  })

  if (dbAccount) {
    return {
      id: dbAccount.fb_ad_account_id!,
      currency: dbAccount.currency || undefined,
      timezoneName: dbAccount.timezone_name || undefined,
    }
  }

  // Via-only accounts must already be org-owned in DB. OAuth can additionally prove
  // live access to a newly granted account without a source-code allowlist.
  if (!accessToken) return null

  const liveAccounts = await getCachedFacebookMetadata(
    `fb:ad-accounts:${orgId}:live`,
    AD_ACCOUNTS_TTL_MS,
    () => getAdAccounts(accessToken)
  )
  const liveAccount = liveAccounts.find((account) => {
    return (
      normalizeAdAccountId(account.id) === requested ||
      normalizeAdAccountId(account.account_id) === requested
    )
  })
  if (!liveAccount) return null

  return { id: liveAccount.id, currency: liveAccount.currency, timezoneName: liveAccount.timezone_name }
}

export async function adAccountBelongsToOrg(
  orgId: string,
  adAccountId: string,
  accessToken: string
) {
  return Boolean(await getOrgAdAccountInfo(orgId, adAccountId, accessToken))
}
