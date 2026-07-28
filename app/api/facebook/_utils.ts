import { getAdAccounts } from "@/lib/facebook"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedFacebookMetadata } from "./_cache"
import { isPriorityAdAccount } from "@/lib/priority-ad-accounts"
import { getAuthContext } from "@/lib/auth"


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
  accessToken: string
) {
  const requested = normalizeAdAccountId(adAccountId)
  const supabase = createAdminClient()
  const { data: orgAdAccounts } = await supabase
    .from("ad_accounts")
    .select("fb_ad_account_id, currency, timezone_name")
    .eq("org_id", orgId)

  const dbAccount = ((orgAdAccounts || []) as OrgAdAccountRow[]).find((account) => {
    return normalizeAdAccountId(account.fb_ad_account_id || "") === requested
  })

  const isPriority = isPriorityAdAccount(requested)

  if (dbAccount) {
    return { id: adAccountId, currency: dbAccount.currency || undefined, timezoneName: dbAccount.timezone_name || undefined }
  }

  // If this is a priority account but missing from DB, we want to allow it and try to upsert it
  // But we still need its currency/live details, so we continue to the live check first.

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
  if (!liveAccount) {
    if (isPriority) {
      return { id: adAccountId, currency: "USD" } 
    }
    return null
  }

  if (isPriority) {
    const auth = await getAuthContext().catch(() => null)
    if (auth && liveAccount.business?.id) {
      // We need a business manager ID for the FK. Ensure the BM exists first, then insert ad_account.
      const bmId = liveAccount.business.id
      const { data: bm } = await supabase
        .from("business_managers")
        .select("id")
        .eq("org_id", orgId)
        .eq("fb_business_id", bmId)
        .maybeSingle()

      if (bm) {
        // Best-effort insert, ignore duplicates/errors
        try { await supabase.from("ad_accounts").insert({
          org_id: orgId,
          user_id: auth.user.id,
          business_manager_id: bm.id,
          fb_ad_account_id: liveAccount.id,
          fb_account_id: liveAccount.account_id,
          name: liveAccount.name,
          currency: liveAccount.currency || "USD",
          timezone_name: liveAccount.timezone_name || null,
          account_status: liveAccount.account_status ?? 1,
          is_active: true
        }) } catch {}
      }
    }
  }

  return { id: liveAccount.id, currency: liveAccount.currency, timezoneName: liveAccount.timezone_name }
}

export async function adAccountBelongsToOrg(
  orgId: string,
  adAccountId: string,
  accessToken: string
) {
  return Boolean(await getOrgAdAccountInfo(orgId, adAccountId, accessToken))
}
