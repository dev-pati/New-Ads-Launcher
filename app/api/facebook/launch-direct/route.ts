import { NextRequest, NextResponse } from "next/server"
import { notifyOrgMembers } from "@/lib/notify-org"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createAd, getVideoThumbnail, pollVideoReady } from "@/lib/facebook"

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
      endTime: scheduledEnd,
      partnerPageId,
      partnershipDisplayMode,
      multilanguage,
      catalogAds,
      carouselAds,
      flexibleAds,
      multiPlacementAds,
      adSourceMode,  // "new_ad" | "post_id" | "creative_id"
      adSourceIds,   // Record<creativeId, objectStoryId | metaCreativeId>
      enhancements,  // DefaultAdSettings["enhancements"] | undefined
      launchSettings, // DefaultAdSettings["launch"] | undefined
      collectionAds, // CollectionAds config | undefined
    } = body

    // Build degrees_of_freedom_spec from Creative Enhancement settings.
    // metaCreativeEnhancements master toggle maps to standard_enhancements enroll_status.
    const degreesOfFreedom: Record<string, any> | undefined = enhancements
      ? {
          creative_features_spec: {
            standard_enhancements: {
              enroll_status: enhancements.metaCreativeEnhancements ? "OPT_IN" : "OPT_OUT",
            },
          },
        }
      : undefined

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

    // Scheduled ads must start PAUSED — cron job activates them at scheduled_at
    const adStatus = scheduledStart ? "PAUSED" : (createPaused === false ? "ACTIVE" : "PAUSED")
    const created: any[] = []
    const errors: any[] = []

    // Quick lookup: adSetId → adSetName (for enriching created[] entries)
    const adSetNameMap = new Map<string, string>(
      (adSetIds || []).map((id: string, i: number) => [id, (adSetNames || [])[i] || id])
    )

    // Skip polling for videos that already have a fb_thumbnail_url (proxy: thumbnail only exists
    // after Meta finishes processing). Only poll the recently-uploaded ones.
    const videosToCheck: { creativeId: string; videoId: string; fileName: string }[] = creatives
      .filter((c: any) => c.fb_video_id && !c.fb_thumbnail_url)
      .map((c: any) => ({ creativeId: c.id, videoId: c.fb_video_id, fileName: c.file_name }))

    if (videosToCheck.length > 0) {
      console.log(`[launch-direct] Polling ${videosToCheck.length} unprocessed video(s) for "ready" status (max 120s)…`)
      // Professional videos from Drive often need 45-90s to process. 120s is a safe expert-recommended limit.
      const readyResults = await Promise.all(
        videosToCheck.map(v => pollVideoReady(v.videoId, token, 120_000).then(r => ({ ...v, ...r })))
      )
      const notReady = readyResults.filter(r => !r.ready)
      for (const nr of notReady) {
        errors.push({
          creativeId: nr.creativeId,
          fileName: nr.fileName,
          error: `Video still processing on Meta. Wait 30-60s after upload then re-launch. (${nr.errorMsg})`,
        })
        const idx = creatives.findIndex((c: any) => c.id === nr.creativeId)
        if (idx >= 0) creatives.splice(idx, 1)
      }
      if (notReady.length === videosToCheck.length && creatives.length === 0) {
        return NextResponse.json({
          success: false,
          errors,
          totalAds: 0,
          summary: `All ${notReady.length} video(s) still processing. Upload finishes uploading first → Meta processes for ~10-30s → then launch.`,
        }, { status: 400 })
      }
      const ready = readyResults.filter(r => r.ready)
      console.log(`[launch-direct] ${ready.length}/${videosToCheck.length} videos ready (max wait ${Math.max(...readyResults.map(r => r.waitedMs))}ms)`)

      // Save thumbnails so next launch skips this video entirely
      await Promise.all(ready.map(async (r) => {
        const cr: any = creatives.find((c: any) => c.id === r.creativeId)
        if (!cr) return
        
        try {
          // Meta sometimes needs a few extra seconds to generate thumbnails even after video_status is "ready"
          let thumbUrl: string | null = null
          for (let attempt = 1; attempt <= 3; attempt++) {
            thumbUrl = await getVideoThumbnail(r.videoId, token)
            if (thumbUrl) break
            console.log(`[launch-direct] Thumbnail not ready yet for ${r.videoId}, attempt ${attempt}/3. Waiting 3s...`)
            await new Promise(res => setTimeout(res, 3000))
          }

          if (thumbUrl) {
            cr.fb_thumbnail_url = thumbUrl
            await supabase.from("creatives").update({ fb_thumbnail_url: thumbUrl }).eq("id", r.creativeId)
          } else {
            console.warn(`[launch-direct] WARNING: No thumbnail found for video ${r.videoId} after 3 attempts. Ad delivery might fail.`)
          }
        } catch (err) {
          console.error(`[launch-direct] Failed to get/save thumbnail for ${r.videoId}:`, err)
        }
      }))
    }

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
            created.push({ adId: ad.id, adSetId, adSetName: adSetNameMap.get(adSetId) || adSetId, multiGroup: grp.name, mediaCount: imageHashes.length + videos.length })
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
            created.push({ adId: ad.id, adSetId, adSetName: adSetNameMap.get(adSetId) || adSetId, flexibleAd: fa.name, groups: fa.groups.length })
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
            created.push({ adId: ad.id, adSetId, adSetName: adSetNameMap.get(adSetId) || adSetId, carousel: carousel.name, cards: childCards.length })
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
        const sourceId = adSourceIds?.[creative.id] || ""

        // ── Post ID mode ──────────────────────────────────────────────────────
        if (adSourceMode === "post_id" && sourceId) {
          try {
            const ad = await createAd(adAccountId, token, {
              name: adName,
              adset_id: adSetId,
              page_id: pageId,
              object_story_id: sourceId,
              title: "", body: "", cta: cta || "LEARN_MORE", link_url: webLink || "",
              status: adStatus,
            })
            await supabase.from("creatives").update({ status: "launched", fb_ad_id: ad.id }).eq("id", creative.id)
            created.push({ adId: ad.id, adSetId, adSetName: adSetNameMap.get(adSetId) || adSetId, creativeId: creative.id, fileName: creative.file_name, thumbnailUrl: creative.fb_thumbnail_url || creative.fb_image_url || null, mediaType: creative.media_type || "image", mode: "post_id" })
          } catch (err: any) {
            errors.push({ adSetId, creativeId: creative.id, fileName: creative.file_name, error: err.message || "Failed (post_id mode)" })
          }
          continue
        }

        // ── Creative ID mode ──────────────────────────────────────────────────
        if (adSourceMode === "creative_id" && sourceId) {
          try {
            const ad = await createAd(adAccountId, token, {
              name: adName,
              adset_id: adSetId,
              page_id: pageId,
              reuse_creative_id: sourceId,
              title: "", body: "", cta: cta || "LEARN_MORE", link_url: webLink || "",
              status: adStatus,
            })
            await supabase.from("creatives").update({ status: "launched", fb_ad_id: ad.id }).eq("id", creative.id)
            created.push({ adId: ad.id, adSetId, adSetName: adSetNameMap.get(adSetId) || adSetId, creativeId: creative.id, fileName: creative.file_name, thumbnailUrl: creative.fb_thumbnail_url || creative.fb_image_url || null, mediaType: creative.media_type || "image", mode: "creative_id" })
          } catch (err: any) {
            errors.push({ adSetId, creativeId: creative.id, fileName: creative.file_name, error: err.message || "Failed (creative_id mode)" })
          }
          continue
        }

        // ── New ad mode (default) ─────────────────────────────────────────────
        // Meta REQUIRES image_url or image_hash in video_data (subcode 1443226).
        // Always fetch from Meta CDN — Supabase URL won't work because Meta filters non-fbcdn URLs.
        let thumbnailUrl: string | undefined
        const isMetaCdn = (u?: string | null) => !!u && /(fbcdn\.net|facebook\.com)/.test(u)
        if (creative.fb_video_id) {
          if (isMetaCdn(creative.fb_thumbnail_url)) {
            thumbnailUrl = creative.fb_thumbnail_url
          } else {
            thumbnailUrl = (await getVideoThumbnail(creative.fb_video_id, token)) || undefined
            if (thumbnailUrl) {
              await supabase.from("creatives").update({ fb_thumbnail_url: thumbnailUrl }).eq("id", creative.id)
            }
          }
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
            collection_ads: collectionAds || undefined,
            degrees_of_freedom_spec: degreesOfFreedom,
          })

          await supabase
            .from("creatives")
            .update({ status: "launched", fb_ad_id: ad.id })
            .eq("id", creative.id)

          created.push({
            adId: ad.id,
            adSetId,
            adSetName: adSetNameMap.get(adSetId) || adSetId,
            creativeId: creative.id,
            fileName: creative.file_name,
            thumbnailUrl: thumbnailUrl || creative.fb_thumbnail_url || creative.fb_image_url || null,
            mediaType: creative.media_type || "image",
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

    const userName = ctx.user.full_name || ctx.user.email?.split("@")[0] || "Unknown"

    const adminDb = createAdminClient()
    const { data: batchRecord, error: batchErr } = await adminDb.from("launch_batches").insert({
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
      created_ads: created,
    }).select("id").single()
    if (batchErr) {
      console.error("[launch-direct] Failed to save launch batch:", batchErr)
    }
    const batchId: string | null = batchRecord?.id || null

    // Notify teammates about the launch
    if (created.length > 0) {
      await notifyOrgMembers({
        orgId: ctx.orgId,
        actorId: ctx.user.id,
        actorName: userName,
        type: "ad_launched",
        title: `${userName} launched ${created.length} ad${created.length !== 1 ? "s" : ""}`,
        body: adAccountName ? `on ${adAccountName}` : undefined,
        link: batchId ? `/ads-manager?batch=${batchId}` : "/ads-manager",
      })
    }

    // Save scheduled activation record so cron job can activate at the right time
    if (scheduledStart && created.length > 0) {
      const adIds = created
        .map((c: any) => c.adId)
        .filter(Boolean) as string[]
      if (adIds.length > 0) {
        const adminDb = createAdminClient()
        await adminDb.from("scheduled_activations").insert({
          org_id: ctx.orgId,
          ad_account_id: adAccountId,
          ad_ids: adIds,
          scheduled_at: scheduledStart,
          end_time: scheduledEnd || null,
          status: "pending",
        })
      }
    }

    return NextResponse.json({
      success: true,
      batchId,
      created,
      errors,
      totalAds: created.length,
      durationMs,
      scheduled: scheduledStart ? { at: scheduledStart, end: scheduledEnd || null } : null,
      summary: scheduledStart
        ? `${created.length} ads scheduled for ${new Date(scheduledStart).toLocaleString()}${errors.length ? `, ${errors.length} failed` : ""}`
        : `${created.length} ads created${errors.length ? `, ${errors.length} failed` : ""}`,
    })
  } catch (err: any) {
    console.error("[launch-direct] error:", err)
    return NextResponse.json({ error: err.message || "Launch failed" }, { status: 500 })
  }
}
