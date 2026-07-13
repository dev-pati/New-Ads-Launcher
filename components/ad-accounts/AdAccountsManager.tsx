"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  IconAlertCircle,
  IconArrowsSort,
  IconCalendar,
  IconChevronDown,
  IconLoader2,
  IconRefresh,
  IconSearch,
  IconX,
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
  business?: { id: string; name?: string }
  owner_business?: { id: string; name?: string }
  ownership?: AccountOwnership
}

interface AccountMetricSnapshot {
  id: string
  fb_ad_account_id: string
  fb_account_id: string
  name: string | null
  account_status: number | null
  currency: string | null
  timezone_name: string | null
  spend_cap_minor: number | null
  remaining_minor: number | null
  amount_spent_minor: number | null
  ownership: string | null
  owner_business_name: string | null
  synced_at: string
}

const ACCOUNT_STATUS_LABELS: Record<number, string> = {
  1: "active", 2: "disabled", 3: "unsettled", 7: "pending review",
  8: "pending settlement", 9: "in grace period", 100: "pending closure",
  101: "closed", 201: "any active", 202: "any closed",
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF","CLP","DJF","GNF","JPY","KMF","KRW","MGA","PYG","RWF","UGX","VND","VUV","XAF","XOF","XPF",
])

function parseMinorMoney(value?: string | number | null, currency = "USD") {
  if (value === undefined || value === null || value === "") return null
  const raw = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(raw)) return null
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? raw : raw / 100
}

function formatMajorMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency,
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
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    day: "2-digit", month: "2-digit", year: "numeric", hour12: false,
  }).format(date)
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(new Date(value))
}

function formatMinorMoney(value?: string | number | null, currency = "USD") {
  if (value === undefined || value === null || value === "") return "-"
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return "-"
  return formatAccountMoney(amount, currency)
}

