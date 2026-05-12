"use client"

import {
  IconBrandFacebook,
  IconBrandInstagram,
  IconPhoto,
  IconUpload,
  IconVideo,
  IconX,
} from "@tabler/icons-react"
import {
  CampaignFormState,
  FacebookPageOption,
  InstagramOption,
  MediaType,
} from "./types"

interface Props {
  state: CampaignFormState
  update: (updates: Partial<CampaignFormState>) => void
  pages: FacebookPageOption[]
  pagesLoading: boolean
  instagramAccounts: InstagramOption[]
  instagramLoading: boolean
  mediaUploading: boolean
  mediaUploadError: string
  onSelectMediaFile: (file: File | null) => void
  onClearUploadedCreative: () => void
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
}: Props) {
  const selectedPage = pages.find((page) => page.id === state.pageId)
  const previewUrl = state.creativePreviewUrl || state.mediaUrl

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 px-6 py-8 pb-20">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#1c2b33] dark:text-gray-100">Ad</h1>
          </div>

          <div className="space-y-4 rounded-lg border border-[#e4e6eb] p-5 shadow-sm dark:border-gray-800">
            <div>
              <label className="text-[13px] font-semibold text-[#1c2b33] dark:text-gray-200">
                Ad name
              </label>
              <input
                type="text"
                className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-[13px] outline-none focus:border-[#1877f2] focus:ring-1 focus:ring-[#1877f2] dark:border-gray-700 dark:bg-background"
                value={state.adName}
                onChange={(event) => update({ adName: event.target.value })}
                placeholder="Enter an ad name"
              />
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-[#e4e6eb] p-5 shadow-sm dark:border-gray-800">
            <h3 className="text-[15px] font-semibold text-[#1c2b33] dark:text-gray-100">Identity</h3>

            <div>
              <label className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1c2b33] dark:text-gray-200">
                <IconBrandFacebook className="size-4 text-[#1877f2]" /> Facebook Page
              </label>
              <select
                value={state.pageId}
                onChange={(event) => update({ pageId: event.target.value, instagramId: "" })}
                className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-[13px] outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
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
              <label className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1c2b33] dark:text-gray-200">
                <IconBrandInstagram className="size-4 text-[#E1306C]" /> Instagram account
              </label>
              <select
                value={state.instagramId}
                onChange={(event) => update({ instagramId: event.target.value })}
                className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-[13px] outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
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
            <h3 className="text-[15px] font-semibold text-[#1c2b33] dark:text-gray-100">Ad setup</h3>
            <div className="rounded-lg border border-[#1877f2] bg-[#e3f0fe]/30 p-3 dark:bg-blue-900/20">
              <span className="block text-[13px] font-semibold text-[#1877f2]">
                Single image or video
              </span>
              <span className="mt-0.5 block text-[12px] text-[#65676b]">
                Use one image or one video for this ad.
              </span>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-[#e4e6eb] p-5 shadow-sm dark:border-gray-800">
            <h3 className="text-[15px] font-semibold text-[#1c2b33] dark:text-gray-100">Ad creative</h3>

            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <div>
                <label className="text-[13px] font-semibold text-[#1c2b33] dark:text-gray-200">
                  Media type
                </label>
                <select
                  value={state.mediaType}
                  onChange={(event) => update({ mediaType: event.target.value as MediaType })}
                  className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-[13px] outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
                  disabled={Boolean(state.creativeId) || mediaUploading}
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-[#1c2b33] dark:text-gray-200">
                  Upload media
                </label>
                <label className="mt-1.5 flex h-9 cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-[#ccd0d5] bg-white px-3 text-[13px] font-medium text-[#1c2b33] transition-colors hover:border-[#1877f2] hover:text-[#1877f2] dark:border-gray-700 dark:bg-background dark:text-gray-200">
                  <IconUpload className="size-4" />
                  <span>{mediaUploading ? "Uploading to Meta..." : "Choose image or video"}</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    disabled={mediaUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null
                      onSelectMediaFile(file)
                      event.target.value = ""
                    }}
                  />
                </label>
              </div>
            </div>

            {state.creativeId ? (
              <div className="rounded-lg border border-[#d7e3f4] bg-[#f7fbff] p-3 dark:border-gray-700 dark:bg-muted/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[#1c2b33] dark:text-gray-100">
                      {state.creativeFileName || "Uploaded media"}
                    </p>
                    <p className="mt-1 text-[12px] text-[#65676b]">
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
                <label className="text-[13px] font-semibold text-[#1c2b33] dark:text-gray-200">
                  Remote media URL
                </label>
                <input
                  type="url"
                  className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-[13px] outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
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
                <p className="mt-1.5 text-[12px] text-[#65676b]">
                  Use this only when your asset is already hosted at a public URL.
                </p>
              </div>
            )}

            {mediaUploadError && (
              <p className="text-[12px] text-red-600">{mediaUploadError}</p>
            )}

            <div>
              <label className="text-[13px] font-semibold text-[#1c2b33] dark:text-gray-200">
                Primary text
              </label>
              <textarea
                rows={3}
                className="mt-1.5 w-full resize-none rounded border border-[#ccd0d5] bg-white p-3 text-[13px] outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
                value={state.primaryText}
                onChange={(event) => update({ primaryText: event.target.value })}
                placeholder="Primary text"
              />
            </div>

            <div>
              <label className="text-[13px] font-semibold text-[#1c2b33] dark:text-gray-200">
                Headline
              </label>
              <input
                type="text"
                className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-[13px] outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
                value={state.headline}
                onChange={(event) => update({ headline: event.target.value })}
                placeholder="Headline"
              />
            </div>

            <div>
              <label className="text-[13px] font-semibold text-[#1c2b33] dark:text-gray-200">
                Description
              </label>
              <input
                type="text"
                className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-[13px] outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
                value={state.description}
                onChange={(event) => update({ description: event.target.value })}
                placeholder="Optional description"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <div>
                <label className="text-[13px] font-semibold text-[#1c2b33] dark:text-gray-200">
                  Call to action
                </label>
                <select
                  value={state.callToAction}
                  onChange={(event) => update({ callToAction: event.target.value })}
                  className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-[13px] outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
                >
                  {CTA_OPTIONS.map((cta) => (
                    <option key={cta} value={cta}>
                      {formatCta(cta)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-[#1c2b33] dark:text-gray-200">
                  Website URL
                </label>
                <input
                  type="url"
                  className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-[13px] outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
                  value={state.destinationUrl}
                  onChange={(event) => update({ destinationUrl: event.target.value })}
                  placeholder="https://example.com"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-[#e4e6eb] p-5 shadow-sm dark:border-gray-800">
            <h3 className="text-[15px] font-semibold text-[#1c2b33] dark:text-gray-100">Tracking</h3>
            <div>
              <label className="text-[13px] font-semibold text-[#1c2b33] dark:text-gray-200">
                URL parameters
              </label>
              <input
                type="text"
                className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-[13px] outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
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
          <h3 className="text-[14px] font-bold text-[#1c2b33] dark:text-gray-100">Ad Preview</h3>
          <span className="text-[12px] font-semibold text-[#1877f2]">Feed</span>
        </div>
        <div className="flex flex-1 justify-center overflow-y-auto p-4">
          <div className="mt-4 h-fit w-[300px] overflow-hidden rounded-lg border border-[#ccd0d5] bg-white text-black shadow-sm">
            <div className="flex items-center gap-2 p-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
                {(selectedPage?.name || "Page").slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="text-[13px] font-bold leading-tight">{selectedPage?.name || "Facebook Page"}</p>
                <p className="text-[11px] text-gray-500">Sponsored</p>
              </div>
            </div>
            {state.primaryText && (
              <div className="whitespace-pre-wrap px-3 pb-2 text-[13px]">{state.primaryText}</div>
            )}
            <div className="flex aspect-square w-full items-center justify-center border-y border-gray-200 bg-gray-100">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={state.creativeFileName || state.headline || "Ad media preview"}
                  className="h-full w-full object-cover"
                />
              ) : state.mediaType === "video" ? (
                <IconVideo className="size-10 text-gray-400" />
              ) : (
                <IconPhoto className="size-10 text-gray-400" />
              )}
            </div>
            <div className="flex items-center justify-between gap-2 bg-[#f0f2f5] p-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">
                  {hostLabel(state.destinationUrl)}
                </p>
                <p className="max-w-[170px] truncate text-[14px] font-bold">
                  {state.headline || "Headline"}
                </p>
                {state.description && (
                  <p className="max-w-[170px] truncate text-[13px] text-gray-500">{state.description}</p>
                )}
              </div>
              <button className="shrink-0 rounded bg-gray-200 px-3 py-1.5 text-[12px] font-semibold">
                {formatCta(state.callToAction)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
