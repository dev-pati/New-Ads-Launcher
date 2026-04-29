const GRAPH_API_VERSION = "v25.0"
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

// NOTE: ads_management, ads_read, business_management, pages_manage_ads
// require App Review OR must be added in Facebook Developer Dashboard
// under Use Cases → Customize for dev mode to work.
export const FB_PERMISSIONS = [
  "business_management",
  "pages_show_list",
  "pages_read_engagement",
  "ads_read",
  "ads_management",
].join(",")

export function getFacebookLoginUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID!,
    redirect_uri: redirectUri,
    scope: FB_PERMISSIONS,
    response_type: "code",
    state,
  })
  return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params}`
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; token_type: string; expires_in: number }> {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID!,
    client_secret: process.env.FACEBOOK_APP_SECRET!,
    redirect_uri: redirectUri,
    code,
  })

  const res = await fetch(`${GRAPH_API_BASE}/oauth/access_token?${params}`)
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "Failed to exchange code for token")
  }
  return res.json()
}

export async function getLongLivedToken(
  shortLivedToken: string
): Promise<{ access_token: string; token_type: string; expires_in: number }> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.FACEBOOK_APP_ID!,
    client_secret: process.env.FACEBOOK_APP_SECRET!,
    fb_exchange_token: shortLivedToken,
  })

  const res = await fetch(`${GRAPH_API_BASE}/oauth/access_token?${params}`)
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "Failed to get long-lived token")
  }
  return res.json()
}

export interface FacebookUser {
  id: string
  name: string
  email?: string
  picture?: { data: { url: string } }
}

export async function getFacebookUser(accessToken: string): Promise<FacebookUser> {
  const res = await fetch(
    `${GRAPH_API_BASE}/me?fields=id,name,picture&access_token=${accessToken}`
  )
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "Failed to get user info")
  }
  return res.json()
}

export interface FacebookPage {
  id: string
  name: string
  access_token: string
  category: string
  picture?: { data: { url: string } }
}

export async function getFacebookPages(accessToken: string): Promise<FacebookPage[]> {
  const res = await fetch(
    `${GRAPH_API_BASE}/me/accounts?fields=id,name,access_token,category,picture&access_token=${accessToken}`
  )
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "Failed to get pages")
  }
  const data = await res.json()
  return data.data || []
}

export interface AdAccount {
  id: string
  account_id: string
  name: string
  account_status: number
  currency: string
}

export async function getAdAccounts(accessToken: string): Promise<AdAccount[]> {
  const res = await fetch(
    `${GRAPH_API_BASE}/me/adaccounts?fields=id,account_id,name,account_status,currency,amount_spent,balance&access_token=${accessToken}`
  )
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "Failed to get ad accounts")
  }
  const data = await res.json()
  return data.data || []
}

// Campaign interfaces and functions
export interface Campaign {
  id: string
  name: string
  status: string
  effective_status: string
  objective: string
  daily_budget?: string
  lifetime_budget?: string
  created_time: string
  updated_time: string
  insights?: { data: CampaignInsight[] }
}

export interface CampaignInsight {
  impressions: string
  clicks: string
  spend: string
  cpc?: string
  cpm?: string
  ctr?: string
  reach?: string
  date_start: string
  date_stop: string
}

export async function getCampaigns(
  adAccountId: string,
  accessToken: string
): Promise<Campaign[]> {
  const fields = [
    "id",
    "name",
    "status",
    "effective_status",
    "objective",
    "daily_budget",
    "lifetime_budget",
    "created_time",
    "updated_time",
  ].join(",")

  const res = await fetch(
    `${GRAPH_API_BASE}/${adAccountId}/campaigns?fields=${fields}&limit=50&access_token=${accessToken}`
  )
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "Failed to get campaigns")
  }
  const data = await res.json()
  return data.data || []
}

// Ad Set interfaces and functions
export interface AdSet {
  id: string
  name: string
  status: string
  effective_status: string
  campaign_id: string
  daily_budget?: string
  lifetime_budget?: string
  targeting?: {
    age_min?: number
    age_max?: number
    genders?: number[]
    geo_locations?: { countries?: string[] }
  }
  optimization_goal?: string
  billing_event?: string
  bid_amount?: string
  start_time?: string
  end_time?: string
  created_time: string
}

export async function getAdSets(
  adAccountId: string,
  accessToken: string,
  campaignId?: string
): Promise<AdSet[]> {
  const fields = [
    "id",
    "name",
    "status",
    "effective_status",
    "campaign_id",
    "daily_budget",
    "lifetime_budget",
    "targeting",
    "optimization_goal",
    "billing_event",
    "bid_amount",
    "start_time",
    "end_time",
    "created_time",
  ].join(",")

  let url = `${GRAPH_API_BASE}/${adAccountId}/adsets?fields=${fields}&limit=50&access_token=${accessToken}`
  if (campaignId) {
    url = `${GRAPH_API_BASE}/${campaignId}/adsets?fields=${fields}&limit=50&access_token=${accessToken}`
  }

  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "Failed to get ad sets")
  }
  const data = await res.json()
  return data.data || []
}

// Ad interfaces and functions
export interface Ad {
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
    image_url?: string
    thumbnail_url?: string
  }
  created_time: string
}

export async function getAds(
  adAccountId: string,
  accessToken: string,
  adSetId?: string
): Promise<Ad[]> {
  const fields = [
    "id",
    "name",
    "status",
    "effective_status",
    "adset_id",
    "campaign_id",
    "creative{id,name,title,body,image_url,thumbnail_url}",
    "created_time",
  ].join(",")

  let url = `${GRAPH_API_BASE}/${adAccountId}/ads?fields=${fields}&limit=50&access_token=${accessToken}`
  if (adSetId) {
    url = `${GRAPH_API_BASE}/${adSetId}/ads?fields=${fields}&limit=50&access_token=${accessToken}`
  }

  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "Failed to get ads")
  }
  const data = await res.json()
  return data.data || []
}

// Business Manager interfaces and functions
export interface BusinessManager {
  id: string
  name: string
}

export async function getBusinessManagers(
  accessToken: string
): Promise<BusinessManager[]> {
  const res = await fetch(
    `${GRAPH_API_BASE}/me/businesses?fields=id,name&access_token=${accessToken}`
  )
  if (!res.ok) {
    const error = await res.json()
    throw new Error(
      error.error?.message || "Failed to get business managers"
    )
  }
  const data = await res.json()
  return data.data || []
}

// Get pages owned by a Business Manager
export async function getBusinessPages(
  businessId: string,
  accessToken: string
): Promise<FacebookPage[]> {
  const res = await fetch(
    `${GRAPH_API_BASE}/${businessId}/owned_pages?fields=id,name,access_token,category,picture&access_token=${accessToken}`
  )
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "Failed to get business pages")
  }
  const data = await res.json()
  return data.data || []
}

// Get ad accounts owned by a Business Manager
export async function getBusinessAdAccounts(
  businessId: string,
  accessToken: string
): Promise<AdAccount[]> {
  const res = await fetch(
    `${GRAPH_API_BASE}/${businessId}/owned_ad_accounts?fields=id,account_id,name,account_status,currency&access_token=${accessToken}`
  )
  if (!res.ok) {
    const error = await res.json()
    throw new Error(
      error.error?.message || "Failed to get business ad accounts"
    )
  }
  const data = await res.json()
  return data.data || []
}

// Upload image to Meta Ad Account
// Returns hash, url, and permalink_url
export async function uploadImageToMeta(
  adAccountId: string,
  accessToken: string,
  fileBuffer: ArrayBuffer,
  fileName: string
): Promise<{ hash: string; url: string; url_128: string }> {
  const base64 = Buffer.from(fileBuffer).toString("base64")

  const formData = new FormData()
  formData.append("access_token", accessToken)
  formData.append("filename", fileName)
  formData.append("bytes", base64)

  const res = await fetch(
    `${GRAPH_API_BASE}/${adAccountId}/adimages`,
    { method: "POST", body: formData }
  )
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "Failed to upload image to Meta")
  }
  const data = await res.json()
  console.log("Meta adimages response:", JSON.stringify(data, null, 2))
  const images = data.images
  const firstKey = Object.keys(images)[0]
  const img = images[firstKey]
  return {
    hash: img.hash,
    url: img.url || "",
    url_128: img.url_128 || "",
  }
}

// Upload video to Meta Ad Account (returns video ID)
export async function uploadVideoToMeta(
  adAccountId: string,
  accessToken: string,
  fileBuffer: ArrayBuffer,
  fileName: string
): Promise<{ videoId: string }> {
  const blob = new Blob([fileBuffer])

  const formData = new FormData()
  formData.append("access_token", accessToken)
  formData.append("title", fileName)
  formData.append("source", blob, fileName)

  const res = await fetch(
    `${GRAPH_API_BASE}/${adAccountId}/advideos`,
    { method: "POST", body: formData }
  )
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "Failed to upload video to Meta")
  }
  const data = await res.json()
  return { videoId: data.id }
}

// Campaign insights
export async function getCampaignInsights(
  campaignId: string,
  accessToken: string
): Promise<CampaignInsight[]> {
  const fields = "impressions,clicks,spend,cpc,cpm,ctr,reach"
  const res = await fetch(
    `${GRAPH_API_BASE}/${campaignId}/insights?fields=${fields}&date_preset=last_30d&access_token=${accessToken}`
  )
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "Failed to get campaign insights")
  }
  const data = await res.json()
  return data.data || []
}
