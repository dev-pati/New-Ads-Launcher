"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { IconCheck, IconCurrencyDollar, IconLoader2 } from "@tabler/icons-react"
import { useAdAccount } from "@/lib/ad-account-context"

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
  1:   { label: "Active",                 variant: "default" },
  2:   { label: "Disabled",               variant: "destructive" },
  3:   { label: "Unsettled",              variant: "secondary" },
  7:   { label: "Pending Review",         variant: "outline" },
  8:   { label: "Pending Closure",        variant: "destructive" },
  9:   { label: "In Grace Period",        variant: "secondary" },
  100: { label: "Temporarily Unavailable",variant: "secondary" },
  101: { label: "Closed",                 variant: "destructive" },
}

export function AdAccountSelector({
  isConnected,
  selectedAccountId,
  onAccountSelected,
}: AdAccountSelectorProps) {
  // Read from shared context — no independent fetch needed
  const { adAccounts, loading } = useAdAccount()

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

        {!loading && adAccounts.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No ad accounts found. Make sure you have access to at least one
            Facebook Ad Account.
          </p>
        )}

        {!loading && adAccounts.length > 0 && (
          <div className="space-y-2">
            {adAccounts.map((account) => {
              const isSelected = selectedAccountId === account.id
              const status = ACCOUNT_STATUS_MAP[account.account_status ?? 0] || {
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
                      onClick={() => onAccountSelected?.(account as AdAccount)}
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
