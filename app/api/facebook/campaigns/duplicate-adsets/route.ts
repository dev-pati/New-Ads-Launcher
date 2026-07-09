import { NextRequest, NextResponse } from "next/server"
import { getAuthContext, getFacebookConnection } from "@/lib/auth"
import { fetchAllAds } from "@/lib/facebook-launch"

const GRAPH_API_BASE = "https://graph.facebook.com/v25.0"

// POST /api/facebook/campaigns/duplicate-adsets
// Body: { targetCampaignIds, adSetConfigs: [{
//   id, customName, copies, statusActive, startTime, endTime,
//   customAttribution, attrViewDays, attrClickDays, attrEngagedViewDays,
//   deepCopy, selectedAdIds, duplicatedAdsStatus
// }] }
// For each target campaign × each adSetConfig (× copies), copies the source ad set into target campaign.
// Optionally applies attribution_spec override and copies selected ads.
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const targetCampaignIds: string[] = Array.isArray(body.targetCampaignIds) ? body.targetCampaignIds : []
    const adSetConfigs: any[] = Array.isArray(body.adSetConfigs) ? body.adSetConfigs : []

    if (targetCampaignIds.length === 0) {
      return NextResponse.json({ error: "targetCampaignIds required" }, { status: 400 })
    }

    const connection = await getFacebookConnection(ctx.orgId)
    if (!connection) return NextResponse.json({ error: "No Facebook connection" }, { status: 400 })

    const buildAttributionSpec = (cfg: any): { event_type: string; window_days: number }[] | null => {
      if (!cfg.customAttribution) return null
      const spec: { event_type: string; window_days: number }[] = []
      const view = parseInt(cfg.attrViewDays || "0")
      const click = parseInt(cfg.attrClickDays || "0")
      const engaged = parseInt(cfg.attrEngagedViewDays || "0")
      if (view > 0) spec.push({ event_type: "VIEW_THROUGH", window_days: view })
      if (click > 0) spec.push({ event_type: "CLICK_THROUGH", window_days: click })
      if (engaged > 0) spec.push({ event_type: "ENGAGED_VIDEO_VIEW", window_days: engaged })
      return spec.length > 0 ? spec : null
    }

    const results: any[] = []
    const errors: string[] = []
    const warnings: string[] = []

    for (const targetCampaignId of targetCampaignIds) {
      const adSets: any[] = []
      for (const cfg of adSetConfigs) {
        const copies = Math.max(1, cfg.copies || 1)
        // Decide deep_copy strategy:
        // - If deepCopy true and selectedAdIds covers all ads → use Meta deep_copy=true (atomic, faster)
        // - If deepCopy true with subset → create empty ad set, then copy selected ads individually
        // - If deepCopy false → no ad copying
        const wantDeepCopy = !!cfg.deepCopy
        // null = "not specified" (use Meta deep_copy=true), [] = "explicitly empty" (no ads)
        const selectedAdIds: string[] | null = cfg.selectedAdIds === null ? null : Array.isArray(cfg.selectedAdIds) ? cfg.selectedAdIds : null
        const duplicatedAdsStatus = cfg.duplicatedAdsStatus === "ACTIVE" ? "ACTIVE" : "PAUSED"

        for (let k = 0; k < copies; k++) {
          const aSuffix = copies > 1 ? ` ${k + 1}` : ""
          // Use Meta deep_copy=true only when: deepCopy requested AND no specific subset chosen (null)
          // If selectedAdIds is an empty array [], user explicitly wants no ads copied → don't deep copy
          const useDeepCopyFlag = wantDeepCopy && selectedAdIds === null
          const adsetParams = new URLSearchParams({
            access_token: connection.access_token,
            campaign_id: targetCampaignId,
            deep_copy: useDeepCopyFlag ? "true" : "false",
            status_option: cfg.statusActive ? "ACTIVE" : "PAUSED",
          })
          const aRes = await fetch(`${GRAPH_API_BASE}/${cfg.id}/copies?${adsetParams}`, { method: "POST" })
          const aData = await aRes.json()
          if (!aRes.ok) {
            const msg = aData.error?.message || "copy failed"
            errors.push(`Ad set ${cfg.id} → campaign ${targetCampaignId}: ${msg}`)
            if (/rate limit|#4|request limit/i.test(msg)) {
              return NextResponse.json({ error: "Rate limited", rateLimited: true, partialResults: results }, { status: 429 })
            }
            continue
          }
          const newAdSetId = aData.copied_adset_id || aData.id
          if (!newAdSetId) continue

          // PATCH name + schedule + attribution_spec
          // Wait briefly — Meta needs a moment after /copies before the new ad set is patchable
          await new Promise(r => setTimeout(r, 400))

          const aUpdates: Record<string, string> = {}
          if (cfg.customName) aUpdates.name = cfg.customName + aSuffix
          if (cfg.startTime) aUpdates.start_time = cfg.startTime
          if (cfg.endTime) aUpdates.end_time = cfg.endTime
          const attrSpec = buildAttributionSpec(cfg)
          if (attrSpec) aUpdates.attribution_spec = JSON.stringify(attrSpec)

          if (Object.keys(aUpdates).length > 0) {
            const maxRetries = 3
            let renamed = false
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                const patchBody = new URLSearchParams(aUpdates)
                const pRes = await fetch(`${GRAPH_API_BASE}/${newAdSetId}?access_token=${encodeURIComponent(connection.access_token)}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/x-www-form-urlencoded" },
                  body: patchBody.toString(),
                })
                const pData = await pRes.json().catch(() => ({}))
                console.log(`[duplicate-adsets] PATCH ${newAdSetId} attempt ${attempt}:`, pRes.status, JSON.stringify(pData))
                if (pRes.ok) {
                  renamed = true
                  break
                }
                if (attempt < maxRetries) {
                  await new Promise(r => setTimeout(r, 600 * attempt))
                } else {
                  warnings.push(`Ad set ${newAdSetId} created but rename failed (${maxRetries} attempts): ${pData.error?.message || "unknown"}`)
                }
              } catch (e: any) {
                if (attempt === maxRetries) {
                  warnings.push(`Ad set ${newAdSetId} rename network error: ${e.message}`)
                }
              }
            }
            if (!renamed) console.warn(`[duplicate-adsets] Ad set ${newAdSetId} kept Meta default name (rename failed)`)
          }

          // Copy selected ads individually if subset chosen (and not using deep_copy=true)
          const copiedAdIds: string[] = []
          if (wantDeepCopy && selectedAdIds !== null && selectedAdIds.length > 0 && !useDeepCopyFlag) {
            for (const sourceAdId of selectedAdIds) {
              try {
                const copyAdParams = new URLSearchParams({
                  access_token: connection.access_token,
                  adset_id: newAdSetId,
                  status_option: duplicatedAdsStatus,
                })
                const adRes = await fetch(`${GRAPH_API_BASE}/${sourceAdId}/copies?${copyAdParams}`, { method: "POST" })
                const adData = await adRes.json()
                if (adRes.ok && (adData.copied_ad_id || adData.id)) {
                  copiedAdIds.push(adData.copied_ad_id || adData.id)
                } else if (adData.error) {
                  warnings.push(`Ad ${sourceAdId} copy failed: ${adData.error.message}`)
                }
              } catch (e: any) {
                warnings.push(`Ad ${sourceAdId} copy network error: ${e.message}`)
              }
            }
          }

          // Fetch all ads inside the new adset if deepCopy is enabled
          const ads = wantDeepCopy ? await fetchAllAds(newAdSetId, connection.access_token) : []

          adSets.push({
            id: newAdSetId,
            name: (cfg.customName || "Ad Set") + aSuffix,
            copiedAdIds,
            usedDeepCopy: useDeepCopyFlag,
            ads,
          })
        }
      }
      results.push({ id: targetCampaignId, adSets })
    }

    return NextResponse.json({ campaigns: results, errors, warnings })
  } catch (err: any) {
    console.error("[duplicate-adsets] error:", err)
    return NextResponse.json({ error: err.message || "Failed to duplicate ad sets" }, { status: 500 })
  }
}
