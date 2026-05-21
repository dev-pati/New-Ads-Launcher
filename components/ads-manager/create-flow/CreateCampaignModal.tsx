"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  IconAlertCircle,
  IconCheck,
  IconFolder,
  IconLayoutGrid,
  IconLoader2,
  IconTable,
  IconX,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { useAdAccount } from "@/lib/ad-account-context"
import { cn } from "@/lib/utils"
import { AdLevel } from "./AdLevel"
import { AdSetLevel } from "./AdSetLevel"
import { CampaignLevel } from "./CampaignLevel"
import {
  CampaignFormState,
  CreativeAssetOption,
  defaultCampaignState,
  FacebookPageOption,
  InstagramOption,
  PixelOption,
} from "./types"

type Step = "campaign" | "adset" | "ad"

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

interface CreateCampaignResponse {
  success?: boolean
  error?: string
  campaignId?: string
  adSetId?: string
  adId?: string
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
])

function isZeroDecimalCurrency(currency: string) {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function positiveMoney(value: string, currency: string) {
  const trimmed = value.trim()
  const valid = isZeroDecimalCurrency(currency)
    ? /^\d+(\.0{1,2})?$/.test(trimmed)
    : /^\d+(\.\d{1,2})?$/.test(trimmed)
  if (!valid) return false

  const amount = Number.parseFloat(value)
  return Number.isFinite(amount) && amount > 0
}

function validateState(state: CampaignFormState, selectedAccountId: string, currency: string) {
  if (!selectedAccountId) return { step: "campaign" as Step, message: "Select an ad account first." }
  if (!state.campaignName.trim()) return { step: "campaign" as Step, message: "Campaign name is required." }
  if (!state.adSetName.trim()) return { step: "adset" as Step, message: "Ad set name is required." }
  if (!state.adName.trim()) return { step: "ad" as Step, message: "Ad name is required." }
  if (!state.locations.length) return { step: "adset" as Step, message: "Select at least one country." }
  if (state.ageMin < 18 || state.ageMax < state.ageMin || state.ageMax > 65) {
    return { step: "adset" as Step, message: "Age range must be between 18 and 65+." }
  }
  if (state.objective === "OUTCOME_SALES" && !state.pixelId) {
    return { step: "adset" as Step, message: "Select a Pixel for Sales conversion campaigns." }
  }
  if (!positiveMoney(state.advantageCampaignBudget ? state.campaignBudget : state.dailyBudget, currency)) {
    return {
      step: state.advantageCampaignBudget ? "campaign" as Step : "adset" as Step,
      message: `Budget must be a valid ${currency.toUpperCase()} amount greater than 0.`,
    }
  }
  if (state.scheduleStart && state.scheduleEnd && new Date(state.scheduleEnd) <= new Date(state.scheduleStart)) {
    return { step: "adset" as Step, message: "End date must be after start date." }
  }
  if (!state.pageId) return { step: "ad" as Step, message: "Select a Facebook Page." }
  if (!state.creativeId && !state.mediaUrl.trim()) {
    return { step: "ad" as Step, message: "Upload a media file or enter a valid media URL." }
  }
  if (!state.creativeId && (!state.mediaUrl.trim() || !isValidHttpUrl(state.mediaUrl))) {
    return { step: "ad" as Step, message: "Enter a valid image or video URL." }
  }
  if (!state.primaryText.trim()) return { step: "ad" as Step, message: "Primary text is required." }
  if (!state.headline.trim()) return { step: "ad" as Step, message: "Headline is required." }
  if (!state.destinationUrl.trim() || !isValidHttpUrl(state.destinationUrl)) {
    return { step: "ad" as Step, message: "Enter a valid website URL." }
  }
  return null
}

export function CreateCampaignModal({ open, onClose, onSuccess }: Props) {
  const [activeStep, setActiveStep] = useState<Step>("campaign")
  const [state, setState] = useState<CampaignFormState>(defaultCampaignState)
  const [isPublishing, setIsPublishing] = useState(false)
  const [formError, setFormError] = useState("")
  const [loadError, setLoadError] = useState("")
  const [createdIds, setCreatedIds] = useState<CreateCampaignResponse | null>(null)

  const [pages, setPages] = useState<FacebookPageOption[]>([])
  const [pagesLoading, setPagesLoading] = useState(false)
  const [instagramAccounts, setInstagramAccounts] = useState<InstagramOption[]>([])
  const [instagramLoading, setInstagramLoading] = useState(false)
  const [pixels, setPixels] = useState<PixelOption[]>([])
  const [pixelsLoading, setPixelsLoading] = useState(false)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)
  const [mediaUploadError, setMediaUploadError] = useState("")
  const loadedAccountIdRef = useRef("")

  const { selectedAccountId, selectedAccount, loading: accountsLoading } = useAdAccount()
  const currency = (selectedAccount?.currency || "USD").toUpperCase()

  const update = (updates: Partial<CampaignFormState>) => {
    setState((previous) => ({ ...previous, ...updates }))
    setFormError("")
    setMediaUploadError("")
    setCreatedIds(null)
  }

  const applyUploadedCreative = (creative: CreativeAssetOption) => {
    const previewUrl =
      creative.media_type === "video"
        ? creative.file_url || creative.fb_thumbnail_url || ""
        : creative.fb_thumbnail_url || creative.fb_image_url || creative.file_url || ""

    setState((previous) => ({
      ...previous,
      creativeId: creative.id,
      creativeFileName: creative.file_name,
      creativePreviewUrl: previewUrl,
      mediaType: creative.media_type,
      mediaUrl: "",
    }))
  }

  const refreshUploadedVideoPreview = async (creativeId: string) => {
    try {
      const res = await fetch(`/api/creatives/${creativeId}/thumbnail`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) return

      const previewUrl = data.source_url || data.thumbnail_url || ""
      if (!previewUrl) return

      setState((previous) => {
        if (previous.creativeId !== creativeId) return previous
        return {
          ...previous,
          creativePreviewUrl: previewUrl,
        }
      })
    } catch {}
  }

  const handleMediaFileSelected = async (file: File | null) => {
    if (!file) return
    if (!selectedAccountId) {
      setMediaUploadError("Select an ad account before uploading media.")
      return
    }

    const isVideo = file.type.startsWith("video/")
    const isImage = file.type.startsWith("image/")
    if (!isImage && !isVideo) {
      setMediaUploadError("Only image and video files are supported.")
      return
    }

    const maxSize = isVideo ? 1024 * 1024 * 1024 : 30 * 1024 * 1024
    if (file.size > maxSize) {
      setMediaUploadError(
        isVideo
          ? "Video file is too large. Max 1GB."
          : "Image file is too large. Max 30MB."
      )
      return
    }

    setIsUploadingMedia(true)
    setMediaUploadError("")
    setFormError("")

    try {
      const params = new URLSearchParams({
        filename: file.name,
        type: file.type,
        size: String(file.size),
        ad_account_id: selectedAccountId,
      })

      const res = await fetch(`/api/creatives/upload-binary?${params}`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      })
      const data = await res.json()
      if (!res.ok || !data.creative) {
        throw new Error(data.error || "Failed to upload media")
      }

      const creative = data.creative as CreativeAssetOption
      applyUploadedCreative(creative)

      if (creative.media_type === "video" && !creative.fb_thumbnail_url && !!(creative as any).fb_video_id) {
        void refreshUploadedVideoPreview(creative.id)
      }
    } catch (error) {
      setMediaUploadError(error instanceof Error ? error.message : "Failed to upload media")
    } finally {
      setIsUploadingMedia(false)
    }
  }

  const clearUploadedCreative = () => {
    setState((previous) => ({
      ...previous,
      creativeId: "",
      creativeFileName: "",
      creativePreviewUrl: "",
    }))
    setMediaUploadError("")
  }

  useEffect(() => {
    if (!open) return
    setFormError("")
    setMediaUploadError("")
    setCreatedIds(null)
  }, [open])

  useEffect(() => {
    if (!open) return

    if (!selectedAccountId) {
      setPages([])
      setPixels([])
      setInstagramAccounts([])
      setPagesLoading(false)
      setPixelsLoading(false)
      setLoadError(accountsLoading ? "" : "Select an ad account first.")
      setState((previous) => ({
        ...previous,
        pageId: "",
        instagramId: "",
        pixelId: "",
        creativeId: "",
        creativeFileName: "",
        creativePreviewUrl: "",
      }))
      loadedAccountIdRef.current = ""
      return
    }

    let cancelled = false
    setLoadError("")
    setPages([])
    setPixels([])
    setInstagramAccounts([])
    setPagesLoading(true)
    setPixelsLoading(true)

    if (loadedAccountIdRef.current && loadedAccountIdRef.current !== selectedAccountId) {
      setState((previous) => ({
        ...previous,
        pageId: "",
        instagramId: "",
        pixelId: "",
        creativeId: "",
        creativeFileName: "",
        creativePreviewUrl: "",
      }))
    }

    const load = async () => {
      try {
        const [pagesRes, pixelsRes] = await Promise.all([
          fetch(`/api/facebook/pages?ad_account_id=${encodeURIComponent(selectedAccountId)}`),
          fetch(`/api/facebook/pixels?ad_account_id=${encodeURIComponent(selectedAccountId)}`),
        ])
        const pagesData = await pagesRes.json()
        const pixelsData = await pixelsRes.json()

        if (!pagesRes.ok) throw new Error(pagesData.error || "Failed to load Pages")
        if (!pixelsRes.ok) throw new Error(pixelsData.error || "Failed to load Pixels")

        if (cancelled) return
        const nextPages = (pagesData.pages || []) as FacebookPageOption[]
        const nextPixels = (pixelsData.pixels || []) as PixelOption[]
        setPages(nextPages)
        setPixels(nextPixels)
        loadedAccountIdRef.current = selectedAccountId
        setState((previous) => ({
          ...previous,
          pageId: nextPages.some((page) => page.id === previous.pageId) ? previous.pageId : "",
          instagramId: nextPages.some((page) => page.id === previous.pageId) ? previous.instagramId : "",
          pixelId: nextPixels.some((pixel) => pixel.id === previous.pixelId) ? previous.pixelId : "",
          creativeId: previous.creativeId,
          creativeFileName: previous.creativeFileName,
          creativePreviewUrl: previous.creativePreviewUrl,
        }))
      } catch (error) {
        if (!cancelled) {
          setPages([])
          setPixels([])
          setLoadError(error instanceof Error ? error.message : "Failed to load account data")
        }
      } finally {
        if (!cancelled) {
          setPagesLoading(false)
          setPixelsLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, selectedAccountId, accountsLoading])

  useEffect(() => {
    if (!open || !state.pageId || !selectedAccountId) {
      setInstagramAccounts([])
      setInstagramLoading(false)
      return
    }

    let cancelled = false
    setInstagramLoading(true)

    const loadInstagram = async () => {
      try {
        const params = new URLSearchParams({
          page_id: state.pageId,
          ad_account_id: selectedAccountId,
        })
        const res = await fetch(`/api/facebook/page-instagram?${params}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load Instagram accounts")
        if (cancelled) return
        const accounts = (data.igAccounts || []) as InstagramOption[]
        setInstagramAccounts(accounts)
        setState((previous) => ({
          ...previous,
          instagramId: accounts.some((account) => account.id === previous.instagramId)
            ? previous.instagramId
            : "",
        }))
      } catch {
        if (!cancelled) setInstagramAccounts([])
      } finally {
        if (!cancelled) setInstagramLoading(false)
      }
    }

    void loadInstagram()
    return () => {
      cancelled = true
    }
  }, [open, selectedAccountId, state.pageId])

  const activeTitle = useMemo(() => {
    if (activeStep === "campaign") return state.campaignName || "New Campaign"
    if (activeStep === "adset") return state.adSetName || "New Ad Set"
    return state.adName || "New Ad"
  }, [activeStep, state.adName, state.adSetName, state.campaignName])

  const handlePublish = async () => {
    if (loadError) {
      setFormError(loadError)
      return
    }
    if (mediaUploadError) {
      setFormError(mediaUploadError)
      return
    }

    const validation = validateState(state, selectedAccountId, currency)
    if (validation) {
      setActiveStep(validation.step)
      setFormError(validation.message)
      return
    }

    setIsPublishing(true)
    setFormError("")
    setCreatedIds(null)

    try {
      const res = await fetch("/api/facebook/create-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adAccountId: selectedAccountId, state }),
      })
      const data = (await res.json()) as CreateCampaignResponse
      if (!res.ok || data.error) throw new Error(data.error || "Failed to publish campaign")

      setCreatedIds(data)
      onSuccess?.()
      setState(defaultCampaignState)
      onClose()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to publish campaign")
    } finally {
      setIsPublishing(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex bg-black/40">
      <div className="m-4 flex flex-1 animate-in flex-col overflow-hidden rounded-lg border border-[#e4e6eb] bg-[#f5f6f7] shadow-2xl duration-200 fade-in zoom-in-95 dark:border-gray-800 dark:bg-background">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#e4e6eb] bg-white px-4 dark:border-gray-800 dark:bg-card">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPublishing}
              className="rounded-full p-1.5 transition-colors hover:bg-black/5 disabled:opacity-50"
            >
              <IconX className="size-5 text-[#65676b]" />
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-semibold text-[#1c2b33] dark:text-gray-100">
                Create a New Campaign
              </h2>
              <p className="truncate text-[11px] text-[#65676b]">{activeTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isPublishing}
              className="h-8 border-[#ccd0d5] text-[13px] font-semibold text-[#4b4f56]"
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={
                isPublishing ||
                isUploadingMedia ||
                pagesLoading ||
                pixelsLoading ||
                !selectedAccountId ||
                Boolean(loadError)
              }
              className="h-8 bg-[#31a24c] px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-[#2b9244]"
            >
              {isPublishing ? (
                <>
                  <IconLoader2 className="mr-1.5 size-4 animate-spin" /> Publishing...
                </>
              ) : (
                "Publish"
              )}
            </Button>
          </div>
        </div>

        {(formError || mediaUploadError || loadError || createdIds?.success) && (
          <div className="shrink-0 border-b border-[#e4e6eb] bg-white px-4 py-2 dark:border-gray-800 dark:bg-card">
            {formError || mediaUploadError || loadError ? (
              <div className="flex items-start gap-2 text-[13px] text-red-600">
                <IconAlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{formError || mediaUploadError || loadError}</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-[13px] text-green-700">
                <IconCheck className="mt-0.5 size-4 shrink-0" />
                <span>Campaign created successfully.</span>
              </div>
            )}
          </div>
        )}

        <div className="relative flex flex-1 overflow-hidden">
          <div className="w-[280px] shrink-0 overflow-y-auto border-r border-[#e4e6eb] bg-white dark:border-gray-800 dark:bg-card">
            <div className="mt-2 space-y-0.5 p-2">
              <StepButton
                active={activeStep === "campaign"}
                icon={IconFolder}
                label={state.campaignName || "New Campaign"}
                onClick={() => setActiveStep("campaign")}
              />
              <div className="relative pl-[21px]">
                <div className="absolute bottom-0 left-[21px] top-0 w-px bg-[#e4e6eb] dark:bg-gray-800" />
                <StepButton
                  active={activeStep === "adset"}
                  nested
                  icon={IconTable}
                  label={state.adSetName || "New Ad Set"}
                  onClick={() => setActiveStep("adset")}
                />
                <div className="relative pl-[21px]">
                  <div className="absolute bottom-1/2 left-[21px] top-0 w-px bg-[#e4e6eb] dark:bg-gray-800" />
                  <StepButton
                    active={activeStep === "ad"}
                    nested
                    icon={IconLayoutGrid}
                    label={state.adName || "New Ad"}
                    onClick={() => setActiveStep("ad")}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-white dark:bg-card">
            {activeStep === "campaign" && (
              <CampaignLevel state={state} update={update} currency={currency} />
            )}
            {activeStep === "adset" && (
              <AdSetLevel
                state={state}
                update={update}
                pixels={pixels}
                pixelsLoading={pixelsLoading}
                currency={currency}
              />
            )}
            {activeStep === "ad" && (
              <AdLevel
                state={state}
                update={update}
                pages={pages}
                pagesLoading={pagesLoading}
                instagramAccounts={instagramAccounts}
                instagramLoading={instagramLoading}
                mediaUploading={isUploadingMedia}
                mediaUploadError={mediaUploadError}
                onSelectMediaFile={handleMediaFileSelected}
                onClearUploadedCreative={clearUploadedCreative}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StepButton({
  active,
  icon: Icon,
  label,
  nested = false,
  onClick,
}: {
  active: boolean
  icon: React.ElementType
  label: string
  nested?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors",
        active ? "bg-[#e3f0fe] dark:bg-blue-950/30" : "hover:bg-[#f5f6f7] dark:hover:bg-white/5"
      )}
    >
      {nested && <div className="absolute left-0 top-1/2 h-px w-3 bg-[#e4e6eb] dark:bg-gray-800" />}
      <div
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded",
          active ? "bg-[#1877f2]" : "bg-[#c9ccd1] dark:bg-gray-700"
        )}
      >
        <Icon className="size-3.5 text-white" />
      </div>
      <p
        className={cn(
          "min-w-0 flex-1 truncate text-[13px] font-medium",
          active ? "text-[#1877f2]" : "text-[#1c2b33] dark:text-gray-200"
        )}
      >
        {label}
      </p>
    </button>
  )
}
