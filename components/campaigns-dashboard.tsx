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
import { Separator } from "@/components/ui/separator"
import {
  IconLoader2,
  IconChevronRight,
  IconChevronDown,
  IconTargetArrow,
  IconLayoutGrid,
  IconAd2,
  IconRefresh,
} from "@tabler/icons-react"

interface Campaign {
  id: string
  name: string
  status: string
  effective_status: string
  objective: string
  daily_budget?: string
  lifetime_budget?: string
  created_time: string
  updated_time: string
}

interface AdSet {
  id: string
  name: string
  status: string
  effective_status: string
  campaign_id: string
  daily_budget?: string
  lifetime_budget?: string
  optimization_goal?: string
  billing_event?: string
  start_time?: string
  end_time?: string
  created_time: string
}

interface Ad {
  id: string
  name: string
  status: string
  effective_status: string
  adset_id: string
  campaign_id: string
  creative?: {
    id: string
    name?: string
    title?: string
    body?: string
    thumbnail_url?: string
  }
  created_time: string
}

interface CampaignsDashboardProps {
  adAccountId: string
  adAccountName: string
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
  PREAPPROVED: "outline",
}

function formatBudget(amount?: string, currency?: string) {
  if (!amount) return "—"
  const value = parseInt(amount) / 100
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(value)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function CampaignsDashboard({
  adAccountId,
  adAccountName,
}: CampaignsDashboardProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [adSets, setAdSets] = useState<Record<string, AdSet[]>>({})
  const [ads, setAds] = useState<Record<string, Ad[]>>({})
  const [loading, setLoading] = useState(true)
  const [loadingAdSets, setLoadingAdSets] = useState<string | null>(null)
  const [loadingAds, setLoadingAds] = useState<string | null>(null)
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(
    new Set()
  )
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const fetchCampaigns = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/facebook/campaigns?ad_account_id=${adAccountId}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCampaigns(data.campaigns)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load campaigns"
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCampaigns()
  }, [adAccountId])

  const toggleCampaign = async (campaignId: string) => {
    const newExpanded = new Set(expandedCampaigns)
    if (newExpanded.has(campaignId)) {
      newExpanded.delete(campaignId)
      setExpandedCampaigns(newExpanded)
      return
    }

    newExpanded.add(campaignId)
    setExpandedCampaigns(newExpanded)

    if (!adSets[campaignId]) {
      setLoadingAdSets(campaignId)
      try {
        const res = await fetch(
          `/api/facebook/adsets?ad_account_id=${adAccountId}&campaign_id=${campaignId}`
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setAdSets((prev) => ({ ...prev, [campaignId]: data.adSets }))
      } catch (err) {
        console.error("Failed to load ad sets:", err)
      } finally {
        setLoadingAdSets(null)
      }
    }
  }

  const toggleAdSet = async (adSetId: string) => {
    const newExpanded = new Set(expandedAdSets)
    if (newExpanded.has(adSetId)) {
      newExpanded.delete(adSetId)
      setExpandedAdSets(newExpanded)
      return
    }

    newExpanded.add(adSetId)
    setExpandedAdSets(newExpanded)

    if (!ads[adSetId]) {
      setLoadingAds(adSetId)
      try {
        const res = await fetch(
          `/api/facebook/ads?ad_account_id=${adAccountId}&adset_id=${adSetId}`
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setAds((prev) => ({ ...prev, [adSetId]: data.ads }))
      } catch (err) {
        console.error("Failed to load ads:", err)
      } finally {
        setLoadingAds(null)
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <IconTargetArrow className="size-5" />
              Campaigns
            </CardTitle>
            <CardDescription>{adAccountName}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCampaigns}>
            <IconRefresh className="size-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <IconLoader2 className="size-4 animate-spin" />
            Loading campaigns...
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && campaigns.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No campaigns found in this ad account.
          </p>
        )}

        {!loading && campaigns.length > 0 && (
          <div className="space-y-1">
            {campaigns.map((campaign) => {
              const isExpanded = expandedCampaigns.has(campaign.id)
              const campaignAdSets = adSets[campaign.id] || []
              const statusVariant =
                STATUS_COLORS[campaign.effective_status] || "secondary"

              return (
                <div key={campaign.id} className="rounded-lg border">
                  {/* Campaign row */}
                  <button
                    className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50"
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
                  </button>

                  {/* Ad Sets */}
                  {isExpanded && (
                    <div className="border-t bg-muted/20">
                      {loadingAdSets === campaign.id && (
                        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                          <IconLoader2 className="size-3 animate-spin" />
                          Loading ad sets...
                        </div>
                      )}

                      {loadingAdSets !== campaign.id &&
                        campaignAdSets.length === 0 && (
                          <p className="py-4 text-center text-xs text-muted-foreground">
                            No ad sets in this campaign.
                          </p>
                        )}

                      {campaignAdSets.map((adSet) => {
                        const isAdSetExpanded = expandedAdSets.has(adSet.id)
                        const adSetAds = ads[adSet.id] || []
                        const adSetStatusVariant =
                          STATUS_COLORS[adSet.effective_status] || "secondary"

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
                                <p className="truncate text-sm font-medium">
                                  {adSet.name}
                                </p>
                                <div className="mt-0.5 flex items-center gap-2">
                                  <Badge
                                    variant={adSetStatusVariant}
                                    className="text-xs"
                                  >
                                    {adSet.effective_status}
                                  </Badge>
                                  {adSet.optimization_goal && (
                                    <span className="text-xs text-muted-foreground">
                                      {adSet.optimization_goal}
                                    </span>
                                  )}
                                  {adSet.daily_budget && (
                                    <span className="text-xs text-muted-foreground">
                                      Daily:{" "}
                                      {formatBudget(adSet.daily_budget)}
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

                                {loadingAds !== adSet.id &&
                                  adSetAds.length === 0 && (
                                    <p className="py-3 text-center text-xs text-muted-foreground">
                                      No ads in this ad set.
                                    </p>
                                  )}

                                {adSetAds.map((ad) => {
                                  const adStatusVariant =
                                    STATUS_COLORS[ad.effective_status] ||
                                    "secondary"

                                  return (
                                    <div key={ad.id}>
                                      <Separator />
                                      <div className="flex items-center gap-3 py-2 pr-3 pl-20">
                                        <IconAd2 className="size-3.5 shrink-0 text-orange-500" />
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-sm">
                                            {ad.name}
                                          </p>
                                          <div className="mt-0.5 flex items-center gap-2">
                                            <Badge
                                              variant={adStatusVariant}
                                              className="text-xs"
                                            >
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
      </CardContent>
    </Card>
  )
}
