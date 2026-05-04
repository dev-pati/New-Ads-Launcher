"use client"

import { useCallback, useEffect, useState } from "react"
import { useAdAccount } from "@/lib/ad-account-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  IconLoader2,
  IconChevronRight,
  IconChevronDown,
  IconTargetArrow,
  IconLayoutGrid,
  IconAd2,
  IconRefresh,
  IconTrash,
  IconAlertTriangle,
} from "@tabler/icons-react"

interface AdAccount {
  id: string
  account_id: string
  name: string
  currency: string
}

interface Campaign {
  id: string
  name: string
  status: string
  effective_status: string
  objective: string
  daily_budget?: string
  lifetime_budget?: string
  created_time: string
}

interface AdSet {
  id: string
  name: string
  status: string
  effective_status: string
  daily_budget?: string
  optimization_goal?: string
  created_time: string
}

interface Ad {
  id: string
  name: string
  status: string
  effective_status: string
  creative?: {
    id: string
    title?: string
    body?: string
    thumbnail_url?: string
  }
  created_time: string
}

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  PAUSED: "secondary",
  DELETED: "destructive",
  ARCHIVED: "outline",
  IN_PROCESS: "secondary",
  WITH_ISSUES: "destructive",
  CAMPAIGN_PAUSED: "secondary",
  ADSET_PAUSED: "secondary",
  DISAPPROVED: "destructive",
  PENDING_REVIEW: "outline",
}

