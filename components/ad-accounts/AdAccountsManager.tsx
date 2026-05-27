"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  IconAlertCircle,
  IconArrowsSort,
  IconChevronDown,
  IconLoader2,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react"

type AccountStatusFilter = "all" | "active" | "disabled"
type AccountOwnershipFilter = "all" | "own" | "agency"
type AccountOwnership = "own" | "agency" | "unknown"
type AccountTab = "accounts" | "spending-limit"

interface ManagedAdAccount {
  id: string
  account_id: string
  name: string
  account_status: number
  currency: string
  amount_spent?: string
  balance?: string
  spend_cap?: string
  timezone_name?: string
  business?: {
    id: string
    name?: string
  }
  owner_business?: {
    id: string
    name?: string
  }
  ownership?: AccountOwnership
}

interface AccountMetricSnapshot {
  id: string
  fb_ad_account_id: string
  fb_account_id: string
  name: string | null
  currency: string | null
  spend_cap_minor: string | number | null
  synced_at: string
}

const ACCOUNT_STATUS_LABELS: Record<number, string> = {
  1: "active",
  2: "disabled",
  3: "unsettled",
  7: "pending review",
  8: "pending settlement",
  9: "in grace period",
  100: "pending closure",
  101: "closed",
  201: "any active",
  202: "any closed",
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
])

function parseMinorMoney(value?: string | number | null, currency = "USD") {
  if (value === undefined || value === null || value === "") return null
  const raw = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(raw)) return null
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? raw : raw / 100
}

function formatMajorMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2,
  }).format(amount)
}

function formatAccountMoney(value?: string | number | null, currency = "USD") {
  const amount = parseMinorMoney(value, currency)
  if (amount === null) return "-"
  return formatMajorMoney(amount, currency)
}

function formatLastSynced(date: Date | null) {
  if (!date) return "Never"
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
  }).format(date)
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatMinorMoney(value?: string | number | null, currency = "USD") {
  if (value === undefined || value === null || value === "") return "-"
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return "-"
  return formatAccountMoney(amount, currency)
}

