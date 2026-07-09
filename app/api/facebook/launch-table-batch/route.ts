import { NextRequest, NextResponse } from "next/server"
import { notifyOrgMembers } from "@/lib/notify-org"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { createAd, createCampaign, getAdDetails, getVideoThumbnail, pollVideoReady } from "@/lib/facebook"
import { buildAdset } from "@/lib/facebook-launch"
import { adAccountBelongsToOrg } from "@/app/api/facebook/_utils"

// Table Mode batch launch: accepts all rows in one request.
// Auth, account validation, creative fetch happen ONCE instead of N times.
// Meta API calls remain sequential to respect rate limits.
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const token = connection.access_token
    const supabase = createAdminClient()
    const adminDb = createAdminClient()

    const body = await request.json()
    const { rows, adAccountId, adAccountName, pageName: batchPageName } = body

    if (!rows?.length) return NextResponse.json({ error: "No rows provided" }, { status: 400 })
    if (!adAccountId) return NextResponse.json({ error: "adAccountId is required" }, { status: 400 })

    // Validate ad account once for all rows
    const belongs = await adAccountBelongsToOrg(ctx.orgId, adAccountId, token)
    if (!belongs) return NextResponse.json({ error: "Ad account not found or not authorized" }, { status: 403 })

    if (rows.some((r: any) => r.launchMode === "new_campaign")) {
      const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : null
      if (expiresAt && expiresAt < Date.now()) {
        return NextResponse.json({ error: "Facebook token expired — reconnect" }, { status: 400 })
      }
    }

    // Fetch all creatives in one DB query
    const allCreativeIds = [...new Set(rows.flatMap((r: any) => r.creativeIds || []))] as string[]
    const { data: allCreatives } = await supabase
      .from("creatives")
      .select("*")
      .in("id", allCreativeIds)
      .eq("org_id", ctx.orgId)

    const creativeMap = new Map((allCreatives || []).map((c: any) => [c.id, c]))

    // Poll all unprocessed videos in parallel across all rows
    const allVideosToCheck = [...creativeMap.values()]
      .filter((c: any) => c.fb_video_id && !c.fb_thumbnail_url)
      .map((c: any) => ({ creativeId: c.id, videoId: c.fb_video_id, fileName: c.file_name }))

    if (allVideosToCheck.length > 0) {
      const readyResults = await Promise.all(
        allVideosToCheck.map(v => pollVideoReady(v.videoId, token, 120_000).then(r => ({ ...v, ...r })))
      )
      await Promise.all(
        readyResults.filter(r => r.ready).map(async (r) => {
          const cr: any = creativeMap.get(r.creativeId)
          if (!cr) return
          let thumbUrl: string | null = null
          for (let attempt = 1; attempt <= 3; attempt++) {
            thumbUrl = await getVideoThumbnail(r.videoId, token)
            if (thumbUrl) break
            await new Promise(res => setTimeout(res, 3000))
          }
          if (thumbUrl) {
            cr.fb_thumbnail_url = thumbUrl
            await supabase.from("creatives").update({ fb_thumbnail_url: thumbUrl }).eq("id", r.creativeId)
          }
        })
      )
    }

    const userName = ctx.user.full_name || ctx.user.email?.split("@")[0] || "Unknown"
    const rowResults: any[] = []

    for (const row of rows) {
      const rowStart = Date.now()
      const {
        creativeIds,
        adName: rowAdName, pageId, instagramAccountId,
        headline, headlineVariations, primaryText, primaryTextVariations,
        description, descriptionVariations, cta, webLink,
        createPaused, startTime: scheduledStart, endTime: scheduledEnd,
        partnerPageId, partnershipDisplayMode, multilanguage, catalogAds,
        collectionAds, sitelinks, adSourceMode, adSourceIds, enhancements,
        launchMode, newCampaignConfig,
      } = row
      let { adSetIds, adSetNames } = row

      const adStatus = scheduledStart ? "PAUSED" : (createPaused === false ? "ACTIVE" : "PAUSED")
      const degreesOfFreedom: Record<string, any> | undefined = enhancements
        ? { creative_features_spec: { standard_enhancements: { enroll_status: enhancements.metaCreativeEnhancements ? "OPT_IN" : "OPT_OUT" } } }
        : undefined

      const rowCreatives = (creativeIds || []).map((id: string) => creativeMap.get(id)).filter(Boolean)
      const created: any[] = []
      const errors: any[] = []
      const warnings: string[] = []
      let newCampaignMeta: { campaignId: string; campaignName: string; adSetId?: string; adSetName: string } | null = null

      if (launchMode === "new_campaign") {
        if (!newCampaignConfig?.templateAdId || !newCampaignConfig?.campaignName?.trim() || !newCampaignConfig?.adSetName?.trim() || !newCampaignConfig?.dailyBudget) {
          errors.push({ error: "New campaign launch requires templateAdId, campaignName, adSetName, and dailyBudget" })
          rowResults.push({ created, errors, warnings, totalAds: 0, durationMs: Date.now() - rowStart, scheduledStart, scheduledEnd })
          continue
        }

        const template = await getAdDetails(newCampaignConfig.templateAdId, token)
        const objectiveMap: Record<string, string> = {
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
        const resolvedObjective = objectiveMap[template.campaign.objective] ?? template.campaign.objective
        const campaignName = newCampaignConfig.campaignName.trim()
        const adSetName = newCampaignConfig.adSetName.trim()
        const budget = Number(newCampaignConfig.dailyBudget)
        const budgetLevel = newCampaignConfig.budgetLevel || "adset"
        const campaign = await createCampaign(adAccountId, token, {
          name: campaignName,
          objective: resolvedObjective,
          special_ad_categories: template.campaign.special_ad_categories || [],
          status: adStatus,
          daily_budget: budgetLevel === "campaign" ? budget : undefined,
          bid_strategy: budgetLevel === "campaign" ? (template.campaign.bid_strategy || "LOWEST_COST_WITHOUT_CAP") : undefined,
        })
        newCampaignMeta = { campaignId: campaign.id, campaignName, adSetName }

        try {
          const adset = await buildAdset(
            adAccountId, token, template, campaign.id, adSetName,
            budgetLevel === "adset" ? budget : undefined,
            undefined, pageId, resolvedObjective, undefined, undefined, adStatus
          )
          if (adset.overrideWarning) warnings.push(adset.overrideWarning)
          adSetIds = [adset.id]
          adSetNames = [adSetName]
          newCampaignMeta.adSetId = adset.id
        } catch (err: any) {
          errors.push({ error: err.message || "Failed to create ad set", orphanCampaignId: campaign.id })
          rowResults.push({ created, errors, warnings, newCampaign: newCampaignMeta, totalAds: 0, durationMs: Date.now() - rowStart, scheduledStart, scheduledEnd })
          continue
        }
      } else if (!adSetIds?.length) {
        errors.push({ error: "Select at least one ad set" })
        rowResults.push({ created, errors, warnings, totalAds: 0, durationMs: Date.now() - rowStart, scheduledStart, scheduledEnd })
        continue
      }

      const adSetNameMap = new Map<string, string>(
        (adSetIds || []).map((id: string, i: number) => [id, (adSetNames || [])[i] || id])
      )

      for (const adSetId of (adSetIds || [])) {
        for (const creative of rowCreatives) {
          if (!creative.fb_image_hash && !creative.fb_video_id) {
            errors.push({ adSetId, creativeId: creative.id, fileName: creative.file_name, error: "Creative not yet uploaded to Meta." })
            continue
          }
          const adName = rowAdName?.trim() || creative.file_name.replace(/\.[^/.]+$/, "")
          const sourceId = adSourceIds?.[creative.id] || ""

          if (adSourceMode === "post_id" && sourceId) {
            try {
              const ad = await createAd(adAccountId, token, {
                name: adName, adset_id: adSetId, page_id: pageId,
                object_story_id: sourceId, title: "", body: "",
                cta: cta || "LEARN_MORE", link_url: webLink || "", status: adStatus,
              })
              await supabase.from("creatives").update({ status: "launched", fb_ad_id: ad.id }).eq("id", creative.id)
              created.push({ adId: ad.id, adSetId, adSetName: adSetNameMap.get(adSetId) || adSetId, creativeId: creative.id, fileName: creative.file_name, mode: "post_id" })
            } catch (err: any) {
              errors.push({ adSetId, creativeId: creative.id, fileName: creative.file_name, error: err.message })
            }
            continue
          }

          if (adSourceMode === "creative_id" && sourceId) {
            try {
              const ad = await createAd(adAccountId, token, {
                name: adName, adset_id: adSetId, page_id: pageId,
                reuse_creative_id: sourceId, title: "", body: "",
                cta: cta || "LEARN_MORE", link_url: webLink || "", status: adStatus,
              })
              await supabase.from("creatives").update({ status: "launched", fb_ad_id: ad.id }).eq("id", creative.id)
              created.push({ adId: ad.id, adSetId, adSetName: adSetNameMap.get(adSetId) || adSetId, creativeId: creative.id, fileName: creative.file_name, mode: "creative_id" })
            } catch (err: any) {
              errors.push({ adSetId, creativeId: creative.id, fileName: creative.file_name, error: err.message })
            }
            continue
          }

          let thumbnailUrl: string | undefined
          const isMetaCdn = (u?: string | null) => !!u && /(fbcdn\.net|facebook\.com)/.test(u)
          if (creative.fb_video_id) {
            if (isMetaCdn(creative.fb_thumbnail_url)) {
              thumbnailUrl = creative.fb_thumbnail_url
            } else {
              thumbnailUrl = (await getVideoThumbnail(creative.fb_video_id, token)) || undefined
              if (thumbnailUrl) await supabase.from("creatives").update({ fb_thumbnail_url: thumbnailUrl }).eq("id", creative.id)
            }
          }

          try {
            const rowTitle = (headline || creative.headline || "").trim()
            const rowBody  = (primaryText || creative.primary_text || "").trim()
            const rowDesc  = (description || creative.description || "").trim()
            const allBodies = [rowBody,  ...(primaryTextVariations || [])].map((s: string) => s.trim()).filter(Boolean)
            const allTitles = [rowTitle, ...(headlineVariations    || [])].map((s: string) => s.trim()).filter(Boolean)
            const allDescs  = [rowDesc,  ...(descriptionVariations || [])].map((s: string) => s.trim()).filter(Boolean)
            const hasVariations = allBodies.length > 1 || allTitles.length > 1

            const ad = await createAd(adAccountId, token, {
              name: adName,
              adset_id: adSetId,
              page_id: pageId,
              instagram_actor_id: instagramAccountId || undefined,
              image_hash: creative.fb_image_hash || undefined,
              video_id: creative.fb_video_id || undefined,
              thumbnail_url: thumbnailUrl,
              title: rowTitle,
              body: rowBody,
              description: rowDesc,
              cta: cta || creative.cta || "LEARN_MORE",
              link_url: webLink || creative.link_url || "",
              status: adStatus,
              branded_content_sponsor_page_id: partnerPageId || undefined,
              partnership_display_mode: partnershipDisplayMode || undefined,
              multilanguage: multilanguage || undefined,
              catalog_ads: catalogAds || undefined,
              collection_ads: collectionAds || undefined,
              ...(hasVariations ? { text_variations: { bodies: allBodies, titles: allTitles, descriptions: allDescs } } : {}),
              sitelinks: sitelinks?.length > 0 ? sitelinks : undefined,
              degrees_of_freedom_spec: degreesOfFreedom,
            })
            await supabase.from("creatives").update({ status: "launched", fb_ad_id: ad.id }).eq("id", creative.id)
            created.push({
              adId: ad.id, adSetId, adSetName: adSetNameMap.get(adSetId) || adSetId,
              creativeId: creative.id, fileName: creative.file_name,
              thumbnailUrl: thumbnailUrl || creative.fb_thumbnail_url || creative.fb_image_url || null,
              mediaType: creative.media_type || "image",
            })
          } catch (err: any) {
            errors.push({ adSetId, creativeId: creative.id, fileName: creative.file_name, error: err.message || "Failed to create ad" })
          }
        }
      }

      rowResults.push({ created: newCampaignMeta ? created.map((c: any) => ({ ...c, newCampaign: newCampaignMeta })) : created, errors, warnings, newCampaign: newCampaignMeta, totalAds: created.length, durationMs: Date.now() - rowStart, scheduledStart, scheduledEnd })
    }

    // Aggregate all rows → ONE batch record
    const allCreated   = rowResults.flatMap(r => r.created)
    const allErrors    = rowResults.flatMap(r => r.errors)
    const totalCreated = allCreated.length
    const totalFailed  = allErrors.length

    const allAdSetIds    = [...new Set(allCreated.map((c: any) => c.adSetId).filter(Boolean))] as string[]
    const allAdSetNames  = [...new Set(allCreated.map((c: any) => c.adSetName).filter(Boolean))] as string[]
    const allThumbs      = [...new Set(
      [...creativeMap.values()].map((c: any) => c.fb_thumbnail_url || c.fb_image_url || c.file_url || null).filter(Boolean)
    )] as string[]

    const firstRow    = rows[0] || {}
    const batchStatus = allErrors.length === 0 ? "success" : allCreated.length > 0 ? "partial" : "failed"

    const { data: batchRecord, error: batchErr } = await adminDb.from("launch_batches").insert({
      org_id: ctx.orgId,
      user_id: ctx.user.id,
      user_name: userName,
      ad_account_id: adAccountId,
      ad_account_name: adAccountName || adAccountId,
      adset_ids: allAdSetIds,
      adset_names: allAdSetNames,
      creative_ids: allCreativeIds,
      creative_thumbs: allThumbs,
      primary_text: firstRow.primaryText || null,
      headline: firstRow.headline || null,
      cta: firstRow.cta || null,
      web_link: firstRow.webLink || null,
      page_id: firstRow.pageId || null,
      page_name: batchPageName || null,
      status: batchStatus,
      total_ads: totalCreated,
      failed_ads: totalFailed,
      duration_ms: Date.now() - startTime,
      errors: allErrors,
      created_ads: allCreated,
    }).select("id").single()

    if (batchErr) console.error("[launch-table-batch] Failed to save batch record:", batchErr)

    // Save scheduled activations per row
    for (const row of rowResults) {
      if (row.scheduledStart && row.created.length > 0) {
        const adIds = row.created.map((c: any) => c.adId).filter(Boolean) as string[]
        if (adIds.length > 0) {
          await adminDb.from("scheduled_activations").insert({
            org_id: ctx.orgId,
            ad_account_id: adAccountId,
            ad_ids: adIds,
            scheduled_at: row.scheduledStart,
            end_time: row.scheduledEnd || null,
            status: "pending",
          })
        }
      }
    }

    const batchId = batchRecord?.id || null

    if (totalCreated > 0) {
      await notifyOrgMembers({
        orgId: ctx.orgId,
        actorId: ctx.user.id,
        actorName: userName,
        type: "ad_launched",
        title: `${userName} launched ${totalCreated} ad${totalCreated !== 1 ? "s" : ""}`,
        body: adAccountName ? `on ${adAccountName}` : undefined,
        link: batchId ? `/ads-manager?batch=${batchId}` : "/ads-manager",
      })
    }

    return NextResponse.json({
      success: true,
      batchId,
      rows: rowResults.map(r => ({ ...r, batchId })),
      totalCreated,
      totalFailed,
      durationMs: Date.now() - startTime,
    })
  } catch (err: any) {
    console.error("[launch-table-batch] error:", err)
    return NextResponse.json({ error: err.message || "Launch failed" }, { status: 500 })
  }
}
