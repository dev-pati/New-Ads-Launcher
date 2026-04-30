"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { IconLoader2, IconRocket, IconCheck, IconSearch, IconAlertTriangle } from "@tabler/icons-react"

interface Campaign { id: string; name: string; status: string; effective_status: string }
interface AdSet { id: string; name: string; status: string; effective_status: string }
interface Ad { id: string; name: string; status: string; effective_status: string }
interface PageLink { id: string; name: string; url: string; fb_page_id?: string }

interface Props {
  open: boolean
  onClose: () => void
  selectedCreativeIds: string[]
  adAccountId: string
}

export function LaunchAdsDialog({ open, onClose, selectedCreativeIds, adAccountId }: Props) {
  // Template picker
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [adsets, setAdsets] = useState<AdSet[]>([])
  const [ads, setAds] = useState<Ad[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [selectedAdset, setSelectedAdset] = useState<AdSet | null>(null)
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null)
  const [onlyActive, setOnlyActive] = useState(false)
  const [searchCampaign, setSearchCampaign] = useState("")
  const [searchAdset, setSearchAdset] = useState("")
  const [searchAd, setSearchAd] = useState("")
  const [loadingCampaigns, setLoadingCampaigns] = useState(false)
  const [loadingAdsets, setLoadingAdsets] = useState(false)
  const [loadingAds, setLoadingAds] = useState(false)

  // Campaign options
  const [campaignOption, setCampaignOption] = useState<"existing" | "new">("existing")
  const [newCampaignName, setNewCampaignName] = useState("")

  // Adset options
  const [adsetOption, setAdsetOption] = useState<"existing" | "new">("existing")
  const [newAdsetName, setNewAdsetName] = useState("")

  // Pages
  const [pages, setPages] = useState<PageLink[]>([])
  const [selectedPageId, setSelectedPageId] = useState("")

  // Launch
  const [launching, setLaunching] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")

  // Fetch campaigns on open
  useEffect(() => {
    if (!open) return
    setLoadingCampaigns(true)
    fetch(`/api/facebook/campaigns?ad_account_id=${adAccountId}`)
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns || []))
      .finally(() => setLoadingCampaigns(false))

    fetch("/api/page-links")
      .then((r) => r.json())
      .then((d) => {
        const pl = d.pageLinks || []
        setPages(pl)
        if (pl.length > 0) setSelectedPageId(pl[0].fb_page_id || pl[0].id)
      })
  }, [open, adAccountId])

  // Fetch adsets when campaign selected
  useEffect(() => {
    if (!selectedCampaign) { setAdsets([]); setSelectedAdset(null); return }
    setLoadingAdsets(true)
    fetch(`/api/facebook/adsets?campaign_id=${selectedCampaign.id}`)
      .then((r) => r.json())
      .then((d) => setAdsets(d.adsets || []))
      .finally(() => setLoadingAdsets(false))
    setSelectedAdset(null)
    setAds([])
    setSelectedAd(null)
  }, [selectedCampaign])

  // Fetch ads when adset selected
  useEffect(() => {
    if (!selectedAdset) { setAds([]); setSelectedAd(null); return }
    setLoadingAds(true)
    fetch(`/api/facebook/ads?adset_id=${selectedAdset.id}`)
      .then((r) => r.json())
      .then((d) => setAds(d.ads || []))
      .finally(() => setLoadingAds(false))
    setSelectedAd(null)
  }, [selectedAdset])

  // Auto-fill names when template selected
  useEffect(() => {
    if (!selectedAd) return
    if (selectedCampaign) setNewCampaignName(`${selectedCampaign.name} - Copy`)
    if (selectedAdset) setNewAdsetName(`${selectedAdset.name} - Copy`)
  }, [selectedAd])

  const filteredCampaigns = campaigns
    .filter((c) => !onlyActive || c.effective_status === "ACTIVE")
    .filter((c) => c.name.toLowerCase().includes(searchCampaign.toLowerCase()))

  const filteredAdsets = adsets
    .filter((a) => !onlyActive || a.effective_status === "ACTIVE")
    .filter((a) => a.name.toLowerCase().includes(searchAdset.toLowerCase()))

  const filteredAds = ads
    .filter((a) => !onlyActive || a.effective_status === "ACTIVE")
    .filter((a) => a.name.toLowerCase().includes(searchAd.toLowerCase()))

  const canLaunch = selectedAd && selectedPageId && selectedCreativeIds.length > 0

  const handleLaunch = async () => {
    if (!canLaunch) return
    setLaunching(true)
    setError("")
    try {
      const res = await fetch("/api/facebook/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateAdId: selectedAd!.id,
          creativeIds: selectedCreativeIds,
          campaignOption,
          existingCampaignId: campaignOption === "existing" ? selectedCampaign?.id : undefined,
          newCampaignName: campaignOption === "new" ? newCampaignName : undefined,
          adsetOption,
          existingAdsetId: adsetOption === "existing" ? selectedAdset?.id : undefined,
          newAdsetName: adsetOption === "new" ? newAdsetName : undefined,
          pageId: selectedPageId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLaunching(false)
    }
  }

  const handleClose = () => {
    setResult(null)
    setError("")
    setSelectedCampaign(null)
    setSelectedAdset(null)
    setSelectedAd(null)
    setCampaignOption("existing")
    setAdsetOption("existing")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-[95vw] h-[92vh] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconRocket className="size-5" />
            Launch Ads ({selectedCreativeIds.length} creatives)
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2 font-medium text-green-700">
                <IconCheck className="size-5" />
                {result.summary}
              </div>
            </div>
            {result.errors?.length > 0 && (
              <div className="space-y-1">
                {result.errors.map((e: any, i: number) => (
                  <div key={i} className="text-sm text-destructive">{e.error}</div>
                ))}
              </div>
            )}
            <Button onClick={handleClose} className="w-full">Done</Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Select Ad Template */}
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold">Select Ad from Facebook</h3>
                <p className="text-sm text-muted-foreground">
                  Select an existing ad to copy its targeting and budget settings.
                </p>
              </div>

              {/* Only active toggle */}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
                Only active
              </label>

              <div className="grid grid-cols-3 gap-3">
                {/* Campaigns */}
                <div className="rounded-lg border">
                  <div className="border-b p-2 font-medium text-sm">Campaigns</div>
                  <div className="p-2">
                    <div className="relative mb-2">
                      <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <Input placeholder="Search..." value={searchCampaign} onChange={(e) => setSearchCampaign(e.target.value)} className="h-7 pl-6 text-xs" />
                    </div>
                    <div className="max-h-80 overflow-y-auto space-y-0.5">
                      {loadingCampaigns ? (
                        <div className="flex justify-center py-4"><IconLoader2 className="size-4 animate-spin" /></div>
                      ) : filteredCampaigns.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedCampaign(c)}
                          className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted break-words leading-tight ${selectedCampaign?.id === c.id ? "bg-primary/10 text-primary font-medium" : ""}`}
                        >
                          {selectedCampaign?.id === c.id && <IconCheck className="inline size-3 mr-1" />}
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Ad Sets */}
                <div className="rounded-lg border">
                  <div className="border-b p-2 font-medium text-sm">Ad Sets</div>
                  <div className="p-2">
                    <div className="relative mb-2">
                      <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <Input placeholder="Search..." value={searchAdset} onChange={(e) => setSearchAdset(e.target.value)} className="h-7 pl-6 text-xs" />
                    </div>
                    <div className="max-h-80 overflow-y-auto space-y-0.5">
                      {!selectedCampaign ? (
                        <p className="text-center text-xs text-muted-foreground py-4">Select a campaign first</p>
                      ) : loadingAdsets ? (
                        <div className="flex justify-center py-4"><IconLoader2 className="size-4 animate-spin" /></div>
                      ) : filteredAdsets.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => setSelectedAdset(a)}
                          className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted break-words leading-tight ${selectedAdset?.id === a.id ? "bg-primary/10 text-primary font-medium" : ""}`}
                        >
                          {selectedAdset?.id === a.id && <IconCheck className="inline size-3 mr-1" />}
                          {a.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Ads */}
                <div className="rounded-lg border">
                  <div className="border-b p-2 font-medium text-sm">Ads</div>
                  <div className="p-2">
                    <div className="relative mb-2">
                      <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <Input placeholder="Search..." value={searchAd} onChange={(e) => setSearchAd(e.target.value)} className="h-7 pl-6 text-xs" />
                    </div>
                    <div className="max-h-80 overflow-y-auto space-y-0.5">
                      {!selectedAdset ? (
                        <p className="text-center text-xs text-muted-foreground py-4">Select an ad set first</p>
                      ) : loadingAds ? (
                        <div className="flex justify-center py-4"><IconLoader2 className="size-4 animate-spin" /></div>
                      ) : filteredAds.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => setSelectedAd(a)}
                          className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted break-words leading-tight ${selectedAd?.id === a.id ? "bg-primary/10 text-primary font-medium" : ""}`}
                        >
                          {selectedAd?.id === a.id && <IconCheck className="inline size-3 mr-1" />}
                          {a.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {selectedAd && (
              <>
                {/* Campaign Options */}
                <div className="space-y-3 rounded-lg border p-4">
                  <h3 className="font-semibold">Campaign Options</h3>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" checked={campaignOption === "existing"} onChange={() => setCampaignOption("existing")} />
                    Use existing campaign
                    <span className="text-xs text-muted-foreground truncate max-w-xs">({selectedCampaign?.name})</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" checked={campaignOption === "new"} onChange={() => setCampaignOption("new")} />
                    Create new campaign
                  </label>
                  {campaignOption === "new" && (
                    <Input
                      value={newCampaignName}
                      onChange={(e) => setNewCampaignName(e.target.value)}
                      placeholder="Campaign name..."
                      className="ml-6"
                    />
                  )}
                </div>

                {/* Ad Set Options */}
                <div className="space-y-3 rounded-lg border p-4">
                  <h3 className="font-semibold">Ad Set Options</h3>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" checked={adsetOption === "existing"} onChange={() => setAdsetOption("existing")} />
                    Use existing ad set
                    <span className="text-xs text-muted-foreground truncate max-w-xs">({selectedAdset?.name})</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" checked={adsetOption === "new"} onChange={() => setAdsetOption("new")} />
                    Create new ad set (copy settings from template)
                  </label>
                  {adsetOption === "new" && (
                    <Input
                      value={newAdsetName}
                      onChange={(e) => setNewAdsetName(e.target.value)}
                      placeholder="Ad set name..."
                      className="ml-6"
                    />
                  )}
                </div>

                {/* Page Selection */}
                {pages.length > 0 && (
                  <div className="space-y-2 rounded-lg border p-4">
                    <h3 className="font-semibold">Facebook Page</h3>
                    <select
                      value={selectedPageId}
                      onChange={(e) => setSelectedPageId(e.target.value)}
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      {pages.map((p) => (
                        <option key={p.id} value={p.fb_page_id || p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Preview */}
                <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
                  <strong className="text-foreground">{selectedCreativeIds.length} ads</strong> will be created in{" "}
                  <strong className="text-foreground">
                    {adsetOption === "new" ? `new ad set "${newAdsetName}"` : `"${selectedAdset?.name}"`}
                  </strong>
                  {campaignOption === "new" && (
                    <> under new campaign <strong className="text-foreground">"{newCampaignName}"</strong></>
                  )}. All ads will be created as <strong className="text-foreground">PAUSED</strong>.
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    <IconAlertTriangle className="size-4 shrink-0" />
                    {error}
                  </div>
                )}

                <Button onClick={handleLaunch} disabled={launching || !canLaunch} className="w-full">
                  {launching ? (
                    <><IconLoader2 className="size-4 animate-spin" /> Launching...</>
                  ) : (
                    <><IconRocket className="size-4" /> Launch {selectedCreativeIds.length} Ads</>
                  )}
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