function toDateInputValue(iso?: string | null) {
  if (!iso) return ""
  return iso.slice(0, 10)
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
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  // Historical data for Ad Accounts tab
  const [acctDateFrom, setAcctDateFrom] = useState("")
  const [acctDateTo, setAcctDateTo] = useState("")
  const [historicalAccounts, setHistoricalAccounts] = useState<AccountMetricSnapshot[]>([])
  const [historicalLoading, setHistoricalLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

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

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  const fetchLimitSnapshots = useCallback(async (accountId: string) => {
    if (!accountId) { setLimitSnapshots([]); return }
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

  const fetchHistoricalAccounts = useCallback(async (from: string, to: string) => {
    if (!from && !to) { setHistoricalAccounts([]); return }
    setHistoricalLoading(true)
    try {
      const params = new URLSearchParams()
      if (from) params.set("date_from", from)
      if (to) params.set("date_to", to)
      const res = await fetch(`/api/facebook/ad-account-metrics?${params}`)
      const data = await res.json()
      setHistoricalAccounts(data.snapshots || [])
    } catch {
      setHistoricalAccounts([])
    } finally {
      setHistoricalLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === "accounts") {
      fetchHistoricalAccounts(acctDateFrom, acctDateTo)
    }
  }, [activeTab, acctDateFrom, acctDateTo, fetchHistoricalAccounts])

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

  const hasAcctDateFilter = Boolean(acctDateFrom || acctDateTo)

  const filteredHistorical = historicalAccounts.filter(s => {
    const text = `${s.fb_account_id || ""} ${s.name || ""}`.toLowerCase()
    if (!text.includes(query.trim().toLowerCase())) return false
    const isActive = s.account_status === 1
    if (statusFilter === "active" && !isActive) return false
    if (statusFilter === "disabled" && isActive) return false
    if (ownershipFilter === "own" && s.ownership !== "own") return false
    if (ownershipFilter === "agency" && s.ownership !== "agency") return false
    return true
  })

  const displayRows = hasAcctDateFilter ? filteredHistorical : filteredAccounts

  const activeCount = accounts.filter(a => a.account_status === 1).length
  const ownCount = accounts.filter(a => a.ownership === "own").length
  const agencyCount = accounts.filter(a => a.ownership === "agency").length
  const personalCount = accounts.filter(a => a.ownership === "unknown").length

  const selectedAccount =
    accounts.find(a => a.account_id === selectedAccountId || a.id === selectedAccountId) || accounts[0]

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

    return rows
      .map((row, index) => ({
        id: row.id,
        startDate: row.synced_at,
        endDate: index === 0 ? null : rows[index - 1]?.synced_at,
        currency: row.currency || selectedAccount?.currency || "USD",
        spendCap: row.spend_cap_minor,
      }))
      .filter(row => {
        if (dateFrom) {
          const start = new Date(row.startDate)
          if (start < new Date(dateFrom)) return false
        }
        if (dateTo) {
          const start = new Date(row.startDate)
          if (start > new Date(dateTo + "T23:59:59")) return false
        }
        return true
      })
  })()

  const hasDateFilter = Boolean(dateFrom || dateTo)

  const FILTER_BTN = (active: boolean) =>
    cn("flex h-8 items-center px-3.5 text-sm font-medium transition-all rounded-full",
      active ? "bg-[#0064E0] text-white shadow-sm" : "text-[#465A69] hover:bg-[#F1F4F7] hover:text-[#1C2B33]")

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4">

      {/* ── Top card ─────────────────────────────────────────────── */}
      <div className="relative z-10 overflow-visible rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.06]">

        {/* Tabs */}
        <div className="flex h-11 items-center gap-6 border-b border-[#EAECEF] px-6">
          {(["accounts", "spending-limit"] as AccountTab[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn("flex h-full items-center gap-1.5 border-b-2 text-sm font-semibold transition-colors",
                activeTab === tab
                  ? "border-[#0064E0] text-[#0064E0]"
                  : "border-transparent text-[#8595A4] hover:text-[#1C2B33]"
              )}>
              {tab === "accounts" ? "Ad Accounts" : "Account Spending Limit"}
            </button>
          ))}
        </div>

        {/* ── Ad Accounts controls ── */}
        {activeTab === "accounts" ? (
          <div className="px-6 py-4 space-y-3">
            {/* Row 1: title + search + sync */}
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-lg font-bold text-[#1C2B33]">Ad Accounts</h2>
                  <span className="text-sm font-semibold text-[#8595A4]">({accounts.length})</span>
                </div>
                <p className="text-xs text-[#8595A4] mt-0.5">Last synced: {formatLastSynced(lastSynced)}</p>
              </div>

              <div className="relative w-72 shrink-0">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8595A4]" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search by name or ID..."
                  className="h-9 rounded-full border-[#DEE3E9] bg-[#F7F8FA] pl-9 pr-3 text-sm shadow-none placeholder:text-[#8595A4] focus-visible:bg-white focus-visible:border-[#0064E0] focus-visible:ring-2 focus-visible:ring-[#0064E0]/15"
                />
              </div>

              <Button
                onClick={() => fetchAccounts(true)}
                disabled={syncing}
                className="h-9 shrink-0 rounded-full bg-[#0064E0] px-5 text-sm font-semibold shadow-none transition-transform hover:scale-[1.02] hover:bg-[#0052C2] active:scale-[0.98] disabled:bg-[#DEE3E9] disabled:text-[#8595A4]"
              >
                {syncing
                  ? <IconLoader2 className="mr-1.5 size-3.5 animate-spin" />
                  : <IconRefresh className="mr-1.5 size-3.5" />}
                Sync Meta
              </Button>
            </div>

            {/* Row 2: summary chips + filters + date */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Summary badges */}
              <span className="rounded-full bg-[#E8F3FF] px-2.5 py-0.5 text-xs font-bold text-[#0064E0]">Own {ownCount}</span>
              <span className="rounded-full bg-[#F1F4F7] px-2.5 py-0.5 text-xs font-bold text-[#465A69]">Agency {agencyCount}</span>
              {personalCount > 0 && (
                <span className="rounded-full bg-[rgba(120,86,255,0.10)] px-2.5 py-0.5 text-xs font-bold text-[#5C3FB5]">Personal {personalCount}</span>
              )}
              <span className="rounded-full bg-[rgba(36,228,0,0.10)] px-2.5 py-0.5 text-xs font-bold text-[#007D1E]">Active {activeCount}</span>

              <div className="mx-1 h-4 w-px bg-[#DEE3E9]" />

              {/* TYPE filter */}
              <div className="flex items-center gap-0.5 rounded-full border border-[#DEE3E9] bg-[#F7F8FA] p-0.5">
                <span className="px-2.5 text-xs font-extrabold uppercase tracking-wide text-[#8595A4]">Type</span>
                {(["all", "agency", "own"] as AccountOwnershipFilter[]).map(t => (
                  <button key={t} onClick={() => setOwnershipFilter(t)} className={FILTER_BTN(ownershipFilter === t)}>
                    {t === "all" ? "All" : t === "agency" ? "Agency" : "Own"}
                  </button>
                ))}
              </div>

              {/* STATUS filter */}
              <div className="flex items-center gap-0.5 rounded-full border border-[#DEE3E9] bg-[#F7F8FA] p-0.5">
                <span className="px-2.5 text-xs font-extrabold uppercase tracking-wide text-[#8595A4]">Status</span>
                {(["all", "active", "disabled"] as AccountStatusFilter[]).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={cn(FILTER_BTN(statusFilter === s), "gap-1.5")}>
                    <span className={cn("size-1.5 rounded-full shrink-0",
                      s === "active" ? "bg-[#31A24C]" : s === "disabled" ? "bg-[#E41E3F]" : "bg-[#8595A4]",
                      statusFilter === s && "bg-white/80"
                    )} />
                    {s === "all" ? "All" : s === "active" ? "Active" : "Disabled"}
                  </button>
                ))}
              </div>

              <div className="mx-1 h-4 w-px bg-[#DEE3E9]" />

              {/* DATE filter — keep FROM/TO/Clear together so they never wrap apart */}
              <div className="flex shrink-0 items-center gap-2">
                <div className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors",
                  hasAcctDateFilter ? "border-[#0064E0] bg-[#E8F3FF]" : "border-[#DEE3E9] bg-[#F7F8FA]"
                )}>
                  <IconCalendar className={cn("size-3.5 shrink-0", hasAcctDateFilter ? "text-[#0064E0]" : "text-[#8595A4]")} />
                  <span className={cn("text-xs font-extrabold uppercase tracking-wide", hasAcctDateFilter ? "text-[#0064E0]" : "text-[#8595A4]")}>From</span>
                  <input
                    type="date"
                    value={acctDateFrom}
                    onChange={e => setAcctDateFrom(e.target.value)}
                    max={acctDateTo || toDateInputValue(new Date().toISOString())}
                    className="h-6 border-0 bg-transparent text-sm font-medium text-[#1C2B33] outline-none [color-scheme:light]"
                  />
                </div>

                <div className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors",
                  hasAcctDateFilter ? "border-[#0064E0] bg-[#E8F3FF]" : "border-[#DEE3E9] bg-[#F7F8FA]"
                )}>
                  <IconCalendar className={cn("size-3.5 shrink-0", hasAcctDateFilter ? "text-[#0064E0]" : "text-[#8595A4]")} />
                  <span className={cn("text-xs font-extrabold uppercase tracking-wide", hasAcctDateFilter ? "text-[#0064E0]" : "text-[#8595A4]")}>To</span>
                  <input
                    type="date"
                    value={acctDateTo}
                    onChange={e => setAcctDateTo(e.target.value)}
                    min={acctDateFrom || undefined}
                    max={toDateInputValue(new Date().toISOString())}
                    className="h-6 border-0 bg-transparent text-sm font-medium text-[#1C2B33] outline-none [color-scheme:light]"
                  />
                </div>

                {hasAcctDateFilter && (
                  <button
                    onClick={() => { setAcctDateFrom(""); setAcctDateTo("") }}
                    className="flex items-center gap-1 rounded-full bg-[#E8F3FF] px-3 py-1.5 text-xs font-semibold text-[#0064E0] transition-colors hover:bg-[#D0E8FF]"
                  >
                    <IconX className="size-3" />
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

        ) : (
        /* ── Spending Limit controls ── */
          <div className="px-6 py-4 space-y-3">
            {/* Row 1: title + account selector + sync */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-[#1C2B33]">Account Spending Limit</h2>
                <p className="text-xs text-[#8595A4] mt-0.5">
                  {selectedAccount ? `${selectedAccount.name} · ${selectedAccount.account_id}` : "Select an ad account"}
                </p>
              </div>

              {/* Account dropdown */}
              <div className="relative w-72 shrink-0" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen(o => !o)}
                  className="flex h-9 w-full items-center justify-between rounded-full border border-[#DEE3E9] bg-[#F7F8FA] px-4 text-left text-sm font-medium text-[#1C2B33] transition-colors hover:border-[#0064E0] hover:bg-white"
                >
                  <span className="truncate">
                    {selectedAccount ? `${selectedAccount.name} (${selectedAccount.account_id})` : "Select account"}
                  </span>
                  <IconChevronDown className={cn("ml-2 size-4 shrink-0 text-[#8595A4] transition-transform", accountMenuOpen && "rotate-180")} />
                </button>

                {accountMenuOpen && (
                  <div className="absolute left-0 top-11 z-50 w-full overflow-hidden rounded-xl border border-[#EAECEF] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                    <div className="border-b border-[#EAECEF] p-2">
                      <Input
                        autoFocus
                        value={accountSearch}
                        onChange={e => setAccountSearch(e.target.value)}
                        placeholder="Search by name or ID..."
                        className="h-9 rounded-lg border-[#0064E0] text-sm focus-visible:ring-[#0064E0]/20"
                      />
                    </div>
                    <div className="max-h-56 overflow-auto py-1">
                      {accountOptions.length === 0
                        ? <div className="px-4 py-3 text-sm text-[#8595A4]">No accounts found.</div>
                        : accountOptions.map(account => (
                          <button key={account.id || account.account_id} type="button"
                            onClick={() => { setSelectedAccountId(account.account_id); setAccountMenuOpen(false); setAccountSearch("") }}
                            className={cn("flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-[#F7F8FA]",
                              selectedAccount?.account_id === account.account_id ? "bg-[#E8F3FF] text-[#0064E0]" : "text-[#1C2B33]"
                            )}>
                            <span className="truncate font-semibold">{account.name}</span>
                            <span className="shrink-0 font-mono text-xs text-[#8595A4]">{account.account_id}</span>
                          </button>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={async () => { await fetchAccounts(true); if (selectedAccountId) await fetchLimitSnapshots(selectedAccountId) }}
                disabled={syncing}
                className="h-9 shrink-0 rounded-full bg-[#0064E0] px-5 text-sm font-semibold shadow-none transition-transform hover:scale-[1.02] hover:bg-[#0052C2] active:scale-[0.98] disabled:bg-[#DEE3E9] disabled:text-[#8595A4]"
              >
                {syncing ? <IconLoader2 className="mr-1.5 size-3.5 animate-spin" /> : <IconRefresh className="mr-1.5 size-3.5" />}
                Sync Meta
              </Button>
            </div>

            {/* Row 2: date range filter */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-[#DEE3E9] bg-[#F7F8FA] px-3 py-1.5">
                <IconCalendar className="size-3.5 shrink-0 text-[#8595A4]" />
                <span className="text-xs font-extrabold uppercase tracking-wide text-[#8595A4]">From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  max={dateTo || toDateInputValue(new Date().toISOString())}
                  className="h-6 border-0 bg-transparent text-sm font-medium text-[#1C2B33] outline-none [color-scheme:light]"
                />
              </div>

              <div className="flex items-center gap-2 rounded-full border border-[#DEE3E9] bg-[#F7F8FA] px-3 py-1.5">
                <IconCalendar className="size-3.5 shrink-0 text-[#8595A4]" />
                <span className="text-xs font-extrabold uppercase tracking-wide text-[#8595A4]">To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  min={dateFrom || undefined}
                  max={toDateInputValue(new Date().toISOString())}
                  className="h-6 border-0 bg-transparent text-sm font-medium text-[#1C2B33] outline-none [color-scheme:light]"
                />
              </div>

              {hasDateFilter && (
                <button
                  onClick={() => { setDateFrom(""); setDateTo("") }}
                  className="flex items-center gap-1 rounded-full bg-[#F1F4F7] px-3 py-1.5 text-xs font-semibold text-[#465A69] transition-colors hover:bg-[#DEE3E9]"
                >
                  <IconX className="size-3" />
                  Clear
                </button>
              )}

              {hasDateFilter && (
                <span className="text-xs text-[#8595A4]">
                  {spendingLimitRows.length} result{spendingLimitRows.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-[#E41E3F]/20 bg-[#FFF0F3] px-4 py-3 text-sm font-medium text-[#C80A28]">
          <IconAlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Ad Accounts table ── */}
      {activeTab === "accounts" ? (
        <>
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.06]">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b border-[#EAECEF] bg-[#F7F8FA]">
                  {["#", "Account ID", "Name", "Type", "Owner", "Status", "Currency", "Timezone", "Spend Cap", "Remaining", "Spent"].map(label => (
                    <th key={label} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#8595A4]">
                      <span className="flex items-center gap-1">
                        {label}
                        {["Spend Cap", "Remaining", "Spent"].includes(label) && (
                          <IconArrowsSort className="size-3 text-[#C4CAD4]" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(loading || historicalLoading) ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center">
                      <IconLoader2 className="mx-auto mb-2 size-5 animate-spin text-[#0064E0]" />
                      <p className="text-sm text-[#8595A4]">{historicalLoading ? "Loading historical data…" : "Loading ad accounts…"}</p>
                    </td>
                  </tr>
                ) : displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-sm text-[#8595A4]">
                      {hasAcctDateFilter ? "No snapshot data found for the selected date range." : "No ad accounts found."}
                    </td>
                  </tr>
                ) : hasAcctDateFilter
                  ? filteredHistorical.map((snap, index) => {
                    const currency = snap.currency || "USD"
                    const isActive = snap.account_status === 1
                    return (
                      <tr key={snap.id}
                        className="border-b border-[#EAECEF] last:border-0 transition-colors hover:bg-[#F7F8FA]">
                        <td className="px-5 py-3.5 text-sm text-[#C4CAD4]">{index + 1}</td>
                        <td className="px-5 py-3.5 font-mono text-xs text-[#465A69]">{snap.fb_account_id}</td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-[#1C2B33]">{snap.name || "-"}</td>
                        <td className="px-5 py-3.5">
                          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold",
                            snap.ownership === "own" ? "bg-[#E8F3FF] text-[#0064E0]"
                              : snap.ownership === "agency" ? "bg-[rgba(255,185,0,0.12)] text-[#9A6700]"
                              : "bg-[rgba(120,86,255,0.10)] text-[#5C3FB5]"
                          )}>
                            {snap.ownership === "own" ? "Own" : snap.ownership === "agency" ? "Agency/Shared" : "Personal"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-[#465A69]">{snap.owner_business_name || "-"}</td>
                        <td className="px-5 py-3.5">
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold",
                            isActive ? "bg-[rgba(36,228,0,0.10)] text-[#007D1E]" : "bg-[rgba(228,30,63,0.08)] text-[#C80A28]"
                          )}>
                            <span className={cn("size-1.5 rounded-full", isActive ? "bg-[#31A24C]" : "bg-[#E41E3F]")} />
                            {ACCOUNT_STATUS_LABELS[snap.account_status ?? 0] || `status ${snap.account_status}`}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-[#1C2B33]">{currency}</td>
                        <td className="px-5 py-3.5 text-sm text-[#8595A4]">{snap.timezone_name || "-"}</td>
                        <td className="px-5 py-3.5 text-right text-sm text-[#1C2B33]">{formatMinorMoney(snap.spend_cap_minor, currency)}</td>
                        <td className="px-5 py-3.5 text-right text-sm font-bold text-[#0064E0]">{formatMinorMoney(snap.remaining_minor, currency)}</td>
                        <td className="px-5 py-3.5 text-right text-sm font-bold text-[#007D1E]">{formatMinorMoney(snap.amount_spent_minor, currency)}</td>
                      </tr>
                    )
                  })
                  : filteredAccounts.map((account, index) => {
                    const currency = account.currency || "USD"
                    const spent = parseMinorMoney(account.amount_spent, currency)
                    const cap = parseMinorMoney(account.spend_cap, currency)
                    const remaining = cap !== null && spent !== null ? Math.max(cap - spent, 0) : null
                    const isActive = account.account_status === 1
                    return (
                      <tr key={account.id || account.account_id}
                        className="border-b border-[#EAECEF] last:border-0 transition-colors hover:bg-[#F7F8FA]">
                        <td className="px-5 py-3.5 text-sm text-[#C4CAD4]">{index + 1}</td>
                        <td className="px-5 py-3.5 font-mono text-xs text-[#465A69]">{account.account_id}</td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-[#1C2B33]">{account.name}</td>
                        <td className="px-5 py-3.5">
                          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold",
                            account.ownership === "own" ? "bg-[#E8F3FF] text-[#0064E0]"
                              : account.ownership === "agency" ? "bg-[rgba(255,185,0,0.12)] text-[#9A6700]"
                              : "bg-[rgba(120,86,255,0.10)] text-[#5C3FB5]"
                          )}>
                            {account.ownership === "own" ? "Own" : account.ownership === "agency" ? "Agency/Shared" : "Personal"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-[#465A69]">
                          {account.owner_business?.name || account.owner_business?.id || account.business?.name || account.business?.id || "-"}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold",
                            isActive ? "bg-[rgba(36,228,0,0.10)] text-[#007D1E]" : "bg-[rgba(228,30,63,0.08)] text-[#C80A28]"
                          )}>
                            <span className={cn("size-1.5 rounded-full", isActive ? "bg-[#31A24C]" : "bg-[#E41E3F]")} />
                            {ACCOUNT_STATUS_LABELS[account.account_status] || `status ${account.account_status}`}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-[#1C2B33]">{currency}</td>
                        <td className="px-5 py-3.5 text-sm text-[#8595A4]">{account.timezone_name || "-"}</td>
                        <td className="px-5 py-3.5 text-right text-sm text-[#1C2B33]">{formatAccountMoney(account.spend_cap, currency)}</td>
                        <td className="px-5 py-3.5 text-right text-sm font-bold text-[#0064E0]">
                          {remaining === null ? "-" : formatMajorMoney(remaining, currency)}
                        </td>
                        <td className="px-5 py-3.5 text-right text-sm font-bold text-[#007D1E]">
                          {formatAccountMoney(account.amount_spent, currency)}
                        </td>
                      </tr>
                    )
                  })
                }
              </tbody>
            </table>
          </div>
          <p className="px-1 text-xs text-[#8595A4]">
            Showing <span className="font-semibold text-[#465A69]">{filteredAccounts.length}</span> of{" "}
            <span className="font-semibold text-[#465A69]">{accounts.length}</span> accounts,{" "}
            <span className="font-semibold text-[#007D1E]">{activeCount}</span> active.
          </p>
        </>

      ) : (
      /* ── Spending Limit table ── */
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.06]">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-[#EAECEF] bg-[#F7F8FA]">
                {["Start date", "End date", "Activity"].map(label => (
                  <th key={label} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#8595A4]">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {limitLoading ? (
                <tr>
                  <td colSpan={3} className="py-16 text-center">
                    <IconLoader2 className="mx-auto mb-2 size-5 animate-spin text-[#0064E0]" />
                    <p className="text-sm text-[#8595A4]">Loading spending limit history…</p>
                  </td>
                </tr>
              ) : spendingLimitRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-16 text-center text-sm text-[#8595A4]">
                    {hasDateFilter
                      ? "No records found for the selected date range."
                      : "No spending limit snapshots yet. Click Sync Meta to save the first snapshot."}
                  </td>
                </tr>
              ) : spendingLimitRows.map(row => (
                <tr key={row.id} className="border-b border-[#EAECEF] last:border-0 transition-colors hover:bg-[#F7F8FA]">
                  <td className="px-5 py-3.5 text-sm text-[#1C2B33]">{formatDateTime(row.startDate)}</td>
                  <td className="px-5 py-3.5 text-sm text-[#1C2B33]">
                    {row.endDate
                      ? formatDateTime(row.endDate)
                      : <span className="rounded-full bg-[rgba(36,228,0,0.10)] px-2.5 py-0.5 text-xs font-bold text-[#007D1E]">Current</span>
                    }
                  </td>
                  <td className="px-5 py-3.5 text-sm font-medium text-[#1C2B33]">
                    {row.spendCap !== null && row.spendCap !== undefined && row.spendCap !== "" && Number(row.spendCap) !== 0
                      ? <span>Set to <span className="font-bold text-[#0064E0]">{formatMinorMoney(row.spendCap, row.currency)}</span></span>
                      : <span className="text-[#8595A4]">Removed spending limit</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
