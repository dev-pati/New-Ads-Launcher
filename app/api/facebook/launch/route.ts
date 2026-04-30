import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getAdDetails, createCampaign, createAdSet, createAd } from "@/lib/facebook"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const supabase = await createClient()

    // Get ad account
    const { data: adAccounts } = await supabase
      .from("ad_accounts")
      .select("fb_ad_account_id")
      .eq("org_id", ctx.orgId)
      .limit(1)

    if (!adAccounts || adAccounts.length === 0) {
      return NextResponse.json({ error: "No ad account found" }, { status: 400 })
    }

    const adAccountId = adAccounts[0].fb_ad_account_id
    const token = connection.access_token

    const body = await request.json()
    const {
      templateAdId,        // ID of the ad to copy settings from
      creativeIds,         // Array of creative IDs to launch
      campaignOption,      // "existing" | "new"
      existingCampaignId,  // used if campaignOption = "existing"
      newCampaignName,     // used if campaignOption = "new"
      adsetOption,         // "existing" | "new"
      existingAdsetId,     // used if adsetOption = "existing"
      newAdsetName,        // used if adsetOption = "new"
      pageId,              // Facebook Page ID
    } = body

    if (!templateAdId || !creativeIds?.length) {
      return NextResponse.json({ error: "templateAdId and creativeIds are required" }, { status: 400 })
    }

    // 1. Get template ad details
    const template = await getAdDetails(templateAdId, token)

    // 2. Resolve campaign
    let campaignId = existingCampaignId
    if (campaignOption === "new") {
      const newCampaign = await createCampaign(adAccountId, token, {
        name: newCampaignName || `${template.campaign.name} - Copy`,
        objective: template.campaign.objective,
        special_ad_categories: template.campaign.special_ad_categories || [],
        status: "PAUSED",
      })
      campaignId = newCampaign.id
    } else if (!campaignId) {
      campaignId = template.adset.campaign_id
    }

    // 3. Resolve adset
    let adsetId = existingAdsetId
    if (adsetOption === "new") {
      const newAdset = await createAdSet(adAccountId, token, {
        name: newAdsetName || `${template.adset.name} - Copy`,
        campaign_id: campaignId,
        targeting: template.adset.targeting || {},
        optimization_goal: template.adset.optimization_goal,
        billing_event: template.adset.billing_event,
        bid_amount: template.adset.bid_amount,
        bid_strategy: template.adset.bid_strategy,
        daily_budget: template.adset.daily_budget,
        lifetime_budget: template.adset.lifetime_budget,
        status: "PAUSED",
      })
      adsetId = newAdset.id
    } else if (!adsetId) {
      adsetId = template.adset.id
    }

    // 4. Fetch creatives from DB
    const { data: creatives } = await supabase
      .from("creatives")
      .select("*")
      .in("id", creativeIds)
      .eq("org_id", ctx.orgId)

    if (!creatives || creatives.length === 0) {
      return NextResponse.json({ error: "No creatives found" }, { status: 400 })
    }

    // 5. Create ads for each creative
    const results = []
    const errors = []

    for (const creative of creatives) {
      try {
        const ad = await createAd(adAccountId, token, {
          name: creative.file_name.replace(/\.[^/.]+$/, ""),
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

        // Update creative status in DB
        await supabase
          .from("creatives")
          .update({ status: "launched", fb_ad_id: ad.id })
          .eq("id", creative.id)

        results.push({ creativeId: creative.id, adId: ad.id, name: creative.file_name })
      } catch (err: any) {
        errors.push({ creativeId: creative.id, error: err.message })
      }
    }

    return NextResponse.json({
      success: true,
      campaignId,
      adsetId,
      created: results,
      errors,
      summary: `${results.length} ads created, ${errors.length} failed`,
    })
  } catch (err: any) {
    console.error("Launch error:", err)
    return NextResponse.json({ error: err.message || "Launch failed" }, { status: 500 })
  }
}
