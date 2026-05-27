import { getAdAccounts } from "@/lib/facebook"
import { createAdminClient } from "@/lib/supabase/admin"

type BusinessManagerRow = {
  fb_business_id: string
  name: string | null
}

type OwnedAdAccountRow = {
  fb_ad_account_id: string
  fb_account_id: string
  business_managers?: BusinessManagerRow | BusinessManagerRow[] | null
}

export type AnnotatedAdAccount = Awaited<ReturnType<typeof getAdAccounts>>[number] & {
  owner_business?: { id: string; name?: string }
  ownership: "own" | "agency" | "unknown"
}

export function normalizeAdAccountId(id?: string | null) {
  return (id || "").replace(/^act_/, "")
}

function firstBusinessManager(row: OwnedAdAccountRow) {
  const m = row.business_managers
  return Array.isArray(m) ? m[0] : m
}

function numericOrNull(value?: string | number | null) {
  if (value === undefined || value === null || value === "") return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function snapshotRow(orgId: string, userId: string, account: AnnotatedAdAccount, syncedAt: string) {
  const spent = numericOrNull(account.amount_spent)
  const cap = numericOrNull(account.spend_cap)
  const balance = numericOrNull(account.balance)
  const remaining = cap !== null && spent !== null ? Math.max(cap - spent, 0) : null
  const ownerBusiness = account.owner_business || account.business

  return {
    org_id: orgId,
    user_id: userId,
    fb_ad_account_id: account.id,
    fb_account_id: account.account_id,
    name: account.name,
    account_status: account.account_status,
    currency: account.currency || "USD",
    timezone_name: account.timezone_name || null,
    amount_spent_minor: spent,
    balance_minor: balance,
    spend_cap_minor: cap,
    remaining_minor: remaining,
    owner_business_id: ownerBusiness?.id || null,
    owner_business_name: ownerBusiness?.name || null,
    ownership: account.ownership,
    raw_meta: account,
    synced_at: syncedAt,
  }
}

export async function persistAdAccountMetrics(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  userId: string,
  accounts: AnnotatedAdAccount[],
  syncedAt: string
) {
  if (accounts.length === 0) return

  const rows = accounts.map(account => snapshotRow(orgId, userId, account, syncedAt))

  const { error: snapshotError } = await supabase
    .from("ad_account_metrics_snapshots")
    .insert(rows)

  if (snapshotError) {
    console.warn("Failed to save ad account metric snapshots:", snapshotError.message)
  }

  await Promise.all(rows.map(async row => {
    const latest = {
      name: row.name,
      currency: row.currency,
      account_status: row.account_status,
      amount_spent_minor: row.amount_spent_minor,
      balance_minor: row.balance_minor,
      spend_cap_minor: row.spend_cap_minor,
      remaining_minor: row.remaining_minor,
      timezone_name: row.timezone_name,
      owner_business_id: row.owner_business_id,
      owner_business_name: row.owner_business_name,
      ownership: row.ownership,
      raw_meta: row.raw_meta,
      last_synced_at: syncedAt,
    }

    const byId = await supabase
      .from("ad_accounts")
      .update(latest)
      .eq("org_id", orgId)
      .eq("fb_ad_account_id", row.fb_ad_account_id)
      .select("id")

    if (byId.error) {
      console.warn("Failed to update ad account latest metrics:", byId.error.message)
      return
    }

    if ((byId.data || []).length === 0) {
      await supabase
        .from("ad_accounts")
        .update(latest)
        .eq("org_id", orgId)
        .eq("fb_account_id", row.fb_account_id)
    }
  }))
}

export async function annotateAdAccounts(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  rawAccounts: Awaited<ReturnType<typeof getAdAccounts>>
): Promise<AnnotatedAdAccount[]> {
  const [{ data: businessManagers }, { data: ownedAccounts }] = await Promise.all([
    supabase.from("business_managers").select("fb_business_id, name").eq("org_id", orgId),
    supabase.from("ad_accounts").select("fb_ad_account_id, fb_account_id, business_managers(fb_business_id, name)").eq("org_id", orgId),
  ])

  const businessById = new Map(
    ((businessManagers || []) as BusinessManagerRow[]).map(b => [b.fb_business_id, b.name])
  )
  const ownedById = new Map<string, OwnedAdAccountRow>()
  for (const row of (ownedAccounts || []) as OwnedAdAccountRow[]) {
    ownedById.set(normalizeAdAccountId(row.fb_ad_account_id), row)
    ownedById.set(normalizeAdAccountId(row.fb_account_id), row)
  }

  return rawAccounts.map(account => {
    const ownedRow =
      ownedById.get(normalizeAdAccountId(account.id)) ||
      ownedById.get(normalizeAdAccountId(account.account_id))
    const businessId = account.business?.id
    const ownedBusinessName = businessId ? businessById.get(businessId) : null
    const dbBusiness = ownedRow ? firstBusinessManager(ownedRow) : null
    const isOwn = Boolean(ownedRow || ownedBusinessName)
    const ownerBusiness = account.business || (dbBusiness ? {
      id: dbBusiness.fb_business_id,
      name: dbBusiness.name || undefined,
    } : undefined)

    return {
      ...account,
      owner_business: ownerBusiness,
      ownership: isOwn ? "own" : ownerBusiness ? "agency" : "unknown",
    }
  })
}
