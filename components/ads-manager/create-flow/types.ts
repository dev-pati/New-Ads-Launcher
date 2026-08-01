export type CampaignObjective = "OUTCOME_SALES" | "OUTCOME_TRAFFIC" | "OUTCOME_AWARENESS"

export type SpecialAdCategory =
  | "CREDIT"
  | "EMPLOYMENT"
  | "HOUSING"
  | "ISSUES_ELECTIONS_POLITICS"

export type PerformanceGoal =
  | "OFFSITE_CONVERSIONS"
  | "LINK_CLICKS"
  | "LANDING_PAGE_VIEWS"
  | "REACH"

export type GenderTargeting = "ALL" | "MALE" | "FEMALE"
export type MediaType = "image" | "video"
export type ConversionEvent =
  | "PURCHASE"
  | "ADD_TO_CART"
  | "INITIATED_CHECKOUT"
  | "LEAD"
  | "COMPLETE_REGISTRATION"
  | "VIEW_CONTENT"

// Attribution windows — engaged-view is new (video ads only).
export type AttributionClickDays = "1" | "7"
export type AttributionViewDays = "0" | "1"
export type AttributionEngagedViewDays = "0" | "1"

// Placement control — Advantage+ (automatic) vs Manual (platforms selected).
export type PlacementMode = "advantage" | "manual"
export type PublisherPlatform = "facebook" | "instagram" | "audience_network" | "messenger"

// Ad transparency — who is the Advertiser and Payer for selected locations.
export type AdvertiserEntity =
  | { type: "page"; id: string; name: string }
  | { type: "business"; id: string; name: string }
  | null

export interface CreativeAssetOption {
  id: string
  file_name: string
  file_url: string
  media_type: MediaType
  fb_image_url?: string | null
  fb_thumbnail_url?: string | null
  fb_image_hash?: string | null
  fb_video_id?: string | null
}

export interface CampaignFormState {
  // Campaign
  campaignName: string
  objective: CampaignObjective
  specialAdCategories: SpecialAdCategory[]
  advantageCampaignBudget: boolean
  campaignBudget: string

  // Ad Set
  adSetName: string
  conversionLocation: "website"
  performanceGoal: PerformanceGoal
  pixelId: string
  conversionEvent: ConversionEvent
  costPerResultGoal: string
  attributionClickDays: AttributionClickDays
  attributionViewDays: AttributionViewDays
  attributionEngagedViewDays: AttributionEngagedViewDays
  dailyBudget: string
  scheduleStart: string
  scheduleEnd: string
  scheduleTimeBasis: "account" | "utc"
  locations: string[]
  ageMin: number
  ageMax: number
  gender: GenderTargeting
  customAudiences: TargetingOption[]
  excludedCustomAudiences: TargetingOption[]
  detailedTargeting: TargetingOption[]
  targetingExpansion: boolean
  placementMode: PlacementMode
  publisherPlatforms: PublisherPlatform[]
  advertiser: AdvertiserEntity
  payer: AdvertiserEntity

  // Ad
  adName: string
  pageId: string
  instagramId: string
  creativeId: string
  creativeFileName: string
  creativePreviewUrl: string
  mediaUrl: string
  mediaType: MediaType
  creativeIds: string[]
  selectedCreatives: SelectedCreative[]
  oneAdPerAdset: boolean
  primaryText: string
  primaryTextVariations: string[]
  headline: string
  headlineVariations: string[]
  description: string
  descriptionVariations: string[]
  callToAction: string
  destinationUrl: string
  urlParameters: string
}

export interface SelectedCreative {
  id: string
  file_name: string
  preview_url: string
  media_type: MediaType
}

export interface FacebookPageOption {
  id: string
  name: string
  picture?: { data?: { url?: string } }
}

export interface InstagramOption {
  id: string
  username?: string
  profile_pic?: string
}

export interface PixelOption {
  id: string
  name: string
}

export interface TargetingOption {
  id: string
  name: string
}

export const defaultCampaignState: CampaignFormState = {
  campaignName: "New Campaign",
  objective: "OUTCOME_SALES",
  specialAdCategories: [],
  advantageCampaignBudget: true,
  campaignBudget: "100",

  adSetName: "New Ad Set",
  conversionLocation: "website",
  performanceGoal: "OFFSITE_CONVERSIONS",
  pixelId: "",
  conversionEvent: "PURCHASE",
  costPerResultGoal: "",
  attributionClickDays: "7",
  attributionViewDays: "0",
  attributionEngagedViewDays: "0",
  dailyBudget: "20",
  scheduleStart: "",
  scheduleEnd: "",
  scheduleTimeBasis: "account",
  locations: ["US"],
  ageMin: 18,
  ageMax: 65,
  gender: "ALL",
  customAudiences: [],
  excludedCustomAudiences: [],
  detailedTargeting: [],
  targetingExpansion: true,
  placementMode: "advantage",
  publisherPlatforms: ["facebook", "instagram", "audience_network", "messenger"],
  advertiser: null,
  payer: null,

  adName: "New Ad",
  pageId: "",
  instagramId: "",
  creativeId: "",
  creativeFileName: "",
  creativePreviewUrl: "",
  mediaUrl: "",
  mediaType: "image",
  creativeIds: [],
  selectedCreatives: [],
  oneAdPerAdset: false,
  primaryText: "",
  primaryTextVariations: [],
  headline: "",
  headlineVariations: [],
  description: "",
  descriptionVariations: [],
  callToAction: "LEARN_MORE",
  destinationUrl: "",
  urlParameters: "",
}
