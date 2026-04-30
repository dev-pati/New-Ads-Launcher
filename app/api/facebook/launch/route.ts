import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getAdDetails, createCampaign, createAdSet, createAd } from "@/lib/facebook"

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
  campaignId: string, name: string, dailyBudget?: number
) {
  return createAdSet(adAccountId, token, {
    name,
    campaign_id: campaignId,
    targeting: template.adset.targeting || {},
    optimization_goal: template.adset.optimization_goal,
    billing_event: template.adset.billing_event,
    bid_amount: template.adset.bid_amount,
    bid_strategy: template.adset.bid_strategy,
    daily_budget: dailyBudget ? String(dailyBudget * 100) : template.adset.daily_budget,
    lifetime_budget: dailyBudget ? undefined : template.adset.lifetime_budget,
    status: "PAUSED",
  })
}

async function createAdsInAdset(
  adsetId: string, creatives: any[], adAccountId: string,
  token: string, pageId: string, supabase: any,
  resolveName: (baseName: string, index: number) => string = (n) => n,
  startIndex = 1
) {
  const results: any[] = []
  const errors: any[] = []
  for (let i = 0; i < creatives.length; i++) {
    const creative = creatives[i]
    const baseName = creative.file_name.replace(/\.[^/.]+$/, "")
    try {
      const ad = await createAd(adAccountId, token, {
        name: resolveName(baseName, startIndex + i),
        adset_id: adsetId,
        page_id: pageId,
        image_hash: creative.fb_image_hash || undefined,
        video_id: creative.fb_video_id || undefined,
        title: creative.headline || "",
        body: creative.primary_text || "",
        description: creative.description || "",
        cta: creative.cta || "LEARN_MORE",
        link_url: creative.link_url || "",
        status: "PAUSED",
      })
      await supabase.from("creatives").update({ status: "launched", fb_ad_id: ad.id }).eq("id", creative.id)
      results.push({ creativeId: creative.id, adId: ad.id, name: creative.file_name })
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
    const { data: adAccounts } = await supabase.from("ad_accounts").select("fb_ad_account_id").eq("org_id", ctx.orgId).limit(1)
    if (!adAccounts?.length) return NextResponse.json({ error: "No ad account found" }, { status: 400 })

    const adAccountId = adAccounts[0].fb_ad_account_id
    const token = connection.access_token
    const body = await request.json()

    const {
      templateAdId, creativeIds,
      campaignOption,         // "existing" | "new" | "multiple"
      existingCampaignId, newCampaignName,
      multipleCampaignNames, creativeDistribution,
      adsetMode,              // "existing" | "new" | "per_creative" | "auto_divide" | "custom"
      existingAdsetId, newAdsetName,
      adsetNamePattern, autoDividePattern, adsPerAdset,
      adsetDailyBudget,
      customConfig,           // CampaignConfig[] khi adsetMode = "custom"
      useCustomAdName, adNamePattern: adNamePatternBody, filenameTransform,
      pageId,
    } = body

    if (!templateAdId || !creativeIds?.length) {
      return NextResponse.json({ error: "templateAdId and creativeIds are required" }, { status: 400 })
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

    const template = await getAdDetails(templateAdId, token)
    const { data: creatives } = await supabase.from("creatives").select("*").in("id", creativeIds).eq("org_id", ctx.orgId)
    if (!creatives?.length) return NextResponse.json({ error: "No creatives found" }, { status: 400 })

    const allResults: any[] = []
    const allErrors: any[] = []

    // Resolve adset for a given campaignId
    async function resolveAdset(campaignId: string, creativeSubset: any[], index = 1) {
      if (adsetMode === "existing") return existingAdsetId || template.adset.id
      if (adsetMode === "new") {
        const s = await buildAdset(adAccountId, token, template, campaignId, newAdsetName || template.adset.name, adsetDailyBudget)
        return s.id
      }
      if (adsetMode === "per_creative") {
        // will be handled per-creative outside
        return null
      }
      if (adsetMode === "auto_divide") {
        const name = applyPattern(autoDividePattern || "Ad Set {index:01}", { index, date: dateStr, shortDate: shortDateStr })
        const s = await buildAdset(adAccountId, token, template, campaignId, name, adsetDailyBudget)
        return s.id
      }
    }

    // Resolve campaign(s)
    const campaignIds: string[] = []
    if (campaignOption === "multiple") {
      for (const name of (multipleCampaignNames || []).filter((n: string) => n.trim())) {
        const c = await createCampaign(adAccountId, token, {
          name, objective: template.campaign.objective,
          special_ad_categories: template.campaign.special_ad_categories || [], status: "PAUSED",
        })
        campaignIds.push(c.id)
      }
    } else if (campaignOption === "new") {
      const c = await createCampaign(adAccountId, token, {
        name: newCampaignName || template.campaign.name,
        objective: template.campaign.objective,
        special_ad_categories: template.campaign.special_ad_categories || [], status: "PAUSED",
      })
      campaignIds.push(c.id)
    } else {
      campaignIds.push(existingCampaignId || template.adset.campaign_id)
    }

    // Custom config mode: bypass normal campaign loop entirely
    if (adsetMode === "custom" && customConfig?.length > 0) {
      let globalIdx = 1
      for (const campConfig of customConfig) {
        const camp = await createCampaign(adAccountId, token, {
          name: campConfig.name,
          objective: template.campaign.objective,
          special_ad_categories: template.campaign.special_ad_categories || [],
          status: "PAUSED",
        })
        for (const adsetConfig of campConfig.adsets) {
          if (!adsetConfig.creativeIds?.length) continue
          const adset = await buildAdset(adAccountId, token, template, camp.id, adsetConfig.name, adsetDailyBudget)
          const adsetCreatives = creatives.filter((c: any) => adsetConfig.creativeIds.includes(c.id))
          const { results, errors } = await createAdsInAdset(adset.id, adsetCreatives, adAccountId, token, pageId, supabase, resolveAdName, globalIdx)
          globalIdx += adsetCreatives.length
          allResults.push(...results)
          allErrors.push(...errors)
        }
      }
      return NextResponse.json({
        success: true, created: allResults, errors: allErrors,
        summary: `${allResults.length} ads created, ${allErrors.length} failed`,
      })
    }

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
          const adset = await buildAdset(adAccountId, token, template, campaignId, name, adsetDailyBudget)
          const { results, errors } = await createAdsInAdset(adset.id, [creative], adAccountId, token, pageId, supabase, resolveAdName, i + 1)
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
          const { results, errors } = await createAdsInAdset(adsetId!, chunks[i], adAccountId, token, pageId, supabase, resolveAdName, globalIdx)
          globalIdx += chunks[i].length
          allResults.push(...results)
          allErrors.push(...errors)
        }
      } else {
        const adsetId = await resolveAdset(campaignId, campaignCreatives)
        const { results, errors } = await createAdsInAdset(adsetId!, campaignCreatives, adAccountId, token, pageId, supabase, resolveAdName, 1)
        allResults.push(...results)
        allErrors.push(...errors)
      }
    }

    return NextResponse.json({
      success: true,
      created: allResults,
      errors: allErrors,
      summary: `${allResults.length} ads created, ${allErrors.length} failed`,
    })
  } catch (err: any) {
    console.error("Launch error:", err)
    return NextResponse.json({ error: err.message || "Launch failed" }, { status: 500 })
  }
}
