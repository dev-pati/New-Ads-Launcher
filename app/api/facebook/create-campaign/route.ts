import { NextRequest, NextResponse } from "next/server"
import {
  createAdSet,
  createCampaign,
  getAdAccountPages,
  getPageInstagramAccounts,
  getPixels,
  getVideoThumbnail,
  pollVideoReady,
  uploadImageToMeta,
  uploadVideoToMeta,
} from "@/lib/facebook"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getOrgAdAccountInfo, normalizeAdAccountId } from "../_utils"

export const runtime = "nodejs"
export const maxDuration = 300
export const dynamic = "force-dynamic"

const GRAPH_API = "https://graph.facebook.com/v25.0"

type CampaignObjective = "OUTCOME_SALES" | "OUTCOME_TRAFFIC" | "OUTCOME_AWARENESS"
type SpecialAdCategory = "CREDIT" | "EMPLOYMENT" | "HOUSING" | "ISSUES_ELECTIONS_POLITICS"
type PerformanceGoal = "OFFSITE_CONVERSIONS" | "LINK_CLICKS" | "LANDING_PAGE_VIEWS" | "REACH"
type Gender = "ALL" | "MALE" | "FEMALE"
type MediaType = "image" | "video"

const CTA_OPTIONS = new Set([
  "LEARN_MORE",
  "SHOP_NOW",
  "SIGN_UP",
  "CONTACT_US",
  "ORDER_NOW",
  "BUY_NOW",
  "GET_OFFER",
  "SUBSCRIBE",
])

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

interface CreateCampaignState {
  campaignName: string
  objective: CampaignObjective
  specialAdCategories: SpecialAdCategory[]
  advantageCampaignBudget: boolean
  campaignBudget: string
  adSetName: string
  conversionLocation: "website"
  performanceGoal: PerformanceGoal
  pixelId: string
  dailyBudget: string
  scheduleStart: string
  scheduleEnd: string
  locations: string[]
  ageMin: number
  ageMax: number
  gender: Gender
  adName: string
  pageId: string
  instagramId: string
  creativeId: string
  mediaUrl: string
  mediaType: MediaType
  primaryText: string
  headline: string
  description: string
  callToAction: string
  destinationUrl: string
  urlParameters: string
}

class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function fail(status: number, message: string): never {
  throw new HttpError(status, message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function withActPrefix(id: string) {
  return id.startsWith("act_") ? id : `act_${id}`
}

function isZeroDecimalCurrency(currency: string) {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())
}

function parseMoney(value: string, label: string, currency = "USD"): number {
  const trimmed = value.trim()
  const valid = isZeroDecimalCurrency(currency)
    ? /^\d+(\.0{1,2})?$/.test(trimmed)
    : /^\d+(\.\d{1,2})?$/.test(trimmed)
  if (!valid) fail(400, `${label} must be a valid ${currency.toUpperCase()} amount`)

  const amount = Number.parseFloat(value)
  if (!Number.isFinite(amount) || amount <= 0) fail(400, `${label} must be greater than 0`)
  return amount
}

function budgetMinorUnits(value: string, label: string, currency: string) {
  const amount = parseMoney(value, label, currency)
  return String(Math.round(amount * (isZeroDecimalCurrency(currency) ? 1 : 100)))
}

function campaignBudgetForHelper(value: string, label: string, currency: string) {
  const amount = parseMoney(value, label, currency)
  // createCampaign() keeps legacy behavior and multiplies this value by 100.
  return isZeroDecimalCurrency(currency) ? amount / 100 : amount
}

function parseHttpUrl(value: string, label: string): string {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      fail(400, `${label} must start with http:// or https://`)
    }
    return url.toString()
  } catch {
    fail(400, `${label} must be a valid URL`)
  }
}

function parseOptionalDate(value: string, label: string): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) fail(400, `${label} is invalid`)
  return date.toISOString()
}

