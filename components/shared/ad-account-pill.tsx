"use client"

/**
 * AdAccountPill — the one Ad Account selector.
 *
 * Before this file the same control existed eight times: the Templates pill (Facebook avatar +
 * rounded-full trigger + DropdownMenu), the blue-dot `rounded-lg` picker duplicated twice in
 * insights/page.tsx and three times in insights/_reports.tsx, the searchable `AccountPicker`
 * local to insights/_statistics.tsx, a shadcn `<Select>` in campaigns, and a bare native
 * `<select>` in ads-manager. All eight read the same `useAdAccount()` context and all eight wrote
 * the same setter, so the divergence was purely visual — and it is why the same page could look
 * like two different products depending on which tab you were on.
 *
 * Templates' pill is the design the user chose as canonical, so it is what this renders.
 *
 * Built on Popover rather than DropdownMenu on purpose: the search box has to live inside the
 * panel (the _statistics picker had one and losing it would be a regression), and a text input
 * inside a menu fights the menu's own typeahead for keystrokes. A Popover has no typeahead.
 * Options are a `role="listbox"` / `role="option"` pair, which is both correct for a single-select
 * and what the `cursor: pointer` rule in globals.css keys off.
 *
 * Ad Launcher (`app/(dashboard)/launch/page.tsx`) is deliberately NOT a consumer — its account
 * switch is wired to Via LAUNCH/NON-LAUNCH resolution and page/adset reloads, and the user
 * excluded it explicitly.
 */

import { useMemo, useState } from "react"
import { IconCheck, IconChevronDown, IconSearch } from "@tabler/icons-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAdAccount } from "@/lib/ad-account-context"
import { cn } from "@/lib/utils"

export interface AdAccountOption {
  id: string
  name?: string | null
  account_id?: string | null
}

export interface AdAccountPillProps {
  /**
   * Controlled mode. Pass all three to drive the pill from a list that is not the shared
   * provider (AdAccountsManager keys its own list by `account_id`). Omit them and the pill reads
   * `useAdAccount()` — which is what every page except that one already does.
   */
  accounts?: AdAccountOption[]
  value?: string
  onChange?: (id: string) => void
  /** Which field identifies an option. `account_id` only matters in controlled mode. */
  optionKey?: "id" | "account_id"
  /** Overrides the provider's flag in controlled mode. */
  loading?: boolean
  disabled?: boolean
  /** Render the numeric ad account id beside each name, and in the trigger. */
  showAccountId?: boolean
  /** The search field appears once the list is longer than this. */
  searchThreshold?: number
  align?: "start" | "center" | "end"
  className?: string
  /** Caps the trigger label so a long account name cannot push the header around. */
  labelClassName?: string
  placeholder?: string
}

function optionId(a: AdAccountOption, key: "id" | "account_id") {
  return (key === "account_id" ? a.account_id : a.id) || a.id
}

export function AdAccountPill({
  accounts,
  value,
  onChange,
  optionKey = "id",
  loading,
  disabled,
  showAccountId = false,
  searchThreshold = 8,
  align = "end",
  className,
  labelClassName = "max-w-[160px]",
  placeholder = "Select account",
}: AdAccountPillProps) {
  const ctx = useAdAccount()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  // Controlled only when the caller supplies a list; a caller passing `value` alone still gets
  // the provider's accounts, which is the common case for a page that renamed the fields.
  const list: AdAccountOption[] = accounts ?? ctx.adAccounts
  const selectedId = value ?? ctx.selectedAccountId
  const isLoading = loading ?? (accounts ? false : ctx.loading)
  const commit = onChange ?? ctx.setSelectedAccountId

  const selected = useMemo(
    () => list.find(a => optionId(a, optionKey) === selectedId) || null,
    [list, optionKey, selectedId]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(a =>
      (a.name || "").toLowerCase().includes(q) ||
      (a.account_id || "").toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q)
    )
  }, [list, search])

  const showSearch = list.length > searchThreshold
  const triggerLabel = isLoading
    ? "Loading accounts…"
    : selected
      ? [selected.name || selected.account_id || selected.id, showAccountId ? selected.account_id : null]
          .filter(Boolean).join(" · ")
      : list.length === 0 ? "No ad accounts" : placeholder

  return (
    <Popover
      open={open}
      onOpenChange={v => { setOpen(v); if (!v) setSearch("") }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || isLoading || list.length === 0}
          aria-label="Select ad account"
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 border rounded-full text-sm font-medium",
            "hover:bg-muted/50 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:opacity-60 disabled:hover:bg-transparent",
            className
          )}
        >
          {/* Facebook mark, not a status dot — the accounts are Meta ad accounts and the brand
              blue is the one blue on this control that is decorative rather than text. */}
          <span className="size-5 rounded-full bg-[#1877F2] flex items-center justify-center shrink-0">
            <svg className="size-3 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </span>
          <span className={cn("truncate", labelClassName)}>{triggerLabel}</span>
          <IconChevronDown
            className={cn("size-3.5 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        className="w-64 p-0 gap-0 overflow-hidden rounded-xl"
        onOpenAutoFocus={e => { if (!showSearch) e.preventDefault() }}
      >
        {showSearch && (
          <div className="p-2 border-b">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/40">
              <IconSearch className="size-3.5 text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search accounts..."
                aria-label="Search ad accounts"
                className="flex-1 min-w-0 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
        )}

        <div role="listbox" aria-label="Ad accounts" className="py-1 max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground text-center">
              {list.length === 0 ? "No ad accounts connected." : "No accounts match that search."}
            </p>
          ) : (
            filtered.map(a => {
              const id = optionId(a, optionKey)
              const isSelected = id === selectedId
              return (
                <button
                  key={id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => { commit(id); setOpen(false); setSearch("") }}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors",
                    "hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
                    // `text-link`, not `text-primary`: --primary is a fill colour and measures
                    // 2.99:1 as text on --popover in dark mode. See globals.css.
                    isSelected && "font-semibold text-link"
                  )}
                >
                  <span className="truncate">{a.name || a.account_id || a.id}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    {showAccountId && a.account_id && (
                      <span className="font-mono text-xs text-muted-foreground">{a.account_id}</span>
                    )}
                    {isSelected && <IconCheck className="size-3.5" />}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
