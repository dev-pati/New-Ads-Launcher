"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { IconLoader2, IconRocket, IconCheck, IconSearch, IconAlertTriangle, IconPlus, IconTrash, IconX, IconCalendar, IconClock } from "@tabler/icons-react"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { CustomAdSetDialog, type CampaignConfig } from "@/components/custom-adset-dialog"
import { AdSetTextDialog, type AdsetTextConfig } from "@/components/adset-text-dialog"
import { AdPerCreativeTextDialog, type AdCreativeTextConfig } from "@/components/ad-per-creative-text-dialog"

interface Campaign { id: string; name: string; status: string; effective_status: string }
interface AdSet { id: string; name: string; status: string; effective_status: string }
interface Ad { id: string; name: string; status: string; effective_status: string; creative?: { image_url?: string; thumbnail_url?: string } }
interface PageLink { id: string; name: string; url: string; fb_page_id?: string }

type AdsetMode = "existing" | "new" | "per_creative" | "auto_divide" | "custom"

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
  const [createNewCampaign, setCreateNewCampaign] = useState(false)
  const [newCampaignName, setNewCampaignName] = useState("")
  const [createMultipleCampaigns, setCreateMultipleCampaigns] = useState(false)
  const [multipleCampaignNames, setMultipleCampaignNames] = useState<string[]>(["", ""])
  const [creativeDistribution, setCreativeDistribution] = useState<"split" | "duplicate">("split")

  // Adset options
  const [adsetMode, setAdsetMode] = useState<AdsetMode>("existing")
  const [newAdsetName, setNewAdsetName] = useState("")
  const [adsetDailyBudget, setAdsetDailyBudget] = useState("10")
  const [adsetNamePattern, setAdsetNamePattern] = useState("{filename}")
  const [adsPerAdset, setAdsPerAdset] = useState(5)
  const [autoDividePattern, setAutoDividePattern] = useState("Ad Set {index:01}")
  const [customConfig, setCustomConfig] = useState<CampaignConfig[]>([])
  const [customDialogOpen, setCustomDialogOpen] = useState(false)

  // Ad text options
  const [useCommonText, setUseCommonText] = useState(false)
  const [commonHeadlines, setCommonHeadlines] = useState([""])
  const [commonPrimaryTexts, setCommonPrimaryTexts] = useState([""])
  const [commonDescription, setCommonDescription] = useState("")
  const [commonCta, setCommonCta] = useState("LEARN_MORE")
  const [commonWebsiteUrl, setCommonWebsiteUrl] = useState("")
  const [useUniqueTextPerAdset, setUseUniqueTextPerAdset] = useState(false)
  const [adsetTextConfigs, setAdsetTextConfigs] = useState<AdsetTextConfig[]>([])
  const [adsetTextDialogOpen, setAdsetTextDialogOpen] = useState(false)
  const [useUniqueTextPerCreative, setUseUniqueTextPerCreative] = useState(false)
  const [creativeTextConfigs, setCreativeTextConfigs] = useState<AdCreativeTextConfig[]>([])
  const [adPerCreativeDialogOpen, setAdPerCreativeDialogOpen] = useState(false)

  // Ad name options
  const [useCustomAdName, setUseCustomAdName] = useState(false)
  const [adNamePattern, setAdNamePattern] = useState("{filename}")
  const [filenameTransform, setFilenameTransform] = useState<"title_case" | "uppercase" | "lowercase" | "clean" | "split" | null>(null)

  // Creatives details for preview
  const [creativeDetails, setCreativeDetails] = useState<{
    id: string; file_name: string; file_url: string; media_type: string
    headline?: string; primary_text?: string; description?: string; cta?: string; link_url?: string
  }[]>([])

  // Pages
  const [pages, setPages] = useState<PageLink[]>([])
  const [selectedPageId, setSelectedPageId] = useState("")

  // Creative Enhancements
  const [useMetaDefaults, setUseMetaDefaults] = useState(false)
  const [selectedEnhancements, setSelectedEnhancements] = useState<Set<string>>(new Set())

  // Publication Options
  const [createPaused, setCreatePaused] = useState(true)
  const [scheduleStart, setScheduleStart] = useState(false)
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined)
  const [scheduleHour, setScheduleHour] = useState("08")
  const [scheduleMinute, setScheduleMinute] = useState("00")

  // Launch
  const [launching, setLaunching] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setLoadingCampaigns(true)
    fetch(`/api/facebook/campaigns?ad_account_id=${adAccountId}`)
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns || []))
      .finally(() => setLoadingCampaigns(false))

    fetch("/api/creatives")
      .then(r => r.json())
      .then(d => setCreativeDetails((d.creatives || []).filter((c: any) => selectedCreativeIds.includes(c.id))))

    fetch("/api/page-links")
      .then((r) => r.json())
      .then((d) => {
        const pl = d.pageLinks || []
        setPages(pl)
        if (pl.length > 0) setSelectedPageId(pl[0].fb_page_id || pl[0].id)
      })
  }, [open, adAccountId])

  useEffect(() => {
    if (!selectedCampaign) { setAdsets([]); setSelectedAdset(null); return }
    setLoadingAdsets(true)
    fetch(`/api/facebook/adsets?ad_account_id=${adAccountId}&campaign_id=${selectedCampaign.id}`)
      .then((r) => r.json())
      .then((d) => setAdsets(d.adSets || []))
      .finally(() => setLoadingAdsets(false))
    setSelectedAdset(null)
    setAds([])
    setSelectedAd(null)
  }, [selectedCampaign])

  useEffect(() => {
    if (!selectedAdset) { setAds([]); setSelectedAd(null); return }
    setLoadingAds(true)
    fetch(`/api/facebook/ads?ad_account_id=${adAccountId}&adset_id=${selectedAdset.id}`)
      .then((r) => r.json())
      .then((d) => setAds(d.ads || []))
      .finally(() => setLoadingAds(false))
    setSelectedAd(null)
  }, [selectedAdset])

  useEffect(() => {
    if (!selectedAd) return
    if (selectedCampaign) setNewCampaignName(selectedCampaign.name)
    if (selectedAdset) setNewAdsetName(selectedAdset.name)
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

  const today = new Date()
  const dateStr = `${String(today.getMonth()+1).padStart(2,"0")}/${String(today.getDate()).padStart(2,"0")}/${today.getFullYear()}`
  const shortDateStr = `${String(today.getMonth()+1).padStart(2,"0")}/${String(today.getDate()).padStart(2,"0")}`

  const ins = (val: string, set: (v: string) => void, p: string) => set(val + p)

  const campaignOption = createMultipleCampaigns ? "multiple" : createNewCampaign ? "new" : "existing"
  const canLaunch = selectedAd && selectedPageId && selectedCreativeIds.length > 0

  const applyPatLocal = (pat: string, idx: number, fname = "") =>
    pat.replace(/\{filename\}/g, fname)
       .replace(/\{index:001\}/g, String(idx).padStart(3,"0"))
       .replace(/\{index:01\}/g, String(idx).padStart(2,"0"))
       .replace(/\{index\}/g, String(idx))

  const getAdsetNamesForTextConfig = (): string[] => {
    if (adsetMode === "custom") return customConfig.flatMap(c => c.adsets.map(a => a.name))
    if (adsetMode === "per_creative") return creativeDetails.map((cr, i) =>
      applyPatLocal(adsetNamePattern || "{filename}", i + 1, cr.file_name.replace(/\.[^/.]+$/, "")))
    if (adsetMode === "auto_divide") {
      const count = Math.ceil(creativeDetails.length / (adsPerAdset || 5))
      return Array.from({ length: count }, (_, i) => applyPatLocal(autoDividePattern || "Ad Set {index:01}", i + 1))
    }
    if (adsetMode === "new") return [newAdsetName || "New Ad Set"]
    return [selectedAdset?.name || "Existing Ad Set"]
  }

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
          multipleCampaignNames: campaignOption === "multiple" ? multipleCampaignNames.filter(n => n.trim()) : undefined,
          creativeDistribution: campaignOption === "multiple" ? creativeDistribution : undefined,
          adsetMode,
          existingAdsetId: adsetMode === "existing" ? selectedAdset?.id : undefined,
          newAdsetName: adsetMode === "new" ? newAdsetName : undefined,
          adsetNamePattern: (adsetMode === "per_creative" || adsetMode === "auto_divide") ? adsetNamePattern : undefined,
          autoDividePattern: adsetMode === "auto_divide" ? autoDividePattern : undefined,
          adsPerAdset: adsetMode === "auto_divide" ? adsPerAdset : undefined,
          adsetDailyBudget: adsetMode !== "existing" ? Number(adsetDailyBudget) : undefined,
          customConfig: adsetMode === "custom" ? customConfig : undefined,
          useCustomAdName,
          adNamePattern: useCustomAdName ? adNamePattern : undefined,
          filenameTransform: useCustomAdName ? filenameTransform : undefined,
          useCommonText,
          commonHeadlines: useCommonText ? commonHeadlines.filter(h => h.trim()) : undefined,
          commonPrimaryTexts: useCommonText ? commonPrimaryTexts.filter(p => p.trim()) : undefined,
          commonDescription: useCommonText ? commonDescription : undefined,
          commonCta: useCommonText ? commonCta : undefined,
          commonWebsiteUrl: useCommonText ? commonWebsiteUrl : undefined,
          useUniqueTextPerAdset,
          adsetTextConfigs: useUniqueTextPerAdset ? adsetTextConfigs : undefined,
          useUniqueTextPerCreative,
          creativeTextConfigs: useUniqueTextPerCreative ? creativeTextConfigs : undefined,
          useMetaDefaults,
          selectedEnhancements: useMetaDefaults ? undefined : Array.from(selectedEnhancements),
          createPaused,
          startTime: scheduleStart && scheduleDate ? (() => { const d = new Date(scheduleDate); d.setHours(Number(scheduleHour), Number(scheduleMinute), 0, 0); return d.toISOString() })() : undefined,
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
    setResult(null); setError("")
    setSelectedCampaign(null); setSelectedAdset(null); setSelectedAd(null)
    setCreateNewCampaign(false); setCreateMultipleCampaigns(false)
    setMultipleCampaignNames(["", ""]); setCreativeDistribution("split")
    setAdsetMode("existing"); setNewAdsetName(""); setAdsetDailyBudget("10")
    setAdsetNamePattern("{filename}"); setAdsPerAdset(5); setAutoDividePattern("Ad Set {index:01}")
    setCustomConfig([])
    setUseCustomAdName(false); setAdNamePattern("{filename}"); setFilenameTransform(null)
    setUseCommonText(false); setCommonHeadlines([""]); setCommonPrimaryTexts([""])
    setCommonDescription(""); setCommonCta("LEARN_MORE"); setCommonWebsiteUrl("")
    setUseUniqueTextPerAdset(false); setAdsetTextConfigs([])
    setUseUniqueTextPerCreative(false); setCreativeTextConfigs([])
    setUseMetaDefaults(false); setSelectedEnhancements(new Set())
    setCreatePaused(true); setScheduleStart(false); setScheduleDate(undefined); setScheduleHour("08"); setScheduleMinute("00")
    onClose()
  }

  const placeholderBtns = (val: string, set: (v: string) => void, includeFilename = false) => (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-muted-foreground">Placeholders:</span>
      {includeFilename && <button type="button" onClick={() => ins(val, set, "{filename}")} className="rounded border px-2 py-0.5 text-xs hover:bg-muted">Filename</button>}
      <button type="button" onClick={() => ins(val, set, "{index}")} className="rounded border px-2 py-0.5 text-xs hover:bg-muted">Index</button>
      <button type="button" onClick={() => ins(val, set, "{index:01}")} className="rounded border px-2 py-0.5 text-xs hover:bg-muted">Index (01)</button>
      <button type="button" onClick={() => ins(val, set, "{index:001}")} className="rounded border px-2 py-0.5 text-xs hover:bg-muted">Index (001)</button>
      <button type="button" onClick={() => ins(val, set, ` ${dateStr}`)} className="rounded border px-2 py-0.5 text-xs hover:bg-muted">Date</button>
      <button type="button" onClick={() => ins(val, set, ` ${shortDateStr}`)} className="rounded border px-2 py-0.5 text-xs hover:bg-muted">Short Date</button>
    </div>
  )

  const applyFnTransform = (name: string) => {
    switch (filenameTransform) {
      case "title_case": return name.replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
      case "uppercase": return name.toUpperCase()
      case "lowercase": return name.toLowerCase()
      case "clean": return name.replace(/[^a-zA-Z0-9\s]/g, "").trim()
      case "split": return name.replace(/[_-]/g, " ")
      default: return name
    }
  }

  const resolveAdName = (filename: string, index: number) => {
    if (!useCustomAdName) return filename
    const fname = applyFnTransform(filename)
    return adNamePattern
      .replace(/\{filename\}/g, fname)
      .replace(/\{index:001\}/g, String(index).padStart(3, "0"))
      .replace(/\{index:01\}/g, String(index).padStart(2, "0"))
      .replace(/\{index\}/g, String(index))
      .replace(/\{date:short\}/g, shortDateStr)
      .replace(/\{date\}/g, dateStr)
  }

  const budgetField = (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Daily Budget</span>
      <span className="text-sm">$</span>
      <Input
        type="number"
        value={adsetDailyBudget}
        onChange={(e) => setAdsetDailyBudget(e.target.value)}
        className="w-28 h-8"
        min="1"
      />
      <span className="text-sm text-muted-foreground">USD</span>
    </div>
  )

  return (
    <>
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
                <p className="text-sm text-muted-foreground">Select an existing ad to copy its targeting and budget settings.</p>
              </div>
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
                      {loadingCampaigns ? <div className="flex justify-center py-4"><IconLoader2 className="size-4 animate-spin" /></div>
                        : filteredCampaigns.map((c) => (
                          <button key={c.id} onClick={() => setSelectedCampaign(selectedCampaign?.id === c.id ? null : c)}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted break-words leading-tight ${selectedCampaign?.id === c.id ? "bg-primary/10 text-primary font-medium" : ""}`}>
                            {selectedCampaign?.id === c.id && <IconCheck className="inline size-3 mr-1" />}{c.name}
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
                      {!selectedCampaign ? <p className="text-center text-xs text-muted-foreground py-4">Select a campaign first</p>
                        : loadingAdsets ? <div className="flex justify-center py-4"><IconLoader2 className="size-4 animate-spin" /></div>
                        : filteredAdsets.map((a) => (
                          <button key={a.id} onClick={() => setSelectedAdset(selectedAdset?.id === a.id ? null : a)}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted break-words leading-tight ${selectedAdset?.id === a.id ? "bg-primary/10 text-primary font-medium" : ""}`}>
                            {selectedAdset?.id === a.id && <IconCheck className="inline size-3 mr-1" />}{a.name}
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
                      {!selectedAdset ? <p className="text-center text-xs text-muted-foreground py-4">Select an ad set first</p>
                        : loadingAds ? <div className="flex justify-center py-4"><IconLoader2 className="size-4 animate-spin" /></div>
                        : filteredAds.map((a) => (
                          <button key={a.id} onClick={() => setSelectedAd(selectedAd?.id === a.id ? null : a)}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted leading-tight flex items-center gap-2 ${selectedAd?.id === a.id ? "bg-primary/10 text-primary font-medium" : ""}`}>
                            {(a.creative?.thumbnail_url || a.creative?.image_url)
                              ? <img src={a.creative.thumbnail_url || a.creative.image_url} alt="" className="size-10 rounded object-cover shrink-0" />
                              : <div className="size-10 rounded bg-muted shrink-0" />}
                            <span className="break-words min-w-0">
                              {selectedAd?.id === a.id && <IconCheck className="inline size-3 mr-1" />}{a.name}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Campaign Options */}
            {selectedCampaign && (
              <div className="space-y-3 rounded-lg border p-4">
                <h3 className="font-semibold">Campaign Options</h3>

                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input type="checkbox" checked={createNewCampaign} onChange={(e) => { setCreateNewCampaign(e.target.checked); if (e.target.checked) { setCreateMultipleCampaigns(false); if (adsetMode === "existing") setAdsetMode("new") } }} className="size-4" />
                  Create new campaign
                </label>
                {createNewCampaign && (
                  <div className="ml-6 space-y-2">
                    <Input value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)} placeholder="Campaign name..." />
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">Placeholders:</span>
                      <button type="button" onClick={() => ins(newCampaignName, setNewCampaignName, ` ${dateStr}`)} className="rounded border px-2 py-0.5 text-xs hover:bg-muted">Date</button>
                      <button type="button" onClick={() => ins(newCampaignName, setNewCampaignName, ` ${shortDateStr}`)} className="rounded border px-2 py-0.5 text-xs hover:bg-muted">Short Date</button>
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input type="checkbox" checked={createMultipleCampaigns} onChange={(e) => { setCreateMultipleCampaigns(e.target.checked); if (e.target.checked) { setCreateNewCampaign(false); if (adsetMode === "existing") setAdsetMode("new") } }} className="size-4" />
                  Create multiple new campaigns
                  {createMultipleCampaigns && (
                    <div className="ml-auto flex rounded-md border overflow-hidden text-xs">
                      <button type="button" onClick={() => setCreativeDistribution("split")} className={`px-3 py-1 ${creativeDistribution === "split" ? "bg-foreground text-background" : "hover:bg-muted"}`}>Split Creatives</button>
                      <button type="button" onClick={() => setCreativeDistribution("duplicate")} className={`px-3 py-1 ${creativeDistribution === "duplicate" ? "bg-foreground text-background" : "hover:bg-muted"}`}>Duplicate Creatives</button>
                    </div>
                  )}
                </label>
                {createMultipleCampaigns && (
                  <div className="ml-6 space-y-3">
                    {multipleCampaignNames.map((name, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex gap-2 items-center">
                          <Input value={name} onChange={(e) => { const u = [...multipleCampaignNames]; u[i] = e.target.value; setMultipleCampaignNames(u) }} placeholder={`Campaign ${i + 1}`} className="flex-1" />
                          {i === multipleCampaignNames.length - 1
                            ? <button type="button" onClick={() => setMultipleCampaignNames([...multipleCampaignNames, ""])} className="rounded border p-1.5 hover:bg-muted"><IconPlus className="size-4" /></button>
                            : <button type="button" onClick={() => setMultipleCampaignNames(multipleCampaignNames.filter((_, j) => j !== i))} className="rounded border p-1.5 hover:bg-muted text-destructive"><IconTrash className="size-4" /></button>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">Placeholders:</span>
                          <button type="button" onClick={() => { const u = [...multipleCampaignNames]; u[i] += String(i+1); setMultipleCampaignNames(u) }} className="rounded border px-2 py-0.5 text-xs hover:bg-muted">Index</button>
                          <button type="button" onClick={() => { const u = [...multipleCampaignNames]; u[i] += String(i+1).padStart(2,"0"); setMultipleCampaignNames(u) }} className="rounded border px-2 py-0.5 text-xs hover:bg-muted">Index (01)</button>
                          <button type="button" onClick={() => { const u = [...multipleCampaignNames]; u[i] += ` ${dateStr}`; setMultipleCampaignNames(u) }} className="rounded border px-2 py-0.5 text-xs hover:bg-muted">Date</button>
                          <button type="button" onClick={() => { const u = [...multipleCampaignNames]; u[i] += ` ${shortDateStr}`; setMultipleCampaignNames(u) }} className="rounded border px-2 py-0.5 text-xs hover:bg-muted">Short Date</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!createNewCampaign && !createMultipleCampaigns && (
                  <p className="ml-6 text-xs text-muted-foreground">Using existing: <span className="font-medium text-foreground">{selectedCampaign.name}</span></p>
                )}
              </div>
            )}

            {/* Ad Set Options */}
            {(selectedAdset || createNewCampaign || createMultipleCampaigns) && (
              <div className="space-y-3 rounded-lg border p-4">
                <h3 className="font-semibold">Ad Set Options</h3>

                {/* Option 1: Create new ad set */}
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input type="checkbox" checked={adsetMode === "new"} onChange={() => setAdsetMode(adsetMode === "new" ? "existing" : "new")} className="size-4" />
                  Create new ad set
                </label>
                {adsetMode === "new" && (
                  <div className="ml-6 space-y-2">
                    <Input value={newAdsetName} onChange={(e) => setNewAdsetName(e.target.value)} placeholder="Ad set name..." />
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">Placeholders:</span>
                      <button type="button" onClick={() => ins(newAdsetName, setNewAdsetName, ` ${dateStr}`)} className="rounded border px-2 py-0.5 text-xs hover:bg-muted">Date</button>
                      <button type="button" onClick={() => ins(newAdsetName, setNewAdsetName, ` ${shortDateStr}`)} className="rounded border px-2 py-0.5 text-xs hover:bg-muted">Short Date</button>
                    </div>
                    {budgetField}
                  </div>
                )}

                {/* Option 2: Per creative */}
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input type="checkbox" checked={adsetMode === "per_creative"} onChange={() => setAdsetMode(adsetMode === "per_creative" ? "existing" : "per_creative")} className="size-4" />
                  Create new ad set per upload or group
                </label>
                {adsetMode === "per_creative" && (
                  <div className="ml-6 space-y-2">
                    <p className="text-xs text-muted-foreground">Ad Set Name Pattern</p>
                    <Input value={adsetNamePattern} onChange={(e) => setAdsetNamePattern(e.target.value)} placeholder="{filename}" />
                    {placeholderBtns(adsetNamePattern, setAdsetNamePattern, true)}
                    {budgetField}
                  </div>
                )}

                {/* Option 3: Auto-divide */}
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input type="checkbox" checked={adsetMode === "auto_divide"} onChange={() => setAdsetMode(adsetMode === "auto_divide" ? "existing" : "auto_divide")} className="size-4" />
                  Auto-divide ads into ad sets
                </label>
                {adsetMode === "auto_divide" && (
                  <div className="ml-6 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Ads per ad set</span>
                      <Input type="number" value={adsPerAdset} onChange={(e) => setAdsPerAdset(Number(e.target.value))} className="w-20 h-8" min="1" />
                    </div>
                    <p className="text-xs text-muted-foreground">Ad Set Name Pattern</p>
                    <Input value={autoDividePattern} onChange={(e) => setAutoDividePattern(e.target.value)} placeholder="Ad Set {index:01}" />
                    {placeholderBtns(autoDividePattern, setAutoDividePattern)}
                    {budgetField}
                  </div>
                )}

                {/* Option 4: Custom */}
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input type="checkbox" checked={adsetMode === "custom"} onChange={() => setAdsetMode(adsetMode === "custom" ? "existing" : "custom")} className="size-4" />
                  Build custom ad set configuration
                  {adsetMode === "custom" && (
                    <button type="button" onClick={() => setCustomDialogOpen(true)}
                      className="ml-2 rounded border border-primary text-primary px-3 py-0.5 text-xs hover:bg-primary/5">
                      {customConfig.length > 0 ? "Edit Configuration" : "Configure Ad Sets"}
                    </button>
                  )}
                </label>
                {adsetMode === "custom" && customConfig.length > 0 && (
                  <div className="ml-6 text-xs text-muted-foreground">
                    {customConfig.reduce((s, c) => s + c.adsets.length, 0)} ad sets, {customConfig.reduce((s, c) => s + c.adsets.reduce((ss, a) => ss + a.creativeIds.length, 0), 0)} ads configured
                  </div>
                )}

                {adsetMode === "existing" && selectedAdset && (
                  <p className="ml-6 text-xs text-muted-foreground">Using existing: <span className="font-medium text-foreground">{selectedAdset.name}</span></p>
                )}
              </div>
            )}

            {/* Ad Name Options */}
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="font-semibold">Ad Name Options</h3>
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                <input type="checkbox" checked={useCustomAdName} onChange={e => setUseCustomAdName(e.target.checked)} className="size-4" />
                Use custom ad name pattern
              </label>
              {useCustomAdName && (
                <div className="ml-6 space-y-3">
                  <Input value={adNamePattern} onChange={e => setAdNamePattern(e.target.value)} placeholder="{filename}" />
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Click to insert placeholders:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {([
                        ["{filename}", "Filename"],
                        ["{index}", "Index"],
                        ["{index:01}", "Index (01)"],
                        ["{index:001}", "Index (001)"],
                        ["{date:short}", "Short Date"],
                        ["{date}", "Date"],
                      ] as [string, string][]).map(([ph, label]) => (
                        <button key={ph} type="button" onClick={() => ins(adNamePattern, setAdNamePattern, ph)}
                          className="rounded border px-2 py-0.5 text-xs hover:bg-muted">{label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Extract from filename:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {([
                        ["title_case", "Title Case"],
                        ["uppercase", "UPPERCASE"],
                        ["lowercase", "lowercase"],
                        ["clean", "Clean"],
                        ["split", "Split"],
                      ] as const).map(([t, label]) => (
                        <button key={t} type="button" onClick={() => setFilenameTransform(filenameTransform === t ? null : t)}
                          className={`rounded border px-2 py-0.5 text-xs ${filenameTransform === t ? "border-primary text-primary bg-primary/5" : "hover:bg-muted"}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Preview table — luôn hiện khi có creative */}
            {creativeDetails.length > 0 && (() => {
                  const today = new Date()
                  const dStr = `${String(today.getMonth()+1).padStart(2,"0")}/${String(today.getDate()).padStart(2,"0")}/${today.getFullYear()}`
                  const sStr = `${String(today.getMonth()+1).padStart(2,"0")}/${String(today.getDate()).padStart(2,"0")}`
                  const applyPat = (pat: string, idx: number, fname = "") =>
                    pat.replace(/\{filename\}/g, fname)
                       .replace(/\{index:001\}/g, String(idx).padStart(3,"0"))
                       .replace(/\{index:01\}/g, String(idx).padStart(2,"0"))
                       .replace(/\{index\}/g, String(idx))
                       .replace(/ ?\$\{date\}/g, ` ${dStr}`)
                       .replace(/ ?\$\{shortDate\}/g, ` ${sStr}`)

                  type Row = { campId: string; campName: string; adsetId: string; adsetName: string; adName: string }
                  const rows: Row[] = []
                  let gIdx = 1

                  const campId = createNewCampaign ? "-" : createMultipleCampaigns ? "-" : selectedCampaign?.id || "-"
                  const campName = createNewCampaign ? newCampaignName : createMultipleCampaigns ? "(multiple)" : selectedCampaign?.name || "-"

                  if (adsetMode === "custom" && customConfig.length > 0) {
                    customConfig.forEach(camp => {
                      camp.adsets.forEach(adset => {
                        adset.creativeIds.forEach(cid => {
                          const cr = creativeDetails.find(c => c.id === cid)
                          const fname = cr?.file_name.replace(/\.[^/.]+$/, "") || cid
                          rows.push({ campId: "-", campName: camp.name, adsetId: "-", adsetName: adset.name, adName: resolveAdName(fname, gIdx++) })
                        })
                      })
                    })
                  } else if (adsetMode === "per_creative") {
                    creativeDetails.forEach((cr, i) => {
                      const fname = cr.file_name.replace(/\.[^/.]+$/, "")
                      rows.push({ campId, campName, adsetId: "-", adsetName: applyPat(adsetNamePattern || "{filename}", i+1, fname), adName: resolveAdName(fname, gIdx++) })
                    })
                  } else if (adsetMode === "auto_divide") {
                    const chunkSize = adsPerAdset || 5
                    creativeDetails.forEach((cr, i) => {
                      const groupIdx = Math.floor(i / chunkSize) + 1
                      rows.push({ campId, campName, adsetId: "-", adsetName: applyPat(autoDividePattern || "Ad Set {index:01}", groupIdx), adName: resolveAdName(cr.file_name.replace(/\.[^/.]+$/, ""), gIdx++) })
                    })
                  } else {
                    const adsetId = adsetMode === "existing" ? (selectedAdset?.id || "-") : "-"
                    const adsetName = adsetMode === "existing" ? (selectedAdset?.name || "-") : newAdsetName
                    creativeDetails.forEach(cr => {
                      rows.push({ campId, campName, adsetId, adsetName, adName: resolveAdName(cr.file_name.replace(/\.[^/.]+$/, ""), gIdx++) })
                    })
                  }

                  return (
                    <div className="rounded-lg border overflow-hidden">
                      <div className="bg-muted/50 px-4 py-2 border-b">
                        <h3 className="font-semibold text-sm">Preview</h3>
                        <p className="text-xs text-muted-foreground">{rows.length} ad{rows.length !== 1 ? "s" : ""} will be created</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">CAMPAIGN ID</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">CAMPAIGN NAME</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">AD SET ID</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">AD SET NAME</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">AD NAME</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, i) => (
                              <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                                <td className="px-3 py-2 text-muted-foreground font-mono">{row.campId}</td>
                                <td className="px-3 py-2 max-w-[200px] truncate" title={row.campName}>{row.campName}</td>
                                <td className="px-3 py-2 text-muted-foreground font-mono">{row.adsetId}</td>
                                <td className="px-3 py-2 max-w-[200px] truncate" title={row.adsetName}>{row.adsetName}</td>
                                <td className="px-3 py-2 max-w-[200px] truncate" title={row.adName}>{row.adName}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
            })()}

            {/* Ad Text Options */}
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="font-semibold">Ad Text Options</h3>

              {/* Option 1 */}
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                <input type="radio" name="adTextMode" checked={!useCommonText && !useUniqueTextPerAdset && !useUniqueTextPerCreative}
                  onChange={() => { setUseCommonText(false); setUseUniqueTextPerAdset(false); setUseUniqueTextPerCreative(false) }} className="size-4" />
                Use text from each creative (default)
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                <input type="radio" name="adTextMode" checked={useCommonText}
                  onChange={() => { setUseCommonText(true); setUseUniqueTextPerAdset(false); setUseUniqueTextPerCreative(false) }} className="size-4" />
                Apply common text to all ads
              </label>
              {useCommonText && (
                <div className="ml-6 space-y-4">
                  {/* Headlines */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Headlines</p>
                    <p className="text-xs text-muted-foreground">Multiple headlines will be cycled across ads (ad 1 → headline 1, ad 2 → headline 2, ...)</p>
                    {commonHeadlines.map((h, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={h}
                          onChange={e => { const u = [...commonHeadlines]; u[i] = e.target.value; setCommonHeadlines(u) }}
                          placeholder={`Headline ${i + 1}`}
                          className="flex-1"
                          maxLength={255}
                        />
                        {commonHeadlines.length > 1 && (
                          <button type="button" onClick={() => setCommonHeadlines(commonHeadlines.filter((_, j) => j !== i))}
                            className="rounded border p-2 hover:bg-muted text-muted-foreground hover:text-foreground">
                            <IconX className="size-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => setCommonHeadlines([...commonHeadlines, ""])}
                      className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <IconPlus className="size-3" /> Add headline
                    </button>
                  </div>

                  {/* Primary Texts */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Primary Texts</p>
                    <p className="text-xs text-muted-foreground">Multiple primary texts will be cycled across ads</p>
                    {commonPrimaryTexts.map((pt, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <Textarea
                          value={pt}
                          onChange={e => { const u = [...commonPrimaryTexts]; u[i] = e.target.value; setCommonPrimaryTexts(u) }}
                          placeholder={`Primary text ${i + 1}`}
                          className="flex-1 min-h-[80px] resize-y"
                        />
                        {commonPrimaryTexts.length > 1 && (
                          <button type="button" onClick={() => setCommonPrimaryTexts(commonPrimaryTexts.filter((_, j) => j !== i))}
                            className="rounded border p-2 hover:bg-muted text-muted-foreground hover:text-foreground mt-0.5">
                            <IconX className="size-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => setCommonPrimaryTexts([...commonPrimaryTexts, ""])}
                      className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <IconPlus className="size-3" /> Add primary text
                    </button>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">Link Description</p>
                    <Input value={commonDescription} onChange={e => setCommonDescription(e.target.value)} placeholder="Description (optional)" />
                  </div>

                  {/* CTA */}
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">Call to Action</p>
                    <select value={commonCta} onChange={e => setCommonCta(e.target.value)}
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                      {[
                        ["LEARN_MORE", "Learn More"],
                        ["SHOP_NOW", "Shop Now"],
                        ["SIGN_UP", "Sign Up"],
                        ["DOWNLOAD", "Download"],
                        ["GET_QUOTE", "Get Quote"],
                        ["SUBSCRIBE", "Subscribe"],
                        ["CONTACT_US", "Contact Us"],
                        ["APPLY_NOW", "Apply Now"],
                        ["GET_OFFER", "Get Offer"],
                        ["BOOK_TRAVEL", "Book Travel"],
                        ["NO_BUTTON", "No Button"],
                      ].map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Website URL */}
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">Website URL</p>
                    <Input value={commonWebsiteUrl} onChange={e => setCommonWebsiteUrl(e.target.value)} placeholder="https://..." type="url" />
                  </div>
                </div>
              )}

              {/* Option 2 */}
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                <input type="radio" name="adTextMode" checked={useUniqueTextPerAdset}
                  onChange={() => { setUseUniqueTextPerAdset(true); setUseCommonText(false); setUseUniqueTextPerCreative(false) }} className="size-4" />
                Write unique ad text per ad set
              </label>
              {useUniqueTextPerAdset && (
                <div className="ml-6">
                  <button type="button" onClick={() => setAdsetTextDialogOpen(true)}
                    className="rounded border border-primary text-primary px-3 py-1.5 text-sm hover:bg-primary/5">
                    {adsetTextConfigs.length > 0 ? `Edit Text (${getAdsetNamesForTextConfig().length} ad sets configured)` : "Configure Ad Set Text"}
                  </button>
                  {adsetTextConfigs.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {adsetTextConfigs.filter(c => c.headlines[0] || c.primaryTexts[0]).length} / {adsetTextConfigs.length} ad sets have text
                    </p>
                  )}
                </div>
              )}

              {/* Option 3 */}
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                <input type="radio" name="adTextMode" checked={useUniqueTextPerCreative}
                  onChange={() => { setUseUniqueTextPerCreative(true); setUseCommonText(false); setUseUniqueTextPerAdset(false) }} className="size-4" />
                Write unique ad text for each ad
              </label>
              {useUniqueTextPerCreative && (
                <div className="ml-6">
                  <button type="button" onClick={() => setAdPerCreativeDialogOpen(true)}
                    className="rounded border border-primary text-primary px-3 py-1.5 text-sm hover:bg-primary/5">
                    {creativeTextConfigs.length > 0 ? `Edit Text (${creativeDetails.length} ads configured)` : "Configure Ad Text"}
                  </button>
                  {creativeTextConfigs.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {creativeTextConfigs.filter(c => c.headlines?.[0] || c.primaryTexts?.[0]).length} / {creativeTextConfigs.length} ads have text
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Creative Enhancements */}
            {(() => {
              const IMAGE_OPTIONS = [
                { key: "add_music", label: "Add music" },
                { key: "image_brightness_and_contrast", label: "Adjust brightness and contrast" },
                { key: "cta_enhancements", label: "Enhance CTA" },
                { key: "relevant_comments", label: "Relevant comments" },
                { key: "image_animation", label: "Reveal details over time" },
                { key: "text_optimizations", label: "Text improvements" },
                { key: "translate_text", label: "Translate text" },
                { key: "image_touch_ups", label: "Visual touch-ups" },
              ]
              const VIDEO_OPTIONS = [
                { key: "add_music", label: "Add music" },
                { key: "video_effects", label: "Add video effects" },
                { key: "cta_enhancements", label: "Enhance CTA" },
                { key: "relevant_comments", label: "Relevant comments" },
                { key: "image_animation", label: "Reveal details over time" },
                { key: "text_optimizations", label: "Text improvements" },
                { key: "translate_text", label: "Translate text" },
                { key: "visual_touch_ups", label: "Visual touch-ups" },
              ]
              const allKeys = [...new Set([...IMAGE_OPTIONS, ...VIDEO_OPTIONS].map(o => o.key))]
              const allSelected = allKeys.every(k => selectedEnhancements.has(k))
              const toggleEnhancement = (key: string) => {
                const next = new Set(selectedEnhancements)
                next.has(key) ? next.delete(key) : next.add(key)
                setSelectedEnhancements(next)
              }
              const selectAll = () => setSelectedEnhancements(allSelected ? new Set() : new Set(allKeys))
              return (
                <div className="space-y-3 rounded-lg border p-4">
                  <div>
                    <h3 className="font-semibold">Creative Enhancements</h3>
                    <p className="text-sm text-muted-foreground">Select Advantage+ enhancements to enable.</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={useMetaDefaults} onChange={e => { setUseMetaDefaults(e.target.checked); if (e.target.checked) setSelectedEnhancements(new Set()) }} className="size-4" />
                      Use Meta Defaults
                    </label>
                    {!useMetaDefaults && (
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="checkbox" checked={allSelected} onChange={selectAll} className="size-4" />
                        Select All
                      </label>
                    )}
                  </div>
                  {!useMetaDefaults && (
                    <div className="grid grid-cols-2 gap-4">
                      {[{ label: "Images", options: IMAGE_OPTIONS }, { label: "Videos", options: VIDEO_OPTIONS }].map(group => (
                        <div key={group.label}>
                          <p className="text-sm font-medium mb-2">{group.label}</p>
                          <div className="space-y-1.5">
                            {group.options.map(opt => (
                              <label key={opt.key} className="flex items-center gap-2 cursor-pointer text-sm">
                                <input type="checkbox" checked={selectedEnhancements.has(opt.key)} onChange={() => toggleEnhancement(opt.key)} className="size-4 accent-primary" />
                                {opt.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Publication Options */}
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="font-semibold">Publication Options</h3>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={createPaused} onChange={e => setCreatePaused(e.target.checked)} className="size-4 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Create ads in paused status</p>
                  <p className="text-xs text-muted-foreground">Ads will be created but won't run until you manually activate them in Meta Ads Manager.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={scheduleStart} onChange={e => { setScheduleStart(e.target.checked); if (!e.target.checked) { setScheduleDate(undefined); setScheduleHour("08"); setScheduleMinute("00") } }} className="size-4 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Schedule these ads to start at a specific time</p>
                  <p className="text-xs text-muted-foreground">Ads will remain paused until the scheduled time.</p>
                  {scheduleStart && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {/* Date picker */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className={`flex items-center gap-2 h-9 px-3 rounded-md border text-sm transition-colors hover:bg-muted ${scheduleDate ? "text-foreground" : "text-muted-foreground"}`}>
                            <IconCalendar className="size-4 shrink-0" />
                            {scheduleDate
                              ? scheduleDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : "Pick a date"}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={scheduleDate}
                            onSelect={setScheduleDate}
                            disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>

                      {/* Time picker */}
                      <div className="flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm">
                        <IconClock className="size-4 text-muted-foreground shrink-0" />
                        <select value={scheduleHour} onChange={e => setScheduleHour(e.target.value)}
                          className="bg-transparent border-none outline-none cursor-pointer text-sm w-10 text-center">
                          {Array.from({length: 24}, (_, i) => String(i).padStart(2,"0")).map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        <span className="text-muted-foreground">:</span>
                        <select value={scheduleMinute} onChange={e => setScheduleMinute(e.target.value)}
                          className="bg-transparent border-none outline-none cursor-pointer text-sm w-10 text-center">
                          {["00","05","10","15","20","25","30","35","40","45","50","55"].map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>

                      {/* Preview */}
                      {scheduleDate && (
                        <span className="text-xs text-muted-foreground">
                          Starts {scheduleDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at {scheduleHour}:{scheduleMinute}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </label>
            </div>

            {/* Page + Launch */}
            {selectedAd && (
              <>
                {pages.length > 0 && (
                  <div className="space-y-2 rounded-lg border p-4">
                    <h3 className="font-semibold">Facebook Page</h3>
                    <select value={selectedPageId} onChange={(e) => setSelectedPageId(e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                      {pages.map((p) => <option key={p.id} value={p.fb_page_id || p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    <IconAlertTriangle className="size-4 shrink-0" />{error}
                  </div>
                )}

                <Button onClick={handleLaunch} disabled={launching || !canLaunch} className="w-full">
                  {launching ? <><IconLoader2 className="size-4 animate-spin" /> Launching...</> : <><IconRocket className="size-4" /> Launch {selectedCreativeIds.length} Ads</>}
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>

    <CustomAdSetDialog
      open={customDialogOpen}
      onClose={() => setCustomDialogOpen(false)}
      creativeIds={selectedCreativeIds}
      campaignNames={
        createMultipleCampaigns ? multipleCampaignNames.filter(n => n.trim()) :
        createNewCampaign ? [newCampaignName || "Campaign 1"] :
        [selectedCampaign?.name || "Campaign 1"]
      }
      onApply={(cfg) => { setCustomConfig(cfg) }}
    />
    <AdSetTextDialog
      open={adsetTextDialogOpen}
      onClose={() => setAdsetTextDialogOpen(false)}
      adsetNames={getAdsetNamesForTextConfig()}
      initial={adsetTextConfigs}
      onApply={setAdsetTextConfigs}
    />
    <AdPerCreativeTextDialog
      open={adPerCreativeDialogOpen}
      onClose={() => setAdPerCreativeDialogOpen(false)}
      creatives={creativeDetails as any}
      initial={creativeTextConfigs}
      onApply={setCreativeTextConfigs}
    />
    </>
  )
}
