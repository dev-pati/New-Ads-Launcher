import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createAd, getVideoThumbnail } from "@/lib/facebook"

// Simple launch: create ads directly in existing ad sets.
// N creatives × M ad sets = N×M ads. No campaign/adset creation needed.
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "Facebook not connected" }, { status: 400 })

    const token = connection.access_token
    const supabase = await createClient()

    const body = await request.json()
    const {
      adAccountId,
      adAccountName,
      adSetIds,
      adSetNames,
      creativeIds,
      pageId,
      headline,
      primaryText,
      cta,
      webLink,
      createPaused,
      startTime: scheduledStart,
      partnerPageId,
      partnershipDisplayMode,
      multilanguage,
      catalogAds,
      carouselAds,
      flexibleAds,
      multiPlacementAds,
    } = body

    if (!adAccountId) return NextResponse.json({ error: "adAccountId is required" }, { status: 400 })
    if (!adSetIds?.length) return NextResponse.json({ error: "Select at least one ad set" }, { status: 400 })
    if (!creativeIds?.length) return NextResponse.json({ error: "Select at least one creative" }, { status: 400 })
    if (!pageId) return NextResponse.json({ error: "Select a Facebook Page" }, { status: 400 })
    if (!webLink) return NextResponse.json({ error: "Web link (URL) is required" }, { status: 400 })
    if (!webLink.startsWith("http")) return NextResponse.json({ error: "URL must start with http:// or https://" }, { status: 400 })

    // Verify ad account belongs to this org
    const { data: adAccounts } = await supabase
      .from("ad_accounts")
      .select("fb_ad_account_id")
      .eq("org_id", ctx.orgId)
    const accountIds = (adAccounts || []).map((a: any) => a.fb_ad_account_id)
    if (!accountIds.includes(adAccountId)) {
      return NextResponse.json({ error: "Ad account not found" }, { status: 403 })
    }

    // Fetch creatives from DB
    const { data: creatives, error: creativeErr } = await supabase
      .from("creatives")
      .select("*")
      .in("id", creativeIds)
      .eq("org_id", ctx.orgId)

    if (creativeErr || !creatives?.length) {
      return NextResponse.json({ error: "Creatives not found" }, { status: 400 })
    }

    const adStatus = createPaused === false ? "ACTIVE" : "PAUSED"
    const created: any[] = []
    const errors: any[] = []

    // ── Multi Placement Ads branch ──────────────────────────────────
    // Each group → ONE ad per ad set, using asset_feed_spec with placement customization rules
    // Maps each media's aspect to the appropriate placement (Feed/Stories/Reels)
    if (multiPlacementAds && Array.isArray(multiPlacementAds.groups) && multiPlacementAds.groups.length > 0) {
      const creativeMap = new Map(creatives.map((c: any) => [c.id, c]))
      const placementMap: Record<string, { publisher_platforms: string[]; positions: { key: string; values: string[] } }> = {
        feed: { publisher_platforms: ["facebook", "instagram"], positions: { key: "facebook_positions", values: ["feed"] } },
        story: { publisher_platforms: ["facebook", "instagram"], positions: { key: "facebook_positions", values: ["story"] } },
        reels: { publisher_platforms: ["facebook", "instagram"], positions: { key: "facebook_positions", values: ["facebook_reels"] } },
        right_column: { publisher_platforms: ["facebook"], positions: { key: "facebook_positions", values: ["right_hand_column"] } },
        marketplace: { publisher_platforms: ["facebook"], positions: { key: "facebook_positions", values: ["marketplace"] } },
        explore: { publisher_platforms: ["instagram"], positions: { key: "instagram_positions", values: ["explore"] } },
      }

      for (const adSetId of adSetIds) {
        for (const grp of multiPlacementAds.groups) {
          const imageHashes: string[] = []
          const videos: any[] = []
          const customRules: any[] = []

          grp.creativeIds.forEach((cid: string) => {
            const cr: any = creativeMap.get(cid)
            if (!cr) return
            let assetIdx: number, assetType: "image" | "video"
            if (cr.fb_image_hash) { imageHashes.push(cr.fb_image_hash); assetIdx = imageHashes.length - 1; assetType = "image" }
            else if (cr.fb_video_id) { videos.push({ video_id: cr.fb_video_id, thumbnail_url: cr.fb_thumbnail_url || undefined }); assetIdx = videos.length - 1; assetType = "video" }
            else return

            // Manual placements override
            const userPlacements: string[] = grp.placements?.[cid] || []
            if (multiPlacementAds.manualPlacements && userPlacements.length > 0) {
              for (const pk of userPlacements) {
                const pmap = placementMap[pk]
                if (!pmap) continue
                customRules.push({
                  customization_spec: {
                    publisher_platforms: pmap.publisher_platforms,
                    [pmap.positions.key]: pmap.positions.values,
                  },
                  ...(assetType === "image" ? { image_label: { name: `img_${assetIdx}` } } : { video_label: { name: `vid_${assetIdx}` } }),
                })
              }
            }
          })

          if (imageHashes.length + videos.length < 2) {
            errors.push({ adSetId, multiGroup: grp.name, error: "Multi-placement group needs ≥2 media" })
            continue
          }

          try {
            const ad = await createAd(adAccountId, token, {
              name: grp.name,
              adset_id: adSetId,
              page_id: pageId,
              title: headline || "",
              body: primaryText || "",
              cta: cta || "LEARN_MORE",
              link_url: webLink,
              status: adStatus,
              branded_content_sponsor_page_id: partnerPageId || undefined,
              partnership_display_mode: partnershipDisplayMode || undefined,
              multi_placement: {
                imageHashes,
                videos,
                customRules,
              },
            })
            created.push({ adId: ad.id, adSetId, multiGroup: grp.name, mediaCount: imageHashes.length + videos.length })
          } catch (err: any) {
            errors.push({ adSetId, multiGroup: grp.name, error: err.message || "Multi-placement ad failed" })
          }
        }
      }
    } else
    // ── Flexible Ads branch ─────────────────────────────────────────
    // Each Flexible Ad → ONE ad per ad set, using asset_feed_spec to hold all media variants.
    if (Array.isArray(flexibleAds) && flexibleAds.length > 0) {
      const creativeMap = new Map(creatives.map((c: any) => [c.id, c]))
      for (const adSetId of adSetIds) {
        for (const fa of flexibleAds) {
          const allImageHashes: string[] = []
          const allVideos: { video_id: string; thumbnail_url?: string }[] = []
          const groupAssetIndex: Array<{ image_indices?: number[]; video_indices?: number[] }> = []

          for (const g of fa.groups) {
            const imgIdx: number[] = []
            const vidIdx: number[] = []
            for (const cid of g.creativeIds) {
              const cr: any = creativeMap.get(cid)
              if (!cr) continue
              if (cr.fb_image_hash) {
                allImageHashes.push(cr.fb_image_hash)
                imgIdx.push(allImageHashes.length - 1)
              } else if (cr.fb_video_id) {
                allVideos.push({ video_id: cr.fb_video_id, thumbnail_url: cr.fb_thumbnail_url || undefined })
                vidIdx.push(allVideos.length - 1)
              }
            }
            groupAssetIndex.push({ image_indices: imgIdx, video_indices: vidIdx })
          }

          if (allImageHashes.length + allVideos.length === 0) {
            errors.push({ adSetId, flexibleAd: fa.name, error: "No valid uploaded media in flexible ad" })
            continue
          }

          try {
            const ad = await createAd(adAccountId, token, {
              name: fa.name,
              adset_id: adSetId,
              page_id: pageId,
              title: headline || "",
              body: primaryText || "",
              cta: cta || "LEARN_MORE",
              link_url: webLink,
              status: adStatus,
              branded_content_sponsor_page_id: partnerPageId || undefined,
              partnership_display_mode: partnershipDisplayMode || undefined,
              flexible_asset_feed: {
                image_hashes: allImageHashes,
                videos: allVideos,
                group_asset_indices: groupAssetIndex,
              },
            })
            created.push({ adId: ad.id, adSetId, flexibleAd: fa.name, groups: fa.groups.length })
          } catch (err: any) {
            errors.push({ adSetId, flexibleAd: fa.name, error: err.message || "Flexible ad failed" })
          }
        }
      }
    } else
    // ── Carousel Ads branch ─────────────────────────────────────────
    // If carouselAds[] provided, each carousel becomes ONE ad with N child cards (per ad set).
    if (Array.isArray(carouselAds) && carouselAds.length > 0) {
      const creativeMap = new Map(creatives.map((c: any) => [c.id, c]))
      for (const adSetId of adSetIds) {
        for (const carousel of carouselAds) {
          const childCards: any[] = []
          for (const card of carousel.cards) {
            const cr: any = creativeMap.get(card.creativeId)
            if (!cr || (!cr.fb_image_hash && !cr.fb_video_id)) continue
            childCards.push({
              image_hash: cr.fb_image_hash || undefined,
              video_id: cr.fb_video_id || undefined,
              name: card.headline || headline || "",
              description: card.description || "",
              link: card.linkUrl || webLink,
              call_to_action: { type: card.cta || cta || "LEARN_MORE", value: { link: card.linkUrl || webLink } },
            })
          }
          if (childCards.length < 2) {
            errors.push({ adSetId, carousel: carousel.name, error: "Carousel needs at least 2 valid cards" })
            continue
          }
          try {
            const ad = await createAd(adAccountId, token, {
              name: carousel.name,
              adset_id: adSetId,
              page_id: pageId,
              image_hash: undefined,
              video_id: undefined,
              title: headline || "",
              body: primaryText || "",
              cta: cta || "LEARN_MORE",
              link_url: webLink,
              status: adStatus,
              branded_content_sponsor_page_id: partnerPageId || undefined,
              partnership_display_mode: partnershipDisplayMode || undefined,
              carousel_cards: childCards,
              carousel_show_collection_tiles: !!carousel.showAsCollectionTiles,
              carousel_show_single_media: !!carousel.showAsSingleMedia,
            })
            created.push({ adId: ad.id, adSetId, carousel: carousel.name, cards: childCards.length })
          } catch (err: any) {
            errors.push({ adSetId, carousel: carousel.name, error: err.message || "Carousel ad failed" })
          }
        }
      }
      // Skip the standard per-creative loop when carousels are used
    } else {
    // ── Standard per-creative loop ──────────────────────────────────
    for (const adSetId of adSetIds) {
      for (const creative of creatives) {
        if (!creative.fb_image_hash && !creative.fb_video_id) {
          errors.push({
            adSetId,
            creativeId: creative.id,
            fileName: creative.file_name,
            error: "Creative not yet uploaded to Meta. Open the Ads Manager page and upload it first.",
          })
          continue
        }

        const adName = creative.file_name.replace(/\.[^/.]+$/, "")

        let thumbnailUrl: string | undefined = creative.fb_thumbnail_url || undefined
        if (creative.fb_video_id && !thumbnailUrl) {
          thumbnailUrl = (await getVideoThumbnail(creative.fb_video_id, token)) || undefined
        }

        try {
          const ad = await createAd(adAccountId, token, {
            name: adName,
            adset_id: adSetId,
            page_id: pageId,
            image_hash: creative.fb_image_hash || undefined,
            video_id: creative.fb_video_id || undefined,
            thumbnail_url: thumbnailUrl,
            title: headline || creative.headline || "",
            body: primaryText || creative.primary_text || "",
            description: "",
            cta: cta || creative.cta || "LEARN_MORE",
            link_url: webLink || creative.link_url || "",
            status: adStatus,
            branded_content_sponsor_page_id: partnerPageId || undefined,
            partnership_display_mode: partnershipDisplayMode || undefined,
            multilanguage: multilanguage || undefined,
            catalog_ads: catalogAds || undefined,
          })

          await supabase
            .from("creatives")
            .update({ status: "launched", fb_ad_id: ad.id })
            .eq("id", creative.id)

          created.push({
            adId: ad.id,
            adSetId,
            creativeId: creative.id,
            fileName: creative.file_name,
          })
        } catch (err: any) {
          errors.push({
            adSetId,
            creativeId: creative.id,
            fileName: creative.file_name,
            error: err.message || "Failed to create ad",
          })
        }
      }
    }
    } // end else (standard branch)

    const durationMs = Date.now() - startTime
    const batchStatus = errors.length === 0 ? "success" : created.length > 0 ? "partial" : "failed"

    // Collect creative thumbnails for history display
    const creativeThumbs = creatives
      .map((c: any) => c.fb_thumbnail_url || c.fb_image_url || c.file_url || null)
      .filter(Boolean) as string[]

    // Get user display name
    const { data: profile } = await supabase.auth.getUser()
    const userName = profile?.user?.user_metadata?.full_name
      || profile?.user?.email?.split("@")[0]
      || "Unknown"

    // Save launch batch to DB
    await supabase.from("launch_batches").insert({
      org_id: ctx.orgId,
      user_id: ctx.user.id,
      user_name: userName,
      ad_account_id: adAccountId,
      ad_account_name: adAccountName || adAccountId,
      adset_ids: adSetIds,
      adset_names: adSetNames || adSetIds,
      creative_ids: creativeIds,
      creative_thumbs: creativeThumbs,
      primary_text: primaryText || null,
      headline: headline || null,
      cta: cta || null,
      web_link: webLink || null,
      page_id: pageId || null,
      status: batchStatus,
      total_ads: created.length,
      failed_ads: errors.length,
      duration_ms: durationMs,
      errors: errors,
    })

    return NextResponse.json({
      success: true,
      created,
      errors,
      totalAds: created.length,
      durationMs,
      summary: `${created.length} ads created${errors.length ? `, ${errors.length} failed` : ""}`,
    })
  } catch (err: any) {
    console.error("[launch-direct] error:", err)
    return NextResponse.json({ error: err.message || "Launch failed" }, { status: 500 })
  }
}
