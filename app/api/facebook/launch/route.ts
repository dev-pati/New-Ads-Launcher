import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAdDetails, createCampaign, createAdSet, createAd, getVideoThumbnail } from "@/lib/facebook"

function applyPattern(pattern: string, ctx: { filename?: string; index?: number; date: string; shortDate: string }) {
  let r = pattern
  if (ctx.filename !== undefined) r = r.replace(/\{filename\}/g, ctx.filename)
  if (ctx.index !== undefined) {
    r = r.replace(/\{index:001\}/g, String(ctx.index).padStart(3, "0"))
    r = r.replace(/\{index:01\}/g, String(ctx.index).padStart(2, "0"))
    r = r.replace(/\{index\}/g, String(ctx.index))
  }
  return r
}

async function buildAdset(
  adAccountId: string, token: string, template: any,
  campaignId: string, name: string, dailyBudget?: number, startTime?: string,
  pageId?: string, resolvedObjective?: string,
  pixelId?: string, pixelEvent?: string
) {
  // Safe optimization goal per objective for adset-level budget (non-CBO) campaigns.
  // ENGAGED_USERS is CBO-only; for adset budgets, OUTCOME_ENGAGEMENT requires POST_ENGAGEMENT.
  const OBJECTIVE_SAFE_GOAL: Record<string, string> = {
    OUTCOME_ENGAGEMENT:    "POST_ENGAGEMENT",
    OUTCOME_AWARENESS:     "REACH",
    OUTCOME_TRAFFIC:       "LINK_CLICKS",
    OUTCOME_LEADS:         "LEAD_GENERATION",
    OUTCOME_SALES:         "OFFSITE_CONVERSIONS",
    OUTCOME_APP_PROMOTION: "APP_INSTALLS",
  }
  // Valid adset-level goals per objective (non-CBO)
  const OBJECTIVE_VALID_GOALS: Record<string, Set<string>> = {
    OUTCOME_ENGAGEMENT:    new Set(["POST_ENGAGEMENT", "PAGE_LIKES", "EVENT_RESPONSES", "REACH"]),
    OUTCOME_AWARENESS:     new Set(["REACH", "AD_RECALL_LIFT", "THRU_PLAYS", "IMPRESSIONS"]),
    OUTCOME_TRAFFIC:       new Set(["LINK_CLICKS", "LANDING_PAGE_VIEWS", "IMPRESSIONS", "REACH"]),
    OUTCOME_LEADS:         new Set(["LEAD_GENERATION", "QUALITY_LEAD", "LINK_CLICKS", "LANDING_PAGE_VIEWS"]),
    OUTCOME_SALES:         new Set(["OFFSITE_CONVERSIONS", "LINK_CLICKS", "LANDING_PAGE_VIEWS", "REACH"]),
    OUTCOME_APP_PROMOTION: new Set(["APP_INSTALLS", "LINK_CLICKS", "REACH"]),
  }
  // Remap legacy or CBO-only goals to their adset-budget equivalents
  const GOAL_REMAP: Record<string, string> = {
    ENGAGED_USERS:   "POST_ENGAGEMENT",   // CBO-only → adset equivalent
    OFFER_CLAIMS:    "POST_ENGAGEMENT",
    VALUE:           "OFFSITE_CONVERSIONS",
  }
  const campaignObjective: string = resolvedObjective || template.campaign?.objective || ""
  const rawGoal: string = template.adset.optimization_goal || ""
  const remappedGoal = GOAL_REMAP[rawGoal] ?? rawGoal
  const validForObjective = OBJECTIVE_VALID_GOALS[campaignObjective]
  const optimizationGoal =
    (remappedGoal && validForObjective?.has(remappedGoal))
      ? remappedGoal
      : (OBJECTIVE_SAFE_GOAL[campaignObjective] ?? "POST_ENGAGEMENT")

  const billingEvent = optimizationGoal === "THRU_PLAYS" ? "THRU_PLAYS" : "IMPRESSIONS"

  // OUTCOME_ENGAGEMENT requires destination_type so Facebook knows what kind of engagement to optimize for
  const destinationType = campaignObjective === "OUTCOME_ENGAGEMENT" ? "ON_POST" : undefined
  // promoted_object: only attach pixel+event for objectives that support conversion tracking
  const PIXEL_COMPATIBLE_OBJECTIVES = new Set(["OUTCOME_SALES", "OUTCOME_LEADS"])
  const promotedObject = pixelId && PIXEL_COMPATIBLE_OBJECTIVES.has(campaignObjective)
    ? { pixel_id: pixelId, custom_event_type: pixelEvent || "PURCHASE" }
    : (template.adset.promoted_object || undefined)
  // Keep only standard targeting fields to avoid v25 conflicts
  const rawTargeting = template.adset.targeting || {}
  const safeTargeting: Record<string, any> = {}
  if (rawTargeting.geo_locations) {
    // Strip location_types — deprecated in v25, causes validation errors
    const { location_types: _lt, ...geoRest } = rawTargeting.geo_locations
    safeTargeting.geo_locations = geoRest
  }
  if (rawTargeting.age_min) safeTargeting.age_min = rawTargeting.age_min
  if (rawTargeting.age_max) safeTargeting.age_max = rawTargeting.age_max
  if (rawTargeting.genders) safeTargeting.genders = rawTargeting.genders
  // flexible_spec (interest targeting) intentionally excluded — causes v25 API conflicts

  // Budget priority: explicit user input → template adset budget → undefined (will fail FB validation)
  let budgetCents: string | undefined
  if (dailyBudget && dailyBudget > 0) {
    budgetCents = String(Math.round(dailyBudget * 100))
  } else if (template.adset.daily_budget) {
    budgetCents = template.adset.daily_budget // already in cents from Facebook API
  }

  return createAdSet(adAccountId, token, {
    name,
    campaign_id: campaignId,
    targeting: safeTargeting,
    optimization_goal: optimizationGoal,
    billing_event: billingEvent,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    daily_budget: budgetCents,
    status: "PAUSED",
    start_time: startTime,
    destination_type: destinationType,
    promoted_object: promotedObject,
    attribution_spec: template.adset.attribution_spec || undefined,
  })
}