function parseState(rawState: unknown): CreateCampaignState {
  if (!isRecord(rawState)) fail(400, "Missing campaign state")

  const objective = asString(rawState.objective) as CampaignObjective
  if (!["OUTCOME_SALES", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS"].includes(objective)) {
    fail(400, "This create flow supports Sales, Traffic, and Awareness campaigns only")
  }

  const performanceGoal = asString(rawState.performanceGoal) as PerformanceGoal
  if (!["OFFSITE_CONVERSIONS", "LINK_CLICKS", "LANDING_PAGE_VIEWS", "REACH"].includes(performanceGoal)) {
    fail(400, "Unsupported performance goal")
  }

  const mediaType = asString(rawState.mediaType) as MediaType
  if (!["image", "video"].includes(mediaType)) fail(400, "Media type must be image or video")

  const conversionLocation = asString(rawState.conversionLocation)
  if (conversionLocation && conversionLocation !== "website") {
    fail(400, "This create flow supports website campaigns only")
  }

  const gender = asString(rawState.gender) as Gender
  if (!["ALL", "MALE", "FEMALE"].includes(gender)) fail(400, "Unsupported gender targeting")

  const specialAdCategories = Array.isArray(rawState.specialAdCategories)
    ? rawState.specialAdCategories.filter((v): v is SpecialAdCategory =>
        typeof v === "string" &&
        ["CREDIT", "EMPLOYMENT", "HOUSING", "ISSUES_ELECTIONS_POLITICS"].includes(v)
      )
    : []

  const locations = Array.isArray(rawState.locations)
    ? rawState.locations.filter((v): v is string => typeof v === "string" && /^[A-Z]{2}$/.test(v))
    : []

  const state: CreateCampaignState = {
    campaignName: asString(rawState.campaignName),
    objective,
    specialAdCategories,
    advantageCampaignBudget: rawState.advantageCampaignBudget !== false,
    campaignBudget: asString(rawState.campaignBudget),
    adSetName: asString(rawState.adSetName),
    conversionLocation: "website",
    performanceGoal,
    pixelId: asString(rawState.pixelId),
    dailyBudget: asString(rawState.dailyBudget),
    scheduleStart: asString(rawState.scheduleStart),
    scheduleEnd: asString(rawState.scheduleEnd),
    locations,
    ageMin: typeof rawState.ageMin === "number" ? rawState.ageMin : 18,
    ageMax: typeof rawState.ageMax === "number" ? rawState.ageMax : 65,
    gender,
    adName: asString(rawState.adName),
    pageId: asString(rawState.pageId),
    instagramId: asString(rawState.instagramId),
    creativeId: asString(rawState.creativeId),
    mediaUrl: asString(rawState.mediaUrl),
    mediaType,
    primaryText: asString(rawState.primaryText),
    headline: asString(rawState.headline),
    description: asString(rawState.description),
    callToAction: asString(rawState.callToAction) || "LEARN_MORE",
    destinationUrl: asString(rawState.destinationUrl),
    urlParameters: asString(rawState.urlParameters),
  }

  if (!CTA_OPTIONS.has(state.callToAction)) fail(400, "Unsupported call to action")
  if (!state.campaignName) fail(400, "Campaign name is required")
  if (!state.adSetName) fail(400, "Ad set name is required")
  if (!state.adName) fail(400, "Ad name is required")
  if (!state.pageId) fail(400, "Facebook Page is required")
  if (!state.creativeId && !state.mediaUrl) fail(400, "Media file or media URL is required")
  if (!state.destinationUrl) fail(400, "Website URL is required")
  if (!state.headline) fail(400, "Headline is required")
  if (!state.primaryText) fail(400, "Primary text is required")
  if (state.locations.length === 0) fail(400, "At least one country is required")
  if (state.ageMin < 18 || state.ageMax < state.ageMin || state.ageMax > 65) {
    fail(400, "Age range must be between 18 and 65+")
  }

  if (!state.creativeId) parseHttpUrl(state.mediaUrl, "Media URL")
  parseHttpUrl(state.destinationUrl, "Website URL")
  parseMoney(state.advantageCampaignBudget ? state.campaignBudget : state.dailyBudget, "Budget")

  return state
}

function resolveDelivery(state: CreateCampaignState): {
  optimizationGoal: PerformanceGoal
  billingEvent: "IMPRESSIONS"
  promotedObject?: Record<string, string>
} {
  if (state.objective === "OUTCOME_SALES") {
    if (state.performanceGoal !== "OFFSITE_CONVERSIONS") {
      fail(400, "Sales campaigns in this flow support website conversions only")
    }
    if (!state.pixelId) fail(400, "Pixel is required for Sales website conversion campaigns")
    return {
      optimizationGoal: "OFFSITE_CONVERSIONS",
      billingEvent: "IMPRESSIONS",
      promotedObject: { pixel_id: state.pixelId, custom_event_type: "PURCHASE" },
    }
  }

  if (state.objective === "OUTCOME_TRAFFIC") {
    if (state.performanceGoal !== "LINK_CLICKS" && state.performanceGoal !== "LANDING_PAGE_VIEWS") {
      fail(400, "Traffic campaigns support Link Clicks or Landing Page Views")
    }
    return { optimizationGoal: state.performanceGoal, billingEvent: "IMPRESSIONS" }
  }

  if (state.objective === "OUTCOME_AWARENESS") {
    if (state.performanceGoal !== "REACH") fail(400, "Awareness campaigns support Reach in this flow")
    return { optimizationGoal: "REACH", billingEvent: "IMPRESSIONS" }
  }

  fail(400, "Unsupported objective")
} 

function buildTargeting(state: CreateCampaignState) {
  const targeting: {
    geo_locations: { countries: string[] }
    age_min: number
    age_max: number
    genders?: number[]
  } = {
    geo_locations: { countries: state.locations },
    age_min: state.ageMin,
    age_max: state.ageMax,
  }

  if (state.gender === "MALE") targeting.genders = [1]
  if (state.gender === "FEMALE") targeting.genders = [2]

  return targeting
}

function mediaFileName(mediaUrl: string, mediaType: MediaType) {
  try {
    const pathname = new URL(mediaUrl).pathname
    const last = pathname.split("/").filter(Boolean).pop()
    if (last && last.includes(".")) return decodeURIComponent(last)
  } catch {}
  return mediaType === "video" ? "ad-video.mp4" : "ad-image.jpg"
}

async function fetchRemoteMedia(mediaUrl: string, mediaType: MediaType) {
  let res: Response

  try {
    res = await fetch(mediaUrl, { signal: AbortSignal.timeout(60_000) })
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      fail(408, "Media URL timed out after 60 seconds")
    }
    fail(400, "Failed to fetch media URL")
  }

  if (!res.ok) fail(400, `Failed to fetch media URL (${res.status})`)

  const contentType = res.headers.get("content-type") || ""
  if (mediaType === "image" && contentType && !contentType.startsWith("image/")) {
    fail(400, "Media URL does not look like an image")
  }
  if (mediaType === "video" && contentType && !contentType.startsWith("video/")) {
    fail(400, "Media URL does not look like a video")
  }

  const buffer = await res.arrayBuffer()
  if (buffer.byteLength === 0) fail(400, "Media URL returned an empty file")

  const maxSize = mediaType === "video" ? 1024 * 1024 * 1024 : 30 * 1024 * 1024
  if (buffer.byteLength > maxSize) {
    fail(413, `Media file is too large. Max ${mediaType === "video" ? "1GB for video" : "30MB for image"}.`)
  }

  return buffer
}

