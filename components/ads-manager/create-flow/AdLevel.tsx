"use client"

import {
  IconBrandFacebook,
  IconBrandInstagram,
  IconPhoto,
  IconPlus,
  IconTrash,
  IconVideo,
  IconX,
} from "@tabler/icons-react"
import {
  CampaignFormState,
  FacebookPageOption,
  InstagramOption,
  MediaType,
  CreativeAssetOption,
} from "./types"
import { LoadMediaModal } from "@/components/shared/load-media-modal"
import type { Creative } from "@/types/creative"
import { useState } from "react"

interface Props {
  state: CampaignFormState
  update: (updates: Partial<CampaignFormState>) => void
  pages: FacebookPageOption[]
  pagesLoading: boolean
  instagramAccounts: InstagramOption[]
  instagramLoading: boolean
  mediaUploading: boolean
  mediaUploadError: string
  onSelectMediaFile: (file: File | null) => Promise<CreativeAssetOption | null>
  onClearUploadedCreative: () => void
  adAccountId?: string
}

const CTA_OPTIONS = [
  "LEARN_MORE",
  "SHOP_NOW",
  "SIGN_UP",
  "CONTACT_US",
  "ORDER_NOW",
  "BUY_NOW",
  "GET_OFFER",
  "SUBSCRIBE",
]

function hostLabel(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return "example.com"
  }
}

function formatCta(cta: string) {
  return cta.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
}