interface TextOverride {
  headlines: string[]
  primaryTexts: string[]
  description: string
  cta: string
  websiteUrl: string
  displayUrl: string
}

function appendUtm(url: string, utmQuery: string): string {
  if (!utmQuery || !url) return url
  return url + (url.includes("?") ? "&" : "?") + utmQuery
}

async function createAdsInAdset(
  adsetId: string, creatives: any[], adAccountId: string,
  token: string, pageId: string, supabase: any,
  resolveName: (baseName: string, index: number) => string = (n) => n,
  startIndex = 1,
  textOverride?: TextOverride,
  creativeTextMap?: Map<string, any>,
  imgDof?: Record<string, any>,
  vidDof?: Record<string, any>,
  adStatus = "PAUSED",
  utmQuery = "",
  globalWebsiteUrl = "",
  globalDisplayUrl = ""
) {
  const results: any[] = []
  const errors: any[] = []
  for (let i = 0; i < creatives.length; i++) {
    const creative = creatives[i]
    const baseName = creative.file_name.replace(/\.[^/.]+$/, "")
    const _pc = creativeTextMap?.get(creative.id)
    const pcHeadlines: string[] = _pc?.headlines?.filter((h: string) => h.trim()) || []
    const pcPrimaryTexts: string[] = _pc?.primaryTexts?.filter((p: string) => p.trim()) || []
    const pcHasContent = pcHeadlines.length > 0 || pcPrimaryTexts.length > 0 || !!_pc?.description?.trim() || !!_pc?.websiteUrl?.trim()
    const perCreative = pcHasContent ? _pc : undefined
    const title = pcHeadlines.length
      ? pcHeadlines[i % pcHeadlines.length]
      : (textOverride?.headlines?.length
          ? textOverride.headlines[i % textOverride.headlines.length]
          : creative.headline || "")
    const body = pcPrimaryTexts.length
      ? pcPrimaryTexts[i % pcPrimaryTexts.length]
      : (textOverride?.primaryTexts?.length
          ? textOverride.primaryTexts[i % textOverride.primaryTexts.length]
          : creative.primary_text || "")
    const description = perCreative?.description?.trim() ? perCreative.description : (textOverride ? textOverride.description : creative.description || "")
    const cta = perCreative ? perCreative.cta : (textOverride ? textOverride.cta : creative.cta || "LEARN_MORE")
    const rawUrl = perCreative?.websiteUrl?.trim() ? perCreative.websiteUrl : (textOverride?.websiteUrl || creative.link_url || globalWebsiteUrl || "")
    const link_url = appendUtm(rawUrl, utmQuery)
    const display_url = perCreative?.displayUrl?.trim() ? perCreative.displayUrl : (textOverride?.displayUrl?.trim() ? textOverride.displayUrl : (globalDisplayUrl || undefined))
    if (!link_url) {
      errors.push({ creativeId: creative.id, error: "Website URL is required. Add a URL in Ad Text Options → Website URL, or edit the creative to add a link." })
      continue
    }
    const isValidUrl = /^https?:\/\/.+/.test(link_url)
    if (!isValidUrl) {
      errors.push({ creativeId: creative.id, error: `Invalid URL "${link_url}" — must start with http:// or https://` })
      continue
    }
    try {
      // Facebook v25 requires image_url in video_data — fetch thumbnail if not stored
      let thumbnailUrl: string | undefined = creative.fb_thumbnail_url || undefined
      if (creative.fb_video_id && !thumbnailUrl) {
        thumbnailUrl = (await getVideoThumbnail(creative.fb_video_id, token)) || undefined
      }

      const ad = await createAd(adAccountId, token, {
        name: resolveName(baseName, startIndex + i),
        adset_id: adsetId,
        page_id: pageId,
        image_hash: creative.fb_image_hash || undefined,
        video_id: creative.fb_video_id || undefined,
        thumbnail_url: thumbnailUrl,
        title,
        body,
        description,
        cta,
        link_url,
        display_url,
        status: adStatus,
        degrees_of_freedom_spec: creative.fb_video_id ? vidDof : imgDof,
      })
      await supabase.from("creatives").update({ status: "launched", fb_ad_id: ad.id }).eq("id", creative.id)
      results.push({ creativeId: creative.id, adId: ad.id, adName: resolveName(baseName, startIndex + i), fileName: creative.file_name })
    } catch (err: any) {
      errors.push({ creativeId: creative.id, error: err.message })
    }
  }
  return { results, errors }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const supabase = await createClient()
    const { data: adAccounts } = await supabase.from("ad_accounts").select("fb_ad_account_id").eq("org_id", ctx.orgId)
    if (!adAccounts?.length) return NextResponse.json({ error: "No ad account found" }, { status: 400 })

    const token = connection.access_token
    const body = await request.json()

    const requestedId = body.adAccountId
    const matched = requestedId && adAccounts.find((a: any) => a.fb_ad_account_id === requestedId)
    const adAccountId = matched ? requestedId : adAccounts[0].fb_ad_account_id

    const {
      templateAdId, presetId, creativeIds,
      campaignOption,         // "existing" | "new" | "multiple"
      existingCampaignId, newCampaignName,
      multipleCampaignNames, creativeDistribution,
      adsetMode,              // "existing" | "new" | "per_creative" | "auto_divide" | "custom"
      existingAdsetId, newAdsetName,
      adsetNamePattern, autoDividePattern, adsPerAdset,
      adsetDailyBudget,
      customConfig,           // CampaignConfig[] khi adsetMode = "custom"
      useCustomAdName, adNamePattern: adNamePatternBody, filenameTransform,
      useCommonText, commonHeadlines, commonPrimaryTexts, commonDescription, commonCta, commonWebsiteUrl, commonDisplayUrl,
      utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
      useUniqueTextPerAdset, adsetTextConfigs,
      useUniqueTextPerCreative, creativeTextConfigs,
      useMetaDefaults, imageEnhancements, videoEnhancements,
      createPaused, startTime,
      pageId,
      pixelId, pixelEvent,
    } = body

    const buildDegreesOfFreedom = (keys: string[]): Record<string, any> | undefined => {
      if (useMetaDefaults) return undefined
      if (!keys.length) return undefined
      const features: Record<string, any> = {}
      keys.forEach((k: string) => { features[k] = { enroll_status: "OPT_IN" } })
      return { creative_features_spec: features }
    }
    const imgDof = buildDegreesOfFreedom(imageEnhancements || [])
    const vidDof = buildDegreesOfFreedom(videoEnhancements || [])

    const creativeTextMap: Map<string, any> = new Map(
      useUniqueTextPerCreative ? (creativeTextConfigs || []).map((c: any) => [c.creativeId, c]) : []
    )

    const utmQuery = [
      utmSource && `utm_source=${encodeURIComponent(utmSource)}`,
      utmMedium && `utm_medium=${encodeURIComponent(utmMedium)}`,
      utmCampaign && `utm_campaign=${encodeURIComponent(utmCampaign)}`,
      utmContent && `utm_content=${encodeURIComponent(utmContent)}`,
      utmTerm && `utm_term=${encodeURIComponent(utmTerm)}`,
    ].filter(Boolean).join("&")

    const globalWebsiteUrl: string = commonWebsiteUrl || ""
    const globalDisplayUrl: string = commonDisplayUrl || ""

    const textOverride: TextOverride | undefined = useCommonText ? {
      headlines: (commonHeadlines || []).filter((h: string) => h.trim()),
      primaryTexts: (commonPrimaryTexts || []).filter((p: string) => p.trim()),
      description: commonDescription || "",
      cta: commonCta || "LEARN_MORE",
      websiteUrl: commonWebsiteUrl || "",
      displayUrl: commonDisplayUrl || "",
    } : undefined

    const getAdsetTextOverride = (adsetIndex: number): TextOverride | undefined => {
      if (!useUniqueTextPerAdset || !adsetTextConfigs?.length) return undefined
      const cfg = adsetTextConfigs[adsetIndex]
      if (!cfg) return undefined
      return {
        headlines: (cfg.headlines || []).filter((h: string) => h.trim()),
        primaryTexts: (cfg.primaryTexts || []).filter((p: string) => p.trim()),
        description: cfg.description || "",
        cta: cfg.cta || "LEARN_MORE",
        websiteUrl: cfg.websiteUrl || "",
        displayUrl: cfg.displayUrl || "",
      }
    }

    const adStatus = createPaused === false ? "ACTIVE" : "PAUSED"

    if (!templateAdId && !presetId) {
      return NextResponse.json({ error: "templateAdId or presetId is required" }, { status: 400 })
    }
    if (!creativeIds?.length) {
      return NextResponse.json({ error: "creativeIds are required" }, { status: 400 })
    }
    if (!pageId) {
      return NextResponse.json({ error: "Bạn chưa chọn Facebook Page. Vui lòng chọn một Page trước khi launch." }, { status: 400 })
    }
    const isCreatingNewCampaign = campaignOption === "new" || campaignOption === "multiple" || adsetMode === "custom"
    if (isCreatingNewCampaign && !adsetDailyBudget) {
      return NextResponse.json({ error: "Daily budget là bắt buộc khi tạo campaign mới." }, { status: 400 })
    }

    const today = new Date()
    const dateStr = `${String(today.getMonth()+1).padStart(2,"0")}/${String(today.getDate()).padStart(2,"0")}/${today.getFullYear()}`
    const shortDateStr = `${String(today.getMonth()+1).padStart(2,"0")}/${String(today.getDate()).padStart(2,"0")}`

    const resolveAdName = (baseName: string, index: number): string => {
      if (!useCustomAdName || !adNamePatternBody) return baseName
      let fname = baseName
      switch (filenameTransform) {
        case "title_case": fname = fname.replace(/[_-]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()); break
        case "uppercase": fname = fname.toUpperCase(); break
        case "lowercase": fname = fname.toLowerCase(); break
        case "clean": fname = fname.replace(/[^a-zA-Z0-9\s]/g, "").trim(); break
        case "split": fname = fname.replace(/[_-]/g, " "); break
      }
      return adNamePatternBody
        .replace(/\{filename\}/g, fname)
        .replace(/\{index:001\}/g, String(index).padStart(3, "0"))
        .replace(/\{index:01\}/g, String(index).padStart(2, "0"))
        .replace(/\{index\}/g, String(index))
        .replace(/\{date:short\}/g, shortDateStr)
        .replace(/\{date\}/g, dateStr)
    }

    let template: any
    if (presetId) {
      const adminDb = createAdminClient()
      const { data: preset, error: presetErr } = await adminDb
        .from("ad_set_presets")
        .select("*")
        .eq("id", presetId)
        .eq("org_id", ctx.orgId)
        .single()
      if (presetErr || !preset) return NextResponse.json({ error: "Preset not found" }, { status: 404 })
      template = {
        adset: {
          targeting: preset.targeting || {},
          optimization_goal: preset.optimization_goal,
          billing_event: preset.billing_event,
          bid_strategy: preset.bid_strategy,
          bid_amount: preset.bid_amount,
          daily_budget: undefined,
          lifetime_budget: undefined,
          id: null,
          campaign_id: null,
          name: preset.adset_name || preset.name,
        },
        campaign: {
          objective: preset.objective,
          special_ad_categories: preset.special_ad_categories || [],
          name: preset.campaign_name || preset.name,
        },
      }
    } else {
      template = await getAdDetails(templateAdId, token)
    }
    console.log("[launch] template.adset.attribution_spec:", JSON.stringify(template?.adset?.attribution_spec))
    const { data: creatives } = await supabase.from("creatives").select("*").in("id", creativeIds).eq("org_id", ctx.orgId)
    if (!creatives?.length) return NextResponse.json({ error: "No creatives found" }, { status: 400 })

    const allResults: any[] = []
    const allErrors: any[] = []

    // Map legacy campaign objectives to v25 OUTCOME_* equivalents
    const LEGACY_OBJECTIVE_MAP: Record<string, string> = {
      PAGE_LIKES: "OUTCOME_ENGAGEMENT",
      POST_ENGAGEMENT: "OUTCOME_ENGAGEMENT",
      EVENT_RESPONSES: "OUTCOME_ENGAGEMENT",
      VIDEO_VIEWS: "OUTCOME_ENGAGEMENT",
      MESSAGES: "OUTCOME_ENGAGEMENT",
      REACH: "OUTCOME_AWARENESS",
      BRAND_AWARENESS: "OUTCOME_AWARENESS",
      LINK_CLICKS: "OUTCOME_TRAFFIC",
      LEAD_GENERATION: "OUTCOME_LEADS",
      CONVERSIONS: "OUTCOME_SALES",
      PRODUCT_CATALOG_SALES: "OUTCOME_SALES",
      CATALOG_SALES: "OUTCOME_SALES",
      STORE_TRAFFIC: "OUTCOME_SALES",
      APP_INSTALLS: "OUTCOME_APP_PROMOTION",
    }
    const resolvedObjective = LEGACY_OBJECTIVE_MAP[template.campaign.objective] ?? template.campaign.objective

    // Detect whether the template uses CBO (budget at campaign level) or non-CBO (budget at adset level)
    const isCBO = !!template.campaign.daily_budget
    // For CBO: budget goes to campaign; adsets have no budget
    // For non-CBO: campaign has is_adset_budget_sharing_enabled=false; budget goes to adsets
    const campaignDailyBudget = isCBO ? adsetDailyBudget : undefined
    const campaignBidStrategy = isCBO ? (template.campaign.bid_strategy || "LOWEST_COST_WITHOUT_CAP") : undefined
    const adsetBudgetAmount = isCBO ? undefined : adsetDailyBudget

    // Resolve adset for a given campaignId
    async function resolveAdset(campaignId: string, creativeSubset: any[], index = 1) {
      if (adsetMode === "existing") return existingAdsetId || template.adset.id
      if (adsetMode === "new") {
        const s = await buildAdset(adAccountId, token, template, campaignId, newAdsetName || template.adset.name, adsetBudgetAmount, startTime, pageId, resolvedObjective, pixelId, pixelEvent)
        return s.id
      }
      if (adsetMode === "per_creative") {
        // will be handled per-creative outside
        return null
      }
      if (adsetMode === "auto_divide") {
        const name = applyPattern(autoDividePattern || "Ad Set {index:01}", { index, date: dateStr, shortDate: shortDateStr })
        const s = await buildAdset(adAccountId, token, template, campaignId, name, adsetBudgetAmount, startTime, pageId, resolvedObjective, pixelId, pixelEvent)
        return s.id
      }
    }

    // Custom config mode: bypass normal campaign loop entirely
    if (adsetMode === "custom") {
      if (!customConfig?.length) {
        return NextResponse.json({ error: "Custom config is empty" }, { status: 400 })
      }
      let globalIdx = 1
      let adsetCounter = 0
      for (const campConfig of customConfig) {
        const camp = await createCampaign(adAccountId, token, {
          name: campConfig.name,
          objective: resolvedObjective,
          special_ad_categories: template.campaign.special_ad_categories || [],
          status: "PAUSED",
          daily_budget: campaignDailyBudget,
          bid_strategy: campaignBidStrategy,
        })
        for (const adsetConfig of campConfig.adsets) {
          if (!adsetConfig.creativeIds?.length) continue
          const adset = await buildAdset(adAccountId, token, template, camp.id, adsetConfig.name, adsetBudgetAmount, startTime, pageId, resolvedObjective, pixelId, pixelEvent)
          const adsetCreatives = creatives.filter((c: any) => adsetConfig.creativeIds.includes(c.id))
          const override = textOverride ?? getAdsetTextOverride(adsetCounter++)
          const { results, errors } = await createAdsInAdset(adset.id, adsetCreatives, adAccountId, token, pageId, supabase, resolveAdName, globalIdx, override, creativeTextMap, imgDof, vidDof, adStatus, utmQuery, globalWebsiteUrl, globalDisplayUrl)
          globalIdx += adsetCreatives.length
          allResults.push(...results)
          allErrors.push(...errors)
        }
      }
      return NextResponse.json({
        success: true, created: allResults, errors: allErrors,
        summary: `${allResults.length} ads created, ${allErrors.length} failed`,
        adManagerUrl: `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${adAccountId.replace("act_", "")}`,
      })
    }

    // Resolve campaign(s)
    const campaignIds: string[] = []
    if (campaignOption === "multiple") {
      for (const name of (multipleCampaignNames || []).filter((n: string) => n.trim())) {
        const c = await createCampaign(adAccountId, token, {
          name, objective: resolvedObjective,
          special_ad_categories: template.campaign.special_ad_categories || [],
          status: "PAUSED",
          daily_budget: campaignDailyBudget,
          bid_strategy: campaignBidStrategy,
        })
        campaignIds.push(c.id)
      }
    } else if (campaignOption === "new") {
      const c = await createCampaign(adAccountId, token, {
        name: newCampaignName || template.campaign.name,
        objective: resolvedObjective,
        special_ad_categories: template.campaign.special_ad_categories || [],
        status: "PAUSED",
        daily_budget: campaignDailyBudget,
        bid_strategy: campaignBidStrategy,
      })
      campaignIds.push(c.id)
    } else {
      campaignIds.push(existingCampaignId || template.adset.campaign_id)
    }

    let adsetCounter = 0
    for (let ci = 0; ci < campaignIds.length; ci++) {
      const campaignId = campaignIds[ci]

      // Which creatives go to this campaign
      let campaignCreatives = creatives
      if (campaignOption === "multiple" && creativeDistribution === "split") {
        const chunkSize = Math.ceil(creatives.length / campaignIds.length)
        campaignCreatives = creatives.slice(ci * chunkSize, (ci + 1) * chunkSize)
      }

      if (adsetMode === "per_creative") {
        // 1 ad set per creative
        for (let i = 0; i < campaignCreatives.length; i++) {
          const creative = campaignCreatives[i]
          const filename = creative.file_name.replace(/\.[^/.]+$/, "")
          const name = applyPattern(adsetNamePattern || "{filename}", { filename, index: i + 1, date: dateStr, shortDate: shortDateStr })
          const adset = await buildAdset(adAccountId, token, template, campaignId, name, adsetBudgetAmount, startTime, pageId, resolvedObjective, pixelId, pixelEvent)
          const override = textOverride ?? getAdsetTextOverride(adsetCounter++)
          const { results, errors } = await createAdsInAdset(adset.id, [creative], adAccountId, token, pageId, supabase, resolveAdName, i + 1, override, creativeTextMap, imgDof, vidDof, adStatus, utmQuery, globalWebsiteUrl, globalDisplayUrl)
          allResults.push(...results)
          allErrors.push(...errors)
        }
      } else if (adsetMode === "auto_divide") {
        // chunk creatives into groups of N
        const chunkSize = adsPerAdset || 5
        const chunks: any[][] = []
        for (let i = 0; i < campaignCreatives.length; i += chunkSize) {
          chunks.push(campaignCreatives.slice(i, i + chunkSize))
        }
        let globalIdx = 1
        for (let i = 0; i < chunks.length; i++) {
          const adsetId = await resolveAdset(campaignId, chunks[i], i + 1)
          const override = textOverride ?? getAdsetTextOverride(adsetCounter++)
          const { results, errors } = await createAdsInAdset(adsetId!, chunks[i], adAccountId, token, pageId, supabase, resolveAdName, globalIdx, override, creativeTextMap, imgDof, vidDof, adStatus, utmQuery, globalWebsiteUrl, globalDisplayUrl)
          globalIdx += chunks[i].length
          allResults.push(...results)
          allErrors.push(...errors)
        }
      } else {
        const adsetId = await resolveAdset(campaignId, campaignCreatives)
        const override = textOverride ?? getAdsetTextOverride(adsetCounter++)
        const { results, errors } = await createAdsInAdset(adsetId!, campaignCreatives, adAccountId, token, pageId, supabase, resolveAdName, 1, override, creativeTextMap, imgDof, vidDof, adStatus, utmQuery, globalWebsiteUrl, globalDisplayUrl)
        allResults.push(...results)
        allErrors.push(...errors)
      }
    }

    return NextResponse.json({
      success: true,
      created: allResults,
      errors: allErrors,
      summary: `${allResults.length} ads created, ${allErrors.length} failed`,
      adManagerUrl: `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${adAccountId.replace("act_", "")}`,
    })
  } catch (err: any) {
    console.error("Launch error:", err)
    return NextResponse.json({ error: err.message || "Launch failed" }, { status: 500 })
  }
}