async function uploadMediaFromUrl(
  adAccountId: string,
  token: string,
  state: CreateCampaignState
): Promise<{ imageHash?: string; videoId?: string; thumbnailUrl?: string }> {
  const buffer = await fetchRemoteMedia(state.mediaUrl, state.mediaType)
  const filename = mediaFileName(state.mediaUrl, state.mediaType)

  if (state.mediaType === "image") {
    const image = await uploadImageToMeta(adAccountId, token, buffer, filename)
    return { imageHash: image.hash, thumbnailUrl: image.url_128 || image.url }
  }

  const video = await uploadVideoToMeta(adAccountId, token, buffer, filename)
  const ready = await pollVideoReady(video.videoId, token, 120_000)
  if (!ready.ready) {
    fail(400, ready.errorMsg || "Video is still processing on Meta. Try again in a minute.")
  }
  const thumbnailUrl = (await getVideoThumbnail(video.videoId, token)) || undefined
  if (!thumbnailUrl) fail(400, "Meta did not return a thumbnail for this video")
  return { videoId: video.videoId, thumbnailUrl }
}

interface StoredCreative {
  id: string
  ad_account_id: string | null
  file_name: string
  file_url: string
  media_type: MediaType
  fb_image_hash: string | null
  fb_image_url: string | null
  fb_thumbnail_url: string | null
  fb_video_id: string | null
}