function TextFieldWithVariations({
  label,
  value,
  variations,
  multiline = false,
  placeholder,
  onChange,
  onVariationsChange,
}: {
  label: string
  value: string
  variations: string[]
  multiline?: boolean
  placeholder: string
  onChange: (value: string) => void
  onVariationsChange: (value: string[]) => void
}) {
  const add = () => onVariationsChange([...variations, ""])
  const updateAt = (index: number, next: string) => onVariationsChange(variations.map((v, i) => i === index ? next : v))
  const removeAt = (index: number) => onVariationsChange(variations.filter((_, i) => i !== index))
  const inputClass = "mt-1.5 w-full rounded border border-[#ccd0d5] bg-white px-3 text-xs outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-[#1c2b33] dark:text-gray-200">{label}</label>
        <button type="button" onClick={add} className="flex items-center gap-1 text-xs font-semibold text-[#1877f2] hover:underline">
          <IconPlus className="size-3" /> Add variation
        </button>
      </div>
      {multiline ? (
        <textarea
          rows={3}
          className={`${inputClass} resize-none py-2`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          type="text"
          className={`${inputClass} h-9`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
      {variations.length > 0 && (
        <div className="mt-2 space-y-2">
          {variations.map((variation, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                className={`${inputClass} h-8`}
                value={variation}
                onChange={(event) => updateAt(index, event.target.value)}
                placeholder={`${label} variation ${index + 2}`}
              />
              <button type="button" onClick={() => removeAt(index)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Remove ${label} variation`}>
                <IconTrash className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AdLevel({
  state,
  update,
  pages,
  pagesLoading,
  instagramAccounts,
  instagramLoading,
  mediaUploading,
  mediaUploadError,
  onSelectMediaFile,
  onClearUploadedCreative,
  adAccountId,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const selectedPage = pages.find((page) => page.id === state.pageId)

  // Use first creative for the legacy preview
  const firstCreative = state.selectedCreatives[0]
  const previewUrl = firstCreative?.preview_url || state.creativePreviewUrl || state.mediaUrl
  const previewType = firstCreative?.media_type || state.mediaType

  const handleConfirmMedia = (ids: string[], creatives: Creative[]) => {
    const selected = creatives.map(c => ({
      id: c.id,
      file_name: c.file_name,
      preview_url: c.media_type === "video"
        ? c.file_url || c.fb_thumbnail_url || ""
        : c.fb_thumbnail_url || c.fb_image_url || c.file_url || "",
      media_type: c.media_type,
    }))

    update({
      creativeIds: ids,
      selectedCreatives: selected,
      // Back-compat for single-ad preview if needed
      creativeId: ids[0] || "",
      creativeFileName: selected[0]?.file_name || "",
      creativePreviewUrl: selected[0]?.preview_url || "",
      mediaType: selected[0]?.media_type || "image",
      mediaUrl: "",
    })
  }

  const removeCreative = (idToRemove: string) => {
    const nextIds = state.creativeIds.filter(id => id !== idToRemove)
    const nextSelected = state.selectedCreatives.filter(c => c.id !== idToRemove)
    update({
      creativeIds: nextIds,
      selectedCreatives: nextSelected,
      creativeId: nextIds[0] || "",
      creativeFileName: nextSelected[0]?.file_name || "",
      creativePreviewUrl: nextSelected[0]?.preview_url || "",
      mediaType: nextSelected[0]?.media_type || "image",
    })
  }

  return (
    <div className="flex h-full">
      {pickerOpen && (
        <LoadMediaModal
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          adAccountId={adAccountId || ""}
          alreadySelected={new Set(state.creativeIds)}
          onConfirm={handleConfirmMedia}
          tabs={["library", "vault", "gdrive", "drive_link"]}
        />
      )}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-8 pb-20">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#1c2b33] dark:text-gray-100">Ad</h1>
          </div>

          <div className="space-y-4 rounded-lg border border-[#e4e6eb] p-5 shadow-sm dark:border-gray-800">
            <div>
              <label className="text-xs font-semibold text-[#1c2b33] dark:text-gray-200">
                Ad name
              </label>
              <input
                type="text"
                className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-xs outline-none focus:border-[#1877f2] focus:ring-1 focus:ring-[#1877f2] dark:border-gray-700 dark:bg-background"
                value={state.adName}
                onChange={(event) => update({ adName: event.target.value })}
                placeholder="Enter an ad name"
              />
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-[#e4e6eb] p-5 shadow-sm dark:border-gray-800">
            <h3 className="text-sm font-semibold text-[#1c2b33] dark:text-gray-100">Identity</h3>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#1c2b33] dark:text-gray-200">
                <IconBrandFacebook className="size-4 text-[#1877f2]" /> Facebook Page
              </label>
              <select
                value={state.pageId}
                onChange={(event) => update({ pageId: event.target.value, instagramId: "" })}
                className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-xs outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
                disabled={pagesLoading}
              >
                <option value="">{pagesLoading ? "Loading Pages..." : "Select a Page"}</option>
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#1c2b33] dark:text-gray-200">
                <IconBrandInstagram className="size-4 text-[#E1306C]" /> Instagram account
              </label>
              <select
                value={state.instagramId}
                onChange={(event) => update({ instagramId: event.target.value })}
                className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-xs outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
                disabled={!state.pageId || instagramLoading}
              >
                <option value="">
                  {instagramLoading ? "Loading Instagram accounts..." : "Use selected Page"}
                </option>
                {instagramAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    @{account.username || account.id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-[#e4e6eb] p-5 shadow-sm dark:border-gray-800">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-[#1c2b33] dark:text-gray-100">Ad setup</h3>
              <span className="text-[11px] text-[#65676b]">
                {state.creativeIds.length > 0
                  ? `${state.creativeIds.length} media selected → ${state.creativeIds.length} ads`
                  : "Single image or video"}
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#1c2b33] dark:text-gray-200">
                Media
              </label>
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  disabled={mediaUploading}
                  className="flex h-9 items-center gap-2 rounded border border-[#1877f2] bg-white px-3 text-xs font-semibold text-[#1877f2] transition-colors hover:bg-[#1877f2]/10 disabled:opacity-50 dark:bg-background"
                >
                  <IconPhoto className="size-4" />
                  {mediaUploading ? "Uploading..." : "Load media"}
                </button>
              </div>
            </div>

            {state.creativeIds.length > 0 ? (
              <div className="rounded-lg border border-[#d7e3f4] bg-[#f7fbff] p-3 dark:border-gray-700 dark:bg-muted/30">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-[#1c2b33] dark:text-gray-100">
                    {state.creativeIds.length} media · each becomes its own ad
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClearUploadedCreative()
                      update({ creativeIds: [], selectedCreatives: [] })
                    }}
                    className="text-[11px] font-medium text-[#65676b] hover:text-red-600"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {state.selectedCreatives.map((c) => (
                    <div
                      key={c.id}
                      className="group relative size-16 overflow-hidden rounded-md border border-[#e4e6eb] bg-muted/30 dark:border-gray-800"
                      title={c.file_name}
                    >
                      {c.preview_url ? (
                        c.media_type === "video" ? (
                          <video
                            src={c.preview_url}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.preview_url} alt={c.file_name} className="h-full w-full object-cover" />
                        )
                      ) : c.media_type === "video" ? (
                        <div className="flex h-full items-center justify-center">
                          <IconVideo className="size-5 text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <IconPhoto className="size-5 text-muted-foreground" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeCreative(c.id)}
                        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label={`Remove ${c.file_name}`}
                      >
                        <IconX className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-[#65676b]">
                  Each selected media creates a separate ad in the new ad set, sharing the same Page, text, and link below.
                </p>
              </div>
            ) : state.creativeId ? (
              <div className="rounded-lg border border-[#d7e3f4] bg-[#f7fbff] p-3 dark:border-gray-700 dark:bg-muted/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#1c2b33] dark:text-gray-100">
                      {state.creativeFileName || "Uploaded media"}
                    </p>
                    <p className="mt-1 text-xs text-[#65676b]">
                      Uploaded assets are saved to your workspace and reused when publishing.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClearUploadedCreative}
                    className="rounded-full p-1.5 text-[#65676b] transition-colors hover:bg-black/5"
                    aria-label="Clear uploaded media"
                  >
                    <IconX className="size-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-[#1c2b33] dark:text-gray-200">
                  Remote media URL
                </label>
                <input
                  type="url"
                  className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-xs outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
                  value={state.mediaUrl}
                  onChange={(event) =>
                    update({
                      creativeId: "",
                      creativeFileName: "",
                      creativePreviewUrl: "",
                      mediaUrl: event.target.value,
                    })
                  }
                  placeholder="https://example.com/creative.jpg"
                />
                <p className="mt-1.5 text-xs text-[#65676b]">
                  Use this only when your asset is already hosted at a public URL.
                </p>
              </div>
            )}

            {mediaUploadError && (
              <p className="text-xs text-red-600">{mediaUploadError}</p>
            )}

            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <div>
                <label className="text-xs font-semibold text-[#1c2b33] dark:text-gray-200">
                  Call to action
                </label>
                <select
                  value={state.callToAction}
                  onChange={(event) => update({ callToAction: event.target.value })}
                  className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-xs outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
                >
                  {CTA_OPTIONS.map((cta) => (
                    <option key={cta} value={cta}>
                      {formatCta(cta)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#1c2b33] dark:text-gray-200">
                  Website URL
                </label>
                <input
                  type="url"
                  className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-xs outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
                  value={state.destinationUrl}
                  onChange={(event) => update({ destinationUrl: event.target.value })}
                  placeholder="https://example.com"
                />
              </div>
            </div>

            <div className="border-t border-[#e4e6eb] pt-4 dark:border-gray-800">
              <TextFieldWithVariations
                label="Primary text"
                multiline
                placeholder="Primary text"
                value={state.primaryText}
                variations={state.primaryTextVariations}
                onChange={(v) => update({ primaryText: v })}
                onVariationsChange={(v) => update({ primaryTextVariations: v })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextFieldWithVariations
                label="Headline"
                placeholder="Headline"
                value={state.headline}
                variations={state.headlineVariations}
                onChange={(v) => update({ headline: v })}
                onVariationsChange={(v) => update({ headlineVariations: v })}
              />
              <TextFieldWithVariations
                label="Description"
                placeholder="Optional description"
                value={state.description}
                variations={state.descriptionVariations}
                onChange={(v) => update({ description: v })}
                onVariationsChange={(v) => update({ descriptionVariations: v })}
              />
            </div>

            <div className="border-t border-[#e4e6eb] pt-4 dark:border-gray-800">
              <label className="text-xs font-semibold text-[#1c2b33] dark:text-gray-200">
                URL parameters (tracking)
              </label>
              <input
                type="text"
                className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-xs outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
                value={state.urlParameters}
                onChange={(event) => update({ urlParameters: event.target.value })}
                placeholder="utm_source=facebook&utm_medium=paid"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="hidden w-[360px] shrink-0 flex-col border-l border-[#e4e6eb] bg-[#f5f6f7] dark:border-gray-800 dark:bg-background lg:flex">
        <div className="flex items-center justify-between border-b border-[#e4e6eb] bg-white p-4 dark:border-gray-800 dark:bg-card">
          <h3 className="text-sm font-bold text-[#1c2b33] dark:text-gray-100">Ad Preview</h3>
          <span className="text-xs font-semibold text-[#1877f2]">Feed</span>
        </div>
        <div className="flex flex-1 justify-center overflow-y-auto p-4">
          <div className="mt-4 h-fit w-[300px] overflow-hidden rounded-lg border border-[#ccd0d5] bg-white text-black shadow-sm">
            <div className="flex items-center gap-2 p-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
                {(selectedPage?.name || "Page").slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-bold leading-tight">{selectedPage?.name || "Facebook Page"}</p>
                <p className="text-xs text-gray-500">Sponsored</p>
              </div>
            </div>
            {state.primaryText && (
              <div className="whitespace-pre-wrap px-3 pb-2 text-xs">{state.primaryText}</div>
            )}
            <div className="flex aspect-square w-full items-center justify-center border-y border-gray-200 bg-gray-100">
              {previewUrl ? (
                previewType === "video" ? (
                  <video
                    src={previewUrl}
                    className="h-full w-full object-cover"
                    controls
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt={state.creativeFileName || state.headline || "Ad media preview"}
                    className="h-full w-full object-cover"
                  />
                )
              ) : previewType === "video" ? (
                <IconVideo className="size-10 text-gray-400" />
              ) : (
                <IconPhoto className="size-10 text-gray-400" />
              )}
            </div>
            <div className="flex items-center justify-between gap-2 bg-[#f0f2f5] p-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  {hostLabel(state.destinationUrl)}
                </p>
                <p className="max-w-[170px] truncate text-sm font-bold">
                  {state.headline || "Headline"}
                </p>
                {state.description && (
                  <p className="max-w-[170px] truncate text-xs text-gray-500">{state.description}</p>
                )}
              </div>
              <button className="shrink-0 rounded bg-gray-200 px-3 py-1.5 text-xs font-semibold">
                {formatCta(state.callToAction)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
