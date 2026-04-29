"use client"

import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconCheck, IconLoader2, IconCurrencyDollar } from "@tabler/icons-react"

interface AdAccount {
  id: string
  account_id: string
  name: string
  account_status: number
  currency: string
  amount_spent?: string
  balance?: string
}

interface AdAccountSelectorProps {
  isConnected: boolean
  selectedAccountId?: string
  onAccountSelected?: (account: AdAccount) => void
}

const ACCOUNT_STATUS_MAP: Record<number, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  1: { label: "Active", variant: "default" },
  2: { label: "Disabled", variant: "destructive" },
  3: { label: "Unsettled", variant: "secondary" },
  7: { label: "Pending Review", variant: "outline" },
  8: { label: "Pending Closure", variant: "destructive" },
  9: { label: "In Grace Period", variant: "secondary" },
  100: { label: "Temporarily Unavailable", variant: "secondary" },
  101: { label: "Closed", variant: "destructive" },
}

export function AdAccountSelector({
  isConnected,
  selectedAccountId,
  onAccountSelected,
}: AdAccountSelectorProps) {
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isConnected) return

    async function fetchAccounts() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/facebook/ad-accounts")
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setAccounts(data.adAccounts)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load ad accounts"
        )
      } finally {
        setLoading(false)
      }
    }

    fetchAccounts()
  }, [isConnected])

  if (!isConnected) {
    return (
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle>Select Ad Account</CardTitle>
          <CardDescription>
            Connect your Facebook account first to see your ad accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No account connected</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconCurrencyDollar className="size-5" />
          Select Ad Account
        </CardTitle>
        <CardDescription>
          Choose the ad account you want to manage campaigns for.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <IconLoader2 className="size-4 animate-spin" />
            Loading ad accounts...
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && accounts.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No ad accounts found. Make sure you have access to at least one
            Facebook Ad Account.
          </p>
        )}

        {!loading && accounts.length > 0 && (
          <div className="space-y-2">
            {accounts.map((account) => {
              const isSelected = selectedAccountId === account.id
              const status = ACCOUNT_STATUS_MAP[account.account_status] || {
                label: "Unknown",
                variant: "secondary" as const,
              }

              return (
                <div
                  key={account.id}
                  className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">{account.name}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant={status.variant} className="text-xs">
                        {status.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {account.currency}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ID: {account.account_id}
                      </span>
                    </div>
                  </div>

                  {isSelected ? (
                    <div className="flex items-center gap-1.5 text-sm text-primary">
                      <IconCheck className="size-4" />
                      Selected
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAccountSelected?.(account)}
                      disabled={account.account_status !== 1}
                    >
                      Select
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