async function resolveStoredCreativeMedia(
  orgId: string,
  adAccountId: string,
  token: string,
  creativeId: string
): Promise<{ imageHash?: string; videoId?: string; thumbnailUrl?: string }> {
  const supabase = await createClient()
  const { data: creative, error } = await supabase
    .from("creatives")
    .select("id, ad_account_id, file_name, file_url, media_type, fb_image_hash, fb_image_url, fb_thumbnail_url, fb_video_id")
    .eq("id", creativeId)
    .eq("org_id", orgId)
    .single()

  if (error || !creative) fail(400, "Uploaded media was not found in this workspace")

  const storedCreative = creative as StoredCreative
  if (
    storedCreative.ad_account_id &&
    normalizeAdAccountId(storedCreative.ad_account_id) !== normalizeAdAccountId(adAccountId)
  ) {
    fail(400, "Uploaded media belongs to a different ad account")
  }

  if (storedCreative.media_type === "image") {
    if (!storedCreative.fb_image_hash) fail(400, "Uploaded image is missing a Meta image hash")
    return {
      imageHash: storedCreative.fb_image_hash,
      thumbnailUrl: storedCreative.fb_image_url || storedCreative.file_url || undefined,
    }
  }

  if (!storedCreative.fb_video_id) fail(400, "Uploaded video is missing a Meta video id")

  const ready = await pollVideoReady(storedCreative.fb_video_id, token, 120_000)
  if (!ready.ready) {
    fail(400, ready.errorMsg || "Uploaded video is still processing on Meta. Try again in a minute.")
  }

  let thumbnailUrl = storedCreative.fb_thumbnail_url || undefined
  if (!thumbnailUrl) {
    thumbnailUrl = (await getVideoThumbnail(storedCreative.fb_video_id, token)) || undefined
    if (thumbnailUrl) {
      await supabase
        .from("creatives")
        .update({ fb_thumbnail_url: thumbnailUrl })
        .eq("id", storedCreative.id)
        .eq("org_id", orgId)
    }
  }
  if (!thumbnailUrl) fail(400, "Meta did not return a thumbnail for this uploaded video")

  return {
    videoId: storedCreative.fb_video_id,
    thumbnailUrl,
  }
}

async function resolveMediaForAd(
  orgId: string,
  adAccountId: string,
  token: string,
  state: CreateCampaignState
) {
  if (state.creativeId) {
    return resolveStoredCreativeMedia(orgId, adAccountId, token, state.creativeId)
  }

  return uploadMediaFromUrl(adAccountId, token, state)
}

async function assertAdAccountAllowed(orgId: string, adAccountId: string, token: string) {
  const account = await getOrgAdAccountInfo(orgId, adAccountId, token)
  if (!account) fail(403, `Ad account ${adAccountId} is not available in this workspace`)
  return account
}

async function assertIdentityAllowed(
  adAccountId: string,
  token: string,
  state: CreateCampaignState
) {
  const pages = await getAdAccountPages(adAccountId, token)
  const selectedPage = pages.find((page) => page.id === state.pageId)
  if (!selectedPage) fail(400, "Selected Facebook Page is not available for this ad account")

  if (state.instagramId) {
    const igAccounts = await getPageInstagramAccounts(selectedPage.id, selectedPage.access_token)
    const igAllowed = igAccounts.some((account) => account.id === state.instagramId)
    if (!igAllowed) fail(400, "Selected Instagram account is not connected to the selected Page")
  }
}

async function assertPixelAllowed(adAccountId: string, token: string, state: CreateCampaignState) {
  if (state.objective !== "OUTCOME_SALES") return
  const pixels = await getPixels(adAccountId, token)
  if (!pixels.some((pixel) => pixel.id === state.pixelId)) {
    fail(400, "Selected Pixel is not available for this ad account")
  }
}

async function rollbackCampaign(campaignId: string, token: string) {
  try {
    await fetch(`${GRAPH_API}/${campaignId}?access_token=${encodeURIComponent(token)}`, {
      method: "DELETE",
    })
  } catch (err) {
    console.error("[create-campaign] rollback failed:", err)
  }
}