function formatBudget(amount?: string) {
  if (!amount) return null
  const value = parseInt(amount) / 100
  return `$${value.toFixed(2)}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function CampaignsPage() {
  const { adAccounts, selectedAccountId: selectedAccount, setSelectedAccountId: setSelectedAccount, loading: loadingAccounts } = useAdAccount()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [adSets, setAdSets] = useState<Record<string, AdSet[]>>({})
  const [ads, setAds] = useState<Record<string, Ad[]>>({})
  const [loadingCampaigns, setLoadingCampaigns] = useState(false)
  const [loadingAdSets, setLoadingAdSets] = useState<string | null>(null)
  const [loadingAds, setLoadingAds] = useState<string | null>(null)
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set())
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set())
  const [deletingCampaign, setDeletingCampaign] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleteError, setDeleteError] = useState("")

  const fetchCampaigns = useCallback(async () => {
    if (!selectedAccount) return
    setLoadingCampaigns(true)
    setExpandedCampaigns(new Set())
    setExpandedAdSets(new Set())
    setAdSets({})
    setAds({})
    try {
      const res = await fetch(`/api/facebook/campaigns?ad_account_id=${selectedAccount}`)
      const data = await res.json()
      setCampaigns(data.campaigns || [])
    } catch {
      // ignore
    } finally {
      setLoadingCampaigns(false)
    }
  }, [selectedAccount])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const confirmDelete = (campaignId: string, campaignName: string) => {
    setDeleteError("")
    setConfirmTarget({ id: campaignId, name: campaignName })
  }

  const deleteCampaign = async () => {
    if (!confirmTarget) return
    setDeletingCampaign(confirmTarget.id)
    setDeleteError("")
    try {
      const res = await fetch(`/api/facebook/campaigns/${confirmTarget.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete")
      setCampaigns(prev => prev.filter(c => c.id !== confirmTarget.id))
      setConfirmTarget(null)
    } catch (err: any) {
      setDeleteError(err.message)
    } finally {
      setDeletingCampaign(null)
    }
  }

  const toggleCampaign = async (campaignId: string) => {
    const next = new Set(expandedCampaigns)
    if (next.has(campaignId)) {
      next.delete(campaignId)
      setExpandedCampaigns(next)
      return
    }
    next.add(campaignId)
    setExpandedCampaigns(next)

    if (!adSets[campaignId]) {
      setLoadingAdSets(campaignId)
      try {
        const res = await fetch(
          `/api/facebook/adsets?ad_account_id=${selectedAccount}&campaign_id=${campaignId}`
        )
        const data = await res.json()
        setAdSets((prev) => ({ ...prev, [campaignId]: data.adSets || [] }))
      } catch {
        // ignore
      } finally {
        setLoadingAdSets(null)
      }
    }
  }

  const toggleAdSet = async (adSetId: string) => {
    const next = new Set(expandedAdSets)
    if (next.has(adSetId)) {
      next.delete(adSetId)
      setExpandedAdSets(next)
      return
    }
    next.add(adSetId)
    setExpandedAdSets(next)

    if (!ads[adSetId]) {
      setLoadingAds(adSetId)
      try {
        const res = await fetch(
          `/api/facebook/ads?ad_account_id=${selectedAccount}&adset_id=${adSetId}`
        )
        const data = await res.json()
        setAds((prev) => ({ ...prev, [adSetId]: data.ads || [] }))
      } catch {
        // ignore
      } finally {
        setLoadingAds(null)
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            View and manage your Facebook campaigns.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!loadingAccounts && adAccounts.length > 0 && (
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Select Ad Account" />
              </SelectTrigger>
              <SelectContent>
                {adAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name || acc.account_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCampaigns}
            disabled={!selectedAccount || loadingCampaigns}
          >
            <IconRefresh className="size-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Loading states */}
      {loadingAccounts && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-60" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!loadingAccounts && adAccounts.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <IconTargetArrow className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No ad accounts found. Please connect your Facebook account first.
          </p>
        </div>
      )}

      {/* Campaigns list */}
      {loadingCampaigns && (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <IconLoader2 className="size-4 animate-spin" />
          Loading campaigns...
        </div>
      )}

      {!loadingCampaigns && selectedAccount && campaigns.length === 0 && !loadingAccounts && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No campaigns found in this ad account.
          </p>
        </div>
      )}

      {!loadingCampaigns && campaigns.length > 0 && (
        <div className="space-y-1">
          {campaigns.map((campaign) => {
            const isExpanded = expandedCampaigns.has(campaign.id)
            const campaignAdSets = adSets[campaign.id] || []
            const statusVariant = STATUS_COLORS[campaign.effective_status] || "secondary"

            return (
              <div key={campaign.id} className="rounded-lg border">
                <div
                  className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleCampaign(campaign.id)}
                >
                  {isExpanded ? (
                    <IconChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <IconTargetArrow className="size-4 shrink-0 text-blue-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{campaign.name}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Badge variant={statusVariant} className="text-xs">
                        {campaign.effective_status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {campaign.objective}
                      </span>
                      {campaign.daily_budget && (
                        <span className="text-xs text-muted-foreground">
                          Daily: {formatBudget(campaign.daily_budget)}
                        </span>
                      )}
                      {campaign.lifetime_budget && (
                        <span className="text-xs text-muted-foreground">
                          Lifetime: {formatBudget(campaign.lifetime_budget)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(campaign.created_time)}
                  </span>
                  <button
                    className="ml-1 shrink-0 rounded p-1 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-colors"
                    onClick={e => { e.stopPropagation(); confirmDelete(campaign.id, campaign.name) }}
                    disabled={deletingCampaign === campaign.id}
                    title="Delete campaign"
                  >
                    {deletingCampaign === campaign.id
                      ? <IconLoader2 className="size-3.5 animate-spin" />
                      : <IconTrash className="size-3.5" />}
                  </button>
                </div>

                {/* Ad Sets */}
                {isExpanded && (
                  <div className="border-t bg-muted/20">
                    {loadingAdSets === campaign.id && (
                      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                        <IconLoader2 className="size-3 animate-spin" />
                        Loading ad sets...
                      </div>
                    )}

                    {loadingAdSets !== campaign.id && campaignAdSets.length === 0 && (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        No ad sets in this campaign.
                      </p>
                    )}

                    {campaignAdSets.map((adSet) => {
                      const isAdSetExpanded = expandedAdSets.has(adSet.id)
                      const adSetAds = ads[adSet.id] || []
                      const adSetStatus = STATUS_COLORS[adSet.effective_status] || "secondary"

                      return (
                        <div key={adSet.id}>
                          <Separator />
                          <button
                            className="flex w-full items-center gap-3 py-2.5 pr-3 pl-10 text-left transition-colors hover:bg-muted/50"
                            onClick={() => toggleAdSet(adSet.id)}
                          >
                            {isAdSetExpanded ? (
                              <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <IconChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <IconLayoutGrid className="size-3.5 shrink-0 text-purple-500" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{adSet.name}</p>
                              <div className="mt-0.5 flex items-center gap-2">
                                <Badge variant={adSetStatus} className="text-xs">
                                  {adSet.effective_status}
                                </Badge>
                                {adSet.optimization_goal && (
                                  <span className="text-xs text-muted-foreground">
                                    {adSet.optimization_goal}
                                  </span>
                                )}
                                {adSet.daily_budget && (
                                  <span className="text-xs text-muted-foreground">
                                    Daily: {formatBudget(adSet.daily_budget)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>

                          {/* Ads */}
                          {isAdSetExpanded && (
                            <div className="bg-muted/30">
                              {loadingAds === adSet.id && (
                                <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                                  <IconLoader2 className="size-3 animate-spin" />
                                  Loading ads...
                                </div>
                              )}

                              {loadingAds !== adSet.id && adSetAds.length === 0 && (
                                <p className="py-3 text-center text-xs text-muted-foreground">
                                  No ads in this ad set.
                                </p>
                              )}

                              {adSetAds.map((ad) => {
                                const adStatus = STATUS_COLORS[ad.effective_status] || "secondary"

                                return (
                                  <div key={ad.id}>
                                    <Separator />
                                    <div className="flex items-center gap-3 py-2 pr-3 pl-20">
                                      <IconAd2 className="size-3.5 shrink-0 text-orange-500" />
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm">{ad.name}</p>
                                        <div className="mt-0.5 flex items-center gap-2">
                                          <Badge variant={adStatus} className="text-xs">
                                            {ad.effective_status}
                                          </Badge>
                                          {ad.creative?.title && (
                                            <span className="truncate text-xs text-muted-foreground">
                                              {ad.creative.title}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      {ad.creative?.thumbnail_url && (
                                        <img
                                          src={ad.creative.thumbnail_url}
                                          alt={ad.name}
                                          className="size-10 shrink-0 rounded object-cover"
                                        />
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {/* Delete confirmation dialog */}
      <Dialog open={!!confirmTarget} onOpenChange={open => { if (!open && !deletingCampaign) { setConfirmTarget(null); setDeleteError("") } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <IconAlertTriangle className="size-5" />
              Xóa Campaign
            </DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa campaign{" "}
              <span className="font-semibold text-foreground">"{confirmTarget?.name}"</span>?
              <br />
              Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{deleteError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmTarget(null); setDeleteError("") }} disabled={!!deletingCampaign}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={deleteCampaign} disabled={!!deletingCampaign}>
              {deletingCampaign ? <IconLoader2 className="size-4 animate-spin mr-1.5" /> : <IconTrash className="size-4 mr-1.5" />}
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