export function AdAccountsManager() {
  const [activeTab, setActiveTab] = useState<AccountTab>("accounts")
  const [accounts, setAccounts] = useState<ManagedAdAccount[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<AccountStatusFilter>("active")
  const [ownershipFilter, setOwnershipFilter] = useState<AccountOwnershipFilter>("agency")
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState("")
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState("")
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [accountSearch, setAccountSearch] = useState("")
  const [limitSnapshots, setLimitSnapshots] = useState<AccountMetricSnapshot[]>([])
  const [limitLoading, setLimitLoading] = useState(false)

  const fetchAccounts = useCallback(async (refresh = false) => {
    if (refresh) setSyncing(true)
    else setLoading(true)
    setError("")

    try {
      const res = await fetch(`/api/facebook/ad-accounts${refresh ? "?refresh=true" : ""}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to fetch ad accounts")

      setAccounts(data.adAccounts || [])
      if (data.adAccounts?.[0]?.account_id) {
        setSelectedAccountId(current => current || data.adAccounts[0].account_id)
      }
      setLastSynced(data.syncedAt ? new Date(data.syncedAt) : new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch ad accounts")
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const fetchLimitSnapshots = useCallback(async (accountId: string) => {
    if (!accountId) {
      setLimitSnapshots([])
      return
    }

    setLimitLoading(true)
    try {
      const res = await fetch(`/api/facebook/ad-account-metrics?account_id=${encodeURIComponent(accountId)}&limit=200`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to fetch spending limit history")
      setLimitSnapshots(data.snapshots || [])
    } catch (err) {
      console.warn(err)
      setLimitSnapshots([])
    } finally {
      setLimitLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === "spending-limit" && selectedAccountId) {
      fetchLimitSnapshots(selectedAccountId)
    }
  }, [activeTab, selectedAccountId, fetchLimitSnapshots])

  const filteredAccounts = accounts.filter(account => {
    const text = `${account.account_id} ${account.name}`.toLowerCase()
    const matchesQuery = text.includes(query.trim().toLowerCase())
    const isActive = account.account_status === 1
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && isActive) ||
      (statusFilter === "disabled" && !isActive)
    const matchesOwnership =
      ownershipFilter === "all" ||
      (ownershipFilter === "own" && account.ownership === "own") ||
      (ownershipFilter === "agency" && account.ownership === "agency")

    return matchesQuery && matchesStatus && matchesOwnership
  })

  const activeCount = accounts.filter(account => account.account_status === 1).length
  const ownCount = accounts.filter(account => account.ownership === "own").length
  const agencyCount = accounts.filter(account => account.ownership === "agency").length
  const personalCount = accounts.filter(account => account.ownership === "unknown").length
  const selectedAccount = accounts.find(account => account.account_id === selectedAccountId || account.id === selectedAccountId) || accounts[0]
  const accountOptions = accounts.filter(account => {
    const term = accountSearch.trim().toLowerCase()
    if (!term) return true
    return `${account.name} ${account.account_id}`.toLowerCase().includes(term)
  })
  const spendingLimitRows = (() => {
    const rows = limitSnapshots.length > 0
      ? limitSnapshots
      : selectedAccount
        ? [{
            id: "current",
            fb_ad_account_id: selectedAccount.id,
            fb_account_id: selectedAccount.account_id,
            name: selectedAccount.name,
            currency: selectedAccount.currency,
            spend_cap_minor: selectedAccount.spend_cap || null,
            synced_at: lastSynced?.toISOString() || new Date().toISOString(),
          }]
        : []

    return rows.map((row, index) => ({
      id: row.id,
      startDate: row.synced_at,
      endDate: index === 0 ? null : rows[index - 1]?.synced_at,
      currency: row.currency || selectedAccount?.currency || "USD",
      spendCap: row.spend_cap_minor,
    }))
  })()

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5">
      <div className="relative z-10 overflow-visible rounded-[24px] bg-white shadow-[0_2px_4px_0_rgba(0,0,0,0.10)]">
        <div className="flex h-12 items-center gap-7 border-b border-[#DEE3E9] px-7">
          <button
            onClick={() => setActiveTab("accounts")}
            className={cn(
              "flex h-full items-center border-b-2 text-sm font-semibold transition-colors",
              activeTab === "accounts"
                ? "border-[#0064E0] text-[#0064E0]"
                : "border-transparent text-[#5D6C7B] hover:text-[#1C2B33]"
            )}
          >
            Ad Accounts
          </button>
          <button
            onClick={() => setActiveTab("spending-limit")}
            className={cn(
              "flex h-full items-center border-b-2 text-sm font-semibold transition-colors",
              activeTab === "spending-limit"
                ? "border-[#0064E0] text-[#0064E0]"
                : "border-transparent text-[#5D6C7B] hover:text-[#1C2B33]"
            )}
          >
            Account Spending Limit
          </button>
        </div>

        {activeTab === "accounts" ? (
        <div className="grid gap-5 px-7 py-6 xl:grid-cols-[minmax(240px,340px)_minmax(520px,1fr)] xl:items-start">
          <div>
            <h2 className="text-xl font-bold leading-tight text-[#1C2B33]">
              Ad Accounts <span className="text-[#5D6C7B]">({accounts.length})</span>
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#5D6C7B]">Last synced: {formatLastSynced(lastSynced)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#E8F3FF] px-2.5 py-1 text-xs font-semibold text-[#0064E0]">
                Own {ownCount}
              </span>
              <span className="rounded-full bg-[#F7F8FA] px-2.5 py-1 text-xs font-semibold text-[#465A69]">
                Agency/Shared {agencyCount}
              </span>
              {personalCount > 0 && (
                <span className="rounded-full bg-[rgba(120,86,255,0.12)] px-2.5 py-1 text-xs font-semibold text-[#5C3FB5]">
                  Personal {personalCount}
                </span>
              )}
              <span className="rounded-full bg-[#F7F8FA] px-2.5 py-1 text-xs font-semibold text-[#465A69]">
                Active {activeCount}
              </span>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto]">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#465A69]" />
              <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search ad account..."
                className="h-11 rounded-full border-[#CED0D4] bg-white pl-11 pr-4 text-sm text-[#1C2B33] shadow-none placeholder:text-[#65676B] focus-visible:border-[#0064E0] focus-visible:ring-[#0064E0]/20"
              />
            </div>

            <Button
              onClick={() => fetchAccounts(true)}
              disabled={syncing}
              className="h-11 rounded-full bg-[#0064E0] px-6 text-sm font-medium text-white shadow-none transition-transform hover:scale-[1.03] hover:bg-[#0143B5] active:scale-[0.97] disabled:bg-[#DEE3E9] disabled:text-[#8595A4]"
            >
              {syncing ? <IconLoader2 className="mr-2 size-4 animate-spin" /> : <IconRefresh className="mr-2 size-4" />}
              Sync Meta
            </Button>

            <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
              <div className="flex h-10 items-center overflow-hidden rounded-full border border-[#CED0D4] bg-white">
                <span className="px-4 text-[12px] font-bold uppercase leading-4 text-[#5D6C7B]">Type</span>
                {(["all", "agency", "own"] as AccountOwnershipFilter[]).map(type => (
                  <button
                    key={type}
                    onClick={() => setOwnershipFilter(type)}
                    className={cn(
                      "flex h-full items-center px-4 text-sm font-medium transition-colors",
                      ownershipFilter === type
                        ? "bg-[#0064E0] text-white"
                        : "text-[#1C2B33] hover:bg-[#F1F4F7]"
                    )}
                  >
                    {type === "all" ? "All" : type === "agency" ? "Agency" : "Own"}
                  </button>
                ))}
              </div>

              <div className="flex h-10 items-center overflow-hidden rounded-full border border-[#CED0D4] bg-white">
                <span className="px-4 text-[12px] font-bold uppercase leading-4 text-[#5D6C7B]">Status</span>
                {(["all", "active", "disabled"] as AccountStatusFilter[]).map(status => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      "flex h-full items-center gap-2 px-4 text-sm font-medium transition-colors",
                      statusFilter === status
                        ? "bg-[#0064E0] text-white"
                        : "text-[#1C2B33] hover:bg-[#F1F4F7]"
                    )}
                  >
                    <span className={cn(
                      "size-2 rounded-full",
                      status === "active" ? "bg-[#31A24C]" : status === "disabled" ? "bg-[#E41E3F]" : "bg-[#8595A4]",
                      statusFilter === status && "bg-white/80"
                    )} />
                    {status === "all" ? "All" : status === "active" ? "Active" : "Disabled"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        ) : (
        <div className="grid gap-5 px-7 py-6 xl:grid-cols-[minmax(260px,1fr)_auto] xl:items-start">
          <div>
            <h2 className="text-xl font-bold leading-tight text-[#1C2B33]">Account spending limit</h2>
            <p className="mt-1 text-xs leading-5 text-[#5D6C7B]">
              {selectedAccount ? `${selectedAccount.name} / ${selectedAccount.account_id}` : "Select an ad account"}
            </p>
          </div>

          <div className="flex flex-wrap items-start justify-end gap-3">
            <div className="flex items-center gap-3">
              <span className="mt-3 text-xs font-bold uppercase leading-4 text-[#5D6C7B]">Select ad account:</span>
              <div className="relative w-[360px]">
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen(open => !open)}
                  className="flex h-11 w-full items-center justify-between rounded-lg border border-[#CED0D4] bg-white px-4 text-left text-sm font-medium text-[#1C2B33] shadow-none transition-colors hover:border-[#0064E0]"
                >
                  <span className="truncate">
                    {selectedAccount ? `${selectedAccount.name} (${selectedAccount.account_id})` : "Select account"}
                  </span>
                  <IconChevronDown className="ml-2 size-4 shrink-0 text-[#465A69]" />
                </button>

                {accountMenuOpen && (
                  <div className="absolute right-0 top-12 z-50 w-full overflow-hidden rounded-[12px] border border-[#DEE3E9] bg-white shadow-[0_12px_28px_0_rgba(0,0,0,0.20),0_2px_4px_0_rgba(0,0,0,0.10)]">
                    <div className="border-b border-[#DEE3E9] p-2">
                      <Input
                        autoFocus
                        value={accountSearch}
                        onChange={event => setAccountSearch(event.target.value)}
                        placeholder="Search by name or ID..."
                        className="h-10 rounded-lg border-[#0064E0] text-sm focus-visible:ring-[#0064E0]/20"
                      />
                    </div>
                    <div className="max-h-64 overflow-auto py-1">
                      {accountOptions.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-[#5D6C7B]">No accounts found.</div>
                      ) : accountOptions.map(account => (
                        <button
                          key={account.id || account.account_id}
                          type="button"
                          onClick={() => {
                            setSelectedAccountId(account.account_id)
                            setAccountMenuOpen(false)
                            setAccountSearch("")
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-[#F1F4F7]",
                            selectedAccount?.account_id === account.account_id ? "bg-[#E8F3FF] text-[#0064E0]" : "text-[#1C2B33]"
                          )}
                        >
                          <span className="truncate font-semibold">{account.name}</span>
                          <span className="shrink-0 text-[#5D6C7B]">{account.account_id}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={async () => {
                await fetchAccounts(true)
                if (selectedAccountId) await fetchLimitSnapshots(selectedAccountId)
              }}
              disabled={syncing}
              className="h-11 rounded-full bg-[#0064E0] px-6 text-sm font-medium text-white shadow-none transition-transform hover:scale-[1.03] hover:bg-[#0143B5] active:scale-[0.97] disabled:bg-[#DEE3E9] disabled:text-[#8595A4]"
            >
              {syncing ? <IconLoader2 className="mr-2 size-4 animate-spin" /> : <IconRefresh className="mr-2 size-4" />}
              Sync Meta
            </Button>
          </div>
        </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-[20px] border border-[#E41E3F]/30 bg-[rgba(255,123,145,0.15)] px-5 py-3 text-sm text-[#C80A28]">
          <IconAlertCircle className="size-4" />
          {error}
        </div>
      )}

      {activeTab === "accounts" ? (
      <>
      <div className="overflow-x-auto rounded-[20px] bg-white shadow-[0_2px_4px_0_rgba(0,0,0,0.10)]">
        <table className="w-full min-w-[1160px]">
          <thead className="bg-[#F7F8FA]">
            <tr className="border-b border-[#DEE3E9]">
              {["#", "Account ID", "Name", "Type", "Owner", "Status", "Currency", "Timezone", "Spend Cap", "Remaining", "Spent"].map(label => (
                <th key={label} className="px-5 py-3.5 text-left text-xs font-bold leading-5 text-[#465A69]">
                  {label}
                  {["Spend Cap", "Remaining", "Spent"].includes(label) && <IconArrowsSort className="ml-1 inline size-3 text-muted-foreground" />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="px-5 py-14 text-center text-sm text-[#5D6C7B]">
                  <IconLoader2 className="mx-auto mb-3 size-6 animate-spin" />
                  Loading ad accounts...
                </td>
              </tr>
            ) : filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-5 py-14 text-center text-sm text-[#5D6C7B]">
                  No ad accounts found.
                </td>
              </tr>
            ) : (
              filteredAccounts.map((account, index) => {
                const currency = account.currency || "USD"
                const spent = parseMinorMoney(account.amount_spent, currency)
                const cap = parseMinorMoney(account.spend_cap, currency)
                const remaining = cap !== null && spent !== null ? Math.max(cap - spent, 0) : null
                const isActive = account.account_status === 1

                return (
                  <tr key={account.id || account.account_id} className="border-b border-[#DEE3E9] last:border-0 hover:bg-[#F7F8FA]">
                    <td className="px-5 py-4 text-sm text-[#5D6C7B]">{index + 1}</td>
                    <td className="px-5 py-4 font-mono text-sm text-[#1C2B33]">{account.account_id}</td>
                    <td className="px-5 py-4 text-sm font-semibold leading-5 text-[#1C2B33]">{account.name}</td>
                    <td className="px-5 py-4">
                      <span className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-bold leading-4",
                        account.ownership === "own"
                          ? "bg-[#E8F3FF] text-[#0064E0]"
                          : account.ownership === "agency"
                            ? "bg-[rgba(255,226,0,0.15)] text-[#9A6700]"
                            : "bg-[rgba(120,86,255,0.12)] text-[#5C3FB5]"
                      )}>
                        {account.ownership === "own" ? "Own" : account.ownership === "agency" ? "Agency/Shared" : "Personal"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm leading-5 text-[#5D6C7B]">
                      {account.owner_business?.name || account.owner_business?.id || account.business?.name || account.business?.id || "-"}
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-bold leading-4",
                        isActive ? "bg-[rgba(36,228,0,0.15)] text-[#007D1E]" : "bg-[rgba(255,123,145,0.15)] text-[#C80A28]"
                      )}>
                        {ACCOUNT_STATUS_LABELS[account.account_status] || `status ${account.account_status}`}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#1C2B33]">{currency}</td>
                    <td className="px-5 py-4 text-sm text-[#5D6C7B]">{account.timezone_name || "-"}</td>
                    <td className="px-5 py-4 text-right text-sm text-[#1C2B33]">{formatAccountMoney(account.spend_cap, currency)}</td>
                    <td className="px-5 py-4 text-right text-sm font-bold text-[#0064E0]">
                      {remaining === null ? "-" : formatMajorMoney(remaining, currency)}
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-bold text-[#007D1E]">
                      {formatAccountMoney(account.amount_spent, currency)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="px-1 text-sm leading-5 text-[#5D6C7B]">
        Showing {filteredAccounts.length} of {accounts.length} accounts, {activeCount} active.
      </p>
      </>
      ) : (
      <div className="overflow-x-auto rounded-[20px] bg-white shadow-[0_2px_4px_0_rgba(0,0,0,0.10)]">
        <table className="w-full min-w-[820px]">
          <thead className="bg-[#F7F8FA]">
            <tr className="border-b border-[#DEE3E9]">
              <th className="px-5 py-3.5 text-left text-xs font-bold leading-5 text-[#465A69]">Start date</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold leading-5 text-[#465A69]">End date</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold leading-5 text-[#465A69]">Spending limit</th>
            </tr>
          </thead>
          <tbody>
            {limitLoading ? (
              <tr>
                <td colSpan={3} className="px-5 py-14 text-center text-sm text-[#5D6C7B]">
                  <IconLoader2 className="mx-auto mb-3 size-6 animate-spin" />
                  Loading spending limit history...
                </td>
              </tr>
            ) : spendingLimitRows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-14 text-center text-sm text-[#5D6C7B]">
                  No spending limit snapshots yet. Click Sync Meta to save the first snapshot.
                </td>
              </tr>
            ) : (
              spendingLimitRows.map(row => (
                <tr key={row.id} className="border-b border-[#DEE3E9] last:border-0 hover:bg-[#F7F8FA]">
                  <td className="px-5 py-4 text-sm text-[#1C2B33]">{formatDateTime(row.startDate)}</td>
                  <td className="px-5 py-4 text-sm text-[#1C2B33]">{row.endDate ? formatDateTime(row.endDate) : "Current"}</td>
                  <td className="px-5 py-4 text-sm text-[#1C2B33]">
                    {row.spendCap !== null && row.spendCap !== undefined && row.spendCap !== "" && Number(row.spendCap) !== 0
                      ? `Set to ${formatMinorMoney(row.spendCap, row.currency)}`
                      : "Removed spending limit"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}