async function patchAdSetEndTime(adSetId: string, token: string, endTime?: string) {
  if (!endTime) return

  const res = await fetch(`${GRAPH_API}/${adSetId}`, {
    method: "POST",
    body: new URLSearchParams({
      access_token: token,
      end_time: endTime,
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    fail(500, data?.error?.message || "Failed to update ad set end date")
  }
}

async function createSingleMediaAd(
  adAccountId: string,
  token: string,
  params: {
    adName: string
    adSetId: string
    pageId: string
    instagramId?: string
    imageHash?: string
    videoId?: string
    thumbnailUrl?: string
    headline: string
    primaryText: string
    description: string
    cta: string
    destinationUrl: string
    urlTags?: string
  }
): Promise<{ id: string }> {
  const storySpec: {
    page_id: string
    instagram_actor_id?: string
    link_data?: Record<string, unknown>
    video_data?: Record<string, unknown>
  } = {
    page_id: params.pageId,
  }

  if (params.instagramId) storySpec.instagram_actor_id = params.instagramId

  if (params.videoId) {
    storySpec.video_data = {
      video_id: params.videoId,
      image_url: params.thumbnailUrl,
      title: params.headline,
      message: params.primaryText,
      call_to_action: {
        type: params.cta,
        value: { link: params.destinationUrl },
      },
    }
  } else {
    storySpec.link_data = {
      link: params.destinationUrl,
      image_hash: params.imageHash,
      message: params.primaryText,
      name: params.headline,
      description: params.description,
      call_to_action: {
        type: params.cta,
        value: { link: params.destinationUrl },
      },
    }
  }

  const creativeBody = new URLSearchParams({
    access_token: token,
    name: `Creative - ${params.adName}`,
    object_story_spec: JSON.stringify(storySpec),
  })
  if (params.urlTags) creativeBody.set("url_tags", params.urlTags)

  const creativeRes = await fetch(`${GRAPH_API}/${adAccountId}/adcreatives`, {
    method: "POST",
    body: creativeBody,
  })
  const creativeData = await creativeRes.json().catch(() => null)
  if (!creativeRes.ok || creativeData?.error) {
    fail(500, creativeData?.error?.message || "Failed to create ad creative")
  }

  const adRes = await fetch(`${GRAPH_API}/${adAccountId}/ads`, {
    method: "POST",
    body: new URLSearchParams({
      access_token: token,
      name: params.adName,
      adset_id: params.adSetId,
      creative: JSON.stringify({ creative_id: creativeData.id }),
      status: "PAUSED",
    }),
  })
  const adData = await adRes.json().catch(() => null)
  if (!adRes.ok || adData?.error) {
    fail(500, adData?.error?.message || "Failed to create ad")
  }

  return { id: adData.id }
}

export async function POST(request: NextRequest) {
  let campaignId: string | null = null
  let rollbackToken: string | null = null

  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const body = (await request.json()) as unknown
    if (!isRecord(body)) fail(400, "Invalid request body")
    const rawAdAccountId = asString(body.adAccountId)
    if (!rawAdAccountId) fail(400, "Ad account is required")

    const state = parseState(body.state)
    const adAccountId = withActPrefix(rawAdAccountId)
    const token = connection.access_token
    rollbackToken = token

    const account = await assertAdAccountAllowed(ctx.orgId, adAccountId, token)
    const currency = account.currency || "USD"
    await assertIdentityAllowed(adAccountId, token, state)
    await assertPixelAllowed(adAccountId, token, state)

    const delivery = resolveDelivery(state)
    const campaignBudget = state.advantageCampaignBudget
      ? campaignBudgetForHelper(state.campaignBudget, "Campaign budget", currency)
      : undefined
    const adSetBudget = state.advantageCampaignBudget
      ? undefined
      : budgetMinorUnits(state.dailyBudget, "Ad set budget", currency)

    const startTime = parseOptionalDate(state.scheduleStart, "Start date")
    const endTime = parseOptionalDate(state.scheduleEnd, "End date")
    if (startTime && endTime && new Date(endTime) <= new Date(startTime)) {
      fail(400, "End date must be after start date")
    }

    const campaign = await createCampaign(adAccountId, token, {
      name: state.campaignName,
      objective: state.objective,
      special_ad_categories: state.specialAdCategories,
      status: "PAUSED",
      daily_budget: campaignBudget,
      bid_strategy: campaignBudget ? "LOWEST_COST_WITHOUT_CAP" : undefined,
    })
    campaignId = campaign.id

    const adSet = await createAdSet(adAccountId, token, {
      name: state.adSetName,
      campaign_id: campaign.id,
      targeting: buildTargeting(state),
      optimization_goal: delivery.optimizationGoal,
      billing_event: delivery.billingEvent,
      daily_budget: adSetBudget,
      status: "PAUSED",
      start_time: startTime,
      promoted_object: delivery.promotedObject,
    })
    await patchAdSetEndTime(adSet.id, token, endTime)

    const media = await resolveMediaForAd(ctx.orgId, adAccountId, token, state)
    const ad = await createSingleMediaAd(adAccountId, token, {
      adName: state.adName,
      adSetId: adSet.id,
      pageId: state.pageId,
      imageHash: media.imageHash,
      videoId: media.videoId,
      thumbnailUrl: media.thumbnailUrl,
      headline: state.headline,
      primaryText: state.primaryText,
      description: state.description,
      cta: state.callToAction,
      destinationUrl: parseHttpUrl(state.destinationUrl, "Website URL"),
      instagramId: state.instagramId || undefined,
      urlTags: state.urlParameters || undefined,
    })

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      adSetId: adSet.id,
      adId: ad.id,
    })
  } catch (err) {
    if (campaignId && rollbackToken) await rollbackCampaign(campaignId, rollbackToken)

    const status = err instanceof HttpError ? err.status : 500
    const message = err instanceof Error ? err.message : "Failed to create campaign"
    if (status >= 500) console.error("[create-campaign] error:", err)
    return NextResponse.json({ error: message }, { status })
  }
}
